const { test, expect } = require('@playwright/test');

// v1.9.1 — the airing dateline pill ("AIRING NOW" on Den + Discover) is now derived
// from TODAY's date (self-rolls by month), NOT read off whatever anime sits first in
// the airing list (that bug showed a stale "FALL 1999"). currentSeasonInfo uses the
// anime broadcast-season convention — what AniList's airing `season` enum uses:
// Jan–Mar WINTER, Apr–Jun SPRING, Jul–Sep SUMMER, Oct–Dec FALL (so June = Spring).
// Dates are built with explicit local components (new Date(y, mIndex, d)) so the
// month never shifts under a timezone.
test.describe('season label — self-rolling current season', () => {
  test('currentSeasonInfo maps each month to the right broadcast season', async ({ page }) => {
    await page.goto('/');
    const hasFn = await page.evaluate(() => typeof window.currentSeasonInfo === 'function');
    expect(hasFn).toBe(true);

    // [monthIndex, expectedSeason, expectedJp]
    const cases = [
      [0, 'WINTER', '冬'], [1, 'WINTER', '冬'], [2, 'WINTER', '冬'],
      [3, 'SPRING', '春'], [4, 'SPRING', '春'], [5, 'SPRING', '春'],
      [6, 'SUMMER', '夏'], [7, 'SUMMER', '夏'], [8, 'SUMMER', '夏'],
      [9, 'FALL', '秋'], [10, 'FALL', '秋'], [11, 'FALL', '秋'],
    ];
    for (const [m, season, jp] of cases) {
      const info = await page.evaluate((mm) => window.currentSeasonInfo(new Date(2026, mm, 15)), m);
      expect(info.season, `month ${m}`).toBe(season);
      expect(info.jp, `month ${m}`).toBe(jp);
      expect(info.year).toBe(2026);
    }
  });

  test('the reported "FALL 1999" date (8 June 2026) now reads Spring 2026 · 春', async ({ page }) => {
    await page.goto('/');
    const label = await page.evaluate(() => window.currentSeasonInfo(new Date(2026, 5, 8)).label);
    expect(label).toBe('Spring 2026 · 春');
  });

  test('the season + year roll forward with the date (Fall 2027)', async ({ page }) => {
    await page.goto('/');
    const label = await page.evaluate(() => window.currentSeasonInfo(new Date(2027, 10, 1)).label);
    expect(label).toBe('Fall 2027 · 秋');
  });
});
