'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { capDecision } = require('../lib/uploadcap');

test('capDecision: under both caps -> not over', () => {
  assert.deepEqual(
    capDecision({ fileCount: 10, totalBytes: 1000, maxFiles: 60, maxBytes: 5000 }),
    { over: false, reason: null });
});

test('capDecision: caps are inclusive (exactly AT the cap is allowed)', () => {
  assert.equal(capDecision({ fileCount: 60, totalBytes: 100, maxFiles: 60, maxBytes: 100 }).over, false);
});

test('capDecision: one past either cap trips the right reason', () => {
  assert.deepEqual(
    capDecision({ fileCount: 61, totalBytes: 0, maxFiles: 60, maxBytes: 100 }),
    { over: true, reason: 'files' });
  assert.deepEqual(
    capDecision({ fileCount: 1, totalBytes: 101, maxFiles: 60, maxBytes: 100 }),
    { over: true, reason: 'bytes' });
});

test('capDecision: garbage inputs coerce to 0, never throw', () => {
  assert.equal(capDecision({ fileCount: NaN, totalBytes: undefined, maxFiles: 60, maxBytes: 100 }).over, false);
  assert.equal(capDecision({ fileCount: -5, totalBytes: 'x', maxFiles: 60, maxBytes: 100 }).over, false);
});
