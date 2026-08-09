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
/** Fields emitted only when present. */
const OPTIONAL = ['Top10Rank', 'AniListId', 'IdMal', 'AniListScore', 'AniListColor', 'TitleEnglish', 'TitleRomaji', 'TitleNative', 'WatchedAniListIds', 'KnownAniListIds'];

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

module.exports = { slug, ALWAYS, OPTIONAL, parseAnimeData, toDocs, renderBody, splitAnimeDataFile };
