'use strict';

// =============================================================================
// v1.10.0 GATE 20.5 — the GOLD-FLIP's MIGRATION half (the do-the-work core
// behind the migrateRequestThread callable, lib/moderation.js-style: db is
// injected so index.js wires it AND cf-tests drive the same logic directly).
//
// THE ARC THIS CLOSES: a fan starts a Tavern thread on a not-yet-reviewed
// anime (tag 'anime:al:<aniListId>' — cover, no gold). Blake reviews it. This
// retags those threads to 'anime:<slug>' so they GAIN the gold verdict rail —
// "be the first to talk about this" → "now Blake-reviewed".
//
// WHY A CALLABLE (admin passes the slug) AND NOT A TRIGGER: the slug truth
// lives ONLY in animeData.js (client-side catalog), and AniList titles ≠
// Blake's Excel titles, so a CF cannot derive the slug from the suggestion doc
// safely. The admin suggestions page picks the catalog title and hands the
// slug in. (Designed in docs/NEXT.md, GATE 20.5 item 1.)
// =============================================================================

const { ADMIN_UID } = require('./moderation');

// A coded Error so the onCall wrapper can map message -> HttpsError code.
function coded(code, message) { const e = new Error(message); e.code = code; return e; }

// ⚠️ MUST STAY IN SYNC WITH firestore.rules' forum tag enum:
//   tag.matches('anime:[a-z0-9-]{1,100}')   — the slug shape + cap we mint
//   tag.matches('anime:al:[0-9]{1,12}')     — the AniList shape we match
const SLUG_RX = /^[a-z0-9-]{1,100}$/;
const MAX_ANILIST_ID = 999999999999; // rules' anime:al:[0-9]{1,12} digit cap

// Per-call doc cap: one batch, well under Firestore's 500-write limit. A
// request-anime thread population past 50 for ONE title is not a real shape;
// the call is idempotent by nature (a re-run queries the OLD tag and finds 0,
// or finds + retags any remainder), so a follow-up call drains any excess.
const MIGRATE_CAP = 50;

// migrateRequestThread core — retag every forum thread carrying
// 'anime:al:<anilistId>' to 'anime:<slug>'. Tag field ONLY; every other field
// (title, body, counts, pinned/locked/removed, animeTitle, coverImage,
// imageRefs…) is deliberately untouched — the thread keeps its history, it
// just docks at the verdict rail.
async function applyMigrateRequestThread(db, callerUid, anilistIdRaw, slugRaw) {
  if (callerUid !== ADMIN_UID) throw coded('permission-denied', 'Admins only.');

  // anilistId: number or numeric string -> positive int (suggestion docs store
  // a number; the admin row's dataset attribute hands back a string).
  const anilistId = (typeof anilistIdRaw === 'number' || typeof anilistIdRaw === 'string')
    ? Number(anilistIdRaw) : NaN;
  if (!Number.isInteger(anilistId) || anilistId <= 0 || anilistId > MAX_ANILIST_ID) {
    throw coded('invalid-argument', 'anilistId must be a positive integer.');
  }

  if (typeof slugRaw !== 'string' || !SLUG_RX.test(slugRaw)) {
    throw coded('invalid-argument', 'slug must match [a-z0-9-]{1,100} (the anime:<slug> tag shape).');
  }

  const snaps = await db.collection('forum')
    .where('tag', '==', 'anime:al:' + anilistId)
    .limit(MIGRATE_CAP)
    .get();
  if (snaps.empty) return { migrated: 0 };

  const batch = db.batch();
  snaps.docs.forEach((d) => batch.update(d.ref, { tag: 'anime:' + slugRaw }));
  await batch.commit();
  return { migrated: snaps.size };
}

module.exports = { applyMigrateRequestThread, SLUG_RX, MIGRATE_CAP };
