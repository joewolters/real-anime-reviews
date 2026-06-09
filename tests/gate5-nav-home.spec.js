// Returning-visitor fixture (the nav clicks need the welcome door dismissed).
const { test, expect } = require('./welcomed.js');

// v1.8.4 (gate 5) — real nav (Den/For You/Discover as PLACES, View All/Random/Filter
// as TOOLS) + the homepage hole-fill (AIRING NOW + For-You-on-home strips, the folio
// line, the Latest Drop demotion). Live AniList fills are lazy + fire-and-forget, so
// every assertion here is synchronous DOM/wiring — the suite stays deterministic.
test.describe('v1.8.4 gate 5 — nav + home hole-fill', () => {
  test('the nav reads as PLACES | TOOLS (grouped, one button skin)', async ({ page }) => {
    await page.goto('/');
    // The three surfaces are the primary places, in order, inside .nav-places.
    const places = page.locator('.nav-places .place-btn');
    await expect(places).toHaveCount(4);
    await expect(places.nth(0)).toHaveAttribute('id', 'den-btn');
    await expect(places.nth(1)).toHaveAttribute('id', 'foryou-btn');
    await expect(places.nth(2)).toHaveAttribute('id', 'discover-btn');
    await expect(places.nth(3)).toHaveAttribute('id', 'community-btn');   // v1.10.0 gate 6 — the Hub place
    // The tools live in .nav-tools, after the seam.
    await expect(page.locator('.nav-tools #view-all-btn')).toHaveCount(1);
    await expect(page.locator('.nav-tools #random-btn')).toHaveCount(1);
    await expect(page.locator('.nav-tools #filter-btn')).toHaveCount(1);
    await expect(page.locator('.toolbar-seam')).toHaveCount(1);
    // The filter panel stays anchored to .toolbar (a direct child), not nav-tools.
    await expect(page.locator('.toolbar > #filter-panel')).toHaveCount(1);
  });

  test('the place is a mutually-exclusive radio; Den is lit at home; View All lights none', async ({ page }) => {
    await page.goto('/');
    // Home (default) -> Den is the active place.
    await expect(page.locator('#den-btn')).toHaveClass(/is-active/);
    await expect(page.locator('#den-btn')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#foryou-btn')).not.toHaveClass(/is-active/);

    await page.locator('#foryou-btn').click();
    await expect(page.locator('#foryou-btn')).toHaveClass(/is-active/);
    await expect(page.locator('#den-btn')).not.toHaveClass(/is-active/);
    await expect(page.locator('#discover-btn')).not.toHaveClass(/is-active/);

    await page.locator('#discover-btn').click();
    await expect(page.locator('#discover-btn')).toHaveClass(/is-active/);
    await expect(page.locator('#foryou-btn')).not.toHaveClass(/is-active/);

    // View All is a TOOL view -> all three places dim.
    await page.locator('#view-all-btn').click();
    await expect(page.locator('#all-anime-view')).toBeVisible();
    await expect(page.locator('#den-btn')).not.toHaveClass(/is-active/);
    await expect(page.locator('#foryou-btn')).not.toHaveClass(/is-active/);
    await expect(page.locator('#discover-btn')).not.toHaveClass(/is-active/);
  });

  test('the Den button glides home in-page (no reload) and re-lights Den', async ({ page }) => {
    await page.goto('/');
    await page.locator('#discover-btn').click();
    await expect(page.locator('#discover-view')).toBeVisible();
    // Den button = soft in-page glide home (not the logo's hard reload).
    await page.locator('#den-btn').click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.locator('#discover-view')).toBeHidden();
    await expect(page.locator('#den-btn')).toHaveClass(/is-active/);
  });

  test('the dated folio line renders with today\'s date', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.den-folio')).toHaveCount(1);
    const folio = page.locator('#folio-date');
    await expect(folio).not.toBeEmpty();                 // set from new Date()
    await expect(folio).toContainText(String(new Date().getFullYear()));
  });

  test('the home hole-fill mount points render (AIRING NOW + For You strips)', async ({ page }) => {
    await page.goto('/');
    // AIRING NOW threshold band, inside the Den, between masthead and Top 10.
    const airing = page.locator('#home-airing-block');
    await expect(airing).toHaveCount(1);
    await expect(airing.locator('.discover-block-head')).toContainText('AIRING NOW');
    await expect(page.locator('.blakes-den #home-airing-block')).toHaveCount(1);   // inside the Den
    // For-You-on-home strip, after the Den, before Continue.
    await expect(page.locator('#home-foryou-block')).toHaveCount(1);
    await expect(page.locator('#home-foryou')).toHaveCount(1);
  });

  test('signed-out For-You-on-home is the honest "FROM HIS SHELF" taster, not a "For You" promise', async ({ page }) => {
    await page.goto('/');
    // Scrolling the strip into view fires its lazy build; the head is set synchronously
    // (before the trending fetch, which is fire-and-forget). Signed out => relabelled.
    await page.locator('#home-foryou-block').scrollIntoViewIfNeeded();
    await expect(page.locator('#home-foryou-head')).toContainText('FROM HIS SHELF');
    await expect(page.locator('#home-foryou-head')).not.toContainText('FOR YOU');
  });

  test('Latest Drop is demoted to a clean Den sub-item (kicker reworded, no panel blur)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#featured-drop .side-widget-kicker')).toContainText('LATEST DROP');
    // The boxed-panel backdrop blur is gone (perf + the integrated look).
    const filt = await page.locator('#featured-drop').evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.backdropFilter || cs.webkitBackdropFilter || 'none';
    });
    expect(filt).toBe('none');
  });
});
