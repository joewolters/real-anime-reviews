const { test, expect } = require('@playwright/test');

test.describe('Anime modal', () => {
  test('opens on card click and closes via close button', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');

    // Click the first card.
    await page.locator('.card-container .card').first().click();

    // Modal becomes visible with title + meta.
    await expect(page.locator('#anime-modal')).toBeVisible();
    await expect(page.locator('#anime-modal .modal-title')).toBeVisible();
    await expect(page.locator('#anime-modal .rating-badge')).toBeVisible();

    // Close via the in-modal close button.
    await page.locator('#anime-modal .close-button').first().click();

    // Modal hidden again.
    await expect(page.locator('#anime-modal')).toBeHidden();
  });
});
