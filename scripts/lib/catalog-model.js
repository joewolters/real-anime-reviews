/**
 * CLOUD MIGRATION — the shared catalog model.
 * ============================================================================
 * ONE definition of: the slug, the Firestore document shape, and the
 * animeData.js renderer. catalog-export.js, catalog-verify.js and
 * tests/catalog-migration.spec.js all import from here, so the round-trip can
 * never drift between the tool that writes it and the test that proves it.
 *
 * Phase 2 note: scripts/sync-excel-to-js.js still carries its own copy of the
 * renderer. That is deliberate for now — this migration must not modify the
 * shipping pipeline. The byte-equality test pins the two together, and Phase 2
 * deletes the duplicate by pointing the sync at this module.
 *
 * Authored: Code, 2026-08-09.  Docs: docs/CLOUD-MIGRATION-STUDY.md
 * ============================================================================
 */
'use strict';

/**
 * THE canonical slug — must match script.js:484 and card-render.js:31 exactly.
 * It is the Firestore room id for every existing comment and community review,
 * so a change here silently orphans live member content.
 * (NOT sync-excel-to-js.js's slugify(), which also strips apostrophes; that one
 * is only used to guess image filenames.)
 */
function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Fields the generator always emits, in emission order. */
const ALWAYS = ['Title', 'Genre', 'Rating', 'image', 'Seasons', 'Description', 'Review', 'Tags', 'Studio', 'Platforms', 'Trailer'];
/**
 * Fields emitted only when present.
 *
 * v2.3.4 — `AniListCover` is APPENDED, never inserted. renderBody emits the
 * optional fields in this order, and the round-trip test compares the generated
 * body byte-for-byte with the shipped one, so moving an existing name here would
 * rewrite all 45 entries for nothing. New names go on the end.
 *
 * AniListCover is the remote cover URL. It exists so an anime ALWAYS has a
 * picture: the local `assets/<image>` file is the fast path, and this is what the
 * card falls back to when that file is not there yet — which is exactly the
 * window between Blake pressing Publish and the art being deployed.
 */
const OPTIONAL = ['Top10Rank', 'AniListId', 'IdMal', 'AniListScore', 'AniListColor', 'TitleEnglish', 'TitleRomaji', 'TitleNative', 'WatchedAniListIds', 'KnownAniListIds', 'AniListCover'];

/** Parse an animeData.js source string into the array. */
function parseAnimeData(text) {
  const fn = new Function(String(text).replace(/^\s*export\s+.*$/gm, '') + '\n;return animeData;');
  return fn();
}

/**
 * animeData array -> Firestore `catalog/{animeId}` documents.
 * Throws on a slug collision (two titles that would share a comment room).
 */
function toDocs(list) {
  const docs = [];
  const seen = new Map();
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const s = slug(a.Title);
    if (seen.has(s)) throw new Error(`slug collision "${s}": ${seen.get(s)} vs ${a.Title}`);
    seen.set(s, a.Title);
    const doc = { animeId: s, slug: s, order: i };
    for (const f of ALWAYS) doc[f] = a[f];
    for (const f of OPTIONAL) if (a[f] !== undefined) doc[f] = a[f];
    doc.updatedBy = 'migration';
    doc.updatedAt = null;
    doc.publishedAt = null;
    docs.push(doc);
  }
  return docs;
}

/**
 * catalog documents -> the animeData.js body (everything from `const animeData`
 * onward). Mirrors sync-excel-to-js.js renderJsFile() byte-for-byte.
 */
function renderBody(docs) {
  const esc = (s) => JSON.stringify(s);
  const arr = (a) => '[' + a.map(esc).join(',') + ']';
  const lines = [];
  lines.push('const animeData = [');
  for (const a of docs) {
    lines.push('  {');
    lines.push(`    Title: ${esc(a.Title)},`);
    lines.push(`    Genre: ${esc(a.Genre)},`);
    lines.push(`    Rating: ${esc(a.Rating)},`);
    lines.push(`    image: ${esc(a.image)},`);
    lines.push(`    Seasons: ${esc(a.Seasons)},`);
    lines.push(`    Description: ${esc(a.Description)},`);
    lines.push(`    Review: ${esc(a.Review)},`);
    lines.push(`    Tags: ${arr(a.Tags)},`);
    lines.push(`    Studio: ${esc(a.Studio)},`);
    lines.push(`    Platforms: ${arr(a.Platforms)},`);
    lines.push(`    Trailer: ${esc(a.Trailer)}`);
    if (a.Top10Rank != null) lines.push(`    ,Top10Rank: ${a.Top10Rank}`);
    if (a.AniListId != null) lines.push(`    ,AniListId: ${a.AniListId}`);
    if (a.IdMal != null) lines.push(`    ,IdMal: ${a.IdMal}`);
    if (a.AniListScore != null) lines.push(`    ,AniListScore: ${a.AniListScore}`);
    if (a.AniListColor != null) lines.push(`    ,AniListColor: ${esc(a.AniListColor)}`);
    if (a.TitleEnglish != null) lines.push(`    ,TitleEnglish: ${esc(a.TitleEnglish)}`);
    if (a.TitleRomaji != null) lines.push(`    ,TitleRomaji: ${esc(a.TitleRomaji)}`);
    if (a.TitleNative != null) lines.push(`    ,TitleNative: ${esc(a.TitleNative)}`);
    if (Array.isArray(a.WatchedAniListIds) && a.WatchedAniListIds.length) lines.push(`    ,WatchedAniListIds: ${arr(a.WatchedAniListIds)}`);
    if (Array.isArray(a.KnownAniListIds) && a.KnownAniListIds.length) lines.push(`    ,KnownAniListIds: ${arr(a.KnownAniListIds)}`);
    // v2.3.4 — LAST, so every existing entry's bytes are unchanged (see OPTIONAL).
    if (a.AniListCover != null) lines.push(`    ,AniListCover: ${esc(a.AniListCover)}`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

/** Split an animeData.js source into { header, body } at the array marker. */
function splitAnimeDataFile(text) {
  const marker = 'const animeData = [';
  const i = String(text).indexOf(marker);
  if (i === -1) throw new Error('animeData.js: marker not found');
  return { header: text.slice(0, i), body: text.slice(i) };
}

/**
 * THE SHRINK TRIPWIRE — the alarm that was missing in May 2026.
 * ---------------------------------------------------------------------------
 * Part 0: the v1.5.0 Excel sync silently regenerated animeData.js from a stale
 * master, replacing hand-authored review text with shorter versions. Nothing
 * objected, and it went unnoticed for two months. This is the objection.
 *
 * Compares the catalog about to be published against what is currently live
 * and refuses the publish when review text materially shrinks.
 *
 * Thresholds (docs/CLOUD-MIGRATION-STUDY.md §10 item 7):
 *   - total review text shrinks by more than 2%
 *   - any single review shrinks by more than 25% OR more than 150 characters
 * A title disappearing entirely is always a violation.
 *
 * @returns {{ok:boolean, violations:string[], notes:string[], totals:object}}
 */
function checkShrink(liveList, nextList, opts) {
  const o = Object.assign({ totalPct: 2, singlePct: 25, singleChars: 150 }, opts || {});
  const len = (a) => String((a && a.Review) || '').length;
  const keyOf = (a) => a.slug || slug(a.Title);

  const liveBy = new Map(liveList.map((a) => [keyOf(a), a]));
  const nextBy = new Map(nextList.map((a) => [keyOf(a), a]));

  const liveTotal = liveList.reduce((n, a) => n + len(a), 0);
  const nextTotal = nextList.reduce((n, a) => n + len(a), 0);
  const violations = [];
  const notes = [];

  const totalDrop = liveTotal - nextTotal;
  const totalPct = liveTotal === 0 ? 0 : (totalDrop / liveTotal) * 100;
  if (totalPct > o.totalPct) {
    violations.push(`total review text shrank ${totalDrop} chars (${totalPct.toFixed(2)}%) — limit ${o.totalPct}%`);
  }

  for (const [k, a] of liveBy) {
    const b = nextBy.get(k);
    if (!b) { violations.push(`"${a.Title}" is missing from the new catalog`); continue; }
    const before = len(a), after = len(b);
    const drop = before - after;
    if (drop <= 0) continue;
    const pct = before === 0 ? 0 : (drop / before) * 100;
    if (pct > o.singlePct || drop > o.singleChars) {
      violations.push(`"${a.Title}" review shrank ${before} → ${after} (−${drop} chars, ${pct.toFixed(1)}%)`);
    } else {
      notes.push(`"${a.Title}" −${drop} chars (within tolerance)`);
    }
  }
  for (const k of nextBy.keys()) if (!liveBy.has(k)) notes.push(`new entry: "${nextBy.get(k).Title}"`);

  return {
    ok: violations.length === 0,
    violations,
    notes,
    totals: { liveTotal, nextTotal, delta: nextTotal - liveTotal, pct: -totalPct },
  };
}

module.exports = { slug, ALWAYS, OPTIONAL, parseAnimeData, toDocs, renderBody, splitAnimeDataFile, checkShrink };
