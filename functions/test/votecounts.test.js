'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { voteCountDeltas } = require('../lib/votecounts');

test('new like (null -> 1)', () => {
  assert.deepEqual(voteCountDeltas(null, 1), { likesDelta: 1, dislikesDelta: 0 });
});
test('new dislike (null -> -1)', () => {
  assert.deepEqual(voteCountDeltas(null, -1), { likesDelta: 0, dislikesDelta: 1 });
});
test('unvote a like (1 -> null)', () => {
  assert.deepEqual(voteCountDeltas(1, null), { likesDelta: -1, dislikesDelta: 0 });
});
test('flip like to dislike (1 -> -1)', () => {
  assert.deepEqual(voteCountDeltas(1, -1), { likesDelta: -1, dislikesDelta: 1 });
});
test('flip dislike to like (-1 -> 1)', () => {
  assert.deepEqual(voteCountDeltas(-1, 1), { likesDelta: 1, dislikesDelta: -1 });
});
test('no-op (null -> null)', () => {
  assert.deepEqual(voteCountDeltas(null, null), { likesDelta: 0, dislikesDelta: 0 });
});
