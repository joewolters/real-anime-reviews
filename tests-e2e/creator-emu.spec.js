const { test, expect } = require('../tests/welcomed');

// v1.10.2 — THE CREATOR SHEET, driven live on the emulator.
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('the Creator sheet (emulator-seeded)', () => {
  test('a member clicking Blake meets the gold sheet — and the Den path still leads home', async ({ page }) => {
    await page.goto('/index.html?emu=1');
    await page.click('#auth-open');
    await page.fill('#auth-email', 'prac-mika@practice.test');
    await page.fill('#auth-password', 'practice123');
    await page.click('#auth-submit');
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('.signin-catchup')?.remove());

    // any entry point lands here — the delegation routes every data-profile-uid
    await page.waitForFunction(() => typeof window.openProfilePage === 'function', null, { timeout: 20000 });
    await page.evaluate(() => window.openProfilePage('G2jGRa14u8bzGAmeBTkvXy8PKmr1'));
    const sheet = page.locator('.profile-layer .profile-sheet');
    await expect(sheet).toBeVisible({ timeout: 20000 });

    // the gold sheet: CREATOR kicker, the Den Keeper frame, NO count, NO flag
    await expect(sheet).toHaveClass(/is-creator/);
    await expect(sheet.locator('.profile-kicker')).toContainText('CREATOR');
    await expect(sheet).toHaveAttribute('data-frame', 'blake');
    await expect(sheet.locator('.profile-like-row')).toHaveCount(0);
    await expect(sheet.locator('.profile-report')).toHaveCount(0);

    // the old promise survives ON the sheet: the gold path closes and goes home
    await page.click('.profile-den-path');
    await expect(page.locator('.profile-layer')).toHaveCount(0, { timeout: 10000 });
    const home = await page.evaluate(() => ({ y: window.scrollY, surface: document.documentElement.getAttribute('data-surface') }));
    expect(home.y).toBeLessThan(40);
  });

  test("Blake's own Public view shows HIS sheet now (the 3rd-ask fix)", async ({ page }) => {
    await page.goto('/index.html?emu=1');
    await page.click('#auth-open');
    await page.fill('#auth-email', 'blake@practice.test');
    await page.fill('#auth-password', 'practice123');
    await page.click('#auth-submit');
    await page.waitForTimeout(2500);
    await page.goto('/account.html?r=1#');
    await page.waitForSelector('#acct-mode-view', { timeout: 20000 });
    await page.click('#acct-mode-view');
    const viewer = page.locator('#acct-viewer .profile-sheet.is-creator, #acct-viewer .acct-viewer-empty--creator');
    await expect(viewer.first()).toBeVisible({ timeout: 20000 });
    // whichever state (sheet or the ready-to-wear invitation): never the old refusal
    const text = await page.locator('#acct-viewer').textContent();
    expect(text).not.toContain('no public member sheet');
  });
});
