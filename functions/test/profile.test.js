'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { likeDelta, shouldNotifyLike, likeNotifId, bgSweepDecision } = require('../lib/profile');

// ---- likeDelta (existence-based; value defensively pinned to 1) ----
test('likeDelta: fresh like (create) -> +1', () => {
  assert.equal(likeDelta(null, { uid: 'fan', value: 1 }), 1);
});
test('likeDelta: unlike (delete) -> -1', () => {
  assert.equal(likeDelta({ uid: 'fan', value: 1 }, null), -1);
});
test('likeDelta: an update (1 -> 1) and a no-op (null -> null) both net 0', () => {
  assert.equal(likeDelta({ value: 1 }, { value: 1, updatedAt: 2 }), 0);
  assert.equal(likeDelta(null, null), 0);
});
test('likeDelta: value != 1 contributes 0 on either side (likes are LIKE-ONLY)', () => {
  assert.equal(likeDelta(null, { value: 2 }), 0);     // injected inflation attempt
  assert.equal(likeDelta(null, { value: -1 }), 0);    // dislikes don't exist on people
  assert.equal(likeDelta({ value: 0 }, null), 0);
  assert.equal(likeDelta({ value: '1' }, null), 0);   // strict equality — no coercion
});

// ---- shouldNotifyLike (CREATE only, never self) ----
test('shouldNotifyLike: a fresh like from another user notifies', () => {
  assert.equal(shouldNotifyLike(null, { value: 1 }, 'owner', 'fan'), true);
});
test('shouldNotifyLike: a SELF-like never notifies (defense in depth — rules already deny it)', () => {
  assert.equal(shouldNotifyLike(null, { value: 1 }, 'me', 'me'), false);
});
test('shouldNotifyLike: an unlike (delete) or an update never notifies', () => {
  assert.equal(shouldNotifyLike({ value: 1 }, null, 'owner', 'fan'), false);
  assert.equal(shouldNotifyLike({ value: 1 }, { value: 1 }, 'owner', 'fan'), false);
});
test('shouldNotifyLike: a create with value != 1 never notifies', () => {
  assert.equal(shouldNotifyLike(null, { value: 2 }, 'owner', 'fan'), false);
});
test('likeNotifId is deterministic per liker (re-like overwrites, never stacks)', () => {
  assert.equal(likeNotifId('fan1'), 'pl_fan1');
});

// ---- bgSweepDecision (the edit-strip sweeper's whole brain) ----
const BG = 'uploads/owner1/profilebg/img1';
test('bgSweep: an UNCHANGED bgRef no-ops (the hot path — every likesCount bump lands here)', () => {
  assert.deepEqual(
    bgSweepDecision({ bgRef: BG, likesCount: 1 }, { bgRef: BG, likesCount: 2 }, 'owner1'),
    { sweep: false, path: null });
});
test('bgSweep: a changed / removed bgRef and a profile DOC DELETE all sweep the OLD object', () => {
  assert.deepEqual(bgSweepDecision({ bgRef: BG }, { bgRef: 'uploads/owner1/profilebg/img2' }, 'owner1'),
    { sweep: true, path: BG });                                        // background swapped
  assert.deepEqual(bgSweepDecision({ bgRef: BG }, { displayName: 'O' }, 'owner1'),
    { sweep: true, path: BG });                                        // bgRef field dropped
  assert.deepEqual(bgSweepDecision({ bgRef: BG }, null, 'owner1'),
    { sweep: true, path: BG });                                        // doc deleted
});
test('bgSweep: a FOREIGN-prefix ref is refused — never delete outside the owner\'s profilebg', () => {
  assert.equal(bgSweepDecision({ bgRef: 'uploads/victim/profilebg/img1' }, null, 'owner1').sweep, false);
  assert.equal(bgSweepDecision({ bgRef: 'uploads/owner1/forumdoc/img1' }, null, 'owner1').sweep, false);
  assert.equal(bgSweepDecision({ bgRef: 'avatars/owner1/a' }, null, 'owner1').sweep, false);
  assert.equal(bgSweepDecision({ bgRef: 'uploads/owner1/profilebg/../x' }, null, 'owner1').sweep, false);
});
test('bgSweep: no/garbage prior bgRef -> nothing to sweep', () => {
  assert.equal(bgSweepDecision(null, { bgRef: BG }, 'owner1').sweep, false);          // doc create
  assert.equal(bgSweepDecision({ displayName: 'O' }, null, 'owner1').sweep, false);   // never had a bg
  assert.equal(bgSweepDecision({ bgRef: 42 }, null, 'owner1').sweep, false);          // non-string junk
});
