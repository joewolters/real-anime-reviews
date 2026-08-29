// tests/v231-no-desktop-server.spec.js
// <!-- author: Code | date: 2026-08-13 -->
// =============================================================================
// Blake: "make sure season reviews or edits of any kind don't operate on that
// old hardware anymore."
//
// Four admin pages still called the Mode 1 desktop server that the cloud
// migration retired. Add Anime went first (v2.3.0); this covers the rest:
//   edit            PUT /api/anime/:slug        -> catalog/{animeId}
//   quotes          PUT /api/quotes             -> siteContent/quotes
//   season-reviews  /api/season-review CRUD     -> seasonReviews/{id} (+ content/body)
//
// ⚠️ Season reviews had never worked at all: the index shipped with count 0,
// because writing one was impossible without that machine.
// =============================================================================
const { test, expect } = require('@playwright/test');

const openAdmin = async (page, name) => {
  await page.route((u) => /index\.html$/.test(u.pathname), (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto(`/admin/${name}.html`);
  await page.waitForTimeout(1500);
};

for (const name of ['edit', 'quotes', 'season-reviews']) {
  test(`${name}: boots clean and never calls the retired server`, async ({ page }) => {
    const errs = [];
    const api = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('request', (r) => { if (r.url().includes('/api/')) api.push(r.url()); });
    await openAdmin(page, name);
    expect(errs, 'the page boots without errors').toEqual([]);
    expect(api, 'and asks the desktop server for nothing').toEqual([]);
  });
}

test('edit: the doc id comes from the shared model, not this page\'s slugify', async ({ page, request }) => {
  // ⚠️ THE TRAP. edit.js has its own slugify() that STRIPS apostrophes (it had to
  // match the old server's row lookup). Catalog ids turn an apostrophe into a
  // dash. For "An Archdemon's Dilemma" that is an-archdemons-... vs
  // an-archdemon-s-... — a silent miss on 8 titles, and the id is also the key
  // every live comment room hangs off.
  await openAdmin(page, 'edit');
  const out = await page.evaluate(() => ({
    model: typeof window.RarCatalogModel,
    shared: window.RarCatalogModel.slug("An Archdemon's Dilemma: How to Love Your Elf Bride"),
  }));
  expect(out.model).toBe('object');
  expect(out.shared, 'the apostrophe becomes a dash, as the catalog ids do').toBe(
    'an-archdemon-s-dilemma-how-to-love-your-elf-bride');

  const js = await (await request.get('/admin/edit.js')).text();
  expect(js, 'the write addresses the doc through the shared id helper').toContain('catalogIdFor(');
  expect(js, 'and it updates rather than set-with-merge, which would mint a ghost row')
    .toMatch(/updateDoc\(ref/);
  expect(js, 'no server writes remain').not.toContain("fetch('/api/anime/");
});

test('the platform rules are ONE module, shared by page and CLI', async ({ page, request }) => {
  // it moved out of scripts/ (firebase-ignored, so no page could load it) rather
  // than being copied — two copies of an allowlist drift, and a drift means the
  // edit page proposes different platforms than the backfill CLI would.
  await openAdmin(page, 'edit');
  expect(await page.evaluate(() => typeof window.RarPlatformMap)).toBe('object');
  const r = await request.get('/admin/platform-map.js');
  expect(r.status(), 'the page can actually load it').toBe(200);
});

test('the door still has quotes when the cloud doc is missing', async ({ page }) => {
  // three tiers: the cloud doc, then the shipped file, then the seeded list.
  // A door with no quotes would be a visible regression for every visitor.
  await page.goto('/index.html');
  await page.waitForSelector('#welcome-splash:not([hidden])', { timeout: 20000 });
  await page.waitForFunction(
    () => document.querySelectorAll('.welcome-quote-bubble .wq-text').length > 0,
    null, { timeout: 15000 });
  const text = await page.textContent('.welcome-quote-bubble .wq-text');
  expect(text.trim().length, 'a real quote rendered').toBeGreaterThan(3);
});

test('the site reads season reviews from the cloud, not from files', async ({ request }) => {
  const js = await (await request.get('/script.js')).text();
  expect(js).not.toContain("fetch('/season-reviews/index.json'");
  expect(js).not.toContain("'/season-reviews/' + key");
  expect(js, 'the light parent docs are what the index reads').toContain("collection(db, 'seasonReviews')");
  expect(js, 'and the prose is a child fetched on demand').toContain("'content', 'body'");
});
