// Returning-visitor fixture (clicks need the welcome door dismissed).
const { test, expect } = require('./welcomed.js');

// v1.8.4 (gate 4) — the For You surface. Like the Discover spec, every assertion is
// synchronous DOM/wiring or the PURE taste engine (window.rarDiscovery.computeTasteProfile),
// so the suite stays deterministic — the rails' live AniList fetch is fire-and-forget and
// not awaited here. Signed-in DOM rail assertions need Firebase auth, so they live with the
// live-data verification (node canary + manual smoke), not in this offline suite; the engine
// invariants below prove the heart-protective structure (every rail has a gold lead).

// NOTE: slug() is defined INSIDE each page.evaluate (it runs in the browser) — a
// function can't be passed as a serializable evaluate arg. Doc ids for catalog saves
// are slug(Title), matching script.js/card-render.js.
test.describe('v1.8.4 For You surface', () => {
  test('For You is reachable, swaps the view, and is mutually exclusive with Discover', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#for-you-view')).toBeHidden();
    await page.locator('#foryou-btn').click();
    await expect(page.locator('#for-you-view')).toBeVisible();
    await expect(page.locator('#home-view')).toBeHidden();
    await expect(page.locator('#foryou-btn')).toHaveClass(/is-active/);

    // Opening Discover leaves For You (one surface at a time).
    await page.locator('#discover-btn').click();
    await expect(page.locator('#for-you-view')).toBeHidden();
    await expect(page.locator('#discover-view')).toBeVisible();
    await expect(page.locator('#foryou-btn')).not.toHaveClass(/is-active/);

    // View All leaves both.
    await page.locator('#view-all-btn').click();
    await expect(page.locator('#for-you-view')).toBeHidden();
    await expect(page.locator('#foryou-btn')).not.toHaveClass(/is-active/);
  });

  test('opening For You enables the panel\'s "Unreviewed" segment; leaving disables it', async ({ page }) => {
    await page.goto('/');
    const notyet = page.locator('#filter-reviewed .fr-seg[data-reviewed="notyet"]');
    await expect(notyet).toBeDisabled();           // catalog default
    await page.locator('#foryou-btn').click();
    await expect(notyet).toBeEnabled();            // For You has outside cards
    await page.locator('#view-all-btn').click();
    await expect(notyet).toBeDisabled();           // back to catalog-only
  });

  test('signed-out For You: honest Trending block + a branded sign-in nudge, lens hidden', async ({ page }) => {
    await page.goto('/');
    await page.locator('#foryou-btn').click();
    // The Trending block scaffold is synchronous (its rail content fetches live, not awaited).
    await expect(page.locator('#foryou-trending-block')).toBeVisible();
    // The sign-in nudge is rendered via the branded empty-card vocabulary.
    const cta = page.locator('#foryou-sections .se-cta');
    await expect(cta).toContainText('Sign in to build your shelf');
    // No fake personalization control on the signed-out state.
    await expect(page.locator('#foryou-lens')).toBeHidden();
  });

  test('the lens is the relabeled curator lens (same data-reviewed values as Discover)', async ({ page }) => {
    await page.goto('/');
    const segs = page.locator('#foryou-lens .fr-seg');
    await expect(segs).toHaveCount(3);
    await expect(segs.nth(0)).toHaveText('The Blend');
    await expect(segs.nth(1)).toHaveText('Blake’s picks');
    await expect(segs.nth(2)).toHaveText('The world');
    // Values unchanged so the CSS-only lens mechanism + setFilterHasOutsideCards work untouched.
    await expect(segs.nth(0)).toHaveAttribute('data-reviewed', 'all');
    await expect(segs.nth(1)).toHaveAttribute('data-reviewed', 'reviewed');
    await expect(segs.nth(2)).toHaveAttribute('data-reviewed', 'notyet');
  });

  test('taste engine: empty saves do not qualify (no fake personalization)', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => window.rarDiscovery.computeTasteProfile({ favorites: [], watchlist: [], recent: [] }));
    expect(out.totalScored).toBe(0);
    expect(out.qualifies).toBe(false);
    expect(out.rails.length).toBe(0);
  });

  test('taste engine: real catalog favorites produce gold-led rails; al:<id> saves are excluded; cap is 3', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const list = (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData : [];
      if (list.length < 6) return { skip: true };
      const favs = list.slice(0, 6).map((a) => slug(a.Title));
      // add an outside (al:) save — it must contribute NOTHING to taste.
      const profile = window.rarDiscovery.computeTasteProfile({ favorites: [...favs, 'al:999999001'], watchlist: [], recent: [] });
      return {
        skip: false,
        totalScored: profile.totalScored,
        qualifies: profile.qualifies,
        railCount: profile.rails.length,
        everyRailHasGoldLead: profile.rails.every((r) => r.catalogCount > 0),
        everyRailHasSavedEntry: profile.rails.every((r) => r.savedEntries.length > 0),
        railGenres: profile.rails.map((r) => r.genre),
      };
    });
    expect(out.skip).toBe(false);
    expect(out.totalScored).toBe(6);                 // the al:<id> save did NOT count
    expect(out.qualifies).toBe(true);
    expect(out.railCount).toBeGreaterThanOrEqual(1);
    expect(out.railCount).toBeLessThanOrEqual(3);    // TASTE_RAIL_CAP
    expect(out.everyRailHasGoldLead).toBe(true);     // the hard heart rule: no rail without a gold lead
    expect(out.everyRailHasSavedEntry).toBe(true);
  });

  test('taste engine: a single save does not clear the floor (min-saves threshold)', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const list = (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData : [];
      if (!list.length) return { skip: true };
      const one = slug(list[0].Title);
      const p = window.rarDiscovery.computeTasteProfile({ favorites: [], watchlist: [one], recent: [] });
      return { skip: false, totalScored: p.totalScored, qualifies: p.qualifies };
    });
    expect(out.skip).toBe(false);
    expect(out.totalScored).toBe(1);
    expect(out.qualifies).toBe(false);               // 1 watchlist save (weight 2) < floor + min-saves
  });

  test('pickFeaturedAnime signed-out returns the latest drop', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const list = (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData : [];
      const featured = window.rarDiscovery.pickFeaturedAnime();
      return { lastTitle: list[list.length - 1] && list[list.length - 1].Title, featuredTitle: featured && featured.Title };
    });
    expect(out.featuredTitle).toBe(out.lastTitle);   // signed out => latest entry (unchanged behavior)
  });

  test('carry-over: the Continue rail has vertical room so a hover-scaled card is not clipped', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'continue-row';
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const res = { padTop: cs.paddingTop, padBottom: cs.paddingBottom, hasMask: (cs.maskImage || cs.webkitMaskImage || 'none') !== 'none' };
      el.remove();
      return res;
    });
    expect(out.padTop).toBe('24px');                 // was 16px — gave the glow/scale room
    expect(out.padBottom).toBe('24px');
    expect(out.hasMask).toBe(true);                  // soft edge so the clip dissolves
  });
});
