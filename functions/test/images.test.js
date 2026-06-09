'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { applyAdminRemoveImage } = require('../lib/images');
const { ADMIN_UID } = require('../lib/moderation');

// fakes record the ORDER of operations — the legal-trap invariant is
// "Storage object deleted BEFORE the pointer is touched". `refs` is what the
// doc's imageRefs returns from .get() (the confused-deputy binding check).
function fakes(refs) {
  const calls = [];
  const bucket = { file: (p) => ({ delete: async () => { calls.push('storage:' + p); } }) };
  const db = { doc: (p) => ({
    get: async () => ({ exists: true, data: () => ({ imageRefs: refs || [] }) }),
    update: async () => { calls.push('doc:' + p); },
  }) };
  const FieldValue = { arrayRemove: (v) => ({ __arrayRemove: v }) };
  return { calls, bucket, db, FieldValue };
}

test('adminRemoveImage: non-admin caller is DENIED', async () => {
  const { db, bucket, FieldValue } = fakes();
  await assert.rejects(
    applyAdminRemoveImage(db, bucket, FieldValue, 'mallory', 'forum/t1', 'uploads/u/t1/i1'),
    /Admins only/);
});

test('adminRemoveImage: bad docPath / bad imagePath are rejected before any deletion', async () => {
  const { calls, db, bucket, FieldValue } = fakes();
  await assert.rejects(
    applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, 'users/u1', 'uploads/u/t1/i1'),
    /docPath/);
  await assert.rejects(
    applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, 'forum/t1', 'https://evil/x'),
    /imagePath/);
  assert.deepEqual(calls, []); // nothing touched on validation failure
});

test('adminRemoveImage: happy path — Storage FIRST, pointer second, both hit', async () => {
  const { calls, db, bucket, FieldValue } = fakes(['uploads/u/p1/i1']);
  const res = await applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, 'forum/t1/posts/p1', 'uploads/u/p1/i1');
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ['storage:uploads/u/p1/i1', 'doc:forum/t1/posts/p1']);
});

test('adminRemoveImage: CONFUSED-DEPUTY guard — an imagePath NOT in the doc\'s imageRefs deletes NOTHING', async () => {
  // a hostile report: docPath = attacker's own post, imagePath = victim's image
  const { calls, db, bucket, FieldValue } = fakes(['uploads/attacker/p1/own']);
  await assert.rejects(
    applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, 'forum/t1/posts/p1', 'uploads/victim/p9/img'),
    /not attached/);
  assert.deepEqual(calls, []); // the victim's object was NOT touched
});

test('adminRemoveImage: a vanished doc removes nothing (binding fails — image handled by the cascade)', async () => {
  const { calls, bucket, FieldValue } = fakes();
  const db = { doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }), update: async () => {} }) };
  await assert.rejects(
    applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, 'forum/t1', 'uploads/u/t1/i1'),
    /not attached/);
  assert.deepEqual(calls, []);
});

test('adminRemoveImage: thread AND post doc paths both accepted; subcollection junk is not', async () => {
  const { db, bucket, FieldValue } = fakes(['uploads/u/t1/i1']);
  assert.equal((await applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, 'forum/t1', 'uploads/u/t1/i1')).ok, true);
  await assert.rejects(
    applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, 'forum/t1/posts/p1/votes/v1', 'uploads/u/t1/i1'),
    /docPath/);
});
