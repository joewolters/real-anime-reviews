const { test, expect } = require('@playwright/test');

test.describe('404 path', () => {
  test('non-existent path returns HTTP 404', async ({ page }) => {
    const resp = await page.goto('/some-nonexistent-path-12345', {
      waitUntil: 'domcontentloaded',
    });
    expect(resp.status()).toBe(404);

    // Deliberately not asserting page content — the local Python server
    // returns its own minimal 404, while Firebase Hosting serves the
    // (currently unbranded, audit §2.1) 404.html. Status code is the contract.
  });
});
