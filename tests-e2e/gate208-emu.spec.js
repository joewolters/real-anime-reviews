const { test, expect } = require('../tests/welcomed');

// GATE 20.8 — the two pre-cutover fixes, driven live on the emulator.
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('gate 20.8 — composer avatar + layered routing (emulator-seeded)', () => {
  test('fix 1: the comments composer chip is YOUR disc signed-in, the ★ signed-out', async ({ page }) => {
    // signed-out: the star
    await page.goto('/index.html?emu=1#notif=' + encodeURIComponent('comments/one-punch-man/items/seed-0'));
    const chip = page.locator('.comment-composer .composer-ava').first();
    await expect(chip).toBeVisible({ timeout: 25000 });
    await expect(chip).toHaveText('★');

    // sign in as Mika (seeded photoURL is null → her INITIAL disc, the fallback)
    await page.goto('/index.html?emu=1');
    await page.click('#auth-open');
    await page.fill('#auth-email', 'prac-mika@practice.test');
    await page.fill('#auth-password', 'practice123');
    await page.click('#auth-submit');
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('.signin-catchup')?.remove());
    // a real navigation (a hash-only goto is a same-document jump — no boot route)
    await page.goto('/index.html?emu=1&r=2#notif=' + encodeURIComponent('comments/one-punch-man/items/seed-0'));
    const chip2 = page.locator('.comment-composer .composer-ava').first();
    await expect(chip2).toBeVisible({ timeout: 25000 });
    await expect(chip2).toHaveText('M');   // her face's fallback — never the star
  });

  test('fix 2: a profile review-row clicked OVER a z-6000 layer lands ON TOP', async ({ page }) => {
    // The Tavern drawer is the deterministic z-6000 layer (fully seeded — the
    // secondary/room variant needs a live AniList fetch, which stays out of
    // the suite per the determinism rule; it is verified by walks + g27 pins
    // the shared closeStaleOverlays both branches route through).
    await page.goto('/index.html?emu=1');
    await page.click('#auth-open');
    await page.fill('#auth-email', 'prac-sora@practice.test');
    await page.fill('#auth-password', 'practice123');
    await page.click('#auth-submit');
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('.signin-catchup')?.remove());

    await page.click('#community-btn');
    await page.waitForSelector('.hub-card', { timeout: 20000 });
    // Mika's seeded thread (th-recs) — her byline on the LIST card
    const byline = page.locator('.hub-card [data-profile-uid="prac-mika"]').first();
    await byline.click({ timeout: 20000 });
    await page.waitForSelector('.profile-layer .profile-sheet', { timeout: 20000 });

    // her Reviews tab → the seeded review row → must land ON TOP
    await page.locator('.profile-act-chip[data-act="reviews"]').click();
    const row = page.locator('.profile-layer [data-open-target]').first();
    await expect(row).toBeVisible({ timeout: 20000 });
    await row.click();

    // the stale drawer CLOSED and the primary modal owns the screen
    await expect(page.locator('.hub-layer.active')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('.modal.active')).toHaveCount(1, { timeout: 20000 });
    // the review content actually renders (Mika's seeded review on OPM)
    await expect(page.locator('.modal.active')).toContainText(/review/i, { timeout: 20000 });
  });
});
