'use strict';

// =============================================================================
// v1.10.0 GATE 13 — per-user upload cap decision (PURE — unit-tested without
// the emulator). Storage rules can't count across objects, so the
// onObjectFinalized CF lists uploads/{uid}/ and asks THIS function whether the
// user is over budget; over → the freshly-finalized object is deleted (the only
// real bucket-fill defense, gate-0 study §3d).
// =============================================================================

// fileCount/totalBytes INCLUDE the just-uploaded object (the CF lists after
// finalize). Caps are inclusive: exactly at the cap is allowed.
function capDecision({ fileCount, totalBytes, maxFiles, maxBytes }) {
  const n = (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  if (n(fileCount) > n(maxFiles)) return { over: true, reason: 'files' };
  if (n(totalBytes) > n(maxBytes)) return { over: true, reason: 'bytes' };
  return { over: false, reason: null };
}

module.exports = { capDecision };
