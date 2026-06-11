'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stripSweepDecision, orphanDecision, reapUploadsOrphans, ORPHAN_MIN_AGE_MS } = require('../lib/sweep');

// ---- stripSweepDecision (the edit-strip sweepers' whole brain) ----
const A = 'uploads/owner1/doc1/imgA';
const B = 'uploads/owner1/doc1/imgB';

test('strip: dropping one ref sweeps THAT object only', () => {
  assert.deepEqual(
    stripSweepDecision({ imageRefs: [A, B], uid: 'owner1' }, { imageRefs: [A] }, 'owner1'),
    { sweep: true, paths: [B] });
});

test('strip: unchanged imageRefs no-op — the hot path (count/hotScore merges land here constantly)', () => {
  assert.deepEqual(
    stripSweepDecision({ imageRefs: [A, B] }, { imageRefs: [A, B], likesCount: 7 }, 'owner1'),
    { sweep: false, paths: [] });
});

test('strip: NEVER delete a ref still present after — reorder + doubled-then-singled net nothing', () => {
  assert.equal(stripSweepDecision({ imageRefs: [A, B] }, { imageRefs: [B, A] }, 'owner1').sweep, false);
  assert.equal(stripSweepDecision({ imageRefs: [A, A] }, { imageRefs: [A] }, 'owner1').sweep, false);
});

test('strip: after.thumbImage counts as a live ref (the card thumb / A4 cover must not dangle)', () => {
  assert.equal(stripSweepDecision({ imageRefs: [A, B] }, { imageRefs: [A], thumbImage: B }, 'owner1').sweep, false);
});

test('strip: a doubled DROPPED entry is swept once', () => {
  assert.deepEqual(stripSweepDecision({ imageRefs: [B, B] }, { imageRefs: [] }, 'owner1').paths, [B]);
});

test('strip: imageRefs vanishing entirely sweeps every own-prefix entry', () => {
  assert.deepEqual(stripSweepDecision({ imageRefs: [A, B] }, { body: 'edited' }, 'owner1'),
    { sweep: true, paths: [A, B] });
});

test('strip: foreign-prefix / garbage refs are REFUSED (the forged-ref fence, as in sweepImageRefs)', () => {
  assert.equal(stripSweepDecision({ imageRefs: ['uploads/victim/doc1/x'] }, { imageRefs: [] }, 'owner1').sweep, false);
  assert.equal(stripSweepDecision({ imageRefs: ['avatars/owner1/a'] }, { imageRefs: [] }, 'owner1').sweep, false);
  assert.equal(stripSweepDecision({ imageRefs: ['uploads/owner1/doc1/../x'] }, { imageRefs: [] }, 'owner1').sweep, false);
  assert.equal(stripSweepDecision({ imageRefs: [42, null] }, { imageRefs: [] }, 'owner1').sweep, false);
});

test('strip: a missing owner uid refuses everything', () => {
  assert.equal(stripSweepDecision({ imageRefs: [A] }, { imageRefs: [] }, null).sweep, false);
  assert.equal(stripSweepDecision({ imageRefs: [A] }, { imageRefs: [] }, undefined).sweep, false);
});

test('strip: missing / non-array fields tolerated; create and delete edges are NOT this lane', () => {
  assert.equal(stripSweepDecision({ body: 'no images' }, { body: 'still none' }, 'owner1').sweep, false);
  assert.equal(stripSweepDecision({ imageRefs: 'junk' }, { imageRefs: [] }, 'owner1').sweep, false);
  assert.equal(stripSweepDecision(null, { imageRefs: [A] }, 'owner1').sweep, false);  // create
  assert.equal(stripSweepDecision({ imageRefs: [A] }, null, 'owner1').sweep, false);  // delete — the onDocumentDeleted sweepers own it
});

// ---- orphanDecision (KEEP on ANY uncertainty) ----
const OLD = ORPHAN_MIN_AGE_MS + 1;

test('orphan: old + unreferenced + pipeline-shaped -> delete', () => {
  assert.deepEqual(orphanDecision(A, OLD, false), { del: true, reason: 'orphan' });
});

test('orphan: younger than the mid-flow window -> keep (the doc-create may still be coming)', () => {
  assert.equal(orphanDecision(A, ORPHAN_MIN_AGE_MS - 1, false).del, false);
  assert.equal(orphanDecision(A, 0, false).del, false);
});

test('orphan: a garbage age -> keep (never delete on uncertainty)', () => {
  assert.equal(orphanDecision(A, NaN, false).del, false);
  assert.equal(orphanDecision(A, '999999999999', false).del, false); // strings never coerce
  assert.equal(orphanDecision(A, undefined, false).del, false);
});

test('orphan: referenced -> keep; lookup-uncertain (anything but the literal false) -> keep', () => {
  assert.deepEqual(orphanDecision(A, OLD, true), { del: false, reason: 'referenced' });
  assert.equal(orphanDecision(A, OLD, null).del, false);
  assert.equal(orphanDecision(A, OLD, undefined).del, false);
  assert.equal(orphanDecision(A, OLD, 0).del, false); // falsy is not false
});

test('orphan: a non-pipeline path is never ours to delete', () => {
  assert.equal(orphanDecision('avatars/u1/a', OLD, false).del, false);
  assert.equal(orphanDecision('uploads/u1/only-three', OLD, false).del, false);
  assert.equal(orphanDecision('uploads/u1/d/../x', OLD, false).del, false);
});

// ---- reapUploadsOrphans against hand-rolled fakes (no emulator, no scheduler) ----
// The fake db answers every query with the SAME doc set (the Set union dedups
// the 4× harvest); the fake bucket records what got deleted.
function fakeEnv({ files, docs = [], profile = null, failQueries = false }) {
  const deleted = [];
  const bucket = {
    getFiles: async () => [files.map((f) => ({ name: f.name, metadata: { timeCreated: f.timeCreated } }))],
    file: (name) => ({ delete: async () => { deleted.push(name); } }),
  };
  const snap = { forEach: (cb) => docs.forEach((d) => cb({ data: () => d })) };
  const query = {
    where: () => query,
    get: async () => { if (failQueries) throw new Error('emulated outage'); return snap; },
  };
  const db = {
    collectionGroup: () => query,
    collection: () => query,
    doc: () => ({ get: async () => (profile ? { exists: true, data: () => profile } : { exists: false, data: () => ({}) }) }),
  };
  return { db, bucket, deleted };
}

const NOW = 1750000000000;
const oldTs = new Date(NOW - 2 * ORPHAN_MIN_AGE_MS).toISOString();
const freshTs = new Date(NOW - 60000).toISOString();

test('reap: deletes the stale orphan; keeps the referenced and the fresh', async () => {
  const env = fakeEnv({
    files: [
      { name: 'uploads/u1/ghost/o1', timeCreated: oldTs },
      { name: 'uploads/u1/doc1/r1', timeCreated: oldTs },
      { name: 'uploads/u1/mid/f1', timeCreated: freshTs },
    ],
    docs: [{ imageRefs: ['uploads/u1/doc1/r1'] }],
  });
  const res = await reapUploadsOrphans(env.db, env.bucket, { nowMs: NOW });
  assert.deepEqual(env.deleted, ['uploads/u1/ghost/o1']);
  assert.equal(res.deleted, 1);
  assert.equal(res.kept, 2);
});

test('reap: a doc thumbImage counts as referencing', async () => {
  const env = fakeEnv({
    files: [{ name: 'uploads/u1/t1/cover', timeCreated: oldTs }],
    docs: [{ thumbImage: 'uploads/u1/t1/cover' }],
  });
  await reapUploadsOrphans(env.db, env.bucket, { nowMs: NOW });
  assert.deepEqual(env.deleted, []);
});

test('reap: profiles bgRef counts as referencing (the profilebg surface)', async () => {
  const env = fakeEnv({
    files: [{ name: 'uploads/u1/profilebg/bg1', timeCreated: oldTs }],
    profile: { bgRef: 'uploads/u1/profilebg/bg1' },
  });
  await reapUploadsOrphans(env.db, env.bucket, { nowMs: NOW });
  assert.deepEqual(env.deleted, []);
});

test('reap: a doc-lookup failure KEEPS that user\'s objects this run', async () => {
  const env = fakeEnv({
    files: [{ name: 'uploads/u1/ghost/o1', timeCreated: oldTs }],
    failQueries: true,
  });
  const res = await reapUploadsOrphans(env.db, env.bucket, { nowMs: NOW });
  assert.deepEqual(env.deleted, []);
  assert.equal(res.deleted, 0);
  assert.equal(res.kept, 1);
});

test('reap: missing timeCreated -> keep (uncertain age)', async () => {
  const env = fakeEnv({ files: [{ name: 'uploads/u1/ghost/o1', timeCreated: undefined }] });
  await reapUploadsOrphans(env.db, env.bucket, { nowMs: NOW });
  assert.deepEqual(env.deleted, []);
});

test('reap: non-pipeline names in the listing are never candidates', async () => {
  const env = fakeEnv({ files: [{ name: 'uploads/u1/only-three', timeCreated: oldTs }] });
  const res = await reapUploadsOrphans(env.db, env.bucket, { nowMs: NOW });
  assert.deepEqual(env.deleted, []);
  assert.equal(res.deleted, 0);
});

test('reap: the per-run delete cap bounds one pass (the next daily run finishes)', async () => {
  const files = [];
  for (let i = 0; i < 5; i++) files.push({ name: 'uploads/u1/ghost/o' + i, timeCreated: oldTs });
  const env = fakeEnv({ files });
  const res = await reapUploadsOrphans(env.db, env.bucket, { nowMs: NOW, cap: 2 });
  assert.equal(res.deleted, 2);
  assert.equal(env.deleted.length, 2);
  assert.equal(res.kept, 3);
});
