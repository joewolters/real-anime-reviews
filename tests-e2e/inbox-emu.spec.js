const { test, expect } = require('../tests/welcomed');

// ROUND 2 — drive the REAL Message-Blake flow end to end. The gate-18 inbox
// shipped with addDoc never imported (every send threw ReferenceError) and no
// spec caught it because nothing DROVE the flow — static id checks lied by
// omission. This spec sends an actual message through the live emulator.
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('the Message-Blake inbox — a real send (emulator-seeded)', () => {
  test('sign in, open the Inbox panel, message Blake, see the letter land', async ({ page }) => {
    // the real auth modal (no fixture shortcuts — the flow IS the test)
    await page.goto('/index.html?emu=1');
    await page.click('#auth-open');
    await page.fill('#auth-email', 'prac-sora@practice.test');
    await page.fill('#auth-password', 'practice123');
    await page.click('#auth-submit');
    await page.waitForTimeout(2500);

    await page.goto('/account.html#inbox');
    // the Inbox panel is active via the deep link
    await expect(page.locator('#tab-inbox')).toBeVisible({ timeout: 20000 });
    await page.click('#inbox-message-blake');
    await expect(page.locator('#inbox-thread')).toBeVisible({ timeout: 20000 });

    const line = 'round-2 smoke: the inbox actually sends now';
    await page.fill('#inbox-input', line);
    await page.click('#inbox-send');
    // the letter lands in the thread (the live onSnapshot paints it)
    await expect(page.locator('#inbox-messages')).toContainText(line, { timeout: 20000 });
  });
});
