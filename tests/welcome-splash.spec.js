const { test, expect } = require('@playwright/test');

/**
 * Den-door welcome splash (v1.8.3 gate 3 / 5b).
 *
 * As of gate 5b the door shows once per BROWSER SESSION (sessionStorage rar:welcomed):
 * a fresh Playwright context = a new session, so by default the door shows. These
 * first-visit specs therefore import '@playwright/test' directly (NOT the welcomed
 * fixture), and the "within a session" case seeds sessionStorage itself.
 */
test.describe('Den-door welcome splash', () => {
  test('first visit: splash shows, Enter dismisses + persists for the session, page interactive', async ({ page }) => {
    await page.goto('/');

    const splash = page.locator('#welcome-splash');
    await expect(splash).toBeVisible();
    await expect(page.locator('#welcome-enter')).toBeVisible();

    await page.locator('#welcome-enter').click();
    await expect(splash).toBeHidden();

    // Persisted to sessionStorage (not localStorage).
    expect(await page.evaluate(() => sessionStorage.getItem('rar:welcomed'))).toBe('1');

    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
  });

  test('first visit: Escape also dismisses + persists', async ({ page }) => {
    await page.goto('/');
    const splash = page.locator('#welcome-splash');
    await expect(splash).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(splash).toBeHidden();
    expect(await page.evaluate(() => sessionStorage.getItem('rar:welcomed'))).toBe('1');
  });

  test('first visit: a comic quote bubble appears with text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#welcome-splash')).toBeVisible();
    // JS launches comic bubbles into #welcome-quotes; the first appears with text.
    const bubble = page.locator('#welcome-quotes .welcome-quote-bubble').first();
    await expect(bubble).toBeVisible();
    await expect(bubble.locator('.wq-text')).not.toHaveText('');
  });

  test('within the same session (flag set) the door does not re-show', async ({ page }) => {
    await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
    await page.goto('/');
    await page.waitForTimeout(400);
    await expect(page.locator('#welcome-splash')).toBeHidden();
  });
});
