#!/usr/bin/env node
/**
 * CLOUD MIGRATION — PHASE 1a: build the Firestore-shaped catalog documents.
 * ============================================================================
 * Produces one document per anime, in exactly the shape `catalog/{animeId}`
 * will hold, and writes them to _migration_<stamp>/catalog-docs.json.
 *
 * Nothing is written to Firestore here — this is a pure, offline transform, so
 * the whole round-trip can be PROVEN before any cloud write happens.
 *
 * SEED SOURCE: animeData.js (not the Excel master), deliberately —
 *   - it is exactly what ships to visitors, so the byte-equality gate is honest
 *   - it carries `image`, which has no Excel column at all
 *   - Phase 0 proved the only Excel/animeData divergence is 25 trailing spaces
 *     the sync already trims (zero content differences)
 *
 * Usage (from Current Version/):
 *   node scripts/catalog-export.js <stamp>
 *
 * Docs: docs/CLOUD-MIGRATION-STUDY.md §4 (data model), §10 (no-loss)
 * Authored: Code, 2026-08-09.
 * ============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CV = path.resolve(__dirname, '..');
const ML = path.resolve(CV, '..', 'Master List');
const stamp = process.argv[2];
if (!stamp) { console.error('usage: node scripts/catalog-export.js <stamp>'); process.exit(3); }
const DIR = path.join(ML, `_migration_${stamp}`);
if (!fs.existsSync(DIR)) { console.error('no migration dir — run catalog-snapshot.js first:', DIR); process.exit(2); }

// The slug, the document shape and the renderer all live in ONE place so the
// tool that writes the data and the test that proves it can never drift.
const { ALWAYS, OPTIONAL, parseAnimeData, toDocs } = require('./lib/catalog-model');

const adText = fs.readFileSync(path.join(CV, 'animeData.js'), 'utf8');
const data = parseAnimeData(adText);

let docs;
try {
  docs = toDocs(data);
} catch (e) {
  console.error('FATAL:', e.message);
  process.exit(1);
}

const out = path.join(DIR, 'catalog-docs.json');
fs.writeFileSync(out, JSON.stringify(docs, null, 1), 'utf8');

console.log('PHASE 1a — catalog documents built');
console.log(`  ${docs.length} docs -> ${path.basename(out)}`);
console.log(`  slug collisions: none`);
const withTop10 = docs.filter((d) => d.Top10Rank != null).length;
console.log(`  fields: ${ALWAYS.length} always + up to ${OPTIONAL.length} optional | Top10Rank on ${withTop10} | order 0..${docs.length - 1}`);
console.log(`  sample id: "${docs[0].animeId}"  ...  "${docs[docs.length - 1].animeId}"`);
// Surface the apostrophe cases explicitly — these are where a wrong slug would
// silently orphan a comment room.
const tricky = docs.filter((d) => /['’]/.test(d.Title));
if (tricky.length) {
  console.log(`  apostrophe titles (slug must match live rooms):`);
  for (const d of tricky) console.log(`    ${JSON.stringify(d.Title)} -> ${d.slug}`);
}
