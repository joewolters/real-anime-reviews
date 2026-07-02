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

// =============================================================================
// GATE 18 — onDmMessageCreate: a DM message pings the recipient's Lantern
// (type 'dm', server-sourced sender) + bumps the CF-owned unread_{uid} mirror
// on the conversation. Admin-floor shaped here (kind:'admin', Blake a party)
// to match the rules, but the CF itself is participant-agnostic.
// =============================================================================
const { ADMIN_UID } = require('../lib/moderation');

// 11) DM message -> recipient notification (dm type, server-sourced name) + unread mirror
test('DM message -> recipient gets a dm notification + the conversation unread mirror increments', async () => {
  await db.doc('conversations/dmconv1').set({ participants: ['dmA', ADMIN_UID], kind: 'admin', state: 'open', createdAt: TS.now() });
  await db.doc('profiles/dmA').set({ displayName: 'DM Sender', photoURL: null });
  // the message even carries a FORGED name — the CF must source identity server-side:
  await db.collection('conversations/dmconv1/messages').add({ senderUid: 'dmA', text: 'hello', createdAt: FV.serverTimestamp(), fromDisplayName: 'FORGED Blake' });

  const notif = await waitFor(async () => {
    const s = await db.collection('users/' + ADMIN_UID + '/notifications').get();
    return s.docs.map((d) => d.data()).find((n) => n.type === 'dm' && n.fromUid === 'dmA') || null;
  });
  assert.ok(notif, 'the recipient (admin) should get a dm notification');
  assert.equal(notif.toUid, ADMIN_UID);
  assert.equal(notif.fromUid, 'dmA');
  assert.equal(notif.fromDisplayName, 'DM Sender', 'name must come from the profile, not the forged message field');
  assert.equal(notif.type, 'dm');
  assert.equal(notif.verb, 'sent you a message');
  assert.equal(notif.targetPath, 'conversations/dmconv1');
  assert.equal(notif.read, false);

  const conv = await waitFor(async () => {
    const d = await db.doc('conversations/dmconv1').get();
    const unread = d.exists ? d.data()['unread_' + ADMIN_UID] : null;
    return typeof unread === 'number' && unread >= 1 ? d.data() : null;
  });
  assert.ok(conv, 'unread_{recipient} on the conversation should reach >= 1');
  assert.ok(conv.lastMessageAt, 'lastMessageAt should be stamped');
  assert.equal(conv.lastMessageText, undefined, 'NO raw message preview in conversation metadata');
});

// 12) muted recipient -> the unread mirror still bumps, but NO dm notification doc lands
test('muted dm recipient -> unread mirror increments but NO notification is written', async () => {
  await db.doc('users/dmB/notifPrefs/prefs').set({ muted: { dm: true } });
  await db.doc('conversations/dmconv2').set({ participants: [ADMIN_UID, 'dmB'], kind: 'admin', state: 'open', createdAt: TS.now() });
  await db.collection('conversations/dmconv2/messages').add({ senderUid: ADMIN_UID, text: 'hi', createdAt: FV.serverTimestamp() });

  // the badge mirror moves (mute silences the ping, not the badge)...
  const conv = await waitFor(async () => {
    const d = await db.doc('conversations/dmconv2').get();
    const unread = d.exists ? d.data().unread_dmB : null;
    return typeof unread === 'number' && unread >= 1 ? true : null;
  });
  assert.ok(conv, 'unread_dmB should increment even when the recipient muted dm');

  // ...but no dm notification was written.
  await sleep(2500);
  const s = await db.collection('users/dmB/notifications').get();
  const dmNotifs = s.docs.map((d) => d.data()).filter((n) => n.type === 'dm');
  assert.equal(dmNotifs.length, 0, 'a muted dm recipient must get NO dm notification');
});

// =============================================================================
// MEGA-RUN GATE A1 — peer-DM / group-chat CFs: onConversationCreate (the
// dm_request ping), the onDmMessageCreate request-state + conv-mute guards,
// and the DM lane of the detect-and-undo rate limiter.
// =============================================================================

// 13) peer conversation create -> ONE dm_request ping to the recipient,
//     server-sourced identity, and DELIBERATELY UNMUTABLE (muted dm +
//     dm_request prefs must NOT silence it — the request ping is the safety
//     signal that lets the recipient accept, decline, or block).
test('A1: peer conversation create -> dm_request ping (server-sourced, unmutable)', async () => {
  await db.doc('profiles/pA').set({ displayName: 'Peer Sender', photoURL: null });
  await db.doc('users/pB/notifPrefs/prefs').set({ muted: { dm: true, dm_request: true } });
  await db.doc('conversations/preq1').set({
    participants: ['pA', 'pB'], kind: 'peer', state: 'request', creatorUid: 'pA',
    createdAt: TS.now(), fromDisplayName: 'FORGED Blake', // forged field — must be ignored
  });
  const notif = await waitFor(async () => {
    const s = await db.collection('users/pB/notifications').get();
    return s.docs.map((d) => d.data()).find((n) => n.type === 'dm_request') || null;
  });
  assert.ok(notif, 'the recipient should get a dm_request notification DESPITE the mutes');
  assert.equal(notif.toUid, 'pB');
  assert.equal(notif.fromUid, 'pA');
  assert.equal(notif.fromDisplayName, 'Peer Sender', 'identity must be server-sourced from profiles');
  assert.equal(notif.targetPath, 'conversations/preq1');
  assert.equal(notif.read, false);
});

// 13b) gate A5 (adversarial HIGH) — the dm_request ping is DEDUPED per sender:
//      a second request conv from the SAME sender re-lights the ONE
//      dmreq_<creator> row, never floods (a re-request-after-decline / SDK
//      spam vector). Bounds ping COUNT to one-per-sender.
test('A5: repeated requests from one sender collapse into ONE dmreq_<creator> ping', async () => {
  await db.doc('profiles/pFlood').set({ displayName: 'Flooder', photoURL: null });
  await db.doc('conversations/pf1').set({
    participants: ['pFlood', 'pVictim'], kind: 'peer', state: 'request', creatorUid: 'pFlood', createdAt: TS.now(),
  });
  await waitFor(async () => (await db.doc('users/pVictim/notifications/dmreq_pFlood').get()).exists ? true : null);
  // a second request conv (re-request) from the same sender
  await db.doc('conversations/pf2').set({
    participants: ['pFlood', 'pVictim'], kind: 'peer', state: 'request', creatorUid: 'pFlood', createdAt: TS.now(),
  });
  await new Promise((r) => setTimeout(r, 2500));
  const all = await db.collection('users/pVictim/notifications').get();
  const reqs = all.docs.map((d) => d.data()).filter((n) => n.type === 'dm_request' && n.fromUid === 'pFlood');
  assert.equal(reqs.length, 1, 'a re-request must NOT mint a second dm_request ping');
  // and the single ping points at the NEWEST request conv (still opens a live letter)
  assert.equal(reqs[0].targetPath, 'conversations/pf2');
});

// 14) messages into a PENDING request are silent: no dm ping, no unread bump
//     (the dm_request ping already covers the request).
test('A1: a message while state==request writes NO dm notification and NO unread', async () => {
  await db.doc('conversations/preq2').set({
    participants: ['pC', 'pD'], kind: 'peer', state: 'request', creatorUid: 'pC', createdAt: TS.now(),
  });
  await db.collection('conversations/preq2/messages').add({ senderUid: 'pC', text: 'nudge', createdAt: FV.serverTimestamp() });
  await sleep(2500);
  const s = await db.collection('users/pD/notifications').get();
  const dmNotifs = s.docs.map((d) => d.data()).filter((n) => n.type === 'dm');
  assert.equal(dmNotifs.length, 0, 'a request-state message must NOT ping the recipient');
  const conv = await db.doc('conversations/preq2').get();
  assert.equal(conv.data().unread_pD, undefined, 'a request-state message must NOT bump unread');
  assert.equal(conv.data().lastMessageAt, undefined, 'the summary must not move in request state');
});

// 15) once OPEN, a peer message pings + bumps unread exactly like the admin floor.
test('A1: an open-state peer message -> dm notification + unread mirror', async () => {
  await db.doc('profiles/pE').set({ displayName: 'Open Peer', photoURL: null });
  await db.doc('conversations/popen1').set({
    participants: ['pE', 'pF'], kind: 'peer', state: 'open', creatorUid: 'pE', createdAt: TS.now(),
  });
  await db.collection('conversations/popen1/messages').add({ senderUid: 'pE', text: 'hello', createdAt: FV.serverTimestamp() });
  const notif = await waitFor(async () => {
    const s = await db.collection('users/pF/notifications').get();
    return s.docs.map((d) => d.data()).find((n) => n.type === 'dm' && n.fromUid === 'pE') || null;
  });
  assert.ok(notif, 'the peer recipient should get a dm notification');
  assert.equal(notif.fromDisplayName, 'Open Peer');
  assert.equal(notif.targetPath, 'conversations/popen1');
  const conv = await waitFor(async () => {
    const d = await db.doc('conversations/popen1').get();
    return typeof d.data().unread_pF === 'number' && d.data().unread_pF >= 1 ? d.data() : null;
  });
  assert.ok(conv, 'unread_pF should reach >= 1');
  assert.equal(conv.lastSenderUid, 'pE');
});

// 16) per-CONVERSATION mute ('conv:<id>') silences the ping but not the badge.
test('A1: conv-mute suppresses the dm notification but the unread mirror still bumps', async () => {
  await db.doc('users/pH/notifPrefs/prefs').set({ muted: { 'conv:convmute1': true } });
  await db.doc('conversations/convmute1').set({
    participants: ['pG', 'pH'], kind: 'peer', state: 'open', creatorUid: 'pG', createdAt: TS.now(),
  });
  await db.collection('conversations/convmute1/messages').add({ senderUid: 'pG', text: 'muted thread', createdAt: FV.serverTimestamp() });
  const conv = await waitFor(async () => {
    const d = await db.doc('conversations/convmute1').get();
    return typeof d.data().unread_pH === 'number' && d.data().unread_pH >= 1 ? true : null;
  });
  assert.ok(conv, 'unread_pH should increment even under a conv-mute');
  await sleep(2500);
  const s = await db.collection('users/pH/notifications').get();
  const dmNotifs = s.docs.map((d) => d.data()).filter((n) => n.type === 'dm');
  assert.equal(dmNotifs.length, 0, 'a conv-muted recipient must get NO dm notification for that thread');
});

// 17) rate limit: the 21st rapid DM message by one sender is detected and undone.
//     DM messages ride their OWN bucket (rateState/<uid>__dm) at chat cadence
//     (DM_RATE_LIMIT = 20/60s) — a real back-and-forth beats 5/min, so the DM
//     brake is flood-tier, and it never shares state with the forum bucket.
test('A1 rate limit: the 21st rapid DM message by one sender is undone (dm bucket, chat cadence)', async () => {
  await db.doc('conversations/rl1').set({
    participants: ['rlOther', 'spamdm'], kind: 'peer', state: 'open', creatorUid: 'rlOther', createdAt: TS.now(),
  });
  for (let i = 0; i < 21; i++) {
    await db.doc('conversations/rl1/messages/rlm' + String(i).padStart(2, '0')).set({ senderUid: 'spamdm', text: 'spam ' + i, createdAt: FV.serverTimestamp() });
  }
  const settled = await waitFor(async () => {
    const s = await db.collection('conversations/rl1/messages').get();
    return s.size === 20 ? true : null;
  });
  assert.ok(settled, 'exactly 20 messages should remain (the 21st over-limit create is undone)');
});

// 18b) gate A3 — the group-ADD ping: appending a member to a group pings THEM
//      (type 'dm', creator-sourced identity, the group name in the verb);
//      leaves/removals ping nobody.
test('A3 group add: the appended member gets the added-you ping; a leave pings nobody', async () => {
  await db.doc('conversations/ga1').set({
    participants: ['gaCreator'], kind: 'group', state: 'open', name: 'Finale watchers',
    creatorUid: 'gaCreator', createdAt: TS.now(), lastMessageAt: TS.now(),
  });
  await db.doc('conversations/ga1').update({ participants: ['gaCreator', 'gaNewbie'] });
  const got = await waitFor(async () => {
    const s = await db.collection('users/gaNewbie/notifications').get();
    const n = s.docs.map((d) => d.data()).find((x) => x.type === 'dm' && /added you to "Finale watchers"/.test(x.verb || ''));
    return n || null;
  });
  assert.ok(got, 'the added member must get the added-you ping');
  assert.equal(got.fromUid, 'gaCreator');
  // a member leaving must ping nobody new
  await db.doc('conversations/ga1').update({ participants: ['gaCreator'] });
  await new Promise((r) => setTimeout(r, 2500));
  const after = await db.collection('users/gaNewbie/notifications').get();
  const pings = after.docs.map((d) => d.data()).filter((x) => /added you/.test(x.verb || ''));
  assert.equal(pings.length, 1, 'a leave/remove must not mint another ping');
});

// 18) rate limit: the 6th rapid conversation create by one creator is undone.
test('A1 rate limit: the 6th rapid conversation create by one creator is undone', async () => {
  for (let i = 0; i < 6; i++) {
    await db.doc('conversations/cs' + i).set({
      participants: ['convspam', 'r' + i], kind: 'peer', state: 'request', creatorUid: 'convspam', createdAt: TS.now(),
    });
  }
  const settled = await waitFor(async () => {
    const s = await db.collection('conversations').where('creatorUid', '==', 'convspam').get();
    return s.size === 5 ? true : null;
  });
  assert.ok(settled, 'exactly 5 conversations should remain (the 6th over-limit create is undone)');
});
