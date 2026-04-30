const { test, expect } = require('@playwright/test');

test.describe('Homepage', () => {
  test('loads with brand and key elements; no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // Filter localhost Firebase/Firestore noise (no real backend connection from 127.0.0.1).
      if (/firebase|firestore|FIRESTORE/i.test(text)) return;
      errors.push(`console.error: ${text}`);
    });

    await page.goto('/');

    // Brand text in <h1>
    await expect(page.locator('h1')).toContainText(/Real Anime Reviews/i);

    // Search input
    await expect(page.locator('#site-search')).toBeVisible();

    // "View All Animes" button
    await expect(page.locator('#view-all-btn')).toBeVisible();

    // Top 10 section heading
    await expect(page.locator('#top10-heading')).toContainText(/Top 10/i);

    // "Anime By Genre" section heading
    await expect(page.getByRole('heading', { name: /Anime By Genre/i })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
