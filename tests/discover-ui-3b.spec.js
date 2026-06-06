const base = require('@playwright/test');
const { test, expect } = require('./welcomed.js');

// v1.8.4 (gate 3b) — the premium Discover pass + intro fixes. Deterministic/offline
// (the live-render polish — skeletons, hero shelf, carousel motion, datelines — is
// covered by the manual + node smoke; here we lock the wiring + the pure logic).
test.describe('v1.8.4 gate 3b — Discover UI + intro fixes', () => {
  test('toolbar active-state: one tab active at a time', async ({ page }) => {
    await page.goto('/');
    const discover = page.locator('#discover-btn');
    const viewAll = page.locator('#view-all-btn');
    await page.locator('#discover-btn').click();
    await expect(discover).toHaveClass(/is-active/);
    await expect(viewAll).not.toHaveClass(/is-active/);
    await page.locator('#view-all-btn').click();
    // v1.8.4 gate 5 — View All is a TOOL view now: it lights NO place (Den/For You/
    // Discover all dim). Replaces the old "View All is the active tab" behavior.
    await expect(discover).not.toHaveClass(/is-active/);
    await expect(viewAll).not.toHaveClass(/is-active/);
  });

  test('score-tier classes map by averageScore', async ({ page }) => {
    await page.goto('/');
    const tiers = await page.evaluate(() => {
      const mk = (score) => {
        const card = window.rarDiscovery.createDiscoveryCard({
          id: 990000 + (score || 0),
          title: { english: 'X' + score }, coverImage: { large: '' }, genres: [], averageScore: score,
        });
        return [...card.classList].find(c => c.startsWith('score-')) || null;
      };
      return { high: mk(90), midHi: mk(78), mid: mk(70), midLo: mk(65), low: mk(40), none: mk(0), nullS: mk(null) };
    });
    expect(tiers.high).toBe('score-high');
    expect(tiers.midHi).toBe('score-high');   // 78 is the high floor
    expect(tiers.mid).toBe('score-mid');
    expect(tiers.midLo).toBe('score-mid');     // 65 is the mid floor
    expect(tiers.low).toBe('score-low');
    expect(tiers.none).toBe('score-none');
    expect(tiers.nullS).toBe('score-none');
  });

  test('genres capped at top-2 per card', async ({ page }) => {
    await page.goto('/');
    const genre = await page.evaluate(() => {
      const card = window.rarDiscovery.createDiscoveryCard({
        id: 991111, title: { english: 'Y' }, coverImage: { large: '' },
        genres: ['Action', 'Adventure', 'Comedy', 'Drama'], averageScore: 70,
      });
      return card.querySelector('.card-genre').textContent;
    });
    expect(genre).toBe('Action, Adventure');   // top 2, not 3+
  });

  test('lens "Unreviewed" hides the gold Blake shelf (CSS rule)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#discover-btn').click();
    // Inject a fake Blake shelf + a wider-world divider into the results, then flip lenses.
    await page.evaluate(() => {
      const r = document.getElementById('discover-search-results');
      r.hidden = false;
      r.innerHTML = '<section class="discover-blake-shelf"><div class="dbs-head"></div></section>'
        + '<div class="discover-results-divider">wider</div>';
    });
    const shelf = page.locator('#discover-search-results .discover-blake-shelf');
    const wider = page.locator('#discover-search-results .discover-results-divider');
    // lens: all -> both visible
    await page.locator('#discover-reviewed .fr-seg[data-reviewed="all"]').click();
    await expect(shelf).toBeVisible();
    // lens: notyet -> shelf hidden
    await page.locator('#discover-reviewed .fr-seg[data-reviewed="notyet"]').click();
    await expect(shelf).toBeHidden();
    // lens: reviewed -> wider-world divider hidden, shelf back
    await page.locator('#discover-reviewed .fr-seg[data-reviewed="reviewed"]').click();
    await expect(shelf).toBeVisible();
    await expect(wider).toBeHidden();
  });
});

// First-visit door (no welcomed fixture) — verify the backdrop-click-dismiss is gone.
base.test.describe('v1.8.4 gate 3b — welcome door entry', () => {
  base.test('clicking the backdrop does NOT enter; Enter does', async ({ page }) => {
    await page.goto('/');
    const splash = page.locator('#welcome-splash');
    await expect(splash).toBeVisible();
    // Click the backdrop corner (not the Enter button) — door must stay.
    await splash.click({ position: { x: 6, y: 6 } });
    await expect(splash).toBeVisible();
    // The Enter button DOES enter.
    await page.locator('#welcome-enter').click();
    await expect(splash).toBeHidden();
  });
});
