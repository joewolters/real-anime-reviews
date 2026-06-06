const { test, expect } = require('./welcomed');

// Site-wide a11y: anime cards are role=button / tabindex=0 with an Enter/Space
// keydown that opens the modal (the primary action used to be mouse-only). The
// nested fav/watch buttons stay separately focusable and their activation does
// NOT open the modal (stopPropagation).
test.describe('card keyboard accessibility', () => {
  test('catalog card is a keyboard-reachable control', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    const card = page.locator('.card-container .card').first();
    await expect(card).toHaveAttribute('tabindex', '0');
    await expect(card).toHaveAttribute('role', 'button');
    const label = await card.getAttribute('aria-label');
    expect(label && label.trim().length).toBeTruthy();   // named by its title
  });

  test('Enter on a focused card opens the modal', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    const card = page.locator('.card-container .card').first();
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#anime-modal')).toBeVisible();
    await page.locator('#anime-modal .close-button').first().click();
    await expect(page.locator('#anime-modal')).toBeHidden();
  });

  test('Space on a focused card opens the modal (and does not scroll away)', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    const card = page.locator('.card-container .card').first();
    await card.focus();
    await page.keyboard.press(' ');
    await expect(page.locator('#anime-modal')).toBeVisible();
  });

  test('focusing a card reveals its fav/watch buttons (focus-within)', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    const card = page.locator('.card-container .card').first();
    const favOpacity0 = await card.locator('.icon-row').evaluate(el => getComputedStyle(el).opacity);
    await card.focus();
    // focus-within reveals the row
    await expect.poll(async () =>
      card.locator('.icon-row').evaluate(el => getComputedStyle(el).opacity)
    ).toBe('1');
    expect(favOpacity0).toBe('0');   // hidden before focus
  });
});
