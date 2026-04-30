const { test, expect } = require('@playwright/test');

/**
 * Regression test for the v1.3.8 §1.3 fix.
 *
 * Background: the ?open=<animeId> deep-link handler was nested inside
 * document.addEventListener("visibilitychange", ...), so it only fired when
 * the user backgrounded and refocused the tab. Hoisted into init() so it
 * runs once on page load.
 *
 * "On first load" means: no tab refocus required. Playwright never backgrounds
 * the page during a single navigation, so this test would fail under the old
 * (broken) handler placement.
 */
test.describe('Deep link from account page (regression for §1.3)', () => {
  test('?open=charlotte opens the modal on first load and cleans the URL', async ({ page }) => {
    await page.goto('/?open=charlotte');

    // Modal must appear on first load — no tab-refocus required.
    await expect(page.locator('#anime-modal')).toBeVisible({ timeout: 3000 });

    // URL has been cleaned: no ?open= in the address bar.
    expect(page.url()).not.toContain('open=');
  });
});
