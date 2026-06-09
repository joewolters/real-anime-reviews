'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { sha256Hex, hashDocId } = require('../lib/imagehash');

test('sha256Hex: known input matches node crypto reference', () => {
  const input = Buffer.from('real anime reviews dedupe');
  const expected = crypto.createHash('sha256').update(input).digest('hex');
  assert.equal(sha256Hex(input), expected);
  assert.match(sha256Hex(input), /^[0-9a-f]{64}$/, 'lowercase 64-char hex');
});

test('sha256Hex: buffer and equivalent utf8 string hash the same; different bytes differ', () => {
  assert.equal(sha256Hex(Buffer.from('abc')), sha256Hex('abc'));
  assert.notEqual(sha256Hex(Buffer.from('abc')), sha256Hex(Buffer.from('abd')));
  // binary-safe: a buffer with a NUL is not the same as without
  assert.notEqual(sha256Hex(Buffer.from([0x00, 0x01])), sha256Hex(Buffer.from([0x01])));
});

test('hashDocId: uid + "__" + hash shape', () => {
  const h = sha256Hex(Buffer.from('x'));
  assert.equal(hashDocId('user123', h), 'user123__' + h);
  // the same bytes under two DIFFERENT uids key two DIFFERENT registry docs
  assert.notEqual(hashDocId('userA', h), hashDocId('userB', h));
});
