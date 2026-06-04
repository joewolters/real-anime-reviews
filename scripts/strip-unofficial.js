// scripts/strip-unofficial.js
// <!-- author: Code | date: 2026-06-03 -->
// v1.7.3 gate 1b — one-off, idempotent Excel migration (backs up first, one write):
//   1b.1  Strip hianime / 9anime / aniwave from the `Watch` column. Handles
//         space-merged cells (e.g. "Netflix hianime", "Crunchyroll Amazon Video")
//         by reusing sync's splitMergedPlatforms logic before dropping unofficial.
//   1b.2  Ensure the two watched-set columns exist (WatchedAniListIds,
//         KnownAniListIds) appended after the last header — HEADERS ONLY; data is
//         backfilled at gate 4.
// Both Excel changes are committed in a SINGLE backup+write for atomicity.
// Writes a markdown report to ../Master List/ (outside the deploy root). Re-runs
// are safe: no unofficial left → no Watch edits; columns present → no header adds.
//
// Run from Current Version/:  node scripts/strip-unofficial.js

const fs = require('fs');
const path = require('path');
let XLSX;
try { XLSX = require('xlsx'); } catch (e) { console.error('ERROR: xlsx not installed (npm i).'); process.exit(1); }
const { backupExcel, checkExcelLock } = require('./lib/excel-backup');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.resolve(PROJECT_ROOT, '..', 'Master List', 'Anime_Master_Table.xlsx');
const MASTER_DIR = path.dirname(EXCEL_PATH);

const UNOFFICIAL = ['hianime', '9anime', 'aniwave'];
const NEW_COLUMNS = ['WatchedAniListIds', 'KnownAniListIds'];

// Full known-platform list (WITH unofficial) — needed so a merged cell like
// "Netflix hianime" splits into ["Netflix","hianime"] BEFORE we drop the
// unofficial part. Mirrors sync-excel-to-js.js's knownPlatforms (pre-removal).
const KNOWN_PLATFORMS = ['Crunchyroll', 'Netflix', 'Hulu', 'HIDIVE', 'Amazon Video', 'Amazon Prime Video', 'DisneyPlus', 'Disney+', 'hianime', '9anime', 'aniwave', 'Bilibili', 'Funimation', 'Tubi'];

function splitMergedPlatforms(seg) {
  const sorted = [...KNOWN_PLATFORMS].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    const prefix = p + ' ';
    if (seg.startsWith(prefix)) {
      const rest = seg.slice(prefix.length).trim();
      if (rest) {
        const isRestKnown = sorted.some((q) => rest === q || rest.startsWith(q + ' '));
        if (isRestKnown) return [p, ...splitMergedPlatforms(rest)];
      }
    }
  }
  return [seg];
}

function cleanWatch(raw) {
  if (raw == null || String(raw).trim() === '') return { value: raw, removed: [] };
  const segments = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  const platforms = [];
  for (const seg of segments) platforms.push(...splitMergedPlatforms(seg));
  // Match unofficial names even with suffixes/annotations (e.g. "aniwave (VPN)").
  // No legitimate platform starts with hianime/9anime/aniwave, so startsWith is safe.
  const isUnofficial = (p) => {
    const low = String(p).toLowerCase().trim();
    return UNOFFICIAL.some((u) => low === u || low.startsWith(u));
  };
  const removed = platforms.filter(isUnofficial);
  const kept = platforms.filter((p) => !isUnofficial(p));
  return { value: kept.join(', '), removed };
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) { console.error('ERROR: Excel not found at', EXCEL_PATH); process.exit(1); }
  checkExcelLock(EXCEL_PATH);

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headers.push(cell ? String(cell.v).trim() : '');
  }
  const watchCol = headers.indexOf('Watch');
  if (watchCol === -1) { console.error('ERROR: no "Watch" column found.'); process.exit(1); }

  const bak = await backupExcel(EXCEL_PATH);
  console.log('Excel backup:', path.basename(bak));

  // 1b.1 — strip unofficial from each Watch cell
  const stripReport = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: watchCol });
    const cell = sheet[ref];
    if (!cell || cell.v == null) continue;
    const { value, removed } = cleanWatch(cell.v);
    if (removed.length) {
      const before = String(cell.v);
      cell.v = value; cell.w = value; cell.t = 's';
      stripReport.push({ row: r + 1, removed, before, after: value });
    }
  }

  // 1b.2 — ensure the watched-set columns exist (append after last header)
  const added = [];
  for (const name of NEW_COLUMNS) {
    if (headers.includes(name)) continue;
    range.e.c += 1;
    const c = range.e.c;
    sheet[XLSX.utils.encode_cell({ r: range.s.r, c })] = { t: 's', v: name, w: name };
    headers.push(name);
    added.push(name);
  }
  sheet['!ref'] = XLSX.utils.encode_range(range);

  XLSX.writeFile(wb, EXCEL_PATH);

  // report (outside deploy root)
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const lines = [];
  lines.push(`# strip-unofficial report (v1.7.3 gate 1b)`);
  lines.push('');
  lines.push(`- Excel: ${EXCEL_PATH}`);
  lines.push(`- Backup: ${path.basename(bak)}`);
  lines.push(`- Watch rows edited: ${stripReport.length}`);
  lines.push(`- Columns added: ${added.length ? added.join(', ') : '(already present)'}`);
  lines.push('');
  if (stripReport.length) {
    lines.push(`## Watch column changes`);
    lines.push('');
    for (const s of stripReport) {
      lines.push(`- Row ${s.row}: removed ${s.removed.map((x) => `\`${x}\``).join(', ')} → \`${s.after}\``);
    }
  }
  const reportPath = path.join(MASTER_DIR, `strip-unofficial-report-${ts}.md`);
  fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8');

  console.log(`Stripped unofficial from ${stripReport.length} row(s).`);
  console.log(`Columns added: ${added.length ? added.join(', ') : '(already present)'}`);
  console.log(`Report: ${path.basename(reportPath)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
