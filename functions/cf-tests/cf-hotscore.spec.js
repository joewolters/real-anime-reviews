'use strict';

// =============================================================================
// GATE 9 (v1.10.0) — pure unit assertions for lib/hotscore.js. No emulator: this
// just exercises the formula. Runs in the same test:cf batch for convenience, but
// boots no Firestore (it never touches admin / the db).
// =============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hotScore } = require('../lib/hotscore');

const HOUR = 3600000;

test('hotScore: a higher net-vote thread (same age) scores higher', () => {
  const now = Date.now();
  const args = { postCount: 0, createdAtMs: now - 2 * HOUR, nowMs: now };
  const lo = hotScore({ ...args, likes: 1, dislikes: 0 });
  const hi = hotScore({ ...args, likes: 10, dislikes: 0 });
  assert.ok(hi > lo, 'more net likes => higher score');
});

test('hotScore: a younger thread (same votes) scores higher', () => {
  const now = Date.now();
  const votes = { likes: 5, dislikes: 0, postCount: 2 };
  const young = hotScore({ ...votes, createdAtMs: now - 1 * HOUR, nowMs: now });
  const old = hotScore({ ...votes, createdAtMs: now - 48 * HOUR, nowMs: now });
  assert.ok(young > old, 'a younger thread decays less => higher score');
});

test('hotScore: dislikes pull the score down; postCount lifts it', () => {
  const now = Date.now();
  const base = { createdAtMs: now - 2 * HOUR, nowMs: now };
  const withDislikes = hotScore({ ...base, likes: 5, dislikes: 4, postCount: 0 });
  const noDislikes = hotScore({ ...base, likes: 5, dislikes: 0, postCount: 0 });
  assert.ok(noDislikes > withDislikes, 'dislikes lower the score');
  const busier = hotScore({ ...base, likes: 5, dislikes: 0, postCount: 6 });
  assert.ok(busier > noDislikes, '0.5*postCount lifts the score');
});

test('hotScore: missing / NaN inputs are treated as 0 (never NaN)', () => {
  const s = hotScore({});
  assert.equal(s, 0, 'all-empty => numerator 0 => score 0');
  const s2 = hotScore({ likes: NaN, dislikes: undefined, postCount: null, createdAtMs: 'x', nowMs: Date.now() });
  assert.ok(Number.isFinite(s2), 'NaN/garbage inputs must not yield NaN');
});

test('hotScore: a future createdAt clamps ageHours to 0 (no negative age blowup)', () => {
  const now = Date.now();
  const future = hotScore({ likes: 4, dislikes: 0, postCount: 0, createdAtMs: now + 5 * HOUR, nowMs: now });
  const exactlyNow = hotScore({ likes: 4, dislikes: 0, postCount: 0, createdAtMs: now, nowMs: now });
  assert.equal(future, exactlyNow, 'ageHours floors at 0');
  assert.equal(future, 4 / Math.pow(2, 1.5), 'matches (likes)/(0+2)^1.5');
});
