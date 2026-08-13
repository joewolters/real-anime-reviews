// tests/v222-shelf-picker.spec.js
// <!-- author: Code | date: 2026-08-12 -->
// =============================================================================
// BANKED ITEM 6 — what the shelf picker leads with.
// Blake: "Watchlist tracker needs to autopopulic FIRSTly with things the user
// has either watched or already reviewed when building shelves. it makes the
// most logical sense."
//
// The picker itself needs a signed-in session and live Firestore, which a
// deterministic run cannot have — but the ORDERING is the promise, and that is
// pure logic driven by a source registry. These drive the real function.
//
// ⚠️ account.js bounces a signed-out visitor to index.html?signin=1. The
// redirect is neutralised with a 204 (the browser ignores a 204 navigation and
// stays put) rather than aborted — aborting kills the document and there is
// nothing left to measure.
// =============================================================================
const { test, expect } = require('@playwright/test');

const openAccount = async (page) => {
  await page.route((url) => url.href.includes('signin=1'), (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/account.html');
  await page.waitForFunction(() => !!window.rarShelfSources, null, { timeout: 20000 });
};

test('item 6: the picker leads with what they have reviewed, then their lists', async ({ page }) => {
  await openAccount(page);

  const out = await page.evaluate(() => {
    const s = window.rarShelfSources;
    // a title they reviewed that is ALSO in the catalog — the interesting case,
    // because it must be promoted out of the catalog tier, not listed twice.
    s._seedReviewed([{ animeId: 'one-punch-man', title: 'One punch man', coverImage: '', src: 'reviewed' }]);
    const rows = s.candidates();
    return {
      order: s.list.map((x) => x.key),
      firstSrc: rows[0].src,
      firstId: rows[0].animeId,
      firstCover: rows[0].coverImage,
      dupes: rows.filter((r) => r.animeId === 'one-punch-man').length,
      catalogIndex: rows.findIndex((r) => r.src === 'catalog'),
    };
  });

  // the registry IS the priority order — reviewed first, his exact ask
  expect(out.order[0], 'reviewed leads').toBe('reviewed');
  expect(out.order[1], 'then their own lists').toBe('saved');
  expect(out.order[2], 'then the rest of the site').toBe('catalog');

  expect(out.firstSrc, 'a reviewed title sorts above the catalog').toBe('reviewed');
  expect(out.firstId).toBe('one-punch-man');
  expect(out.catalogIndex, 'catalog titles come after it').toBeGreaterThan(0);
  // promoted, not duplicated
  expect(out.dupes, 'a reviewed catalog title appears ONCE').toBe(1);
  // a reviewed row carries no cover of its own — it borrows the catalog's, or
  // the top group would be a column of grey placeholders
  expect(out.firstCover, 'the top group still has cover art').toBeTruthy();
});

test('item 6: the source list is SWAPPABLE — order is data, not hard-coded', async ({ page }) => {
  // ⚠️ This is the requirement the brief cared about most: "Build the picker so
  // its source list is swappable" so the AniList sync plugs in instead of
  // needing a second picker. So the test proves ordering FOLLOWS the registry —
  // reorder the registry, and the output reorders with it.
  await openAccount(page);

  const out = await page.evaluate(() => {
    const s = window.rarShelfSources;
    s._seedReviewed([{ animeId: 'one-punch-man', title: 'One punch man', coverImage: '', src: 'reviewed' }]);
    const before = s.candidates()[0].src;

    // demote 'reviewed' to last purely by editing the registry + its rank map
    const list = s.list;
    const moved = list.splice(list.findIndex((x) => x.key === 'reviewed'), 1)[0];
    list.push(moved);
    s.rank.clear();
    list.forEach((x, i) => s.rank.set(x.key, i));
    const after = s.candidates()[0].src;

    // put it back so the page is left as found
    const back = list.splice(list.findIndex((x) => x.key === 'reviewed'), 1)[0];
    list.unshift(back);
    s.rank.clear();
    list.forEach((x, i) => s.rank.set(x.key, i));

    return { before, after, restored: s.candidates()[0].src };
  });

  expect(out.before, 'reviewed leads by default').toBe('reviewed');
  expect(out.after, 'moving it in the registry moves it in the list').not.toBe('reviewed');
  expect(out.restored, 'and it restores').toBe('reviewed');
});

test('item 6: a failed reviewed-read must never empty the picker', async ({ page }) => {
  // the reviewed tier is the only one that comes over the network. If it fails,
  // the picker still has their saves and the catalog — it must not go blank.
  await openAccount(page);
  const n = await page.evaluate(() => {
    window.rarShelfSources._seedReviewed([]);
    return window.rarShelfSources.candidates().length;
  });
  expect(n, 'the catalog still carries the picker').toBeGreaterThan(20);
});
