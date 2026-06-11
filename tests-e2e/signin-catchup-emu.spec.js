const { test, expect } = require('../tests/welcomed');

// GATE 20.7 (Blake item 5c) — a user who signs in MID-SESSION (door already
// gone) gets the compact catch-up strip when letters are waiting, and it opens
// the SAME catch-up sheet. Yuki's unread inbox is seed-guaranteed (20.7 item
// 5b), so this is deterministic against any fresh practice boot.
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('the mid-session sign-in catch-up strip (emulator-seeded)', () => {
  test('sign in as Yuki after the door → 🏮 strip → the catch-up sheet', async ({ page }) => {
    // self-reset: opening the sheet advances lastSeenAt (viewing = reading),
    // so restore Yuki's all-unread state for rerunnability on a warm sandbox
    // (the seeded letters themselves persist; only the read-marker goes).
    await fetch(
      'http://127.0.0.1:8080/v1/projects/real-anime-reviews/databases/(default)/documents/users/prac-yuki/notifPrefs/prefs',
      { method: 'DELETE', headers: { Authorization: 'Bearer owner' } }
    );

    // the `welcomed` fixture pre-dismisses the door = the mid-session shape
    await page.goto('/index.html?emu=1');
    await page.click('#auth-open');
    await page.fill('#auth-email', 'prac-yuki@practice.test');
    await page.fill('#auth-password', 'practice123');
    await page.click('#auth-submit');

    // the strip appears (seed guarantees ≥1 unread letter for Yuki)
    const strip = page.locator('.signin-catchup');
    await expect(strip).toBeVisible({ timeout: 15000 });
    await expect(strip.locator('.sc-label')).toContainText(/While you were away — \d+ new lantern ping/);

    // clicking it opens the real catch-up sheet with the lantern letters
    await page.click('.signin-catchup-btn');
    await expect(page.locator('#catchup-sheet')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#catchup-body')).toContainText(/LANTERN/i);
    // the strip removed itself
    await expect(page.locator('.signin-catchup')).toHaveCount(0);
  });
});
