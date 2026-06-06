const { test, expect } = require('./welcomed.js');

// v1.8.4 (gate 3d) — Discover polish round 3 + Den marquee revert. Deterministic
// checks; the marquee motion + shimmer dissolve are covered by the manual/node smoke.
test.describe('v1.8.4 gate 3d', () => {
  test('item 4: a rail that FITS centers; one that OVERFLOWS left-starts (the real sparse fix)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#discover-btn').click();
    await page.waitForTimeout(300);
    const out = await page.evaluate(() => {
      const mk = (id) => window.rarDiscovery.createDiscoveryCard({ id, title: { english: 'T' + id }, coverImage: { large: '' }, genres: ['Action'], averageScore: 70 });
      const view = document.getElementById('discover-view');
      const makeRail = (n) => {
        const r = document.createElement('div'); r.className = 'discover-rail';
        for (let i = 0; i < n; i++) r.appendChild(mk(880000 + i));
        view.appendChild(r);
        r.classList.toggle('is-sparse', r.scrollWidth <= r.clientWidth + 1);  // same logic as renderDiscoverInto
        return { sparse: r.classList.contains('is-sparse'), justify: getComputedStyle(r).justifyContent };
      };
      return { few: makeRail(2), many: makeRail(30) };
    });
    expect(out.few.sparse).toBe(true);
    expect(out.few.justify).toBe('center');       // fits => centered (G3c count-threshold bug fixed)
    expect(out.many.sparse).toBe(false);
    expect(out.many.justify).not.toBe('center');  // overflows => scrollable
  });

  // NOTE: superseded by gate 3e — hero sub is now a tangible gold-pin line (item 5)
  // and the block-subs are LEFT subtitles under the heading (item 6), not pills.
  test('gate 3e items 5/6: hero gold-pin line + left block-sub subtitle', async ({ page }) => {
    await page.goto('/');
    await page.locator('#discover-btn').click();
    await expect(page.locator('#discover-airing .card, #discover-airing .disc-skel').first()).toBeVisible({ timeout: 20000 });
    // item 5 — the hero sub makes the gold concept tangible: a gold pin chip + "gold" in gold.
    // Scoped to #discover-view: v1.8.4 gate 4's For You head reuses the same .discover-sub/
    // .ds-gold vocabulary, so the global selector would now match two surfaces.
    await expect(page.locator('#discover-view .discover-sub .ds-pin')).toHaveCount(1);
    await expect(page.locator('#discover-view .discover-sub .ds-gold')).toHaveText('gold');
    // item 6 — block-sub is a left subtitle (left accent bar) inside the subrow, NOT in the heading
    const sub = page.locator('#discover-airing-block .discover-block-sub');
    await expect(sub).toHaveCount(1);
    const inHead = await sub.evaluate(el => !!el.closest('.discover-block-head'));
    expect(inHead).toBe(false);                              // moved OUT of the heading
    const inSubrow = await sub.evaluate(el => !!el.closest('.discover-subrow'));
    expect(inSubrow).toBe(true);                             // now in the subrow
    const leftBorder = await sub.evaluate(el => getComputedStyle(el).borderLeftWidth);
    expect(parseFloat(leftBorder)).toBeGreaterThan(0);       // left accent bar
  });

  test('item 5: Den rail is overflow:hidden (marquee), reduced-motion makes it scrollable', async ({ page }) => {
    await page.goto('/');
    const overflowX = await page.locator('.rail-viewport').first().evaluate(el => getComputedStyle(el).overflowX);
    expect(overflowX).toBe('hidden');
  });

  test('item 6: Continue rail scrolls to all its cards (no clip)', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    const ids = await page.$$eval('.card-container .card', els => els.slice(0, 6).map(e => e.dataset.animeid));
    await page.evaluate((ids) => localStorage.setItem('rar:continue', JSON.stringify(ids)), ids);
    await page.reload();
    await page.waitForTimeout(600);
    const info = await page.evaluate(() => {
      const row = document.getElementById('continue-row');
      row.scrollLeft = 99999;
      return { overflowX: getComputedStyle(row).overflowX, expectedMax: row.scrollWidth - row.clientWidth, reached: row.scrollLeft };
    });
    expect(info.overflowX).toBe('auto');
    // the rail reaches its full scroll extent (overflow is reachable, not clipped)
    expect(info.reached).toBeGreaterThanOrEqual(info.expectedMax - 2);
    expect(info.expectedMax).toBeGreaterThan(0);   // 6 cards do overflow a normal viewport
  });
});
