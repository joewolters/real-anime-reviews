'use strict';

// =============================================================================
// v1.10.0 DREAM PROFILE — pure decision cores behind onProfileLike and the
// profile-background edit-strip sweeper (unit-tested without the emulator,
// lib/votecounts.js-style). index.js wires these; keeping the decisions here
// keeps the CFs thin and the security calls provable offline.
//
// Data contract (enforced by firestore.rules, re-checked here because CFs run
// with rules bypassed):
//   profiles/{uid}/likes/{likerUid} = { uid: likerUid, value: 1, updatedAt }
//     — LIKE-ONLY (value always 1; dislikes don't exist on people), unlike = delete.
//   profiles/{uid}.bgRef = 'uploads/{uid}/profilebg/{imageId}' (rides the
//     existing upload pipeline; docId 'profilebg' parses like any other).
// =============================================================================

const { parseUploadPath } = require('./imagecheck');

// A like doc's contribution to profiles/{uid}.likesCount. Rules pin value to 1,
// but the CF reads DEFENSIVELY: anything that isn't exactly 1 counts for 0
// (a console-injected value:2 doc must never inflate the public number).
function likeContribution(d) {
  return d && d.value === 1 ? 1 : 0;
}

// create -> +1, delete -> -1, update (1 -> 1) -> 0 — existence-based, so a
// metadata-only rewrite of a live like nets nothing.
function likeDelta(before, after) {
  return likeContribution(after) - likeContribution(before);
}

// Ping the profile owner only on a fresh CREATE of a real like — never on a
// delete (an unlike must not ping) or an update (a rewrite must not re-ping) —
// and NEVER on a self-like (rules deny it; defense in depth here).
function shouldNotifyLike(before, after, uid, likerUid) {
  return !before
    && likeContribution(after) === 1
    && !!likerUid
    && likerUid !== uid;
}

// DETERMINISTIC notification id: an unlike/re-like toggle OVERWRITES the same
// doc (set, not add) instead of stacking a fresh ping per flip — the spam
// vector a per-event add() would hand every fickle fan.
function likeNotifId(likerUid) {
  return 'pl_' + likerUid;
}

// bgSweepDecision — should a profiles/{uid} write sweep the OLD background
// object out of Storage, and which object? Sweep when before.bgRef is a string
// and the doc was deleted OR bgRef moved/vanished. The unchanged-bgRef no-op is
// LOAD-BEARING: onProfileLike bumps likesCount on this same doc constantly, and
// every one of those writes lands here first. OWNER-PREFIX FENCE: only ever
// delete inside uploads/{uid}/profilebg/ — a forged/foreign bgRef must never
// aim the sweep at someone else's object.
function bgSweepDecision(beforeData, afterData, uid) {
  const prev = beforeData && typeof beforeData.bgRef === 'string' ? beforeData.bgRef : null;
  if (!prev) return { sweep: false, path: null };                                 // nothing to strip
  if (afterData && afterData.bgRef === prev) return { sweep: false, path: null }; // unchanged — the hot path
  const parsed = parseUploadPath(prev);
  if (!parsed || parsed.uid !== uid || parsed.docId !== 'profilebg') {
    return { sweep: false, path: null }; // outside the owner's profilebg prefix — refuse
  }
  return { sweep: true, path: prev };
}

module.exports = { likeDelta, shouldNotifyLike, likeNotifId, bgSweepDecision };
