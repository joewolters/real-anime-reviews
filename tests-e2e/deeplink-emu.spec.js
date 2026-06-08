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

  // review-like target (who found a review helpful) → land ON Mika's review, halo it.
  // v1.9.1c — this asserts a VISIBLE halo, not class presence. The v1.9.1 spec checked
  // `.row-toggle.rar-deeplink-flash` (class only) and reported GREEN while the real
  // browser showed NOTHING: the flash sat on `.row-toggle`, whose glow was clipped to
  // nothing by `.review-row { overflow:hidden }`. Now: the halo lands on the `.review-row`
  // itself AND we poll the row's actual computed box-shadow alpha so the glow must really
  // PAINT (peaks ~0.55). A clipped/missing halo never paints a box-shadow on the row → red.
  function maxBoxShadowAlpha(el) {
    const bs = getComputedStyle(el).boxShadow;
    if (!bs || bs === 'none') return 0;
    let a = 0;
    for (const m of (bs.match(/rgba?\([^)]*\)/g) || [])) {
      const p = m.match(/[\d.]+\s*\)$/); if (p) a = Math.max(a, parseFloat(p[0]));
    }
    return a;
  }
  test('review target lands on + shows a VISIBLE halo on the review row (survives re-render)', async ({ page }) => {
    await page.goto(`/index.html?emu=1#notif=reviews/${SLUG}/items/prac-mika`);
    const row = page.locator('.review-row[data-id="prac-mika"]');
    await expect(row).toBeVisible({ timeout: 25000 });
    await expect(row).toBeInViewport({ timeout: 25000 });
    // the halo lands on the ROW itself — a child (.row-toggle) would be clipped by the
    // row's overflow:hidden, the carried bug.
    await expect(row).toHaveClass(/rar-deeplink-flash/, { timeout: 25000 });
    // and the glow actually RENDERS: the row's box-shadow ramps non-transparent at the
    // animation peak (≈0.55). Poll every 80ms (the keyframes are transparent at 0/100%).
    await expect
      .poll(() => row.evaluate(maxBoxShadowAlpha), { timeout: 9000, intervals: [80] })
      .toBeGreaterThan(0.25);
    // survives the list's re-render: still flashed + in view after a settle
    await page.waitForTimeout(1500);
    await expect(row).toHaveClass(/rar-deeplink-flash/);
    await expect(row).toBeInViewport();
  });
});
