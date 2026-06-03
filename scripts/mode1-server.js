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

const PORT = 8888;
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
    watchOfficial, watchUnofficial, studio, trailer, top10Rank,
    aniListId, idMal, aniListScore, aniListColor,
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
  const watchCombined = [watchOfficial, watchUnofficial].filter(Boolean).join(', ');
  const rowData = [
    title, rating, seasons, genre, description, review, tags, watchCombined, studio, trailer,
    null, null,
    top10Rank ? parseInt(top10Rank, 10) : null,
    aniListId ? parseInt(aniListId, 10) : null,
    idMal ? parseInt(idMal, 10) : null,
    aniListScore ? parseInt(aniListScore, 10) : null,
    aniListColor || null,
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

smokeCheckSpawn().then(() => {
  app.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log(`${C.bold}${C.green}Mode 1 server ready${C.reset}`);
    console.log(`  ${C.gray}URL:${C.reset}  http://localhost:${PORT}/admin/new-anime`);
    console.log(`  ${C.gray}Stop:${C.reset} Ctrl+C`);
    console.log('');
  });
});
