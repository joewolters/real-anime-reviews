'use strict';

// =============================================================================
// v1.10.0 GATE 12 — storage.rules EMULATOR tests (the bucket lock, proven).
// Same discipline as rules.spec.js: every HOSTILE path DENIED, happy allowed.
// Run via `npm run test:rules` (firestore+storage emulators — the storage rules
// cross-read moderationGate/commentsMeta from the firestore emulator).
// Adversarial focus (SHIP-PROMPT): non-owner write? unverified? banned?
// un-consented? SVG? oversize? kill-switch off? list/enumerate leak?
// =============================================================================

const { test, before, after, beforeEach } = require('node:test');
const { readFileSync } = require('node:fs');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const { ref, uploadBytes, getBytes, deleteObject, listAll } = require('firebase/storage');

const ADMIN = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const JPEG = { contentType: 'image/jpeg' };
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]); // tiny jpeg-ish payload
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rar',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
after(async () => { if (env) await env.cleanup(); });

// verified=true is the default actor shape (Blake's chosen upload gate is
// email-verified); the unverified case is its own DENY test below.
const stAs = (uid, claims) => env.authenticatedContext(uid, Object.assign({ email_verified: true }, claims)).storage();
const stAnon = () => env.unauthenticatedContext().storage();
const seedFs = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));
const seedSt = (fn) => env.withSecurityRulesDisabled((c) => fn(c.storage()));

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  // alice + ADMIN consented & not banned; "banned" is banned; "fresh" has the
  // exact acceptRules-minted shape: {consentVersion:1} with NO banned field.
  await seedFs(async (db) => {
    await setDoc(doc(db, 'moderationGate/alice'), { banned: false, consentVersion: 1 });
    await setDoc(doc(db, 'moderationGate/' + ADMIN), { banned: false, consentVersion: 1 });
    await setDoc(doc(db, 'moderationGate/banned'), { banned: true, consentVersion: 1 });
    await setDoc(doc(db, 'moderationGate/fresh'), { consentVersion: 1 });
  });
});

// ---------------- the happy path ----------------
test('storage: happy upload — owner, consented, verified, small jpeg', async () => {
  await assertSucceeds(uploadBytes(ref(stAs('alice'), 'uploads/alice/happy/img1'), BYTES, JPEG));
});
test('storage: acceptRules-minted gate doc (NO banned field) still uploads — the .get(banned,false) regression', async () => {
  await assertSucceeds(uploadBytes(ref(stAs('fresh'), 'uploads/fresh/t1/img1'), BYTES, JPEG));
});
test('storage: png/webp/gif contentTypes allowed', async () => {
  // NOTE: `resource == null` in storage.rules forbids overwriting an existing
  // object, and the @firebase/rules-unit-testing clearStorage() is not reliably
  // synchronous between tests — so every "fresh upload SUCCEEDS" case uses a
  // UNIQUE path (a per-test docId) to stay isolated from a lingering object.
  await assertSucceeds(uploadBytes(ref(stAs('alice'), 'uploads/alice/types/p1'), BYTES, { contentType: 'image/png' }));
  await assertSucceeds(uploadBytes(ref(stAs('alice'), 'uploads/alice/types/w1'), BYTES, { contentType: 'image/webp' }));
  await assertSucceeds(uploadBytes(ref(stAs('alice'), 'uploads/alice/types/g1'), BYTES, { contentType: 'image/gif' }));
});

// ---------------- ownership ----------------
test('storage: HOSTILE write into ANOTHER user\'s prefix is DENIED', async () => {
  await assertFails(uploadBytes(ref(stAs('alice'), 'uploads/bob/t1/img1'), BYTES, JPEG));
});
test('storage: HOSTILE anonymous upload is DENIED', async () => {
  await assertFails(uploadBytes(ref(stAnon(), 'uploads/alice/t1/img1'), BYTES, JPEG));
});

// ---------------- the moderation spine ----------------
test('storage: HOSTILE upload by a BANNED user is DENIED', async () => {
  await assertFails(uploadBytes(ref(stAs('banned'), 'uploads/banned/t1/img1'), BYTES, JPEG));
});
test('storage: HOSTILE upload with NO consent (no moderationGate doc) is DENIED', async () => {
  await assertFails(uploadBytes(ref(stAs('mallory'), 'uploads/mallory/t1/img1'), BYTES, JPEG));
});
test('storage: HOSTILE upload with UNVERIFIED email is DENIED', async () => {
  await assertFails(uploadBytes(ref(stAs('alice', { email_verified: false }), 'uploads/alice/t1/img1'), BYTES, JPEG));
});

// ---------------- content constraints ----------------
test('storage: HOSTILE SVG upload is DENIED (script-bearing type)', async () => {
  await assertFails(uploadBytes(ref(stAs('alice'), 'uploads/alice/t1/svg1'), BYTES, { contentType: 'image/svg+xml' }));
});
test('storage: HOSTILE non-image contentType is DENIED', async () => {
  await assertFails(uploadBytes(ref(stAs('alice'), 'uploads/alice/t1/x1'), BYTES, { contentType: 'text/html' }));
});
test('storage: HOSTILE oversize upload (>5MB) is DENIED', async () => {
  const big = new Uint8Array(5 * 1024 * 1024 + 1);
  await assertFails(uploadBytes(ref(stAs('alice'), 'uploads/alice/t1/big1'), big, JPEG));
});
test('storage: HOSTILE clever path segments (dots) are DENIED', async () => {
  await assertFails(uploadBytes(ref(stAs('alice'), 'uploads/alice/t1/img.1.x'), BYTES, JPEG));
});

// ---------------- the kill-switch ----------------
test('storage: kill-switch OFF (uploadsEnabled:false) DENIES everyone, admin included', async () => {
  await seedFs((db) => setDoc(doc(db, 'commentsMeta/uploads'), { uploadsEnabled: false }));
  await assertFails(uploadBytes(ref(stAs('alice'), 'uploads/alice/t1/img1'), BYTES, JPEG));
  await assertFails(uploadBytes(ref(stAs(ADMIN), 'uploads/' + ADMIN + '/t1/img1'), BYTES, JPEG));
});
test('storage: kill-switch doc present + enabled:true still allows', async () => {
  await seedFs((db) => setDoc(doc(db, 'commentsMeta/uploads'), { uploadsEnabled: true }));
  await assertSucceeds(uploadBytes(ref(stAs('alice'), 'uploads/alice/ksON/img1'), BYTES, JPEG));
});

// ---------------- read / list / immutability / delete ----------------
test('storage: public single-object read is allowed (anon get)', async () => {
  await seedSt((st) => uploadBytes(ref(st, 'uploads/alice/t1/img1'), BYTES, JPEG));
  await assertSucceeds(getBytes(ref(stAnon(), 'uploads/alice/t1/img1')));
});

// ---------------- gate A5: the DM-image SEAL (server-side) ----------------
// A DM image at uploads/{sender}/dm-{convId}/{id} must NOT be world-readable
// (the client "accept to view" chip is cosmetic — a hostile recipient reads
// imgRef straight off the message doc). Sealed to participants + non-request.
test('storage A5: a DM-request image is SEALED — sender reads own, recipient + anon + stranger DENIED', async () => {
  await seedFs((db) => setDoc(doc(db, 'conversations/convREQ'),
    { participants: ['alice', 'bob'], kind: 'peer', state: 'request', creatorUid: 'alice' }));
  await seedSt((st) => uploadBytes(ref(st, 'uploads/alice/dm-convREQ/img1'), BYTES, JPEG));
  await assertSucceeds(getBytes(ref(stAs('alice'), 'uploads/alice/dm-convREQ/img1')));   // the sender sees own
  await assertFails(getBytes(ref(stAs('bob'), 'uploads/alice/dm-convREQ/img1')));        // the recipient CANNOT pre-accept
  await assertFails(getBytes(ref(stAs('carol'), 'uploads/alice/dm-convREQ/img1')));      // a non-participant NEVER
  await assertFails(getBytes(ref(stAnon(), 'uploads/alice/dm-convREQ/img1')));           // anon NEVER (was public)
});
test('storage A5: once the letter is OPEN, the recipient reads; a stranger still cannot', async () => {
  await seedFs((db) => setDoc(doc(db, 'conversations/convOPEN'),
    { participants: ['alice', 'bob'], kind: 'peer', state: 'open', creatorUid: 'alice' }));
  await seedSt((st) => uploadBytes(ref(st, 'uploads/alice/dm-convOPEN/img1'), BYTES, JPEG));
  await assertSucceeds(getBytes(ref(stAs('bob'), 'uploads/alice/dm-convOPEN/img1')));    // accepted → unsealed
  await assertFails(getBytes(ref(stAs('carol'), 'uploads/alice/dm-convOPEN/img1')));     // still not a participant
});
test('storage A5: a group image reads for members (groups are always open); non-members DENIED', async () => {
  await seedFs((db) => setDoc(doc(db, 'conversations/convGRP'),
    { participants: ['alice', 'bob', 'carol'], kind: 'group', state: 'open', creatorUid: 'alice', name: 'g' }));
  await seedSt((st) => uploadBytes(ref(st, 'uploads/alice/dm-convGRP/img1'), BYTES, JPEG));
  await assertSucceeds(getBytes(ref(stAs('bob'), 'uploads/alice/dm-convGRP/img1')));
  await assertFails(getBytes(ref(stAs('dave'), 'uploads/alice/dm-convGRP/img1')));       // not in the group
});
test('storage: HOSTILE list/enumerate is DENIED — even for the owner, even admin', async () => {
  await seedSt((st) => uploadBytes(ref(st, 'uploads/alice/t1/img1'), BYTES, JPEG));
  await assertFails(listAll(ref(stAnon(), 'uploads/alice/t1')));
  await assertFails(listAll(ref(stAs('alice'), 'uploads/alice/t1')));
  await assertFails(listAll(ref(stAs(ADMIN), 'uploads/alice/t1')));
});
test('storage: HOSTILE client overwrite of an existing object is DENIED (immutable)', async () => {
  await seedSt((st) => uploadBytes(ref(st, 'uploads/alice/t1/img1'), BYTES, JPEG));
  await assertFails(uploadBytes(ref(stAs('alice'), 'uploads/alice/t1/img1'), BYTES, JPEG));
});
test('storage: owner may delete own object; a stranger may NOT', async () => {
  await seedSt((st) => uploadBytes(ref(st, 'uploads/alice/t1/img1'), BYTES, JPEG));
  await assertFails(deleteObject(ref(stAs('bob'), 'uploads/alice/t1/img1')));
  await assertSucceeds(deleteObject(ref(stAs('alice'), 'uploads/alice/t1/img1')));
});
test('storage: admin may delete anyone\'s object', async () => {
  await seedSt((st) => uploadBytes(ref(st, 'uploads/alice/t1/img1'), BYTES, JPEG));
  await assertSucceeds(deleteObject(ref(stAs(ADMIN), 'uploads/alice/t1/img1')));
});

// ---------------- avatars (the pre-gate-12 live feature — cutover-saver) ----------------
test('storage: avatar upload — owner happy; stranger/oversize/wrong-name DENIED; public read', async () => {
  const png = { contentType: 'image/png' };
  await assertSucceeds(uploadBytes(ref(stAs('alice', { email_verified: false }), 'avatars/alice/profile.png'), BYTES, png));
  await assertFails(uploadBytes(ref(stAs('bob'), 'avatars/alice/profile.png'), BYTES, png));        // not the owner
  await assertFails(uploadBytes(ref(stAs('alice'), 'avatars/alice/evil.html'), BYTES, { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(stAs('alice'), 'avatars/alice/profile.png'), new Uint8Array(2 * 1024 * 1024 + 1), png));
  await assertSucceeds(getBytes(ref(stAnon(), 'avatars/alice/profile.png')));                       // avatars render site-wide
});

// ---------------- default-deny everywhere else ----------------
test('storage: HOSTILE write OUTSIDE uploads/ is DENIED (default-deny proven)', async () => {
  await assertFails(uploadBytes(ref(stAs('alice'), 'random/evil.html'), BYTES, { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(stAs(ADMIN), 'root.txt'), BYTES, { contentType: 'text/plain' }));
});
test('storage: HOSTILE read outside uploads/ is DENIED', async () => {
  await seedSt((st) => uploadBytes(ref(st, 'private/secret.bin'), BYTES, JPEG));
  await assertFails(getBytes(ref(stAnon(), 'private/secret.bin')));
  await assertFails(getBytes(ref(stAs('alice'), 'private/secret.bin')));
});
