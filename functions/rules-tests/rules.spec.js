'use strict';

// =============================================================================
// v1.9.0 firestore.rules — EMULATOR rules tests (the highest-ROI gate-1 check).
// For every new/changed collection: prove the HOSTILE path is DENIED and the
// HAPPY path is allowed. Run via the Firestore emulator (needs a JDK):
//   npm run test:rules   (= firebase emulators:exec --only firestore "... this file")
// NOT discovered by `npm run test:functions` (it lives outside functions/test/
// and is a .spec.js, so the pure-unit track never tries to boot an emulator).
// =============================================================================

const { test, before, after, beforeEach } = require('node:test');
const { readFileSync } = require('node:fs');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp,
} = require('firebase/firestore');

const ADMIN = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1'; // the existing ADMIN_UID (status quo)
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rar',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));

// ---------------- COMMENTS (+ per-season al: key, H1, L2) ----------------
test('comment: happy create by owner', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'comments/demon-slayer/items/c1'),
    { uid: 'alice', text: 'great show', displayName: 'Alice', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
});
test('comment: HOSTILE create with someone else\'s uid is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'comments/demon-slayer/items/c2'),
    { uid: 'mallory', text: 'x', displayName: 'A', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
});
test('comment: HOSTILE backdated createdAt (L2) is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'comments/demon-slayer/items/c3'),
    { uid: 'alice', text: 'x', displayName: 'A', createdAt: Timestamp.fromMillis(0), likesCount: 0, dislikesCount: 0 }));
});
test('comment: HOSTILE direct likesCount inflation (H1) is DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'comments/demon-slayer/items/c1'),
    { uid: 'alice', text: 'hi', displayName: 'A', createdAt: Timestamp.now(), likesCount: 0, dislikesCount: 0 }));
  await assertFails(updateDoc(doc(as('mallory'), 'comments/demon-slayer/items/c1'), { likesCount: 999999 }));
  // even the OWNER cannot write the count directly:
  await assertFails(updateDoc(doc(as('alice'), 'comments/demon-slayer/items/c1'), { likesCount: 999999 }));
});
test('comment: happy create under a per-season al:<id> key', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'comments/al:101922/items/c1'),
    { uid: 'alice', text: 'season talk', displayName: 'Alice', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
});

// ---------------- VOTES ----------------
test('vote: happy own vote', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'comments/demon-slayer/items/c1/votes/alice'),
    { value: 1, uid: 'alice', updatedAt: serverTimestamp() }));
});
test('vote: HOSTILE vote written for another uid is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'comments/demon-slayer/items/c1/votes/bob'),
    { value: 1, updatedAt: serverTimestamp() }));
});

// ---------------- NOTIFICATIONS (H3) ----------------
test('notification: HOSTILE client create into another user\'s bell is DENIED (H3)', async () => {
  await assertFails(setDoc(doc(as('mallory'), 'users/victim/notifications/n1'),
    { toUid: 'victim', fromUid: 'mallory', fromDisplayName: 'Blake', type: 'comment_vote', value: 1,
      animeId: 'x', animeTitle: 'X', targetId: 't', createdAt: serverTimestamp() }));
});
test('notification: owner may mark own notification read', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice/notifications/n1'),
    { toUid: 'alice', fromUid: 'bob', type: 'reply', createdAt: Timestamp.now(), read: false }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice/notifications/n1'),
    { read: true, readAt: serverTimestamp() }));
});
test('notification: HOSTILE owner editing notification content is DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice/notifications/n1'),
    { toUid: 'alice', fromUid: 'bob', type: 'reply', createdAt: Timestamp.now(), read: false }));
  await assertFails(updateDoc(doc(as('alice'), 'users/alice/notifications/n1'), { type: 'hacked' }));
});

// ---------------- FORUM (H2, mod tools, H5, locked posts) ----------------
const thread = (over = {}) => ({
  authorUid: 'alice', title: 'Hi', body: 'hello', tag: 'general',
  createdAt: serverTimestamp(), lastPostAt: serverTimestamp(),
  postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false, ...over,
});
test('forum: happy thread create with zeroed counters', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/t1'), thread()));
});
test('forum: HOSTILE seeding a non-zero counter at create (H2) is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'forum/t2'), thread({ postCount: 5 })));
});
test('forum: HOSTILE non-admin creating a pre-pinned thread (H2) is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'forum/t3'), thread({ pinned: true })));
});
test('forum: HOSTILE non-owner editing a thread body is DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'forum/t1'), { ...thread(), createdAt: Timestamp.now(), lastPostAt: Timestamp.now() }));
  await assertFails(updateDoc(doc(as('mallory'), 'forum/t1'), { body: 'defaced', editedAt: serverTimestamp() }));
});
test('forum: admin may pin a thread (mod tool)', async () => {
  await seed((db) => setDoc(doc(db, 'forum/t1'), { ...thread(), createdAt: Timestamp.now(), lastPostAt: Timestamp.now() }));
  await assertSucceeds(updateDoc(doc(as(ADMIN), 'forum/t1'), { pinned: true }));
});
test('forum post: happy reply when parent is unlocked', async () => {
  await seed((db) => setDoc(doc(db, 'forum/t1'), { ...thread(), createdAt: Timestamp.now(), lastPostAt: Timestamp.now() }));
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/t1/posts/p1'),
    { authorUid: 'alice', body: 'reply', createdAt: serverTimestamp(), likesCount: 0, reportCount: 0, removed: false }));
});
test('forum post: HOSTILE reply to a LOCKED thread is DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'forum/tLocked'), { ...thread({ locked: true }), createdAt: Timestamp.now(), lastPostAt: Timestamp.now() }));
  await assertFails(setDoc(doc(as('alice'), 'forum/tLocked/posts/p1'),
    { authorUid: 'alice', body: 'sneak', createdAt: serverTimestamp(), likesCount: 0, reportCount: 0, removed: false }));
});

// ---------------- CONVERSATIONS / DMs (admin-floor only, H4) ----------------
test('conversation: happy admin-floor create (one participant is ADMIN)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/c_alice_admin'),
    { participants: ['alice', ADMIN], kind: 'admin', state: 'open', createdAt: serverTimestamp() }));
});
test('conversation: HOSTILE peer create (no admin participant) is DENIED — peer is BANKED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'conversations/c_alice_bob'),
    { participants: ['alice', 'bob'], kind: 'peer', state: 'open', createdAt: serverTimestamp() }));
});
test('conversation: HOSTILE non-member read is DENIED (H4)', async () => {
  await seed((db) => setDoc(doc(db, 'conversations/c1'),
    { participants: ['alice', ADMIN], kind: 'admin', state: 'open', createdAt: Timestamp.now() }));
  await assertFails(getDoc(doc(as('carol'), 'conversations/c1')));
});
test('conversation: member read is allowed', async () => {
  await seed((db) => setDoc(doc(db, 'conversations/c1'),
    { participants: ['alice', ADMIN], kind: 'admin', state: 'open', createdAt: Timestamp.now() }));
  await assertSucceeds(getDoc(doc(as('alice'), 'conversations/c1')));
});
test('message: HOSTILE non-member sending a message is DENIED (H4)', async () => {
  await seed((db) => setDoc(doc(db, 'conversations/c1'),
    { participants: ['alice', ADMIN], kind: 'admin', state: 'open', createdAt: Timestamp.now() }));
  await assertFails(setDoc(doc(as('carol'), 'conversations/c1/messages/m1'),
    { senderUid: 'carol', text: 'intrude', createdAt: serverTimestamp() }));
});

// ---------------- PROFILES (M1, M2) ----------------
test('profile: happy owner sets name + bio', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', bio: 'hi', joinedAt: serverTimestamp() }));
});
test('profile: HOSTILE owner setting isAdmin is DENIED (M1)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', isAdmin: true }));
});
test('profile: HOSTILE reserved display name "Blake" is DENIED (M1)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), { displayName: 'Blake' }));
});
test('profile: HOSTILE arbitrary external photoURL is DENIED (M2)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', photoURL: 'https://evil.example.com/track.png' }));
});

// ---------------- SUGGESTIONCOUNTS (CF-only, admin-read) ----------------
test('suggestionCounts: HOSTILE client write is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'suggestionCounts/101922'), { count: 9999 }));
});
test('suggestionCounts: HOSTILE non-admin read is DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'suggestionCounts/101922'), { count: 3, status: 'new' }));
  await assertFails(getDoc(doc(as('alice'), 'suggestionCounts/101922')));
});
test('suggestionCounts: admin read is allowed', async () => {
  await seed((db) => setDoc(doc(db, 'suggestionCounts/101922'), { count: 3, status: 'new' }));
  await assertSucceeds(getDoc(doc(as(ADMIN), 'suggestionCounts/101922')));
});

// ---------------- REPORTS (signed-in create, admin-read) ----------------
test('report: happy create with own reporterUid', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'reports/r1'),
    { reporterUid: 'alice', reason: 'spam', status: 'new', targetType: 'comment', targetPath: 'comments/x/items/y', createdAt: serverTimestamp() }));
});
test('report: HOSTILE forged reporterUid is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'reports/r2'),
    { reporterUid: 'mallory', reason: 'spam', status: 'new', targetType: 'comment', targetPath: 'x', createdAt: serverTimestamp() }));
});
test('report: HOSTILE non-admin reading the queue is DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'reports/r1'),
    { reporterUid: 'alice', reason: 'spam', status: 'new', targetType: 'comment', targetPath: 'x', createdAt: Timestamp.now() }));
  await assertFails(getDoc(doc(as('bob'), 'reports/r1')));
});

// ---------------- SUGGESTIONS (Q2 submitterUid) ----------------
test('suggestion: happy anonymous create', async () => {
  await assertSucceeds(setDoc(doc(anon(), 'suggestions/s1'),
    { title: 'Frieren', status: 'new', submittedAt: serverTimestamp() }));
});
test('suggestion: happy create with own submitterUid (Q2)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'suggestions/s2'),
    { title: 'Vinland', status: 'new', submittedAt: serverTimestamp(), submitterUid: 'alice' }));
});
test('suggestion: HOSTILE forged submitterUid is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'suggestions/s3'),
    { title: 'Bleach', status: 'new', submittedAt: serverTimestamp(), submitterUid: 'bob' }));
});
