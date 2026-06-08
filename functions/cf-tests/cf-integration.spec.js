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

// 6) reply vote (gate 4b) -> the REPLY's own count increments + a server-sourced
//    notification to the REPLY author (kind:reply reuses comment_vote; verb=reply)
test('reply vote -> reply count increments + server-sourced notification to the reply author', async () => {
  await db.doc('comments/ar/items/c1').set({ uid: 'cauthor', text: 'parent', displayName: 'C', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('comments/ar/items/c1/replies/r1').set({ uid: 'rauthor', text: 'a reply', displayName: 'R', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('profiles/voter1').set({ displayName: 'Voter One', photoURL: null });
  // forged name on the vote doc must be ignored (server sources it from profiles)
  await db.doc('comments/ar/items/c1/replies/r1/votes/voter1').set({ value: 1, updatedAt: FV.serverTimestamp(), fromDisplayName: 'FORGED' });

  const notif = await waitFor(async () => {
    const s = await db.collection('users/rauthor/notifications').get();
    return s.empty ? null : s.docs[0].data();
  });
  assert.ok(notif, 'the reply author should get a notification');
  assert.equal(notif.fromDisplayName, 'Voter One', 'name must come from the profile, not the forged field');
  assert.equal(notif.type, 'comment_vote', 'a reply vote reuses the comment_vote type');
  assert.equal(notif.value, 1);
  assert.equal(notif.verb, 'liked your reply');

  const reply = await waitFor(async () => {
    const d = await db.doc('comments/ar/items/c1/replies/r1').get();
    return d.data().likesCount === 1 ? d.data() : null;
  });
  assert.equal(reply.likesCount, 1, "the reply's own count (not the parent comment's) increments");

  // the parent comment's count must NOT move (the reply vote is scoped to the reply)
  const parent = await db.doc('comments/ar/items/c1').get();
  assert.equal(parent.data().likesCount, 0, "the parent comment's count must stay untouched");
});

// 7) review vote (gate 5 migration) -> review count + server-sourced notification
test('review vote -> review count increments + server-sourced notification to the review author', async () => {
  await db.doc('reviews/rv/items/author1').set({ uid: 'author1', title: 'T', body: 'b', rating: 8, displayName: 'A', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('profiles/voter1').set({ displayName: 'Voter One', photoURL: null });
  await db.doc('reviews/rv/items/author1/votes/voter1').set({ value: 1, updatedAt: FV.serverTimestamp() });

  const notif = await waitFor(async () => {
    const s = await db.collection('users/author1/notifications').get();
    return s.empty ? null : s.docs[0].data();
  });
  assert.ok(notif, 'the review author should get a notification');
  assert.equal(notif.fromDisplayName, 'Voter One');
  assert.equal(notif.type, 'review_vote');
  assert.equal(notif.verb, 'found your review helpful'); // gate-6 verb lock

  const review = await waitFor(async () => {
    const d = await db.doc('reviews/rv/items/author1').get();
    return d.data().likesCount === 1 ? d.data() : null;
  });
  assert.equal(review.likesCount, 1);
});

// 8) thread (review-discussion) vote -> count increments but NO notification (counts-only)
test('thread vote -> thread count increments and writes NO notification', async () => {
  await db.doc('reviews/rv2/items/rauthor').set({ uid: 'rauthor', title: 'T', body: 'b', rating: 7, displayName: 'R', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('reviews/rv2/items/rauthor/threads/t1').set({ uid: 'tauthor', text: 'discussion', displayName: 'T', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('reviews/rv2/items/rauthor/threads/t1/votes/voter1').set({ value: 1, updatedAt: FV.serverTimestamp() });

  const thread = await waitFor(async () => {
    const d = await db.doc('reviews/rv2/items/rauthor/threads/t1').get();
    return d.data().likesCount === 1 ? d.data() : null;
  });
  assert.ok(thread, 'thread count should reach 1');
  assert.equal(thread.likesCount, 1);

  await sleep(2000);
  const s = await db.collection('users/tauthor/notifications').get();
  assert.equal(s.size, 0, 'thread votes are counts-only — no notification');
});

// 9) official (Blake's-rating agreement) vote -> aggregate count increments, no notification
test('official vote -> aggregate count increments (counts-only, gate 6 migration)', async () => {
  await db.doc('official/ov/votes/voter1').set({ value: 1, updatedAt: FV.serverTimestamp() });
  const agg = await waitFor(async () => {
    const d = await db.doc('official/ov').get();
    return d.exists && d.data().likesCount === 1 ? d.data() : null;
  });
  assert.ok(agg, 'official aggregate likesCount should reach 1');
  assert.equal(agg.likesCount, 1);
});

// 10) a "Not helpful" review vote increments the count but writes NO notification (gate-6 lock)
test('review NOT-helpful vote -> dislikes count moves but NO notification', async () => {
  await db.doc('reviews/nh/items/author1').set({ uid: 'author1', title: 'T', body: 'b', rating: 8, displayName: 'A', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('profiles/voter1').set({ displayName: 'Voter One' });
  await db.doc('reviews/nh/items/author1/votes/voter1').set({ value: -1, updatedAt: FV.serverTimestamp() });
  const review = await waitFor(async () => {
    const d = await db.doc('reviews/nh/items/author1').get();
    return d.data().dislikesCount === 1 ? d.data() : null;
  });
  assert.equal(review.dislikesCount, 1);
  await sleep(2000);
  const s = await db.collection('users/author1/notifications').get();
  assert.equal(s.size, 0, 'a Not-helpful (value -1) review vote must NOT notify');
});
