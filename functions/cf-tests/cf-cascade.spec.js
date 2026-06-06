'use strict';

// =============================================================================
// GATE 3 CF integration tests — cascade deletes, onUserDelete, rate-limit,
// suggestionCounts — against the functions+firestore emulators. Run via test:cf.
// =============================================================================

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

const PROJECT = 'demo-rar';
const ADMIN = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const FV = admin.firestore.FieldValue;
const TS = admin.firestore.Timestamp;

let db;
before(() => {
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
  db = admin.firestore();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, { timeout = 20000, interval = 400 } = {}) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeout) return null;
    await sleep(interval);
  }
}
async function clearDb() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}
beforeEach(clearDb);

// 1) review delete -> its threads + votes are cleaned (the orphan that exists today)
test('deleting a community review cascades away its threads + votes', async () => {
  await db.doc('reviews/anime1/items/author1').set({ uid: 'author1', title: 'r', body: 'b', rating: 8, likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('reviews/anime1/items/author1/threads/t1').set({ uid: 'someone', text: 'reply', createdAt: TS.now() });
  await db.doc('reviews/anime1/items/author1/votes/voterX').set({ uid: 'voterX', value: 1, updatedAt: TS.now() });

  await db.doc('reviews/anime1/items/author1').delete();

  const gone = await waitFor(async () => {
    const th = await db.collection('reviews/anime1/items/author1/threads').get();
    const vt = await db.collection('reviews/anime1/items/author1/votes').get();
    return (th.empty && vt.empty) ? true : null;
  });
  assert.ok(gone, 'threads + votes should be cascaded away');
});

// 2) forum thread hard-delete -> its posts are cleaned
test('hard-deleting a forum thread cascades away its posts', async () => {
  await db.doc('forum/tF').set({ authorUid: 'author1', title: 'T', body: 'b', tag: 'general', postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false, createdAt: TS.now(), lastPostAt: TS.now() });
  await db.doc('forum/tF/posts/p1').set({ authorUid: 'someone', body: 'reply', likesCount: 0, reportCount: 0, removed: false, createdAt: TS.now() });

  await db.doc('forum/tF').delete();

  const gone = await waitFor(async () => {
    const posts = await db.collection('forum/tF/posts').get();
    return posts.empty ? true : null;
  });
  assert.ok(gone, 'posts should be cascaded away');
});

// 3) onUserDelete — leaves ZERO trace of the user; sweeps foreign votes; tombstones DMs
test('onUserDelete wipes all authored content + foreign votes + profile, and tombstones DMs', async () => {
  const V = 'victim';
  // the user doc whose deletion triggers the wipe + the user's subtree
  await db.doc('users/' + V).set({ username: 'Victim' });
  await db.doc('users/' + V + '/notifications/n1').set({ toUid: V, type: 'reply', createdAt: TS.now() });
  await db.doc('users/' + V + '/favorites/f1').set({ animeId: 'x' });
  await db.doc('profiles/' + V).set({ displayName: 'Victim' });
  // authored public content
  await db.doc('comments/a/items/cV').set({ uid: V, text: 'mine', displayName: 'V', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('comments/a/items/cV/votes/someone').set({ uid: 'someone', value: 1, updatedAt: TS.now() });
  await db.doc('reviews/b/items/' + V).set({ uid: V, title: 'r', body: 'b', rating: 7, likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('forum/tV').set({ authorUid: V, title: 'T', body: 'b', tag: 'general', postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false, createdAt: TS.now(), lastPostAt: TS.now() });
  // a FOREIGN vote — victim voting under SOMEONE ELSE's comment (carries uid==victim)
  await db.doc('comments/other/items/cOther/votes/' + V).set({ uid: V, value: 1, updatedAt: TS.now() });
  // a DM the victim is in (with admin) — should be tombstoned, not deleted
  await db.doc('conversations/conv1').set({ participants: [V, ADMIN], kind: 'admin', state: 'open', createdAt: TS.now() });

  // trigger
  await db.doc('users/' + V).delete();

  const wiped = await waitFor(async () => {
    const items = await db.collectionGroup('items').where('uid', '==', V).get();
    const forumT = await db.doc('forum/tV').get();
    const foreignVote = await db.doc('comments/other/items/cOther/votes/' + V).get();
    const profile = await db.doc('profiles/' + V).get();
    const notifs = await db.collection('users/' + V + '/notifications').get();
    const allGone = items.empty && !forumT.exists && !foreignVote.exists && !profile.exists && notifs.empty;
    return allGone ? true : null;
  });
  assert.ok(wiped, 'all of the user\'s public content + foreign votes + profile + notifications should be gone');

  const convo = await waitFor(async () => {
    const c = await db.doc('conversations/conv1').get();
    return c.exists && c.data().state === 'locked' ? c.data() : null;
  });
  assert.ok(convo, 'the DM should be TOMBSTONED (state locked), not deleted');
  assert.equal(convo.closedByDeletion, true);
});

// 4) rate-limit detect-and-undo
test('rate limit: the 6th rapid forum thread by one user is detected and undone', async () => {
  for (let i = 0; i < 6; i++) {
    await db.doc('forum/spam' + i).set({ authorUid: 'spammer', title: 'T' + i, body: 'b', tag: 'general', postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false, createdAt: TS.now(), lastPostAt: TS.now() });
  }
  const settled = await waitFor(async () => {
    const s = await db.collection('forum').where('authorUid', '==', 'spammer').get();
    return s.size === 5 ? true : null;
  });
  assert.ok(settled, 'exactly 5 should remain (the 6th over-limit create is undone)');
});

// 5) suggestionCounts rollup
test('suggestionCounts: three suggestions for one anilistId roll up to count 3', async () => {
  for (let i = 0; i < 3; i++) {
    await db.collection('suggestions').add({ title: 'Frieren', anilistId: 154587, englishTitle: 'Frieren', status: 'new', submittedAt: FV.serverTimestamp() });
  }
  const rolled = await waitFor(async () => {
    const d = await db.doc('suggestionCounts/154587').get();
    return d.exists && d.data().count === 3 ? d.data() : null;
  });
  assert.ok(rolled, 'count should reach exactly 3');
  assert.equal(rolled.title, 'Frieren');
});
