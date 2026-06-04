#!/usr/bin/env node
'use strict';
// scripts/backfill-platforms.js
// <!-- author: Code | date: 2026-06-04 -->
// v1.7.5 (gate 3c) — backfill the Excel `Watch` column (→ animeData `Platforms`)
// from AniList `externalLinks` (type STREAMING) for each row's PRIMARY AniListId.
// Excel is canonical (rule #1): a LIVE run backs up + lock-checks, writes the Watch
// column, then regenerates animeData.js via sync. Mirrors the v1.7.3 backfill CLI.
//
//   node scripts/backfill-platforms.js --dry-run   per-anime diff (current → proposed), NO writes
//   node scripts/backfill-platforms.js             LIVE (backup + write + sync)  [Blake-approved only]
//
// MAPPING RULES (proposed — Blake reviews the dry-run before any LIVE write):
//  1. Normalize AniList site names to Blake's existing pill vocabulary (see PLATFORM_MAP).
//  2. US-centric ALLOWLIST: only platforms a US visitor can actually use are kept;
//     region-specific official ones (Bilibili, iQ, Laftel, Bahamut, Ani-One, …) are
//     filtered out and FLAGGED so Blake can re-include any he wants.
//  3. Funimation is defunct (folded into Crunchyroll) → dropped + flagged.
//  4. AniList lists NO usable streaming links → KEEP the existing hand-curated value
//     (never blank — sync requires ≥1 platform; better stale than an empty cell). Flagged.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let XLSX;
try { XLSX = require('xlsx'); } catch (e) { console.error('ERROR: xlsx missing — run npm install.'); process.exit(2); }
const { backupExcel, checkExcelLock } = require('./lib/excel-backup');
const franchiseFetch = require('../franchise-fetch.js');
// v1.8.1 (gate 4) — mapping/allowlist/override + propose logic now lives in a
// shared lib so the edit page's "fix platforms" one-click reuses the SAME rules.
const { PLATFORM_MAP, proposePlatformsForRow } = require('./lib/platform-map');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.resolve(PROJECT_ROOT, '..', 'Master List', 'Anime_Master_Table.xlsx');
const MASTER_DIR = path.dirname(EXCEL_PATH);

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

function cellRef(r, c) { return XLSX.utils.encode_cell({ r, c }); }
function getCell(sheet, r, c) { const cell = sheet[cellRef(r, c)]; return cell == null ? null : cell.v; }
function setCell(sheet, r, c, v, t) { sheet[cellRef(r, c)] = { t: t || 's', v }; }
function headerIndex(sheet, range, name) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const v = getCell(sheet, range.s.r, c);
    if (v != null && String(v).trim() === name) return c;
  }
  return -1;
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${C.bold}Platforms backfill${C.reset}
  node scripts/backfill-platforms.js --dry-run   per-anime diff, NO writes
  node scripts/backfill-platforms.js             LIVE (backup + write Watch + sync)
`);
    return;
  }
  const dryRun = args.includes('--dry-run');

  if (!fs.existsSync(EXCEL_PATH)) { console.error(`${C.red}ERROR:${C.reset} Excel not found at ${EXCEL_PATH}`); process.exit(2); }
  if (!dryRun) checkExcelLock(EXCEL_PATH);

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const colWatch = headerIndex(sheet, range, 'Watch');
  const colId = headerIndex(sheet, range, 'AniListId');
  const colTitle = headerIndex(sheet, range, 'Title');
  if (colWatch === -1 || colId === -1 || colTitle === -1) {
    console.error(`${C.red}ERROR:${C.reset} Watch / AniListId / Title column missing.`); process.exit(2);
  }

  console.log(`${C.bold}${dryRun ? 'DRY RUN — ' : ''}Platforms backfill${C.reset} ${C.gray}(1 fetch / row, 250ms apart, 429-retry in fetchMediaDetail)${C.reset}\n`);

  const reportRows = [];
  let wroteAny = false;
  let backedUp = false;

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const title = getCell(sheet, r, colTitle);
    if (!title) continue;
    const current = String(getCell(sheet, r, colWatch) || '').trim();
    const idRaw = getCell(sheet, r, colId);
    const aniId = idRaw == null ? null : parseInt(idRaw, 10);

    if (!aniId || isNaN(aniId)) {
      reportRows.push({ title, current, proposed: current, action: 'KEEP', flag: 'no AniListId — kept existing' });
      console.log(`${C.gray}• ${title} — no AniListId, kept existing${C.reset}`);
      continue;
    }

    let detail = null;
    try { detail = await franchiseFetch.fetchMediaDetail(aniId); }
    catch (err) { detail = null; }
    await sleep(250);

    if (!detail) {
      reportRows.push({ title, current, proposed: current, action: 'KEEP', flag: 'fetch failed — kept existing (manual eye)' });
      console.log(`${C.yellow}• ${title} — fetch failed, kept existing${C.reset}`);
      continue;
    }

    // Shared propose+override logic (scripts/lib/platform-map.js) — same rules the
    // edit page's "fix platforms" one-click uses.
    const { proposed, flags, action } = proposePlatformsForRow(title, detail.externalLinks, current);

    reportRows.push({ title, current, proposed, action, flag: flags.join(' · ') });
    const tag = action === 'CHANGE' ? `${C.yellow}CHANGE${C.reset}` : action === 'KEEP' ? `${C.gray}KEEP${C.reset}` : `${C.green}SAME${C.reset}`;
    console.log(`${tag} ${C.bold}${title}${C.reset}  ${C.gray}${current || '(blank)'}${C.reset} → ${proposed || '(blank)'}${flags.length ? `  ${C.cyan}[${flags.join(' · ')}]${C.reset}` : ''}`);

    if (!dryRun && action === 'CHANGE') {
      if (!backedUp) { const b = await backupExcel(EXCEL_PATH); backedUp = true; console.log(`${C.gray}Excel backup: ${path.basename(b)}${C.reset}`); }
      setCell(sheet, r, colWatch, proposed, 's');
      wroteAny = true;
    }
  }

  // ---- Save + regenerate animeData.js (LIVE only) ----
  if (!dryRun && wroteAny) {
    sheet['!ref'] = XLSX.utils.encode_range(range);
    XLSX.writeFile(wb, EXCEL_PATH);
    console.log(`\n${C.green}Excel updated.${C.reset} ${C.gray}Regenerating animeData.js...${C.reset}`);
    try { execFileSync(process.execPath, [path.join(__dirname, 'sync-excel-to-js.js')], { cwd: PROJECT_ROOT, stdio: 'inherit' }); }
    catch (_) { console.error(`${C.yellow}sync failed — run "npm run sync" manually.${C.reset}`); }
  } else if (dryRun) {
    console.log(`\n${C.yellow}DRY RUN:${C.reset} no Excel writes, no sync.`);
  } else {
    console.log(`\n${C.gray}No changes to write.${C.reset}`);
  }

  // ---- Report (outside the deploy root) ----
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(MASTER_DIR, `backfill-platforms-report-${ts}.md`);
  const counts = reportRows.reduce((m, r) => (m[r.action] = (m[r.action] || 0) + 1, m), {});
  const lines = [
    '# Platforms backfill report',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`,
    `- Rows: ${reportRows.length}  (CHANGE: ${counts.CHANGE || 0}, SAME: ${counts.SAME || 0}, KEEP: ${counts.KEEP || 0})`,
    '',
    '## Mapping rules applied',
    '- Normalize AniList site → Blake vocab (Amazon Prime Video→Amazon Video, Disney Plus→Disney+, etc.)',
    '- US-centric allowlist: ' + Array.from(new Set(Object.values(PLATFORM_MAP))).sort().join(', '),
    '- Funimation (defunct) + regional platforms filtered out, listed in Flags',
    '- AniList had no usable streaming → existing value KEPT (never blanked)',
    '',
    '| Title | Current Platforms | Proposed Platforms | Action | Flags |',
    '|---|---|---|---|---|',
  ];
  for (const rr of reportRows) {
    const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
    lines.push(`| ${esc(rr.title)} | ${esc(rr.current)} | ${esc(rr.proposed)} | ${rr.action} | ${esc(rr.flag)} |`);
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8');
  console.log(`\n${C.bold}Report:${C.reset} ${reportPath}`);
}

main().catch((err) => {
  console.error(`${C.red}FATAL:${C.reset} ${err.message}`);
  process.exit(2);
});
