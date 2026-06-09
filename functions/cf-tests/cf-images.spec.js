'use strict';

// =============================================================================
// v1.10.0 GATES 13-14 — image pipeline + Storage cascade INTEGRATION tests.
// Runs inside `npm run test:cf` (functions+firestore+STORAGE emulators).
// Proves with real emulator round-trips:
//   • a spoofed contentType (HTML bytes as image/png) is DELETED by the CF
//   • a real JPEG WITH EXIF comes out re-encoded, EXIF-stripped, cfProcessed
//   • soft-remove (removed:true) sweeps the doc's images out of Storage
//   • onUserDelete sweeps the user's whole uploads/ prefix
//   • adminRemoveImage core: Storage object gone AND pointer redacted
//   • per-user dedupe: same bytes twice from one uid -> the duplicate is
//     deleted; a different uid survives; a stale hash doc self-heals
//   • comment/review hard-delete sweeps the doc's exact imageRefs objects
// =============================================================================

const { test, before } = require('node:test');
const assert = require('node:assert');
const admin = require('firebase-admin');
const sharp = require('sharp');
const { applyAdminRemoveImage } = require('../lib/images');
const { ADMIN_UID } = require('../lib/moderation');

// The trigger is PINNED to this bucket name (functions/index.js UPLOADS_BUCKET)
// so prod + practice + tests all ride the same registration.
const UPLOADS_BUCKET = 'real-anime-reviews.firebasestorage.app';

if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-rar' });
const db = admin.firestore();
const bucket = admin.storage().bucket(UPLOADS_BUCKET);

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

before(async () => {
  // warm the bucket namespace so the first upload isn't racing emulator setup
  await bucket.file('uploads/warm/w/w').save(Buffer.from('warm'), { resumable: false }).catch(() => {});
  await bucket.file('uploads/warm/w/w').delete({ ignoreNotFound: true }).catch(() => {});
});

test('pipeline: HTML bytes spoofed as image/png are DELETED by magic-byte re-validate', async () => {
  const path = 'uploads/spoofer/t1/evil1';
  await bucket.file(path).save(Buffer.from('<!DOCTYPE html><script>alert(1)</script>'), {
    resumable: false, metadata: { contentType: 'image/png' },
  });
  await waitFor(async () => !(await exists(path)));
});

test('pipeline: a real JPEG with EXIF is re-encoded — EXIF gone, cfProcessed stamped, still a JPEG', async () => {
  const path = 'uploads/honest/t1/photo1';
  const withExif = await sharp({ create: { width: 24, height: 24, channels: 3, background: { r: 120, g: 40, b: 200 } } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'RAR pipeline test', Artist: 'gps-leak-stand-in' } })
    .toBuffer();
  const inMeta = await sharp(withExif).metadata();
  assert.ok(inMeta.exif, 'precondition: the input really carries EXIF');

  await bucket.file(path).save(withExif, { resumable: false, metadata: { contentType: 'image/jpeg' } });

  const meta = await waitFor(async () => {
    const [m] = await bucket.file(path).getMetadata().catch(() => [null]);
    return m && m.metadata && m.metadata.cfProcessed === 'true' ? m : null;
  });
  assert.equal(meta.contentType, 'image/jpeg');
  const [out] = await bucket.file(path).download();
  const outMeta = await sharp(out).metadata();
  assert.equal(outMeta.format, 'jpeg');
  assert.equal(outMeta.exif, undefined, 'EXIF must be stripped by the re-encode');
});

test('cascade: soft-removing a thread sweeps its images and drops the pointer field', async () => {
  const tid = 'imgT1';
  const path = 'uploads/author1/' + tid + '/pic1';
  await bucket.file(path).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]), {
    resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
  });
  await db.doc('forum/' + tid).set({
    authorUid: 'author1', title: 'T', body: 'b', tag: 'general',
    createdAt: admin.firestore.Timestamp.now(), lastPostAt: admin.firestore.Timestamp.now(),
    postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false,
    imageRefs: [path],
  });
  await sleep(600); // let the create settle so the next write is a clean removed-edge
  await db.doc('forum/' + tid).set({ removed: true, title: '', body: '' }, { merge: true });
  await waitFor(async () => !(await exists(path)));
  await waitFor(async () => {
    const snap = await db.doc('forum/' + tid).get();
    return snap.exists && !('imageRefs' in (snap.data() || {}));
  });
});

test('cascade: soft-removing a thread sweeps a DIFFERENT replier\'s post images too (MED fix)', async () => {
  const tid = 'imgT1b';
  const opImg = 'uploads/author1/' + tid + '/op';
  const replyImg = 'uploads/replierB/replyP1/r';   // a reply authored by someone else
  for (const p of [opImg, replyImg]) {
    await bucket.file(p).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
      resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
    });
  }
  await db.doc('forum/' + tid).set({
    authorUid: 'author1', title: 'T', body: 'b', tag: 'general',
    createdAt: admin.firestore.Timestamp.now(), lastPostAt: admin.firestore.Timestamp.now(),
    postCount: 1, reportCount: 0, pinned: false, locked: false, removed: false, imageRefs: [opImg],
  });
  await db.doc('forum/' + tid + '/posts/replyP1').set({
    authorUid: 'replierB', body: 'see this', createdAt: admin.firestore.Timestamp.now(),
    likesCount: 0, reportCount: 0, removed: false, imageRefs: [replyImg],
  });
  await sleep(700);
  await db.doc('forum/' + tid).set({ removed: true, title: '', body: '' }, { merge: true });
  // BOTH the OP image AND the other author's reply image must leave Storage
  await waitFor(async () => !(await exists(opImg)) && !(await exists(replyImg)));
});

test('cascade: hard-deleting a thread sweeps a cross-author post\'s image (recursiveDelete -> onForumPostDelete)', async () => {
  const tid = 'imgHardT';
  const opImg = 'uploads/authorH/' + tid + '/op';
  const replyImg = 'uploads/replierH/hardP1/r';
  for (const p of [opImg, replyImg]) {
    await bucket.file(p).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
      resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
    });
  }
  await db.doc('forum/' + tid).set({
    authorUid: 'authorH', title: 'T', body: 'b', tag: 'general',
    createdAt: admin.firestore.Timestamp.now(), lastPostAt: admin.firestore.Timestamp.now(),
    postCount: 1, reportCount: 0, pinned: false, locked: false, removed: false, imageRefs: [opImg],
  });
  await db.doc('forum/' + tid + '/posts/hardP1').set({
    authorUid: 'replierH', body: 'x', createdAt: admin.firestore.Timestamp.now(),
    likesCount: 0, reportCount: 0, removed: false, imageRefs: [replyImg],
  });
  await sleep(500);
  await db.doc('forum/' + tid).delete(); // hard delete -> onForumThreadDelete + recursiveDelete -> onForumPostDelete
  await waitFor(async () => !(await exists(opImg)) && !(await exists(replyImg)));
});

test('cascade: a BAN sweeps the banned user\'s whole uploads/ prefix', async () => {
  const uid = 'banuser1';
  const p1 = 'uploads/' + uid + '/t/x1';
  const p2 = 'uploads/' + uid + '/p/x2';
  for (const p of [p1, p2]) {
    await bucket.file(p).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
      resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
    });
  }
  // banned/{uid} create is the cascade trigger (setBanState writes it in prod).
  await db.doc('banned/' + uid).set({ by: ADMIN_UID, at: admin.firestore.Timestamp.now(), reason: 'test', cascadeCursor: 'pending' });
  await waitFor(async () => !(await exists(p1)) && !(await exists(p2)));
});

test('cascade: onUserDelete sweeps the user\'s ENTIRE uploads/ prefix', async () => {
  const uid = 'deluser1';
  const p1 = 'uploads/' + uid + '/a/x1';
  const p2 = 'uploads/' + uid + '/b/x2';
  for (const p of [p1, p2]) {
    await bucket.file(p).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
      resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
    });
  }
  await db.doc('users/' + uid).set({ username: 'doomed' });
  await sleep(400);
  await db.doc('users/' + uid).delete();
  await waitFor(async () => !(await exists(p1)) && !(await exists(p2)));
});

test('adminRemoveImage core (against the live emulators): object gone AND pointer redacted', async () => {
  const tid = 'imgT2';
  const pid = 'imgP2';
  const path = 'uploads/author2/' + pid + '/pic1';
  await bucket.file(path).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
    resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
  });
  await db.doc('forum/' + tid).set({
    authorUid: 'author2', title: 'T', body: 'b', tag: 'general',
    createdAt: admin.firestore.Timestamp.now(), lastPostAt: admin.firestore.Timestamp.now(),
    postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false,
  });
  await db.doc('forum/' + tid + '/posts/' + pid).set({
    authorUid: 'author2', body: 'look', createdAt: admin.firestore.Timestamp.now(),
    likesCount: 0, reportCount: 0, removed: false, imageRefs: [path, 'uploads/author2/' + pid + '/keep'],
  });

  const res = await applyAdminRemoveImage(
    db, bucket, admin.firestore.FieldValue, ADMIN_UID,
    'forum/' + tid + '/posts/' + pid, path);
  assert.equal(res.ok, true);
  assert.equal(await exists(path), false, 'the Storage object must be gone');
  const snap = await db.doc('forum/' + tid + '/posts/' + pid).get();
  assert.deepEqual(snap.data().imageRefs, ['uploads/author2/' + pid + '/keep'],
    'only the removed pointer leaves the doc');
});

// =============================================================================
// IMAGE-EXPERIENCE OVERHAUL — appended: per-user dedupe (+ the self-heal path)
// and the exact-path comment/review delete sweeps. Same harness, unique
// uids/paths; the dedupe trio intentionally shares uid dd1 across (a) and (c)
// because the self-heal scenario IS "the same user re-uploads the same bytes"
// (--test-concurrency=1 keeps the order deterministic).
// =============================================================================

const { sha256Hex, hashDocId } = require('../lib/imagehash');

// A tiny REAL 1x1 PNG (the scripts/practice-serve.js fixture) — valid magic
// bytes, sharp-parseable, so the full pipeline runs on it. Pipeline-active
// uploads below OMIT cfProcessed metadata on purpose.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADgQF/e5IkGQAAAABJRU5ErkJggg==',
  'base64');

const cfProcessed = async (path) => {
  const [m] = await bucket.file(path).getMetadata().catch(() => [null]);
  return !!(m && m.metadata && m.metadata.cfProcessed === 'true');
};

test('dedupe: the SAME bytes twice from ONE user — duplicate deleted, original survives', async () => {
  const a = 'uploads/dd1/docA/img1';
  const b = 'uploads/dd1/docB/img1';
  await bucket.file(a).save(TINY_PNG, { resumable: false, metadata: { contentType: 'image/png' } });
  await waitFor(() => cfProcessed(a)); // original processed -> hash registered
  await bucket.file(b).save(TINY_PNG, { resumable: false, metadata: { contentType: 'image/png' } });
  await waitFor(async () => !(await exists(b)));
  assert.equal(await exists(a), true, 'the original must survive the dedupe');
});

test('dedupe is PER-USER: the same bytes from a DIFFERENT user survive', async () => {
  const p = 'uploads/dd2/docA/img1';
  await bucket.file(p).save(TINY_PNG, { resumable: false, metadata: { contentType: 'image/png' } });
  await waitFor(() => cfProcessed(p));
  assert.equal(await exists(p), true);
});

test('dedupe SELF-HEAL: original deleted -> the same user CAN re-upload the same bytes', async () => {
  const a = 'uploads/dd1/docA/img1'; // registered by the dedupe test above
  const c = 'uploads/dd1/docC/img1';
  await bucket.file(a).delete({ ignoreNotFound: true }); // the user deleted their original
  await bucket.file(c).save(TINY_PNG, { resumable: false, metadata: { contentType: 'image/png' } });
  await waitFor(() => cfProcessed(c)); // NOT blocked by the stale hash doc
  const reg = await db.doc('uploadHashes/' + hashDocId('dd1', sha256Hex(TINY_PNG))).get();
  assert.equal(reg.exists && reg.data().path, c, 'the registry repoints at the new object');
});

test('sweep: hard-deleting a COMMENT removes its exact imageRefs objects', async () => {
  const uid = 'cdel1';
  const path = 'uploads/' + uid + '/cdoc1/p1';
  await bucket.file(path).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
    resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
  });
  await db.doc('comments/one-punch-man/items/cdoc1').set({
    uid, text: 'look at this', createdAt: admin.firestore.Timestamp.now(),
    likesCount: 0, dislikesCount: 0, imageRefs: [path],
  });
  await sleep(400); // let the create (and its rate-limit CF) settle
  await db.doc('comments/one-punch-man/items/cdoc1').delete();
  await waitFor(async () => !(await exists(path)));
});

test('sweep: hard-deleting a REVIEW removes its exact imageRefs objects', async () => {
  const uid = 'rdel1';
  const path = 'uploads/' + uid + '/rdoc1/p1';
  await bucket.file(path).save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
    resumable: false, metadata: { contentType: 'image/jpeg', metadata: { cfProcessed: 'true' } },
  });
  await db.doc('reviews/al:101922/items/' + uid).set({
    uid, text: 'great season', rating: 8, createdAt: admin.firestore.Timestamp.now(),
    imageRefs: [path],
  });
  await sleep(400);
  await db.doc('reviews/al:101922/items/' + uid).delete();
  await waitFor(async () => !(await exists(path)));
});
