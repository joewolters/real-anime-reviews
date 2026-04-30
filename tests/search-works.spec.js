const { test, expect } = require('@playwright/test');

test.describe('Search', () => {
  test('filters cards by query and restores when cleared', async ({ page }) => {
    await page.goto('/');

    // Switch to all-anime view to render the full card grid.
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');

    const initialCount = await page.locator('.card-container .card').count();
    expect(initialCount).toBeGreaterThan(5);

    // Search for "charlotte" — should match the Charlotte anime entry.
    await page.fill('#site-search', 'charlotte');
    await page.press('#site-search', 'Enter');

    // Wait for filter to apply (card count drops below initial).
    await page.waitForFunction(
      (init) => {
        const cards = document.querySelectorAll('.card-container .card');
        return cards.length > 0 && cards.length < init;
      },
      initialCount,
    );

    const filteredCount = await page.locator('.card-container .card').count();
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);

    // At least one result is Charlotte-related.
    const titles = await page.locator('.card-container .card .title-text').allTextContents();
    expect(titles.some((t) => t.toLowerCase().includes('charlotte'))).toBe(true);

    // Clear and click View All — original count returns.
    await page.fill('#site-search', '');
    await page.click('#view-all-btn');
    await page.waitForFunction(
      (init) => document.querySelectorAll('.card-container .card').length === init,
      initialCount,
    );
    expect(await page.locator('.card-container .card').count()).toBe(initialCount);
  });
});
