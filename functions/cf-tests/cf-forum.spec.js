'use strict';

// =============================================================================
// GATE 9 (v1.10.0) CF integration tests — the forum hotScore spine against the
// functions+firestore emulators. Run via test:cf.
//   - a post VOTE feeds the thread's aggregate likesCount + recomputes hotScore,
//     and writes NO notification (forum posts are counts-only).
//   - a post CREATE bumps the thread's postCount + recomputes hotScore.
// (Clones the test-8 thread-vote shape from cf-integration.spec.js.)
// =============================================================================

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

const PROJECT = 'demo-rar';
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

const HOUR_MS = 3600000;

// 1) forum POST vote -> thread aggregate likesCount + hotScore move; NO notification
test('forum post vote -> thread likesCount===1 AND hotScore>0, and NO notification', async () => {
  const created = TS.fromMillis(Date.now() - 2 * HOUR_MS); // ~2h old
  await db.doc('forum/tHot').set({
    authorUid: 'tauthor', title: 'T', body: 'b', tag: 'general',
    postCount: 0, reportCount: 0, hotScore: 0, likesCount: 0, dislikesCount: 0,
    pinned: false, locked: false, removed: false, createdAt: created, lastPostAt: created,
  });
  await db.doc('forum/tHot/posts/p1').set({
    authorUid: 'pauthor', body: 'reply', likesCount: 0, reportCount: 0, removed: false, createdAt: TS.now(),
  });

  // a client up-vote on the post
  await db.doc('forum/tHot/posts/p1/votes/voter1').set({ value: 1, updatedAt: FV.serverTimestamp() });

  const thread = await waitFor(async () => {
    const d = await db.doc('forum/tHot').get();
    return d.exists && d.data().likesCount === 1 && d.data().hotScore > 0 ? d.data() : null;
  });
  assert.ok(thread, 'thread should show likesCount===1 and a positive hotScore');
  assert.equal(thread.likesCount, 1);
  assert.ok(thread.hotScore > 0, 'hotScore should be recomputed to a positive value');

  // the POST's own count also moved
  const post = await db.doc('forum/tHot/posts/p1').get();
  assert.equal(post.data().likesCount, 1, "the post's own likesCount increments too");

  // forum post votes are counts-only — neither the post author nor the thread author is pinged
  await sleep(2000);
  const pAuthor = await db.collection('users/pauthor/notifications').get();
  const tAuthor = await db.collection('users/tauthor/notifications').get();
  assert.equal(pAuthor.size, 0, 'no notification to the post author');
  assert.equal(tAuthor.size, 0, 'no notification to the thread author');
});

// 2) forum post CREATE -> thread postCount===1 + hotScore>0
test('forum post create -> thread postCount===1 AND hotScore>0', async () => {
  const created = TS.fromMillis(Date.now() - 2 * HOUR_MS);
  await db.doc('forum/tNew').set({
    authorUid: 'tauthor', title: 'T', body: 'b', tag: 'general',
    postCount: 0, reportCount: 0, hotScore: 0, likesCount: 0, dislikesCount: 0,
    pinned: false, locked: false, removed: false, createdAt: created, lastPostAt: created,
  });

  await db.doc('forum/tNew/posts/p1').set({
    authorUid: 'pauthor', body: 'first reply', likesCount: 0, reportCount: 0, removed: false, createdAt: TS.now(),
  });

  const thread = await waitFor(async () => {
    const d = await db.doc('forum/tNew').get();
    return d.exists && d.data().postCount === 1 && d.data().hotScore > 0 ? d.data() : null;
  });
  assert.ok(thread, 'thread should show postCount===1 and a positive hotScore');
  assert.equal(thread.postCount, 1);
  assert.ok(thread.hotScore > 0, 'hotScore should reflect the new postCount');
});
