// tests/v233-latest-drop-is-latest.spec.js
// <!-- author: Code | date: 2026-08-29 -->
// =============================================================================
// Blake published a new review, went to look at it, and it was not in the slot
// labelled "LATEST DROP 最新 / Now Featuring". Black Clover was.
//
// He was signed in. v1.8.4 gate 4 had made this slot personalized for signed-in
// members: most-recent favorite > most-recent watchlist > recent history > and
// only then the newest review. So the widget said LATEST DROP and showed a save.
// His words: "when it does I need it to show up on latest drop."
//
// v2.3.3: the pick is the newest catalog entry, unconditionally. This file pins
// BOTH sides of that — signed out (which already worked) and the signed-in case
// that actually bit him, which no test covered.
// =============================================================================
const { test, expect } = require('@playwright/test');

test.describe('LATEST DROP means latest', () => {
  test('the pick is the newest catalog entry, signed out', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window.rarDiscovery && window.rarDiscovery.pickFeaturedAnime),
      null, { timeout: 20000 });
    const out = await page.evaluate(() => {
      const list = Array.isArray(animeData) ? animeData : [];
      const f = window.rarDiscovery.pickFeaturedAnime();
      return { last: list[list.length - 1] && list[list.length - 1].Title, featured: f && f.Title };
    });
    expect(out.featured).toBe(out.last);
  });

  test('saves CANNOT steal the slot — the bug Blake hit', async ({ page }) => {
    // ⚠️ THE REGRESSION, checked against the function that is actually RUNNING.
    //
    // The obvious test — stuff window.favoritesSet and re-pick — proves nothing:
    // favoritesSet is module-scoped (script.js:229) and never exported, so the
    // mutation silently does nothing and the assertion passes either way. That is
    // the same shape of green-over-nothing that hid the dead Publish button, so it
    // is not used here. `Function.prototype.toString()` on the exported function
    // gives the live body, which is stronger than reading the file off the server.
    await page.goto('/');
    await page.waitForFunction(() => !!(window.rarDiscovery && window.rarDiscovery.pickFeaturedAnime),
      null, { timeout: 20000 });
    const out = await page.evaluate(() => ({
      body: window.rarDiscovery.pickFeaturedAnime.toString(),
      // and confirm the sets really are unreachable, so nobody "fixes" this test
      // later by mutating them and trusting the result
      favoritesReachable: typeof window.favoritesSet !== 'undefined',
    }));
    expect(out.favoritesReachable, 'the save sets are module-scoped, so a runtime mutation test would be fake').toBe(false);
    for (const dead of ['favoritesSet', 'watchlistSet', 'readContinue', 'currentUser', 'catalogBySlug']) {
      expect(out.body, `the live pickFeaturedAnime must not consult ${dead}`).not.toContain(dead);
    }
    expect(out.body, 'it returns the tail of the catalog').toContain('animeData.length - 1');
  });

  test('the pick is stable and equals the newest across repeat calls', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window.rarDiscovery && window.rarDiscovery.pickFeaturedAnime),
      null, { timeout: 20000 });
    const out = await page.evaluate(() => {
      const list = Array.isArray(animeData) ? animeData : [];
      const picks = [0, 1, 2].map(() => window.rarDiscovery.pickFeaturedAnime());
      return {
        newest: list.length ? list[list.length - 1].Title : null,
        titles: picks.map((p) => p && p.Title),
      };
    });
    expect(new Set(out.titles).size, 'the pick does not drift between calls').toBe(1);
    expect(out.titles[0]).toBe(out.newest);
  });

  test('the widget renders the newest review on the home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('#featured-drop-card .featured-name')?.textContent?.trim().length > 0,
      null, { timeout: 20000 });
    const out = await page.evaluate(() => ({
      kicker: document.querySelector('#featured-drop .side-widget-kicker')?.textContent || '',
      shown: document.querySelector('#featured-drop-card .featured-name')?.textContent?.trim(),
      newest: (Array.isArray(animeData) && animeData.length) ? animeData[animeData.length - 1].Title : null,
      img: document.querySelector('#featured-drop-card .featured-thumb')?.getAttribute('src') || '',
    }));
    expect(out.kicker).toContain('LATEST DROP');
    expect(out.shown, 'what it shows is what it says it shows').toBe(out.newest);
    expect(out.img, 'and it points at a real cover file').toMatch(/^assets\/.+\.(png|jpg|jpeg|webp|avif)$/i);
  });
});
