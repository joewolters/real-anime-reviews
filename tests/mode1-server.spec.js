const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * v1.8.1 (gate 4) — Mode 1 server integration test.
 *
 * Unlike the other specs (which hit the static site on the shared :8765 python
 * server), this one spawns the real `node scripts/mode1-server.js` on an ISOLATED
 * port (MODE1_PORT, default-overridden to 8899 here so it never clashes with a
 * Blake-run instance on :8888), then exercises two write paths in DRY-RUN mode so
 * NOTHING on disk changes:
 *   1. POST /api/submit?dryRun&skipDeploy&skipPush — asserts the SSE ship steps
 *      fire in order through `done` (no image download, no Excel append, no sync,
 *      no git, no deploy — every side-effect is behind `if (!dryRun)`).
 *   2. PUT  /api/anime/:slug?dryRun — validates the slug→row lookup + the editable
 *      allowlist path against a REAL catalog slug, with no Excel write and no sync.
 *
 * Heavier than the DOM specs (it boots a node server) → longer timeout, its own file.
 */

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.MODE1_TEST_PORT || '8899';
const BASE = `http://127.0.0.1:${PORT}`;

let server;

// MUST match scripts/mode1-server.js slugify() (apostrophes stripped, not dashed).
function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

// First real catalog Title from animeData.js (no module.exports → parse the text),
// so the PUT dryRun runs against a slug that actually resolves to a row.
function firstCatalogSlug() {
  const text = fs.readFileSync(path.join(ROOT, 'animeData.js'), 'utf8');
  const m = /Title:\s*"([^"]+)"/.exec(text);
  if (!m) throw new Error('Could not find a Title in animeData.js');
  return { title: m[1], slug: slugify(m[1]) };
}

async function waitForHealth(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) { const j = await r.json(); if (j && j.ok) return j; }
    } catch (_) { /* not up yet */ }
    await new Promise((res) => setTimeout(res, 300));
  }
  throw new Error(`mode1 server did not become healthy on ${BASE} within ${timeoutMs}ms`);
}

// Read a POST SSE body to completion, returning the parsed event list.
async function readSse(resp) {
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  const events = [];
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      let ev = 'message', data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      let payload = {}; try { payload = JSON.parse(data); } catch (_) {}
      events.push({ event: ev, data: payload });
    }
  }
  return events;
}

test.describe('Mode 1 server (dry-run integration)', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeAll(async () => {
    server = spawn(process.execPath, ['scripts/mode1-server.js'], {
      cwd: ROOT,
      // MODE1_NO_OPEN: the server auto-opens a browser on ready (v1.10.2R) —
      // a test run must never spawn real tabs (belt; the piped-stdio isTTY
      // guard in openBrowser is the suspenders).
      env: { ...process.env, MODE1_PORT: PORT, MODE1_NO_OPEN: '1' },
      stdio: 'ignore',
    });
    server.on('error', (e) => { throw e; });
    await waitForHealth();
  });

  test.afterAll(async () => {
    if (server && !server.killed) server.kill();
  });

  test('GET /api/health reports the mode1 server + version', async () => {
    const r = await fetch(`${BASE}/api/health`);
    expect(r.ok).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.server).toBe('mode1');
    expect(j.version).toBeTruthy();
  });

  test('POST /api/submit (dryRun) streams the ship steps in order through done', async () => {
    const resp = await fetch(`${BASE}/api/submit?dryRun=1&skipDeploy=1&skipPush=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'ZZZ Playwright DryRun Canary',
        imageSource: 'anilist',
        imageUrl: 'https://example.com/canary.png',
        aniListId: 1,
      }),
    });
    expect(resp.ok).toBeTruthy();
    const events = await readSse(resp);

    // No error event.
    expect(events.find((e) => e.event === 'error'), JSON.stringify(events)).toBeUndefined();

    // The pipeline's steps, in first-seen order.
    const stepOrder = [];
    for (const e of events) {
      if (e.event === 'step' && e.data && e.data.id && !stepOrder.includes(e.data.id)) {
        stepOrder.push(e.data.id);
      }
    }
    expect(stepOrder).toEqual([
      'preflight', 'image', 'excel', 'sync', 'widget', 'bump', 'changelog', 'tests', 'git', 'deploy',
    ]);

    // Terminal done event; skipDeploy → awaitingDeploy.
    const done = events.find((e) => e.event === 'done');
    expect(done, 'expected a done event').toBeTruthy();
    expect(done.data.awaitingDeploy).toBe(true);
    expect(done.data.newVersion).toBeTruthy();
  });

  test('PUT /api/anime/:slug (dryRun) validates a real catalog slug + allowlist, no write', async () => {
    const { slug } = firstCatalogSlug();
    const resp = await fetch(`${BASE}/api/anime/${encodeURIComponent(slug)}?dryRun=1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Rating: '9/10', NotAllowed: 'nope' } }),
    });
    expect(resp.ok).toBeTruthy();
    const j = await resp.json();
    expect(j.ok).toBe(true);
    expect(j.dryRun).toBe(true);
    expect(j.rowIndex).toBeGreaterThan(0);
    // Allowlisted header is reported changed; the non-allowlisted one is dropped.
    expect(j.changed).toContain('Rating');
    expect(j.changed).not.toContain('NotAllowed');
  });

  test('PUT /api/anime/:slug (dryRun) rejects a slug that matches no row', async () => {
    const resp = await fetch(`${BASE}/api/anime/__definitely_not_a_real_slug__?dryRun=1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Rating: '9/10' } }),
    });
    expect(resp.status).toBe(500);
    const j = await resp.json();
    expect(j.error).toMatch(/No catalog row/i);
  });
});
