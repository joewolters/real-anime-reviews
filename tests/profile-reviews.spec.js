// PART A item 2 — the profile reviews rework.
// <!-- author: Code | date: 2026-08-10 -->
// Blake: "Users can pin one review and other users now have to click a button
// that brings up a separate sheet of all the reviews a user has made so it
// doesn't take up the entire profile."
//
// Static contracts for the logic (the rarNav wiring is where the two documented
// HIGH races live) + REAL PIXELS for the new CSS, mounted as the exact markup
// the renderer emits. A live-data walk belongs to the emulator e2e track.
const { test, expect } = require('@playwright/test');

const SRC = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'script.js'), 'utf8');

// Assert on a BOOLEAN, not on SRC: a failed `expect(SRC).toContain(...)` prints
// all 12k lines of script.js into the report, which buries the one line that
// actually matters.
const has = (hay, needle, why) => expect(hay.includes(needle), why || needle).toBe(true);
const lacks = (hay, needle, why) => expect(hay.includes(needle), why || needle).toBe(false);

test('the one-tab tablist is gone — not restyled, gone', async () => {
  // LAST CALL A8 removed the Threads tab and left a tablist of ONE tab
  // controlling no tabpanel. That promises a screen-reader user a set of tabs
  // to arrow between, and there was only ever one. A heading is what it was.
  lacks(SRC, 'class="profile-acts"');
  lacks(SRC, 'data-profile-acts');
  lacks(SRC, 'profile-act-chip');
  expect(SRC).not.toMatch(/role="tablist" aria-label="Their activity"/);
  // and the loader that fed it is gone with it
  lacks(SRC, 'function showAct');
});

test('the profile shows the pinned review plus ONE door to the rest', async () => {
  has(SRC, 'profile-featured-slot', 'the pinned pick still leads');
  has(SRC, 'profile-reviews-slot');
  has(SRC, 'data-reviews-open');
  has(SRC, "'all reviews (' + n + ')</button>'", 'the door is labelled with the count');
  // the door speaks the shelves' existing language on this same sheet
  expect(SRC).toMatch(/profile-col-viewall profile-reviews-open/);
  // no reviews -> no door, and an honest line instead of an empty button
  has(SRC, 'No reviews yet.');
});

test('the all-reviews view reuses the profile sheet — it is not a second layer', async () => {
  has(SRC, 'profile-reviews-view');
  // the body is HIDDEN, never rebuilt: every listener already bound to it (the
  // Appreciate button above all) has to survive the round trip
  has(SRC, 'bodyEl.hidden = true');
  has(SRC, 'bodyEl.hidden = false');
  expect(SRC).not.toMatch(/document\.body\.appendChild\([a-zA-Z]*[Rr]eviews/);
});

test('rarNav: the reviews view is its own step, and Back never close-then-pushes', async () => {
  // The two documented HIGH races. A synchronous close-then-push raced the
  // queued history.go(); consumption + popstate is the only safe order.
  has(SRC, "rarNavPush('profileReviews'");
  has(SRC, "rarNavConsume('profileReviews')");
  has(SRC, "top.type === 'profileReviews'");
  // closing the whole sheet must consume BOTH entries or Back walks a dead step
  has(SRC, "rarNavUnwindWhile(['profileReviews', 'profile'])");
  // ...and swapping profile→profile drops the outgoing sheet's reviews step
  expect(SRC).toMatch(/rarNavUnwindWhile\('profileReviews'\);[\s\S]{0,200}rarNavSuppress = true/);
});

test('the deep link splits /reviews BEFORE decoding, so %2F can never forge it', async () => {
  const block = SRC.slice(SRC.indexOf('// deep link: #profile='), SRC.indexOf('// deep link: #profile=') + 900);
  expect(block).toContain('/\\/reviews$/.test(raw)');
  // the suffix test runs on the RAW hash; decode happens after the split
  expect(block.indexOf('wantsReviews')).toBeLessThan(block.indexOf('decodeURIComponent'));
  expect(block).toContain("{ view: 'reviews' }");
  expect(SRC).toContain("opts.view === 'reviews'");
});

test('Escape steps out of the reviews view first, then out of the sheet', async () => {
  // anchored on the profile sheet's OWN handler — script.js declares several
  // `const onEsc = (e) =>` and indexOf would find somebody else's first.
  const at = SRC.indexOf('// Esc steps back ONE view');
  expect(at, 'the profile sheet Esc handler').toBeGreaterThan(-1);
  const block = SRC.slice(at, at + 900);
  has(block, '_reviewsOpen');
  has(block, "rarNavConsume('profileReviews')");
  // the sheet close must come AFTER the reviews-view branch returns
  expect(block.indexOf('_reviewsOpen')).toBeLessThan(block.indexOf('close();'));
});

test('a tombstoned review is not listed as one of their reviews', async () => {
  // PART A item 7 — the author is gone; there is nothing behind the row to open.
  const block = SRC.slice(SRC.indexOf('async function loadItemsSplit'),
    SRC.indexOf('async function loadItemsSplit') + 1400);
  has(block, 'isAuthorGone(v)');
  has(block, 'v.removed');
});

// ---------------------------------------------------------------------------
// REAL PIXELS — the new CSS, mounted as the markup the renderer emits.
// ---------------------------------------------------------------------------

const SHEET = `
<div class="profile-layer">
  <div class="profile-scrim"></div>
  <section class="profile-sheet" role="dialog" aria-modal="true" aria-label="Member profile">
    <div class="profile-kicker">MEMBER</div>
    <div class="profile-body">
      <div class="profile-featured-slot"></div>
      <div class="profile-reviews-slot">
        <span class="profile-featured-kicker">✍ THEIR REVIEWS</span>
        <button type="button" class="profile-col-viewall profile-reviews-open" data-reviews-open>all reviews (7)</button>
      </div>
    </div>
    <div class="profile-reviews-view" hidden>
      <div class="profile-reviews-bar">
        <button type="button" class="profile-reviews-back" data-reviews-back>← Back to profile</button>
      </div>
      <span class="profile-featured-kicker">✍ ALL REVIEWS</span>
      <ul class="profile-list profile-list--all">
        <li class="profile-item" role="link" tabindex="0"><span class="profile-item-title">A review</span><span class="profile-item-sub">demon slayer · 9/10</span></li>
      </ul>
    </div>
  </section>
</div>`;

async function mountSheet(page) {
  await page.goto('/index.html');
  await page.evaluate((html) => { document.body.insertAdjacentHTML('beforeend', html); }, SHEET);
}

test('REAL PIXELS: the hidden view is actually hidden, and swapping really swaps', async ({ page }) => {
  // The author-display-vs-[hidden] trap has four scalps on this project, and
  // .profile-reviews-view is a display:flex block. Measured, not assumed.
  await mountSheet(page);
  await expect(page.locator('.profile-reviews-view')).toBeHidden();
  await expect(page.locator('.profile-reviews-slot')).toBeVisible();

  await page.evaluate(() => {
    document.querySelector('.profile-body').hidden = true;
    document.querySelector('.profile-reviews-view').hidden = false;
  });
  await expect(page.locator('.profile-reviews-view')).toBeVisible();
  await expect(page.locator('.profile-body')).toBeHidden();
  await expect(page.locator('.profile-reviews-open')).toBeHidden();
});

test('REAL PIXELS: both controls clear the tap-target floor at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mountSheet(page);
  const door = await page.locator('.profile-reviews-open').boundingBox();
  expect(door.height, 'the item-4 tap-target floor').toBeGreaterThanOrEqual(44);
  expect(door.x + door.width).toBeLessThanOrEqual(360);

  await page.evaluate(() => {
    document.querySelector('.profile-body').hidden = true;
    document.querySelector('.profile-reviews-view').hidden = false;
  });
  const back = await page.locator('.profile-reviews-back').boundingBox();
  expect(back.height).toBeGreaterThanOrEqual(44);
  expect(back.x + back.width).toBeLessThanOrEqual(360);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll at 360px').toBeLessThanOrEqual(0);
});

test('REAL PIXELS: the door and the back chip both show a keyboard focus ring', async ({ page }) => {
  await mountSheet(page);
  const ring = await page.evaluate(() => {
    const el = document.querySelector('.profile-reviews-open');
    el.focus();
    const s = getComputedStyle(el);
    return { width: s.outlineWidth, style: s.outlineStyle };
  });
  // Firefox matches :focus-visible on a programmatic focus; Chromium may not,
  // so accept either a live ring or a declared one — what must never happen is
  // outline:none with nothing in its place.
  const css = await (await page.request.get('/style.css')).text();
  expect(css).toContain('.profile-reviews-back:focus-visible');
  expect(css).toContain('.profile-col-viewall:focus-visible');
  expect(ring.style).not.toBe('none');
});
