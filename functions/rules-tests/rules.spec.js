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
// v1.10.2 (the Creator sheet) — the denylist stops IMPERSONATION; the real
// Blake is exempt on his OWN doc (profiles writes stay owner-gated).
test('profile: the ADMIN may use his own reserved name on HIS doc (v1.10.2 Creator)', async () => {
  await assertSucceeds(setDoc(doc(as(ADMIN), 'profiles/' + ADMIN), { displayName: 'Blake', joinedAt: serverTimestamp() }));
});
test('profile: HOSTILE member named "blake" (case-folded) stays DENIED post-carve-out', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), { displayName: 'bLaKe' }));
});
test('profile: HOSTILE arbitrary external photoURL is DENIED (M2)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', photoURL: 'https://evil.example.com/track.png' }));
});
// gate 20.7 (Blake item 2) — the practice Storage emulator's getDownloadURL
// origin is allowed so sandbox avatar saves work (the loosening is exactly one
// origin, host + port pinned). Prod inertness = the client safeAvatar hostname
// gates + the viewer-loopback target (NOT mixed-content blocking — browsers
// exempt loopback); every new photoURL render sink must use safeAvatar.
test('profile: the practice-emulator photoURL origin is ALLOWED (gate 20.7)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', photoURL: 'http://127.0.0.1:9199/v0/b/demo/o/avatars%2Falice%2Fprofile.jpg?alt=media' }));
});
test('profile: HOSTILE near-miss localhost origins stay DENIED (gate 20.7)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', photoURL: 'http://localhost:9199/v0/b/x' }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', photoURL: 'http://127.0.0.1:9999/v0/b/x' }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', photoURL: 'https://evil.example.com/http://127.0.0.1:9199/x' }));
});

// ---------------- SUGGESTIONCOUNTS (CF-only writes; gate 20: public GET) ----
test('suggestionCounts: HOSTILE client write is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'suggestionCounts/101922'), { count: 9999 }));
});
// gate 20 — the contract FLIPPED for the "👁 N requested" chip: single-doc GET
// is public now (this test used to assert the opposite); enumeration (LIST)
// stays admin-only — the dedicated gate-20 tests at the bottom pin both sides.
test('suggestionCounts: non-admin single-doc GET is allowed (the requested chip)', async () => {
  await seed((db) => setDoc(doc(db, 'suggestionCounts/101922'), { count: 3, status: 'new' }));
  await assertSucceeds(getDoc(doc(as('alice'), 'suggestionCounts/101922')));
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
// milestone B — the info-request kind
test('suggestion B: kind info/anime allowed; a bogus kind DENIED', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'suggestions/sk1'),
    { title: 'PLUTO', status: 'new', submittedAt: serverTimestamp(), submitterUid: 'alice', kind: 'info' }));
  await assertSucceeds(setDoc(doc(anon(), 'suggestions/sk2'),
    { title: 'Monster', status: 'new', submittedAt: serverTimestamp(), kind: 'anime' }));
  await assertFails(setDoc(doc(anon(), 'suggestions/sk3'),
    { title: 'x', status: 'new', submittedAt: serverTimestamp(), kind: 'malware' }));
});

// ---------------- MILESTONE B: the curator panel ----------------
test('curator: animeStatus is PUBLIC-readable; only admin writes a valid status', async () => {
  await seed((db) => setDoc(doc(db, 'animeStatus/one-punch-man'), { status: 'watching', updatedAt: Timestamp.now() }));
  await assertSucceeds(getDoc(doc(anon(), 'animeStatus/one-punch-man')));          // dresses cards for everyone
  await assertSucceeds(setDoc(doc(as(ADMIN), 'animeStatus/frieren'), { status: 'rewatching', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('alice'), 'animeStatus/frieren'), { status: 'watching', updatedAt: serverTimestamp() }));   // members can't set
  await assertFails(setDoc(doc(as(ADMIN), 'animeStatus/bad'), { status: 'binging', updatedAt: serverTimestamp() }));          // enum pinned
  await assertSucceeds(deleteDoc(doc(as(ADMIN), 'animeStatus/one-punch-man')));    // admin may clear
});
test('curator: curatorNotes are PRIVATE — admin-only read AND write', async () => {
  await seed((db) => setDoc(doc(db, 'curatorNotes/one-punch-man'), { note: 'saving S3 for a rewatch', updatedAt: Timestamp.now() }));
  await assertFails(getDoc(doc(as('alice'), 'curatorNotes/one-punch-man')));       // a member's client never sees a note
  await assertFails(getDoc(doc(anon(), 'curatorNotes/one-punch-man')));
  await assertSucceeds(getDoc(doc(as(ADMIN), 'curatorNotes/one-punch-man')));
  await assertSucceeds(setDoc(doc(as(ADMIN), 'curatorNotes/frieren'), { note: 'the goodbye arc', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('alice'), 'curatorNotes/frieren'), { note: 'hi', updatedAt: serverTimestamp() }));
});

// ---------------- MILESTONE F: the Curator Studio ----------------
test('studio: an al:-keyed status carries its title; members still can\'t write; titles are capped', async () => {
  // tracking ANY anime — the al:<id> key + the title the Den line resolves
  await assertSucceeds(setDoc(doc(as(ADMIN), 'animeStatus/al:12345'),
    { status: 'watching', title: 'Some New Season', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('alice'), 'animeStatus/al:12345'),
    { status: 'watching', title: 'Hostile', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as(ADMIN), 'animeStatus/al:99'),
    { status: 'watching', title: 'x'.repeat(121), updatedAt: serverTimestamp() }));   // the 120 cap
  // the tracked doc stays world-readable like every status (title is not a secret)
  await assertSucceeds(getDoc(doc(anon(), 'animeStatus/al:12345')));
});
test('studio: the richer notes shape saves for the admin ONLY — and stays private', async () => {
  const rich = {
    note: 'quick take',
    notesMd: '## Animation\nGorgeous.\n\n## Overall\nWatching weekly.',
    seasons: { 'al:12345': 'S1 — strong start.' },
    title: 'Some New Season',
    updatedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(as(ADMIN), 'curatorNotes/al:12345'), rich));
  await assertFails(setDoc(doc(as('alice'), 'curatorNotes/al:12345'), rich));
  await assertFails(getDoc(doc(as('alice'), 'curatorNotes/al:12345')));            // private, always
  await assertFails(getDoc(doc(anon(), 'curatorNotes/al:12345')));
  // unknown fields still bounce (hasOnly holds)
  await assertFails(setDoc(doc(as(ADMIN), 'curatorNotes/al:777'),
    { notesMd: 'x', smuggled: true, updatedAt: serverTimestamp() }));
  // the legacy Milestone-B shape keeps working untouched
  await assertSucceeds(setDoc(doc(as(ADMIN), 'curatorNotes/one-punch-man'),
    { note: 'still the quick note', updatedAt: serverTimestamp() }));
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

// -------- IMAGE OVERHAUL — imageRefs on comments / replies / reviews + the
// thread thumbnail + the dedupe registry (rules parity with forum posts) --------
test('overhaul: comment + reply create with OWN-prefix imageRefs; foreign prefix DENIED', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'comments/demon-slayer/items/ci1'),
    { uid: 'alice', text: 'see panel', displayName: 'A', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0,
      imageRefs: ['uploads/alice/ci1/a'] }));
  await assertFails(setDoc(doc(as('alice'), 'comments/demon-slayer/items/ci2'),
    { uid: 'alice', text: 'x', displayName: 'A', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0,
      imageRefs: ['uploads/bob/x/y'] }));
  await assertSucceeds(setDoc(doc(as('bob'), 'comments/demon-slayer/items/ci1/replies/ri1'),
    { uid: 'bob', text: 'counter-panel', displayName: 'B', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0,
      imageRefs: ['uploads/bob/ri1/a'] }));
  await assertFails(setDoc(doc(as('bob'), 'comments/demon-slayer/items/ci1/replies/ri2'),
    { uid: 'bob', text: 'x', displayName: 'B', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0,
      imageRefs: ['uploads/alice/ci1/a'] }));
});
test('overhaul: UPDATE cannot mint a foreign ref or >4 refs on comments/reviews (merged-array net)', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'comments/demon-slayer/items/cu1'),
      { uid: 'alice', text: 'hi', displayName: 'A', createdAt: Timestamp.now(), likesCount: 0, dislikesCount: 0,
        imageRefs: ['uploads/alice/cu1/a'] });
    await setDoc(doc(db, 'reviews/al:101922/items/carol'),
      { uid: 'carol', title: 'T', body: 'b', rating: 8, displayName: 'C', createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(), likesCount: 0, dislikesCount: 0 });
  });
  await assertFails(updateDoc(doc(as('alice'), 'comments/demon-slayer/items/cu1'),
    { imageRefs: ['uploads/bob/x/y'] }));                                       // foreign mint on update
  await assertFails(updateDoc(doc(as('carol'), 'reviews/al:101922/items/carol'),
    { imageRefs: ['uploads/carol/r/1', 'uploads/carol/r/2', 'uploads/carol/r/3', 'uploads/carol/r/4', 'uploads/carol/r/5'],
      updatedAt: serverTimestamp() }));                                          // >4 on update
});
test('overhaul: review create with OWN-prefix imageRefs; foreign DENIED; owner may strip on edit', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'reviews/al:101922/items/alice'),
    { uid: 'alice', title: 'T', body: 'b [img:1]', rating: 8, displayName: 'A', createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(), likesCount: 0, dislikesCount: 0, imageRefs: ['uploads/alice/rev-al-101922/a'] }));
  await assertFails(setDoc(doc(as('bob'), 'reviews/al:101922/items/bob'),
    { uid: 'bob', title: 'T', body: 'b', rating: 7, displayName: 'B', createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(), likesCount: 0, dislikesCount: 0, imageRefs: ['uploads/alice/rev-al-101922/a'] }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'reviews/al:101922/items/alice'),
    { imageRefs: [], updatedAt: serverTimestamp() }));
});
test('mega-A4: review COVER (thumbImage) — own-prefix happy; foreign-prefix HOSTILE DENIED', async () => {
  await assertSucceeds(setDoc(doc(as('bob'), 'reviews/one-punch-man/items/bob'),
    { uid: 'bob', title: 'T', body: 'b', rating: 9, displayName: 'B', createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(), likesCount: 0, dislikesCount: 0,
      imageRefs: ['uploads/bob/rev-one-punch-man/c1'], thumbImage: 'uploads/bob/rev-one-punch-man/c1' }));
  await assertFails(setDoc(doc(as('carol'), 'reviews/one-punch-man/items/carol'),
    { uid: 'carol', title: 'T', body: 'b', rating: 9, displayName: 'C', createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(), likesCount: 0, dislikesCount: 0,
      thumbImage: 'uploads/bob/rev-one-punch-man/c1' }));
});
test('overhaul: thread thumbImage — own-prefix happy; foreign-prefix HOSTILE DENIED', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'forum/tThumb1'),
    thread({ imageRefs: ['uploads/alice/tThumb1/a'], thumbImage: 'uploads/alice/tThumb1/a' })));
  await assertFails(setDoc(doc(as('alice'), 'forum/tThumb2'),
    thread({ thumbImage: 'uploads/bob/x/y' })));
  await assertFails(setDoc(doc(as('alice'), 'forum/tThumb3'),
    thread({ thumbImage: 'https://evil.example/x.png' })));
});
test('overhaul: ADMIN pin toggle on a thumbed thread still works (shape-only regression)', async () => {
  await seed((db) => setDoc(doc(db, 'forum/tThumb4'), {
    authorUid: 'alice', title: 'Hi', body: 'h', tag: 'general',
    createdAt: Timestamp.now(), lastPostAt: Timestamp.now(),
    postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false,
    thumbImage: 'uploads/alice/tThumb4/a', imageRefs: ['uploads/alice/tThumb4/a'],
  }));
  // the merged doc carries ALICE's prefix — the admin branch must not trip on it
  await assertSucceeds(updateDoc(doc(as(ADMIN), 'forum/tThumb4'), { pinned: true }));
});
test('overhaul: uploadHashes — owner reads own entry; foreign read + any client write DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'uploadHashes/alice__abc123'), { uid: 'alice', hash: 'abc123', path: 'uploads/alice/t/a' }));
  await assertSucceeds(getDoc(doc(as('alice'), 'uploadHashes/alice__abc123')));
  await assertFails(getDoc(doc(as('mallory'), 'uploadHashes/alice__abc123')));
  await assertFails(setDoc(doc(as('alice'), 'uploadHashes/alice__zzz'), { uid: 'alice', hash: 'zzz', path: 'x' }));
});

// -------- GATE 16 → DREAM-PROFILE — public-activity collection groups.
// items went public at gate 16; the dream-profile activity-by-type feed
// widened threads/replies/posts on the same argument (every doc is already
// individually public in context — only the cross-context query is new) --------
const { collectionGroup, getDocs, query, where } = require('firebase/firestore');
test('activity CGs: items/threads/replies/posts queries are PUBLIC (the by-type feed)', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'reviews/al:101922/items/carol'),
      { uid: 'carol', title: 'T', body: 'b', rating: 8, displayName: 'C', createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(), likesCount: 0, dislikesCount: 0 });
    await setDoc(doc(db, 'reviews/al:101922/items/carol/threads/t1'),
      { uid: 'carol', text: 'x', displayName: 'C', createdAt: Timestamp.now(), likesCount: 0, dislikesCount: 0 });
  });
  // anyone (even signed-out) may run every activity-by-type query
  await assertSucceeds(getDocs(query(collectionGroup(anon(), 'items'), where('uid', '==', 'carol'))));
  await assertSucceeds(getDocs(query(collectionGroup(anon(), 'threads'), where('uid', '==', 'carol'))));
  await assertSucceeds(getDocs(query(collectionGroup(anon(), 'replies'), where('uid', '==', 'carol'))));
  await assertSucceeds(getDocs(query(collectionGroup(anon(), 'posts'), where('authorUid', '==', 'carol'))));
});
test('activity CGs: the votes CG is NOT widened (vote privacy holds)', async () => {
  await seed((db) => setDoc(doc(db, 'comments/x/items/c1/votes/carol'),
    { value: 1, uid: 'carol', updatedAt: Timestamp.now() }));
  await assertFails(getDocs(query(collectionGroup(as('mallory'), 'votes'), where('uid', '==', 'carol'))));
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

// ============================================================================
// DREAM-PROFILE GATE — profile customization fields, profile likes (the ONE
// sanctioned community count), the 'profile' report target.
// ============================================================================

// ---------------- profile customization fields ----------------
test('dream: happy full customization set (tags + accent + status + own bgRef + featuredAnime)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'), {
    displayName: 'Alice', bio: 'hi', joinedAt: serverTimestamp(),
    tags: ['Action', 'Sub', 'Binge-watcher'], accent: 'violet',
    status: 'rewatching Mob Psycho', bgRef: 'uploads/alice/profilebg/bg1',
    featuredAnime: 'al:101922',
  }));
});
test('dream: HOSTILE 7 tags is DENIED (list cap 6)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', tags: ['1', '2', '3', '4', '5', '6', '7'] }));
});
test('dream: HOSTILE non-list tags is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', tags: 'just-a-string' }));
});
test('dream: HOSTILE accent outside the curated palette is DENIED (gold cannot be dressed)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), { displayName: 'Alice', accent: 'gold' }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), { displayName: 'Alice', accent: '#ffd54a' }));
});
test('dream: HOSTILE 81-char status is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', status: 'x'.repeat(81) }));
});
test('dream: HOSTILE bgRef outside the caller own profilebg prefix is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', bgRef: 'uploads/mallory/profilebg/stolen' }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', bgRef: 'uploads/alice/somepost/img1' }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', bgRef: 'https://evil.example/bg.gif' }));
});
test('dream: HOSTILE featuredAnime with path characters is DENIED (charset pin)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', featuredAnime: 'reviews/x/items/y' }));
});
test('dream: HOSTILE client-written likesCount is DENIED (CF-owned count)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', likesCount: 9999 }));
  await seed((db) => setDoc(doc(db, 'profiles/alice'),
    { displayName: 'Alice', joinedAt: Timestamp.now(), likesCount: 2 }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { likesCount: 9999 }, { merge: true }));
});

// ---------------- profile likes (the heart carve-out) ----------------
const like = (uid) => ({ uid, value: 1, updatedAt: serverTimestamp() });
test('like: happy create on someone else profile', async () => {
  await assertSucceeds(setDoc(doc(as('bob'), 'profiles/alice/likes/bob'), like('bob')));
});
test('like: HOSTILE self-like is DENIED (no inflation)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice/likes/alice'), like('alice')));
});
// v1.10.2R — Blake's explicit call (2026-07-02: "I want my account to be
// appreicated.") REVERSED the old like-on-Blake denial: the carve-out now
// extends to his account like any member's. Self-like stays denied for him
// too (likerUid != uid — no inflation, same as everyone).
test('like: a member CAN appreciate BLAKE now (his 2026-07-02 call — the carve-out extends to him)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/' + ADMIN + '/likes/alice'), like('alice')));
});
test('like: HOSTILE — BLAKE self-liking his own profile stays DENIED (no inflation for anyone)', async () => {
  await assertFails(setDoc(doc(as(ADMIN), 'profiles/' + ADMIN + '/likes/' + ADMIN), like(ADMIN)));
});
test('like: HOSTILE non-1 values are DENIED (no dislikes on people, no weighting)', async () => {
  await assertFails(setDoc(doc(as('bob'), 'profiles/alice/likes/bob'),
    { uid: 'bob', value: -1, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('bob'), 'profiles/alice/likes/bob'),
    { uid: 'bob', value: 2, updatedAt: serverTimestamp() }));
});
test('like: HOSTILE forged uid / foreign doc id is DENIED', async () => {
  await assertFails(setDoc(doc(as('bob'), 'profiles/alice/likes/bob'),
    { uid: 'mallory', value: 1, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('bob'), 'profiles/alice/likes/carol'), like('carol')));
});
test('like: update is DENIED (unlike is delete, re-like is create)', async () => {
  await seed((db) => setDoc(doc(db, 'profiles/alice/likes/bob'),
    { uid: 'bob', value: 1, updatedAt: Timestamp.now() }));
  await assertFails(setDoc(doc(as('bob'), 'profiles/alice/likes/bob'), like('bob')));
});
test('like: banned create DENIED; banned UNLIKE still allowed (unvote stays ungated)', async () => {
  await seed(async (db) => {
    await gate(db, 'badguy', { banned: true });
    await setDoc(doc(db, 'profiles/alice/likes/badguy'), { uid: 'badguy', value: 1, updatedAt: Timestamp.now() });
  });
  await assertFails(setDoc(doc(as('badguy'), 'profiles/carol/likes/badguy'), like('badguy')));
  await assertSucceeds(deleteDoc(doc(as('badguy'), 'profiles/alice/likes/badguy')));
});
test('like: un-consented create is DENIED (the gate holds)', async () => {
  await assertFails(setDoc(doc(as('newbie'), 'profiles/alice/likes/newbie'), like('newbie')));
});
test('like: foreign get + any list are DENIED (only the CF-owned count is public)', async () => {
  await seed((db) => setDoc(doc(db, 'profiles/alice/likes/bob'),
    { uid: 'bob', value: 1, updatedAt: Timestamp.now() }));
  await assertFails(getDoc(doc(as('mallory'), 'profiles/alice/likes/bob')));
  await assertSucceeds(getDoc(doc(as('bob'), 'profiles/alice/likes/bob')));
  await assertFails(getDocs(query(collectionGroup(as('mallory'), 'likes'), where('uid', '==', 'bob'))));
});

// ---------------- the 'profile' report target ----------------
test('report: happy profile report (targetType profile, optional bg imagePath)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'reports/r-prof-1'), {
    reporterUid: 'alice', reason: 'other', status: 'new',
    targetType: 'profile', targetPath: 'profiles/mallory',
    imagePath: 'uploads/mallory/profilebg/bg1', createdAt: serverTimestamp(),
  }));
});

// ============================================================================
// ROUND 4 — PERSONAL COLLECTIONS (users/{uid}/collections) + the accent
// expansion. Private collections are watchlist-parity (owner-only, ungated);
// PUBLISHING (public:true) is the community surface and gates on gateOk().
// delete stays ungated (cleanup — the unvote precedent). Public read is
// get + a public==true-FILTERED list only.
// ============================================================================
const { collection } = require('firebase/firestore');
const col = (over = {}) => ({
  name: 'Shounen Starters', public: false, items: [],
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over,
});
// snapshot-row entry (saved-row pattern) — rules validate list+size only
const colItem = (i) => ({ animeId: 'a' + i, title: 'T', coverImage: 'c.jpg', format: 'TV', year: 2020 });

test('collections: happy owner creates a PRIVATE collection (with snapshot items)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/collections/colPriv1'),
    col({ items: [colItem(1), colItem(2)] })));
});
test('collections: owner creates a PUBLIC collection (consented roster user)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/collections/colPub1'),
    col({ public: true })));
});
test('collections: un-consented user may keep a PRIVATE collection but is DENIED publishing', async () => {
  // 'newbie' has no moderationGate doc — private is watchlist-parity (ungated):
  await assertSucceeds(setDoc(doc(as('newbie'), 'users/newbie/collections/colNew1'), col()));
  // ...but public:true is the community surface — the gate holds:
  await assertFails(setDoc(doc(as('newbie'), 'users/newbie/collections/colNew2'),
    col({ public: true })));
});
test('collections: HOSTILE create into someone else\'s collections is DENIED', async () => {
  await assertFails(setDoc(doc(as('mallory'), 'users/alice/collections/colHax1'), col()));
});
test('collections: HOSTILE non-owner get of a PRIVATE collection is DENIED', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice/collections/colPriv2'),
    { name: 'Hidden', public: false, items: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
  await assertFails(getDoc(doc(as('bob'), 'users/alice/collections/colPriv2')));
  await assertFails(getDoc(doc(anon(), 'users/alice/collections/colPriv2')));
});
test('collections: non-owner get of a PUBLIC collection is allowed', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice/collections/colPub2'),
    { name: 'Shared', public: true, items: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
  await assertSucceeds(getDoc(doc(as('bob'), 'users/alice/collections/colPub2')));
});
test('collections: non-owner list MUST filter public==true (unfiltered list DENIED; owner unfiltered OK)', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice/collections/colPub3'),
    { name: 'Shelf', public: true, items: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
  await assertSucceeds(getDocs(query(collection(as('bob'), 'users/alice/collections'), where('public', '==', true))));
  await assertFails(getDocs(collection(as('bob'), 'users/alice/collections')));
  await assertSucceeds(getDocs(collection(as('alice'), 'users/alice/collections')));
});
test('collections: flipping public→true without consent DENIED; consented flip OK; delete always allowed', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'users/newbie/collections/colFlip1'),
      { name: 'Mine', public: false, items: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await setDoc(doc(db, 'users/alice/collections/colFlip2'),
      { name: 'Hers', public: false, items: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await gate(db, 'badcol', { banned: true });
    await setDoc(doc(db, 'users/badcol/collections/colFlip3'),
      { name: 'His', public: false, items: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  });
  // un-consented owner cannot PUBLISH an existing collection:
  await assertFails(updateDoc(doc(as('newbie'), 'users/newbie/collections/colFlip1'),
    { public: true, updatedAt: serverTimestamp() }));
  // consented owner can:
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice/collections/colFlip2'),
    { public: true, updatedAt: serverTimestamp() }));
  // delete is ungated — un-consented AND banned owners may always clean up:
  await assertSucceeds(deleteDoc(doc(as('newbie'), 'users/newbie/collections/colFlip1')));
  await assertSucceeds(deleteDoc(doc(as('badcol'), 'users/badcol/collections/colFlip3')));
});

// ============================================================================
// LAST CALL A8 — SAVED SHELVES (users/{uid}/savedShelves): read-only pointers
// to OTHER members' public collections. Owner-only, ungated (watchlist
// parity); shape = pointer + name snapshot; saving your OWN shelf is refused.
// ============================================================================
const shelfRef = (over = {}) => ({
  ownerUid: 'alice', colId: 'colPub1', name: 'Shounen Starters',
  savedAt: serverTimestamp(), ...over,
});
test('savedShelves: owner saves another member\'s shelf pointer; foreign + anon writes DENIED', async () => {
  await assertSucceeds(setDoc(doc(as('bob'), 'users/bob/savedShelves/alice__colPub1'), shelfRef()));
  await assertFails(setDoc(doc(as('mallory'), 'users/bob/savedShelves/alice__colHax'), shelfRef()));
  await assertFails(setDoc(doc(anon(), 'users/bob/savedShelves/alice__colAnon'), shelfRef()));
});
test('savedShelves: shape holds — stray keys, oversize name, and SELF-pointers DENIED; unsave always works', async () => {
  await assertFails(setDoc(doc(as('bob'), 'users/bob/savedShelves/x1'), shelfRef({ extra: 'nope' })));
  await assertFails(setDoc(doc(as('bob'), 'users/bob/savedShelves/x2'), shelfRef({ name: 'n'.repeat(81) })));
  await assertFails(setDoc(doc(as('bob'), 'users/bob/savedShelves/x3'), shelfRef({ colId: 'bad id with spaces' })));
  // pointing at your OWN shelf is refused (it already lives in your Collections)
  await assertFails(setDoc(doc(as('bob'), 'users/bob/savedShelves/x4'), shelfRef({ ownerUid: 'bob' })));
  // reads are owner-only; unsave (delete) always works
  await seed((db) => setDoc(doc(db, 'users/bob/savedShelves/gone1'),
    { ownerUid: 'alice', colId: 'colX', name: 'Old', savedAt: Timestamp.now() }));
  await assertFails(getDoc(doc(as('mallory'), 'users/bob/savedShelves/gone1')));
  await assertSucceeds(deleteDoc(doc(as('bob'), 'users/bob/savedShelves/gone1')));
});
test('profiles: featuredShelf accepts an owner-set shelf id (or null); junk shapes DENIED', async () => {
  const prof = (over = {}) => ({ displayName: 'Alice', joinedAt: serverTimestamp(), ...over });
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'), prof({ featuredShelf: 'colPub1' })));
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'), prof({ featuredShelf: null })));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), prof({ featuredShelf: 'x'.repeat(41) })));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), prof({ featuredShelf: 'bad id!' })));
});
test('collections: HOSTILE 61-char name + unknown extra key are DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'users/alice/collections/colBad1'),
    col({ name: 'x'.repeat(61) })));
  await assertFails(setDoc(doc(as('alice'), 'users/alice/collections/colBad2'),
    col({ hax: true })));
});
test('collections: HOSTILE 201-entry items list is DENIED (cap 200)', async () => {
  const tooMany = Array.from({ length: 201 }, (_, i) => colItem(i));
  await assertFails(setDoc(doc(as('alice'), 'users/alice/collections/colBad3'),
    col({ items: tooMany })));
  // the cap itself (200) is allowed:
  await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/collections/colCap1'),
    col({ items: tooMany.slice(0, 200) })));
});
test('collections: ADMIN may read + delete a private collection (moderation); foreign user still cannot', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice/collections/colMod1'),
    { name: 'Reported', public: false, items: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
  await assertSucceeds(getDoc(doc(as(ADMIN), 'users/alice/collections/colMod1')));
  await assertFails(deleteDoc(doc(as('mallory'), 'users/alice/collections/colMod1')));
  await assertSucceeds(deleteDoc(doc(as(ADMIN), 'users/alice/collections/colMod1')));
});

// ---------------- round 4 — accent expansion + accentGlow ----------------
test('dream: expanded palette — gradient accent g-nebula accepted; gold STAYS denied', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', accent: 'g-nebula', joinedAt: serverTimestamp() }));
  // the heart rule holds across the expansion — no gold family, ever:
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', accent: 'gold', joinedAt: serverTimestamp() }));
});
test('dream: accentGlow bool accepted; HOSTILE string accentGlow is DENIED', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', accent: 'crimson', accentGlow: true, joinedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', accentGlow: 'yes', joinedAt: serverTimestamp() }));
});

// ---------------- gate 20 — optional collection description ----------------
test('collections: create WITH a 150-char description is allowed', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/collections/colDesc1'),
    col({ description: 'd'.repeat(150) })));
});
test('collections: HOSTILE 201-char description is DENIED (cap 200)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'users/alice/collections/colDesc2'),
    col({ description: 'd'.repeat(201) })));
});
test('collections: HOSTILE non-string description is DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'users/alice/collections/colDesc3'),
    col({ description: 12345 })));
});
test('collections: update ADDING a description to an existing doc is allowed', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice/collections/colDesc4'),
    { name: 'Plain', public: false, items: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice/collections/colDesc4'),
    { description: 'now with a blurb under the title', updatedAt: serverTimestamp() }));
});
test('collections: PUBLIC shelf WITH a description is readable by a non-owner', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice/collections/colDesc5'),
    { name: 'Shared Shelf', description: 'a public blurb under the title', public: true, items: [],
      createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
  await assertSucceeds(getDoc(doc(as('bob'), 'users/alice/collections/colDesc5')));
});

// gate 20 — the "👁 N requested" chip: public single-doc GET on
// suggestionCounts; LIST stays admin-only (no queue enumeration).
test('gate 20: anyone can GET one suggestionCounts doc (the requested chip)', async () => {
  await seed(async (db) => { await db.doc('suggestionCounts/al-20-chip').set({ count: 3, status: 'new' }); });
  await assertSucceeds(anon().doc('suggestionCounts/al-20-chip').get());
  await assertSucceeds(as('alice').doc('suggestionCounts/al-20-chip').get());
});
test('gate 20: non-admin LIST of suggestionCounts stays denied (anti-brigading)', async () => {
  await assertFails(as('alice').collection('suggestionCounts').get());
  await assertFails(anon().collection('suggestionCounts').get());
});

// ============================================================================
// GATE 20.5 — profile FRAME themes (item 9b) + users/{uid} email tightening.
// frame mirrors accent: a CURATED enum (12 user keys), PLUS 'blake' — Blake's
// EXCLUSIVE frame, valid only for the ADMIN uid. The exclusivity is
// RULES-enforced (proven here), not UI-hidden. And users/{uid} get flips
// PUBLIC → owner-or-admin: the doc carries email, and author-name reads are
// profiles-first now — the stranger fallback dies.
// ============================================================================
test('frame: owner sets frame "witch" (a user key) — allowed', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', frame: 'witch', joinedAt: serverTimestamp() }));
});
test('frame: HOSTILE non-enum "gold" and numeric 99 are DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', frame: 'gold', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', frame: 99, joinedAt: serverTimestamp() }));
});
test('frame: HOSTILE non-admin claiming "blake" is DENIED (the exclusivity)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'),
    { displayName: 'Alice', frame: 'blake', joinedAt: serverTimestamp() }));
});
test('frame: the ADMIN uid sets "blake" on his own profile — allowed', async () => {
  // displayName dodges the M1 denylist on purpose — 'blake' the NAME stays
  // reserved even for the admin; the FRAME is the sanctioned exclusive.
  await assertSucceeds(setDoc(doc(as(ADMIN), 'profiles/' + ADMIN),
    { displayName: 'Blake W', frame: 'blake', joinedAt: serverTimestamp() }));
});
test('frame: update ADDING frame to an existing profile is allowed', async () => {
  await seed((db) => setDoc(doc(db, 'profiles/alice'),
    { displayName: 'Alice', joinedAt: Timestamp.now() }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'profiles/alice'),
    { frame: 'sakura' }));
});

// milestone E — THE TIGHTENING LANDED (gate 20.5 banked it behind the profiles
// backfill; both enabler halves shipped in functions/lib/backfill.js: the
// one-shot admin callable for existing accounts + the users-onCreate mint for
// every future signup). users docs carry EMAILS: owner + admin only, forever.
test('users doc: get is OWNER + ADMIN only — the email field is private (the landed tightening)', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'),
    { email: 'alice@example.com', displayName: 'Alice' }));
  await assertSucceeds(getDoc(doc(as('alice'), 'users/alice')));
  await assertFails(getDoc(doc(as('bob'), 'users/alice')));      // a member can NOT read another's email
  await assertFails(getDoc(doc(anon(), 'users/alice')));         // nor can the world
  await assertSucceeds(getDoc(doc(as(ADMIN), 'users/alice')));   // the queues resolve identities
});

// ============================================================================
// ============================================================================
// MEGA-RUN GATE A1 — PEER-DM / GROUP-CHAT security layer.
// blocks/{blocker}/list/{blocked} (owner-only, ungated, unreadable by the
// blocked), kind=='peer' conversations (request/open/declined lifecycle,
// block checks both ways, no Blake), kind=='group' (solo birth, one-per-update
// membership, cap 15), message send gates by kind+state, and the DM image
// pointer (imgRef/imgThumbRef pinned to uploads/{me}/dm-{convId}/).
// ============================================================================
const peerConv = (creator, other, over = {}) => ({
  participants: [creator, other], kind: 'peer', state: 'request',
  creatorUid: creator, createdAt: serverTimestamp(), ...over,
});
const groupConv = (creator, over = {}) => ({
  participants: [creator], kind: 'group', state: 'open', name: 'Club',
  creatorUid: creator, createdAt: serverTimestamp(), ...over,
});
const seedPeer = (id, creator, other, state) => seed((db) => setDoc(doc(db, 'conversations/' + id),
  { participants: [creator, other], kind: 'peer', state, creatorUid: creator, createdAt: Timestamp.now() }));
const seedGroup = (id, creator, parts, over = {}) => seed((db) => setDoc(doc(db, 'conversations/' + id),
  { participants: parts, kind: 'group', state: 'open', name: 'Club', creatorUid: creator, createdAt: Timestamp.now(), ...over }));
const dmMsg = (sender, over = {}) => ({ senderUid: sender, text: 'hi', createdAt: serverTimestamp(), ...over });

// ---------------- A1: blocks ----------------
test('A1 blocks: owner create + get + list + delete happy path (exact {createdAt} shape)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'blocks/alice/list/bob'), { createdAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(as('alice'), 'blocks/alice/list/bob')));
  await assertSucceeds(getDocs(collection(as('alice'), 'blocks/alice/list')));
  await assertSucceeds(deleteDoc(doc(as('alice'), 'blocks/alice/list/bob')));
});
test('A1 blocks: HOSTILE — a stranger cannot create or delete in someone else\'s block list', async () => {
  await assertFails(setDoc(doc(as('mallory'), 'blocks/alice/list/bob'), { createdAt: serverTimestamp() }));
  await seed((db) => setDoc(doc(db, 'blocks/alice/list/bob'), { createdAt: Timestamp.now() }));
  await assertFails(deleteDoc(doc(as('mallory'), 'blocks/alice/list/bob')));
  await assertFails(deleteDoc(doc(as('bob'), 'blocks/alice/list/bob'))); // the blocked party can't self-unblock
});
test('A1 blocks: HOSTILE — the blocked user can NEVER confirm they\'re blocked (get + list denied)', async () => {
  await seed((db) => setDoc(doc(db, 'blocks/alice/list/bob'), { createdAt: Timestamp.now() }));
  await assertFails(getDoc(doc(as('bob'), 'blocks/alice/list/bob')));
  await assertFails(getDocs(collection(as('bob'), 'blocks/alice/list')));
  await assertFails(getDoc(doc(anon(), 'blocks/alice/list/bob')));
});
test('A1 blocks: self-block, extra keys, backdated + missing createdAt are DENIED', async () => {
  await assertFails(setDoc(doc(as('alice'), 'blocks/alice/list/alice'), { createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as('alice'), 'blocks/alice/list/bob'), { createdAt: serverTimestamp(), note: 'why' }));
  await assertFails(setDoc(doc(as('alice'), 'blocks/alice/list/bob'), { createdAt: Timestamp.fromMillis(0) }));
  await assertFails(setDoc(doc(as('alice'), 'blocks/alice/list/bob'), {}));
});
test('A1 blocks: blocking needs NO gateOk — un-consented AND banned users may still protect themselves', async () => {
  // 'newbie' has no moderationGate doc (un-consented) — block still lands:
  await assertSucceeds(setDoc(doc(as('newbie'), 'blocks/newbie/list/mallory'), { createdAt: serverTimestamp() }));
  await seed((db) => gate(db, 'badguy', { banned: true }));
  await assertSucceeds(setDoc(doc(as('badguy'), 'blocks/badguy/list/mallory'), { createdAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(as('badguy'), 'blocks/badguy/list/mallory')));
});

// ---------------- A1: peer conversation create ----------------
test('A1 peer create: happy — 2 parties, born state request, creatorUid = the sender', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/pc1'), peerConv('alice', 'bob')));
});
test('A1 peer create: HOSTILE shapes DENIED (3 parties / creator absent / forged creatorUid / self-pair / smuggled summary key)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc2'),
    peerConv('alice', 'bob', { participants: ['alice', 'bob', 'carol'] })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc3'),
    peerConv('alice', 'bob', { participants: ['bob', 'carol'] })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc4'),
    peerConv('alice', 'bob', { creatorUid: 'bob' })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc5'),
    peerConv('alice', 'alice')));
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc6'),
    peerConv('alice', 'bob', { unread_bob: 99 })));
});
test('A1 peer create: HOSTILE — Blake in a peer pair is DENIED (his floor stays kind admin)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc7'), peerConv('alice', ADMIN)));
});
test('A1 peer create: born-open / born-declined are DENIED (a request must be answerable)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc8'), peerConv('alice', 'bob', { state: 'open' })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc9'), peerConv('alice', 'bob', { state: 'declined' })));
});
// gate A2 — born-sortable: the inbox orders by lastMessageAt, so creates may
// carry it — but only as NOW (a future stamp would pin the request atop the
// recipient's list forever).
test('A2 peer create: lastMessageAt == now at birth is ALLOWED (born-sortable)', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/pc10'),
    peerConv('alice', 'bob', { lastMessageAt: serverTimestamp() })));
});
test('A2 peer create: HOSTILE future lastMessageAt at birth is DENIED (no sort-pinning)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'conversations/pc11'),
    peerConv('alice', 'bob', { lastMessageAt: Timestamp.fromMillis(Date.now() + 86400000) })));
});
test('A1 peer create: a block in EITHER direction kills the pairing; un-consented creator DENIED', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'blocks/bob/list/alice'), { createdAt: Timestamp.now() });   // bob blocked alice
    await setDoc(doc(db, 'blocks/alice/list/carol'), { createdAt: Timestamp.now() }); // alice blocked carol
  });
  await assertFails(setDoc(doc(as('alice'), 'conversations/pcB1'), peerConv('alice', 'bob')));
  await assertFails(setDoc(doc(as('alice'), 'conversations/pcB2'), peerConv('alice', 'carol')));
  // no gate doc -> gateOk() holds the DM surface (unlike blocks, which are ungated):
  await assertFails(setDoc(doc(as('newbie'), 'conversations/pcB3'), peerConv('newbie', 'bob')));
});

// ---------------- A1: peer state flip ----------------
test('A1 peer flip: the RECIPIENT accepts (request->open) or declines (request->declined), state-only', async () => {
  await seedPeer('pf1', 'alice', 'bob', 'request');
  await assertSucceeds(updateDoc(doc(as('bob'), 'conversations/pf1'), { state: 'open' }));
  await seedPeer('pf2', 'alice', 'bob', 'request');
  await assertSucceeds(updateDoc(doc(as('bob'), 'conversations/pf2'), { state: 'declined' }));
});
test('A1 peer flip: HOSTILE — the CREATOR cannot self-accept; outsiders cannot flip', async () => {
  await seedPeer('pf3', 'alice', 'bob', 'request');
  await assertFails(updateDoc(doc(as('alice'), 'conversations/pf3'), { state: 'open' }));
  await assertFails(updateDoc(doc(as('carol'), 'conversations/pf3'), { state: 'open' }));
});
test('A1 peer flip: one-shot — no re-flip from open/declined, no arbitrary states, state-ONLY diff', async () => {
  await seedPeer('pf4', 'alice', 'bob', 'open');
  await assertFails(updateDoc(doc(as('bob'), 'conversations/pf4'), { state: 'declined' })); // accepted is immutable
  await seedPeer('pf5', 'alice', 'bob', 'declined');
  await assertFails(updateDoc(doc(as('bob'), 'conversations/pf5'), { state: 'open' }));
  await seedPeer('pf6', 'alice', 'bob', 'request');
  await assertFails(updateDoc(doc(as('bob'), 'conversations/pf6'), { state: 'locked' }));
  await assertFails(updateDoc(doc(as('bob'), 'conversations/pf6'), { state: 'open', creatorUid: 'bob' }));
});
test('A1 summary forgery: participants still cannot write unread_*/lastMessageAt on peer OR group', async () => {
  await seedPeer('sf1', 'alice', 'bob', 'open');
  await assertFails(updateDoc(doc(as('bob'), 'conversations/sf1'), { unread_alice: 99 }));
  await assertFails(updateDoc(doc(as('alice'), 'conversations/sf1'), { lastMessageAt: serverTimestamp() }));
  await seedGroup('sf2', 'alice', ['alice', 'bob']);
  await assertFails(updateDoc(doc(as('bob'), 'conversations/sf2'), { unread_alice: 5 }));
  await assertFails(updateDoc(doc(as('alice'), 'conversations/sf2'), { lastMessageAt: serverTimestamp() }));
});

// ---------------- A1: message send gates by kind + state ----------------
test('A1 messages: ONLY the request sender may write into a pending request', async () => {
  await seedPeer('mreq', 'alice', 'bob', 'request');
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/mreq/messages/m1'), dmMsg('alice')));
  await assertFails(setDoc(doc(as('bob'), 'conversations/mreq/messages/m2'), dmMsg('bob')));
});
test('A1 messages: NOBODY writes into declined; BOTH parties write into open', async () => {
  await seedPeer('mdec', 'alice', 'bob', 'declined');
  await assertFails(setDoc(doc(as('alice'), 'conversations/mdec/messages/m1'), dmMsg('alice')));
  await assertFails(setDoc(doc(as('bob'), 'conversations/mdec/messages/m2'), dmMsg('bob')));
  await seedPeer('mopen', 'alice', 'bob', 'open');
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/mopen/messages/m1'), dmMsg('alice')));
  await assertSucceeds(setDoc(doc(as('bob'), 'conversations/mopen/messages/m2'), dmMsg('bob')));
});
test('A1 messages: group members write when open; outsiders DENIED; a locked group is frozen', async () => {
  await seedGroup('mg1', 'alice', ['alice', 'bob']);
  await assertSucceeds(setDoc(doc(as('bob'), 'conversations/mg1/messages/m1'), dmMsg('bob')));
  await assertFails(setDoc(doc(as('carol'), 'conversations/mg1/messages/m2'), dmMsg('carol')));
  await seedGroup('mg2', 'alice', ['alice', 'bob'], { state: 'locked' });
  await assertFails(setDoc(doc(as('bob'), 'conversations/mg2/messages/m1'), dmMsg('bob')));
});
// gate A5 (adversarial HIGH) — a BLOCK severs an OPEN peer thread at the
// message level (the A1 create-time block check couldn't reach an already-open
// conversation). Either direction of block freezes BOTH senders.
test('A5 messages: a block freezes an OPEN peer thread for BOTH parties', async () => {
  await seedPeer('mblk', 'alice', 'bob', 'open');
  // sanity: open + unblocked, both write
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/mblk/messages/m0'), dmMsg('alice')));
  // alice blocks bob (a block doc in EITHER direction)
  await seed((db) => setDoc(doc(db, 'blocks/alice/list/bob'), { createdAt: Timestamp.now() }));
  await assertFails(setDoc(doc(as('bob'), 'conversations/mblk/messages/m1'), dmMsg('bob')));    // the blocked party can't reach in
  await assertFails(setDoc(doc(as('alice'), 'conversations/mblk/messages/m2'), dmMsg('alice'))); // and the blocker's own thread is closed too
});

// ---------------- A1: the DM image pointer ----------------
test('A1 message imgRef: own dm-path (+thumb) happy; foreign-uid path DENIED', async () => {
  await seedPeer('mi1', 'alice', 'bob', 'open');
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/mi1/messages/m1'),
    dmMsg('alice', { imgRef: 'uploads/alice/dm-mi1/img1', imgThumbRef: 'uploads/alice/dm-mi1/img1_thumb' })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/mi1/messages/m2'),
    dmMsg('alice', { imgRef: 'uploads/bob/dm-mi1/img1' })));
});
test('A1 message imgRef: wrong prefix / another conversation / URL / bad thumb are DENIED', async () => {
  await seedPeer('mi2', 'alice', 'bob', 'open');
  await assertFails(setDoc(doc(as('alice'), 'conversations/mi2/messages/m1'),
    dmMsg('alice', { imgRef: 'uploads/alice/somepost/img1' })));        // not the dm- scheme
  await assertFails(setDoc(doc(as('alice'), 'conversations/mi2/messages/m2'),
    dmMsg('alice', { imgRef: 'uploads/alice/dm-otherconv/img1' })));    // re-aimed at another conv
  await assertFails(setDoc(doc(as('alice'), 'conversations/mi2/messages/m3'),
    dmMsg('alice', { imgRef: 'https://evil.example/x.png' })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/mi2/messages/m4'),
    dmMsg('alice', { imgThumbRef: 'uploads/bob/dm-mi2/t1' })));
});
// gate A4 — an image IS a message (text may be empty when imgRef rides);
// a bare empty message stays denied.
test('A4 message: image-only (empty text + imgRef) is ALLOWED', async () => {
  await seedPeer('mi3', 'alice', 'bob', 'open');
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/mi3/messages/m1'),
    dmMsg('alice', { text: '', imgRef: 'uploads/alice/dm-mi3/img1' })));
});
test('A4 message: HOSTILE bare empty message (no text, no image) stays DENIED', async () => {
  await seedPeer('mi4', 'alice', 'bob', 'open');
  await assertFails(setDoc(doc(as('alice'), 'conversations/mi4/messages/m1'),
    dmMsg('alice', { text: '' })));
});

// ---------------- A1: group create ----------------
test('A1 group create: SOLO birth happy (participants == [creator])', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'conversations/gc1'), groupConv('alice')));
});
test('A1 group create: HOSTILE births DENIED (with members / forged creator / born-request / bad name / extra key)', async () => {
  await assertFails(setDoc(doc(as('alice'), 'conversations/gc2'),
    groupConv('alice', { participants: ['alice', 'bob'] })));           // born-with-members
  await assertFails(setDoc(doc(as('alice'), 'conversations/gc3'),
    groupConv('alice', { creatorUid: 'bob' })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/gc4'),
    groupConv('alice', { state: 'request' })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/gc5'),
    { participants: ['alice'], kind: 'group', state: 'open', creatorUid: 'alice', createdAt: serverTimestamp() })); // no name
  await assertFails(setDoc(doc(as('alice'), 'conversations/gc6'),
    groupConv('alice', { name: 'x'.repeat(61) })));
  await assertFails(setDoc(doc(as('alice'), 'conversations/gc7'),
    groupConv('alice', { topic: 'smuggled' })));
});
test('A1 group create: un-consented creator is DENIED (gateOk holds the community surface)', async () => {
  await assertFails(setDoc(doc(as('newbie'), 'conversations/gc8'), groupConv('newbie')));
});

// ---------------- A1: group membership ops ----------------
test('A1 group add: the creator appends exactly ONE member — and Blake MAY be added (groups are community space)', async () => {
  await seedGroup('ga1', 'alice', ['alice']);
  await assertSucceeds(updateDoc(doc(as('alice'), 'conversations/ga1'), { participants: ['alice', 'bob'] }));
  await seedGroup('ga2', 'alice', ['alice', 'bob']);
  await assertSucceeds(updateDoc(doc(as('alice'), 'conversations/ga2'), { participants: ['alice', 'bob', ADMIN] }));
});
test('A1 group add: HOSTILE adds DENIED (non-creator / two-at-once / duplicate / swap / locked group)', async () => {
  await seedGroup('gb1', 'alice', ['alice', 'bob']);
  await assertFails(updateDoc(doc(as('bob'), 'conversations/gb1'), { participants: ['alice', 'bob', 'carol'] }));
  await assertFails(updateDoc(doc(as('alice'), 'conversations/gb1'), { participants: ['alice', 'bob', 'carol', 'dave'] }));
  await assertFails(updateDoc(doc(as('alice'), 'conversations/gb1'), { participants: ['alice', 'bob', 'bob'] }));
  await assertFails(updateDoc(doc(as('alice'), 'conversations/gb1'), { participants: ['alice', 'carol'] })); // swap, not add
  await seedGroup('gb2', 'alice', ['alice'], { state: 'locked' });
  await assertFails(updateDoc(doc(as('alice'), 'conversations/gb2'), { participants: ['alice', 'bob'] }));
});
test('A1 group add: the 15-member cap holds (grow to 15 OK; the 16th DENIED)', async () => {
  const fourteen = ['alice'].concat(Array.from({ length: 13 }, (_, i) => 'm' + i));   // 14 members
  await seedGroup('gcap1', 'alice', fourteen);
  await assertSucceeds(updateDoc(doc(as('alice'), 'conversations/gcap1'), { participants: fourteen.concat(['m13']) })); // -> 15
  const fifteen = fourteen.concat(['m13']);
  await seedGroup('gcap2', 'alice', fifteen);
  await assertFails(updateDoc(doc(as('alice'), 'conversations/gcap2'), { participants: fifteen.concat(['m14']) }));     // -> 16
});
test('A1 group add: a block in EITHER direction kills the add', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'blocks/dave/list/alice'), { createdAt: Timestamp.now() });  // dave blocked the creator
    await setDoc(doc(db, 'blocks/alice/list/eve'), { createdAt: Timestamp.now() });   // the creator blocked eve
  });
  await seedGroup('gbl1', 'alice', ['alice', 'bob']);
  await assertFails(updateDoc(doc(as('alice'), 'conversations/gbl1'), { participants: ['alice', 'bob', 'dave'] }));
  await assertFails(updateDoc(doc(as('alice'), 'conversations/gbl1'), { participants: ['alice', 'bob', 'eve'] }));
});
test('A1 group remove: a member removes THEMSELVES; the creator removes ONE OTHER', async () => {
  await seedGroup('gr1', 'alice', ['alice', 'bob', 'carol']);
  await assertSucceeds(updateDoc(doc(as('bob'), 'conversations/gr1'), { participants: ['alice', 'carol'] }));
  await seedGroup('gr2', 'alice', ['alice', 'bob', 'carol']);
  await assertSucceeds(updateDoc(doc(as('alice'), 'conversations/gr2'), { participants: ['alice', 'carol'] }));
});
test('A1 group remove: HOSTILE removals DENIED (creator-leave / member evicting another / evicting the creator / gutting)', async () => {
  await seedGroup('gr3', 'alice', ['alice', 'bob', 'carol']);
  await assertFails(updateDoc(doc(as('alice'), 'conversations/gr3'), { participants: ['bob', 'carol'] }));  // creator cannot leave (v1)
  await assertFails(updateDoc(doc(as('bob'), 'conversations/gr3'), { participants: ['alice', 'bob'] }));    // member evicting carol
  await assertFails(updateDoc(doc(as('bob'), 'conversations/gr3'), { participants: ['bob', 'carol'] }));    // member evicting the creator
  await assertFails(updateDoc(doc(as('bob'), 'conversations/gr3'), { participants: ['alice'] }));           // removing two at once
});
test('A1 group gating: a banned creator cannot GROW a group; a banned member can still LEAVE', async () => {
  await seed(async (db) => {
    await gate(db, 'bcreator', { banned: true });
    await gate(db, 'bmember', { banned: true });
  });
  await seedGroup('gg1', 'bcreator', ['bcreator', 'bob']);
  await assertFails(updateDoc(doc(as('bcreator'), 'conversations/gg1'), { participants: ['bcreator', 'bob', 'carol'] }));
  await seedGroup('gg2', 'alice', ['alice', 'bmember']);
  await assertSucceeds(updateDoc(doc(as('bmember'), 'conversations/gg2'), { participants: ['alice'] }));
});
test('A1 group read: participant get OK; non-participant get DENIED (H4 holds for groups)', async () => {
  await seedGroup('grd1', 'alice', ['alice', 'bob']);
  await assertSucceeds(getDoc(doc(as('bob'), 'conversations/grd1')));
  await assertFails(getDoc(doc(as('carol'), 'conversations/grd1')));
});
