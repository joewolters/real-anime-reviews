'use strict';

// =============================================================================
// v1.10.0 GATE 2 — moderation spine cores (ban + community-rules consent).
// -----------------------------------------------------------------------------
// These are the do-the-work functions behind the acceptRules / setBanState
// callables and the onBanCascade trigger. They take the admin `db` + `FieldValue`
// (and a best-effort claim-setter) as params so index.js can wire the CFs AND the
// cf-tests can drive the exact same logic against the emulator.
//
// ⚠️ MUST STAY IN SYNC WITH firestore.rules:
//   • CURRENT_RULES_VERSION === rulesVersion() (currently 1).
//   • ADMIN_UID === isAdmin()'s hardcoded literal.
//   • profiles/{uid}.isBanned — applySetBanState mirrors the ban state onto the
//     PUBLIC profile doc (both ways: ban -> true, unban -> false) so gate-16
//     profile tombstones have a world-readable signal (moderationGate is owner/
//     admin-read-only). The rules must keep isBanned OUT of the owner-writable
//     profile key set — only this CF write (which bypasses rules) may set it.
// A drift here silently breaks the gate (consent never satisfies, or a ban never
// reads). The cf-tests cross-check both against the live rules.
// =============================================================================

const CURRENT_RULES_VERSION = 1;
const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const CASCADE_PAGE = 200;

// A coded Error so the onCall wrapper can map message -> HttpsError code.
function coded(code, message) { const e = new Error(message); e.code = code; return e; }

// acceptRules — mints/refreshes the caller's `moderationGate.consentVersion` + the
// `rulesConsent/{uid}` record, SERVER-SIDE (the rules make both CF-only, so a
// client can never self-attest). This is the load-bearing one: it gives a fresh
// user their FIRST moderationGate doc — the doc the entire gate-1 spine reads.
async function applyAcceptRules(db, FieldValue, uid, version) {
  if (!uid) throw coded('unauthenticated', 'Sign in to accept the community rules.');
  if (version !== CURRENT_RULES_VERSION) {
    throw coded('failed-precondition', 'Rules version mismatch — reload the page and try again.');
  }
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.doc('rulesConsent/' + uid), { version: CURRENT_RULES_VERSION, at: now }, { merge: true });
  batch.set(db.doc('moderationGate/' + uid), { consentVersion: CURRENT_RULES_VERSION }, { merge: true });
  await batch.commit();
  return { ok: true, version: CURRENT_RULES_VERSION };
}

// setBanState — admin-only. Writes the rules-truth: `banned/{uid}` (the audit doc,
// whose CREATE triggers onBanCascade) + `moderationGate.banned` (the read-hot field
// the gate checks) + the PUBLIC `profiles/{uid}.isBanned` mirror (gate-16 profile
// tombstones read it; see the sync warning above). A custom auth claim rides along
// as durability (best-effort — the doc gate is primary, so a claim failure is
// harmless). Unban reverses all.
async function applySetBanState(db, FieldValue, setClaim, callerUid, targetUid, banned, reason) {
  if (callerUid !== ADMIN_UID) throw coded('permission-denied', 'Admins only.');
  if (!targetUid || typeof targetUid !== 'string') throw coded('invalid-argument', 'A target uid is required.');
  if (targetUid === ADMIN_UID) throw coded('invalid-argument', 'The admin account cannot be banned.');
  const safeReason = (typeof reason === 'string') ? reason.slice(0, 500) : null;

  if (banned) {
    await db.doc('banned/' + targetUid).set(
      { by: callerUid, at: FieldValue.serverTimestamp(), reason: safeReason, cascadeCursor: 'pending' },
      { merge: true }
    );
    await db.doc('moderationGate/' + targetUid).set({ banned: true }, { merge: true });
    await db.doc('profiles/' + targetUid).set({ isBanned: true }, { merge: true });
  } else {
    await db.doc('banned/' + targetUid).delete();
    await db.doc('moderationGate/' + targetUid).set({ banned: false }, { merge: true });
    await db.doc('profiles/' + targetUid).set({ isBanned: false }, { merge: true });
  }
  // Belt-and-suspenders: a future-minted token self-denies even on a missed doc
  // read. Best-effort (no auth emulator in test:cf; doc gate is the real one).
  try { if (setClaim) await setClaim(targetUid, banned); } catch (_e) { /* doc gate is primary */ }
  return { ok: true, uid: targetUid, banned: !!banned };
}

// redactionFor — PURE: which fields to empty on a doc + the `removed` tombstone
// flag. Only touches fields the doc actually has (a forum thread has title+body; a
// comment has text), so we never add an irrelevant empty field to a doc.
function redactionFor(docData, fields) {
  const upd = { removed: true };
  for (const k of Object.keys(fields)) { if (docData && k in docData) upd[k] = fields[k]; }
  return upd;
}

// redactAuthored — H5-redact every doc a query returns, in batches of CASCADE_PAGE.
async function redactAuthored(db, query, fields) {
  const snap = await query.get();
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += CASCADE_PAGE) {
    const batch = db.batch();
    snap.docs.slice(i, i + CASCADE_PAGE).forEach((d) => { batch.set(d.ref, redactionFor(d.data(), fields), { merge: true }); n++; });
    await batch.commit();
  }
  return n;
}

// runBanCascade — on a ban, REDACT (don't delete) the banned user's authored
// backlog so the audit trail + report linkage survive (empty the content + mark
// removed), then LOCK their conversations (message-create requires state=='open').
// Batched; completes in one invocation for any realistic author (maxInstances:10
// bounds the blast radius). Stamps cascadeCursor 'done'. Idempotent: re-redacting
// already-empty content is a no-op. (A pathological >tens-of-thousands-of-docs
// author would want cross-invocation continuation — a noted future hardening; the
// rules gate already stops NEW writes instantly, so the cascade only cleans backlog.)
async function runBanCascade(db, FieldValue, uid) {
  let redacted = 0;
  redacted += await redactAuthored(db, db.collectionGroup('items').where('uid', '==', uid), { title: '', body: '', text: '' });
  redacted += await redactAuthored(db, db.collection('forum').where('authorUid', '==', uid), { title: '', body: '' });
  redacted += await redactAuthored(db, db.collectionGroup('posts').where('authorUid', '==', uid), { body: '' });
  redacted += await redactAuthored(db, db.collectionGroup('threads').where('uid', '==', uid), { text: '' });
  redacted += await redactAuthored(db, db.collectionGroup('replies').where('uid', '==', uid), { text: '' });

  const convos = await db.collection('conversations').where('participants', 'array-contains', uid).get();
  if (!convos.empty) {
    const cbatch = db.batch();
    convos.forEach((d) => cbatch.set(d.ref, { state: 'locked', lockedByBan: true }, { merge: true }));
    await cbatch.commit();
  }

  await db.doc('banned/' + uid).set(
    { cascadeCursor: 'done', redactedCount: redacted, cascadedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return redacted;
}

module.exports = {
  CURRENT_RULES_VERSION, ADMIN_UID, CASCADE_PAGE,
  applyAcceptRules, applySetBanState, runBanCascade, redactAuthored, redactionFor,
};
