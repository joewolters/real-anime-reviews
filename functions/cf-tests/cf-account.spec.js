'use strict';

// =============================================================================
// PART A item 7 — SELF-SERVE ACCOUNT DELETION, against the emulator.
// <!-- author: Code | date: 2026-08-10 -->
// The headline test is the FIRST one, and it is written from the BYSTANDER's
// point of view on purpose: hazard #2 was that a member leaving took every
// OTHER member's words down with them, because the old onUserDelete
// recursiveDelete'd the leaver's containers (their forum thread, their comment,
// their review) and a recursiveDelete takes the whole subtree. That was
// somebody else's loss, so it is asserted as somebody else's.
//
// Drives the lib/account.js cores directly (the cf-moderation pattern) so the
// erasure is provable without the Auth emulator.
// =============================================================================

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const account = require('../lib/account');

const PROJECT = 'demo-rar';
const ADMIN = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const FV = admin.firestore.FieldValue;
const TS = admin.firestore.Timestamp;

let db;
before(() => {
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
  db = admin.firestore();
});

async function clearDb() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}
beforeEach(clearDb);

test('HAZARD 2: when a member leaves, OTHER members\' words in their threads SURVIVE', async () => {
  const LEAVER = 'leaver';
  const BYSTANDER = 'bystander';

  // a thread the leaver started, with a bystander's post inside it
  await db.doc('forum/tShared').set({
    authorUid: LEAVER, title: 'Best fight scenes', body: 'go', tag: 'general',
    postCount: 1, reportCount: 0, pinned: false, locked: false, removed: false,
    createdAt: TS.now(), lastPostAt: TS.now(),
  });
  await db.doc('forum/tShared/posts/pBystander').set({
    authorUid: BYSTANDER, body: 'Gurren Lagann, easily.',
    likesCount: 0, reportCount: 0, removed: false, createdAt: TS.now(),
  });
  // a comment the leaver wrote, with a bystander's reply under it
  await db.doc('comments/a/items/cLeaver').set({
    uid: LEAVER, text: 'mine', displayName: 'Leaver', photoURL: null,
    likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  await db.doc('comments/a/items/cLeaver/replies/rBystander').set({
    uid: BYSTANDER, text: 'good point', displayName: 'Bystander',
    likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  // a review the leaver wrote, with a bystander's reply thread under it
  await db.doc('reviews/b/items/' + LEAVER).set({
    uid: LEAVER, title: 'r', body: 'my review', displayName: 'Leaver',
    rating: 7, likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  await db.doc('reviews/b/items/' + LEAVER + '/threads/thBystander').set({
    uid: BYSTANDER, text: 'I disagree, and here is why',
    displayName: 'Bystander', likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });

  await account.runAccountErasure(db, FV, null, LEAVER);

  // THE POINT: every word the bystander wrote is still exactly where they left it
  const post = await db.doc('forum/tShared/posts/pBystander').get();
  assert.ok(post.exists, "the bystander's post must survive the leaver's departure");
  assert.equal(post.data().body, 'Gurren Lagann, easily.', 'and be untouched');
  assert.notEqual(post.data().authorDeleted, true, "and not be marked by someone else's deletion");

  const reply = await db.doc('comments/a/items/cLeaver/replies/rBystander').get();
  assert.ok(reply.exists, "the bystander's reply must survive");
  assert.equal(reply.data().text, 'good point');

  const rthread = await db.doc('reviews/b/items/' + LEAVER + '/threads/thBystander').get();
  assert.ok(rthread.exists, "the bystander's review reply must survive");
  assert.equal(rthread.data().text, 'I disagree, and here is why');

  // and the containers holding them are still there, emptied of the leaver
  const thread = await db.doc('forum/tShared').get();
  assert.ok(thread.exists, 'the thread keeps its shape so the replies still make sense');
  assert.equal(thread.data().title, '');
  assert.equal(thread.data().body, '');
  assert.equal(thread.data().authorDeleted, true);
  // NOT `removed` — the hub list filters removed!==true, so that mark would
  // hide the thread and take the bystander's post out of reach anyway.
  assert.notEqual(thread.data().removed, true);
  const comment = await db.doc('comments/a/items/cLeaver').get();
  assert.ok(comment.exists);
  assert.equal(comment.data().text, '');
  assert.equal(comment.data().authorDeleted, true);
});

test('the leaver\'s name, face and pictures go with their words', async () => {
  const U = 'shutterbug';
  await db.doc('comments/a/items/cImg').set({
    uid: U, text: 'look at this', displayName: 'Shutterbug',
    photoURL: 'https://firebasestorage.googleapis.com/x',
    imageRefs: ['uploads/' + U + '/cImg/i1'],
    likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  await db.doc('forum/tImg').set({
    authorUid: U, title: 'gallery', body: 'b', tag: 'general',
    thumbImage: 'uploads/' + U + '/tImg/cover', imageRefs: ['uploads/' + U + '/tImg/cover'],
    postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false,
    createdAt: TS.now(), lastPostAt: TS.now(),
  });

  await account.runAccountErasure(db, FV, null, U);

  const c = (await db.doc('comments/a/items/cImg').get()).data();
  assert.equal(c.text, '');
  assert.equal('imageRefs' in c, false, 'the image pointers are gone, not blanked');
  assert.equal(c.displayName, '[deleted]');
  assert.equal(c.photoURL, null);
  const t = (await db.doc('forum/tImg').get()).data();
  assert.equal('imageRefs' in t, false);
  assert.equal('thumbImage' in t, false, 'the card cover goes too');
});

test('votes and appreciates are DELETED, not tombstoned (they are not content)', async () => {
  const U = 'voter';
  await db.doc('comments/a/items/cOther/votes/' + U).set({ uid: U, value: 1, updatedAt: TS.now() });
  await db.doc('forum/tOther/posts/pOther/votes/' + U).set({ uid: U, value: -1, updatedAt: TS.now() });
  await db.doc('profiles/someone/likes/' + U).set({ uid: U, value: 1, createdAt: TS.now() });

  await account.runAccountErasure(db, FV, null, U);

  assert.equal((await db.doc('comments/a/items/cOther/votes/' + U).get()).exists, false);
  assert.equal((await db.doc('forum/tOther/posts/pOther/votes/' + U).get()).exists, false);
  assert.equal((await db.doc('profiles/someone/likes/' + U).get()).exists, false);
});

test('private records go; the moderation RECORD about them stays', async () => {
  const U = 'departing';
  await db.doc('users/' + U).set({ username: 'Departing' });
  await db.doc('users/' + U + '/savedShelves/s1').set({ ownerUid: 'x', colId: 'c', name: 'n' });
  await db.doc('profiles/' + U).set({ displayName: 'Departing' });
  await db.doc('moderationGate/' + U).set({ banned: false, consentVersion: 1 });
  await db.doc('rulesConsent/' + U).set({ version: 1 });
  await db.doc('rateState/' + U).set({ count: 3 });
  await db.doc('rateState/' + U + '__dm').set({ count: 1 });
  await db.doc('banned/' + U).set({ by: ADMIN, reason: 'why they were banned' });

  await account.runAccountErasure(db, FV, null, U);

  for (const p of ['users/' + U, 'profiles/' + U, 'moderationGate/' + U,
    'rulesConsent/' + U, 'rateState/' + U, 'rateState/' + U + '__dm']) {
    assert.equal((await db.doc(p).get()).exists, false, p + ' should be deleted');
  }
  assert.equal((await db.collection('users/' + U + '/savedShelves').get()).empty, true);
  // the ban record is about a decision the SITE made — same class as a report
  assert.equal((await db.doc('banned/' + U).get()).exists, true, 'the moderation record survives');
});

test('a DM is LOCKED, never deleted — half of it is the other person\'s', async () => {
  const U = 'penpal';
  await db.doc('conversations/cv1').set({ participants: [U, 'friend'], kind: 'peer', state: 'open', createdAt: TS.now() });
  await db.doc('conversations/cv1/messages/m1').set({ senderUid: 'friend', text: 'their words', createdAt: TS.now() });

  await account.runAccountErasure(db, FV, null, U);

  const cv = await db.doc('conversations/cv1').get();
  assert.ok(cv.exists, 'the conversation is not deleted');
  assert.equal(cv.data().state, 'locked');
  assert.equal(cv.data().closedByDeletion, true);
  assert.equal((await db.doc('conversations/cv1/messages/m1').get()).data().text, 'their words',
    "the other person's letters are untouched");
});

test('erasure is IDEMPOTENT — a second run changes nothing and throws nothing', async () => {
  const U = 'twice';
  await db.doc('comments/a/items/cTwice').set({
    uid: U, text: 'once', displayName: 'Twice', likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  await account.runAccountErasure(db, FV, null, U);
  const first = (await db.doc('comments/a/items/cTwice').get()).data();
  await account.runAccountErasure(db, FV, null, U);
  const second = (await db.doc('comments/a/items/cTwice').get()).data();
  assert.deepEqual(second, first);
});

test('erasure never RESURRECTS a doc that was already deleted', async () => {
  // The redaction used set-with-merge, which CREATES a missing document. On the
  // ban path that was invisible (the target's docs are alive); on the erasure
  // path — where things are being deleted all around it — it minted ghost
  // tombstones nobody wrote, which then fired the create-triggers. It starved
  // an unrelated cascade in this very track for 75 seconds.
  const U = 'ghost';
  const ref = db.doc('comments/a/items/cGhost');
  await ref.set({ uid: U, text: 'here for now', displayName: 'Ghost', createdAt: TS.now() });
  // hold the snapshot the erasure would have queried, then delete underneath it
  const stale = await db.collectionGroup('items').where('uid', '==', U).get();
  assert.equal(stale.size, 1);
  await ref.delete();

  await account.runAccountErasure(db, FV, null, U);
  assert.equal((await ref.get()).exists, false, 'a deleted doc must stay deleted');

  // and the redaction core itself must not create one from a stale reference
  const moderation = require('../lib/moderation');
  await moderation.redactAuthored(db, db.collectionGroup('items').where('uid', '==', U), { text: '' }, { authorDeleted: true });
  assert.equal((await ref.get()).exists, false, 'no ghost tombstone');
});

test('another member\'s identically-shaped content is never touched', async () => {
  await db.doc('comments/a/items/cMine').set({
    uid: 'goer', text: 'mine', displayName: 'Goer', likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  await db.doc('comments/a/items/cTheirs').set({
    uid: 'stayer', text: 'theirs', displayName: 'Stayer', likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  await account.runAccountErasure(db, FV, null, 'goer');
  const theirs = (await db.doc('comments/a/items/cTheirs').get()).data();
  assert.equal(theirs.text, 'theirs');
  assert.equal(theirs.displayName, 'Stayer');
  assert.notEqual(theirs.authorDeleted, true);
});

test('the callable refuses the admin, a stale sign-in, and an anonymous caller', async () => {
  const now = Date.now();
  const fresh = { auth_time: Math.floor(now / 1000) - 30 };
  const stale = { auth_time: Math.floor(now / 1000) - 3600 };
  await assert.rejects(
    () => account.applyDeleteMyAccount(db, FV, null, null, ADMIN, fresh, now), /cannot be deleted/i);
  await assert.rejects(
    () => account.applyDeleteMyAccount(db, FV, null, null, 'someone', stale, now), /sign in again/i);
  await assert.rejects(
    () => account.applyDeleteMyAccount(db, FV, null, null, null, fresh, now), /sign in/i);
});

test('the TRIGGER path refuses the admin too, not just the callable', async () => {
  // runAccountErasure has two entry points and only one of them runs the guard.
  // Deleting the admin's users doc with the Admin SDK would otherwise erase the
  // Creator's account — his reviews, his profile, the site's one authority.
  await db.doc('comments/a/items/cCreator').set({
    uid: ADMIN, text: 'the Creator wrote this', displayName: 'Blake',
    likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  await db.doc('profiles/' + ADMIN).set({ displayName: 'Blake' });

  const res = await account.runAccountErasure(db, FV, null, ADMIN);
  assert.equal(res.refused, 'admin');
  const c = (await db.doc('comments/a/items/cCreator').get()).data();
  assert.equal(c.text, 'the Creator wrote this');
  assert.notEqual(c.authorDeleted, true);
  assert.equal((await db.doc('profiles/' + ADMIN).get()).exists, true, "the Creator's profile survives");
});

test('a refused call writes NOTHING — the admin\'s own content is still there', async () => {
  const now = Date.now();
  await db.doc('comments/a/items/cAdmin').set({
    uid: ADMIN, text: 'the Creator wrote this', displayName: 'Blake',
    likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  await assert.rejects(
    () => account.applyDeleteMyAccount(db, FV, null, null, ADMIN,
      { auth_time: Math.floor(now / 1000) - 5 }, now), /cannot be deleted/i);
  const c = (await db.doc('comments/a/items/cAdmin').get()).data();
  assert.equal(c.text, 'the Creator wrote this');
  assert.notEqual(c.authorDeleted, true);
});

test('the callable erases AND removes the sign-in', async () => {
  const U = 'gone4good';
  const now = Date.now();
  await db.doc('users/' + U).set({ username: 'Gone' });
  await db.doc('comments/a/items/cGone').set({
    uid: U, text: 'bye', displayName: 'Gone', likesCount: 0, dislikesCount: 0, createdAt: TS.now(),
  });
  const calls = [];
  const res = await account.applyDeleteMyAccount(
    db, FV, null, (uid) => { calls.push(uid); return Promise.resolve(); },
    U, { auth_time: Math.floor(now / 1000) - 10 }, now);

  assert.equal(res.ok, true);
  assert.equal(res.authDeleted, true);
  assert.deepEqual(calls, [U], 'the Auth user is deleted — otherwise they sign right back in');
  assert.equal((await db.doc('comments/a/items/cGone').get()).data().text, '');
  assert.equal((await db.doc('users/' + U).get()).exists, false);
});

// ---------------------------------------------------------------------------
// PART A item 6 — the stats recompute, against real data in the emulator.
// ---------------------------------------------------------------------------
const stats = require('../lib/stats');

test('stats: the recompute counts real collections and writes ONE admin doc', async () => {
  const now = Date.now();
  await db.doc('profiles/m1').set({ joinedAt: TS.fromMillis(now - 2 * 86400000), likesCount: 4 });
  await db.doc('profiles/m2').set({ joinedAt: TS.fromMillis(now - 400 * 86400000), likesCount: 1 });
  await db.doc('comments/a/items/c1').set({ uid: 'm1', text: 'hi', createdAt: TS.fromMillis(now - 86400000) });
  await db.doc('comments/a/items/c2').set({ uid: 'm2', text: 'old', createdAt: TS.fromMillis(now - 90 * 86400000) });
  await db.doc('reviews/b/items/m1').set({ uid: 'm1', body: 'r', createdAt: TS.fromMillis(now - 86400000) });
  await db.doc('forum/t1').set({ authorUid: 'm2', title: 'T', body: 'b', createdAt: TS.fromMillis(now - 86400000) });
  await db.doc('forum/t1/posts/p1').set({ authorUid: 'm1', body: 'p', createdAt: TS.fromMillis(now - 86400000) });
  await db.doc('conversations/cv1').set({ participants: ['m1', 'm2'], createdAt: TS.now() });
  await db.doc('conversations/cv1/messages/msg1').set({ senderUid: 'm1', text: 'secret', createdAt: TS.now() });

  await stats.writeStats(db, FV, { nowMs: now, source: 'manual' });
  const doc = await db.doc('adminStats/current').get();
  assert.ok(doc.exists, 'the ONE stats doc is written');
  const s = doc.data();

  assert.equal(s.members.total, 2);
  assert.equal(s.members.joinedRecent, 1);
  assert.equal(s.appreciates, 5);
  // comments and reviews are told apart even though both live under items/
  assert.equal(s.content.comments, 2);
  assert.equal(s.content.reviews, 1);
  assert.equal(s.content.forumThreads, 1);
  assert.equal(s.content.forumPosts, 1);
  assert.equal(s.recent.comments, 1, 'the 90-day-old comment is not recent');
  assert.equal(s.members.active, 2);
  assert.equal(s.dms.conversations, 1);
  assert.equal(s.dms.messages, 1);
  assert.equal(s.source, 'manual');
  assert.ok(s.generatedAt, 'freshness is recorded');

  // THE VOW: no letter text, and no member identity, anywhere in the document
  const serialized = JSON.stringify(s);
  assert.equal(/secret/.test(serialized), false, 'a letter body must never reach this doc');
  assert.equal(/m1|m2/.test(serialized), false, 'no member is identifiable in the stats doc');
});

test('stats: an item-7 tombstone counts as a tombstone, not as live content', async () => {
  const now = Date.now();
  await db.doc('comments/a/items/cLive').set({ uid: 'x', text: 'here', createdAt: TS.fromMillis(now - 86400000) });
  await db.doc('comments/a/items/cGone').set({
    uid: 'y', text: '', authorDeleted: true, createdAt: TS.fromMillis(now - 86400000),
  });
  await stats.writeStats(db, FV, { nowMs: now });
  const s = (await db.doc('adminStats/current').get()).data();
  assert.equal(s.content.comments, 1, 'only the live one counts as content');
  assert.equal(s.tombstones, 1);
  assert.equal(s.source, 'schedule', 'the default source is the daily run');
});

test('stats: a rerun OVERWRITES with ground truth (the whole point of a recompute)', async () => {
  const now = Date.now();
  await db.doc('comments/a/items/c1').set({ uid: 'x', text: 'one', createdAt: TS.fromMillis(now) });
  await stats.writeStats(db, FV, { nowMs: now });
  assert.equal((await db.doc('adminStats/current').get()).data().content.comments, 1);

  await db.doc('comments/a/items/c1').delete();
  await stats.writeStats(db, FV, { nowMs: now });
  // no decrement was ever written anywhere — the number simply IS the truth again
  assert.equal((await db.doc('adminStats/current').get()).data().content.comments, 0);
});
