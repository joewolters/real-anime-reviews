const { test, expect } = require('../tests/welcomed');

// GATE 20.6 (Blake item 6) — the consent dead-end. Blake: "An 'I agree with
// the rules' should appear after I request to save changes." This drives the
// REAL flow on the emulator: a fresh user edits their profile, clicks Save,
// the consent modal appears IN PLACE, agreeing completes the save — no banner
// hunt, no going to comment somewhere else first.
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('the profile Save offers the rules in place (emulator-seeded)', () => {
  test('fresh user: Save → consent modal → agree → saved', async ({ page }) => {
    // reset prac-newbie's gate doc so the spec is rerunnable against a warm
    // sandbox (the emulator REST accepts the owner bypass).
    await fetch(
      'http://127.0.0.1:8080/v1/projects/real-anime-reviews/databases/(default)/documents/moderationGate/prac-newbie',
      { method: 'DELETE', headers: { Authorization: 'Bearer owner' } }
    );

    // the real auth modal (no fixture shortcuts — the flow IS the test)
    await page.goto('/index.html?emu=1');
    await page.click('#auth-open');
    await page.fill('#auth-email', 'prac-newbie@practice.test');
    await page.fill('#auth-password', 'practice123');
    await page.click('#auth-submit');
    await page.waitForTimeout(2500);

    await page.goto('/account.html');
    await page.waitForSelector('#prof-status', { timeout: 20000 });
    await page.waitForTimeout(1200);

    await page.fill('#prof-status', 'g25 e2e: consent comes to the save');
    await page.click('#profile-save');

    // the rules COME TO the user — in place, no banner hunt
    const modal = page.locator('.rar-consent-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal).toContainText('Community Rules');

    await page.click('.rar-consent-agree');
    // agreeing completes the SAME save (no re-click): the saved toast lands
    await expect(page.locator('.acct-toast')).toBeVisible({ timeout: 15000 });
  });
});
