'use strict';

// CF test track — the PURE-LOGIC layer (no emulator, no Java, no Blaze).
// Run with `npm run test:functions` from Current Version/ (which is
// `node --test functions/test/`). This is deliberately separate from the
// Playwright DOM suite (`npm test`): a CSS change must never force an emulator
// boot, and a CF change must never need the browser harness. See
// docs/DATA-MODEL.md § Test plan and docs/DEPLOYMENT.md § Cloud Functions.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pingPayload } = require('../lib/ping');

test('pingPayload returns the health-check shape', () => {
  const p = pingPayload(new Date('2026-06-06T00:00:00.000Z'));
  assert.equal(p.ok, true);
  assert.equal(p.message, 'pong');
  assert.equal(p.service, 'real-anime-reviews-functions');
  assert.equal(p.at, '2026-06-06T00:00:00.000Z');
});

test('pingPayload defaults to the current time when none is given', () => {
  const before = Date.now();
  const p = pingPayload();
  const at = Date.parse(p.at);
  assert.ok(at >= before, 'timestamp should be at or after the call');
  assert.equal(p.ok, true);
});
