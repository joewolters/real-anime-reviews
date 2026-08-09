#!/usr/bin/env node
/**
 * CLOUD MIGRATION — PHASE 0: the snapshot.
 * ============================================================================
 * Creates the three independent backups the no-loss protocol requires, plus the
 * per-review fidelity baseline (char count + SHA per review) that every later
 * phase is checked against.
 *
 * READ-ONLY with respect to the project: writes ONLY into
 * ../Master List/_migration_<stamp>/ (outside the repo and the deploy root).
 *
 * Usage (from Current Version/):
 *   node scripts/catalog-snapshot.js
 *
 * Docs: docs/CLOUD-MIGRATION-STUDY.md §10 (the no-loss guarantee)
 * Authored: Code, 2026-08-09.
 * ============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const XLSX = require('xlsx');

const CV = path.resolve(__dirname, '..');
const ML = path.resolve(CV, '..', 'Master List');
const EXCEL = path.join(ML, 'Anime_Master_Table.xlsx');
const ANIMEDATA = path.join(CV, 'animeData.js');

const stamp = process.argv[2] || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
const OUT = path.join(ML, `_migration_${stamp}`);

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const shaText = (s) => sha(Buffer.from(s, 'utf8'));

function loadAnimeData(text) {
  const fn = new Function(text.replace(/^\s*export\s+.*$/gm, '') + '\n;return animeData;');
  return fn();
}

fs.mkdirSync(OUT, { recursive: true });
console.log('PHASE 0 — snapshot');
console.log('  out:', OUT);

// ---- Backup 1: the Excel master, byte-copied + hash-verified -------------
const excelBuf = fs.readFileSync(EXCEL);
const excelSha = sha(excelBuf);
const excelCopy = path.join(OUT, 'Anime_Master_Table.SNAPSHOT.xlsx');
fs.writeFileSync(excelCopy, excelBuf);
const verifySha = sha(fs.readFileSync(excelCopy));
if (verifySha !== excelSha) { console.error('FATAL: Excel copy hash mismatch'); process.exit(1); }
console.log(`  [1/3] Excel  ${excelBuf.length} bytes  sha256 ${excelSha.slice(0, 16)}…  VERIFIED`);

// ---- Backup 2: animeData.js (the live catalog as shipped) ----------------
const adText = fs.readFileSync(ANIMEDATA, 'utf8');
const adSha = shaText(adText);
fs.writeFileSync(path.join(OUT, 'animeData.SNAPSHOT.js'), adText, 'utf8');
console.log(`  [2/3] animeData.js  ${Buffer.byteLength(adText, 'utf8')} bytes  sha256 ${adSha.slice(0, 16)}…`);

// ---- Backup 3: a plain-JSON export of every row x every field ------------
const data = loadAnimeData(adText);
fs.writeFileSync(path.join(OUT, 'catalog.SNAPSHOT.json'), JSON.stringify(data, null, 1), 'utf8');
console.log(`  [3/3] catalog.SNAPSHOT.json  ${data.length} entries`);

// ---- The fidelity baseline: per-review char count + SHA ------------------
// Reviews are the crown jewels (Part 0). Every later phase re-derives this
// table and must match it exactly.
const reviews = data.map((a) => ({
  title: a.Title,
  image: a.image,
  reviewChars: String(a.Review || '').length,
  reviewSha: shaText(String(a.Review || '')),
  descChars: String(a.Description || '').length,
  fieldCount: Object.keys(a).length,
}));
const totalReviewChars = reviews.reduce((n, r) => n + r.reviewChars, 0);
fs.writeFileSync(path.join(OUT, 'fidelity-baseline.json'), JSON.stringify({
  stamp, excelSha, animeDataSha: adSha,
  entryCount: data.length, totalReviewChars,
  fieldNames: [...new Set(data.flatMap((a) => Object.keys(a)))],
  reviews,
}, null, 1), 'utf8');
console.log(`  fidelity baseline: ${data.length} entries, ${totalReviewChars} review chars, ${[...new Set(data.flatMap((a) => Object.keys(a)))].length} distinct fields`);

// ---- Excel cross-check: does the sheet agree with animeData? -------------
const wb = XLSX.readFile(EXCEL);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
const H = rows[0].map((h) => (h == null ? '' : String(h).trim()));
const ti = H.indexOf('Title'), ri = H.indexOf('Review');
let xlRows = 0, xlReviewChars = 0;
for (const row of rows.slice(1)) {
  const t = row[ti] && String(row[ti]).trim();
  if (!t) continue;
  xlRows++; xlReviewChars += String(row[ri] == null ? '' : row[ri]).length;
}
console.log(`  Excel cross-check: ${xlRows} rows, ${xlReviewChars} review chars` +
  (xlRows === data.length && xlReviewChars === totalReviewChars ? '  ✓ AGREES' : '  ⚠ DIVERGES from animeData'));

// ---- Provenance ----------------------------------------------------------
let head = '';
try { head = cp.execSync('git rev-parse HEAD', { cwd: CV, encoding: 'utf8' }).trim(); } catch (e) { /* */ }
const manifest = {
  phase: 0, stamp, gitHead: head,
  excel: { path: EXCEL, bytes: excelBuf.length, sha256: excelSha },
  animeData: { path: ANIMEDATA, bytes: Buffer.byteLength(adText, 'utf8'), sha256: adSha },
  entryCount: data.length, totalReviewChars,
  excelCrossCheck: { rows: xlRows, reviewChars: xlReviewChars, agrees: xlRows === data.length && xlReviewChars === totalReviewChars },
};
fs.writeFileSync(path.join(OUT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('\nPHASE 0 COMPLETE. Manifest written.');
console.log(`  git HEAD: ${head.slice(0, 8)}`);
