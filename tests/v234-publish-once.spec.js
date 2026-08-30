// tests/v234-publish-once.spec.js
// <!-- author: Code | date: 2026-08-30 -->
// =============================================================================
// Blake, after publishing his first review in months:
//   "publishing is always two steps"  → he presses Publish, someone rebuilds.
//   "a wrong filename would go live as a broken image with no warning"
//   "I posted a link with a review. Can the thumbnail of the review show up
//    instead of the entire page?"
//
// v2.3.4 answers all three. This file guards the parts that would fail SILENTLY.
//
// ⚠️ THE TRAP THE TOP-UP IS BUILT AROUND, and the reason this file exists:
// `animeData` is a top-level `const` in a CLASSIC script — a global LEXICAL
// binding, NOT `window.animeData`. script.js has 8 dual-source catalog read sites
// with inconsistent precedence (some window-first, some const-first) and ~25 more
// that read the bare const with no fallback. Assigning `window.animeData` would
// give a SPLIT-BRAIN catalog: the grid showing 45 while the deep-link router shows
// 46. The top-up therefore mutates the ONE array in place, and these tests pin
// that — a future "cleanup" that reassigns would half-work, which is worse than
// not working at all.
// =============================================================================
// The welcome door intercepts a cold visit, so the one test here that drives the
// UI uses the returning-visitor fixture (tests/welcomed.js seeds sessionStorage
// before any page loads). The source-level tests do not care either way.
const { test, expect } = require('./welcomed.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test.describe('one-step publishing — the live top-up', () => {
  test('the generated file ships its own build stamp and field list', async ({ page }) => {
    // Without these the top-up cannot ask "changed since when?" or copy a live doc
    // using the same names the generator emits.
    await page.goto('/');
    await page.waitForFunction(() => typeof animeData !== 'undefined', null, { timeout: 20000 });
    const out = await page.evaluate(() => ({
      stamp: typeof RAR_CATALOG_PUBLISHED_AT !== 'undefined' ? RAR_CATALOG_PUBLISHED_AT : null,
      fields: typeof RAR_CATALOG_FIELDS !== 'undefined' ? RAR_CATALOG_FIELDS : null,
      count: animeData.length,
    }));
    expect(out.stamp, 'a build stamp is shipped').toBeTruthy();
    expect(Number.isFinite(Date.parse(out.stamp)), 'and it is a real date').toBe(true);
    expect(Array.isArray(out.fields), 'the emitted field list is shipped').toBe(true);
    // it must cover the always-emitted fields, or a merged doc would lose columns
    for (const f of ['Title', 'Genre', 'Rating', 'image', 'Review', 'Tags', 'Platforms']) {
      expect(out.fields, `${f} is in the shipped field list`).toContain(f);
    }
    expect(out.fields, 'including the cover fallback').toContain('AniListCover');
    expect(out.count).toBeGreaterThan(0);
  });

  test('the field list matches the generator exactly', () => {
    // A hand-kept copy would drift; this proves the file was stamped by the same
    // ALWAYS/OPTIONAL the renderer emits from.
    const { ALWAYS, OPTIONAL } = require('../scripts/lib/catalog-model');
    const src = read('animeData.js');
    const m = src.match(/const RAR_CATALOG_FIELDS = (\[[^\]]*\]);/);
    expect(m, 'the field list is emitted into animeData.js').toBeTruthy();
    expect(JSON.parse(m[1])).toEqual([...ALWAYS, ...OPTIONAL]);
  });

  test('the top-up MUTATES the one array — it never reassigns or forks it', () => {
    const js = read('script.js');
    const start = js.indexOf('async function catalogTopUp()');
    expect(start, 'the top-up exists').toBeGreaterThan(-1);
    const body = js.slice(start, js.indexOf('\n  function init()', start));

    // the whole point: same array object, so all ~33 read sites agree
    expect(body, 'it appends in place').toMatch(/animeData\.push\(/);
    expect(body, 'and it never creates a second catalog on window')
      .not.toMatch(/window\.animeData\s*=/);
    expect(body, 'and it never reassigns the const (which would throw anyway)')
      .not.toMatch(/(^|[^.\w])animeData\s*=[^=]/m);

    // the memoized maps must be dropped or they keep answering from the old array
    for (const cache of ['_catalogBySlug', '_primaryIdToSlug', '_watchedIds']) {
      expect(body, `${cache} is invalidated after a merge`).toContain(cache + ' = null');
    }
    // and it must be cheap on a normal visit
    expect(body, 'an empty result returns before any re-render').toMatch(/snap\.empty\s*\)\s*return/);
  });

  test('the top-up can never break or delay the page', () => {
    const js = read('script.js');
    // not awaited at the call site, and it swallows its own failures
    expect(js, 'it is fire-and-forget').toMatch(/catalogTopUp\(\)\.catch\(\(\)\s*=>\s*\{\}\)/);
    const start = js.indexOf('async function catalogTopUp()');
    const body = js.slice(start, js.indexOf('\n  function init()', start));
    // every re-render is individually guarded — one throwing must not skip the rest
    const guarded = body.match(/try \{ (renderGrid|buildSpotlight|buildGenreRails|buildFeaturedDrop)/g) || [];
    expect(guarded.length, 'each re-render is wrapped').toBeGreaterThanOrEqual(4);
  });
});

test.describe('cover art fails loudly, not silently', () => {
  test('the publish script refuses a missing cover', () => {
    const js = read('scripts/catalog-publish.js');
    expect(js, 'there is a cover tripwire').toContain('Cover art');
    expect(js, 'it actually checks the filesystem').toMatch(/existsSync\(path\.join\(CV, 'assets'/);
    expect(js, 'a missing cover with no fallback refuses the publish').toContain('PUBLISH REFUSED — these would ship a broken image');
    expect(js, 'and it honours the same --force escape as the shrink tripwire').toMatch(/if \(!FORCE\)/);
  });

  test('a cover with a remote fallback warns instead of refusing', () => {
    const js = read('scripts/catalog-publish.js');
    // an anime that HAS an AniList cover renders correctly, so refusing would be
    // wrong — it is a "not uploaded yet", not a breakage.
    expect(js).toContain('remoteOnly');
    expect(js).toMatch(/the site will use the AniList image/);
  });

  test('cards fall back to the AniList cover before the placeholder', () => {
    const cr = read('card-render.js');
    expect(cr, 'the fallback URL rides on the element').toContain('data-fallback');
    expect(cr, 'the latch makes it loop-proof').toContain("data-fb");
    expect(cr, 'and the placeholder is still the last resort').toContain('PLACEHOLDER');
    // the featured slot is the one a brand-new review lands in, so it needs it too
    const js = read('script.js');
    const i = js.indexOf('featuredDropCard.innerHTML');
    const block = js.slice(i, i + 900);
    expect(block, 'the Latest Drop image has the same two-step fallback').toContain('data-fallback');
  });

  test('the admin page checks the cover instead of asserting it', () => {
    const js = read('admin/new-anime.js');
    expect(js, 'it probes the file').toContain('function coverExists');
    expect(js, 'and reports the real answer').toMatch(/not uploaded yet/);
    expect(js, 'the AniList cover is stored so there is always a picture').toContain('fields.AniListCover');
    expect(js, 'and it no longer claims a rebuild is needed').not.toContain('once the site is rebuilt and deployed');
  });
});

test.describe('link previews — a shared review shows the review', () => {
  test('there is a server-answerable path, because a # never reaches a server', () => {
    const cfg = JSON.parse(read('firebase.json'));
    const rw = (cfg.hosting.rewrites || []).find((r) => r.source === '/anime/**');
    expect(rw, 'the /anime/** route exists').toBeTruthy();
    expect(rw.function.functionId).toBe('animePreview');
    // the ignore array is the leak guard — prove the rewrite edit did not disturb it
    expect(cfg.hosting.ignore, 'PERSONAL.md is still firebase-ignored').toContain('PERSONAL.md');
    expect(cfg.hosting.ignore, 'and so is the update log').toContain('UpdateLog/**');
  });

  test('the preview function serves per-anime tags and never hard-404s', () => {
    const js = read('functions/index.js');
    expect(js, 'the function exists').toContain('exports.animePreview');
    expect(js, 'it reads the live catalog, so a fresh publish previews immediately')
      .toMatch(/collection\('catalog'\)\.doc\(slug\)/);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) {
      expect(js, `it emits ${tag}`).toContain(tag);
    }
    expect(js, 'an unknown slug still returns a page').toContain('res.status(200)');
    expect(js, 'humans are bounced into the app').toContain('location.replace(');
    expect(js, 'and people without JS still get a link').toContain('<noscript>');
    expect(js, 'the slug is validated before it touches Firestore').toMatch(/\^\[a-z0-9-\]\{1,120\}\$/);
  });

  test('the modal offers the shareable URL, not the fragment one', async ({ page }) => {
    const js = read('script.js');
    expect(js, 'the button exists on reviewed titles').toContain('data-share-anime');
    const i = js.indexOf("closest('[data-share-anime]')");
    expect(i, 'and it is wired').toBeGreaterThan(-1);
    // Assert on the URL-CONSTRUCTION LINE itself, not a slice around it: the
    // comment above this handler necessarily says "#anime=" (it explains why that
    // form cannot preview), so a windowed search would match prose and pass or
    // fail for the wrong reason.
    const urlLine = js.slice(i, i + 600).split('\n').find((l) => /const url =/.test(l)) || '';
    expect(urlLine, 'it builds the PATH form').toContain("'/anime/'");
    expect(urlLine, 'and no fragment, which a server never receives').not.toContain('#');

    // And it renders. ⚠️ TWO traps here, both of which made this test lie at first:
    //   1. The deep-link route runs at LOAD ONLY — script.js has no `hashchange`
    //      listener — so the hash must be present in the URL that is loaded.
    //   2. Navigating from '/' to '/#anime=x' is a SAME-DOCUMENT navigation: no
    //      reload happens, so the route never fires. The query param forces a real
    //      load. Without it this waits 20s and fails while the app is fine.
    await page.goto('/');
    const slug = await page.evaluate(() => {
      const a = animeData[animeData.length - 1];
      return String(a.Title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    });
    await page.goto('/?deeplink=1#anime=' + slug);
    await page.waitForSelector('.modal-share-btn', { timeout: 20000 });
    const label = await page.textContent('.modal-share-btn');
    expect(label.trim()).toBe('Copy share link');
  });
});
