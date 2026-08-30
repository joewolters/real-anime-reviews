// tests/v235-share-layout-and-seasons.spec.js
// <!-- author: Code | date: 2026-08-30 -->
// =============================================================================
// Blake, looking at the new share button on a review:
//   "looks uneven. Make sure it looks good on mobile too. Also make sure this is
//    possible with seasonal reviews."
//
// He was right on all three:
//   1. The button was `display:inline-flex`. An inline box only centres if its
//      PARENT is text-align:center, and this modal does not centre its children —
//      .modal-title and .modal-romaji each carry their own text-align. So it
//      left-aligned under a centred title and read as crooked.
//   2. It was ~28px tall — below the ~44px both Apple and Material want for a tap
//      target — and nothing pinned it against overflow on a 360px screen.
//   3. Season reviews (the secondary layer, keyed by AniList id) had no share at
//      all, so the one surface with NO catalog slug could not be shared.
//
// The centring is a real geometry assertion, not a CSS-string check: reading back
// `display:flex` would have passed against the broken version too.
// =============================================================================
const { test, expect } = require('./welcomed.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// The deep-link route runs at LOAD ONLY (no hashchange listener), and '/' -> '/#x'
// is a same-document navigation that never reloads — so the hash must ride a URL
// that actually loads. The query param forces that.
const openNewest = async (page) => {
  await page.goto('/');
  const slug = await page.evaluate(() => {
    const a = animeData[animeData.length - 1];
    return String(a.Title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  });
  await page.goto('/?deeplink=1#anime=' + slug);
  await page.waitForSelector('.modal-share-btn', { timeout: 20000 });
};

const centreOf = (box) => Math.round(box.x + box.width / 2);

test.describe('the share button is not crooked', () => {
  for (const vp of [{ name: 'desktop', width: 1280, height: 900 },
                    { name: 'phone', width: 360, height: 780 }]) {
    test(`it centres with the title on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openNewest(page);
      const out = await page.evaluate(() => {
        const r = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { x: b.left, width: b.width, height: b.height, right: b.right };
        };
        return {
          btn: r('.modal-share-btn'),
          title: r('.modal-title'),
          romaji: r('.modal-romaji'),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          vw: window.innerWidth,
        };
      });
      expect(out.btn, 'the button is rendered').toBeTruthy();
      expect(out.title, 'and so is the title it must line up with').toBeTruthy();

      // ⚠️ the real assertion. Under the old inline-flex it sat hard against the
      // left edge of the text column, tens of px off the title's centre.
      expect(Math.abs(centreOf(out.btn) - centreOf(out.title)),
        'the button centre matches the title centre').toBeLessThanOrEqual(2);
      if (out.romaji) {
        expect(Math.abs(centreOf(out.btn) - centreOf(out.romaji)),
          'and the subtitle centre too').toBeLessThanOrEqual(2);
      }

      expect(out.overflow, 'the page never scrolls sideways because of it').toBe(false);
      expect(out.btn.right, 'and it stays inside the viewport').toBeLessThanOrEqual(out.vw);
    });
  }

  test('on a phone it is a real tap target', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await openNewest(page);
    const h = await page.evaluate(() =>
      document.querySelector('.modal-share-btn').getBoundingClientRect().height);
    // Apple's HIG and Material both land on ~44px. It was ~28px.
    expect(Math.round(h), 'at least 44px tall on a phone').toBeGreaterThanOrEqual(44);
  });

  test('it copies the path form and says so', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openNewest(page);
    await page.click('.modal-share-btn');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied, 'a real path a server can answer').toMatch(/\/anime\/[a-z0-9-]+$/);
    expect(copied, 'never the fragment form, which never reaches a server').not.toContain('#');
    await expect(page.locator('.modal-share-btn')).toHaveText(/copied/i);
  });
});

test.describe('season reviews can be shared too', () => {
  test('the season layer has a share button that yields /season/<id>', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    // a watched-but-not-primary AniList id IS what the secondary layer renders
    const id = await page.evaluate(() => {
      for (const a of animeData) {
        for (const w of (a.WatchedAniListIds || [])) if (w && w !== a.AniListId) return w;
      }
      return null;
    });
    expect(id, 'the catalog has a season to open').toBeTruthy();

    await page.goto('/?deeplink=1#secondary=' + id);
    await page.waitForSelector('[data-share-season]', { timeout: 25000 });
    expect(await page.getAttribute('[data-share-season]', 'data-share-season')).toBe(String(id));

    await page.click('[data-share-season]');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied, 'the season path, not the anime one').toMatch(new RegExp('/season/' + id + '$'));
    expect(copied).not.toContain('#');
  });

  test('on a phone the season pill collapses BUT still shows the confirmation', async ({ page, context }) => {
    // ⚠️ The header pills collapse to a 38px icon and hide their label ≤900px.
    // Without the .is-copied escape the "Link copied" text would be display:none,
    // so on a phone the button would look like it did nothing at all.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    const id = await page.evaluate(() => {
      for (const a of animeData) {
        for (const w of (a.WatchedAniListIds || [])) if (w && w !== a.AniListId) return w;
      }
      return null;
    });
    await page.goto('/?deeplink=1#secondary=' + id);
    await page.waitForSelector('[data-share-season]', { timeout: 25000 });

    const before = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.secondary-share-label')).display);
    expect(before, 'the label is hidden at rest on a phone').toBe('none');

    await page.click('[data-share-season]');
    const during = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.secondary-share-label')).display);
    expect(during, 'but visible while it confirms').not.toBe('none');

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, 'and the expanded pill does not push the page sideways').toBe(false);
  });

  test('ONE handler serves both buttons', () => {
    const js = read('script.js');
    // two copies would drift; the only difference is the path prefix
    expect(js).toContain("closest('[data-share-anime], [data-share-season]')");
    expect(js, 'the prefix is chosen, not duplicated').toContain("(season ? '/season/' : '/anime/')");
  });
});

test.describe('the server can answer a season link', () => {
  test('/season/** is routed to the same preview function', () => {
    const cfg = JSON.parse(read('firebase.json'));
    const sources = (cfg.hosting.rewrites || []).map((r) => r.source);
    expect(sources).toContain('/anime/**');
    expect(sources).toContain('/season/**');
    for (const r of cfg.hosting.rewrites) expect(r.function.functionId).toBe('animePreview');
    // the leak guard must survive every firebase.json edit
    expect(cfg.hosting.ignore).toContain('PERSONAL.md');
    expect(cfg.hosting.ignore).toContain('UpdateLog/**');
  });

  test('the function builds a season card from the review plus AniList art', () => {
    const js = read('functions/index.js');
    expect(js, 'it knows the two routes apart').toContain('isSeason');
    expect(js, 'it reads the season head').toContain("collection('seasonReviews')");
    expect(js, "and Blake's prose from the content child").toMatch(/collection\('content'\)\.doc\('body'\)/);
    // a season review stores NO cover, and a crawler cannot follow an onerror,
    // so the art has to be resolved server-side
    expect(js, 'it fetches the cover').toContain('graphql.anilist.co');
    expect(js, 'and the canonical points at the right route').toContain("isSeason ? 'season' : 'anime'");
    expect(js, 'humans land back in the season layer').toContain("'/#secondary='");
  });

  test('an AniList HTML synopsis is stripped before it becomes a card', () => {
    // AniList descriptions are HTML. Raw <br> in an og:description renders as
    // literal "<br>" in the Discord card.
    const src = read('functions/index.js');
    const s = src.indexOf('const PREVIEW_ORIGIN');
    const e = src.indexOf('async function aniListSeason');
    const f = new Function(src.slice(s, e) + '; return { previewBlurb };')();
    const out = f.previewBlurb({ Description: 'Maki <i>finally</i> speaks.<br><br>Then &amp; there.' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('&amp;');
    expect(out).toContain('Maki finally speaks.');
  });
});
