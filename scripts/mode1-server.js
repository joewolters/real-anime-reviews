#!/usr/bin/env node
/**
 * Real Anime Reviews — Mode 1 server
 * ============================================================================
 * Local Node + Express server that turns the Mode 1 paste workflow into a
 * one-click "Submit & Ship". Run with `npm run mode1`, opens at
 * http://localhost:8888/admin/new-anime.
 *
 * Author: Code | date: 2026-05-10 | Mode 1 server (v1.6.1)
 * ============================================================================
 */

'use strict';

const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

let XLSX;
try { XLSX = require('xlsx'); }
catch (e) {
  console.error('\x1b[31mERROR:\x1b[0m the "xlsx" package is missing. Run `npm install` first.');
  process.exit(2);
}

// Default :8888 (Blake's local). Honors MODE1_PORT so the Playwright server spec
// can spawn an isolated instance on another port without clashing with a running one.
const PORT = process.env.MODE1_PORT || 8888;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.resolve(PROJECT_ROOT, '..', 'Master List', 'Anime_Master_Table.xlsx');
const ASSETS_DIR = path.resolve(PROJECT_ROOT, 'assets');
const INDEX_HTML = path.resolve(PROJECT_ROOT, 'index.html');
const CHANGELOG_MD = path.resolve(PROJECT_ROOT, 'CHANGELOG.md');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', gray: '\x1b[90m',
};

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

// Strip ANSI color escapes (e.g. \x1b[33m) from a line so the form's log
// panel doesn't render literal `\x1b[33m...` garbage.
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

// Run a shell command, stream stdout/stderr lines to the SSE callback.
//
// `shell: true` for npm/npx/firebase is INTENTIONAL despite DEP0190.
// DO NOT "fix" the deprecation warning by going back to shell:false + .cmd —
// that's exactly what Bug 10 (v1.6.0 → v1.6.1 hotfix) was. Read the why:
//
//   These three are .cmd batch wrappers on Windows, not real .exe binaries.
//   Two alternatives both fail on modern Node:
//     - spawn('npm', [...], { shell: true })       → DEP0190 warning (cosmetic)
//     - spawn('npm.cmd', [...], { shell: false })  → spawn EINVAL on Node
//       ≥20.12.2 (CVE-2024-27980 mitigation blocks .bat/.cmd via shell:false)
//   We pick shell:true. DEP0190 warns about argument-injection risk via the
//   shell; that risk is NIL here because every args[] passed in this file is
//   a static string literal — no user input ever reaches npm/firebase/npx
//   (titles/reviews go to git commit -m and Excel cells, both shell:false).
//   The deprecation warning is cosmetic noise for our usage.
//
// Git/node are real .exe binaries — shell:false works and is preferred
// (using shell with them mangles args containing spaces).
function runCmd(cmd, args, opts, onLine) {
  const needsShell = ['npm', 'npx', 'firebase'].includes(cmd);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: PROJECT_ROOT, shell: needsShell, ...opts });
    let stdoutBuf = '', stderrBuf = '';
    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stripAnsi(stdoutBuf.slice(0, nl).trimEnd());
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (line && onLine) onLine(line);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      let nl;
      while ((nl = stderrBuf.indexOf('\n')) !== -1) {
        const line = stripAnsi(stderrBuf.slice(0, nl).trimEnd());
        stderrBuf = stderrBuf.slice(nl + 1);
        if (line && onLine) onLine(line);
      }
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
  });
}

async function downloadFile(url, destPath, { allowOverwrite = false } = {}) {
  if (!allowOverwrite && fs.existsSync(destPath)) {
    throw new Error(`Image already exists at assets/${path.basename(destPath)} — delete or rename the existing file, or use the "Override" option in the form to point at a different filename in assets/.`);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const buf = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(destPath, buf);
  return buf.length;
}

// v1.7.0 — backupExcel + checkExcelLock extracted to scripts/lib/excel-backup.js
// so the AniList backfill CLI reuses the same logic. Call sites below pass
// EXCEL_PATH explicitly. Behaviour is byte-identical to the prior inline versions.
const { backupExcel, checkExcelLock } = require('./lib/excel-backup');
// v1.8.1 (gate 4) — the edit page's "fix platforms" one-click reuses the CLI's
// mapping/allowlist/override rules + AniList streaming fetch.
const franchiseFetch = require('../franchise-fetch.js');
const { proposePlatformsForRow } = require('../admin/platform-map');

// Pre-flight: check the existing animeData.js for a duplicate Title BEFORE
// mutating Excel. Sync would catch it later, but by then Excel is already
// changed and recovery requires the .bak restore.
async function checkDuplicateTitle(title) {
  const animeDataPath = path.join(PROJECT_ROOT, 'animeData.js');
  if (!fs.existsSync(animeDataPath)) return; // first sync ever; can't conflict
  const text = await fsp.readFile(animeDataPath, 'utf8');
  const titleRegex = /Title:\s*"([^"]+)"/g;
  const norm = (s) => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[−–—]/g, '-').replace(/\s+/g, ' ').trim();
  const target = norm(title);
  let m;
  while ((m = titleRegex.exec(text)) !== null) {
    if (norm(m[1]) === target) {
      throw new Error(`"${title}" already exists in animeData.js (matched "${m[1]}"). Pick a different title or remove the existing entry first.`);
    }
  }
}

// Pre-flight (server startup): smoke-check that runCmd can actually invoke
// npm and git on this machine. Catches Bug-10-class breakage at startup,
// before Blake clicks Submit & Ship and watches the pipeline hang mid-flight.
async function smokeCheckSpawn() {
  for (const cmd of ['npm', 'git']) {
    try {
      const code = await runCmd(cmd, ['--version'], {}, () => {});
      if (code !== 0) throw new Error(`${cmd} --version exited with code ${code}`);
    } catch (err) {
      const isEinval = err.code === 'EINVAL' || /EINVAL/.test(err.message || '');
      const hint = isEinval
        ? `Likely cause: someone changed shell:true back to shell:false for the .cmd wrappers in runCmd. Read the WHY comment above runCmd in scripts/mode1-server.js — that's Bug 10 territory (CVE-2024-27980 mitigation in Node ≥20.12.2 blocks .bat/.cmd via shell:false).`
        : `Check that ${cmd} is installed and on your PATH.`;
      console.error(`${C.red}[mode1] spawn smoke check failed: runCmd cannot invoke ${cmd}${C.reset}`);
      console.error(`  Error:  ${err.message}`);
      console.error(`  See:    scripts/mode1-server.js (the runCmd function, ~line 60)`);
      console.error(`  ${hint}`);
      process.exit(3);
    }
  }
}

async function appendExcelRow(rowData) {
  if (!fs.existsSync(EXCEL_PATH)) throw new Error(`Excel file not found at ${EXCEL_PATH}`);
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const newRowIdx = range.e.r + 1;
  for (let c = 0; c < rowData.length; c++) {
    const value = rowData[c];
    if (value == null || value === '') continue;
    const cellRef = XLSX.utils.encode_cell({ r: newRowIdx, c });
    sheet[cellRef] = { t: typeof value === 'number' ? 'n' : 's', v: value };
  }
  range.e.r = newRowIdx;
  if (range.e.c < rowData.length - 1) range.e.c = rowData.length - 1;
  sheet['!ref'] = XLSX.utils.encode_range(range);
  XLSX.writeFile(wb, EXCEL_PATH);
}

// v1.8.1 — Edit an EXISTING catalog row. Finds the row by slug(Title) and overwrites
// ONLY the given columns (looked up by HEADER NAME), gated by a hard allowlist so it
// can never write Title (slug is derived from it), the AniList-derived fields, or
// KnownAniListIds. Never adds/removes rows; never touches a column not in `fields` or
// any other row. Returns { rowIndex, changed }.
const EDITABLE_HEADERS = new Set([
  'Rating', 'Seasons', 'Genre', 'Description', 'Review', 'Tags',
  'Watch', 'Studio', 'Trailer', 'Top10Rank', 'WatchedAniListIds',
]);
async function updateExcelRow(slug, fields, { dryRun = false } = {}) {
  if (!fs.existsSync(EXCEL_PATH)) throw new Error(`Excel file not found at ${EXCEL_PATH}`);
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  // header name -> column index
  const col = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    if (cell && cell.v != null) col[String(cell.v).trim()] = c;
  }
  if (col.Title == null) throw new Error('Title column not found in Excel header.');
  // find the data row whose slug(Title) matches
  let targetRow = -1;
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const tCell = sheet[XLSX.utils.encode_cell({ r, c: col.Title })];
    const t = tCell && tCell.v != null ? String(tCell.v) : '';
    if (t && slugify(t) === slug) { targetRow = r; break; }
  }
  if (targetRow === -1) throw new Error(`No catalog row matches slug "${slug}".`);
  const changed = [];
  for (const [header, value] of Object.entries(fields || {})) {
    if (!EDITABLE_HEADERS.has(header)) continue;   // hard allowlist — never write protected columns
    const c = col[header];
    if (c == null) continue;
    const ref = XLSX.utils.encode_cell({ r: targetRow, c });
    if (value == null || String(value).trim() === '') {
      delete sheet[ref];                            // clear the cell
    } else if (header === 'Top10Rank') {
      sheet[ref] = { t: 'n', v: parseInt(value, 10) };
    } else {
      sheet[ref] = { t: 's', v: String(value) };
    }
    changed.push(header);
  }
  // range is unchanged (no rows/cols added) — write back (skipped on a dryRun, which
  // only validates the slug→row lookup + allowlist path; the cells above are mutated
  // on the in-memory workbook and discarded).
  if (!dryRun) XLSX.writeFile(wb, EXCEL_PATH);
  return { rowIndex: targetRow, changed };
}

async function updateChangelogWidget(newBullets) {
  const html = await fsp.readFile(INDEX_HTML, 'utf8');
  const ulRegex = /(<ul class="changelog-list">)([\s\S]*?)(<\/ul>)/;
  if (!ulRegex.test(html)) throw new Error('Could not find <ul class="changelog-list"> in index.html');
  const indent = '      ';
  const bulletHtml = newBullets.map(b => `${indent}<li>${escapeHtmlForLi(b)}</li>`).join('\n');
  const updated = html.replace(ulRegex, `$1\n${bulletHtml}\n${indent.slice(0, -2)}$3`);
  await fsp.writeFile(INDEX_HTML, updated, 'utf8');
}

function escapeHtmlForLi(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Bug 9 (override case): sync's slug-based fallback handles the AniList
// default case automatically. For Blake's manual-override filename (which
// may not match the slug), patch animeData.js after sync.
async function patchAnimeDataImage(title, imageFilename) {
  const animeDataPath = path.join(PROJECT_ROOT, 'animeData.js');
  if (!fs.existsSync(animeDataPath)) return false;
  const text = await fsp.readFile(animeDataPath, 'utf8');
  const titleRegex = new RegExp(`(Title:\\s*"${escapeRegex(title)}"[\\s\\S]*?image:\\s*")([^"]+)(")`);
  if (!titleRegex.test(text)) return false;
  const updated = text.replace(titleRegex, `$1${imageFilename}$3`);
  if (updated === text) return false;
  await fsp.writeFile(animeDataPath, updated, 'utf8');
  return true;
}

function nextPatchVersion(currentVersion) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion);
  if (!m) throw new Error(`Bad current version: ${currentVersion}`);
  return `${m[1]}.${m[2]}.${parseInt(m[3], 10) + 1}`;
}

async function readCurrentVersion() {
  const html = await fsp.readFile(INDEX_HTML, 'utf8');
  const m = /window\.APP_VERSION="([^"]+)"/.exec(html);
  if (!m) throw new Error('Could not read APP_VERSION from index.html');
  return m[1];
}

async function addChangelogEntry(version, title) {
  // Normalize CRLF → LF so the separator lookup works on Windows-edited files
  const raw = await fsp.readFile(CHANGELOG_MD, 'utf8');
  const md = raw.replace(/\r\n/g, '\n');
  const today = new Date().toISOString().slice(0, 10);
  const entry = `<!-- author: Mode 1 | date: ${today} -->\n## v${version} — PATCH (${today})\n\n**Add anime: ${title}.** Shipped via Mode 1's one-click Submit & Ship.\n\n`;
  const sepIdx = md.indexOf('\n---\n\n');
  if (sepIdx === -1) throw new Error('Could not find --- separator in CHANGELOG.md');
  const before = md.slice(0, sepIdx + 6);
  const after = md.slice(sepIdx + 6);
  await fsp.writeFile(CHANGELOG_MD, before + entry + after, 'utf8');
}

// v1.8.1 — CHANGELOG entry for an EDIT ship (Tier-2). Same shape as addChangelogEntry
// but edit-appropriate copy.
async function addEditChangelogEntry(version, title) {
  const raw = await fsp.readFile(CHANGELOG_MD, 'utf8');
  const md = raw.replace(/\r\n/g, '\n');
  const today = new Date().toISOString().slice(0, 10);
  const entry = `<!-- author: Mode 1 | date: ${today} -->\n## v${version} — PATCH (${today})\n\n**Updated the ${title} review.** Edited via the admin edit page (Mode 1 one-click ship).\n\n`;
  const sepIdx = md.indexOf('\n---\n\n');
  if (sepIdx === -1) throw new Error('Could not find --- separator in CHANGELOG.md');
  const before = md.slice(0, sepIdx + 6);
  const after = md.slice(sepIdx + 6);
  await fsp.writeFile(CHANGELOG_MD, before + entry + after, 'utf8');
}

async function readExistingBullets() {
  const html = await fsp.readFile(INDEX_HTML, 'utf8');
  const m = /<ul class="changelog-list">([\s\S]*?)<\/ul>/.exec(html);
  if (!m) return [];
  const bullets = [];
  const liRegex = /<li>([\s\S]*?)<\/li>/g;
  let li;
  while ((li = liRegex.exec(m[1])) !== null) {
    bullets.push(li[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));
  }
  return bullets;
}

// ---- The main "ship" sequence ---------------------------------------------
async function runShipSequence(payload, send, opts = {}) {
  const { dryRun = false, skipDeploy = false } = opts;
  const {
    title, rating, seasons, genre, description, review, tags,
    watchOfficial, studio, trailer, top10Rank,
    aniListId, idMal, aniListScore, aniListColor,
    titleEnglish, titleRomaji, titleNative,
    watchedAniListIds, knownAniListIds,
    imageSource, imageUrl, imageOverrideFilename, customBullets,
  } = payload;

  // ---- Step 0 (pre-flight): Excel lock + duplicate-title checks ----
  send('step', { id: 'preflight', label: 'Pre-flight checks', status: 'running' });
  checkExcelLock(EXCEL_PATH);
  await checkDuplicateTitle(title);
  send('step', { id: 'preflight', label: 'Pre-flight checks (Excel free, no duplicate title)', status: 'done' });

  // ---- Step 1: cover image ----
  send('step', { id: 'image', label: 'Cover image', status: 'running' });
  let imageFilename;
  if (imageSource === 'override') {
    imageFilename = imageOverrideFilename;
    if (!fs.existsSync(path.join(ASSETS_DIR, imageFilename))) {
      throw new Error(`Override image not found at assets/${imageFilename} — drop the file there first.`);
    }
    send('step', { id: 'image', label: `Cover image (using your override: ${imageFilename})`, status: 'done' });
  } else {
    const slug = slugify(title);
    imageFilename = `${slug}.png`;
    const destPath = path.join(ASSETS_DIR, imageFilename);
    if (!imageUrl) throw new Error('AniList cover URL missing from payload.');
    if (!dryRun) {
      const bytes = await downloadFile(imageUrl, destPath); // throws if exists
      send('step', { id: 'image', label: `Cover image (downloaded ${imageFilename}, ${(bytes/1024).toFixed(0)} KB)`, status: 'done' });
    } else {
      send('step', { id: 'image', label: `Cover image (would download → ${imageFilename})`, status: 'done' });
    }
  }

  // ---- Step 2: backup + append Excel ----
  send('step', { id: 'excel', label: 'Backup + append row to Excel', status: 'running' });
  if (!dryRun) {
    const backup = await backupExcel(EXCEL_PATH);
    send('log', { line: `Excel backup: ${path.basename(backup)}` });
  }
  const watchCombined = watchOfficial || '';   // v1.7.3 — official only (unofficial removed)
  // v1.7.3 — belt+suspenders: guarantee the source AniListId is in the watched set.
  const watchedFinal = (() => {
    const set = new Set(String(watchedAniListIds || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)));
    if (aniListId) set.add(parseInt(aniListId, 10));
    return Array.from(set).join(',');
  })();
  const rowData = [
    title, rating, seasons, genre, description, review, tags, watchCombined, studio, trailer,
    null, null,
    top10Rank ? parseInt(top10Rank, 10) : null,
    aniListId ? parseInt(aniListId, 10) : null,
    idMal ? parseInt(idMal, 10) : null,
    aniListScore ? parseInt(aniListScore, 10) : null,
    aniListColor || null,
    titleEnglish || null, titleRomaji || null, titleNative || null,
    watchedFinal || null, knownAniListIds || null,
  ];
  if (!dryRun) await appendExcelRow(rowData);
  send('step', { id: 'excel', label: 'Backup + append row to Excel', status: 'done' });

  // ---- Step 3: sync ----
  send('step', { id: 'sync', label: 'Sync Excel → animeData.js', status: 'running' });
  if (!dryRun) {
    const code = await runCmd('node', ['scripts/sync-excel-to-js.js'], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`sync exited with code ${code}`);
    // Bug 9 fix (override case): if Blake provided a custom filename, ensure
    // animeData.js points to it (sync's slug-fallback would have used the
    // slug-derived name, not Blake's override).
    if (imageSource === 'override') {
      const patched = await patchAnimeDataImage(title, imageFilename);
      if (patched) send('log', { line: `Patched animeData.js: image for "${title}" → ${imageFilename}` });
    }
  }
  send('step', { id: 'sync', label: 'Sync Excel → animeData.js', status: 'done' });

  // ---- Step 4: changelog widget bullets ----
  // Drop previous "Added: …" bullets from the widget so a streak of new-anime
  // ships doesn't push every prose bullet (genuine release notes) off the
  // visible list. Cap at 5 total entries.
  send('step', { id: 'widget', label: 'Update homepage Update Log widget', status: 'running' });
  const existingBullets = await readExistingBullets();
  const bullets = (customBullets && customBullets.length)
    ? customBullets
    : [`Added: ${title}`, ...existingBullets.filter(b => !b.startsWith('Added:'))].slice(0, 5);
  if (!dryRun) await updateChangelogWidget(bullets);
  send('step', { id: 'widget', label: `Update Log widget (${bullets.length} bullets)`, status: 'done' });

  // ---- Step 5: bump version ----
  send('step', { id: 'bump', label: 'Bump version', status: 'running' });
  const currentVersion = await readCurrentVersion();
  const newVersion = nextPatchVersion(currentVersion);
  if (!dryRun) {
    const code = await runCmd('node', ['scripts/bump-version.js', newVersion], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`bump-version exited with code ${code}`);
  }
  send('step', { id: 'bump', label: `Bump version (v${currentVersion} → v${newVersion})`, status: 'done' });

  // ---- Step 6: CHANGELOG.md ----
  send('step', { id: 'changelog', label: 'Update CHANGELOG.md', status: 'running' });
  if (!dryRun) await addChangelogEntry(newVersion, title);
  send('step', { id: 'changelog', label: 'Update CHANGELOG.md', status: 'done' });

  // ---- Step 7: tests ----
  send('step', { id: 'tests', label: 'Run Playwright tests', status: 'running' });
  if (!dryRun) {
    const code = await runCmd('npm', ['test'], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`npm test failed with code ${code} — fix tests before shipping`);
  }
  send('step', { id: 'tests', label: 'Run Playwright tests (passed)', status: 'done' });

  // ---- Step 8: git commit (+ push unless skipPush) ----
  // Scoped git add — only the files this Mode 1 ship is supposed to touch.
  // Avoids sweeping unrelated WIP into the commit (e.g. partially-baked
  // baseline work, debug edits in other files).
  const stepLabel = opts.skipPush ? 'Git commit (push skipped — test mode)' : 'Git commit + push';
  send('step', { id: 'git', label: stepLabel, status: 'running' });
  if (!dryRun) {
    const scopedPaths = [
      'CHANGELOG.md',
      'animeData.js',
      'index.html',
      'account.html',
      'admin/new-anime.html',
      `assets/${imageFilename}`,
    ];
    let code = await runCmd('git', ['add', '--', ...scopedPaths], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`git add failed (code ${code})`);
    code = await runCmd('git', ['commit', '-m', `Add anime: ${title}`], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`git commit failed (code ${code})`);
    if (!opts.skipPush) {
      code = await runCmd('git', ['push'], {}, (line) => send('log', { line }));
      if (code !== 0) throw new Error(`git push failed (code ${code}) — check your auth / network`);
    }
  }
  send('step', { id: 'git', label: stepLabel, status: 'done' });

  // ---- Step 9: deploy (skipped if skipDeploy) ----
  if (skipDeploy) {
    send('step', { id: 'deploy', label: 'Deploy to Firebase (skipped — confirm in UI)', status: 'pending' });
    send('done', { newVersion, awaitingDeploy: true });
    return;
  }
  send('step', { id: 'deploy', label: 'Deploy to Firebase', status: 'running' });
  if (!dryRun) {
    const code = await runCmd('firebase', ['deploy', '--only', 'hosting'], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`firebase deploy failed (code ${code})`);
  }
  send('step', { id: 'deploy', label: 'Deploy to Firebase', status: 'done' });
  send('done', { newVersion, awaitingDeploy: false });
}

// ---- v1.7.3 — chatbot (/api/chat) helpers --------------------------------
// Read ANTHROPIC_API_KEY from process.env first, then Current Version/.env
// (gitignored + firebase-ignored). No dotenv dep — a one-line parse is enough.
function readAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  try {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (!fs.existsSync(envPath)) return null;
    const m = fs.readFileSync(envPath, 'utf8').match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/m);
    return m ? m[1].replace(/^["']|["']$/g, '').trim() : null;
  } catch (_) { return null; }
}

function buildChatSystemPrompt(ctx = {}) {
  const studios = Array.isArray(ctx.studios) ? ctx.studios.join(', ') : (ctx.studios || '');
  const genres = Array.isArray(ctx.genres) ? ctx.genres.join(', ') : (ctx.genres || '');
  const synopsis = String(ctx.description || '').replace(/<[^>]+>/g, '').slice(0, 800);
  return [
    `You are an anime assistant helping Blake write a review entry for his site "Real Anime Reviews."`,
    `You are helping with ONE specific anime:`,
    `  Title: ${ctx.title || ''}   Romaji: ${ctx.romaji || ''}`,
    `  Year: ${ctx.year || ''}   Format: ${ctx.format || ''}   Studios: ${studios}`,
    `  Genres: ${genres}`,
    `  Synopsis: ${synopsis}`,
    `Produce concise, ready-to-paste content: descriptions in a natural review voice (1 paragraph,`,
    `no major spoilers), tags as space-separated #hashtags, or short factual answers. Keep it tight —`,
    `this lands in form fields. Never name AniList (or any data source) in text meant for the public site.`,
  ].join('\n');
}

// ---- Express app ---------------------------------------------------------
const app = express();
app.use(express.json({ limit: '10mb' }));

// `extensions: ['html']` mirrors Firebase Hosting's `cleanUrls: true`
app.use(express.static(PROJECT_ROOT, { index: 'index.html', extensions: ['html'] }));

app.get('/api/health', async (req, res) => {
  // Read APP_VERSION dynamically — bump-version.js doesn't touch this file, so
  // hardcoding was the silent-staleness sibling of Bug 10. Reuses the existing
  // readCurrentVersion() helper (defined above for the bump pipeline).
  try {
    const version = await readCurrentVersion();
    res.json({ ok: true, server: 'mode1', version });
  } catch {
    res.json({ ok: true, server: 'mode1', version: 'unknown' });
  }
});

app.post('/api/submit', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  try {
    const opts = {
      dryRun: !!req.query.dryRun,
      skipDeploy: !!req.query.skipDeploy,
      skipPush: !!req.query.skipPush, // test mode — commit locally but don't push
    };
    await runShipSequence(req.body, send, opts);
  } catch (err) {
    console.error(`${C.red}[mode1]${C.reset} Ship failed: ${err.message}`);
    send('error', { message: err.message });
  } finally { res.end(); }
});

app.post('/api/deploy', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  try {
    send('step', { id: 'deploy', label: 'Deploy to Firebase', status: 'running' });
    const code = await runCmd('firebase', ['deploy', '--only', 'hosting'], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`firebase deploy failed (code ${code})`);
    send('step', { id: 'deploy', label: 'Deploy to Firebase', status: 'done' });
    send('done', {});
  } catch (err) { send('error', { message: err.message }); }
  finally { res.end(); }
});

// v1.7.3 — chatbot: one-shot Anthropic Messages proxy (Haiku). Raw fetch (no
// @anthropic-ai/sdk dep). Key from .env; 503 when missing so the drawer can
// show a helpful setup hint. A future Cloud Function is a drop-in swap.
app.post('/api/chat', async (req, res) => {
  const key = readAnthropicKey();
  if (!key) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in .env' });
  }
  const { messages, animeContext } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] required' });
  }
  const t0 = Date.now();
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        // v1.7.3 gate 3b — prompt caching on the system block (ephemeral). The
        // anime-context system prompt is stable across a session's turns; caching
        // it trims input cost on multi-turn chats. (No-op below Haiku's cache
        // minimum, but structurally correct + future-proof as the prompt grows.)
        system: [{ type: 'text', text: buildChatSystemPrompt(animeContext), cache_control: { type: 'ephemeral' } }],
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || ''),
        })),
      }),
    });
    const body = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      const msg = body?.error?.message || `Anthropic HTTP ${apiRes.status}`;
      console.error(`${C.red}[mode1] /api/chat${C.reset} ${msg}`);
      return res.status(apiRes.status >= 500 ? 502 : apiRes.status).json({ error: msg });
    }
    const text = (body.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const u = body.usage || {};
    console.log(`${C.gray}[mode1] /api/chat${C.reset} ${body.model || 'haiku'} · in ${u.input_tokens ?? '?'} / out ${u.output_tokens ?? '?'} tok · cache w/r ${u.cache_creation_input_tokens ?? 0}/${u.cache_read_input_tokens ?? 0} · ${Date.now() - t0}ms`);
    res.json({ text });
  } catch (err) {
    console.error(`${C.red}[mode1] /api/chat${C.reset} ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// v1.7.4 (gate 3) — per-season review CRUD (local admin only; 127.0.0.1).
// Writes Current Version/season-reviews/<id>.md and rebuilds index.json directly
// via the shared builder (fast — no Excel read). Production serves the .md +
// index.json as static files; these endpoints are the WRITE path for Blake's
// local /admin/season-reviews panel.
const { buildSeasonReviewIndex, parseFrontmatter, SEASON_DIR } = require('./lib/season-review-index');
function seasonReviewPath(id) { return path.join(SEASON_DIR, id + '.md'); }
function validSeasonId(raw) {
  const id = parseInt(raw, 10);
  return (Number.isInteger(id) && id > 0 && String(id) === String(raw).trim()) ? id : null;
}

// v1.8.1 — Tier-1 "Save": edit an existing catalog row's data fields. Plain JSON
// (not SSE — it's a quick local write). Lock-check → backup → updateExcelRow(slug) →
// sync. Does NOT bump/commit/deploy (that's the Tier-2 "Ship" path, gate 2).
app.put('/api/anime/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const fields = (req.body && req.body.fields) || {};
  const dryRun = !!req.query.dryRun;   // validate the slug→row + allowlist path; no Excel write, no sync
  if (!slug) return res.status(400).json({ error: 'Missing slug.' });
  if (!fields || typeof fields !== 'object' || !Object.keys(fields).length) {
    return res.status(400).json({ error: 'No fields to update.' });
  }
  try {
    if (dryRun) {
      // No lock-check / no backup / no sync — a dryRun touches nothing on disk.
      const result = await updateExcelRow(slug, fields, { dryRun: true });
      return res.json({ ok: true, dryRun: true, slug, rowIndex: result.rowIndex, changed: result.changed });
    }
    checkExcelLock(EXCEL_PATH);
    const backup = await backupExcel(EXCEL_PATH);
    const result = await updateExcelRow(slug, fields);
    const code = await runCmd('node', ['scripts/sync-excel-to-js.js'], {}, () => {});
    if (code !== 0) throw new Error(`sync failed (code ${code})`);
    res.json({ ok: true, slug, rowIndex: result.rowIndex, changed: result.changed, backup: path.basename(backup) });
  } catch (err) {
    console.error(`${C.red}[mode1]${C.reset} Edit failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// v1.8.1 (gate 4) — "fix platforms" one-click for the edit page. Fetches the row's
// AniList streaming links and runs the SAME mapping/allowlist/override rules as the
// backfill CLI (scripts/lib/platform-map.js). Read-only: returns current → proposed
// (+ flags) so the client can show a dry-run-style diff and let Blake apply it into
// the Where-to-watch field (he still Saves normally). No Excel/animeData writes.
app.post('/api/anime/:slug/platforms', async (req, res) => {
  const { aniListId, title, current } = req.body || {};
  const id = parseInt(aniListId, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'aniListId required.' });
  try {
    const detail = await franchiseFetch.fetchMediaDetail(id);
    if (!detail) return res.status(502).json({ error: 'AniList fetch failed — try again in a moment.' });
    const { proposed, filtered, flags, action } = proposePlatformsForRow(title || '', detail.externalLinks, current || '');
    res.json({ current: String(current || '').trim(), proposed, filtered, flags, action });
  } catch (err) {
    console.error(`${C.red}[mode1] /api/anime/:slug/platforms${C.reset} ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// v1.8.1 — Tier-2 "Ship": publish an already-saved edit live. SSE progress (same
// shape as /api/submit). Reuses Mode 1's existing steps: widget → bump (PATCH) →
// CHANGELOG → npm test (rule #7) → scoped commit + push → deploy. The client's
// branded confirm IS the production go-signal (same trust as /api/submit's deploy
// confirm). The row must already be Tier-1 saved (the client saves first).
app.post('/api/anime/:slug/ship', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (event, data) => { res.write(`event: ${event}\n`); res.write(`data: ${JSON.stringify(data)}\n\n`); };
  const title = (req.body && req.body.title) || String(req.params.slug || '');
  try {
    // 1. widget bullet (prepend; cap 5 — matches Mode 1's widget behaviour)
    send('step', { id: 'widget', label: 'Update homepage Update Log widget', status: 'running' });
    const existing = await readExistingBullets();
    await updateChangelogWidget([`Updated the ${title} review`, ...existing].slice(0, 5));
    send('step', { id: 'widget', label: 'Update Log widget', status: 'done' });

    // 2. bump (PATCH)
    const cur = await readCurrentVersion();
    const nv = nextPatchVersion(cur);
    send('step', { id: 'bump', label: `Bump version (v${cur} → v${nv})`, status: 'running' });
    let code = await runCmd('node', ['scripts/bump-version.js', nv], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`bump-version exited with code ${code}`);
    send('step', { id: 'bump', label: `Bump version (v${cur} → v${nv})`, status: 'done' });

    // 3. CHANGELOG
    send('step', { id: 'changelog', label: 'Update CHANGELOG.md', status: 'running' });
    await addEditChangelogEntry(nv, title);
    send('step', { id: 'changelog', label: 'Update CHANGELOG.md', status: 'done' });

    // 4. tests (rule #7 — before commit)
    send('step', { id: 'tests', label: 'Run Playwright tests', status: 'running' });
    code = await runCmd('npm', ['test'], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`npm test failed (code ${code}) — fix tests before shipping`);
    send('step', { id: 'tests', label: 'Run Playwright tests (passed)', status: 'done' });

    // 5. scoped commit + push (all bump-touched pages + the regenerated data)
    send('step', { id: 'git', label: 'Git commit + push', status: 'running' });
    const scoped = [
      'CHANGELOG.md', 'animeData.js', 'index.html', 'account.html', 'suggest.html',
      'admin/new-anime.html', 'admin/season-reviews.html', 'admin/suggestions.html', 'admin/edit.html',
    ];
    code = await runCmd('git', ['add', '--', ...scoped], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`git add failed (code ${code})`);
    code = await runCmd('git', ['commit', '-m', `Edit review: ${title}`], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`git commit failed (code ${code})`);
    code = await runCmd('git', ['push'], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`git push failed (code ${code}) — check auth/network`);
    send('step', { id: 'git', label: 'Git commit + push', status: 'done' });

    // 6. deploy (the confirm-click was the go-signal)
    send('step', { id: 'deploy', label: 'Deploy to Firebase', status: 'running' });
    code = await runCmd('firebase', ['deploy', '--only', 'hosting'], {}, (line) => send('log', { line }));
    if (code !== 0) throw new Error(`firebase deploy failed (code ${code})`);
    send('step', { id: 'deploy', label: 'Deploy to Firebase', status: 'done' });

    send('done', { newVersion: nv });
  } catch (err) {
    console.error(`${C.red}[mode1]${C.reset} Ship failed: ${err.message}`);
    send('error', { message: err.message });
  } finally { res.end(); }
});

app.get('/api/season-review/:id', async (req, res) => {
  const id = validSeasonId(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  try {
    const text = await fsp.readFile(seasonReviewPath(id), 'utf8');
    const { meta, body } = parseFrontmatter(text);
    res.json({ exists: true, id, title: meta.title || '', date: meta.date || '', rating: meta.rating || '', body: String(body || '').replace(/^\n+/, '') });
  } catch (_) {
    res.status(404).json({ exists: false, id });
  }
});

app.put('/api/season-review/:id', async (req, res) => {
  const id = validSeasonId(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  const { title, rating, body } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'body required' });
  const today = new Date().toISOString().slice(0, 10);
  const fm = ['---', `title: ${String(title || '').replace(/[\r\n]+/g, ' ').trim()}`, `aniListId: ${id}`, `date: ${today}`];
  if (rating != null && String(rating).trim()) fm.push(`rating: ${String(rating).replace(/[\r\n]+/g, ' ').trim()}`);
  fm.push('---', '', String(body).replace(/\r\n/g, '\n').trim(), '');
  try {
    await fsp.mkdir(SEASON_DIR, { recursive: true });
    await fsp.writeFile(seasonReviewPath(id), fm.join('\n'), 'utf8');
    const idx = buildSeasonReviewIndex();
    console.log(`${C.gray}[mode1] /api/season-review${C.reset} PUT ${id} · index now ${idx.count} review(s)`);
    res.json({ ok: true, id, count: idx.count });
  } catch (err) {
    console.error(`${C.red}[mode1] /api/season-review${C.reset} ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/season-review/:id', async (req, res) => {
  const id = validSeasonId(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  try { await fsp.unlink(seasonReviewPath(id)); } catch (_) { /* already gone */ }
  const idx = buildSeasonReviewIndex();
  console.log(`${C.gray}[mode1] /api/season-review${C.reset} DELETE ${id} · index now ${idx.count} review(s)`);
  res.json({ ok: true, id, count: idx.count });
});

// v1.8.4 (gate 8) — welcome-door quotes write path (local admin only; 127.0.0.1). Writes
// Current Version/quotes.json (a flat {quote,source}[] array) which the homepage door fetches
// at runtime. PUT replaces the WHOLE list (matches the list-editor admin UI); each item is
// allowlisted to {quote, source} and newline-stripped (single-line fields) — the same
// defensive shape as the season-review frontmatter whitelist. No commit/bump/deploy fires
// here; it's a quiet local write (Blake owns the ship when he commits quotes.json).
const { readQuotes, writeQuotes } = require('./lib/quotes-store');
function sanitizeQuote(q) {
  if (!q || typeof q !== 'object') return null;
  const quote = String(q.quote || '').replace(/[\r\n]+/g, ' ').trim();
  const source = String(q.source || '').replace(/[\r\n]+/g, ' ').trim();
  if (!quote) return null;
  return { quote, source };
}
app.get('/api/quotes', (req, res) => {
  try { res.json({ ok: true, quotes: readQuotes() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/quotes', (req, res) => {
  const incoming = req.body && req.body.quotes;
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'quotes[] required' });
  const clean = incoming.map(sanitizeQuote).filter(Boolean);
  try {
    writeQuotes(clean);
    console.log(`${C.gray}[mode1] /api/quotes${C.reset} PUT · ${clean.length} quote(s)`);
    res.json({ ok: true, count: clean.length, quotes: clean });
  } catch (err) {
    console.error(`${C.red}[mode1] /api/quotes${C.reset} ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Open Blake's default browser to the admin form. Windows: `cmd /c start "" <url>`
// (the empty "" fills start's window-title slot so the URL isn't eaten as a title).
// Guarded by MODE1_NO_OPEN so Playwright/automation runs don't spawn real tabs —
// AND by isTTY (adversarial HIGH: tests/mode1-server.spec.js spawns this server
// during every `npm test` with piped stdio; only a real console double-click or
// a hand-typed `npm run mode1` has a TTY, so only those may open a browser).
const ADMIN_URL = `http://localhost:${PORT}/admin/new-anime`;
function openBrowser(url) {
  if (process.env.MODE1_NO_OPEN || !process.stdout.isTTY) return;
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
    } else {
      spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
    }
  } catch (e) { /* auto-open is cosmetic — the URL is printed either way */ }
}

smokeCheckSpawn().then(() => {
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log(`${C.bold}${C.green}Mode 1 server ready${C.reset}`);
    console.log(`  ${C.gray}URL:${C.reset}  ${ADMIN_URL}`);
    console.log(`  ${C.gray}Stop:${C.reset} Ctrl+C (or close the Mode 1 window)`);
    console.log('');
    openBrowser(ADMIN_URL);
  });
  // Double-click #2 lands here: a Mode 1 server (or a zombie node) already owns
  // the port. From Blake's chair that's a SUCCESS — point his browser at the
  // running one and exit 0, instead of dying in a raw stack + npm ERR wall.
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.log('');
      console.log(`Mode 1 looks like it's already running — opening your browser to it.`);
      console.log(`  URL: ${ADMIN_URL}`);
      console.log(`  If the page does not load, close every Mode 1 window and`);
      console.log(`  double-click the Mode 1 icon again.`);
      console.log('');
      openBrowser(ADMIN_URL);
      process.exit(0);
    }
    console.error(`${C.red}Mode 1 could not start:${C.reset} ${err && err.message ? err.message : err}`);
    console.error('  Close this window and try again. If it keeps failing, ask for help');
    console.error('  and include the message above.');
    process.exit(1);
  });
});
