'use strict';

// =============================================================================
// GATE 3 CF integration tests — cascade deletes, onUserDelete, rate-limit,
// suggestionCounts — against the functions+firestore emulators. Run via test:cf.
// =============================================================================

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { applyMigrateRequestThread } = require('../lib/migrate'); // gate 20.5 — gold-flip migration core

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
// gate 20.5 — default 20000 → 45000: the emulator now runs 34 functions and
// this file front-loads the migration seeds, so the heavy paged cascades
// (recursiveDelete / onUserDelete / the rate-limit sweep) drift past 20s
// under full-track load. Same green outcome, honest margin (the heaviest
// observed pass was ~20.3s — right ON the old line).
// PART A items 6+7: 45000 → 75000, for margin only. The failure that exposed
// this was NOT a margin problem and was not fixed by the bump: the item-7
// erasure's set-with-merge redaction was RESURRECTING docs that clearDb had
// just deleted, and the resulting create-trigger storm starved this file's
// first cascade for 75s with zero dispatch. Root-caused by re-running the
// pre-change baseline (79/79 green) rather than by raising the timeout; the
// fix is `update` instead of `set-merge` in lib/moderation.js redactAuthored.
// The margin stays because the emulator now loads three more functions.
async function waitFor(fn, { timeout = 75000, interval = 400 } = {}) {
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

// 3) onUserDelete — the leaver's WORDS are gone; their votes are swept; their
//    private data is deleted; DMs are locked. Their containers stay.
//
// ⚠️ THIS TEST WAS DELIBERATELY CHANGED IN PART A ITEM 7. It used to assert
// `items.empty` and `!forumT.exists` — i.e. it PINNED the destroy-everything
// cascade, and that cascade took other members' posts down with the leaver's
// thread (hazard #2). Blake's locked policy is "tombstone the containers, erase
// the content", so the assertions now check the words are gone and the slot
// remains. The third-party-survival test directly below is the one that would
// have caught the old behaviour.
test('onUserDelete erases the leaver\'s words, keeps their slots, sweeps foreign votes, and locks DMs', async () => {
  const V = 'victim';
  // the user doc whose deletion triggers the wipe + the user's subtree
  await db.doc('users/' + V).set({ username: 'Victim' });
  await db.doc('users/' + V + '/notifications/n1').set({ toUid: V, type: 'reply', createdAt: TS.now() });
  await db.doc('users/' + V + '/favorites/f1').set({ animeId: 'x' });
  await db.doc('profiles/' + V).set({ displayName: 'Victim' });
  // authored public content
  // photoURL is seeded so the "their face goes too" assertion below is real:
  // redactionFor only writes fields the doc ACTUALLY has (it must not bolt an
  // irrelevant empty field onto a doc), so a fixture without one proves nothing.
  await db.doc('comments/a/items/cV').set({ uid: V, text: 'mine', displayName: 'V', photoURL: 'https://firebasestorage.googleapis.com/v', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
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
    const comment = await db.doc('comments/a/items/cV').get();
    const review = await db.doc('reviews/b/items/' + V).get();
    const forumT = await db.doc('forum/tV').get();
    const foreignVote = await db.doc('comments/other/items/cOther/votes/' + V).get();
    const profile = await db.doc('profiles/' + V).get();
    const notifs = await db.collection('users/' + V + '/notifications').get();
    const emptied = comment.exists && (comment.data().text || '') === ''
      && review.exists && (review.data().body || '') === ''
      && forumT.exists && (forumT.data().title || '') === ''
      && !foreignVote.exists && !profile.exists && notifs.empty;
    return emptied ? true : null;
  });
  assert.ok(wiped, 'the words, the foreign votes, the profile and the notifications should all be gone');

  // the containers survive, marked, carrying nothing of the person who left
  const c = (await db.doc('comments/a/items/cV').get()).data();
  assert.equal(c.text, '', 'the comment text is erased');
  assert.equal(c.authorDeleted, true, 'the slot is marked as an author deletion');
  assert.equal(c.displayName, '[deleted]', 'their name does not stay behind');
  assert.equal(c.photoURL, null, 'nor their face');
  // ...and NOT `removed`, which is the moderator mark and would hide the thread
  assert.notEqual(c.removed, true, 'a self-deletion is not a moderator removal');
  const t = (await db.doc('forum/tV').get()).data();
  assert.equal(t.title, '');
  assert.equal(t.body, '');
  assert.equal(t.authorDeleted, true);
  assert.notEqual(t.removed, true, 'the thread must stay listed — other members are in it');
  // the private data really is deleted, not blanked
  assert.equal((await db.doc('users/' + V).get()).exists, false);
  assert.equal((await db.collection('users/' + V + '/favorites').get()).empty, true);

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

// 6) gate 20.5 — migrateRequestThread core (the gold-flip's MIGRATION half:
//    'anime:al:<id>' threads retag to 'anime:<slug>' and GAIN the verdict rail).
//    Drives lib/migrate.js directly, like the moderation cores in cf-moderation.

const alThread = (uid, tag) => ({
  authorUid: uid, title: 'Talk', body: 'b', tag,
  postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false,
  createdAt: TS.now(), lastPostAt: TS.now(),
});

test('migrateRequestThread rejects a NON-admin caller (tag untouched)', async () => {
  await db.doc('forum/tAl').set(alThread('fan1', 'anime:al:154587'));
  await assert.rejects(() => applyMigrateRequestThread(db, 'not-admin', 154587, 'frieren'), /admin/i);
  assert.equal((await db.doc('forum/tAl').get()).data().tag, 'anime:al:154587', 'non-admin call must not retag');
});

test('migrateRequestThread (admin) retags the anime:al: threads and leaves a different-tag thread untouched', async () => {
  await db.doc('forum/tMig1').set(alThread('fan1', 'anime:al:154587'));
  await db.doc('forum/tMig2').set(alThread('fan2', 'anime:al:154587'));
  await db.doc('forum/tOther').set(alThread('fan3', 'anime:al:999'));   // a DIFFERENT title's thread
  await db.doc('forum/tTopic').set(alThread('fan4', 'general'));        // a topic thread

  // anilistId as a STRING — the admin row's dataset attribute hands one back; coercion covered.
  const res = await applyMigrateRequestThread(db, ADMIN, '154587', 'frieren');
  assert.equal(res.migrated, 2, 'both matching threads retagged');

  const t1 = (await db.doc('forum/tMig1').get()).data();
  assert.equal(t1.tag, 'anime:frieren');
  assert.equal(t1.title, 'Talk', 'other fields untouched');
  assert.equal(t1.removed, false, 'other fields untouched');
  assert.equal((await db.doc('forum/tMig2').get()).data().tag, 'anime:frieren');
  assert.equal((await db.doc('forum/tOther').get()).data().tag, 'anime:al:999', 'different anilistId untouched');
  assert.equal((await db.doc('forum/tTopic').get()).data().tag, 'general', 'topic thread untouched');

  // idempotent by nature — a re-run queries the OLD tag and finds 0.
  const again = await applyMigrateRequestThread(db, ADMIN, 154587, 'frieren');
  assert.equal(again.migrated, 0);
});

test('migrateRequestThread rejects a garbage slug / garbage anilistId (writes nothing)', async () => {
  await db.doc('forum/tGarb').set(alThread('fan1', 'anime:al:154587'));
  await assert.rejects(() => applyMigrateRequestThread(db, ADMIN, 154587, 'Frieren!'), /slug/i);       // case + punctuation
  await assert.rejects(() => applyMigrateRequestThread(db, ADMIN, 154587, 'anime:frieren'), /slug/i);  // pre-prefixed
  await assert.rejects(() => applyMigrateRequestThread(db, ADMIN, 154587, 'x'.repeat(101)), /slug/i);  // over the {1,100} rules cap
  await assert.rejects(() => applyMigrateRequestThread(db, ADMIN, 154587, ''), /slug/i);
  await assert.rejects(() => applyMigrateRequestThread(db, ADMIN, -5, 'frieren'), /anilistId/i);
  await assert.rejects(() => applyMigrateRequestThread(db, ADMIN, 'abc', 'frieren'), /anilistId/i);
  await assert.rejects(() => applyMigrateRequestThread(db, ADMIN, { anilistId: 1 }, 'frieren'), /anilistId/i);
  assert.equal((await db.doc('forum/tGarb').get()).data().tag, 'anime:al:154587', 'garbage input must not retag');
});
