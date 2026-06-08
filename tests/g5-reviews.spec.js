const { test, expect } = require('./welcomed');

// Gate 5 — community reviews overhaul. Static surface (no Firebase backend): the
// protect-the-heart DOM hierarchy + the pure histogram math. The vote-model
// migration + the count/notification behavior is covered by the emulator rules
// + CF tests and by practice-mode smoke.
test.describe('v1.9.0 gate 5 — community reviews (static surface)', () => {
  test('PROTECT THE HEART: community tab has NO gold rating block; histogram keeps Blake\'s tick', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    await page.locator('.card-container .card').first().click();
    await expect(page.locator('#anime-modal')).toBeVisible();
    await page.waitForSelector('.comm-stats');
    const r = await page.evaluate(() => {
      const stats = document.querySelector('.comm-stats');
      const goldBlock = stats && stats.querySelector('.comm-blake-rating'); // gate 6: moved to the center modal
      const hist = stats && stats.querySelector('.comm-histogram');
      return { hasGoldBlock: !!goldBlock, hasHist: !!hist, tickData: hist ? hist.getAttribute('data-blake') : null };
    });
    expect(r.hasGoldBlock).toBe(false);  // his gold rating is NOT in the community tab (it's in the center modal)
    expect(r.hasHist).toBe(true);
    expect(r.tickData).toBeTruthy();     // the histogram still knows his score for its single gold tick
  });

  test('histogram math: bars are % of the tallest bucket; gold tick maps onto the axis', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.histogramModel === 'function');
    // dist index 1..10: rating 3 ×1, rating 8 ×2, rating 10 ×4  (tallest bucket = 4)
    const m = await page.evaluate(() => window.histogramModel([0, 0, 0, 1, 0, 0, 0, 0, 2, 0, 4], 9.0));
    expect(m.bars[10]).toBe(100); // 4/4
    expect(m.bars[8]).toBe(50);   // 2/4
    expect(m.bars[3]).toBe(25);   // 1/4
    expect(m.bars[1]).toBe(0);
    expect(Math.round(m.tickLeft)).toBe(85); // (9 − 0.5)/10 × 100
  });

  test('review body markdown is XSS-safe (it now renders UNTRUSTED community content)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.renderMarkdown === 'function');
    const r = await page.evaluate(() => ({
      script: window.renderMarkdown('<script>alert(1)</script>'),
      img: window.renderMarkdown('<img src=x onerror=alert(1)>'),
      jsLink: window.renderMarkdown('[click](javascript:alert(1))'),
      okLink: window.renderMarkdown('[ok](https://example.com)'),
      header: window.renderMarkdown('## A heading'),
    }));
    expect(r.script).not.toContain('<script>');     // escaped
    expect(r.img).not.toContain('<img');            // escaped
    expect(r.jsLink).not.toContain('<a ');          // a javascript: URL never becomes a link
    expect(r.okLink).toContain('rel="noopener noreferrer"');
    expect(r.header).toContain('<h');               // headers ARE allowed in reviews (unlike comments)
  });
});
