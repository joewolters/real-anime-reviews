#!/usr/bin/env node
'use strict';
// scripts/backfill-watched.js
// <!-- author: Code | date: 2026-06-03 -->
// v1.7.3 — interactive backfill for the watched-set columns (WatchedAniListIds +
// KnownAniListIds). Walks Anime_Master_Table.xlsx row-by-row; for each row with
// an AniListId it runs the SHARED traverseFranchise() (franchise-fetch.js), shows
// the franchise tree, default-checks FINISHED-status entries (locked Decision 1;
// the source's own entry is always ticked + non-toggleable), lets Blake toggle,
// then writes WatchedAniListIds (ticked set + source force-injected, Decision 7) +
// KnownAniListIds (every entry the tree surfaced — the Mode-2 snapshot). Backs up
// Excel ONCE, regenerates animeData.js via sync, writes a markdown report to
// ../Master List/ (outside the deploy root). Resume-safe: rows already populated
// are skipped unless --force.
//
//   node scripts/backfill-watched.js              interactive
//   node scripts/backfill-watched.js --dry-run    preview defaults + trees, NO writes
//   node scripts/backfill-watched.js --force      re-process rows already populated

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
let XLSX;
try { XLSX = require('xlsx'); } catch (e) { console.error('ERROR: xlsx missing — run npm install.'); process.exit(2); }
const { backupExcel, checkExcelLock } = require('./lib/excel-backup');
const franchiseFetch = require('../franchise-fetch.js');

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
function ensureCol(sheet, range, name, dryRun) {
  let idx = headerIndex(sheet, range, name);
  if (idx === -1) {
    idx = range.e.c + 1;
    range.e.c = idx;
    if (!dryRun) setCell(sheet, range.s.r, idx, name, 's');
  }
  return idx;
}
function statusLabel(s) {
  return s === 'NOT_YET_RELEASED' ? 'UPCOMING' : s === 'RELEASING' ? 'AIRING' : (s || '?');
}

// Flatten the traverseFranchise tree → display rows (spine first, then groups).
function flattenTree(tree) {
  const out = [];
  const seen = new Set();
  const push = (n, group, isSource) => {
    if (!n || !n.id || seen.has(n.id)) return;
    seen.add(n.id);
    out.push({
      id: n.id,
      title: (n.title && (n.title.english || n.title.romaji)) || '(untitled)',
      format: n.format || '?',
      year: n.seasonYear || '?',
      status: n.status || null,
      group,
      isSource: !!isSource,
    });
  };
  (tree.spine || []).forEach((n) => push(n, 'SPINE', n.isSource));
  for (const [rt, nodes] of Object.entries(tree.groups || {})) (nodes || []).forEach((n) => push(n, rt, false));
  return out;
}

function entryLine(e, idx, checked) {
  const box = checked ? `${C.green}[x]${C.reset}` : '[ ]';
  const role = e.isSource ? `${C.cyan}(MAIN · always)${C.reset}` : `${C.gray}${e.group}${C.reset}`;
  const st = e.status && e.status !== 'FINISHED' ? ` ${C.yellow}${statusLabel(e.status)}${C.reset}` : '';
  return `  ${box} ${C.bold}${idx}.${C.reset} ${e.title} ${C.gray}[${e.format} · ${e.year}]${C.reset} ${role}${st}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${C.bold}Watched-set backfill${C.reset}
  node scripts/backfill-watched.js              interactive (toggle per row, write)
  node scripts/backfill-watched.js --dry-run    preview defaults + trees for all rows, NO writes
  node scripts/backfill-watched.js --force      re-process rows already populated
`);
    return;
  }
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  if (!fs.existsSync(EXCEL_PATH)) { console.error(`${C.red}ERROR:${C.reset} Excel not found at ${EXCEL_PATH}`); process.exit(2); }
  if (!dryRun) checkExcelLock(EXCEL_PATH);

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const colWatched = ensureCol(sheet, range, 'WatchedAniListIds', dryRun);
  const colKnown = ensureCol(sheet, range, 'KnownAniListIds', dryRun);
  const colId = headerIndex(sheet, range, 'AniListId');
  const colTitle = headerIndex(sheet, range, 'Title');
  if (colId === -1 || colTitle === -1) { console.error(`${C.red}ERROR:${C.reset} Title / AniListId column missing.`); process.exit(2); }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a)));

  let backedUp = false;
  let wroteAny = false;
  let quit = false;
  const reportRows = [];
  const backupOnce = async () => {
    if (!dryRun && !backedUp) {
      const b = await backupExcel(EXCEL_PATH);
      backedUp = true;
      console.log(`${C.gray}Excel backup: ${path.basename(b)}${C.reset}`);
    }
  };

  console.log(`${C.bold}${dryRun ? 'DRY RUN — ' : ''}Watched-set backfill${C.reset} ${C.gray}(franchise walks are batched 3-4 / 250ms; one row at a time)${C.reset}\n`);

  for (let r = range.s.r + 1; r <= range.e.r && !quit; r++) {
    const title = getCell(sheet, r, colTitle);
    if (!title) continue;
    const idRaw = getCell(sheet, r, colId);
    const aniId = idRaw == null ? null : parseInt(idRaw, 10);
    if (!aniId || isNaN(aniId)) { reportRows.push({ title, action: 'skip (no AniListId)', watched: '', known: '' }); continue; }

    const existing = getCell(sheet, r, colWatched);
    if (existing && !force) {
      console.log(`${C.gray}• ${title} — already populated, skipping (use --force to redo)${C.reset}`);
      reportRows.push({ title, action: 'skip (already populated)', watched: String(existing), known: String(getCell(sheet, r, colKnown) || '') });
      continue;
    }

    console.log(`\n${C.bold}${title}${C.reset} ${C.gray}(AniListId ${aniId})${C.reset}`);
    let tree;
    try {
      tree = await franchiseFetch.traverseFranchise(aniId);
    } catch (err) {
      console.log(`  ${C.yellow}traversal failed: ${err.message} — skipping${C.reset}`);
      reportRows.push({ title, action: `traversal error: ${err.message}`, watched: '', known: '' });
      continue;
    }

    const entries = flattenTree(tree);

    // No franchise entries (single-season / fetch returned nothing) → source only.
    if (!entries.length) {
      const watched = String(aniId);
      const known = String(aniId);
      console.log(`  ${C.gray}no franchise entries — watched = source only${C.reset}`);
      await backupOnce();
      if (!dryRun) { setCell(sheet, r, colWatched, watched, 's'); setCell(sheet, r, colKnown, known, 's'); wroteAny = true; }
      reportRows.push({ title, action: dryRun ? 'would write (source only)' : 'wrote (source only)', watched, known });
      continue;
    }

    // Default-check: FINISHED status + the source (locked Decision 1 + 7).
    const checked = new Set();
    for (const e of entries) { if (e.isSource || e.status === 'FINISHED') checked.add(e.id); }
    checked.add(aniId);

    let outcome = 'pending';
    while (outcome === 'pending') {
      console.log(entries.map((e, i) => entryLine(e, i + 1, checked.has(e.id))).join('\n'));
      console.log(`  ${C.gray}${checked.size} of ${entries.length} checked${C.reset}`);
      if (dryRun) { outcome = 'accept'; break; }   // dry-run shows defaults; no toggling
      const ans = (await ask(`  ${C.cyan}[#] toggle · [a]ll · [n]one · [Enter] accept · [s]kip · [q]uit:${C.reset} `)).trim().toLowerCase();
      if (ans === '') outcome = 'accept';
      else if (ans === 'q') { quit = true; outcome = 'quit'; }
      else if (ans === 's') outcome = 'skip';
      else if (ans === 'a') entries.forEach((e) => checked.add(e.id));
      else if (ans === 'n') { checked.clear(); entries.forEach((e) => { if (e.isSource) checked.add(e.id); }); checked.add(aniId); }
      else {
        const n = parseInt(ans, 10);
        if (!isNaN(n) && n >= 1 && n <= entries.length) {
          const e = entries[n - 1];
          if (e.isSource) console.log(`  ${C.yellow}MAIN entry is always included${C.reset}`);
          else if (checked.has(e.id)) checked.delete(e.id);
          else checked.add(e.id);
        } else console.log(`  ${C.yellow}? not understood${C.reset}`);
      }
    }

    if (outcome === 'quit') { console.log(`  ${C.yellow}quitting — progress preserved${C.reset}`); break; }
    if (outcome === 'skip') { console.log(`  ${C.gray}row skipped${C.reset}`); reportRows.push({ title, action: 'skipped by user', watched: '', known: '' }); continue; }

    checked.add(aniId);   // belt+suspenders: source always watched
    const watched = Array.from(checked).join(',');
    const known = entries.map((e) => e.id).join(',') || String(aniId);
    await backupOnce();
    if (!dryRun) { setCell(sheet, r, colWatched, watched, 's'); setCell(sheet, r, colKnown, known, 's'); wroteAny = true; }
    console.log(`  ${C.green}${dryRun ? 'would write' : 'wrote'}${C.reset} watched=${watched}`);
    reportRows.push({ title, action: dryRun ? 'would write' : 'wrote', watched, known });
  }

  rl.close();

  // ---- Save + regenerate animeData.js ----
  if (!dryRun && wroteAny) {
    sheet['!ref'] = XLSX.utils.encode_range(range);
    XLSX.writeFile(wb, EXCEL_PATH);
    console.log(`\n${C.green}Excel updated.${C.reset} ${C.gray}Regenerating animeData.js...${C.reset}`);
    try {
      execFileSync(process.execPath, [path.join(__dirname, 'sync-excel-to-js.js')], { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (_) {
      console.error(`${C.yellow}sync failed — run "npm run sync" manually.${C.reset}`);
    }
  } else if (dryRun) {
    console.log(`\n${C.yellow}DRY RUN:${C.reset} no Excel writes, no sync.`);
  } else {
    console.log(`\n${C.gray}Nothing written.${C.reset}`);
  }

  // ---- Report (outside the deploy root) ----
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(MASTER_DIR, `backfill-watched-report-${ts}.md`);
  const lines = [
    '# Watched-set backfill report',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`,
    `- Rows processed: ${reportRows.length}`,
    '',
    '| Title | Action | WatchedAniListIds | KnownAniListIds |',
    '|---|---|---|---|',
  ];
  for (const rr of reportRows) {
    lines.push(`| ${String(rr.title).replace(/\|/g, '\\|')} | ${rr.action} | ${rr.watched} | ${rr.known} |`);
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8');
  console.log(`${C.bold}Report:${C.reset} ${reportPath}`);
}

main().catch((err) => {
  console.error(`${C.red}FATAL:${C.reset} ${err.message}`);
  process.exit(2);
});
