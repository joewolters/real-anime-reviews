const { test, expect } = require('./welcomed');

/**
 * v1.8.3 gate 5 — the "Continue where you left off" rail and the watched-seasons
 * provenance on reviewed cards. Returning visitor (suite storageState).
 */
test.describe('Gate 5 — continue rail + provenance', () => {
  test('opening an anime makes it show in the Continue rail on home', async ({ page }) => {
    await page.goto('/');

    // The rail is hidden with no history.
    expect(await page.locator('#continue-section').getAttribute('hidden')).not.toBeNull();

    // Open an anime, then return to a fresh home (history persists in localStorage).
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    await page.locator('.card-container .card').first().click();
    await expect(page.locator('#anime-modal')).toBeVisible();

    await page.goto('/');
    await expect(page.locator('#continue-section')).toBeVisible();
    await expect(page.locator('#continue-row .card').first()).toBeVisible();
  });

  test('the modal shows watched-seasons provenance under the vote bar', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    await page.locator('.card-container .card').first().click();
    await expect(page.locator('#anime-modal')).toBeVisible();
    const prov = page.locator('#anime-modal .modal-provenance');
    await expect(prov).toBeVisible();
    await expect(prov).toContainText(/The Creator watched\s+\d+\s+season/i);
  });
});
