const { test, expect } = require('./welcomed');

// Gate 4 — comments overhaul. These specs run against the STATIC site (no
// Firebase backend), so they cover the pure/no-write surface: the communityKey
// helper, the renderMarkdownInline XSS/markdown contract, and the comment markup
// (Top sort). The write-path behaviour (replies, voting, report, admin pin/lock)
// is covered by the emulator rules + CF tests and by practice-mode smoke.

test.describe('v1.9.0 gate 4 — comments overhaul (static surface)', () => {
  test('communityKey maps catalog -> slug and AniList-only -> al:<id>', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.communityKey === 'function');
    const out = await page.evaluate(() => ({
      catalog: window.communityKey({ Title: 'Demon Slayer' }),
      seasonOnly: window.communityKey({ aniListId: 101922 }),
      catalogWithId: window.communityKey({ Title: 'Frieren', aniListId: 154587 }),
    }));
    expect(out.catalog).toBe('demon-slayer');
    expect(out.seasonOnly).toBe('al:101922');
    expect(out.catalogWithId).toBe('frieren'); // a catalog ctx prefers the slug
  });

  test('renderMarkdownInline allows bold/links but NOT headers, and is XSS-safe', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.renderMarkdownInline === 'function');
    const r = await page.evaluate(() => ({
      bold: window.renderMarkdownInline('a **b** c'),
      header: window.renderMarkdownInline('# big'),
      xss: window.renderMarkdownInline('<script>alert(1)</script>'),
      link: window.renderMarkdownInline('[x](https://example.com)'),
    }));
    expect(r.bold).toContain('<strong>b</strong>');
    expect(r.header).not.toContain('<h4');     // headers are disabled for comments
    expect(r.header).toContain('# big');        // the literal text survives, un-rendered
    expect(r.xss).not.toContain('<script>');    // escaped
    expect(r.link).toContain('rel="noopener noreferrer"');
  });

  test('the comment section renders a composer and a Top sort option', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    await page.locator('.card-container .card').first().click();
    await expect(page.locator('#anime-modal')).toBeVisible();
    // PART A item 8b — the native <select> became a branded RarBrandSelect
    // (the OS popup could not be themed). Same control, same default; it is a
    // button + listbox now, so the assertion moved off <option> elements.
    const sort = page.locator('[id^="comments-sort-"]').first();
    await expect(sort).toBeVisible();
    await expect(sort.locator('.acct-dd-btn')).toContainText('Top');
    await expect(page.locator('select')).toHaveCount(0);   // zero native selects
    // mega-batch Part B: the textarea became the HIDDEN model under the
    // live-in-box editor — the visible composer is the .rar-live editor.
    await expect(page.locator('textarea[id^="composer-input-"]').first()).toBeAttached();
    await expect(page.locator('.sheet--left .composer-body .rar-live').first()).toBeVisible();
  });
});
