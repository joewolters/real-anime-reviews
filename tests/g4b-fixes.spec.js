const { test, expect } = require('./welcomed');

/**
 * v1.8.3 gate 4b — search ✕ removal + filter auto-clear on navigation.
 * Returning visitor (welcomed fixture). The first-visit quotes test lives in
 * welcome-splash.spec.js.
 */
test.describe('Gate 4b fixes', () => {
  test('search ✕ is gone, and "View All" clears active filters', async ({ page }) => {
    await page.goto('/');

    // The clear-search ✕ button was removed.
    expect(await page.locator('#clear-search').count()).toBe(0);

    // Apply a genre filter.
    await page.click('#filter-btn');
    await page.locator('#genre-list .filter-item label').first().click();
    await page.click('#filter-apply');
    await page.waitForSelector('.card-container .card');

    // View All resets everything.
    await page.click('#view-all-btn');
    await page.click('#filter-btn');
    await expect(page.locator('#filter-summary')).toHaveText(/No filters applied/i);
    expect(await page.locator('#filter-form input:checked').count()).toBe(0);
  });
});
