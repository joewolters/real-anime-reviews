// Returning-visitor fixture (the surface clicks need the welcome door dismissed; the
// Update-Log relocation runs in initWelcome regardless, so it's testable here too).
const { test, expect } = require('./welcomed.js');

// v1.8.4 (gate 6) — the Constellation veil (per-surface density via data-surface +
// @property wash alphas), the Update Log re-homed to the door, Top 10 + Latest Drop
// side-by-side, the For-You hero sub treatment. The veil texture itself is a Profiler/
// eyeball matter (Blake's Firefox); here we lock the wiring, the per-surface density
// stepping, the DOM re-home, and the layout structure — all deterministic.
test.describe('v1.8.4 gate 6 — Constellation veil + layout calls', () => {
  test('the veil layer exists over the city, behind content, with the pulse above it', async ({ page }) => {
    await page.goto('/');
    const z = await page.evaluate(() => {
      const cs = getComputedStyle(document.body, '::after');
      const before = getComputedStyle(document.body, '::before');
      const pulse = document.getElementById('veil-pulse');
      return {
        afterZ: cs.zIndex, afterBg: cs.backgroundImage, beforeZ: before.zIndex,
        pulseZ: pulse ? getComputedStyle(pulse).zIndex : null,
      };
    });
    // v1.8.4 gate 8 — the z-ladder grew a rung: city -3 < pulse -1 sits ABOVE the veil -2,
    // all behind content (z 0+), so the masked pulse glow reads on every surface.
    expect(z.afterZ).toBe('-2');                      // veil between city and pulse
    expect(z.beforeZ).toBe('-3');                     // city pushed one deeper
    expect(z.pulseZ).toBe('-1');                      // pulse rides above the veil
    expect(z.afterBg).toContain('gradient');          // the star pinpricks + dark wash
    await expect(page.locator('#veil-pulse .vp-glow')).toHaveCount(1);
  });

  test('data-surface flips per surface; the veil density steps Den -> For You -> Discover', async ({ page }) => {
    await page.goto('/');
    const w0 = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--veil-w0').trim());
    const surface = () => page.evaluate(() => document.documentElement.dataset.surface);

    expect(await surface()).toBe('den');             // home is the default/coziest
    const denW0 = parseFloat(await w0());

    await page.locator('#discover-btn').click();
    expect(await surface()).toBe('discover');
    await page.waitForTimeout(550);                  // let the ~450ms crossfade settle
    const discW0 = parseFloat(await w0());

    await page.locator('#foryou-btn').click();
    expect(await surface()).toBe('foryou');

    await page.locator('#view-all-btn').click();
    expect(await surface()).toBe('tool');            // View All = the "tool" room

    await page.locator('#den-btn').click();
    expect(await surface()).toBe('den');

    // Den is coziest (highest wash alpha), Discover most open (lowest) — the "you are here".
    expect(denW0).toBeGreaterThan(discW0);
    expect(denW0).toBeCloseTo(0.80, 1);
    expect(discW0).toBeCloseTo(0.28, 1);
  });

  test('the Update Log is re-homed INTO the welcome door (not on the home flow)', async ({ page }) => {
    await page.goto('/');
    // Relocated as a live node under the door card, classes swapped.
    await expect(page.locator('#welcome-splash #changelog-drop.welcome-changelog')).toHaveCount(1);
    // Gone from the home view, and no longer the gutter float.
    await expect(page.locator('#home-view #changelog-drop')).toHaveCount(0);
    await expect(page.locator('#changelog-drop.side-widget')).toHaveCount(0);
    // The data path is intact — the version chip still resolves.
    await expect(page.locator('#changelog-version')).not.toBeEmpty();
  });

  test('Top 10 + Latest Drop share the den-showcase row', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.den-showcase #spotlight-carousel')).toHaveCount(1);
    await expect(page.locator('.den-showcase #featured-drop')).toHaveCount(1);
  });

  test('the For-You hero sub got the gold-pin chip treatment (late add #5)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#for-you-view .discover-sub .ds-pin')).toHaveCount(1);
    await expect(page.locator('#for-you-view .discover-sub .ds-gold')).toHaveText('gold');
  });

  test('the airing band\'s "See more in Discover" hand-off renders and is visible (late add #4)', async ({ page }) => {
    await page.goto('/');
    const more = page.locator('#home-airing-more');
    await expect(more).toBeVisible();
    await expect(more).toContainText('See more in Discover');
    // It's a branded chip now (bordered), not a bare underlined link.
    const border = await more.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(parseFloat(border)).toBeGreaterThan(0);
  });

  test('account + suggest pages carry a static mid veil density', async ({ page }) => {
    await page.goto('/account.html');
    expect(await page.evaluate(() => document.documentElement.dataset.surface)).toBe('foryou');
  });
});
