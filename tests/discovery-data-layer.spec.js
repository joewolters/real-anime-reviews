const { test, expect } = require('@playwright/test');

// v1.8.4 (gate 1) — the discovery data layer (the 3 flat AniList queries +
// caches that feed For You / Discover) must be wired into the page and shaped
// right. The LIVE 101922 canary lives in scripts/anilist-discovery-canary.js
// (run separately — kept out of this suite so it stays deterministic + offline).
// Here we assert: the franchiseFetch discovery API exists, the query strings
// carry the correct AniList filters, the script.js cached entry points are
// exposed on window.rarDiscovery, and normalizeListMedia is a pure card-shaper.
test.describe('v1.8.4 discovery data layer', () => {
  test('franchiseFetch exposes the 3 discovery fetchers + normalizer', async ({ page }) => {
    await page.goto('/');
    const api = await page.evaluate(() => {
      const f = window.franchiseFetch || {};
      return {
        search: typeof f.searchMediaList,
        trending: typeof f.fetchTrendingList,
        airing: typeof f.fetchAiringList,
        normalize: typeof f.normalizeListMedia,
      };
    });
    expect(api).toEqual({ search: 'function', trending: 'function', airing: 'function', normalize: 'function' });
  });

  test('discovery query strings carry the correct AniList filters', async ({ page }) => {
    await page.goto('/');
    const q = await page.evaluate(() => {
      const f = window.franchiseFetch;
      return { search: f.SEARCH_QUERY, trending: f.TRENDING_QUERY, airing: f.AIRING_QUERY };
    });
    // SEARCH: a search param sorted by best match, anime only, no adult.
    expect(q.search).toContain('search: $search');
    expect(q.search).toContain('sort: SEARCH_MATCH');
    expect(q.search).toContain('type: ANIME');
    expect(q.search).toContain('isAdult: false');
    // TRENDING: trending sort, anime only.
    expect(q.trending).toContain('sort: TRENDING_DESC');
    expect(q.trending).toContain('type: ANIME');
    // AIRING: currently releasing, optional genre filter, trending order.
    expect(q.airing).toContain('status: RELEASING');
    expect(q.airing).toContain('genre: $genre');
    expect(q.airing).toContain('sort: TRENDING_DESC');
    // All three pull the shared card fields (one normalizer / one mapper).
    for (const s of [q.search, q.trending, q.airing]) {
      expect(s).toContain('coverImage');
      expect(s).toContain('averageScore');
      expect(s).toContain('genres');
    }
  });

  test('normalizeListMedia produces the card shape and drops junk nodes', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const f = window.franchiseFetch;
      const good = f.normalizeListMedia({
        id: 101922,
        title: { romaji: 'Kimetsu no Yaiba', english: 'Demon Slayer', native: '鬼滅の刃' },
        coverImage: { large: 'x.jpg', color: '#abc' },
        averageScore: 84, genres: ['Action', 'Adventure'], seasonYear: 2019,
        format: 'TV', status: 'FINISHED', episodes: 26,
      });
      return {
        good,
        nullNode: f.normalizeListMedia(null),
        noId: f.normalizeListMedia({ title: { romaji: 'x' } }),
        // defensive defaulting on a sparse node
        sparse: f.normalizeListMedia({ id: 5 }),
      };
    });
    expect(out.good.id).toBe(101922);
    expect(out.good.title.english).toBe('Demon Slayer');
    expect(out.good.genres).toEqual(['Action', 'Adventure']);
    expect(out.good.averageScore).toBe(84);
    expect(out.nullNode).toBeNull();
    expect(out.noId).toBeNull();         // no id => junk, dropped
    expect(out.sparse.id).toBe(5);
    expect(out.sparse.genres).toEqual([]); // arrays default to []
    expect(out.sparse.averageScore).toBeNull();
  });

  test('script.js exposes the cached discovery entry points', async ({ page }) => {
    await page.goto('/');
    const d = await page.evaluate(() => {
      const r = window.rarDiscovery || {};
      return {
        trending: typeof r.fetchTrendingCached,
        airing: typeof r.fetchAiringCached,
        search: typeof r.searchDiscover,
      };
    });
    expect(d).toEqual({ trending: 'function', airing: 'function', search: 'function' });
  });

  test('empty search short-circuits to [] with no network call', async ({ page }) => {
    await page.goto('/');
    const results = await page.evaluate(async () => {
      const f = window.franchiseFetch;
      return {
        empty: await f.searchMediaList(''),
        whitespace: await f.searchMediaList('   '),
      };
    });
    expect(results.empty).toEqual([]);
    expect(results.whitespace).toEqual([]);
  });
});
