'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { sniffImageType, contentTypeMatches, parseUploadPath } = require('../lib/imagecheck');

const pad = (arr) => Buffer.from([...arr, ...new Array(Math.max(0, 16 - arr.length)).fill(0)]);

test('sniffImageType identifies the four allowed formats by magic bytes', () => {
  assert.equal(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(sniffImageType(Buffer.from('GIF89a..........')), 'gif');
  assert.equal(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPxxxx')])), 'webp');
});

test('sniffImageType rejects spoofs: SVG/HTML/scripts/empty/short', () => {
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(sniffImageType(Buffer.from('<!DOCTYPE html><script>alert(1)</script>')), null);
  assert.equal(sniffImageType(Buffer.from('GIF88a..........')), null); // wrong version byte
  assert.equal(sniffImageType(Buffer.from('RIFFxxxxWAVE....')), null); // RIFF but not WEBP
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
  assert.equal(sniffImageType(null), null);
});

test('contentTypeMatches pairs sniffed type with the declared header only', () => {
  assert.equal(contentTypeMatches('jpeg', 'image/jpeg'), true);
  assert.equal(contentTypeMatches('jpeg', 'image/jpg'), true);   // tolerated alias
  assert.equal(contentTypeMatches('png', 'image/png'), true);
  assert.equal(contentTypeMatches('png', 'IMAGE/PNG'), true);    // case-insensitive
  assert.equal(contentTypeMatches('webp', 'image/webp; charset=utf-8'), true); // params stripped
  assert.equal(contentTypeMatches('png', 'image/jpeg'), false);  // bytes/header mismatch = spoof
  assert.equal(contentTypeMatches('gif', 'image/svg+xml'), false);
  assert.equal(contentTypeMatches(null, 'image/png'), false);
  assert.equal(contentTypeMatches('png', null), false);
});

test('parseUploadPath accepts exactly uploads/{uid}/{docId}/{imageId} and nothing clever', () => {
  assert.deepEqual(parseUploadPath('uploads/u1/t1/img1'), { uid: 'u1', docId: 't1', imageId: 'img1' });
  assert.equal(parseUploadPath('uploads/u1/t1'), null);             // too few segments
  assert.equal(parseUploadPath('uploads/u1/t1/img1/extra'), null);  // too many
  assert.equal(parseUploadPath('uploads/u1/../t1/img1'), null);     // traversal
  assert.equal(parseUploadPath('avatars/u1/t1/img1'), null);        // foreign root
  assert.equal(parseUploadPath('uploads/u1/t1/im g1'), null);       // bad chars
  assert.equal(parseUploadPath(null), null);
});
