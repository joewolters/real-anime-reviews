'use strict';

// =============================================================================
// v1.10.0 DREAM PROFILE — CF integration tests (functions+firestore+STORAGE
// emulators). Runs inside `npm run test:cf`. Proves with real round-trips:
//   • a profile like -> likesCount 1 + ONE deterministic 'pl_{liker}' ping
//     (server-sourced identity; the forged client name on the like doc ignored)
//   • unlike -> count back to 0; re-like -> count 1 and STILL exactly one ping
//   • a muted owner gets NO ping but the count still moves
//   • a self-like (admin SDK bypasses the rules that deny it) NEVER pings
//   • bgRef change / removal / profile doc delete each sweep the OLD background
//     object out of Storage (the edit-strip class); the new object survives
//   • adminRemoveImage on profiles/{uid}: object gone AND the bgRef field gone
//   • onUserDelete: avatars/{uid}/ swept, the departing user's FOREIGN like
//     removed (and the liked profile's count corrected), own profile subtree
//     recursiveDeleted with NO ghost-doc resurrection
// Same harness as cf-images.spec.js: unique uids/paths per test, no clearDb
// (--test-concurrency=1 keeps the order deterministic). bg fixtures carry
// cfProcessed:'true' so processUploadedImage skips them.
// =============================================================================

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { applyAdminRemoveImage } = require('../lib/images');
const { ADMIN_UID } = require('../lib/moderation');

// The trigger is PINNED to this bucket name (functions/index.js UPLOADS_BUCKET)
// so prod + practice + tests all ride the same registration.
const UPLOADS_BUCKET = 'real-anime-reviews.firebasestorage.app';

if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-rar' });
const db = admin.firestore();
const bucket = admin.storage().bucket(UPLOADS_BUCKET);
const FV = admin.firestore.FieldValue;
const TS = admin.firestore.Timestamp;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, { timeout = 25000, interval = 400 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error('waitFor timed out');
    await sleep(interval);
  }
}

const exists = async (path) => (await bucket.file(path).exists())[0];

// A pre-processed jpeg fixture — cfProcessed:'true' so the pipeline skips it
// (these tests exercise the SWEEPS, not the re-encode).
const saveBg = (path) => bucket.file(path).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
  resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
});

const likeDoc = (likerUid) => ({ uid: likerUid, value: 1, updatedAt: TS.now() });
const likesCountIs = (uid, n) => waitFor(async () => {
  const d = await db.doc('profiles/' + uid).get();
  return d.exists && d.data().likesCount === n ? true : null;
});

before(async () => {
  // warm the bucket namespace so the first upload isn't racing emulator setup
  await bucket.file('uploads/warm/w/w').save(Buffer.from('warm'), { resumable: false }).catch(() => {});
  await bucket.file('uploads/warm/w/w').delete({ ignoreNotFound: true }).catch(() => {});
});

// 1) like create -> exact count + the deterministic pl_ ping, server-sourced
test('profile like -> likesCount 1 + ONE pl_{liker} notification with SERVER-sourced identity', async () => {
  await db.doc('profiles/plOwner1').set({ displayName: 'Owner One', photoURL: null });
  await db.doc('profiles/plFan1').set({ displayName: 'Fan One', photoURL: null });
  // the like doc even carries a FORGED name — the CF must ignore it:
  await db.doc('profiles/plOwner1/likes/plFan1').set(
    Object.assign(likeDoc('plFan1'), { fromDisplayName: 'FORGED Blake' }));

  await likesCountIs('plOwner1', 1);
  const notif = await waitFor(async () => {
    const d = await db.doc('users/plOwner1/notifications/pl_plFan1').get();
    return d.exists ? d.data() : null;
  });
  assert.equal(notif.toUid, 'plOwner1');
  assert.equal(notif.fromUid, 'plFan1');
  assert.equal(notif.fromDisplayName, 'Fan One', 'name must come from the profile, not the forged like field');
  assert.equal(notif.type, 'profile_like');
  assert.equal(notif.value, 1);
  assert.equal(notif.verb, 'liked your profile');
  assert.equal(notif.targetPath, 'profiles/plOwner1');
  assert.equal(notif.read, false);
});

// 2) unlike (delete) -> count back to 0, no new ping
test('unlike -> likesCount returns to 0', async () => {
  await db.doc('profiles/plOwner2').set({ displayName: 'Owner Two' });
  await db.doc('profiles/plFan2').set({ displayName: 'Fan Two' });
  await db.doc('profiles/plOwner2/likes/plFan2').set(likeDoc('plFan2'));
  await likesCountIs('plOwner2', 1);
  await db.doc('profiles/plOwner2/likes/plFan2').delete();
  await likesCountIs('plOwner2', 0);
});

// 3) the spam vector: unlike/re-like toggles must NOT stack pings
test('re-like -> likesCount 1 again and STILL exactly one pl_ notification', async () => {
  await db.doc('profiles/plOwner3').set({ displayName: 'Owner Three' });
  await db.doc('profiles/plFan3').set({ displayName: 'Fan Three' });
  const likeRef = db.doc('profiles/plOwner3/likes/plFan3');
  await likeRef.set(likeDoc('plFan3'));
  await likesCountIs('plOwner3', 1);
  await likeRef.delete();
  await likesCountIs('plOwner3', 0);
  await likeRef.set(likeDoc('plFan3')); // the re-like
  await likesCountIs('plOwner3', 1);
  await waitFor(async () => (await db.doc('users/plOwner3/notifications/pl_plFan3').get()).exists);
  const s = await db.collection('users/plOwner3/notifications').get();
  const pings = s.docs.filter((d) => d.data().type === 'profile_like');
  assert.equal(pings.length, 1, 'the deterministic id must OVERWRITE, never stack');
  assert.equal(pings[0].id, 'pl_plFan3');
});

// 4) mute-at-source: the count still moves, no notification doc lands
test('muted owner -> likesCount still moves but NO profile_like notification', async () => {
  await db.doc('profiles/plOwner4').set({ displayName: 'Owner Four' });
  await db.doc('users/plOwner4/notifPrefs/prefs').set({ muted: { profile_like: true } });
  await db.doc('profiles/plFan4').set({ displayName: 'Fan Four' });
  await db.doc('profiles/plOwner4/likes/plFan4').set(likeDoc('plFan4'));
  await likesCountIs('plOwner4', 1);
  await sleep(2500);
  const s = await db.collection('users/plOwner4/notifications').get();
  assert.equal(s.size, 0, 'a muted profile_like must produce no notification');
});

// 5) defense in depth: rules deny a self-like, but the Admin SDK bypasses
//    rules — the CF must still never self-ping
test('self-like (rules-bypassing write) -> NEVER notifies', async () => {
  await db.doc('profiles/plSelf5').set({ displayName: 'Narcissus' });
  await db.doc('profiles/plSelf5/likes/plSelf5').set(likeDoc('plSelf5'));
  await likesCountIs('plSelf5', 1);
  await sleep(2500);
  const s = await db.collection('users/plSelf5/notifications').get();
  assert.equal(s.size, 0, 'a self-like must never produce a notification');
});

// 6) the edit-strip class: swapping the background sweeps the OLD object only
test('bgRef CHANGE -> the old Storage object is deleted, the new one survives', async () => {
  const oldBg = 'uploads/bgu1/profilebg/old1';
  const newBg = 'uploads/bgu1/profilebg/new1';
  await saveBg(oldBg);
  await saveBg(newBg);
  await db.doc('profiles/bgu1').set({ displayName: 'BG One', bgRef: oldBg });
  await sleep(600); // let the create settle so the next write is a clean bgRef edge
  await db.doc('profiles/bgu1').set({ bgRef: newBg }, { merge: true });
  await waitFor(async () => !(await exists(oldBg)));
  assert.equal(await exists(newBg), true, 'the NEW background must survive the sweep');
});

// 7) removing the background field sweeps the object
test('bgRef REMOVAL -> the Storage object is deleted', async () => {
  const bg = 'uploads/bgu2/profilebg/only1';
  await saveBg(bg);
  await db.doc('profiles/bgu2').set({ displayName: 'BG Two', bgRef: bg });
  await sleep(600);
  await db.doc('profiles/bgu2').update({ bgRef: FV.delete() });
  await waitFor(async () => !(await exists(bg)));
});

// 8) deleting the whole profile doc sweeps the object
test('profile DOC DELETE -> the background object is deleted', async () => {
  const bg = 'uploads/bgu3/profilebg/only1';
  await saveBg(bg);
  await db.doc('profiles/bgu3').set({ displayName: 'BG Three', bgRef: bg });
  await sleep(600);
  await db.doc('profiles/bgu3').delete();
  await waitFor(async () => !(await exists(bg)));
});

// 9) adminRemoveImage core (against the live emulators): profiles variant —
//    object gone AND the bgRef field gone, profile doc survives
test('adminRemoveImage on profiles/{uid} bgRef -> object gone + field gone', async () => {
  const bg = 'uploads/bgadmin1/profilebg/bad1';
  await saveBg(bg);
  await db.doc('profiles/bgadmin1').set({ displayName: 'BG Admin', bgRef: bg, likesCount: 3 });
  await sleep(400);

  const res = await applyAdminRemoveImage(db, bucket, FV, ADMIN_UID, 'profiles/bgadmin1', bg);
  assert.equal(res.ok, true);
  assert.equal(await exists(bg), false, 'the Storage object must be gone');
  const snap = await db.doc('profiles/bgadmin1').get();
  assert.equal(snap.exists, true, 'the profile doc itself survives');
  assert.equal('bgRef' in (snap.data() || {}), false, 'the bgRef pointer must be gone');
  assert.equal(snap.data().likesCount, 3, 'the rest of the profile is untouched');
});

// 10) onUserDelete (dream-profile extensions): avatars swept, foreign like
//     removed (count corrected on the liked profile), own profile subtree
//     recursiveDeleted with no ghost resurrection
test('onUserDelete -> avatars/{uid}/ gone + foreign like gone + own likes subtree gone (no ghost)', async () => {
  const U = 'wipeu1';
  const av1 = 'avatars/' + U + '/av1';
  const av2 = 'avatars/' + U + '/av2';
  for (const p of [av1, av2]) {
    await bucket.file(p).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
      resumable: false, metadata: { contentType: 'image/jpeg' },
    });
  }
  await db.doc('users/' + U).set({ username: 'doomed-fan' });
  await db.doc('profiles/' + U).set({ displayName: 'Doomed Fan' });
  // a like ON the departing user's own profile (the subtree recursiveDelete target)
  await db.doc('profiles/' + U + '/likes/someFan').set(likeDoc('someFan'));
  // the departing user's FOREIGN like on someone else's profile
  await db.doc('profiles/wipeTarget1').set({ displayName: 'Liked One' });
  await db.doc('profiles/wipeTarget1/likes/' + U).set(likeDoc(U));
  await likesCountIs('wipeTarget1', 1);
  await likesCountIs(U, 1);

  await db.doc('users/' + U).delete();

  await waitFor(async () => !(await exists(av1)) && !(await exists(av2)));
  await waitFor(async () => !(await db.doc('profiles/wipeTarget1/likes/' + U).get()).exists);
  // the foreign-like delete fires onProfileLike -> the liked profile's count corrects
  await likesCountIs('wipeTarget1', 0);
  await waitFor(async () => {
    const prof = await db.doc('profiles/' + U).get();
    const likes = await db.collection('profiles/' + U + '/likes').get();
    return !prof.exists && likes.empty ? true : null;
  });
  // the subtree unlikes fan back through onProfileLike AFTER the profile doc is
  // gone — update() (not set+merge) must NOT resurrect a ghost count-only doc
  await sleep(1500);
  assert.equal((await db.doc('profiles/' + U).get()).exists, false, 'no ghost profiles doc resurrection');
});

// ============================================================================
// milestone E — the users-GET tightening's enablers (functions/lib/backfill.js):
// the users/{uid} onCreate mint (every future signup) + the one-shot admin
// backfill (every existing account). Together they close the gate-20.5
// "former member" tombstone class so users docs (they carry EMAILS) can go
// owner+admin-only.
// ============================================================================
const { applyBackfillProfiles } = require('../lib/backfill');

test('signup mint: a new users doc births a minimal profile — name mapped, EMAIL never copied', async () => {
  const U = 'signup_' + Date.now();
  await db.doc('users/' + U).set({ username: 'Fresh Fan', photoURL: 'https://example.com/f.png', email: 'fresh@x.test' });
  const prof = await waitFor(async () => {
    const p = await db.doc('profiles/' + U).get();
    return p.exists ? p.data() : null;
  });
  assert.equal(prof.displayName, 'Fresh Fan', 'username maps to displayName');
  // PART A item 5 (2026-08-09) — this line used to assert the OPPOSITE:
  // that an arbitrary off-origin photoURL was copied verbatim into the public
  // profile. That behaviour was the legacy-member bug. The rules reject those
  // origins, so a minted doc holding one could never be re-saved by its owner:
  // every Studio save returned PERMISSION_DENIED, forever. The mint now drops
  // a URL the rules would refuse, and the member simply has no avatar until
  // they upload one. Test changed deliberately — it was pinning a real defect.
  assert.equal('photoURL' in prof, false, 'an off-origin avatar URL is NOT minted into the public profile');
  assert.equal('email' in prof, false, 'the email NEVER crosses into the public profile');
  assert.ok(prof.joinedAt, 'a signup-time mint stamps joinedAt (truthful at birth)');
});

test('signup mint: a GOOD-origin avatar IS carried into the public profile', async () => {
  const U = 'signupok_' + Date.now();
  const good = 'https://firebasestorage.googleapis.com/v0/b/x/o/avatars%2F' + U + '%2Fprofile.jpg';
  await db.doc('users/' + U).set({ username: 'Ok Fan', photoURL: good });
  const prof = await waitFor(async () => {
    const p = await db.doc('profiles/' + U).get();
    return p.exists ? p.data() : null;
  });
  assert.equal(prof.photoURL, good, 'an allowed origin still comes across');
});

test('backfillProfiles: admin-only; mints the missing, skips the Studio-made, omits joinedAt for legacy', async () => {
  const A = 'bfA_' + Date.now(), B = 'bfB_' + Date.now();
  await db.doc('users/' + A).set({ username: 'Legacy Ann', email: 'ann@x.test' });
  await db.doc('users/' + B).set({ displayName: 'Has Studio', email: 'b@x.test' });
  await db.doc('profiles/' + B).set({ displayName: 'Studio Name', accent: 'ember' });
  // the onCreate trigger will have minted A too — delete it to simulate a
  // PRE-TRIGGER legacy account (the population the backfill exists for)
  await waitFor(async () => (await db.doc('profiles/' + A).get()).exists);
  await db.doc('profiles/' + A).delete();

  await assert.rejects(() => applyBackfillProfiles(db, 'someFan'), /admin/i, 'the literal-UID gate holds');

  const res = await applyBackfillProfiles(db, ADMIN_UID);
  assert.ok(res.minted >= 1, 'the legacy account got its profile');
  const a = (await db.doc('profiles/' + A).get()).data();
  assert.equal(a.displayName, 'Legacy Ann');
  assert.equal('email' in a, false, 'no email in the mint');
  assert.equal('joinedAt' in a, false, 'no fabricated here-since for a legacy account (users doc had no createdAt)');
  const b = (await db.doc('profiles/' + B).get()).data();
  assert.equal(b.displayName, 'Studio Name', 'a Studio-made profile is NEVER overwritten');
  assert.equal(b.accent, 'ember');
});
