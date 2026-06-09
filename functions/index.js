'use strict';

// =============================================================================
// Real Anime Reviews — Cloud Functions entrypoint
// =============================================================================
// First server-side code on the project (v1.9.0 Community Overhaul).
// Cloud Functions do the three things firestore.rules CANNOT: (1) write into a
// doc the acting user doesn't own (notification fan-out with trustworthy author
// data), (2) cascade-delete a subtree, (3) count / rate-limit across documents.
// Full inventory + security reasoning: docs/DATA-MODEL.md.
//
// Gen-2 functions (firebase-functions v6). Deploy: `npm run deploy:functions`
// (NEVER a bare `firebase deploy`). Tests: pure units in `npm run test:functions`
// (no emulator); trigger wiring in `npm run test:cf` (functions+firestore emu).
//
// ⚠️ BILLING GUARDRAIL: a global maxInstances cap means no function — including
// a buggy/loop-triggered one — can scale to the Blaze ceiling. Pairs with the
// GCP budget alert (docs/DEPLOYMENT.md).
//
// ⚠️ DEPLOY STATE (updated for v1.10.0): the v1.9.0 functions — `ping` + the 13
// vote/notify/prune/cascade/rate-limit/suggestion CFs below — are ALL LIVE in
// production (deployed at the v1.9.0 cutover, 2026-06-08). The NEW v1.10.0 GATE-2
// moderation CFs at the BOTTOM of this file (acceptRules / setBanState /
// onBanCascade) are STAGED — they deploy with the rest of v1.10.0 at that cutover,
// NOT before (the gate-1 rules they pair with deny every community write until they
// exist). Never a bare `firebase deploy`; use `npm run deploy:functions`.
// =============================================================================

const { setGlobalOptions } = require('firebase-functions');
const { onRequest, onCall, HttpsError } = require('firebase-functions/https');
const { onDocumentWritten, onDocumentCreated, onDocumentDeleted } = require('firebase-functions/firestore');
const { onObjectFinalized } = require('firebase-functions/storage'); // v1.10.0 gate 13 — image pipeline
const admin = require('firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp'); // gate 13 — EXIF-strip re-encode

const { pingPayload } = require('./lib/ping');
const { voteCountDeltas } = require('./lib/votecounts');
const { hotScore } = require('./lib/hotscore'); // v1.10.0 gate 9 — forum thread "hot" rank
const { shouldNotify, isMuted } = require('./lib/notify');
const { notifsToPrune } = require('./lib/prune');
const { rateDecision } = require('./lib/ratelimit');
const moderation = require('./lib/moderation'); // v1.10.0 gate 2 — ban + consent cores
const { sniffImageType, contentTypeMatches, parseUploadPath } = require('./lib/imagecheck'); // gate 13
const { capDecision } = require('./lib/uploadcap');   // gate 13 — per-user bucket-fill cap
const images = require('./lib/images');               // gate 14 — admin atomic image removal
const { sha256Hex, hashDocId } = require('./lib/imagehash'); // image overhaul — per-user dedupe

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10, // hard cap — a runaway/loop cannot scale past this
});

admin.initializeApp();
const db = admin.firestore();

const NOTIF_KEEP = 10;          // mirrors the old client NOTIF_KEEP
const NOTIF_TTL_DAYS = 90;      // native-TTL expiresAt on each notification
const MARKER_TTL_DAYS = 7;      // idempotency markers self-expire
const DAY_MS = 86400000;
const RATE_WINDOW_MS = 60000;   // 60s rolling window for the detect-and-undo limiter
const RATE_LIMIT = 5;           // max content creates per window per user

// ---- v1.10.0 gates 12-14 — image uploads ----
// ONE bucket name everywhere (trigger registration, sweeps, client, tests):
// the project's default bucket. Pinning the literal keeps the emulator (whose
// synthesized default-bucket name has drifted across CLI versions) and prod on
// the same trigger — the storage emulator routes events by bucket NAME.
const UPLOADS_BUCKET = 'real-anime-reviews.firebasestorage.app';
const MAX_UPLOAD_FILES_PER_USER = 60;                 // ≤4 per post; 60 total ≈ 15 image-posts
const MAX_UPLOAD_BYTES_PER_USER = 100 * 1024 * 1024;  // 100MB per user across all uploads
const uploadsBucket = () => getStorage().bucket(UPLOADS_BUCKET);

// -----------------------------------------------------------------------------
// ping — no-op health check (the only function deployed live as of gate 2).
// -----------------------------------------------------------------------------
exports.ping = onRequest((req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json(pingPayload());
});

// -----------------------------------------------------------------------------
// Idempotency (M6): CF delivery is at-least-once. Create a per-event marker;
// if it already exists, this is a retry/duplicate — skip. `.create()` fails if
// the doc exists, which makes the check atomic.
// -----------------------------------------------------------------------------
async function alreadyProcessed(eventId) {
  try {
    await db.doc('cfProcessed/' + eventId).create({
      at: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + MARKER_TTL_DAYS * DAY_MS),
    });
    return false; // we created it -> first delivery
  } catch (_e) {
    return true;  // create failed -> already processed
  }
}

// Server-sourced sender identity — NEVER trust client-supplied name/photo.
// Prefer the new profiles/{uid}; fall back to the legacy users/{uid}.
async function senderIdentity(uid) {
  let name = null;
  let photo = null;
  const p = await db.doc('profiles/' + uid).get();
  if (p.exists) { name = p.data().displayName || null; photo = p.data().photoURL || null; }
  if (!name || !photo) {
    const u = await db.doc('users/' + uid).get();
    if (u.exists) {
      name = name || u.data().username || u.data().displayName || null;
      photo = photo || u.data().photoURL || null;
    }
  }
  return { name: name || 'Someone', photo: photo || null };
}

// -----------------------------------------------------------------------------
// onVoteWrite — fires on a vote doc create/update/delete under a comment or a
// community review. It (1) keeps the parent's like/dislike COUNTS exact via
// atomic increment() (replacing the old racy client transaction + the deleted
// client count-write), and (2) writes the recipient a notification whose sender
// name/photo are SERVER-SOURCED (closing the live spoof vector). Honors the
// recipient's mute prefs at the source.
// -----------------------------------------------------------------------------
async function handleVoteWrite(event, kind) {
  if (await alreadyProcessed(event.id)) return;

  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data().value : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data().value : null;
  const p = event.params;
  const voterUid = p.voterUid;

  const parentRef = kind === 'review'
    ? db.doc('reviews/' + p.anime + '/items/' + p.reviewUid)
    : kind === 'reply'
      ? db.doc('comments/' + p.anime + '/items/' + p.cid + '/replies/' + p.rid)
      : kind === 'thread'
        ? db.doc('reviews/' + p.anime + '/items/' + p.reviewUid + '/threads/' + p.tid)
        : kind === 'official'
          ? db.doc('official/' + p.animeId)
          : db.doc('comments/' + p.anime + '/items/' + p.cid);

  // (1) exact counts
  const { likesDelta, dislikesDelta } = voteCountDeltas(before, after);
  if (likesDelta !== 0 || dislikesDelta !== 0) {
    await parentRef.set(
      { likesCount: FieldValue.increment(likesDelta), dislikesCount: FieldValue.increment(dislikesDelta) },
      { merge: true }
    ).catch(() => {}); // parent may have been deleted
  }

  // thread (review-discussion) + official (Blake's-rating agreement) votes are
  // counts-only — no notification (matches their pre-overhaul behavior).
  if (kind === 'thread' || kind === 'official') return;
  // gate-6 lock: a "Not helpful" review vote (value -1) does NOT notify.
  if (kind === 'review' && after === -1) return;

  // (2) notification — only on a fresh up/down vote, never self, never on unvote
  const parentSnap = await parentRef.get();
  const authorUid = kind === 'review'
    ? p.reviewUid // a review's doc id IS the author uid
    : (parentSnap.exists ? parentSnap.data().uid : null); // comment & reply: author is on the doc
  if (!shouldNotify(voterUid, authorUid, after)) return;

  // a reply vote reuses the comment_vote type (the DATA-MODEL enum has no
  // reply_vote; "liked your reply" reads fine and the Lantern renders it as a
  // comment-family ping). verb below carries the literal kind ("reply").
  const type = kind === 'review' ? 'review_vote' : 'comment_vote';

  // mute-at-source: don't even write the doc if the recipient muted this type
  const prefsSnap = await db.doc('users/' + authorUid + '/notifPrefs/prefs').get();
  if (prefsSnap.exists && isMuted(prefsSnap.data(), type)) return;

  const ident = await senderIdentity(voterUid);
  const targetPath = parentRef.path;
  await db.collection('users/' + authorUid + '/notifications').add({
    toUid: authorUid,
    fromUid: voterUid,
    fromDisplayName: ident.name,   // server-sourced — a forged client name never reaches here
    fromPhotoURL: ident.photo,
    type,
    value: after,
    verb: kind === 'review' ? 'found your review helpful' : (after === 1 ? 'liked your ' : 'disliked your ') + kind,
    animeId: p.anime,
    targetPath,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + NOTIF_TTL_DAYS * DAY_MS),
  });
}

exports.onCommentVote = onDocumentWritten(
  'comments/{anime}/items/{cid}/votes/{voterUid}',
  (event) => handleVoteWrite(event, 'comment')
);
exports.onReviewVote = onDocumentWritten(
  'reviews/{anime}/items/{reviewUid}/votes/{voterUid}',
  (event) => handleVoteWrite(event, 'review')
);
// onReplyVote — same model one level deeper: a vote on a depth-1 comment reply.
// Owns the reply's like/dislike counts + notifies the reply author (gate 4b).
// onThreadVote — votes on a review's discussion thread. Counts-only (no notif),
// migrated off the old client count-write transaction at gate 5.
exports.onThreadVote = onDocumentWritten(
  'reviews/{anime}/items/{reviewUid}/threads/{tid}/votes/{voterUid}',
  (event) => handleVoteWrite(event, 'thread')
);
// onOfficialVote — votes on Blake's official rating (the agreement tally). Owns the
// `official/{animeId}` aggregate counts. Counts-only, migrated at gate 6 (the cutover).
exports.onOfficialVote = onDocumentWritten(
  'official/{animeId}/votes/{voterUid}',
  (event) => handleVoteWrite(event, 'official')
);
exports.onReplyVote = onDocumentWritten(
  'comments/{anime}/items/{cid}/replies/{rid}/votes/{voterUid}',
  (event) => handleVoteWrite(event, 'reply')
);

// =============================================================================
// GATE 9 (v1.10.0) — forum hub thread hotScore + the post-vote / post-create CFs
// that feed it. Counts-only (NO notifications — forum posts don't ping). The hub
// "Hot" sort reads forum/{threadId}.hotScore, which is CF-ONLY (the client can't
// write it, postCount, or lastPostAt — firestore.rules denies those fields).
//
// The thread doc holds the AGGREGATE net votes of its posts (likesCount /
// dislikesCount) + postCount; hotScore is recomputed from those whenever any of
// them moves. lib/hotscore.js is the pure formula (unit-tested without the emu).
// =============================================================================

// createdAt -> epoch ms. Threads seed createdAt as a Timestamp; tolerate a raw
// number or a missing field (NaN-guarded downstream by hotScore()).
function tsToMillis(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return 0;
}

// Recompute + write a thread's hotScore from a thread snapshot's current fields.
// Caller passes the snapshot (already read) plus the authoritative postCount to
// use (the snapshot may pre-date an increment we just issued). merge + .catch so
// a deleted thread no-ops.
function writeThreadHotScore(threadRef, threadData, postCountOverride, nowMs) {
  const d = threadData || {};
  const score = hotScore({
    likes: d.likesCount,
    dislikes: d.dislikesCount,
    postCount: postCountOverride != null ? postCountOverride : d.postCount,
    createdAtMs: tsToMillis(d.createdAt),
    nowMs: nowMs != null ? nowMs : Date.now(),
  });
  return threadRef.set({ hotScore: score }, { merge: true }).catch(() => {});
}

// onForumPostVote — a vote on a forum post (value 1/-1). COUNTS-ONLY, no notif.
// (a) idempotency guard; (b) the POST's own likesCount/dislikesCount via the
// shared voteCountDeltas + increment; (c) the SAME deltas onto the PARENT THREAD
// (so the thread carries its posts' net votes); (d) re-read the thread + rewrite
// its hotScore. Post + thread writes are merge + .catch (a deleted parent no-ops).
async function handleForumPostVote(event) {
  if (await alreadyProcessed(event.id)) return;

  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data().value : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data().value : null;
  const p = event.params;

  const { likesDelta, dislikesDelta } = voteCountDeltas(before, after);
  if (likesDelta === 0 && dislikesDelta === 0) return; // no net change (e.g. metadata-only write)

  const postRef = db.doc('forum/' + p.threadId + '/posts/' + p.postId);
  const threadRef = db.doc('forum/' + p.threadId);
  const counts = { likesCount: FieldValue.increment(likesDelta), dislikesCount: FieldValue.increment(dislikesDelta) };

  // (b) post counts + (c) thread aggregate counts — both via the same deltas.
  await Promise.all([
    postRef.set(counts, { merge: true }).catch(() => {}),   // post may have been deleted
    threadRef.set(counts, { merge: true }).catch(() => {}), // thread may have been deleted
  ]);

  // (d) recompute the thread's hotScore from its now-updated aggregate counts.
  const threadSnap = await threadRef.get();
  if (!threadSnap.exists) return; // thread gone -> nothing to score
  await writeThreadHotScore(threadRef, threadSnap.data());
}

exports.onForumPostVote = onDocumentWritten(
  'forum/{threadId}/posts/{postId}/votes/{voterUid}',
  (event) => handleForumPostVote(event)
);

// onForumPostCreate — a new post lands under a thread: bump the thread's
// postCount, advance lastPostAt to the post's createdAt (fallback serverTimestamp),
// and recompute hotScore. Idempotency-guarded. The read (current postCount) and the
// write run inside a TRANSACTION so concurrent first-posts under one thread can't lose
// an increment (the read-then-set version raced); the txn also keeps postCount + hotScore
// atomically consistent.
async function handleForumPostCreate(event) {
  if (await alreadyProcessed(event.id)) return;
  const post = event.data && typeof event.data.data === 'function' ? event.data.data() : null;
  const threadRef = db.doc('forum/' + event.params.threadId);
  const lastPostAt = post && post.createdAt ? post.createdAt : FieldValue.serverTimestamp();
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(threadRef);
      if (!snap.exists) return; // post under a vanished thread -> nothing to do
      const t = snap.data();
      const nextPostCount = (typeof t.postCount === 'number' ? t.postCount : 0) + 1;
      const score = hotScore({
        likes: t.likesCount,
        dislikes: t.dislikesCount,
        postCount: nextPostCount,
        createdAtMs: tsToMillis(t.createdAt),
        nowMs: Date.now(),
      });
      tx.set(threadRef, { postCount: nextPostCount, lastPostAt, hotScore: score }, { merge: true });
    });
  } catch (_e) { /* txn aborted (e.g. thread deleted mid-flight) — safe to drop */ }
}

exports.onForumPostCreate = onDocumentCreated(
  'forum/{threadId}/posts/{postId}',
  (event) => handleForumPostCreate(event)
);

// -----------------------------------------------------------------------------
// pruneNotificationsOnCreate — keeps each inbox at <=NOTIF_KEEP the instant a
// ping lands (server-side, regardless of whether the recipient is online —
// replacing the old client prune that only ran on page load). Native TTL on
// `expiresAt` handles long-term cleanup; this caps the live count.
// -----------------------------------------------------------------------------
exports.pruneNotificationsOnCreate = onDocumentCreated(
  'users/{uid}/notifications/{notifId}',
  async (event) => {
    const col = db.collection('users/' + event.params.uid + '/notifications');
    const snap = await col.orderBy('createdAt', 'desc').get();
    const toDelete = notifsToPrune(snap.docs.map((d) => d.id), NOTIF_KEEP);
    if (!toDelete.length) return;
    const batch = db.batch();
    toDelete.forEach((id) => batch.delete(col.doc(id)));
    await batch.commit();
  }
);

// =============================================================================
// GATE 3 — cascade deletes, account deletion, rate-limit, suggestion counts.
// Built + emulator-verified; deploy with the rest at the gate-6 cutover.
// Delete-triggered CFs are naturally idempotent (deleting an already-gone doc is
// a no-op), so they skip the eventId marker; the increment CFs keep it.
// =============================================================================

// sweepImageRefs (image overhaul) — exact-path Storage sweep for a hard-deleted
// comment/reply/review doc. Comments + reviews carry the author on `uid` (NOT
// authorUid like forum docs) and their image pointers on `imageRefs`. Each entry
// must (a) parse as a pipeline-owned uploads path AND (b) belong to the doc's
// own author (defense in depth — a forged ref can never aim the sweep at
// another user's object). Best-effort: a missing object or failed delete no-ops.
function sweepImageRefs(d) {
  if (!d || !d.uid || !Array.isArray(d.imageRefs) || !d.imageRefs.length) return Promise.resolve();
  return Promise.all(d.imageRefs.map((entry) => {
    const parsed = parseUploadPath(entry);
    if (!parsed || parsed.uid !== d.uid) return null;
    return uploadsBucket().file(entry).delete({ ignoreNotFound: true }).catch(() => {});
  }));
}

// onReviewDelete — a community review's reply `threads` + all `votes` are
// orphaned when the review is deleted (Firestore doesn't cascade — this orphan
// exists in production TODAY). recursiveDelete cleans the subtree. Image
// overhaul: the review's own uploaded images leave Storage with it (the doc id
// IS the author uid; the doc data also carries uid).
exports.onReviewDelete = onDocumentDeleted(
  'reviews/{anime}/items/{uid}',
  async (event) => {
    const d = event.data ? event.data.data() : null;
    await Promise.all([
      db.recursiveDelete(db.doc('reviews/' + event.params.anime + '/items/' + event.params.uid)),
      sweepImageRefs(d),
    ]);
  }
);

// onCommentDeleted / onCommentReplyDeleted (image overhaul) — comments and
// their replies HARD-delete (no removed-transition watchers needed; the ban
// cascade's whole-prefix sweep covers redaction). The deleted snapshot's
// imageRefs are swept by exact path.
exports.onCommentDeleted = onDocumentDeleted(
  'comments/{anime}/items/{cid}',
  (event) => sweepImageRefs(event.data ? event.data.data() : null)
);
exports.onCommentReplyDeleted = onDocumentDeleted(
  'comments/{anime}/items/{cid}/replies/{rid}',
  (event) => sweepImageRefs(event.data ? event.data.data() : null)
);

// onForumThreadDelete — a hard-deleted hub thread's `posts` (+ their votes) are
// orphaned. Threads are normally SOFT-deleted; this fires on a real hard delete
// (e.g. from onUserDelete). recursiveDelete cleans the subtree. Gate 14: the
// thread's own uploaded images leave Storage too (posts' images are wiped by
// onForumPostDelete as recursiveDelete removes each post doc).
exports.onForumThreadDelete = onDocumentDeleted('forum/{threadId}', async (event) => {
  const d = event.data ? event.data.data() : null;
  const tasks = [db.recursiveDelete(db.doc('forum/' + event.params.threadId))];
  if (d && d.authorUid) {
    tasks.push(uploadsBucket().deleteFiles({ prefix: 'uploads/' + d.authorUid + '/' + event.params.threadId + '/' }).catch(() => {}));
  }
  await Promise.all(tasks);
});

// onForumPostDelete (gate 14) — fires on any post hard delete, INCLUDING the
// recursiveDelete cascades above/in onUserDelete: the post's images leave
// Storage with the doc.
exports.onForumPostDelete = onDocumentDeleted('forum/{threadId}/posts/{postId}', async (event) => {
  const d = event.data ? event.data.data() : null;
  if (d && d.authorUid) {
    await uploadsBucket().deleteFiles({ prefix: 'uploads/' + d.authorUid + '/' + event.params.postId + '/' }).catch(() => {});
  }
});

// onUserDelete — DAY-1 account deletion (Blake's locked answer). Deleting the
// users/{uid} doc fans out a full wipe so the privacy page's deletion promise is
// real: ZERO trace of the user in public content; their foreign votes swept; DMs
// tombstoned (private 2-party — we lock them, we don't nuke the other person's
// thread). Naturally idempotent (re-deleting gone docs is a no-op).
exports.onUserDelete = onDocumentDeleted('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const tasks = [];

  // authored comments AND community reviews (both under an `items` group, both
  // carry uid == author) — recursiveDelete each to clean votes/replies/threads.
  const items = await db.collectionGroup('items').where('uid', '==', uid).get();
  items.forEach((d) => tasks.push(db.recursiveDelete(d.ref)));

  // authored hub threads (cleans their posts) + authored posts + review-reply
  // threads + comment replies.
  const threadsAuthored = await db.collection('forum').where('authorUid', '==', uid).get();
  threadsAuthored.forEach((d) => tasks.push(db.recursiveDelete(d.ref)));
  const postsAuthored = await db.collectionGroup('posts').where('authorUid', '==', uid).get();
  postsAuthored.forEach((d) => tasks.push(db.recursiveDelete(d.ref)));
  const reviewReplies = await db.collectionGroup('threads').where('uid', '==', uid).get();
  reviewReplies.forEach((d) => tasks.push(db.recursiveDelete(d.ref)));
  const commentReplies = await db.collectionGroup('replies').where('uid', '==', uid).get();
  commentReplies.forEach((d) => tasks.push(db.recursiveDelete(d.ref)));

  // FOREIGN votes — the user's vote docs scattered under OTHER people's content
  // (the L5 sweep; vote docs carry uid == voter so this is queryable).
  const foreignVotes = await db.collectionGroup('votes').where('uid', '==', uid).get();
  foreignVotes.forEach((d) => tasks.push(d.ref.delete()));

  // the user's own subtree (favorites/watchlist/notifications/notifPrefs/notifMeta)
  // + public profile.
  tasks.push(db.recursiveDelete(db.doc('users/' + uid)));
  tasks.push(db.doc('profiles/' + uid).delete());

  // gate 14 — EVERY image they ever uploaded leaves Storage ("ZERO trace" now
  // spans the bucket, not just Firestore).
  tasks.push(uploadsBucket().deleteFiles({ prefix: 'uploads/' + uid + '/' }).catch(() => {}));

  // tombstone DMs they're in (don't half-delete the other party's thread).
  const convos = await db.collection('conversations').where('participants', 'array-contains', uid).get();
  convos.forEach((d) => tasks.push(d.ref.set({ state: 'locked', closedByDeletion: true }, { merge: true })));

  await Promise.all(tasks);
});

// enforceRateLimit (detect-and-undo) — fires AFTER a create lands (doesn't change
// the client write path, per gate-0 §5). Maintains a per-user rolling counter in
// rateState/{uid}; if the user is over the limit, it DELETES the offending doc.
// The callable pre-block stays the documented escalation if abuse appears.
async function enforceRateLimit(event, authorField) {
  const data = event.data && typeof event.data.data === 'function' ? event.data.data() : null;
  const uid = data ? data[authorField] : null;
  if (!uid) return;
  const stateRef = db.doc('rateState/' + uid);
  const over = await db.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef);
    const prevFlagged = snap.exists && snap.data().flagged === true;
    const { overLimit, nextState } = rateDecision(snap.exists ? snap.data() : null, Date.now(), RATE_WINDOW_MS, RATE_LIMIT);
    tx.set(stateRef, Object.assign({}, nextState, { flagged: overLimit || prevFlagged }));
    return overLimit;
  });
  if (over) await event.data.ref.delete().catch(() => {}); // detect-and-undo
}

exports.rateLimitForumThread = onDocumentCreated('forum/{threadId}', (e) => enforceRateLimit(e, 'authorUid'));
exports.rateLimitComment = onDocumentCreated('comments/{anime}/items/{cid}', (e) => enforceRateLimit(e, 'uid'));

// aggregateSuggestionCounts — on each suggestion create, bump the count-only,
// admin-read rollup keyed by anilistId (+ a snapshot for the admin queue). Raw-
// title submissions (no anilistId) are skipped. Idempotent via the eventId marker
// (it's an increment). firstSuggestedAt is written once; status is preserved.
exports.aggregateSuggestionCounts = onDocumentCreated('suggestions/{docId}', async (event) => {
  if (await alreadyProcessed(event.id)) return;
  const s = event.data && typeof event.data.data === 'function' ? event.data.data() : null;
  if (!s || !s.anilistId) return; // raw-title submission -> no rollup
  const ref = db.doc('suggestionCounts/' + s.anilistId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = {
      anilistId: s.anilistId,
      count: FieldValue.increment(1),
      title: s.englishTitle || s.title || null,
      coverImage: s.coverImage || null,
      format: s.format || null,
      year: s.year || null,
      status: snap.exists ? (snap.data().status || 'new') : 'new',
      lastSuggestedAt: FieldValue.serverTimestamp(),
    };
    if (!snap.exists) next.firstSuggestedAt = FieldValue.serverTimestamp();
    tx.set(ref, next, { merge: true });
  });
});

// =============================================================================
// v1.10.0 GATE 2 — the MODERATION SPINE CFs (ban + community-rules consent).
// STAGED — deploy with the rest of v1.10.0 at the cutover. The gate-1 rules read
// the moderationGate/{uid} doc these manage; without these CFs no one has that doc,
// so every community write is denied (which is why these can't deploy early).
// Cores live in lib/moderation.js (testable; cf-tests drive them against the emu).
// =============================================================================

// acceptRules (callable) — mints the caller's first moderationGate doc + the
// rulesConsent record. The load-bearing one: nothing else can create that doc.
exports.acceptRules = onCall(async (request) => {
  try {
    return await moderation.applyAcceptRules(
      db, FieldValue,
      request.auth && request.auth.uid,
      request.data && request.data.version
    );
  } catch (e) { throw new HttpsError(e.code || 'internal', e.message || 'acceptRules failed'); }
});

// setBanState (callable, admin-only — literal-UID gated in the core, never a client
// field) — ban/unban a user: writes banned/{uid} (triggers the cascade below) +
// moderationGate.banned + a best-effort custom claim. Unban reverses all three.
exports.setBanState = onCall(async (request) => {
  const setClaim = (uid, banned) => admin.auth().setCustomUserClaims(uid, { banned: !!banned });
  try {
    return await moderation.applySetBanState(
      db, FieldValue, setClaim,
      request.auth && request.auth.uid,
      request.data && request.data.uid,
      !!(request.data && request.data.banned),
      request.data && request.data.reason
    );
  } catch (e) { throw new HttpsError(e.code || 'internal', e.message || 'setBanState failed'); }
});

// onBanCascade (trigger on a banned/{uid} create) — H5-redact the banned user's
// authored backlog + lock their conversations. Idempotent (alreadyProcessed +
// re-redacting empty content is a no-op).
exports.onBanCascade = onDocumentCreated('banned/{uid}', async (event) => {
  if (await alreadyProcessed(event.id)) return;
  await moderation.runBanCascade(db, FieldValue, event.params.uid);
  // gate 14 — a banned user's images actually leave Storage (the redaction
  // above empties their docs; this empties their bucket prefix).
  await uploadsBucket().deleteFiles({ prefix: 'uploads/' + event.params.uid + '/' }).catch(() => {});
});

// =============================================================================
// v1.10.0 GATES 13-14 — the IMAGE PIPELINE (STAGED, deploys at the cutover).
// storage.rules is the first fence (owner path, ≤5MB, image/* no-SVG, email-
// verified, ban+consent cross-read, kill-switch). THIS is the second:
// server-side magic-byte truth, EXIF strip, and the per-user bucket-fill cap
// rules can't do. Forum surfaces only — no other upload path exists.
// =============================================================================

// processUploadedImage — onObjectFinalized for uploads/{uid}/{docId}/{imageId}:
//   (1) skip our own re-upload (cfProcessed metadata — breaks the finalize loop);
//   (2) per-uid count/byte cap (list the prefix — the only cross-object truth);
//   (3) magic-byte re-validate (a spoofed contentType / SVG / HTML payload is
//       DELETED — storage.rules trusts client metadata, this doesn't);
//   (3b) per-USER dedupe via the uploadHashes registry (same exact bytes from
//        the same uid twice -> the new object is deleted; see lib/imagehash.js);
//   (4) sharp re-encode — strips EXIF/GPS/metadata (rotate() first so the EXIF
//       orientation is baked in before the tag is dropped). Unparseable input
//       is DELETED (fail closed: what we can't verify doesn't get published).
exports.processUploadedImage = onObjectFinalized(
  { bucket: UPLOADS_BUCKET, memory: '512MiB' },
  async (event) => {
    const obj = event.data;
    const parsed = parseUploadPath(obj.name);
    if (!parsed) return; // not a pipeline-owned path (rules deny these anyway)
    if (obj.metadata && obj.metadata.cfProcessed === 'true') return; // our own write
    if (await alreadyProcessed(event.id)) return;

    const bucket = getStorage().bucket(obj.bucket); // the event's own bucket
    const file = bucket.file(obj.name);

    // (2) cap BEFORE the expensive download. The listing includes this object.
    const [files] = await bucket.getFiles({ prefix: 'uploads/' + parsed.uid + '/' });
    const totalBytes = files.reduce((s, f) => s + Number((f.metadata && f.metadata.size) || 0), 0);
    const dec = capDecision({
      fileCount: files.length, totalBytes,
      maxFiles: MAX_UPLOAD_FILES_PER_USER, maxBytes: MAX_UPLOAD_BYTES_PER_USER,
    });
    if (dec.over) { await file.delete({ ignoreNotFound: true }); return; }

    // (3) magic bytes vs declared contentType
    const [buf] = await file.download();
    const sniffed = sniffImageType(buf);
    if (!sniffed || !contentTypeMatches(sniffed, obj.contentType)) {
      await file.delete({ ignoreNotFound: true });
      return;
    }

    // (3b) PER-USER dedupe — Blake's "no 2 same images" anti-spam rule, scoped
    // per user (the same panel from two DIFFERENT users stays legal). Hash the
    // ORIGINAL bytes (the re-encode below isn't byte-stable; the raw upload is)
    // and consult the uploadHashes registry.
    const hash = sha256Hex(buf);
    const hashRef = db.doc('uploadHashes/' + hashDocId(parsed.uid, hash));
    const hashSnap = await hashRef.get();
    if (hashSnap.exists && hashSnap.data().path !== obj.name) {
      const [oldExists] = await bucket.file(hashSnap.data().path).exists();
      if (oldExists) {
        // the registered original is still live -> this upload is a DUPLICATE.
        await file.delete({ ignoreNotFound: true });
        return;
      }
      // SELF-HEAL: hash docs are never cascade-swept, so a stale doc (the user
      // deleted the original / a cascade swept it) must not permanently block a
      // legitimate re-upload — repoint the registry at the new object and go on.
      await hashRef.set({ path: obj.name, at: FieldValue.serverTimestamp() }, { merge: true });
    } else if (!hashSnap.exists) {
      // CLAIM the hash atomically — .create() fails if a RACING twin upload of
      // the same bytes registered first (the plain read-then-set raced: both
      // saw !exists, both published — adversarial review, LOW). The loser
      // deletes its own object, so "no 2 same images" holds even under a
      // deliberate simultaneous double upload.
      try {
        await hashRef.create({ uid: parsed.uid, hash, path: obj.name, at: FieldValue.serverTimestamp() });
      } catch (_conflict) {
        const again = await hashRef.get();
        const winnerPath = again.exists ? again.data().path : null;
        if (winnerPath && winnerPath !== obj.name) {
          const [winnerLive] = await bucket.file(winnerPath).exists();
          if (winnerLive) { await file.delete({ ignoreNotFound: true }); return; }
          await hashRef.set({ path: obj.name, at: FieldValue.serverTimestamp() }, { merge: true });
        }
      }
    }

    // (4) re-encode (animated gif/webp preserved; 30MP input ceiling guards
    // against decompression bombs — over it, sharp throws -> delete).
    let out;
    try {
      const s = sharp(buf, { animated: sniffed === 'gif' || sniffed === 'webp', limitInputPixels: 30e6 }).rotate();
      out = sniffed === 'jpeg' ? await s.jpeg({ quality: 88 }).toBuffer()
          : sniffed === 'png'  ? await s.png().toBuffer()
          : sniffed === 'webp' ? await s.webp().toBuffer()
          :                      await s.gif().toBuffer();
    } catch (_e) {
      await file.delete({ ignoreNotFound: true });
      return;
    }
    await file.save(out, {
      resumable: false,
      metadata: { contentType: obj.contentType, metadata: { cfProcessed: 'true' } },
    });
  }
);

// adminRemoveImage (callable, admin-only) — the gate-14 ATOMIC remove: Storage
// object first (the world-readable exposure), Firestore pointer second. Core in
// lib/images.js (cf-tests drive it directly, like the moderation cores).
exports.adminRemoveImage = onCall(async (request) => {
  try {
    return await images.applyAdminRemoveImage(
      db, uploadsBucket(), FieldValue,
      request.auth && request.auth.uid,
      request.data && request.data.docPath,
      request.data && request.data.imagePath
    );
  } catch (e) { throw new HttpsError(e.code || 'internal', e.message || 'adminRemoveImage failed'); }
});

// Removed-transition watchers (gate 14) — a SOFT-removed thread/post (owner
// self-delete, admin remove, or the ban cascade's redaction) takes its images
// out of Storage and drops the pointer field. Only the false->true edge acts;
// the hotScore CFs' frequent thread writes no-op here.
async function handleRemovedTransition(event, prefixOf) {
  const b = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const a = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!a || !b) return;                                  // creates/deletes handled elsewhere
  if (b.removed === true || a.removed !== true) return;  // not the removal edge
  if (await alreadyProcessed(event.id)) return;
  const uid = a.authorUid;
  if (!uid) return;
  await uploadsBucket().deleteFiles({ prefix: prefixOf(uid, event.params) }).catch(() => {});
  if (Array.isArray(a.imageRefs) && a.imageRefs.length) {
    await event.data.after.ref.update({ imageRefs: FieldValue.delete() }).catch(() => {});
  }
}
exports.onForumPostRemoved = onDocumentWritten('forum/{threadId}/posts/{postId}',
  (e) => handleRemovedTransition(e, (uid, p) => 'uploads/' + uid + '/' + p.postId + '/'));

// A thread soft-remove (the ONLY moderator/owner takedown — hard delete is
// rules-denied) must take down the WHOLE thread's images, not just the OP's:
// each reply's images live under uploads/{REPLIER_uid}/{postId}/ (pinned to the
// uploader, who is NOT the thread author), so the OP-prefix sweep alone leaves
// abusive reply images live + world-readable. (Adversarial review, MED.)
exports.onForumThreadRemoved = onDocumentWritten('forum/{threadId}', async (event) => {
  const b = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const a = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!a || !b) return;
  if (b.removed === true || a.removed !== true) return; // not the removal edge
  if (await alreadyProcessed(event.id)) return;
  const threadId = event.params.threadId;
  const tasks = [];
  // (1) the OP's own images + pointers (thumbImage too — a dangling thumb
  // would fire a doomed getDownloadURL on every list render)
  if (a.authorUid) tasks.push(uploadsBucket().deleteFiles({ prefix: 'uploads/' + a.authorUid + '/' + threadId + '/' }).catch(() => {}));
  const opUpd = {};
  if (Array.isArray(a.imageRefs) && a.imageRefs.length) opUpd.imageRefs = FieldValue.delete();
  if (a.thumbImage) opUpd.thumbImage = FieldValue.delete();
  if (Object.keys(opUpd).length) tasks.push(event.data.after.ref.update(opUpd).catch(() => {}));
  // (2) EVERY reply's images (each under its own uploader's prefix + the post id)
  const posts = await db.collection('forum/' + threadId + '/posts').get();
  posts.forEach((d) => {
    const p = d.data() || {};
    if (p.authorUid) tasks.push(uploadsBucket().deleteFiles({ prefix: 'uploads/' + p.authorUid + '/' + d.id + '/' }).catch(() => {}));
    if (Array.isArray(p.imageRefs) && p.imageRefs.length) tasks.push(d.ref.update({ imageRefs: FieldValue.delete() }).catch(() => {}));
  });
  await Promise.all(tasks);
});

// =============================================================================
// v1.10.0 GATE 18 — onDmMessageCreate (the Message-Blake admin floor DM ping).
// Admin-floor only by RULES (kind=='admin', Blake always a party); this CF is
// participant-agnostic — it reads the conversation's participants and pings
// whoever ISN'T the sender — so it serves peer DMs later unchanged.
// Two CF-owned writes (the rules deny both to clients):
//   (1) the recipient's notification (type 'dm' — the Lantern renders it purple
//       client-side), sender identity SERVER-sourced like the vote pings;
//   (2) an unread mirror on the conversation: unread_{recipientUid} increment +
//       lastMessageAt, FLAT keys (no dotted nested-map field paths), so the
//       client can badge the conversation without trusting client writes. The
//       mirror bumps even when the recipient muted 'dm' (a badge isn't a ping).
//       NO lastMessageText — content stays in the messages, never the metadata.
// =============================================================================
exports.onDmMessageCreate = onDocumentCreated(
  'conversations/{convId}/messages/{msgId}',
  async (event) => {
    if (await alreadyProcessed(event.id)) return;
    const msg = event.data && typeof event.data.data === 'function' ? event.data.data() : null;
    const senderUid = msg ? msg.senderUid : null;
    if (!senderUid) return;

    const convId = event.params.convId;
    const convRef = db.doc('conversations/' + convId);
    const convSnap = await convRef.get();
    if (!convSnap.exists) return; // message under a vanished conversation
    const participants = Array.isArray(convSnap.data().participants) ? convSnap.data().participants : [];
    if (!participants.includes(senderUid)) return; // defensive: sender must be a party
    const recipient = participants.find((u) => u !== senderUid);
    if (!recipient) return;

    // (2) CF-owned conversation summary — unconditional (mute silences the ping
    // below, not the badge). Flat 'unread_' + uid key; lastSenderUid lets the
    // client skip self-authored messages when computing the unread badge (no
    // raw lastMessageText — content stays in the messages). merge so nothing
    // else moves. The client treats this whole summary as untrusted telemetry.
    await convRef.set(
      { ['unread_' + recipient]: FieldValue.increment(1), lastMessageAt: FieldValue.serverTimestamp(), lastSenderUid: senderUid },
      { merge: true }
    ).catch(() => {}); // conversation may have been deleted mid-flight

    // mute-at-source: a muted 'dm' type writes NO notification doc at all.
    const prefsSnap = await db.doc('users/' + recipient + '/notifPrefs/prefs').get();
    if (prefsSnap.exists && isMuted(prefsSnap.data(), 'dm')) return;

    // (1) the Lantern ping — sender identity SERVER-sourced (NEVER the message's
    // own client fields), same notification shape as the vote pings. NOTE: today
    // every 'dm' is admin-floor, so fromUid is always Blake → the Lantern renders
    // it GOLD (notifIsBlake), which is heart-correct (a message FROM Blake is a
    // Blake surface). A future PEER 'dm' (fromUid != Blake) renders PURPLE.
    const ident = await senderIdentity(senderUid);
    await db.collection('users/' + recipient + '/notifications').add({
      toUid: recipient,
      fromUid: senderUid,
      fromDisplayName: ident.name,
      fromPhotoURL: ident.photo,
      type: 'dm',
      verb: 'sent you a message',
      targetPath: 'conversations/' + convId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + NOTIF_TTL_DAYS * DAY_MS),
    });
  }
);
