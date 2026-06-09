const { test, expect } = require('../tests/welcomed');

// v1.10.0 gates 12-14 — REAL-PIXEL verification of forum image rendering against
// the SEEDED practice sandbox (Storage emulator live). The static g12-images
// spec proves the DOM contract (hostile refs render nothing, Report chip present,
// purple/no-gold) but CANNOT prove the image actually loads — getDownloadURL only
// resolves against the running Storage emulator. So this spec deep-links to the
// seeded thread (th-opm carries a seeded image on post p0) and asserts the image
// element actually DECODED (naturalWidth > 0) — a broken emulator download URL
// leaves the element in the DOM but naturalWidth 0 (exactly the "class presence
// lied" trap: DOM-present ≠ rendered).
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('v1.10.0 gates 12-14 — forum image renders for real (emulator-seeded)', () => {
  test('the seeded Tavern image actually decodes + carries a Report affordance', async ({ page }) => {
    await page.goto('/index.html?emu=1#forum=th-opm');
    // the thread drawer opens and paints posts; the seeded image is on p0.
    const img = page.locator('img.hub-post-img').first();
    await expect(img).toBeVisible({ timeout: 25000 });
    // REAL PIXELS: the image must have actually loaded + decoded, not just exist.
    await expect
      .poll(() => img.evaluate((el) => el.naturalWidth), { timeout: 20000, intervals: [200] })
      .toBeGreaterThan(0);
    // and the src is an emulator download URL (SDK-derived), never a raw doc string.
    const src = await img.getAttribute('src');
    expect(src).toMatch(/^https?:\/\//);
    // the one mandatory mitigation: a Report affordance sits on the image.
    await expect(page.locator('[data-img-report]').first()).toBeVisible();
  });

  test('overhaul: the seeded [img:1] token renders INLINE in the prose, and th-new shows a card thumbnail', async ({ page }) => {
    // (1) inline placement — the seed's p0 body carries "[img:1]" mid-sentence,
    // so the figure must live INSIDE .hub-post-text (not the trailing gallery).
    await page.goto('/index.html?emu=1#forum=th-opm');
    const inlineImg = page.locator('.hub-post-text .hub-post-img').first();
    await expect(inlineImg).toBeVisible({ timeout: 25000 });
    await expect
      .poll(() => inlineImg.evaluate((el) => el.naturalWidth), { timeout: 20000, intervals: [200] })
      .toBeGreaterThan(0);
    // (2) the lightbox: clicking the loaded inline image opens the full view.
    await inlineImg.click();
    await expect(page.locator('.rar-lightbox-img')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.rar-lightbox')).toHaveCount(0);
    // (3) the user-chosen thumbnail on the text thread's tavern card.
    await page.goto('/index.html?emu=1#community');
    await page.evaluate(() => { const b = document.getElementById('community-btn'); if (b) b.click(); });
    const card = page.locator('.hub-card[data-thread-id="th-new"] .hub-card-thumb');
    await expect(card).toBeVisible({ timeout: 25000 });
    await expect
      .poll(() => card.evaluate((el) => el.naturalWidth), { timeout: 20000, intervals: [200] })
      .toBeGreaterThan(0);
  });
});
