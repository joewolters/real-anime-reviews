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

// docPath: any content doc that can hold an imageRefs pointer —
//   forum/{threadId} | forum/{threadId}/posts/{postId}
//   reviews/{anime}/items/{uid}
//   comments/{anime}/items/{cid} | comments/{anime}/items/{cid}/replies/{rid}
// — or (dream profile) a profiles/{uid} doc, whose single bgRef string pointer
// works like the thumbImage variant. The anime segment allows ':' (per-season
// keys like al:101922); uid/cid/rid use the Firestore-id class. Fully anchored
// — no traversal, no subcollections beyond the listed shapes.
const DOC_PATH_RX = new RegExp(
  '^(?:'
  + 'forum\\/[A-Za-z0-9_-]{1,100}(?:\\/posts\\/[A-Za-z0-9_-]{1,100})?'
  + '|reviews\\/[A-Za-z0-9:_-]{1,100}\\/items\\/[A-Za-z0-9_-]{1,128}'
  + '|comments\\/[A-Za-z0-9:_-]{1,100}\\/items\\/[A-Za-z0-9_-]{1,128}(?:\\/replies\\/[A-Za-z0-9_-]{1,128})?'
  + '|profiles\\/[A-Za-z0-9_-]{1,128}'
  + ')$'
);

async function applyAdminRemoveImage(db, bucket, FieldValue, callerUid, docPath, imagePath) {
  if (callerUid !== ADMIN_UID) throw coded('permission-denied', 'Admins only.');
  if (typeof docPath !== 'string' || !DOC_PATH_RX.test(docPath)) {
    throw coded('invalid-argument', 'docPath must be a forum/review/comment/profile content path.');
  }
  const parsedImage = parseUploadPath(imagePath);
  if (!parsedImage) {
    throw coded('invalid-argument', 'imagePath must be an uploads/{uid}/{docId}/{imageId} path.');
  }

  // CONFUSED-DEPUTY GUARD (adversarial review, MED): docPath + imagePath both
  // flow in from an attacker-craftable report doc. Without binding them, a
  // hostile reporter could aim the admin's single click at ANY victim's image
  // (a report whose docPath is the reporter's own post but whose imagePath is
  // uploads/{victim}/...). So the object we destroy MUST be one this doc
  // actually points at — read the doc and require imagePath ∈ imageRefs.
  const snap = await db.doc(docPath).get();

  // PROFILES variant (dream profile): one bgRef string pointer, no imageRefs.
  // Binding is equality, plus the bg contract itself — the object must live
  // under THIS profile owner's own uploads/{uid}/profilebg/ prefix (a forged
  // foreign pointer must never aim the admin's click at a victim's object).
  if (docPath.indexOf('profiles/') === 0) {
    const profileUid = docPath.slice('profiles/'.length);
    const data = (snap && snap.exists && snap.data()) || {};
    if (data.bgRef !== imagePath || parsedImage.uid !== profileUid || parsedImage.docId !== 'profilebg') {
      throw coded('failed-precondition', 'That image is not attached to this profile (nothing removed).');
    }
    // Same fixed order as below: Storage object FIRST, pointer second.
    await bucket.file(imagePath).delete({ ignoreNotFound: true });
    try {
      await db.doc(docPath).update({ bgRef: FieldValue.delete() });
    } catch (_e) { /* pointer already stripped — the object is gone either way */ }
    return { ok: true, imagePath };
  }

  const refs = (snap && snap.exists && Array.isArray(snap.data().imageRefs)) ? snap.data().imageRefs : [];
  if (refs.indexOf(imagePath) === -1) {
    throw coded('failed-precondition', 'That image is not attached to this post (nothing removed).');
  }

  // 1) Storage first — the world-readable artifact goes away NOW.
  await bucket.file(imagePath).delete({ ignoreNotFound: true });

  // 2) Then the pointer(s). A concurrent redaction is fine (arrayRemove is a
  // no-op if it's already gone) — the object is deleted either way. If the
  // removed image was ALSO the thread's card thumbnail, drop that pointer too
  // (a dangling thumbImage fires a doomed getDownloadURL on every list render).
  try {
    const upd = { imageRefs: FieldValue.arrayRemove(imagePath) };
    const data = snap.data() || {};
    if (data.thumbImage === imagePath) upd.thumbImage = FieldValue.delete();
    await db.doc(docPath).update(upd);
  } catch (_e) { /* pointer already stripped — the image is gone either way */ }

  return { ok: true, imagePath };
}

module.exports = { applyAdminRemoveImage, DOC_PATH_RX };
