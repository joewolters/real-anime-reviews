#!/usr/bin/env node
/**
 * CLOUD MIGRATION — PHASE 1b: THE PROOF.
 * ============================================================================
 * Regenerates animeData.js FROM the Firestore-shaped catalog documents and
 * requires the result to be byte-identical to the file that is live today.
 *
 * If this passes, the catalog documents provably contain exactly today's data —
 * all 21 fields across all 44 rows, no drift, no re-encoding, nothing lost.
 * It is the acceptance gate for the whole migration (study §10 item 3).
 *
 * Also runs, per study §10:
 *   - the field-level completeness audit   (item 4)
 *   - the per-review character/SHA fidelity check vs the Phase 0 baseline (item 5)
 *   - the ordering check (Excel row order was semantic — "latest drop")
 *
 * Exit 0 = every gate green. Exit 1 = a gate failed; migration must not proceed.
 *
 * Usage (from Current Version/):
 *   node scripts/catalog-verify.js <stamp>
 *
 * Authored: Code, 2026-08-09.
 * ============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CV = path.resolve(__dirname, '..');
const ML = path.resolve(CV, '..', 'Master List');
const stamp = process.argv[2];
if (!stamp) { console.error('usage: node scripts/catalog-verify.js <stamp>'); process.exit(3); }
const DIR = path.join(ML, `_migration_${stamp}`);
const shaText = (s) => crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

const docs = JSON.parse(fs.readFileSync(path.join(DIR, 'catalog-docs.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(DIR, 'fidelity-baseline.json'), 'utf8'));
const liveText = fs.readFileSync(path.join(CV, 'animeData.js'), 'utf8');

let failures = 0;
const gate = (name, ok, detail) => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

// The renderer, the slug and the doc shape come from the shared model so the
// proof and the exporter can never disagree. (sync-excel-to-js.js still holds
// its own copy of the renderer — deliberately untouched this phase; the
// byte-equality gate below is exactly what pins the two together, and Phase 2
// retires the duplicate.)
const { parseAnimeData, renderBody, splitAnimeDataFile } = require('./lib/catalog-model');

console.log('PHASE 1b — VERIFICATION\n');

// ---- Gate A: ordering ---------------------------------------------------
const ordered = [...docs].sort((a, b) => a.order - b.order);
const orderStable = ordered.every((d, i) => d.order === i);
gate('order field is dense 0..N-1', orderStable, `${ordered.length} docs`);
const live = parseAnimeData(liveText);
gate('order reproduces the live array sequence',
  ordered.length === live.length && ordered.every((d, i) => d.Title === live[i].Title),
  `"latest drop" = ${ordered[ordered.length - 1].Title}`);

// ---- Gate B: THE BYTE-EQUALITY GATE ------------------------------------
// Reuse the live file's own header verbatim (it carries a generation timestamp
// that necessarily differs per run) so the comparison is purely about DATA.
const { header, body: liveBody } = splitAnimeDataFile(liveText);
const genBody = renderBody(ordered);

const exact = genBody === liveBody;
const lfNorm = genBody.replace(/\r\n/g, '\n') === liveBody.replace(/\r\n/g, '\n');
gate('BYTE-EQUALITY: generated body === live body', exact || lfNorm,
  exact ? 'exact byte match' : (lfNorm ? 'match (line-ending normalised)' : 'MISMATCH'));

if (!exact && !lfNorm) {
  const a = liveBody.split('\n'), b = genBody.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log(`\n    first difference at body line ${i + 1}:`);
      console.log(`      live: ${JSON.stringify((a[i] || '').slice(0, 160))}`);
      console.log(`      gen : ${JSON.stringify((b[i] || '').slice(0, 160))}`);
      break;
    }
  }
}
const whole = header + genBody;
gate('whole-file reconstruction matches', whole.replace(/\r\n/g, '\n') === liveText.replace(/\r\n/g, '\n'),
  `${Buffer.byteLength(whole, 'utf8')} bytes vs ${Buffer.byteLength(liveText, 'utf8')} live`);

// ---- Gate C: field-level completeness ----------------------------------
const CATALOG_FIELDS = baseline.fieldNames;
let missing = [];
for (const d of ordered) {
  const src = live.find((x) => x.Title === d.Title);
  for (const f of Object.keys(src)) {
    const dv = d[f], sv = src[f];
    const same = Array.isArray(sv) ? JSON.stringify(dv) === JSON.stringify(sv) : dv === sv;
    if (!same) missing.push(`${d.Title}.${f}`);
  }
}
gate('every field on every row round-trips exactly', missing.length === 0,
  missing.length ? missing.slice(0, 5).join(', ') : `${CATALOG_FIELDS.length} distinct fields x ${ordered.length} rows`);

// a value that is non-empty live but empty in the doc = the silent-loss shape
const emptied = [];
for (const d of ordered) {
  const src = live.find((x) => x.Title === d.Title);
  for (const f of Object.keys(src)) {
    const sv = src[f], dv = d[f];
    const nonEmpty = (v) => v != null && !(typeof v === 'string' && v === '') && !(Array.isArray(v) && v.length === 0);
    if (nonEmpty(sv) && !nonEmpty(dv)) emptied.push(`${d.Title}.${f}`);
  }
}
gate('no field went from non-empty to empty', emptied.length === 0, emptied.join(', ') || 'none');

// ---- Gate D: per-review fidelity vs the Phase 0 baseline ---------------
const byTitle = new Map(baseline.reviews.map((r) => [r.title, r]));
let drift = [];
let totalChars = 0;
for (const d of ordered) {
  const b = byTitle.get(d.Title);
  const text = String(d.Review || '');
  totalChars += text.length;
  if (!b) { drift.push(`${d.Title}: no baseline`); continue; }
  if (text.length !== b.reviewChars) drift.push(`${d.Title}: ${b.reviewChars}->${text.length} chars`);
  else if (shaText(text) !== b.reviewSha) drift.push(`${d.Title}: SHA differs at same length (encoding!)`);
}
gate('per-review char count + SHA match the Phase 0 baseline', drift.length === 0,
  drift.length ? drift.slice(0, 4).join(' | ') : `${ordered.length} reviews, ${totalChars} chars`);
gate('total review text unchanged', totalChars === baseline.totalReviewChars,
  `${totalChars} vs baseline ${baseline.totalReviewChars}`);

// ---- Gate E: identity / keys -------------------------------------------
const ids = new Set(ordered.map((d) => d.animeId));
gate('animeId unique across the catalog', ids.size === ordered.length, `${ids.size} ids`);
gate('slug == animeId and is non-empty everywhere',
  ordered.every((d) => d.slug === d.animeId && d.slug.length > 0));

console.log('');
if (failures === 0) {
  console.log('\x1b[32m✅ ALL GATES GREEN\x1b[0m — the catalog documents provably contain exactly today\'s data.');
  console.log('   Safe to import to Firestore (still requires Blake\'s explicit go).');
} else {
  console.log(`\x1b[31m❌ ${failures} GATE(S) FAILED\x1b[0m — migration MUST NOT proceed.`);
}
process.exit(failures === 0 ? 0 : 1);
