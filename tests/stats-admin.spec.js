// PART A item 6 — the Member Stats admin page.
// <!-- author: Code | date: 2026-08-10 -->
// Pins the scaffold + the two registrations that the stale-TARGETS trap has
// bitten three times, and then drives the REAL render with a known payload and
// measures REAL PIXELS at phone width (Blake checks numbers from his phone).
const { test, expect } = require('@playwright/test');
const STATS_CORE = require('../functions/lib/stats.js');

const PAYLOAD = {
  windowDays: 30,
  monthLabel: 'August 2026',
  members: { total: 12, banned: 1, joinedThisMonth: 3, joinedRecent: 4, active: 7 },
  content: { comments: 41, reviews: 9, commentReplies: 12, reviewReplies: 5, forumThreads: 6, forumPosts: 22, total: 95 },
  recent: { comments: 8, reviews: 2, commentReplies: 3, reviewReplies: 0, forumThreads: 1, forumPosts: 4, total: 18 },
  tombstones: 2,
  appreciates: 31,
  dms: { conversations: 5, messages: 140 },
  source: 'manual',
  // the wire shape a Firestore Timestamp serialises to across page.evaluate
  generatedAt: { seconds: Math.floor(Date.now() / 1000) - 3600 },
};

// Reveal the admin shell without auth (the gate is a client-side hide, not a
// route). Waits for onAuthStateChanged to SETTLE first — an immediate unhide
// races it and the gate re-hides the shell (the catalog spec's lesson).
async function revealShell(page) {
  await page.waitForFunction(
    () => /Admin only/.test(document.getElementById('admin-gate').textContent || ''),
    null, { timeout: 15000 },
  ).catch(() => {});
  await page.evaluate(() => {
    document.getElementById('admin-gate').hidden = true;
    document.getElementById('admin-main').hidden = false;
  });
}

test('the stats page ships the admin scaffold, gate and registrations', async ({ page }) => {
  const html = await (await page.request.get('/admin/stats.html')).text();
  expect(html).toContain('id="admin-gate"');
  expect(html).toContain('id="admin-main"');
  expect(html).toContain('hidden');                        // main is shielded until admin
  expect(html).toContain('id="stats-refresh"');
  expect(html).toContain('id="stats-content-rows"');
  expect(html).toContain('noindex, nofollow');

  const js = await (await page.request.get('/admin/stats.js')).text();
  expect(js).toContain("uid === ADMIN_UID");               // client gate
  expect(js).toContain('refreshStatsNow');                 // the admin-only callable
  expect(js).toContain('friendlyError');                   // no raw error strings
  expect(js).not.toMatch(/\balert\(|\bconfirm\(/);         // zero native dialogs

  const fab = await (await page.request.get('/admin-fab.js')).text();
  expect(fab).toContain('/admin/stats.html');              // reachable from the FAB
  const bump = await (await page.request.get('/scripts/bump-version.js')).text();
  expect(bump).toMatch(/stats\.js\?v=/);                   // the stale-TARGETS trap, closed
});

test('every display:flex/grid/table block ships its [hidden] twin', async ({ page }) => {
  // The author-display-beats-[hidden] trap has three scalps on this project.
  const css = await (await page.request.get('/admin/stats.css')).text();
  for (const sel of ['.stats-actions', '.stats-body', '.stats-section', '.stats-tiles',
    '.stats-tile', '.stats-table', '.stats-freshness', '.stats-refresh-note',
    '.stats-aside', '.stats-empty']) {
    expect(css, `${sel} needs a [hidden] twin`).toContain(`${sel}[hidden] { display: none; }`);
  }
});

test('the page reads exactly one document and never a member\'s words', async ({ page }) => {
  const js = await (await page.request.get('/admin/stats.js')).text();
  // ONE getDoc against ONE path is the whole cost model: 1 read per open.
  expect(js).toContain("getDoc(doc(db, 'adminStats', 'current'))");
  expect(js).not.toMatch(/getDocs|collectionGroup|onSnapshot/);

  // ...and the recompute itself must never name a content field. Read from disk
  // (require), NOT over HTTP: functions/ is not served, so a fetch would 404
  // into an HTML body and the assertion would pass without checking anything.
  const core = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'functions', 'lib', 'stats.js'), 'utf8');
  expect(core).not.toMatch(/select\([^)]*['"](text|body|title|message|displayName)['"]/);
  // the DM lane must select NO fields at all
  expect(core).toContain("projectDocs(db.collectionGroup('messages'), [])");
});

test('the client table has a label for every surface the recompute counts', async ({ page }) => {
  // A surface added to lib/stats.js SURFACES with no CONTENT_ROWS label would
  // silently never appear on the page.
  const js = await (await page.request.get('/admin/stats.js')).text();
  for (const s of STATS_CORE.SURFACES) {
    expect(js, `${s.key} needs a row label`).toMatch(new RegExp(`\\['${s.key}',`));
  }
});

test('the honest definition of "active" is printed next to the number', async ({ page }) => {
  // A metric that needs a definition carries it — the design decision, pinned.
  const html = await (await page.request.get('/admin/stats.html')).text();
  const tile = html.slice(html.indexOf('s-members-active'), html.indexOf('</section>'));
  expect(tile).toMatch(/last 30 days/i);
  expect(tile).toMatch(/votes and letters don't count/i);
  // and the letters vow is on the page, not just in a code comment
  expect(html).toMatch(/never read/i);
});

test('REAL PIXELS: the numbers render and fit a 360px phone with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/admin/stats.html');
  await revealShell(page);

  // Drive the REAL renderer with a known payload — this is the painted page,
  // not a computed-style guess.
  await page.waitForFunction(() => !!window.rarStatsView, null, { timeout: 15000 });
  await page.evaluate((p) => window.rarStatsView.render(p), PAYLOAD);

  await expect(page.locator('#stats-body')).toBeVisible();
  await expect(page.locator('#s-members-total')).toHaveText('12');
  await expect(page.locator('#s-members-active')).toHaveText('7');
  await expect(page.locator('#s-content-total')).toHaveText('95');
  await expect(page.locator('#s-dm-messages')).toHaveText('140');
  await expect(page.locator('#s-appreciates')).toHaveText('31');
  await expect(page.locator('#s-month-label')).toHaveText('August 2026');

  // all six content surfaces render a row
  await expect(page.locator('#stats-content-rows tr')).toHaveCount(6);

  // the tombstone + banned asides only appear when they are non-zero
  await expect(page.locator('#s-tombstone-line')).toBeVisible();
  await expect(page.locator('#s-banned-line')).toBeVisible();

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll at 360px').toBeLessThanOrEqual(0);

  // Refresh is a real thumb target, fully inside the viewport
  const box = await page.locator('#stats-refresh').boundingBox();
  expect(box.height, 'the item-4 tap-target floor').toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
});

test('REAL PIXELS: a zero-everywhere site paints zeros, and hides the asides', async ({ page }) => {
  await page.goto('/admin/stats.html');
  await revealShell(page);
  await page.waitForFunction(() => !!window.rarStatsView, null, { timeout: 15000 });
  await page.evaluate(() => window.rarStatsView.render({
    monthLabel: 'August 2026',
    members: { total: 0, banned: 0, joinedThisMonth: 0, joinedRecent: 0, active: 0 },
    content: { comments: 0, reviews: 0, commentReplies: 0, reviewReplies: 0, forumThreads: 0, forumPosts: 0, total: 0 },
    recent: { comments: 0, reviews: 0, commentReplies: 0, reviewReplies: 0, forumThreads: 0, forumPosts: 0, total: 0 },
    tombstones: 0, appreciates: 0, dms: { conversations: 0, messages: 0 },
  }));
  await expect(page.locator('#s-members-total')).toHaveText('0');
  await expect(page.locator('#s-content-total')).toHaveText('0');
  // zero tombstones and zero bans say nothing rather than "0 tombstones"
  await expect(page.locator('#s-tombstone-line')).toBeHidden();
  await expect(page.locator('#s-banned-line')).toBeHidden();
});

test('a missing number shows an em dash, never "undefined" and never a fake 0', async ({ page }) => {
  await page.goto('/admin/stats.html');
  await revealShell(page);
  await page.waitForFunction(() => !!window.rarStatsView, null, { timeout: 15000 });
  await page.evaluate(() => window.rarStatsView.render({}));
  await expect(page.locator('#s-members-total')).toHaveText('—');
  await expect(page.locator('#s-dm-messages')).toHaveText('—');
  const body = await page.locator('#stats-body').textContent();
  expect(body).not.toMatch(/undefined|NaN/);
});
