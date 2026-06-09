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
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp,
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

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));

// v1.10.0 gate 1: the standard actors are CONSENTED + not-banned (moderationGate
// doc with consentVersion >= the rules literal 1), so EVERY happy path below
// exercises the moderation gate's ALLOW side without changing the assertions. The
// DENY side (banned / un-consented / stale-consent / admin-bypass) is proven in the
// dedicated MODERATION GATE block at the bottom of this file.
const CONSENT_ROSTER = ['alice', 'bob', 'carol', 'mallory', 'victim'];
beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    for (const uid of CONSENT_ROSTER) {
      await setDoc(doc(db, 'moderationGate/' + uid), { banned: false, consentVersion: 1 });
    }
  });
});

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

// ---------------- REPLY VOTES (depth-1 reply vote pills, gate 4b) ----------------
test('reply vote: happy own vote', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'comments/demon-slayer/items/c1/replies/r1/votes/alice'),
    { value: 1, uid: 'alice', updatedAt: serverTimestamp() }));
});
test('reply vote: HOSTILE vote written for another uid is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'comments/demon-slayer/items/c1/replies/r1/votes/bob'),
    { value: 1, uid: 'bob', updatedAt: serverTimestamp() }));
});
test('reply vote: HOSTILE out-of-range value is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'comments/demon-slayer/items/c1/replies/r1/votes/alice'),
    { value: 5, uid: 'alice', updatedAt: serverTimestamp() }));
});

// ---------------- REVIEW + THREAD VOTES (gate 5 vote-model migration) ----------------
test('review vote: happy own vote (new model — client writes only its vote doc)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'reviews/demon-slayer/items/bob/votes/alice'),
    { value: 1, uid: 'alice', updatedAt: serverTimestamp() }));
});
test('review: HOSTILE direct likesCount inflation (H1) is DENIED — counts are CF-owned', async () => {
  await seed((db) => setDoc(doc(db, 'reviews/demon-slayer/items/bob'),
    { uid: 'bob', title: 'T', body: 'b', rating: 8, displayName: 'B', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), likesCount: 0, dislikesCount: 0 }));
  // not even the review OWNER may write the count directly anymore:
  await assertFails(updateDoc(doc(as('bob'), 'reviews/demon-slayer/items/bob'), { likesCount: 999999 }));
  await assertFails(updateDoc(doc(as('alice'), 'reviews/demon-slayer/items/bob'), { likesCount: 999999 }));
});
test('thread vote: happy own vote', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'reviews/demon-slayer/items/bob/threads/t1/votes/alice'),
    { value: -1, uid: 'alice', updatedAt: serverTimestamp() }));
});
test('thread vote: HOSTILE vote written for another uid is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'reviews/demon-slayer/items/bob/threads/t1/votes/mallory'),
    { value: 1, uid: 'mallory', updatedAt: serverTimestamp() }));
});

// ---------------- OFFICIAL (Blake's-rating agreement) VOTES (gate 6 migration) ----------------
test('official vote: happy own vote (new model)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'official/demon-slayer/votes/alice'),
    { value: 1, uid: 'alice', updatedAt: serverTimestamp() }));
});
test('official: HOSTILE direct aggregate count write is DENIED (CF-owned)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'official/demon-slayer'),
    { likesCount: 999999, dislikesCount: 0 }));
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
test('forum: anime-tagged thread (anime:<slug>) create is ALLOWED (v1.10.0 verdict-rail blend)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tAnime'), thread({ tag: 'anime:one-punch-man' })));
});
test('forum: HOSTILE malformed anime tag (uppercase + spaces) is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'forum/tBadTag'), thread({ tag: 'anime:One Punch Man' })));
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
test('forum: new topic tags hottake/music/animation create is ALLOWED (gate 8c)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tHot'), thread({ tag: 'hottake' })));
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tMusic'), thread({ tag: 'music' })));
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tAnim'), thread({ tag: 'animation' })));
});
test('forum: gate-8d wide topics (episode/theories/news/manga/cosplay) create is ALLOWED', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tEp'), thread({ tag: 'episode' })));
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tTh'), thread({ tag: 'theories' })));
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tNews'), thread({ tag: 'news' })));
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tManga'), thread({ tag: 'manga' })));
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tCos'), thread({ tag: 'cosplay' })));
});
test('forum: anime:al:<id> tag (non-44 AniList attach) create is ALLOWED + cover fields pass; HOSTILE malformed al tag DENIED', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tAl'), thread({ tag: 'anime:al:16498', animeTitle: 'Attack on Titan', coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/x.jpg' })));
  await assertFails(setDoc(doc(as('alice'), 'forum/tAlBad'), thread({ tag: 'anime:al:notanumber' })));
});
test('forum: HOSTILE unknown thread tag is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'forum/tBadEnum'), thread({ tag: 'spam-tag' })));
});
test("forum post: admin may set Blake's pick (gate 8c gold marker)", async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'forum/t1'), { ...thread(), createdAt: Timestamp.now(), lastPostAt: Timestamp.now() });
    await setDoc(doc(db, 'forum/t1/posts/p1'), { authorUid: 'alice', body: 'hi', createdAt: Timestamp.now(), likesCount: 0, reportCount: 0, removed: false });
  });
  await assertSucceeds(updateDoc(doc(as(ADMIN), 'forum/t1/posts/p1'), { blakePick: true }));
});
test("forum post: HOSTILE owner setting Blake's pick is DENIED (admin-only)", async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'forum/t1'), { ...thread(), createdAt: Timestamp.now(), lastPostAt: Timestamp.now() });
    await setDoc(doc(db, 'forum/t1/posts/p1'), { authorUid: 'alice', body: 'hi', createdAt: Timestamp.now(), likesCount: 0, reportCount: 0, removed: false });
  });
  await assertFails(updateDoc(doc(as('alice'), 'forum/t1/posts/p1'), { blakePick: true }));
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

// ---------------- GATE 4: comment pin (admin) + thread lock ----------------
test('comment: HOSTILE self-pin at create is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'comments/demon-slayer/items/cp'),
    { uid: 'alice', text: 'pin me', displayName: 'A', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0, pinned: true }));
});
test('comment: admin may pin a comment', async () => {
  await seed((db) => setDoc(doc(db, 'comments/demon-slayer/items/c1'),
    { uid: 'alice', text: 'hi', displayName: 'A', createdAt: Timestamp.now(), likesCount: 0, dislikesCount: 0, pinned: false }));
  await assertSucceeds(updateDoc(doc(as(ADMIN), 'comments/demon-slayer/items/c1'), { pinned: true }));
});
test('comment: HOSTILE non-admin pinning is DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'comments/demon-slayer/items/c1'),
    { uid: 'alice', text: 'hi', displayName: 'A', createdAt: Timestamp.now(), likesCount: 0, dislikesCount: 0, pinned: false }));
  await assertFails(updateDoc(doc(as('alice'), 'comments/demon-slayer/items/c1'), { pinned: true }));
});
test('commentsMeta: admin may lock a thread; public reads it; non-admin cannot write', async () => {
  await assertSucceeds(setDoc(doc(as(ADMIN), 'commentsMeta/demon-slayer'), { locked: true }));
  await assertSucceeds(getDoc(doc(anon(), 'commentsMeta/demon-slayer')));
  await assertFails(setDoc(doc(as('alice'), 'commentsMeta/demon-slayer'), { locked: false }));
});
test('a LOCKED thread blocks comment + reply create server-side; unlocked allows', async () => {
  await seed((db) => setDoc(doc(db, 'commentsMeta/locked-anime'), { locked: true }));
  await assertFails(setDoc(doc(as('alice'), 'comments/locked-anime/items/c1'),
    { uid: 'alice', text: 'sneak', displayName: 'A', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  await seed((db) => setDoc(doc(db, 'comments/locked-anime/items/parent'),
    { uid: 'bob', text: 'hi', displayName: 'B', createdAt: Timestamp.now(), likesCount: 0, dislikesCount: 0 }));
  await assertFails(setDoc(doc(as('alice'), 'comments/locked-anime/items/parent/replies/r1'),
    { uid: 'alice', text: 'sneak reply', displayName: 'A', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  // an open thread (no commentsMeta doc) still allows posting
  await assertSucceeds(setDoc(doc(as('alice'), 'comments/open-anime/items/c1'),
    { uid: 'alice', text: 'hello', displayName: 'A', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
});

// ============================================================================
// v1.10.0 GATE 1 — the MODERATION GATE (ban + community-rules consent).
// gateOk() = isAdmin() || (notBanned() && hasConsented()); reportGateOk() =
// isAdmin() || notBanned(). moderationGate/{uid} is CF-only; the roster is seeded
// consented in beforeEach. These prove the DENY side + the explicit ALLOW edges.
// ============================================================================
const gate = (db, uid, over = {}) => setDoc(doc(db, 'moderationGate/' + uid), { banned: false, consentVersion: 1, ...over });

test('gate: un-consented user (no moderationGate doc) is DENIED every community write path', async () => {
  await assertFails(setDoc(doc(as('newbie'), 'comments/x/items/c1'),
    { uid: 'newbie', text: 'hi', displayName: 'N', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  await assertFails(setDoc(doc(as('newbie'), 'forum/t1'), thread({ authorUid: 'newbie' })));
  await assertFails(setDoc(doc(as('newbie'), 'reviews/x/items/newbie'),
    { uid: 'newbie', title: 'T', body: 'b', rating: 8, displayName: 'N', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  await assertFails(setDoc(doc(as('newbie'), 'comments/x/items/c1/votes/newbie'),
    { value: 1, uid: 'newbie', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('newbie'), 'profiles/newbie'),
    { displayName: 'Newbie', joinedAt: serverTimestamp() }));
});

test('gate: a CONSENTED user is allowed (explicit ALLOW edge)', async () => {
  await seed((db) => gate(db, 'carl'));
  await assertSucceeds(setDoc(doc(as('carl'), 'comments/x/items/c1'),
    { uid: 'carl', text: 'consented', displayName: 'Carl', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
});

test('gate: STALE consent (version < CURRENT_RULES_VERSION) is DENIED until re-consent', async () => {
  await seed((db) => gate(db, 'sam', { consentVersion: 0 }));
  await assertFails(setDoc(doc(as('sam'), 'comments/x/items/c1'),
    { uid: 'sam', text: 'old consent', displayName: 'Sam', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
});

test('gate: a BANNED user is DENIED every community write path', async () => {
  await seed((db) => gate(db, 'badguy', { banned: true }));
  await assertFails(setDoc(doc(as('badguy'), 'comments/x/items/c1'),
    { uid: 'badguy', text: 'spam', displayName: 'B', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  await assertFails(setDoc(doc(as('badguy'), 'forum/t1'), thread({ authorUid: 'badguy' })));
  await assertFails(setDoc(doc(as('badguy'), 'reviews/x/items/badguy'),
    { uid: 'badguy', title: 'T', body: 'b', rating: 8, displayName: 'B', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  await assertFails(setDoc(doc(as('badguy'), 'comments/x/items/c1/votes/badguy'),
    { value: 1, uid: 'badguy', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('badguy'), 'profiles/badguy'),
    { displayName: 'Badguy', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('badguy'), 'conversations/c_bad_admin'),
    { participants: ['badguy', ADMIN], kind: 'admin', state: 'open', createdAt: serverTimestamp() }));
});

test('gate: a banned user may still UNVOTE (delete their vote — unvote is ungated)', async () => {
  await seed(async (db) => {
    await gate(db, 'voter', { banned: true });
    await setDoc(doc(db, 'comments/x/items/c1/votes/voter'), { value: 1, uid: 'voter', updatedAt: Timestamp.now() });
  });
  await assertSucceeds(deleteDoc(doc(as('voter'), 'comments/x/items/c1/votes/voter')));
});

test('gate: a banned user cannot EDIT their existing forum thread (update is gated)', async () => {
  await seed(async (db) => {
    await gate(db, 'author', { banned: true });
    await setDoc(doc(db, 'forum/t1'), { ...thread({ authorUid: 'author' }), createdAt: Timestamp.now(), lastPostAt: Timestamp.now() });
  });
  await assertFails(updateDoc(doc(as('author'), 'forum/t1'), { body: 'edited while banned', editedAt: serverTimestamp() }));
});

test('gate: a banned participant cannot SEND a DM message (message-create is gated)', async () => {
  await seed(async (db) => {
    await gate(db, 'banned-dm', { banned: true });
    await setDoc(doc(db, 'conversations/c_bdm'), { participants: ['banned-dm', ADMIN], kind: 'admin', state: 'open', createdAt: Timestamp.now() });
  });
  await assertFails(setDoc(doc(as('banned-dm'), 'conversations/c_bdm/messages/m1'),
    { senderUid: 'banned-dm', text: 'hi', createdAt: serverTimestamp() }));
});

test('gate: REPORTS are ban-gated but NOT consent-gated', async () => {
  // an un-consented user (no moderationGate doc) CAN report — reporting is frictionless:
  await assertSucceeds(setDoc(doc(as('reporter-new'), 'reports/r_new'),
    { reporterUid: 'reporter-new', reason: 'harassment', status: 'new', targetType: 'comment', targetPath: 'comments/x/items/y', createdAt: serverTimestamp() }));
  // a BANNED user CANNOT report:
  await seed((db) => gate(db, 'banned-reporter', { banned: true }));
  await assertFails(setDoc(doc(as('banned-reporter'), 'reports/r_ban'),
    { reporterUid: 'banned-reporter', reason: 'spam', status: 'new', targetType: 'comment', targetPath: 'comments/x/items/y', createdAt: serverTimestamp() }));
});

test('gate: ADMIN bypasses the gate (no moderationGate doc needed)', async () => {
  await assertSucceeds(setDoc(doc(as(ADMIN), 'comments/x/items/cAdmin'),
    { uid: ADMIN, text: 'from blake', displayName: 'Blake', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  await assertSucceeds(setDoc(doc(as(ADMIN), 'forum/tAdmin'), thread({ authorUid: ADMIN })));
});

test('gate: moderationGate / banned / rulesConsent are CF-only (client write DENIED; owner read OK)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'moderationGate/alice'), { banned: false, consentVersion: 1 }));
  await assertFails(setDoc(doc(as('alice'), 'banned/alice'), { by: 'self' }));
  await assertFails(setDoc(doc(as('alice'), 'rulesConsent/alice'), { version: 99 }));
  // a banned user cannot self-clear their gate doc:
  await seed((db) => gate(db, 'sneaky', { banned: true }));
  await assertFails(updateDoc(doc(as('sneaky'), 'moderationGate/sneaky'), { banned: false }));
  // but the owner may READ their own gate doc (to drive the consent UI):
  await seed((db) => gate(db, 'reader'));
  await assertSucceeds(getDoc(doc(as('reader'), 'moderationGate/reader')));
});

test('gate: a banned user is ALSO denied replies, review-threads, forum posts, and post-votes (every gateOk() path)', async () => {
  await seed(async (db) => {
    await gate(db, 'badguy2', { banned: true });
    await setDoc(doc(db, 'comments/x/items/parent'), { uid: 'alice', text: 'p', displayName: 'A', createdAt: Timestamp.now(), likesCount: 0, dislikesCount: 0 });
    await setDoc(doc(db, 'reviews/x/items/rev'), { uid: 'alice', title: 'T', body: 'b', rating: 8, displayName: 'A', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), likesCount: 0, dislikesCount: 0 });
    await setDoc(doc(db, 'forum/tparent'), { authorUid: 'alice', title: 'Hi', body: 'h', tag: 'general', createdAt: Timestamp.now(), lastPostAt: Timestamp.now(), postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false });
  });
  await assertFails(setDoc(doc(as('badguy2'), 'comments/x/items/parent/replies/r1'),
    { uid: 'badguy2', text: 'reply', displayName: 'B', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  await assertFails(setDoc(doc(as('badguy2'), 'reviews/x/items/rev/threads/t1'),
    { uid: 'badguy2', text: 'thread', displayName: 'B', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 }));
  await assertFails(setDoc(doc(as('badguy2'), 'forum/tparent/posts/p1'),
    { authorUid: 'badguy2', body: 'post', createdAt: serverTimestamp(), likesCount: 0, reportCount: 0, removed: false }));
  await assertFails(setDoc(doc(as('badguy2'), 'forum/tparent/posts/p1/votes/badguy2'),
    { value: 1, uid: 'badguy2', updatedAt: serverTimestamp() }));
});

// ---------------- GATE 13/14 — forum image attachments (imageRefs) ----------------
// Storage-side enforcement lives in storage.spec.js; THESE prove the Firestore
// pointer side: ≤4 refs, every entry pinned to the caller's own uploads/ prefix.
const post = (over = {}) => ({
  authorUid: 'alice', body: 'a post', createdAt: serverTimestamp(),
  likesCount: 0, reportCount: 0, removed: false, ...over,
});
const seedThread = (id = 'tImg') => seed((db) => setDoc(doc(db, 'forum/' + id), {
  authorUid: 'alice', title: 'Hi', body: 'h', tag: 'general',
  createdAt: Timestamp.now(), lastPostAt: Timestamp.now(),
  postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false,
}));

test('imageRefs: happy thread create with own-prefix refs (≤4)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tImg1'),
    thread({ imageRefs: ['uploads/alice/tImg1/a1', 'uploads/alice/tImg1/a2'] })));
});
test('imageRefs: HOSTILE thread create pointing at ANOTHER user\'s upload is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'forum/tImg2'),
    thread({ imageRefs: ['uploads/bob/t/x'] })));
});
test('imageRefs: HOSTILE >4 refs is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'forum/tImg3'),
    thread({ imageRefs: ['uploads/alice/t/1', 'uploads/alice/t/2', 'uploads/alice/t/3', 'uploads/alice/t/4', 'uploads/alice/t/5'] })));
});
test('imageRefs: HOSTILE non-uploads / clever paths are DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'forum/tImg4'), thread({ imageRefs: ['https://evil.example/x.png'] })));
  await assertFails(setDoc(doc(as('alice'), 'forum/tImg5'), thread({ imageRefs: ['uploads/alice/../escape/x'] })));
  await assertFails(setDoc(doc(as('alice'), 'forum/tImg6'), thread({ imageRefs: [42] })));
});
test('imageRefs: happy post create with own-prefix ref; HOSTILE other-prefix DENIED', async () => {
  await seedThread('tImg7');
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tImg7/posts/p1'), post({ imageRefs: ['uploads/alice/p1/img'] })));
  await assertFails(setDoc(doc(as('bob'), 'forum/tImg7/posts/p2'),
    post({ authorUid: 'bob', imageRefs: ['uploads/alice/p1/img'] })));
});
test('imageRefs: owner may STRIP refs on edit; may NOT mint a foreign ref on edit', async () => {
  await seedThread('tImg8');
  await seed((db) => setDoc(doc(db, 'forum/tImg8/posts/p1'), {
    authorUid: 'alice', body: 'b', createdAt: Timestamp.now(),
    likesCount: 0, reportCount: 0, removed: false, imageRefs: ['uploads/alice/p1/img'],
  }));
  await assertFails(updateDoc(doc(as('alice'), 'forum/tImg8/posts/p1'), { imageRefs: ['uploads/bob/p/x'] }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'forum/tImg8/posts/p1'), { imageRefs: [] }));
});
test('imageRefs: ADMIN may strip a (foreign-author) ref during moderation', async () => {
  await seedThread('tImg9');
  await seed((db) => setDoc(doc(db, 'forum/tImg9/posts/p1'), {
    authorUid: 'alice', body: 'b', createdAt: Timestamp.now(),
    likesCount: 0, reportCount: 0, removed: false, imageRefs: ['uploads/alice/p1/img'],
  }));
  await assertSucceeds(updateDoc(doc(as(ADMIN), 'forum/tImg9/posts/p1'), { imageRefs: [] }));
});

// ---------------- GATE 14 — the 'image' report target ----------------
test('report: happy image report (targetType image + pinned imagePath shape)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'reports/r-img-1'), {
    reporterUid: 'alice', reason: 'other', status: 'new',
    targetType: 'image', targetPath: 'forum/t1/posts/p1',
    imagePath: 'uploads/bob/p1/img1', createdAt: serverTimestamp(),
  }));
});
test('report: HOSTILE image report with a malformed imagePath is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'reports/r-img-2'), {
    reporterUid: 'alice', reason: 'other', status: 'new',
    targetType: 'image', targetPath: 'forum/t1/posts/p1',
    imagePath: 'https://evil.example/x', createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(as('alice'), 'reports/r-img-3'), {
    reporterUid: 'alice', reason: 'other', status: 'new',
    targetType: 'image', targetPath: 'forum/t1/posts/p1',
    imagePath: 'uploads/x/../../secrets', createdAt: serverTimestamp(),
  }));
});
