'use strict';

// =============================================================================
// v1.10.0 GATE 14 — admin atomic image removal (the do-the-work core behind the
// adminRemoveImage callable, lib/moderation.js-style: db/bucket/FieldValue are
// injected so index.js wires it AND cf-tests drive the same logic directly).
//
// THE LEGAL TRAP THIS EXISTS TO CLOSE: redacting only the Firestore pointer
// leaves the image world-readable in Storage (gate-0 study §3d). So the order
// is fixed: Storage object FIRST (the exposure), pointer second. If the pointer
// update fails the worst case is a dangling ref that renders as nothing —
// benign — never a live image with no pointer to find it by.
// =============================================================================

const { ADMIN_UID } = require('./moderation');
const { parseUploadPath } = require('./imagecheck');

function coded(code, message) { const e = new Error(message); e.code = code; return e; }

// docPath: the forum thread or post doc holding the pointer.
const DOC_PATH_RX = /^forum\/[A-Za-z0-9_-]{1,100}(\/posts\/[A-Za-z0-9_-]{1,100})?$/;

async function applyAdminRemoveImage(db, bucket, FieldValue, callerUid, docPath, imagePath) {
  if (callerUid !== ADMIN_UID) throw coded('permission-denied', 'Admins only.');
  if (typeof docPath !== 'string' || !DOC_PATH_RX.test(docPath)) {
    throw coded('invalid-argument', 'docPath must be a forum thread or post path.');
  }
  if (!parseUploadPath(imagePath)) {
    throw coded('invalid-argument', 'imagePath must be an uploads/{uid}/{docId}/{imageId} path.');
  }

  // CONFUSED-DEPUTY GUARD (adversarial review, MED): docPath + imagePath both
  // flow in from an attacker-craftable report doc. Without binding them, a
  // hostile reporter could aim the admin's single click at ANY victim's image
  // (a report whose docPath is the reporter's own post but whose imagePath is
  // uploads/{victim}/...). So the object we destroy MUST be one this doc
  // actually points at — read the doc and require imagePath ∈ imageRefs.
  const snap = await db.doc(docPath).get();
  const refs = (snap && snap.exists && Array.isArray(snap.data().imageRefs)) ? snap.data().imageRefs : [];
  if (refs.indexOf(imagePath) === -1) {
    throw coded('failed-precondition', 'That image is not attached to this post (nothing removed).');
  }

  // 1) Storage first — the world-readable artifact goes away NOW.
  await bucket.file(imagePath).delete({ ignoreNotFound: true });

  // 2) Then the pointer. A concurrent redaction is fine (arrayRemove is a no-op
  // if it's already gone) — the object is deleted either way.
  try {
    await db.doc(docPath).update({ imageRefs: FieldValue.arrayRemove(imagePath) });
  } catch (_e) { /* pointer already stripped — the image is gone either way */ }

  return { ok: true, imagePath };
}

module.exports = { applyAdminRemoveImage, DOC_PATH_RX };
