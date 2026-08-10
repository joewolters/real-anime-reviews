#!/usr/bin/env node
/**
 * CLOUD MIGRATION — PHASE 5: the Excel EXPORT.
 * ============================================================================
 * Blake's decision: keep a "download the spreadsheet" button. Excel stops
 * being the master and becomes an export you can always take away.
 *
 * Rebuilds a real .xlsx from the catalog store, in the SAME column order the
 * master has always used, so the file opens exactly like the one you know.
 * Read-only with respect to everything: writes one new file, touches nothing.
 *
 * Usage (from Current Version/):
 *   node scripts/catalog-to-xlsx.js --from=json --stamp=2026-08-09
 *   node scripts/catalog-to-xlsx.js --from=emulator
 *   node scripts/catalog-to-xlsx.js --from=prod --blake-said-go
 *
 * Authored: Code, 2026-08-09.  Docs: docs/CLOUD-MIGRATION-STUDY.md
 * ============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CV = path.resolve(__dirname, '..');
const ML = path.resolve(CV, '..', 'Master List');

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const FROM = flag('from', 'json');
const STAMP = flag('stamp', '');
const OUT = flag('out', '');

// The master's column order, preserved so the export opens like the original.
// FORMAT: / EXAMPLE: were reference-only columns and are intentionally dropped.
const COLUMNS = [
  'Title', 'Rating', 'Seasons', 'Genre', 'Description', 'Review', 'Tags', 'Watch',
  'Studio', 'Trailer', 'Top10Rank', 'AniListId', 'IdMal', 'AniListScore',
  'AniListColor', 'TitleEnglish', 'TitleRomaji', 'TitleNative',
  'WatchedAniListIds', 'KnownAniListIds',
];

function cellFor(doc, col) {
  if (col === 'Watch') return (doc.Platforms || []).join(', ');
  if (col === 'Tags') return (doc.Tags || []).map((t) => '#' + t).join(' ');
  if (col === 'WatchedAniListIds' || col === 'KnownAniListIds') return (doc[col] || []).join(',');
  const v = doc[col];
  return v == null ? '' : v;
}

(async () => {
  let docs;
  if (FROM === 'json') {
    if (!STAMP) { console.error('--from=json needs --stamp=<migration stamp>'); process.exit(3); }
    const p = path.join(ML, `_migration_${STAMP}`, 'catalog-docs.json');
    if (!fs.existsSync(p)) { console.error('not found:', p); process.exit(2); }
    docs = JSON.parse(fs.readFileSync(p, 'utf8'));
  } else {
    if (FROM === 'prod' && !args.includes('--blake-said-go')) {
      console.error('REFUSED: --from=prod requires --blake-said-go.'); process.exit(1);
    }
    const admin = require(path.join(CV, 'functions', 'node_modules', 'firebase-admin'));
    if (FROM === 'emulator') process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    else delete process.env.FIRESTORE_EMULATOR_HOST;
    admin.initializeApp({ projectId: FROM === 'prod' ? 'real-anime-reviews' : (process.env.GCLOUD_PROJECT || 'demo-rar') });
    const snap = await admin.firestore().collection('catalog').orderBy('order').get();
    if (snap.empty) { console.error('ABORT: the catalog is empty.'); process.exit(1); }
    docs = snap.docs.map((d) => d.data());
  }

  docs = [...docs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const rows = [COLUMNS, ...docs.map((d) => COLUMNS.map((c) => cellFor(d, c)))];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Anime_Master_Table');

  const out = OUT || path.join(ML, `Anime_Master_Table.export.${new Date().toISOString().slice(0, 10)}.xlsx`);
  XLSX.writeFile(wb, out);

  // Read it back and prove no review lost a character on the way out.
  const back = XLSX.utils.sheet_to_json(XLSX.readFile(out).Sheets['Anime_Master_Table'], { header: 1, raw: false, defval: null });
  const ri = back[0].indexOf('Review');
  const outChars = back.slice(1).reduce((n, r) => n + String(r[ri] == null ? '' : r[ri]).length, 0);
  const srcChars = docs.reduce((n, d) => n + String(d.Review || '').length, 0);

  console.log(`Exported ${docs.length} anime → ${path.relative(CV, out)}`);
  console.log(`Review text: ${srcChars} chars in, ${outChars} chars out — ${srcChars === outChars ? 'OK' : 'MISMATCH'}`);
  if (srcChars !== outChars) process.exit(1);
})().catch((e) => { console.error('EXPORT FAILED:', e && e.message); process.exit(1); });
