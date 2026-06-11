const { test, expect } = require('../tests/welcomed');

// DREAM-PROFILE GATE — REAL-PIXEL verification against the SEEDED practice
// sandbox (Mika wears the full kit: bg/tags/accent/status/featured/likesCount;
// her One Punch Man review carries a cover). Class presence has lied to us
// before — these assert decoded pixels and on-screen geometry.
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('dream-profile — the sheet, the banner, and the pfp link (emulator-seeded)', () => {
  test("Mika's profile sheet wears the full kit — and her background actually DECODES", async ({ page }) => {
    await page.goto('/index.html?emu=1#profile=prac-mika');
    const sheet = page.locator('.profile-sheet');
    await expect(sheet).toBeVisible({ timeout: 25000 });
    // the seeded bgRef hydrates through the Storage emulator → real pixels
    await expect(sheet).toHaveClass(/has-bg/, { timeout: 20000 });
    const bg = page.locator('.profile-bg-wrap .profile-bg');
    await expect
      .poll(() => bg.evaluate((el) => el.naturalWidth || 0), { timeout: 20000, intervals: [200] })
      .toBeGreaterThan(0);
    // accent + tags + status + the ONE sanctioned count + the featured pin
    await expect(sheet).toHaveAttribute('data-accent', 'teal');
    await expect(page.locator('.profile-tag')).toHaveCount(3);
    await expect(page.locator('.profile-status')).toContainText('rewatching');
    await expect(page.locator('.profile-like-count')).toHaveText('2');
    await expect(page.locator('.profile-featured')).toBeVisible({ timeout: 20000 });
    // HEART: nothing on a community sheet is gold
    const html = (await sheet.evaluate((el) => el.outerHTML)).toLowerCase();
    expect(html).not.toContain('#ffd54a');
    expect(html).not.toContain('#ffd866');
  });

  test('activity tabs — Threads + Reviews ONLY (gate 20.7: Comments/Replies left the public card)', async ({ page }) => {
    await page.goto('/index.html?emu=1#profile=prac-mika');
    await expect(page.locator('.profile-acts')).toBeVisible({ timeout: 25000 });
    // Blake item 3: "Take out replies and comments on a public display page."
    await expect(page.locator('.profile-act-chip')).toHaveCount(2);
    await expect(page.locator('.profile-act-chip[data-act="comments"]')).toHaveCount(0);
    await expect(page.locator('.profile-act-chip[data-act="replies"]')).toHaveCount(0);
    // Reviews → her seeded review still drives a real collection-group read
    await page.locator('.profile-act-chip[data-act="reviews"]').click();
    await expect(page.locator('[data-profile-acts] .profile-item').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.profile-act-chip[data-act="reviews"]')).toHaveClass(/is-active/);
    // Threads → honest state either way (rows or the empty line, never a dead spinner)
    await page.locator('.profile-act-chip[data-act="threads"]').click();
    await expect(page.locator('[data-profile-acts] .profile-item, [data-profile-acts] .profile-empty').first())
      .toBeVisible({ timeout: 20000 });
  });

  test('fix 2: clicking a comment AVATAR opens that author profile (the name already did)', async ({ page }) => {
    // land on the seeded comment via the deep-link machinery (comments render in-modal)
    await page.goto('/index.html?emu=1#notif=' + encodeURIComponent('comments/one-punch-man/items/seed-0'));
    const ava = page.locator('.comment-item .avatar[data-profile-uid]').first();
    await expect(ava).toBeVisible({ timeout: 25000 });
    const uid = await ava.getAttribute('data-profile-uid');
    expect(uid).toBeTruthy();
    await ava.click();
    await expect(page.locator('.profile-sheet')).toBeVisible({ timeout: 15000 });
    expect(page.url()).toContain('#profile=' + uid);
  });

  test('fix 1: the review cover renders as a real BANNER — decoded, row-wide, not a 48×34 thumb', async ({ page }) => {
    // land on Mika's seeded review (it carries thumbImage) via the review deep-link
    await page.goto('/index.html?emu=1#notif=' + encodeURIComponent('reviews/one-punch-man/items/prac-mika'));
    const row = page.locator('.review-row.has-cover').first();
    await expect(row).toBeVisible({ timeout: 25000 });
    const cover = row.locator('.row-cover');
    await expect
      .poll(() => cover.evaluate((el) => el.naturalWidth || 0), { timeout: 20000, intervals: [200] })
      .toBeGreaterThan(0);
    // real geometry: the banner spans the row and stands tall
    const coverBox = await cover.boundingBox();
    const rowBox = await row.boundingBox();
    expect(coverBox.height).toBeGreaterThan(90);
    expect(coverBox.width).toBeGreaterThan(rowBox.width * 0.8);
    // and a cover-less row keeps the compact headline (no phantom banner)
    await expect(page.locator('.review-row:not(.has-cover) .row-cover-banner')).toHaveCount(0);
  });
});
