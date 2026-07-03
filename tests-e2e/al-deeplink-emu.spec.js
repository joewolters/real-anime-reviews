const { test, expect } = require('../tests/welcomed');

// milestone E rider — the al: DEEP-LINK landing, deterministic at last. The
// live-AniList rule keeps real fetches out of the suites (429s/outages made
// every earlier attempt flaky), so this spec STUBS graphql.anilist.co with
// page.route: the secondary deep-dive must open from the canned detail and
// mount its al:<id> season room (rooms are WATCHED-gated, so the spec picks a
// watched-but-not-primary id from the catalog at runtime — a primary id would
// route to Blake's main modal instead, by design).
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
test.describe('milestone E — al: deep-link landing (AniList stubbed)', () => {
  test('#secondary=<watched id> opens the deep-dive from the stub + mounts the al: room', async ({ page }) => {
    const STUB_TITLE = 'Stubbed Season (deterministic)';
    await page.route('https://graphql.anilist.co/**', async (route) => {
      let id = 0;
      try { id = Number((JSON.parse(route.request().postData() || '{}').variables || {}).id) || 0; } catch (_) {}
      const media = {
        id, idMal: null, format: 'TV', episodes: 12, duration: 24, status: 'FINISHED',
        season: 'SPRING', seasonYear: 2024, averageScore: 84, popularity: 12345, favourites: 10,
        title: { romaji: STUB_TITLE, english: STUB_TITLE, native: 'スタブ' },
        coverImage: { extraLarge: '', large: '', medium: '', color: '#bb86fc' },
        bannerImage: '', description: 'A deterministic stub for the e2e landing.',
        genres: ['Action'], studios: { nodes: [{ name: 'Stub Works' }], edges: [] },
        trailer: null, nextAiringEpisode: null, externalLinks: [],
        relations: { edges: [] }, recommendations: { nodes: [] },
        characters: { edges: [], nodes: [] }, staff: { edges: [], nodes: [] },
      };
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { Media: media, Page: { media: [], characters: [], staff: [] } } }),
      });
    });

    await page.goto('/index.html?emu=1');
    await page.waitForFunction(() => Array.isArray(window.animeData) || typeof animeData !== 'undefined', null, { timeout: 15000 });
    // a watched id that is NOT any entry's primary AniListId → the secondary route
    const alId = await page.evaluate(() => {
      const data = Array.isArray(window.animeData) ? window.animeData
        : (typeof animeData !== 'undefined' ? animeData : []);
      const primaries = new Set(data.map((a) => Number(a.AniListId)).filter(Boolean));
      for (const a of data) {
        for (const w of (a.WatchedAniListIds || [])) {
          if (!primaries.has(Number(w))) return Number(w);
        }
      }
      return null;
    });
    expect(alId).not.toBeNull();

    // distinct query → a REAL navigation (a same-URL hash goto skips the boot
    // route entirely — the hash router runs once, at boot)
    await page.goto(`/index.html?emu=1&fresh=1#secondary=${alId}`);
    await expect(page.locator('.secondary-layer.active')).toBeVisible({ timeout: 20000 });
    // the stubbed detail rendered (not the error state)
    await expect(page.locator('.secondary-layer .secondary-title')).toContainText('Stubbed Season', { timeout: 20000 });
    // the al: season room mounts, keyed to the id (watched-gated by design)
    await page.waitForSelector(`[id="comments-list-al:${alId}"]`, { timeout: 20000 });
  });
});
