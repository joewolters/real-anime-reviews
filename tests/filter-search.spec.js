const { test, expect } = require('./welcomed');

/**
 * Filter overhaul + search improvements (v1.8.3 gate 4).
 * Runs as a returning visitor (suite storageState seeds rar:welcomed=1) so the
 * welcome door doesn't intercept clicks.
 */
test.describe('Filter + search (v1.8.3 gate 4)', () => {
  test('live search surfaces matches without Enter, and 1–3 results center (is-sparse)', async ({ page }) => {
    await page.goto('/');

    // Typing alone (no Enter) brings up matching cards in the All view.
    await page.fill('#site-search', 'charlotte');
    await page.waitForSelector('.card-container .card');
    await expect.poll(() => page.locator('.card-container .card').count()).toBeGreaterThan(0);

    // A handful of results should center rather than left-hug the grid.
    await expect(page.locator('.card-container')).toHaveClass(/is-sparse/);

    const titles = await page.locator('.card-container .card .title-text').allTextContents();
    expect(titles.some((t) => t.toLowerCase().includes('charlotte'))).toBe(true);
  });

  test('filter panel: studio dedup, live-narrow (match + no-match), Saved toggle, chip apply', async ({ page }) => {
    await page.goto('/');

    await page.click('#filter-btn');
    await expect(page.locator('#filter-panel')).toHaveClass(/open/);

    // Studio dedup: exactly one "Madhouse" chip, and no "Studio Madhouse" variant.
    await expect(page.locator('#studio-list .filter-item label', { hasText: /^Madhouse$/ })).toHaveCount(1);
    await expect(page.locator('#studio-list .filter-item label', { hasText: /^Studio Madhouse$/ })).toHaveCount(0);

    // Live-narrow: a no-match query shows the "no options" line; clearing hides it.
    await page.fill('#filter-narrow', 'zzzzzzzz');
    await expect(page.locator('#filter-noopts')).toBeVisible();
    await page.fill('#filter-narrow', '');
    await expect(page.locator('#filter-noopts')).toBeHidden();

    // Saved quick-filter toggles its pressed state.
    const saved = page.locator('#filter-saved');
    await expect(saved).toHaveAttribute('aria-pressed', 'false');
    await saved.click();
    await expect(saved).toHaveAttribute('aria-pressed', 'true');
    await saved.click();
    await expect(saved).toHaveAttribute('aria-pressed', 'false');

    // Pick the first genre chip and apply → grid renders the filtered set.
    await page.locator('#genre-list .filter-item label').first().click();
    await page.click('#filter-apply');
    await page.waitForSelector('.card-container .card');
    await expect(page.locator('.card-container .card').first()).toBeVisible();
  });

  test('narrowing to a single studio keeps the panel structured (no blank-out)', async ({ page }) => {
    // v1.8.3 gate 5b regression — narrowing to "typhoon" (one studio) used to hide the
    // genre+tag groups entirely, collapsing the panel to near-empty. Now all three group
    // headers stay; the empty ones show a "no matches" placeholder.
    await page.goto('/');
    await page.click('#filter-btn');
    await page.fill('#filter-narrow', 'typhoon');

    // All three groups remain present (not [hidden]).
    for (const g of ['genre', 'tag', 'studio']) {
      expect(await page.locator(`.filter-group[data-group="${g}"]`).getAttribute('hidden')).toBeNull();
    }
    // The studio chip is findable and the empty groups are flagged.
    await expect(page.locator('#studio-list .filter-item:not([hidden]) label', { hasText: /Typhoon/ })).toHaveCount(1);
    await expect(page.locator('.filter-group[data-group="genre"].is-empty')).toHaveCount(1);
  });

  test('filter checkboxes are in-flow (not absolute) so a label click never scroll-jumps the panel', async ({ page }) => {
    // v1.8.3 gate 5c regression — the studio chips used a position:absolute checkbox
    // anchored to the FIXED panel (computed top ~857px), so clicking a label focused it
    // and the browser scrolled the panel to reveal it (the "Typhoon click blanks the
    // panel" report). Keep them in flow + zero-size so focus is a no-op scroll.
    await page.goto('/');
    await page.click('#filter-btn');
    const pos = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#studio-list input[type="checkbox"]')).position);
    expect(pos).toBe('static');

    // and clicking a studio chip still toggles it
    await page.locator('#studio-list .filter-item label').first().click();
    expect(await page.locator('#studio-list input:checked').count()).toBe(1);
  });
});
