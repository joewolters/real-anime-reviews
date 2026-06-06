'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shouldNotify, isMuted } = require('../lib/notify');

test('notifies on a like from another user', () => {
  assert.equal(shouldNotify('voter', 'author', 1), true);
});
test('notifies on a dislike from another user', () => {
  assert.equal(shouldNotify('voter', 'author', -1), true);
});
test('does NOT notify on self-vote', () => {
  assert.equal(shouldNotify('me', 'me', 1), false);
});
test('does NOT notify on an unvote (value 0/null)', () => {
  assert.equal(shouldNotify('voter', 'author', 0), false);
  assert.equal(shouldNotify('voter', 'author', null), false);
});
test('does NOT notify when author is unknown', () => {
  assert.equal(shouldNotify('voter', null, 1), false);
});
test('isMuted reads the prefs map', () => {
  assert.equal(isMuted({ muted: { comment_vote: true } }, 'comment_vote'), true);
  assert.equal(isMuted({ muted: { comment_vote: true } }, 'review_vote'), false);
  assert.equal(isMuted(null, 'comment_vote'), false);
  assert.equal(isMuted({}, 'comment_vote'), false);
});
