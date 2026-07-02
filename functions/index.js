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
const { onDocumentWritten, onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/firestore');
const { onObjectFinalized } = require('firebase-functions/storage'); // v1.10.0 gate 13 — image pipeline
const { onSchedule } = require('firebase-functions/scheduler');      // gate 20 — the daily orphan reaper
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
const { likeDelta, shouldNotifyLike, likeNotifId, bgSweepDecision } = require('./lib/profile'); // dream profile
const { stripSweepDecision, reapUploadsOrphans } = require('./lib/sweep'); // gate 20 — edit-strip + orphan reaper
const migrate = require('./lib/migrate'); // gate 20.5 — the gold-flip's MIGRATION half

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

  // FOREIGN profile likes (dream profile) — the user's like docs under OTHER
  // people's profiles (same shape as the votes sweep; like docs carry
  // uid == liker). Each delete fires onProfileLike, which decrements that
  // profile's likesCount — counts stay exact as the fan departs.
  const foreignLikes = await db.collectionGroup('likes').where('uid', '==', uid).get();
  foreignLikes.forEach((d) => tasks.push(d.ref.delete()));

  // the user's own subtree (favorites/watchlist/notifications/notifPrefs/notifMeta)
  // + public profile. The profile recursiveDeletes (its likes subcollection
  // must not orphan), and the doc's deletion trips onProfileWritten -> the bg
  // object leaves Storage with it.
  tasks.push(db.recursiveDelete(db.doc('users/' + uid)));
  tasks.push(db.recursiveDelete(db.doc('profiles/' + uid)));

  // gate 14 — EVERY image they ever uploaded leaves Storage ("ZERO trace" now
  // spans the bucket, not just Firestore). Avatars live under their own top-
  // level prefix (NOT uploads/) — sweep it too or it orphans on account wipe.
  tasks.push(uploadsBucket().deleteFiles({ prefix: 'uploads/' + uid + '/' }).catch(() => {}));
  tasks.push(uploadsBucket().deleteFiles({ prefix: 'avatars/' + uid + '/' }).catch(() => {}));

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
  await enforceRateLimitForUid(event, data ? data[authorField] : null);
}
// gate A1 — split out so a caller can DERIVE the key uid (conversation creates
// key to the creator, which admin-floor docs don't carry as a field).
// opts.bucket gives a surface its OWN rateState doc + threshold: chat cadence
// is not forum cadence — DM messages ride `rateState/<uid>__dm` at DM_RATE_LIMIT
// so real conversation never trips the forum brake (which stays 5/60s).
async function enforceRateLimitForUid(event, uid, opts) {
  if (!uid) return;
  const bucket = opts && opts.bucket ? '__' + opts.bucket : '';
  const limit = (opts && opts.limit) || RATE_LIMIT;
  const stateRef = db.doc('rateState/' + uid + bucket);
  const over = await db.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef);
    const prevFlagged = snap.exists && snap.data().flagged === true;
    const { overLimit, nextState } = rateDecision(snap.exists ? snap.data() : null, Date.now(), RATE_WINDOW_MS, limit);
    tx.set(stateRef, Object.assign({}, nextState, { flagged: overLimit || prevFlagged }));
    return overLimit;
  });
  if (over) await event.data.ref.delete().catch(() => {}); // detect-and-undo
}

exports.rateLimitForumThread = onDocumentCreated('forum/{threadId}', (e) => enforceRateLimit(e, 'authorUid'));
exports.rateLimitComment = onDocumentCreated('comments/{anime}/items/{cid}', (e) => enforceRateLimit(e, 'uid'));

// gate A1 — the SAME detect-and-undo limiter, now watching the DM lane:
//   • rateLimitDmMessage — every DM/group message, keyed to its senderUid, in
//     its OWN bucket (`rateState/<uid>__dm`) at chat cadence: a real
//     back-and-forth easily beats 5 msgs/min, so the DM brake sits at
//     DM_RATE_LIMIT (20/60s) — flood-stopping, conversation-safe — and never
//     shares state with the forum/comment bucket.
const DM_RATE_LIMIT = 20;
exports.rateLimitDmMessage = onDocumentCreated('conversations/{convId}/messages/{msgId}', async (e) => {
  const data = e.data && typeof e.data.data === 'function' ? e.data.data() : null;
  await enforceRateLimitForUid(e, data ? data.senderUid : null, { bucket: 'dm', limit: DM_RATE_LIMIT });
});
//   • rateLimitConversationCreate — every conversation birth, keyed to the
//     CREATOR. CHOICE (stated per the gate-A1 contract): rate-limit ALL
//     conversation creates, including Blake's admin floor — Blake creating 6
//     conversations/minute is unrealistic, and a kind-based exemption would be
//     a costume a hostile client could try on. peer/group docs pin creatorUid
//     at create; admin-floor docs don't carry one, so those key to the
//     non-admin party (the member who opened the floor).
exports.rateLimitConversationCreate = onDocumentCreated('conversations/{convId}', async (e) => {
  const data = e.data && typeof e.data.data === 'function' ? e.data.data() : null;
  if (!data) return;
  const uid = data.creatorUid
    || (Array.isArray(data.participants) ? data.participants.find((u) => u !== moderation.ADMIN_UID) : null);
  await enforceRateLimitForUid(e, uid);
});

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

// -----------------------------------------------------------------------------
// onSuggestionReviewed — gate 20, the GOLD-FLIP (half 1: the ping). When Blake
// marks a suggestion 'reviewed' in the admin queue, the requester gets a
// Blake-origin Lantern letter ("you asked for this one"). fromUid is the ADMIN
// literal, so the Lantern's notifIsBlake gilds it — HIS review landing IS a
// Blake surface. Also mirrors status onto the suggestionCounts rollup so the
// public "👁 N requested" chip retires itself for reviewed titles.
// (Half 2 — migrating an anime:al:<id> Tavern thread onto the new catalog slug
// so it GAINS the gold verdict rail — is the migrateRequestThread callable
// directly below; gate 20.5.)
// -----------------------------------------------------------------------------
exports.onSuggestionReviewed = onDocumentUpdated('suggestions/{docId}', async (event) => {
  if (await alreadyProcessed(event.id)) return;
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!before || !after) return;
  if (before.status === 'reviewed' || after.status !== 'reviewed') return;   // only the flip TO reviewed

  // mirror onto the rollup so the public chip stops advertising a filled
  // request. UPDATE, not set-merge — a blind merge would resurrect a deleted/
  // never-created rollup as a {status} ghost doc (adversarial LOW); update()
  // fails on a missing doc, which is exactly the no-op we want.
  if (after.anilistId) {
    try {
      await db.doc('suggestionCounts/' + after.anilistId).update({ status: 'reviewed' });
    } catch (_) { /* rollup absent (raw-title submission / deleted) — no ghost */ }
  }

  const to = after.submitterUid;
  if (!to || typeof to !== 'string') return;          // legacy/anon suggestion — no inbox
  if (to === 'G2jGRa14u8bzGAmeBTkvXy8PKmr1') return;  // ADMIN_UID — no self-ping
  const prefsSnap = await db.doc('users/' + to + '/notifPrefs/prefs').get();
  if (prefsSnap.exists && isMuted(prefsSnap.data(), 'request_done')) return;  // mute-at-source
  const title = String(after.englishTitle || after.title || 'your request').slice(0, 120);
  await db.collection('users/' + to + '/notifications').add({
    fromUid: 'G2jGRa14u8bzGAmeBTkvXy8PKmr1',          // ADMIN_UID (status-quo literal, as in lib/moderation.js)
    fromDisplayName: 'Blake',
    fromPhotoURL: null,
    type: 'request_done',
    verb: 'reviewed it — you asked for this one',
    animeTitle: title,
    anilistId: after.anilistId || null,
    targetPath: after.anilistId ? ('secondary/' + after.anilistId) : null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + NOTIF_TTL_DAYS * DAY_MS),
  });
});

// -----------------------------------------------------------------------------
// migrateRequestThread (callable, admin-only) — gate 20.5, the GOLD-FLIP's
// MIGRATION half (half 2 of onSuggestionReviewed above). When Blake reviews a
// requested anime, the admin suggestions page calls this to retag that title's
// 'anime:al:<anilistId>' Tavern threads to 'anime:<slug>' — the threads GAIN
// the gold verdict rail. WHY A CALLABLE, NOT A TRIGGER: the slug truth lives
// only in animeData.js (client-side catalog) and AniList titles ≠ Blake's
// Excel titles, so a CF can't derive the slug from the suggestion doc — the
// admin picks the catalog title and the page passes the slug in. Core in
// lib/migrate.js (cf-tests drive it directly, like the moderation cores).
// -----------------------------------------------------------------------------
exports.migrateRequestThread = onCall(async (request) => {
  try {
    return await migrate.applyMigrateRequestThread(
      db,
      request.auth && request.auth.uid,
      request.data && request.data.anilistId,
      request.data && request.data.slug
    );
  } catch (e) { throw new HttpsError(e.code || 'internal', e.message || 'migrateRequestThread failed'); }
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
  // above empties their docs; this empties their bucket prefixes). avatars/
  // is its own top-level prefix (NOT under uploads/) — a banned account's
  // face must not stay world-readable either.
  await Promise.all([
    uploadsBucket().deleteFiles({ prefix: 'uploads/' + event.params.uid + '/' }).catch(() => {}),
    uploadsBucket().deleteFiles({ prefix: 'avatars/' + event.params.uid + '/' }).catch(() => {}),
  ]);
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
    // round-4 adversarial MED: profile BACKGROUNDS are exempt — a background is
    // one-per-user (duplicate-spam is meaningless there), and re-picking the
    // SAME file (GIFs skip the cropper, so bytes match exactly) uploaded to a
    // fresh path while bgRef still pointed at the old object: dedupe deleted
    // the NEW object, the bgRef write then dangled at a deleted path forever.
    if (parsed.docId !== 'profilebg') {
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
exports.onForumPostRemoved = onDocumentWritten('forum/{threadId}/posts/{postId}', async (e) => {
  // gate 20 — the imageRefs EDIT-strip rides this SAME written trigger (a
  // second registration on this path would double-fire every post event).
  await sweepStrippedRefs(e, 'authorUid');
  await handleRemovedTransition(e, (uid, p) => 'uploads/' + uid + '/' + p.postId + '/');
});

// A thread soft-remove (the ONLY moderator/owner takedown — hard delete is
// rules-denied) must take down the WHOLE thread's images, not just the OP's:
// each reply's images live under uploads/{REPLIER_uid}/{postId}/ (pinned to the
// uploader, who is NOT the thread author), so the OP-prefix sweep alone leaves
// abusive reply images live + world-readable. (Adversarial review, MED.)
exports.onForumThreadRemoved = onDocumentWritten('forum/{threadId}', async (event) => {
  // gate 20 — the imageRefs EDIT-strip rides this SAME written trigger (never
  // double-register a path). It no-ops on create/delete edges and on the
  // count/hotScore merges that hit this doc constantly.
  await sweepStrippedRefs(event, 'authorUid');
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
// v1.10.0 GATE 18 (+ MEGA-RUN gate A1) — the DM CF pair.
//
// onConversationCreate (gate A1) — the 'dm_request' ping. A kind=='peer'
// conversation is born state=='request' by rules; the RECIPIENT (the
// non-creator participant) gets ONE dm_request notification with SERVER-
// sourced sender identity. DELIBERATELY UNMUTABLE — no mute check of any kind:
// the request ping IS the safety signal (the recipient must learn someone
// wants in so they can accept, decline, or block; an invisible pending request
// would be worse than the ping). Message spam into a pending request is
// already silenced by the request-state guard in onDmMessageCreate below.
//   • kind=='group': member ADDS are conversation UPDATES — notifying added
//     members is an update-trigger, OUT of gate A1 (noted for a later gate).
//   • kind=='admin': the floor has no request phase — nothing to do.
// =============================================================================
exports.onConversationCreate = onDocumentCreated('conversations/{convId}', async (event) => {
  const conv = event.data && typeof event.data.data === 'function' ? event.data.data() : null;
  if (!conv || conv.kind !== 'peer') return;
  if (await alreadyProcessed(event.id)) return;
  const creator = conv.creatorUid;
  const participants = Array.isArray(conv.participants) ? conv.participants : [];
  const recipient = participants.find((u) => u !== creator);
  if (!creator || !recipient) return;
  const ident = await senderIdentity(creator);
  // gate A5 (adversarial HIGH) — DETERMINISTIC ping id per SENDER. The old
  // .add() minted a fresh dm_request per peer-conv create; a hostile client
  // scripting convs (or re-requesting after a decline) flooded the recipient's
  // Lantern with unmutable pings. A `dmreq_<creator>` doc-id collapses every
  // request from one sender into ONE re-lit row (the profile_like pl_<liker>
  // pattern) — request VOLUME is bounded by rateLimitConversationCreate, ping
  // COUNT is now bounded to one-per-sender. targetPath points at the NEWEST
  // request conv so the row still opens the live letter.
  await db.doc('users/' + recipient + '/notifications/dmreq_' + creator).set({
    toUid: recipient,
    fromUid: creator,
    fromDisplayName: ident.name,   // server-sourced — a forged client name never reaches here
    fromPhotoURL: ident.photo,
    type: 'dm_request',
    verb: 'sent you a message request',
    targetPath: 'conversations/' + event.params.convId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + NOTIF_TTL_DAYS * DAY_MS),
  });
});

// =============================================================================
// onConversationUpdate (gate A3) — the group-ADD ping. The rules pin adds to
// exactly-one-appended-last by the CREATOR, so the added member is the array
// tail and the sender identity is creatorUid (update triggers carry no auth).
// Type rides 'dm' with a custom verb — muting Messages mutes group-adds too
// (coherent; the unmutable safety ping stays dm_request only). Self-removal
// (leaves) and creator-removals ping nobody — departures are quiet.
// =============================================================================
exports.onConversationUpdate = onDocumentUpdated('conversations/{convId}', async (event) => {
  const before = event.data && event.data.before ? event.data.before.data() : null;
  const after = event.data && event.data.after ? event.data.after.data() : null;
  if (!before || !after || after.kind !== 'group') return;
  const bp = Array.isArray(before.participants) ? before.participants : [];
  const ap = Array.isArray(after.participants) ? after.participants : [];
  if (ap.length !== bp.length + 1) return;                    // adds only
  const added = ap[ap.length - 1];
  if (!added || added === after.creatorUid || bp.indexOf(added) !== -1) return;
  if (await alreadyProcessed(event.id)) return;
  // mute-at-source: the added member may have muted 'dm' entirely
  try {
    const prefsSnap = await db.doc('users/' + added + '/notifPrefs/prefs').get();
    if (prefsSnap.exists && isMuted(prefsSnap.data(), 'dm')) return;
  } catch (_) {}
  const ident = await senderIdentity(after.creatorUid);
  await db.collection('users/' + added + '/notifications').add({
    toUid: added,
    fromUid: after.creatorUid,
    fromDisplayName: ident.name,
    fromPhotoURL: ident.photo,
    type: 'dm',
    verb: 'added you to "' + String(after.name || 'a group').slice(0, 60) + '"',
    targetPath: 'conversations/' + event.params.convId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + NOTIF_TTL_DAYS * DAY_MS),
  });
});

// =============================================================================
// onDmMessageCreate — the message ping. Participant-agnostic: reads the
// conversation and serves admin-floor, peer, AND group (gate A1) unchanged in
// shape. Two CF-owned writes (the rules deny both to clients):
//   (1) each recipient's notification (type 'dm' — the Lantern renders it
//       purple client-side; a Blake-sent one gilds by identity), sender
//       identity SERVER-sourced like the vote pings;
//   (2) an unread mirror on the conversation: unread_{recipientUid} increment
//       + lastMessageAt, FLAT keys (no dotted nested-map field paths), so the
//       client can badge the conversation without trusting client writes. The
//       mirror bumps even when the recipient muted 'dm' (a badge isn't a ping).
//       NO lastMessageText — content stays in the messages, never the metadata.
// Gate A1 guards:
//   (a) peer + state=='request' -> NO ping, NO unread: the dm_request ping
//       (above) already covers the pending request; nudge-spam into an
//       unaccepted request must put zero pressure on the recipient.
//   (b) per-CONVERSATION mute — notifPrefs muted['conv:<convId>'] silences
//       THIS thread's pings (the per-TYPE 'dm' mute stays too). Both silence
//       only the ping, never the unread badge.
//   Groups fan out to EVERY non-sender participant (the pre-A1 single-
//   recipient pick would silently drop all but one member of a group).
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
    const conv = convSnap.data();
    const participants = Array.isArray(conv.participants) ? conv.participants : [];
    if (!participants.includes(senderUid)) return; // defensive: sender must be a party

    // gate A1 guard (a): a message into a PENDING peer request is silent.
    if (conv.kind === 'peer' && conv.state === 'request') return;

    const recipients = participants.filter((u) => u !== senderUid);
    if (!recipients.length) return;

    // (2) CF-owned conversation summary — unconditional (mutes silence the
    // pings below, not the badge). One merge write, an unread_ bump per
    // recipient; lastSenderUid lets the client skip self-authored messages
    // when computing the unread badge. The client treats this whole summary
    // as untrusted telemetry.
    const summary = { lastMessageAt: FieldValue.serverTimestamp(), lastSenderUid: senderUid };
    recipients.forEach((r) => { summary['unread_' + r] = FieldValue.increment(1); });
    await convRef.set(summary, { merge: true }).catch(() => {}); // conversation may have been deleted mid-flight

    // (1) the Lantern pings — sender identity SERVER-sourced ONCE (never the
    // message's own client fields), then per-recipient mute checks:
    // per-TYPE ('dm') and per-CONVERSATION ('conv:<convId>', gate A1 guard b).
    const ident = await senderIdentity(senderUid);
    for (const recipient of recipients) {
      const prefsSnap = await db.doc('users/' + recipient + '/notifPrefs/prefs').get();
      const prefs = prefsSnap.exists ? prefsSnap.data() : null;
      if (isMuted(prefs, 'dm') || isMuted(prefs, 'conv:' + convId)) continue;
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
  }
);

// =============================================================================
// v1.10.0 — DREAM PROFILE CFs (profile likes + the background edit-strip sweep).
// STAGED — deploys with the rest of v1.10.0. The rules own the write shape
// (profiles/{uid}/likes/{likerUid} = { uid, value: 1, updatedAt }, LIKE-ONLY,
// self-like denied, unlike = delete); these CFs own what rules can't: the
// exact profiles/{uid}.likesCount, the owner's ping, and the orphaned-Storage-
// object class for backgrounds. Decision cores in lib/profile.js (pure units).
// =============================================================================

// onProfileLike — fires on a like doc create/delete under a profile. (1) keeps
// profiles/{uid}.likesCount exact via atomic increment (CF-owned — clients
// can't write it); (2) on a fresh CREATE only, pings the profile owner with
// server-sourced identity, honoring the owner's mute. The notification id is
// DETERMINISTIC (likeNotifId: 'pl_' + liker) so an unlike/re-like toggle
// OVERWRITES one doc instead of stacking pings. Unlike never pings.
exports.onProfileLike = onDocumentWritten(
  'profiles/{uid}/likes/{likerUid}',
  async (event) => {
    if (await alreadyProcessed(event.id)) return;
    const uid = event.params.uid;
    const likerUid = event.params.likerUid;
    // dream-profile HEART (adversarial MED, defense in depth): never let the
    // carve-out count touch Blake's own profile — the rules already deny it,
    // this guards the count+ping even if a like doc lands by some other path.
    if (uid === 'G2jGRa14u8bzGAmeBTkvXy8PKmr1') return;   // ADMIN_UID (status-quo literal, as in lib/moderation.js)
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;

    // (1) exact count. On a CREATE (delta > 0) use set+merge so a like on a
    // member who has no profiles doc yet (legacy users/-only identity) still
    // MATERIALIZES the count instead of silently no-op'ing an update() against a
    // missing doc (adversarial LOW: undercount/negative-drift). On a DELETE
    // (delta < 0) use update() — an unlike racing the profile's deletion
    // (onUserDelete fans out unlikes via the foreign-likes sweep) must NOT
    // resurrect a ghost profiles doc holding only a count.
    const delta = likeDelta(before, after);
    if (delta > 0) {
      await db.doc('profiles/' + uid).set({ likesCount: FieldValue.increment(delta) }, { merge: true }).catch(() => {});
    } else if (delta < 0) {
      await db.doc('profiles/' + uid).update({ likesCount: FieldValue.increment(delta) }).catch(() => {});
    }

    // (2) ping — CREATE only, never self (rules already deny a self-like;
    // defense in depth here because this runs with rules bypassed).
    if (!shouldNotifyLike(before, after, uid, likerUid)) return;

    // mute-at-source: don't even write the doc if the owner muted this type
    const prefsSnap = await db.doc('users/' + uid + '/notifPrefs/prefs').get();
    if (prefsSnap.exists && isMuted(prefsSnap.data(), 'profile_like')) return;

    const ident = await senderIdentity(likerUid);
    // adversarial MED (relight spam): use create(), NOT set(). The deterministic
    // pl_<liker> id stops STACKING; create-if-absent also stops RE-LIGHTING — an
    // unlike→re-like loop can no longer flip an already-read ping back to unread
    // with a fresh timestamp (the doc already exists → create throws → caught).
    // One appreciation ping per liker, ever; the count still moves each toggle.
    await db.doc('users/' + uid + '/notifications/' + likeNotifId(likerUid)).create({
      toUid: uid,
      fromUid: likerUid,
      fromDisplayName: ident.name,   // server-sourced — a forged client name never reaches here
      fromPhotoURL: ident.photo,
      type: 'profile_like',
      value: 1,
      verb: 'liked your profile',
      targetPath: 'profiles/' + uid,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + NOTIF_TTL_DAYS * DAY_MS),
    }).catch(() => {});   // already pinged this liker — do not re-light
  }
);

// onProfileWritten — the background EDIT-STRIP sweeper. When a profile's bgRef
// changes (new background), is removed, or the doc itself is deleted, the OLD
// object must leave Storage — redacting only the pointer leaves the image
// world-readable (the gate-14 legal trap, now on the edit path no delete
// cascade sees). bgSweepDecision's unchanged-bgRef no-op is the FIRST early
// return — load-bearing, because this CF fires on every likesCount increment
// onProfileLike writes — and it refuses any ref outside the owner's own
// uploads/{uid}/profilebg/ prefix. No cfProcessed marker: an object delete is
// naturally idempotent (mirrors the onDocumentDeleted sweeps).
exports.onProfileWritten = onDocumentWritten('profiles/{uid}', async (event) => {
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const dec = bgSweepDecision(before, after, event.params.uid);
  if (!dec.sweep) return; // unchanged / no bg / foreign-prefix ref — touch nothing
  await uploadsBucket().file(dec.path).delete({ ignoreNotFound: true }).catch(() => {});
});

// =============================================================================
// v1.10.0 GATE 20 — STORAGE GC (STAGED, deploys at the cutover): the imageRefs
// EDIT-STRIP sweepers + the daily ORPHAN REAPER. Gate 14 swept the DELETE and
// REMOVE paths; these close the last two world-readable-forever holes (the one
// pre-prod gap, NEXT.md — the legal-trap class): (a) an owner EDIT dropping a
// ref from imageRefs, (b) an upload whose doc-create never landed (tab closed
// mid-flow). Decision cores in lib/sweep.js (pure / db-injected — testable
// without the scheduler). No cfProcessed markers: an object delete is
// naturally idempotent (the onProfileWritten precedent).
// =============================================================================

// sweepStrippedRefs — wire stripSweepDecision to an updated/written event and
// delete EXACTLY the dropped objects. Owner sourced from BEFORE (the side that
// held the refs; the author field is immutable per rules either way). The
// forum thread/post surfaces call this from their existing written-triggers
// above — comments / replies / reviews get their own onDocumentUpdated below.
function sweepStrippedRefs(event, ownerField) {
  const b = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const a = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const dec = stripSweepDecision(b, a, b ? b[ownerField] : null);
  if (!dec.sweep) return Promise.resolve();
  return Promise.all(dec.paths.map((p) => uploadsBucket().file(p).delete({ ignoreNotFound: true }).catch(() => {})));
}

// Comments / replies / reviews have no written-trigger to ride (their existing
// triggers are create/delete — DIFFERENT event types, so these don't double-
// fire anything). Review reply-threads carry NO imageRefs (the rules give them
// no slot) — no trigger needed there.
exports.onCommentEdited = onDocumentUpdated('comments/{anime}/items/{cid}',
  (e) => sweepStrippedRefs(e, 'uid'));
exports.onCommentReplyEdited = onDocumentUpdated('comments/{anime}/items/{cid}/replies/{rid}',
  (e) => sweepStrippedRefs(e, 'uid'));
exports.onReviewEdited = onDocumentUpdated('reviews/{anime}/items/{uid}',
  (e) => sweepStrippedRefs(e, 'uid'));

// reapOrphanUploads — the daily pass over uploads/ for objects older than 24h
// with NO referencing doc (imageRefs/thumbImage across the five surfaces, or
// profiles bgRef for profilebg). All judgment lives in lib/sweep.js and is
// conservative by construction: unparsed path, young object, or a FAILED doc
// lookup all KEEP the object; one run deletes at most ORPHAN_DELETE_CAP.
exports.reapOrphanUploads = onSchedule(
  // gate-20 adversarial LOW: the default 60s/256MiB can't finish a pass once
  // the bucket is populated (full list + per-user reference queries) — give
  // the daily sweep room; the 500-delete cap still bounds cost per run.
  { schedule: 'every 24 hours', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    await reapUploadsOrphans(db, uploadsBucket(), { nowMs: Date.now() });
  }
);
