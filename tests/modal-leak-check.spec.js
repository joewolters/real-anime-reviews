const { test, expect } = require('./welcomed');

/**
 * Regression test for the v1.3.8 §1.2 fix.
 *
 * Background: the activeOfficialUnsub Firestore-listener cleanup block was at
 * module top-level after closeModal(), so it ran once on script load and never
 * on close. Listeners leaked on every modal open. Fix moved the cleanup inside
 * closeModal() alongside activeCommentsUnsub / activeReviewsUnsub.
 *
 * Playwright can't directly count Firestore listeners without instrumentation,
 * but a working leak fix means the page stays clean across many open/close
 * cycles. This test catches the *symptoms* of a leak (console errors, page
 * unresponsiveness), not the leak itself.
 */
test.describe('Modal listener leak (regression for §1.2)', () => {
  test('6 open/close cycles complete without errors and page stays responsive', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/firebase|firestore|FIRESTORE/i.test(text)) return;
      errors.push(`console.error: ${text}`);
    });

    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');

    for (let i = 0; i < 6; i++) {
      await page.locator('.card-container .card').nth(i).click();
      await expect(page.locator('#anime-modal')).toBeVisible();
      await page.locator('#anime-modal .close-button').first().click();
      await expect(page.locator('#anime-modal')).toBeHidden();
    }

    expect(errors).toEqual([]);

    // Page is still responsive — search input still accepts typing.
    await page.fill('#site-search', 'frieren');
    expect(await page.locator('#site-search').inputValue()).toBe('frieren');
  });
});
