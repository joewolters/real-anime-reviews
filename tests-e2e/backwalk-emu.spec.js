// LAST CALL B3 — shareable deep links + the HONEST Back (rarNav).
// Blake: "If you sent the link of what you were on it would just bring you to
// the general website… when you go back it should go back on what you were
// last seeing." Cold-opens land EXACTLY; Back walks the real view stack.
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
const { test, expect } = require('../tests/welcomed');

test.describe('rarNav — cold-opens + the back-walk', () => {
  test('cold-open #anime= lands ON the card, URL intact; Back honestly leaves', async ({ page }) => {
    await page.goto('/index.html?emu=1#anime=one-punch-man');
    await page.waitForFunction(() => {
      const m = document.getElementById('anime-modal');
      return m && getComputedStyle(m).display !== 'none' && /one punch man/i.test(m.textContent || '');
    }, null, { timeout: 20000 });
    expect(new URL(page.url()).hash).toBe('#anime=one-punch-man');
    // a cold-opened view owns NO history entry — the stack records it unowned
    const owned = await page.evaluate(() => window.rarNavStack.map((x) => [x.type, x.owned]));
    expect(owned).toEqual([['modal', false]]);
  });

  test('the back-walk: card → profile → Back → card → Back → home (each step honest)', async ({ page }) => {
    await page.goto('/index.html?emu=1');
    await page.waitForFunction(() => typeof window.openProfilePage === 'function', null, { timeout: 20000 });
    // step 1 — open the card from the STABLE grid (the home spotlight cycles;
    // a moving card fails Playwright's stability check)
    await page.click('#view-all-btn');
    await page.waitForTimeout(800);
    await page.locator('#anime-list .card[data-animeid="one-punch-man"], .card-container .card[data-animeid="one-punch-man"]').first().click();
    await expect(page.locator('#anime-modal')).toBeVisible({ timeout: 15000 });
    expect(new URL(page.url()).hash).toBe('#anime=one-punch-man');
    // step 2 — a member profile OVER the card
    await page.evaluate(() => window.openProfilePage('prac-mika'));
    await expect(page.locator('.profile-sheet')).toBeVisible({ timeout: 20000 });
    expect(new URL(page.url()).hash).toBe('#profile=prac-mika');
    // Back #1 — the sheet closes, the card is still there, URL restored
    await page.goBack();
    await expect(page.locator('.profile-layer')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('#anime-modal')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#anime=one-punch-man');
    // Back #2 — the card closes, we're home (never dumped off the site)
    await page.goBack();
    await expect(page.locator('#anime-modal')).toBeHidden({ timeout: 10000 });
    expect(page.url()).toContain('/index.html');
  });

  test('the Tavern walk: drawer → thread → Back → drawer → Back → home', async ({ page }) => {
    await page.goto('/index.html?emu=1');
    await page.waitForTimeout(1500);
    await page.click('#community-btn');
    await expect(page.locator('.hub-layer.active')).toBeVisible({ timeout: 20000 });
    expect(new URL(page.url()).hash).toBe('#tavern');
    // open the first seeded thread
    await page.locator('.hub-card').first().click();
    await expect(page.locator('.hub-thread-layer.active')).toBeVisible({ timeout: 20000 });
    expect(new URL(page.url()).hash).toMatch(/^#forum\//);
    // Back → the thread closes, the drawer (list) remains
    await page.goBack();
    await expect(page.locator('.hub-thread-layer.active')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('.hub-layer.active')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#tavern');
    // Back → the drawer closes; home again
    await page.goBack();
    await expect(page.locator('.hub-layer.active')).toHaveCount(0, { timeout: 10000 });
  });

  test('UI closes CONSUME their entries: Esc through the stack leaves history in step', async ({ page }) => {
    await page.goto('/index.html?emu=1');
    await page.waitForFunction(() => typeof window.openProfilePage === 'function', null, { timeout: 20000 });
    await page.click('#view-all-btn');
    await page.waitForTimeout(800);
    await page.locator('#anime-list .card[data-animeid="one-punch-man"], .card-container .card[data-animeid="one-punch-man"]').first().click();
    await expect(page.locator('#anime-modal')).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.openProfilePage('prac-mika'));
    await expect(page.locator('.profile-sheet')).toBeVisible({ timeout: 20000 });
    // Esc closes the sheet AND consumes its history entry
    await page.keyboard.press('Escape');
    await expect(page.locator('.profile-layer')).toHaveCount(0, { timeout: 10000 });
    await page.waitForTimeout(400);   // the consuming history.back settles
    expect(new URL(page.url()).hash).toBe('#anime=one-punch-man');
    const stack = await page.evaluate(() => window.rarNavStack.map((x) => x.type));
    expect(stack).toEqual(['modal']);
    // ONE Back now goes home — no ghost entries from the consumed sheet
    await page.goBack();
    await expect(page.locator('#anime-modal')).toBeHidden({ timeout: 10000 });
  });
});
