'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { applyAdminRemoveImage } = require('../lib/images');
const { ADMIN_UID } = require('../lib/moderation');

// fakes record the ORDER of operations — the legal-trap invariant is
// "Storage object deleted BEFORE the pointer is touched". `refs` is what the
// doc's imageRefs returns from .get() (the confused-deputy binding check).
function fakes(refs, docExtra) {
  const calls = [];
  const updates = [];
  const bucket = { file: (p) => ({ delete: async () => { calls.push('storage:' + p); } }) };
  const db = { doc: (p) => ({
    get: async () => ({ exists: true, data: () => Object.assign({ imageRefs: refs || [] }, docExtra || {}) }),
    update: async (u) => { calls.push('doc:' + p); updates.push(u); },
  }) };
  const FieldValue = { arrayRemove: (v) => ({ __arrayRemove: v }), delete: () => ({ __delete: true }) };
  return { calls, updates, bucket, db, FieldValue };
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

test('adminRemoveImage: removing the image that IS the thread thumbnail also drops thumbImage', async () => {
  const img = 'uploads/u/t1/i1';
  const { updates, db, bucket, FieldValue } = fakes([img], { thumbImage: img });
  await applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, 'forum/t1', img);
  assert.ok(updates[0].thumbImage && updates[0].thumbImage.__delete, 'thumbImage must be deleted with the pointer');
  // and when the thumb is a DIFFERENT image, it survives
  const f2 = fakes([img], { thumbImage: 'uploads/u/t1/other' });
  await applyAdminRemoveImage(f2.db, f2.bucket, f2.FieldValue, ADMIN_UID, 'forum/t1', img);
  assert.equal('thumbImage' in f2.updates[0], false);
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

test('adminRemoveImage: REVIEW + COMMENT + REPLY doc paths accepted (image overhaul surfaces)', async () => {
  const img = 'uploads/u/p1/i1';
  const ok = async (docPath) => {
    const { db, bucket, FieldValue } = fakes([img]);
    assert.equal((await applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, docPath, img)).ok, true, docPath);
  };
  await ok('reviews/al:101922/items/someUid28');         // per-season anime key with ':'
  await ok('comments/one-punch-man/items/c1');           // top-level comment
  await ok('comments/al:101922/items/c1/replies/r2');    // depth-1 reply
});

test('adminRemoveImage: non-content / truncated / traversal docPaths all rejected', async () => {
  const bad = async (docPath) => {
    const { calls, db, bucket, FieldValue } = fakes(['uploads/u/p1/i1']);
    await assert.rejects(
      applyAdminRemoveImage(db, bucket, FieldValue, ADMIN_UID, docPath, 'uploads/u/p1/i1'),
      /docPath/, docPath);
    assert.deepEqual(calls, [], docPath + ' must touch nothing');
  };
  await bad('users/x');                                  // not a content surface
  await bad('reviews/al:101922');                        // truncated — anime doc, not an item
  await bad('comments/one-punch-man');                   // truncated
  await bad('comments/a/items/c1/replies/r1/votes/v1');  // too deep
  await bad('reviews/../items/u1');                      // traversal junk
  await bad('comments/a b/items/c1');                    // illegal segment chars
  await bad('xreviews/a/items/u1');                      // unanchored-prefix probe
});
