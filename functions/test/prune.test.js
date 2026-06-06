'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notifsToPrune } = require('../lib/prune');

const ids = (n) => Array.from({ length: n }, (_, i) => 'n' + i); // newest-first

test('nothing to prune at or under the cap', () => {
  assert.deepEqual(notifsToPrune(ids(10), 10), []);
  assert.deepEqual(notifsToPrune(ids(3), 10), []);
});
test('prunes everything past the newest 10', () => {
  assert.deepEqual(notifsToPrune(ids(11), 10), ['n10']);
  assert.deepEqual(notifsToPrune(ids(13), 10), ['n10', 'n11', 'n12']);
});
test('respects a custom keep', () => {
  assert.deepEqual(notifsToPrune(ids(5), 3), ['n3', 'n4']);
});
test('defensive on bad input', () => {
  assert.deepEqual(notifsToPrune(null, 10), []);
  assert.deepEqual(notifsToPrune(ids(12)), ['n10', 'n11']); // default keep=10
});
