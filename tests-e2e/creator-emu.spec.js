const { test, expect } = require('../tests/welcomed');

// v1.10.2R — THE CREATOR KICKER, driven live on the emulator. Blake's
// clarified spec: his sheet is a MEMBER sheet (nothing imposed) and the ONE
// difference is the CREATOR kicker.
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('the Creator sheet (emulator-seeded)', () => {
  test('a member clicking Blake meets HIS member-parity sheet — CREATOR kicker, nothing imposed', async ({ page }) => {
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

    // the kicker is the ONE difference; no flag on the owner — and the
    // Appreciate row rides his sheet now (Blake's 2026-07-02 call)
    await expect(sheet).toHaveClass(/is-creator/);
    await expect(sheet.locator('.profile-kicker')).toContainText('CREATOR');
    await expect(sheet.locator('.profile-like-row')).toHaveCount(1);
    await expect(sheet.locator('.profile-like-count')).toHaveText(/^\d+$/);
    await expect(sheet.locator('.profile-report')).toHaveCount(0);

    // member parity: no gold door, the Reviews tab is back, and NO imposed
    // frame — the seed saves none, so none may render (the forced default died)
    await expect(sheet.locator('.profile-den-path')).toHaveCount(0);
    await expect(sheet.locator('.profile-act-chip[data-act="reviews"]')).toHaveCount(1);
    expect(await sheet.getAttribute('data-frame')).toBeNull();

    // the sheet closes clean like any member's
    await page.click('.profile-close');
    await expect(page.locator('.profile-layer')).toHaveCount(0, { timeout: 10000 });
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
