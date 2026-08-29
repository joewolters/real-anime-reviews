// tests/v230-add-anime-cloud.spec.js
// <!-- author: Code | date: 2026-08-13 -->
// =============================================================================
// Blake, holding a finished review he could not post: "the website posting anime
// admin section thinks we need mode 1 to publish the excel role to update to the
// anime. We have moved onto the cloud."
//
// He was right, and it was worse than a stale banner: this page could only ship
// through the Mode 1 desktop server or an Excel row, and the migration retired
// BOTH (`npm run sync` refuses to write from the spreadsheet). Adding a new
// anime had been impossible since — he was simply the first to try.
// =============================================================================
const { test, expect } = require('@playwright/test');

// the admin gate replaces the document when not signed in; a 204 keeps it alive
// so the page can be measured (abort() kills it and leaves nothing to read).
const openAdd = async (page) => {
  await page.route((u) => /index\.html$/.test(u.pathname), (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/admin/new-anime.html');
  await page.waitForFunction(() => !!document.getElementById('generate-btn'), null, { timeout: 20000 });
};

test('add anime: the only ship path is the cloud', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await openAdd(page);

  const out = await page.evaluate(() => ({
    btn: document.getElementById('generate-btn').textContent.trim(),
    dead: ['excel-row-output', 'commands-output', 'progress-section', 'confirm-deploy-btn']
      .filter((id) => !!document.getElementById(id)),
    result: !!document.getElementById('publish-result'),
  }));

  expect(out.btn, 'the button publishes, it does not generate a spreadsheet row').toBe('Publish to catalog');
  expect(out.dead, 'every Mode 1 / Excel surface is gone').toEqual([]);
  expect(out.result, 'and there is somewhere to report the result').toBe(true);
  expect(errs, 'the page boots clean').toEqual([]);
});

test('add anime: the page carries no Mode 1 machinery at all', async ({ request }) => {
  const js = await (await request.get('/admin/new-anime.js')).text();
  // ⚠️ these are the names of the retired pipeline. Their RETURN is the
  // regression this guards: a page that quietly reaches for a desktop server
  // again is a page Blake cannot publish from.
  for (const dead of ['detectServerMode(', 'submitAndShip(', 'streamSse(', 'buildExcelRow(', 'state.serverMode']) {
    expect(js, `${dead} must stay gone`).not.toContain(dead);
  }
  expect(js, 'and it writes to the catalog instead').toContain('publishToCatalog');
  expect(js, "to the doc id the comment rooms hang off").toContain("doc(db, 'catalog'");
});

test('add anime: the slug comes from the SHARED model, never a local copy', async ({ page }) => {
  // ⚠️ The slug is the document id AND the key every live comment room hangs
  // off. A second implementation that drifts would orphan discussion, so the
  // page must use the same one the Cloud editor and the sync use.
  await openAdd(page);
  const out = await page.evaluate(() => ({
    loaded: typeof window.RarCatalogModel === 'object',
    slug: window.RarCatalogModel.slug('I Made Friends with the Second Prettiest Girl in My Class'),
    apostrophe: window.RarCatalogModel.slug("An Archdemon's Dilemma"),
  }));
  expect(out.loaded, 'the shared model is loaded on this page').toBe(true);
  expect(out.slug).toBe('i-made-friends-with-the-second-prettiest-girl-in-my-class');
  // the apostrophe case is the one the handoff calls out by name
  expect(out.apostrophe, 'apostrophes keep the live-room slug shape').toContain('archdemon');
});
