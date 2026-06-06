const { test, expect } = require('./welcomed.js');

// v1.8.4 (gate 3c) — Discover polish round 2. Deterministic/offline checks for the
// pure logic + wiring; the motion/readability polish (carousel drift, pills, hover
// masks) is covered by the manual + node smoke.
test.describe('v1.8.4 gate 3c — Discover polish', () => {
  test('item 8: null/0 AniList score renders an explicit "N/A" chip (score-none)', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const mk = (score) => {
        const c = window.rarDiscovery.createDiscoveryCard({
          id: 970000 + (score || 0), title: { english: 'Z' + score },
          coverImage: { large: '' }, genres: ['Action'], averageScore: score,
        });
        return { rating: c.querySelector('.card-rating').textContent, cls: [...c.classList].find(x => x.startsWith('score-')) };
      };
      return { nul: mk(null), zero: mk(0), real: mk(80) };
    });
    expect(out.nul.rating).toBe('N/A');
    expect(out.nul.cls).toBe('score-none');
    expect(out.zero.rating).toBe('N/A');
    expect(out.zero.cls).toBe('score-none');
    expect(out.real.rating).toBe('80%');     // real score unchanged
    expect(out.real.cls).toBe('score-high');
  });

  test('item 1: toolbar buttons carry the bilingual JP accent', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#view-all-btn .jp-mini')).toHaveText('全作品');
    await expect(page.locator('#filter-btn .jp-mini')).toHaveText('絞り込み');
    await expect(page.locator('#random-btn .jp-mini')).toHaveText('ランダム');
    await expect(page.locator('#discover-btn .jp-mini')).toHaveText('発見');
  });

  // NOTE: G3d (item 5) REVERTED the Den rails to the infinite transform marquee
  // (Blake course-correct). Den = marquee (overflow:hidden, duplicated set),
  // Discover rails = native-scroll. The two motion languages coexist by design.
  test('item 5: Den "Anime By Genre" rails are the transform marquee (overflow hidden, duplicated set)', async ({ page }) => {
    await page.goto('/');
    const rail = page.locator('.rail-viewport').first();
    await expect(rail).toBeVisible({ timeout: 8000 });
    const overflowX = await rail.evaluate(el => getComputedStyle(el).overflowX);
    expect(overflowX).toBe('hidden');         // marquee (reverted from G3c native-scroll)
    const cards = await rail.evaluate(el => el.querySelectorAll('.card').length);
    expect(cards).toBeGreaterThan(1);         // duplicated set for the seamless loop
    // even number of cards (each item rendered twice under the motion path)
    expect(cards % 2).toBe(0);
  });
});
