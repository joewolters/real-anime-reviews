'use strict';
// =============================================================================
// milestone E rider — PROFILES BACKFILL, the users-GET tightening's enabler.
// users/{uid} docs carry emails and were world-GETtable only because author
// identity had a legacy fallback to them (profiles/ docs were minted ONLY by
// the account Studio save — gate 20.5 proved owner-only GETs tombstone active
// pre-Studio members). Two halves close it for good:
//   • applyBackfillProfiles (admin-only callable core): one-shot mint of a
//     minimal profiles/{uid} for every users/-only account. Admin SDK, so the
//     consent gate on client profiles writes doesn't strand anyone.
//   • mintProfileForUser (the users/{uid} onCreate trigger core): every FUTURE
//     signup gets its minimal profile at birth — no post-backfill stragglers.
// Both mint the SAME minimal shape {displayName, photoURL, joinedAt?} and
// NEVER overwrite an existing profiles doc (the Studio save owns the rest).
// joinedAt: the trigger stamps now (truthful at signup); the backfill copies
// users.createdAt when present and otherwise OMITS it — a backfilled veteran
// must never read "here since <today>" on their sheet.
// =============================================================================
const { ADMIN_UID } = require('./moderation');

const ALLOWED_AVATAR = /^(https:\/\/(firebasestorage\.googleapis\.com|lh3\.googleusercontent\.com)|http:\/\/127\.0\.0\.1:9199)\//;

function minimalProfile(userData, joinedAt) {
  const u = userData || {};
  const out = {};
  const name = (typeof u.displayName === 'string' && u.displayName.trim()) ? u.displayName.trim()
    : (typeof u.username === 'string' && u.username.trim()) ? u.username.trim() : '';
  if (name) out.displayName = name.slice(0, 60);
  // PART A item 5 — do NOT mint a photoURL the rules would reject.
  // users/{uid} has no shape validation and the pre-profile-era account page
  // let members type any avatar URL, so copying it verbatim (Admin SDK, rules
  // bypassed) planted a value in profiles/{uid} that no later client save could
  // ever re-send: every Studio save came back PERMISSION_DENIED, permanently.
  // Mirrors the photoURL clause of profileFieldsOk() in firestore.rules.
  if (typeof u.photoURL === 'string' && ALLOWED_AVATAR.test(u.photoURL)) out.photoURL = u.photoURL;
  if (joinedAt) out.joinedAt = joinedAt;
  return out;
}

// mint iff missing — shared by the trigger and the backfill loop. A
// TRANSACTION on purpose: the trigger's mint can be delivered LATE, after
// onUserDelete already wiped the account (signup → instant delete) — a plain
// set would resurrect a ghost profile for a deleted user (the cf-suite's
// no-ghost guard caught exactly this). The txn re-checks the users doc is
// still alive and the profile still absent at write time.
async function mintIfMissing(db, uid, userData, joinedAt) {
  const userRef = db.collection('users').doc(uid);
  const profRef = db.collection('profiles').doc(uid);
  return db.runTransaction(async (txn) => {
    const [user, prof] = await Promise.all([txn.get(userRef), txn.get(profRef)]);
    if (!user.exists || prof.exists) return false;
    txn.set(profRef, minimalProfile(userData || user.data(), joinedAt));
    return true;
  });
}

// the users/{uid} onCreate trigger core (Admin SDK — consent-gate immune)
async function mintProfileForUser(db, FieldValue, uid, userData) {
  if (!uid) return { ok: false };
  const minted = await mintIfMissing(db, uid, userData, FieldValue.serverTimestamp());
  return { ok: true, minted };
}

// the one-shot admin callable core (the setBanState literal-UID gate)
async function applyBackfillProfiles(db, callerUid) {
  if (!callerUid || callerUid !== ADMIN_UID) {
    const e = new Error('Only the admin can run the backfill.');
    e.code = 'permission-denied';
    throw e;
  }
  const users = await db.collection('users').get();
  let minted = 0, existing = 0;
  for (const d of users.docs) {
    const u = d.data() || {};
    const joinedAt = (u.createdAt && typeof u.createdAt.toMillis === 'function') ? u.createdAt : null;
    if (await mintIfMissing(db, d.id, u, joinedAt)) minted++; else existing++;
  }
  return { ok: true, minted, existing, total: users.size };
}

module.exports = { applyBackfillProfiles, mintProfileForUser, minimalProfile };
