const { test, expect } = require('./welcomed');

// CUTOVER-EVE — the four surgical fixes of the last gate before v2.0.0.
// (Fix 1's real-keystroke escape pins live with the composer suite in
// g17-live-composer.spec.js; fix 2's write shape is pinned in the rules
// suite and walked live in the emulator record.)
test.describe('CUTOVER-EVE — last-gate pins', () => {

  // fix 3 — the Top-10 spotlight at phone widths. The grid's fluid
  // `.card{width:100%}` (mobile.css) must never inflate the spotlight card:
  // it grew with the viewport inside the FIXED 630px stack and the centered
  // spill buried the heading above and the Featured Drop below. Measure the
  // VISIBLE thing (the D-panel lesson): worst-case card box vs its neighbors.
  test('Top-10 spotlight: portrait card fits its 630px frame at 360/375/414 — no heading overlap, no bottom spill', async ({ page }) => {
    for (const w of [360, 375, 414]) {
      await page.setViewportSize({ width: w, height: 850 });
      await page.goto('/?g35=' + w);   // distinct query — same-URL hash/query gotos skip the boot router
      await page.waitForSelector('#spotlight-carousel .card');
      const r = await page.evaluate(() => {
        const stack = document.querySelector('#spotlight-carousel');
        const sRect = stack.getBoundingClientRect();
        const sub = document.querySelector('.den-top10 .section-subtext');
        const cards = Array.from(stack.querySelectorAll('.card'));
        const maxH = Math.max(...cards.map((c) => c.getBoundingClientRect().height));
        const activeW = (stack.querySelector('.card.active') || cards[0]).getBoundingClientRect().width;
        // cards center at 50% of the stack — the worst card's top edge:
        const worstTop = sRect.top + sRect.height / 2 - maxH / 2;
        return {
          activeW: Math.round(activeW),
          overlapSubtext: Math.round(sub.getBoundingClientRect().bottom - worstTop),
          spillBottom: Math.round(maxH / 2 - sRect.height / 2),
          scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
        };
      });
      expect(r.activeW, `card width at ${w}px`).toBe(275);                 // the desktop portrait, restored
      expect(r.overlapSubtext, `subtext overlap at ${w}px`).toBeLessThanOrEqual(0);
      expect(r.spillBottom, `bottom spill at ${w}px`).toBeLessThanOrEqual(0);
      expect(r.scrollW, `horizontal overflow at ${w}px`).toBeLessThanOrEqual(r.innerW);
    }
  });

  // fix 2 — the on-card featured-shelf control exists and writes the ONE field
  // the Studio dropdown saves (the live feature/unfeature cycle is walked in
  // the emulator; these source pins guard the wiring against regression).
  test('featured shelf: the ⭐ card control is wired to profiles.featuredShelf (source pins)', async ({ page }) => {
    const acct = await (await page.request.get('/account.js')).text();
    expect(acct).toContain("card.querySelector('.col-feat')");            // the control is wired on every card
    expect(acct).toContain('Feature this shelf');                         // the discoverable copy
    expect(acct).toContain('featuredShelf: next');                        // writes the Studio dropdown's field
    expect(acct).toContain('Private shelves can’t be featured');          // the hover/notice copy
    const css = await (await page.request.get('/style.css')).text();
    // exactly ONE base rule — the identical-selector-duplicate class is a silent loser
    expect(css.match(/^\.col-feat \{/gm) || []).toHaveLength(1);
    expect(css).toContain('.col-feat.is-on');
  });

  // fix 4 — the tag, Blake's call ("friendly rivalry as one thing"): ONE tag,
  // never two. Reads the bare global (window.animeData is a lexical const).
  test('Black Clover carries the single friendly-rivalry tag', async ({ page }) => {
    await page.goto('/');
    const tags = await page.evaluate(() => animeData.find((a) => a.Title === 'Black Clover').Tags);
    expect(tags).toContain('friendly-rivalry');
    expect(tags).not.toContain('friendly');
    expect(tags).not.toContain('rivalry');
  });

  // the DELIBERATE CALL (Blake, 2026-07-04): Attack on Titan's "15/10" is his
  // hyperbole, NOT a data bug — no validation pass may ever normalize it. If
  // this pin fails, someone "fixed" his voice: put it back.
  test('Attack on Titan keeps Blake\'s intentional 15/10', async ({ page }) => {
    await page.goto('/');
    const rating = await page.evaluate(() => animeData.find((a) => a.Title === 'Attack on Titan').Rating);
    expect(rating).toBe('15/10');
  });
});
