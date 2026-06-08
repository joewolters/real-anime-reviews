const { test, expect } = require('../tests/welcomed');

// gate 6g — emulator-backed deep-link LANDING matrix. Earlier gates' specs only
// verified the URL BUILDER; Blake's 6f re-smoke showed the LANDINGS failing, so this
// closes the verification gap: it drives openNotifTarget via the #notif= hash against
// the SEEDED practice site (real comments/reviews in the firestore emulator) and
// asserts the exact message gets the purple halo (.rar-deeplink-flash).
//
// Why this covers the whole matrix: the #notif= hash is the cross-page (account->home)
// entry; the same-page entry (clicking a notification on index) AND the who-liked
// drill-down rows both call the SAME openNotifTarget(targetPath). So a green landing
// here = green for every {origin} of that target type. (The remaining human check —
// that a real CLICK on a seeded notification reaches openNotifTarget — is Blake's
// re-smoke; the CF + seed now both carry the matching targetPath.)
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('v1.9.0 gate 6g — deep-link landings (emulator-seeded)', () => {
  const SLUG = 'one-punch-man';

  // comment-like target (who-liked a comment) → land ON Mika's comment, halo the bubble.
  test('comment target lands on + halos the exact comment', async ({ page }) => {
    await page.goto(`/index.html?emu=1#notif=comments/${SLUG}/items/seed-0`);
    await page.waitForSelector('.comment-item[data-cid="seed-0"] .bubble.rar-deeplink-flash', { timeout: 25000 });
  });

  // comment-reply target (a reply ping) → lands on the PARENT comment (seed-0).
  test('comment-reply target lands on + halos the PARENT comment', async ({ page }) => {
    await page.goto(`/index.html?emu=1#notif=comments/${SLUG}/items/seed-0/replies/r0`);
    await page.waitForSelector('.comment-item[data-cid="seed-0"] .bubble.rar-deeplink-flash', { timeout: 25000 });
  });

  // review-like target (who found a review helpful) → land ON Mika's review, halo the title bar.
  test('review target lands on + halos the exact review', async ({ page }) => {
    await page.goto(`/index.html?emu=1#notif=reviews/${SLUG}/items/prac-mika`);
    await page.waitForSelector('.review-row[data-id="prac-mika"] .row-toggle.rar-deeplink-flash', { timeout: 25000 });
  });
});
