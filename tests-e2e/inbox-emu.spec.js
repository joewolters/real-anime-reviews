const { test, expect } = require('../tests/welcomed');

// ROUND 2 → gate A2: drive the REAL write-to-Blake flow end to end, through
// the LETTER ROOM's unified entry (the hero card is gone — Blake is reached
// like anyone: his sheet's ✉ Message → account#inbox/new/<uid> → the first
// letter). The addDoc-never-imported lesson stands: the flow IS the test.
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('the Letter Room — a real send to Blake (emulator-seeded)', () => {
  test('sign in, ✉ Message on Blake\'s sheet, write the letter, see it land', async ({ page }) => {
    // the real auth modal (no fixture shortcuts — the flow IS the test)
    await page.goto('/index.html?emu=1');
    await page.click('#auth-open');
    await page.fill('#auth-email', 'prac-sora@practice.test');
    await page.fill('#auth-password', 'practice123');
    await page.click('#auth-submit');
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('.signin-catchup')?.remove());

    // the unified entry: Blake's profile sheet carries the letter door
    await page.waitForFunction(() => typeof window.openProfilePage === 'function', null, { timeout: 20000 });
    await page.evaluate(() => window.openProfilePage('G2jGRa14u8bzGAmeBTkvXy8PKmr1'));
    const msgBtn = page.locator('.profile-layer .profile-message');
    await expect(msgBtn).toBeVisible({ timeout: 20000 });
    await msgBtn.click();

    // lands in the Letter Room compose/thread view on the account page
    await expect(page.locator('#inbox-thread')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1200);   // the conversations snapshot + compose hand-off settle

    const line = 'gate-A2 smoke: the letter room actually sends now';
    await page.fill('#inbox-input', line);
    await page.click('#inbox-send');
    // the letter lands in the thread (the live onSnapshot paints it)
    await expect(page.locator('#inbox-messages')).toContainText(line, { timeout: 20000 });
    // and Blake's thread wears his identity (gold title name, admin kind)
    await expect(page.locator('#inbox-thread-title')).toContainText('Blake');
  });
});
