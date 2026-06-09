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
const admin = require('firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

const { pingPayload } = require('./lib/ping');
const { voteCountDeltas } = require('./lib/votecounts');
const { shouldNotify, isMuted } = require('./lib/notify');
const { notifsToPrune } = require('./lib/prune');
const { rateDecision } = require('./lib/ratelimit');
const moderation = require('./lib/moderation'); // v1.10.0 gate 2 — ban + consent cores

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

// onReviewDelete — a community review's reply `threads` + all `votes` are
// orphaned when the review is deleted (Firestore doesn't cascade — this orphan
// exists in production TODAY). recursiveDelete cleans the subtree.
exports.onReviewDelete = onDocumentDeleted(
  'reviews/{anime}/items/{uid}',
  (event) => db.recursiveDelete(db.doc('reviews/' + event.params.anime + '/items/' + event.params.uid))
);

// onForumThreadDelete — a hard-deleted hub thread's `posts` (+ their votes) are
// orphaned. Threads are normally SOFT-deleted; this fires on a real hard delete
// (e.g. from onUserDelete). recursiveDelete cleans the subtree.
exports.onForumThreadDelete = onDocumentDeleted(
  'forum/{threadId}',
  (event) => db.recursiveDelete(db.doc('forum/' + event.params.threadId))
);

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
});
