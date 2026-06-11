'use strict';

// =============================================================================
// v1.10.0 GATE 20 — Storage GC: the imageRefs EDIT-STRIP diff + the daily
// ORPHAN REAPER. The one pre-prod gap (NEXT.md): gate 14 swept images on
// DELETE/REMOVE paths only, so two holes stranded world-readable objects
// forever (the gate-14 legal-trap class on paths no cascade sees):
//   (a) an owner EDIT that drops a ref from imageRefs — the doc survives, the
//       dropped object doesn't get swept;
//   (b) an upload whose doc-create never landed (tab closed mid-flow — the
//       client uploads FIRST, then creates the doc, script.js hubUploadImages).
// Decisions live here, lib/profile.js-style (pure, provable offline);
// reapUploadsOrphans takes db+bucket like lib/images.js so cf-tests can drive
// it without the scheduler. index.js wires both.
// =============================================================================

const { parseUploadPath } = require('./imagecheck');

const DAY_MS = 86400000;
// Younger than a day = presumed MID-FLOW: the client creates the referencing
// doc seconds after the upload, but "seconds" under a flaky connection is
// minutes — a generous window costs pennies, a premature delete is
// user-visible data loss.
const ORPHAN_MIN_AGE_MS = DAY_MS;
// One run's delete budget — a pathological run (lookup bug, bucket flood)
// stays cost- and blast-radius-bounded; the next daily run finishes the job.
const ORPHAN_DELETE_CAP = 500;

// stripSweepDecision — bgSweepDecision's multi-ref twin: which Storage objects
// did THIS update orphan? present-before-but-absent-after, and nothing else.
// OWNER-PREFIX FENCE as in sweepImageRefs: each candidate must parse as a
// pipeline path AND belong to the doc's own author — a forged ref can never
// aim the sweep at someone else's object. after.thumbImage counts as live too:
// the thread card thumb / A4 review cover is picked FROM imageRefs, and a
// skewed edit that drops the ref but keeps the pointer must not dangle it.
// afterData == null (doc delete) is NOT this lane — the onDocumentDeleted
// sweepers own that class; no-op'ing here keeps the two from double-owning.
function stripSweepDecision(beforeData, afterData, uid) {
  const prev = beforeData && Array.isArray(beforeData.imageRefs) ? beforeData.imageRefs : [];
  if (!prev.length) return { sweep: false, paths: [] }; // nothing to strip — the hot path (count/hotScore merges)
  if (!afterData) return { sweep: false, paths: [] };   // delete edge — sweepImageRefs / the cascades own it
  // gate-20 adversarial: a PRESENT-but-non-array imageRefs is malformed state
  // (rules pin `is list`, so only privileged writes could produce it) — keep
  // everything rather than read it as "all dropped". An ABSENT field stays a
  // legitimate remove-all (deleteField is the owner's clear-images path).
  if (('imageRefs' in afterData) && !Array.isArray(afterData.imageRefs)) return { sweep: false, paths: [] };
  // ACCEPTED (adversarial MED, self-harm only): the fence is uid-level, not
  // doc-pinned — path docId tokens deliberately don't equal Firestore doc ids
  // on every surface (reviews use rev-<key>), so a doc-id pin would break
  // legitimate sweeps. A console-crafted edit can therefore only ever aim the
  // sweep at the SAME OWNER's other objects — content they can delete anyway.
  const kept = new Set(Array.isArray(afterData.imageRefs) ? afterData.imageRefs : []);
  if (typeof afterData.thumbImage === 'string') kept.add(afterData.thumbImage);
  const paths = [];
  for (const entry of prev) {
    if (kept.has(entry)) continue;                       // still referenced after — NEVER delete
    const parsed = parseUploadPath(entry);
    if (!parsed || !uid || parsed.uid !== uid) continue; // garbage / foreign-prefix — refuse
    if (!paths.includes(entry)) paths.push(entry);       // a doubled dropped entry sweeps once
  }
  return { sweep: paths.length > 0, paths };
}

// orphanDecision — may the reaper delete this object? KEEP on ANY uncertainty:
// the path must parse as pipeline-owned, the age must be a real number past
// the mid-flow window, and referencingDocExists must be the LITERAL false —
// a lookup error / unknown passes null|undefined and keeps the object.
function orphanDecision(objectPath, ageMs, referencingDocExists) {
  if (!parseUploadPath(objectPath)) return { del: false, reason: 'unparsed' };
  if (typeof ageMs !== 'number' || !Number.isFinite(ageMs) || ageMs < ORPHAN_MIN_AGE_MS) {
    return { del: false, reason: 'young' };
  }
  if (referencingDocExists === true) return { del: false, reason: 'referenced' };
  if (referencingDocExists !== false) return { del: false, reason: 'uncertain' };
  return { del: true, reason: 'orphan' };
}

// referencedUploadPaths — every Storage path the user's OWN docs still point
// at (imageRefs + thumbImage across all five imageRefs surfaces, + the
// profilebg pointer). The query shapes are EXACTLY onUserDelete's (items /
// replies by uid, posts / forum by authorUid) so the indexes that already
// serve the account wipe serve this — no new firestore.indexes.json entry.
// THROWS on any failure — the caller must KEEP that user's objects.
async function referencedUploadPaths(db, uid) {
  const refs = new Set();
  const harvest = (snap) => snap.forEach((d) => {
    const x = d.data() || {};
    if (Array.isArray(x.imageRefs)) x.imageRefs.forEach((r) => { if (typeof r === 'string') refs.add(r); });
    if (typeof x.thumbImage === 'string') refs.add(x.thumbImage);
  });
  const [items, replies, posts, threads, prof] = await Promise.all([
    db.collectionGroup('items').where('uid', '==', uid).get(), // comments + reviews both live under items/
    db.collectionGroup('replies').where('uid', '==', uid).get(),
    db.collectionGroup('posts').where('authorUid', '==', uid).get(),
    db.collection('forum').where('authorUid', '==', uid).get(),
    db.doc('profiles/' + uid).get(),
  ]);
  [items, replies, posts, threads].forEach(harvest);
  if (prof.exists && typeof (prof.data() || {}).bgRef === 'string') refs.add(prof.data().bgRef);
  return refs;
}

// reapUploadsOrphans — one reaper pass: list uploads/, group past-window
// candidates by uid (ONE referenced-set query fan per user, not per object),
// delete what orphanDecision clears, cap the run. nowMs is injectable so
// cf-tests can run "a day later" without a real day (the emulator can't
// backdate timeCreated). Known race, accepted: a console-crafted edit that
// re-attaches a >24h-old path between the lookup and the delete loses the
// object — the real client only ever attaches freshly-uploaded paths.
async function reapUploadsOrphans(db, bucket, opts) {
  const nowMs = opts && Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const cap = opts && Number.isFinite(opts.cap) ? opts.cap : ORPHAN_DELETE_CAP;
  const [files] = await bucket.getFiles({ prefix: 'uploads/' });

  const byUid = new Map();
  for (const f of files) {
    const parsed = parseUploadPath(f.name);
    if (!parsed) continue; // not pipeline-shaped — never ours to delete
    const created = Date.parse(f.metadata && f.metadata.timeCreated);
    const ageMs = Number.isFinite(created) ? nowMs - created : NaN; // NaN -> orphanDecision keeps
    if (!byUid.has(parsed.uid)) byUid.set(parsed.uid, []);
    byUid.get(parsed.uid).push({ name: f.name, ageMs });
  }

  let deleted = 0;
  let kept = 0;
  for (const [uid, objects] of byUid) {
    if (deleted >= cap) { kept += objects.length; continue; }
    // skip the query fan when nothing of this user's is past the window
    if (!objects.some((o) => Number.isFinite(o.ageMs) && o.ageMs >= ORPHAN_MIN_AGE_MS)) {
      kept += objects.length;
      continue;
    }
    let refs;
    try { refs = await referencedUploadPaths(db, uid); }
    catch (_e) { kept += objects.length; continue; } // lookup failed -> KEEP all of theirs this run
    for (const o of objects) {
      const dec = orphanDecision(o.name, o.ageMs, refs.has(o.name));
      if (dec.del && deleted < cap) {
        await bucket.file(o.name).delete({ ignoreNotFound: true }).catch(() => {});
        deleted++; // count the ATTEMPT — the cap bounds cost, not success
      } else {
        kept++;
      }
    }
  }
  return { deleted, kept };
}

module.exports = {
  stripSweepDecision,
  orphanDecision,
  referencedUploadPaths,
  reapUploadsOrphans,
  ORPHAN_MIN_AGE_MS,
  ORPHAN_DELETE_CAP,
};
