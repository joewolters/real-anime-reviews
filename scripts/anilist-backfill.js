#!/usr/bin/env node
/**
 * Real Anime Reviews — AniList backfill CLI (v1.7.0)
 * ============================================================================
 *
 * One-time catch-up tool. The ~44 legacy reviews pre-date Mode 1's AniList
 * integration, so they have empty AniListId / IdMal / AniListScore /
 * AniListColor / TitleEnglish / TitleRomaji columns. This script walks the
 * canonical Excel row-by-row, queries AniList for each, lets Blake pick the
 * correct match in his terminal, and writes all 6 fields back into Excel — then
 * regenerates animeData.js and drops a verification report.
 *
 * Blake NEVER opens the spreadsheet. This script owns every Excel write,
 * including adding the two missing column headers (TitleEnglish / TitleRomaji).
 *
 * Usage
 * -----
 *   npm run backfill                 # interactive: pick a match per row
 *   npm run backfill -- --dry-run    # queries + prompts, writes NOTHING
 *   npm run backfill -- --auto       # auto-pick only on exact title match,
 *                                    # prompt for everything else
 *   npm run backfill -- --help
 *
 * Behaviour
 * ---------
 *   - Idempotent: rows that already have AniListId are skipped.
 *   - Sequential AniList queries with a 300ms delay (rate-limit friendly).
 *   - Backs up Excel once (before the first write) via the shared
 *     scripts/lib/excel-backup.js helper — same .bak.<ts>.xlsx pattern Mode 1 uses.
 *   - `q` at any prompt quits gracefully, preserving everything confirmed so far.
 *   - Writes a markdown report to ../Master List/backfill-report-<ts>.md
 *     (outside the deploy root — never reaches the public CDN).
 *
 * Exit codes: 0 ok · 2 file/IO error · 3 bad args
 *
 * Author: Code | date: 2026-06-03 | v1.7.0 AniList backfill
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

let XLSX;
try { XLSX = require('xlsx'); }
catch (e) {
  console.error('\x1b[31mERROR:\x1b[0m the "xlsx" package is missing. Run `npm install` first.');
  process.exit(2);
}

const { callAniList } = require('./anilist-fetch');
const { backupExcel, checkExcelLock } = require('./lib/excel-backup');

// ---- Paths -----------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.resolve(PROJECT_ROOT, '..', 'Master List', 'Anime_Master_Table.xlsx');
const MASTER_DIR = path.dirname(EXCEL_PATH);

// ---- ANSI colors -----------------------------------------------------------
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

// The 6 fields we backfill, with their Excel header name + value type.
const BACKFILL_COLUMNS = [
  { header: 'AniListId',    type: 'n' },
  { header: 'IdMal',        type: 'n' },
  { header: 'AniListScore', type: 'n' },   // AniList native 0-100 integer
  { header: 'AniListColor', type: 's' },   // hex string e.g. #e4a15d
  { header: 'TitleEnglish', type: 's' },
  { header: 'TitleRomaji',  type: 's' },
];

// Dedicated query — searchAniList()'s SEARCH_QUERY omits idMal / episodes /
// coverImage.color, all of which we need. POSTed through the shared callAniList.
const BACKFILL_QUERY = `
query ($search: String) {
  Page(page: 1, perPage: 5) {
    media(search: $search, type: ANIME, sort: [POPULARITY_DESC, SCORE_DESC]) {
      id
      idMal
      title { romaji english native }
      format
      seasonYear
      episodes
      averageScore
      coverImage { color }
    }
  }
}`;

// ---- Helpers ---------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeTitle(t) {
  if (!t) return '';
  return String(t)
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[−–—‐]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cellRef(r, c) { return XLSX.utils.encode_cell({ r, c }); }

function getCell(sheet, r, c) {
  const cell = sheet[cellRef(r, c)];
  return cell == null ? null : cell.v;
}

function setCell(sheet, r, c, value, type) {
  sheet[cellRef(r, c)] = { t: type, v: value };
}

// Find a header's column index; returns -1 if absent.
function headerIndex(sheet, range, name) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const v = getCell(sheet, range.s.r, c);
    if (v != null && String(v).trim() === name) return c;
  }
  return -1;
}

function fmtScore(avg) {
  return avg == null ? 'n/a' : `${(avg / 10).toFixed(1)}/10`;
}

function candidateLine(n, m) {
  const romaji = m.title?.romaji || '(no romaji)';
  const eng = m.title?.english && m.title.english !== m.title.romaji ? ` ${C.gray}[${m.title.english}]${C.reset}` : '';
  const meta = [m.format || '?', m.seasonYear || '?', `${m.episodes ?? '?'} eps`, `score ${fmtScore(m.averageScore)}`].join(', ');
  return `  ${C.bold}${n}.${C.reset} ${romaji}${eng} ${C.gray}(${meta}, id ${m.id})${C.reset}`;
}

// Dedicated by-id query (v1.7.1 --match mode): same fields as BACKFILL_QUERY but
// a precise Media(id:) lookup for titles AniList search couldn't auto-match.
const BACKFILL_ID_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title { romaji english native }
    format
    seasonYear
    episodes
    averageScore
    coverImage { color }
  }
}`;

// ---- AniList ---------------------------------------------------------------
async function queryCandidates(title) {
  const data = await callAniList(BACKFILL_QUERY, { search: title });
  return (data && data.Page && data.Page.media) || [];
}

async function queryById(id) {
  const data = await callAniList(BACKFILL_ID_QUERY, { id });
  return (data && data.Media) || null;
}

// Map an AniList Media node to the 6 backfill field values.
function valuesFromMedia(m) {
  return {
    AniListId: m.id ?? null,
    IdMal: m.idMal ?? null,
    AniListScore: m.averageScore ?? null,
    AniListColor: m.coverImage?.color ?? null,
    TitleEnglish: m.title?.english ?? null,
    TitleRomaji: m.title?.romaji ?? null,
  };
}

// Write the 6 fields into one row (skips genuinely-missing values → blank cell).
function writeRow(sheet, r, colIndex, values) {
  for (const { header, type } of BACKFILL_COLUMNS) {
    const val = values[header];
    if (val == null || val === '') continue;
    setCell(sheet, r, colIndex[header], val, type);
  }
}

// Parse repeatable `--match "<Title>" <id>` pairs from argv.
function parseMatches(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--match') {
      const title = args[i + 1];
      const id = parseInt(args[i + 2], 10);
      if (title && !title.startsWith('--') && !isNaN(id)) { out.push({ title, id }); i += 2; }
    }
  }
  return out;
}

// ---- readline prompt -------------------------------------------------------
function makePrompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a)));
  return { ask, close: () => rl.close() };
}

// ---- Report ----------------------------------------------------------------
function buildReport(rows, opts) {
  const ts = new Date().toISOString();
  const lines = [];
  lines.push(`# AniList backfill report`);
  lines.push('');
  lines.push(`- Generated: ${ts}`);
  lines.push(`- Mode: ${opts.dryRun ? 'DRY RUN (no writes)' : 'LIVE'}${opts.auto ? ' + --auto' : ''}`);
  lines.push(`- Rows processed: ${rows.length}`);
  lines.push('');
  lines.push('| Title | Action | AniListId | IdMal | Score | Color | English | Romaji | Native |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const v = r.values || {};
    lines.push(`| ${r.title} | ${r.action} | ${v.AniListId ?? ''} | ${v.IdMal ?? ''} | ${v.AniListScore ?? ''} | ${v.AniListColor ?? ''} | ${(v.TitleEnglish ?? '').replace(/\|/g, '\\|')} | ${(v.TitleRomaji ?? '').replace(/\|/g, '\\|')} | ${(v.TitleNative ?? '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---- Main ------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${C.bold}AniList backfill${C.reset}
  npm run backfill                              interactive
  npm run backfill -- --dry-run                 queries + prompts, no writes
  npm run backfill -- --auto                    auto-pick exact title matches, prompt the rest
  npm run backfill -- --match "<Title>" <id>    write a specific row by explicit AniList id
                                                (repeatable; combine with --dry-run)
  npm run backfill -- --add-native              populate TitleNative (Japanese title) for every
                                                row with an AniListId (idempotent; by id, not title)
`);
    return;
  }
  const dryRun = args.includes('--dry-run');
  const auto = args.includes('--auto');
  const addNative = args.includes('--add-native');
  const matches = parseMatches(args);

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`${C.red}ERROR:${C.reset} Excel not found at ${EXCEL_PATH}`);
    process.exit(2);
  }
  if (!dryRun) checkExcelLock(EXCEL_PATH);

  console.log(`${C.bold}${dryRun ? 'DRY RUN — ' : ''}AniList backfill${C.reset}  ${C.gray}(${auto ? '--auto, ' : ''}sequential, 300ms delay)${C.reset}\n`);

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  // Ensure all 6 backfill column headers exist; add any missing at the end.
  const colIndex = {};
  let appended = false;
  for (const { header } of BACKFILL_COLUMNS) {
    let idx = headerIndex(sheet, range, header);
    if (idx === -1) {
      idx = range.e.c + 1;
      range.e.c = idx;
      if (!dryRun) setCell(sheet, range.s.r, idx, header, 's');
      appended = true;
      console.log(`${C.cyan}+ column${C.reset} "${header}" ${dryRun ? '(would be added)' : `added at col ${idx}`}`);
    }
    colIndex[header] = idx;
  }
  if (appended) console.log('');

  const titleIdx = headerIndex(sheet, range, 'Title');
  const aniIdIdx = colIndex.AniListId;
  if (titleIdx === -1) { console.error(`${C.red}ERROR:${C.reset} no "Title" column.`); process.exit(2); }

  const reportRows = [];
  let backedUp = false;
  let wroteAny = false;
  const backupOnce = async () => {
    if (!dryRun && !backedUp) {
      const bak = await backupExcel(EXCEL_PATH);
      console.log(`  ${C.gray}backup: ${path.basename(bak)}${C.reset}`);
      backedUp = true;
    }
  };

  // ---- Add-native mode (v1.7.1 gate 1f): populate TitleNative by AniList id --
  if (addNative) {
    // ensure the TitleNative column exists (col 20 — added if missing)
    let nIdx = headerIndex(sheet, range, 'TitleNative');
    if (nIdx === -1) {
      nIdx = range.e.c + 1;
      range.e.c = nIdx;
      if (!dryRun) setCell(sheet, range.s.r, nIdx, 'TitleNative', 's');
      appended = true;
      console.log(`${C.cyan}+ column${C.reset} "TitleNative" ${dryRun ? '(would be added)' : `added at col ${nIdx}`}`);
    }
    colIndex.TitleNative = nIdx;

    console.log(`${C.bold}--add-native${C.reset} ${C.gray}(Japanese titles by AniList id, idempotent)${C.reset}`);
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const title = getCell(sheet, r, titleIdx);
      if (title == null || String(title).trim() === '') continue;
      const aniId = getCell(sheet, r, aniIdIdx);
      if (aniId == null || String(aniId).trim() === '') {
        console.log(`${C.gray}· skip${C.reset} "${title}" (no AniListId)`);
        reportRows.push({ title, action: 'skip (no AniListId)', values: {} });
        continue;
      }
      const existingNative = getCell(sheet, r, nIdx);
      if (existingNative != null && String(existingNative).trim() !== '') {
        console.log(`${C.gray}· skip${C.reset} "${title}" (already has native)`);
        reportRows.push({ title, action: 'skip (already populated)', values: { TitleNative: existingNative } });
        continue;
      }
      const id = parseInt(aniId, 10);
      console.log(`\n${C.bold}${title}${C.reset} ${C.gray}→ id ${id}${C.reset}`);
      let media;
      try { media = await queryById(id); }
      catch (err) {
        console.log(`  ${C.red}query failed:${C.reset} ${err.message} — skipping`);
        reportRows.push({ title, action: `query error: ${err.message}`, values: {} });
        continue;
      }
      await sleep(300);
      const native = media?.title?.native || null;
      if (!native) {
        console.log(`  ${C.yellow}no native title${C.reset} for id ${id} — skipping`);
        reportRows.push({ title, action: 'no native title', values: {} });
        continue;
      }
      await backupOnce();
      if (!dryRun) { setCell(sheet, r, nIdx, native, 's'); wroteAny = true; }
      console.log(`  ${C.green}${dryRun ? 'would write' : 'wrote'}${C.reset} ${native}`);
      reportRows.push({ title, action: `native by id ${id}`, values: { TitleNative: native } });
    }
  } else if (matches.length) {
    for (const { title, id } of matches) {
      let rowIdx = -1;
      for (let rr = range.s.r + 1; rr <= range.e.r; rr++) {
        const t = getCell(sheet, rr, titleIdx);
        if (t != null && normalizeTitle(t) === normalizeTitle(title)) { rowIdx = rr; break; }
      }
      if (rowIdx === -1) {
        console.log(`${C.yellow}no row${C.reset} matching "${title}" — skipping`);
        reportRows.push({ title, action: 'no matching Excel row', values: {} });
        continue;
      }
      console.log(`\n${C.bold}${title}${C.reset} ${C.gray}→ AniList id ${id}${C.reset}`);
      let media;
      try { media = await queryById(id); }
      catch (err) {
        console.log(`  ${C.red}query failed:${C.reset} ${err.message} — skipping`);
        reportRows.push({ title, action: `query error: ${err.message}`, values: {} });
        continue;
      }
      await sleep(300);
      if (!media) {
        console.log(`  ${C.yellow}no Media for id ${id}${C.reset} — skipping`);
        reportRows.push({ title, action: `no Media for id ${id}`, values: {} });
        continue;
      }
      const values = valuesFromMedia(media);
      await backupOnce();
      if (!dryRun) { writeRow(sheet, rowIdx, colIndex, values); wroteAny = true; }
      console.log(`  ${C.green}${dryRun ? 'would write' : 'wrote'}${C.reset} id ${values.AniListId}, score ${values.AniListScore ?? 'n/a'}`);
      reportRows.push({ title, action: `matched by id ${id}`, values });
    }
  } else {
  const { ask, close } = makePrompter();
  let quit = false;

  for (let r = range.s.r + 1; r <= range.e.r && !quit; r++) {
    const title = getCell(sheet, r, titleIdx);
    if (title == null || String(title).trim() === '') continue;       // blank row
    const existingId = getCell(sheet, r, aniIdIdx);
    if (existingId != null && String(existingId).trim() !== '') {
      console.log(`${C.gray}· skip${C.reset} "${title}" ${C.gray}(already has AniListId ${existingId})${C.reset}`);
      reportRows.push({ title, action: 'skip (already populated)', values: {} });
      continue;
    }

    console.log(`\n${C.bold}${title}${C.reset}`);
    let candidates;
    try {
      candidates = await queryCandidates(String(title));
    } catch (err) {
      console.log(`  ${C.red}query failed:${C.reset} ${err.message} — skipping`);
      reportRows.push({ title, action: `query error: ${err.message}`, values: {} });
      continue;
    }
    await sleep(300);   // rate-limit courtesy between AniList calls

    if (candidates.length === 0) {
      console.log(`  ${C.yellow}no matches${C.reset} — skipping`);
      reportRows.push({ title, action: 'no matches', values: {} });
      continue;
    }

    candidates.forEach((m, i) => console.log(candidateLine(i + 1, m)));

    // --auto: take the top result only if its romaji OR english exactly matches.
    let choiceIdx = null;
    if (auto) {
      const top = candidates[0];
      const nt = normalizeTitle(title);
      if (normalizeTitle(top.title?.romaji) === nt || normalizeTitle(top.title?.english) === nt) {
        choiceIdx = 0;
        console.log(`  ${C.green}auto-picked #1${C.reset} ${C.gray}(exact title match)${C.reset}`);
      }
    }

    if (choiceIdx == null) {
      const answer = (await ask(`  ${C.cyan}pick 1-${candidates.length}, [s]kip, [q]uit:${C.reset} `)).trim().toLowerCase();
      if (answer === 'q') { quit = true; console.log(`  ${C.yellow}quitting — progress preserved${C.reset}`); break; }
      if (answer === 's' || answer === '') {
        console.log(`  ${C.gray}skipped${C.reset}`);
        reportRows.push({ title, action: 'skipped by user', values: {} });
        continue;
      }
      const n = parseInt(answer, 10);
      if (isNaN(n) || n < 1 || n > candidates.length) {
        console.log(`  ${C.yellow}invalid — skipping${C.reset}`);
        reportRows.push({ title, action: `invalid input "${answer}" — skipped`, values: {} });
        continue;
      }
      choiceIdx = n - 1;
    }

    const m = candidates[choiceIdx];
    const values = valuesFromMedia(m);
    await backupOnce();
    if (!dryRun) { writeRow(sheet, r, colIndex, values); wroteAny = true; }
    console.log(`  ${C.green}${dryRun ? 'would write' : 'wrote'}${C.reset} id ${values.AniListId}, score ${values.AniListScore ?? 'n/a'}`);
    reportRows.push({ title, action: choiceIdx === 0 && auto ? 'auto-picked' : `picked #${choiceIdx + 1}`, values });
  }

  close();
  }

  // ---- Save phase ----------------------------------------------------------
  if (!dryRun && (wroteAny || appended)) {
    sheet['!ref'] = XLSX.utils.encode_range(range);
    XLSX.writeFile(wb, EXCEL_PATH);
    console.log(`\n${C.green}Excel updated.${C.reset}`);
    console.log(`${C.gray}Regenerating animeData.js...${C.reset}`);
    try {
      execFileSync(process.execPath, [path.join(__dirname, 'sync-excel-to-js.js')], { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (err) {
      console.error(`${C.yellow}sync failed — run "npm run sync" manually.${C.reset}`);
    }
  } else if (dryRun) {
    console.log(`\n${C.yellow}DRY RUN:${C.reset} no Excel writes, no sync.`);
  } else {
    console.log(`\n${C.gray}Nothing written.${C.reset}`);
  }

  // ---- Report --------------------------------------------------------------
  const reportTs = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(MASTER_DIR, `backfill-report-${reportTs}.md`);
  fs.writeFileSync(reportPath, buildReport(reportRows, { dryRun, auto }), 'utf8');
  console.log(`${C.bold}Report:${C.reset} ${reportPath}`);
}

main().catch((err) => {
  console.error(`${C.red}FATAL:${C.reset} ${err.message}`);
  process.exit(2);
});
