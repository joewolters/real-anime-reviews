'use strict';

// =============================================================================
// CF integration tests — proves the TRIGGER WIRING against the real emulators
// (functions + firestore). Run via:  npm run test:cf
//   = firebase emulators:exec --only functions,firestore "node --test <this>"
// Needs JDK 21+ (firestore emulator). Lives OUTSIDE functions/test/ + is a
// .spec.js, so `npm run test:functions` (pure units) never boots an emulator.
//
// The test process writes a vote (as a client would); the functions emulator
// fires the trigger; the CF writes the count + notification; we poll for it.
// =============================================================================

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

const PROJECT = 'demo-rar';
const FV = admin.firestore.FieldValue;
const TS = admin.firestore.Timestamp;

let db;
before(() => {
  admin.initializeApp({ projectId: PROJECT });
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

// 1) server-sourced sender name + exact count
test('vote -> notification uses SERVER-sourced name (forged client name ignored) + count increments', async () => {
  await db.doc('comments/a1/items/c1').set({ uid: 'author1', text: 'hi', displayName: 'Author', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('profiles/voter1').set({ displayName: 'Voter One', photoURL: null });
  // the vote doc even carries a FORGED name — the CF must ignore it:
  await db.doc('comments/a1/items/c1/votes/voter1').set({ value: 1, updatedAt: FV.serverTimestamp(), fromDisplayName: 'FORGED Blake' });

  const notif = await waitFor(async () => {
    const s = await db.collection('users/author1/notifications').get();
    return s.empty ? null : s.docs[0].data();
  });
  assert.ok(notif, 'a notification should be created');
  assert.equal(notif.fromDisplayName, 'Voter One', 'name must come from the profile, not the forged vote field');
  assert.notEqual(notif.fromDisplayName, 'FORGED Blake');
  assert.equal(notif.type, 'comment_vote');
  assert.equal(notif.value, 1);

  const parent = await waitFor(async () => {
    const d = await db.doc('comments/a1/items/c1').get();
    return d.data().likesCount === 1 ? d.data() : null;
  });
  assert.equal(parent.likesCount, 1);
});

// 2) exact counts under concurrent votes (the increment-race fix)
test('five concurrent likes -> count is exactly 5', async () => {
  await db.doc('comments/a2/items/c1').set({ uid: 'author1', text: 'hi', displayName: 'A', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await Promise.all([1, 2, 3, 4, 5].map((i) =>
    db.doc(`comments/a2/items/c1/votes/voter${i}`).set({ value: 1, updatedAt: FV.serverTimestamp() })));
  const parent = await waitFor(async () => {
    const d = await db.doc('comments/a2/items/c1').get();
    return d.data().likesCount === 5 ? d.data() : null;
  });
  assert.ok(parent, 'count should reach exactly 5');
  assert.equal(parent.likesCount, 5);
});

// 3) prune keeps only the newest 10
test('an 11th notification prunes the oldest (cap stays at 10)', async () => {
  const base = Date.now();
  for (let i = 0; i < 11; i++) {
    await db.collection('users/u1/notifications').add({
      toUid: 'u1', fromUid: 'x', type: 'reply', read: false,
      createdAt: TS.fromMillis(base + i * 1000),
    });
  }
  const ok = await waitFor(async () => {
    const s = await db.collection('users/u1/notifications').get();
    return s.size === 10 ? true : null;
  });
  assert.ok(ok, 'should settle at exactly 10');
});

// 4) mute prefs suppress at the source (no doc written at all)
test('a muted type writes NO notification', async () => {
  await db.doc('comments/a3/items/c1').set({ uid: 'author2', text: 'hi', displayName: 'A', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('users/author2/notifPrefs/prefs').set({ muted: { comment_vote: true } });
  await db.doc('profiles/voter1').set({ displayName: 'Voter One' });
  await db.doc('comments/a3/items/c1/votes/voter1').set({ value: 1, updatedAt: FV.serverTimestamp() });

  // count still updates...
  await waitFor(async () => {
    const d = await db.doc('comments/a3/items/c1').get();
    return d.data().likesCount === 1 ? true : null;
  });
  // ...but no notification was written.
  await sleep(2500);
  const s = await db.collection('users/author2/notifications').get();
  assert.equal(s.size, 0, 'muted comment_vote should produce no notification');
});

// 5) unvote decrements the count and notifies no one
test('unvote (delete) decrements the count back to 0', async () => {
  await db.doc('comments/a4/items/c1').set({ uid: 'author1', text: 'hi', displayName: 'A', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('profiles/voter1').set({ displayName: 'Voter One' });
  const voteRef = db.doc('comments/a4/items/c1/votes/voter1');
  await voteRef.set({ value: 1, updatedAt: FV.serverTimestamp() });
  await waitFor(async () => {
    const d = await db.doc('comments/a4/items/c1').get();
    return d.data().likesCount === 1 ? true : null;
  });
  await voteRef.delete();
  const back = await waitFor(async () => {
    const d = await db.doc('comments/a4/items/c1').get();
    return d.data().likesCount === 0 ? true : null;
  });
  assert.ok(back, 'count should return to 0 after the unvote');
});
