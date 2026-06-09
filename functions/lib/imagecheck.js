'use strict';

// =============================================================================
// v1.10.0 GATE 13 — magic-byte image sniffing (PURE — unit-tested without the
// emulator, like lib/hotscore.js). The storage.rules contentType check is
// client-asserted metadata; THIS is the server-side truth the onObjectFinalized
// CF re-validates against. A spoofed contentType (e.g. an SVG or HTML payload
// uploaded as "image/png") sniffs to null or a mismatched type → the CF deletes
// the object.
// =============================================================================

// Returns 'jpeg' | 'png' | 'webp' | 'gif' | null from the first bytes of a file.
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return 'png';
  // GIF: "GIF87a" or "GIF89a"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38
    && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) return 'gif';
  // WEBP: "RIFF" .... "WEBP"
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
    && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';
  return null;
}

// The declared contentType must agree with the sniffed bytes. image/jpg is a
// common alias clients emit; storage.rules already rejects it, but the CF stays
// tolerant-in-what-it-checks (defense in depth, not a second opinion).
function contentTypeMatches(sniffed, contentType) {
  if (!sniffed || typeof contentType !== 'string') return false;
  const declared = contentType.toLowerCase().split(';')[0].trim();
  const map = { jpeg: ['image/jpeg', 'image/jpg'], png: ['image/png'], webp: ['image/webp'], gif: ['image/gif'] };
  return (map[sniffed] || []).indexOf(declared) !== -1;
}

// Is this object path one the pipeline owns? uploads/{uid}/{docId}/{imageId},
// exactly 4 sane segments — anything else is ignored (defensive: rules already
// deny other writes, but the Admin SDK and console bypass rules).
function parseUploadPath(name) {
  if (typeof name !== 'string') return null;
  const m = name.match(/^uploads\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,100})\/([A-Za-z0-9_-]{1,120})$/);
  if (!m) return null;
  return { uid: m[1], docId: m[2], imageId: m[3] };
}

module.exports = { sniffImageType, contentTypeMatches, parseUploadPath };
