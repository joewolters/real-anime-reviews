// Returning-visitor fixture (clicks need the welcome door dismissed).
const { test, expect } = require('./welcomed.js');

// v1.8.4 (gate 3) — the Discover surface. The rails fetch live AniList in the
// background when the surface opens (not awaited here); these assertions are all
// synchronous DOM/wiring + the PURE ranking/shuffle functions, so the suite stays
// deterministic. The live relevance proof ("demon slayer") is in the node canary.
test.describe('v1.8.4 Discover surface', () => {
  test('Discover is reachable and swaps the view', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#discover-view')).toBeHidden();
    await page.locator('#discover-btn').click();
    await expect(page.locator('#discover-view')).toBeVisible();
    await expect(page.locator('#home-view')).toBeHidden();
    await expect(page.locator('#discover-btn')).toHaveClass(/is-active/);
    // Leaving Discover (View All) hides it again.
    await page.locator('#view-all-btn').click();
    await expect(page.locator('#discover-view')).toBeHidden();
    await expect(page.locator('#discover-btn')).not.toHaveClass(/is-active/);
  });

  test('opening Discover enables the panel\'s "Unreviewed" segment; leaving disables it', async ({ page }) => {
    await page.goto('/');
    const notyet = page.locator('#filter-reviewed .fr-seg[data-reviewed="notyet"]');
    await expect(notyet).toBeDisabled();             // catalog default
    await expect(notyet).toHaveText('Unreviewed');   // gate-3 rename applied
    await page.locator('#discover-btn').click();
    await expect(notyet).toBeEnabled();              // Discover has outside cards
    await page.locator('#view-all-btn').click();
    await expect(notyet).toBeDisabled();             // back to catalog-only
  });

  test('the 3-way lens toggles the CSS filter class', async ({ page }) => {
    await page.goto('/');
    await page.locator('#discover-btn').click();
    const view = page.locator('#discover-view');
    const lens = page.locator('#discover-reviewed');
    await expect(view).toHaveClass(/lens-all/);
    await lens.locator('.fr-seg[data-reviewed="reviewed"]').click();
    await expect(view).toHaveClass(/lens-reviewed/);
    await lens.locator('.fr-seg[data-reviewed="notyet"]').click();
    await expect(view).toHaveClass(/lens-notyet/);
  });

  test('rankDiscoverResults: his 44 pin first + exact-title boost over a short', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const list = (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData : [];
      const cat = list.find(a => a.AniListId);
      const catId = cat && cat.AniListId;
      // Mimic AniList's messy SEARCH_MATCH order: a weak short ranked #1, the real
      // title #2 (both NON-catalog so they land in the wider world), plus one of
      // Blake's catalog ids somewhere in the middle (must pin).
      const results = [
        { id: 900001, title: { english: 'Onigiri', romaji: 'Onigiri' }, coverImage: { large: '' }, genres: [], averageScore: 50 },
        { id: 900002, title: { english: 'Demon Slayer: Kimetsu no Yaiba', romaji: 'Kimetsu no Yaiba' }, coverImage: { large: '' }, genres: [], averageScore: 84 },
        { id: Number(catId), title: { english: (cat && cat.Title) || 'Cat' }, coverImage: { large: '' }, genres: [], averageScore: 70 },
      ];
      const ranked = window.rarDiscovery.rankDiscoverResults(results, 'demon slayer');
      return {
        catId: Number(catId),
        pinnedIds: ranked.pinned.map(m => m.id),
        outsideTop: ranked.outside[0] && ranked.outside[0].id,
        outsideIds: ranked.outside.map(m => m.id),
      };
    });
    // The catalog id is pinned (in his 44), not in the wider-world list.
    expect(out.pinnedIds).toContain(out.catId);
    expect(out.outsideIds).not.toContain(out.catId);
    // The boost lifts the long exact-ish title above the weak short "Onigiri".
    expect(out.outsideTop).toBe(900002);
  });

  test('freshness seed: deterministic within a session, seededShuffle is stable', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const seedA = window.rarDiscovery.freshSeed();
      const seedB = window.rarDiscovery.freshSeed();        // same session => same seed
      const pool = Array.from({ length: 20 }, (_, i) => i);
      const s1 = window.rarDiscovery.seededShuffle(pool, 12345);
      const s2 = window.rarDiscovery.seededShuffle(pool, 12345);
      const s3 = window.rarDiscovery.seededShuffle(pool, 99999);
      return {
        seedStable: seedA === seedB,
        sameSeedSameOrder: JSON.stringify(s1) === JSON.stringify(s2),
        diffSeedDiffOrder: JSON.stringify(s1) !== JSON.stringify(s3),
        isPermutation: JSON.stringify([...s1].sort((a, b) => a - b)) === JSON.stringify(pool),
      };
    });
    expect(out.seedStable).toBe(true);
    expect(out.sameSeedSameOrder).toBe(true);
    expect(out.diffSeedDiffOrder).toBe(true);
    expect(out.isPermutation).toBe(true);
  });
});
