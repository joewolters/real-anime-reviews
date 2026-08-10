'use strict';

// =============================================================================
// PART A item 7 — SELF-SERVE ACCOUNT DELETION (the erasure core).
// <!-- author: Code | date: 2026-08-10 -->
// -----------------------------------------------------------------------------
// Blake's LOCKED content policy (2026-08-10): **tombstone the containers, erase
// the content.** A comment, reply, post or review keeps its slot so the thread
// it lives in still makes sense; the words, the pictures and the name are gone.
// Nothing they wrote survives, and nothing anyone ELSE wrote is touched.
//
// ⚠️ THIS REPLACES A CASCADE THAT DESTROYED THIRD PARTIES. The previous
// onUserDelete recursiveDelete'd the leaver's forum THREAD (index.js:439-440),
// which takes every other member's posts inside it; the same on their review
// (other members' reply threads) and on their comment (other members' replies).
// Innocent people lost their words because someone else left. It also
// contradicted the site's own shipped copy — the former-member tombstone says
// "what they shared lives where they posted it". Now it does.
//
// TWO PASSES, in this order:
//   1. TOMBSTONE — their authored docs are emptied in place and marked
//      `authorDeleted: true`. Reuses lib/moderation.js's redactAuthored (the H5
//      ban-cascade path) with a different flag, so there is ONE emptying
//      implementation, not two that can drift apart.
//   2. HARD DELETE — everything that is purely theirs and holds no one else's
//      words: votes, profile likes, their whole users/ subtree, their public
//      profile, their consent records, their rate-limit state, and every object
//      under their Storage prefixes.
// DMs are LOCKED, never deleted — a two-party thread is half someone else's
// (the pre-existing policy, kept deliberately).
//
// Idempotent throughout: re-emptying empty content and re-deleting gone docs are
// both no-ops, so a redelivered trigger or a retried call is harmless.
// =============================================================================

const { redactAuthored, ADMIN_UID, CASCADE_PAGE } = require('./moderation');

// The name a departed member's remaining slots carry. Their real name is not
// theirs to leave behind on the site once they've asked to be gone.
const DELETED_NAME = '[deleted]';

// How recently the caller must have proved they are who they say. Deleting an
// account is the one irreversible thing a member can do to themselves, so an
// unattended laptop must not be enough to do it.
const REAUTH_MAX_AGE_MS = 5 * 60 * 1000;

function coded(code, message) { const e = new Error(message); e.code = code; return e; }

// The tombstone field maps, per surface. redactionFor only writes keys the doc
// ACTUALLY has, so each map is deliberately a superset — it documents every
// field that could carry the member on that surface, and silently skips the
// ones that don't apply (forum threads carry no displayName; the identity there
// is resolved from the profile doc, which is hard-deleted below).
function tombstoneMaps(FieldValue) {
  const del = FieldValue.delete();
  const identity = { displayName: DELETED_NAME, photoURL: null };
  const pictures = { imageRefs: del, thumbImage: del };
  return {
    // comments AND community reviews both live under an `items` subcollection
    items:   Object.assign({ title: '', body: '', text: '' }, identity, pictures),
    forum:   Object.assign({ title: '', body: '' }, identity, pictures),
    posts:   Object.assign({ body: '' }, identity, { imageRefs: del, thumbImage: del }),
    threads: Object.assign({ text: '' }, identity),   // review reply threads
    replies: Object.assign({ text: '' }, identity, { imageRefs: del }),
  };
}

// tombstoneAuthored — pass 1. Returns how many slots were tombstoned.
// Dropping imageRefs also trips the existing edit-strip sweepers
// (onCommentEdited / onReviewEdited / the forum written-triggers), so the
// pictures leave Storage by that path too — belt and braces with the prefix
// wipe below, because "erase the content" has to be true of the bucket as well.
async function tombstoneAuthored(db, FieldValue, uid) {
  const maps = tombstoneMaps(FieldValue);
  const flag = { authorDeleted: true };
  let n = 0;
  n += await redactAuthored(db, db.collectionGroup('items').where('uid', '==', uid), maps.items, flag);
  n += await redactAuthored(db, db.collection('forum').where('authorUid', '==', uid), maps.forum, flag);
  n += await redactAuthored(db, db.collectionGroup('posts').where('authorUid', '==', uid), maps.posts, flag);
  n += await redactAuthored(db, db.collectionGroup('threads').where('uid', '==', uid), maps.threads, flag);
  n += await redactAuthored(db, db.collectionGroup('replies').where('uid', '==', uid), maps.replies, flag);
  return n;
}

// deleteAll — batched hard deletes (the redactAuthored page size, same reason).
async function deleteAll(db, snap) {
  for (let i = 0; i < snap.docs.length; i += CASCADE_PAGE) {
    const batch = db.batch();
    snap.docs.slice(i, i + CASCADE_PAGE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

// runAccountErasure — the WHOLE erasure, called by BOTH entry points (the
// deleteMyAccount callable and the users/{uid} delete trigger) so there is one
// definition of what leaving means.
//
// `bucket` may be null — the Firestore half must still run if Storage is
// unreachable (data first; the daily orphan reaper is the backstop for objects).
async function runAccountErasure(db, FieldValue, bucket, uid) {
  if (!uid) throw coded('invalid-argument', 'A uid is required.');
  // DEFENCE IN DEPTH: the admin refusal lives in deleteAccountGuard, but this
  // function has a SECOND entry point — the users/{uid} delete trigger — which
  // no guard protects. Deleting the admin's users doc with the Admin SDK (a
  // console slip, a future admin tool) would otherwise erase the Creator's
  // whole account: his reviews, his profile, his identity. The rules' one
  // authority signal is a literal UID, so it cannot be handed back.
  if (uid === ADMIN_UID) {
    return { tombstoned: 0, votes: 0, likes: 0, conversations: 0, refused: 'admin' };
  }

  // ---- pass 1: tombstone the containers, erase the content -----------------
  const tombstoned = await tombstoneAuthored(db, FieldValue, uid);

  // ---- pass 2: hard-delete what is only ever theirs -------------------------
  // Votes and profile likes are not content — they are a number's worth of
  // opinion, and leaving them behind would inflate counts on other people's
  // work forever. Each like delete trips onProfileLike, so likesCount on the
  // profiles they appreciated stays exact as they go.
  const [votes, likes] = await Promise.all([
    db.collectionGroup('votes').where('uid', '==', uid).get(),
    db.collectionGroup('likes').where('uid', '==', uid).get(),
  ]);
  await deleteAll(db, votes);
  await deleteAll(db, likes);

  const tasks = [
    // their whole private subtree — favorites, watchlist, collections,
    // savedShelves, notifications, notifPrefs, notifMeta — plus the doc itself
    db.recursiveDelete(db.doc('users/' + uid)),
    // the public profile (recursive: its `likes` subcollection must not orphan).
    // Deleting it also trips onProfileWritten, so the background image leaves
    // Storage with it.
    db.recursiveDelete(db.doc('profiles/' + uid)),
    // their own consent + gate records. `banned/{uid}` is deliberately KEPT:
    // like the reports that point at them, it is a moderation record about a
    // decision the site made, not a piece of the member's personal data.
    db.doc('moderationGate/' + uid).delete(),
    db.doc('rulesConsent/' + uid).delete(),
    // rate-limit scratch state (both buckets — forum cadence and DM cadence)
    db.doc('rateState/' + uid).delete(),
    db.doc('rateState/' + uid + '__dm').delete(),
  ];

  if (bucket) {
    // every image they ever uploaded, plus their avatars, plus the profile
    // background prefix (which lives under uploads/{uid}/profilebg/).
    tasks.push(bucket.deleteFiles({ prefix: 'uploads/' + uid + '/' }).catch(() => {}));
    tasks.push(bucket.deleteFiles({ prefix: 'avatars/' + uid + '/' }).catch(() => {}));
  }

  // ---- DMs: lock, never nuke ----------------------------------------------
  // A conversation is half the other person's. Locking closes it to new
  // messages without reaching into someone else's inbox and deleting their
  // side of it (the pre-existing policy — kept on purpose).
  const convos = await db.collection('conversations').where('participants', 'array-contains', uid).get();
  convos.forEach((d) => tasks.push(d.ref.set({ state: 'locked', closedByDeletion: true }, { merge: true })));

  await Promise.all(tasks);
  return { tombstoned, votes: votes.size, likes: likes.size, conversations: convos.size };
}

// reauthOk — PURE. `auth_time` is seconds-since-epoch in the Firebase ID token
// and is the moment the user last actually PROVED who they are (not when the
// token was minted — a refresh does not move it). A missing or malformed
// auth_time is treated as NOT recent: fail closed on the irreversible action.
function reauthOk(token, nowMs, maxAgeMs) {
  const t = token && token.auth_time;
  if (typeof t !== 'number' || !Number.isFinite(t)) return false;
  const ageMs = nowMs - t * 1000;
  // A future auth_time (clock skew) is not evidence of anything — refuse it.
  if (ageMs < 0) return false;
  return ageMs <= (typeof maxAgeMs === 'number' ? maxAgeMs : REAUTH_MAX_AGE_MS);
}

// deleteAccountGuard — PURE. Every reason to refuse, in one testable place.
function deleteAccountGuard(uid, token, nowMs) {
  if (!uid) throw coded('unauthenticated', 'Sign in to delete your account.');
  // The admin account is the site. Losing it would take the catalog admin, the
  // moderation tools and the rules' one authority signal with it.
  if (uid === ADMIN_UID) throw coded('failed-precondition', 'The Creator account cannot be deleted here.');
  if (!reauthOk(token, nowMs, REAUTH_MAX_AGE_MS)) {
    throw coded('failed-precondition', 'Sign in again to confirm this — for your safety, deleting an account needs a fresh sign-in.');
  }
  return true;
}

// applyDeleteMyAccount — the callable's whole body. deleteAuthUser is injected
// (index.js passes admin.auth().deleteUser) so cf-tests can drive the Firestore
// half without the Auth emulator.
//
// ORDER: erase, THEN remove the sign-in. If the erasure fails the member still
// has their account and can try again; if the Auth delete failed after a clean
// erasure they'd have an empty shell, which is recoverable — the other order
// locks them out of their own unfinished deletion.
async function applyDeleteMyAccount(db, FieldValue, bucket, deleteAuthUser, uid, token, nowMs) {
  deleteAccountGuard(uid, token, nowMs);
  const result = await runAccountErasure(db, FieldValue, bucket, uid);
  let authDeleted = false;
  if (deleteAuthUser) {
    // Without this they could sign straight back in on the same uid and the
    // signup trigger would mint them a fresh profile — a "deleted" account that
    // reappears. It is not optional; a failure here is reported, not swallowed.
    await deleteAuthUser(uid);
    authDeleted = true;
  }
  return Object.assign({ ok: true, authDeleted }, result);
}

module.exports = {
  DELETED_NAME, REAUTH_MAX_AGE_MS,
  tombstoneMaps, tombstoneAuthored, runAccountErasure,
  reauthOk, deleteAccountGuard, applyDeleteMyAccount,
};
