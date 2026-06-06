'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rateDecision } = require('../lib/ratelimit');

const WIN = 60000, LIM = 5;

test('first write in a fresh window is allowed', () => {
  const r = rateDecision(null, 1000, WIN, LIM);
  assert.equal(r.overLimit, false);
  assert.equal(r.nextState.count, 1);
});
test('writes up to the limit are allowed; the next is over', () => {
  let state = null;
  for (let i = 1; i <= LIM; i++) {
    const r = rateDecision(state, 1000 + i, WIN, LIM);
    assert.equal(r.overLimit, false, 'write ' + i + ' should be allowed');
    state = r.nextState;
  }
  const over = rateDecision(state, 1000 + LIM + 1, WIN, LIM);
  assert.equal(over.overLimit, true, 'the 6th write should be over the limit');
});
test('the window rolling over resets the count', () => {
  const state = { windowStart: 1000, count: 5 };
  const r = rateDecision(state, 1000 + WIN + 1, WIN, LIM); // past the window
  assert.equal(r.overLimit, false);
  assert.equal(r.nextState.count, 1);
});
