'use strict';

// =============================================================================
// Image-experience overhaul — PER-USER upload dedupe hashing (PURE — unit-tested
// without the emulator, like lib/uploadcap.js).
//
// THE DEDUPE DESIGN: Blake's rule is "no 2 same images" (anti-spam). Chosen
// scope is PER-USER: one user can never upload the same exact bytes twice, but
// two DIFFERENT users posting the same popular panel stays legal. The
// processUploadedImage CF hashes the ORIGINAL uploaded bytes (BEFORE the sharp
// re-encode — re-encoding isn't byte-stable across sharp versions, the raw
// bytes are) and keys a registry doc at uploadHashes/{uid}__{sha256hex}. A hit
// whose registered object still exists in the bucket marks the new upload a
// DUPLICATE (deleted, never re-encoded). A hit whose object is GONE self-heals:
// hash docs are never cascade-swept, so a stale doc must not permanently block
// a legitimate re-upload of an image the user deleted.
// =============================================================================

const crypto = require('node:crypto');

// sha256 of a Buffer (or string — crypto coerces), lowercase hex.
function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// The registry doc id: '{uid}__{hashHex}'. uid first so the per-user scope is
// structural (two users with identical bytes get two distinct docs); '__' can't
// appear in a Firebase uid, so the id is unambiguous.
function hashDocId(uid, hashHex) {
  return uid + '__' + hashHex;
}

module.exports = { sha256Hex, hashDocId };
