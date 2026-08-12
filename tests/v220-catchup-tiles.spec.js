// tests/v220-catchup-tiles.spec.js
// <!-- author: Code | date: 2026-08-12 -->
// =============================================================================
// v2.2.0 — Blake's banked items 1 and 4.
//
//   item 1  the door's catch-up strip is gone; pressing Enter opens the
//           "while you were away" sheet, rebuilt as TWO panels (airing |
//           lantern) under the new-reviews rail, every row deep-linking.
//   item 4  the admin menu is a scrolling grid of TILES, name + a very short
//           description, instead of a list that grew off the top of the screen.
//
// These drive the REAL renderers through the exposed models and measure real
// geometry. The project's rule, learned the hard way: a green test that never
// exercised the thing is worse than no test — so nothing here is a source grep
// where a pixel was available.
// =============================================================================
const { test, expect } = require('@playwright/test');

// the door is once-per-session; suppress it so a spec can drive the sheet
// directly without fighting the splash for the scroll lock.
const noDoor = async (page) => {
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (e) {} });
};

const seedAndOpen = (state) => (s) => {
  const m = window.rarCatchup;
  Object.assign(m.state, { fresh: [], pings: [], airing: [] }, s);
  m.open();
};

// ---------------------------------------------------------------------------
// ITEM 1 — the two-panel surface
// ---------------------------------------------------------------------------

test('item 1: the sheet renders TWO panels side by side, airing and lantern', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarCatchup, null, { timeout: 20000 });

  const out = await page.evaluate(seedAndOpen({
    airing: [{ id: 101922, title: { english: 'Demon Slayer' } }],
    pings: [{ fromUid: 'someone', fromDisplayName: 'Mika', verb: 'replied to you' }],
  }), {
    airing: [{ id: 101922, title: { english: 'Demon Slayer' } }],
    pings: [{ fromUid: 'someone', fromDisplayName: 'Mika', verb: 'replied to you' }],
  });

  const geo = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('#catchup-body .catchup-col')];
    return {
      n: cols.length,
      secs: cols.map((c) => c.dataset.sec),
      boxes: cols.map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; }),
    };
  });

  expect(geo.n, 'two panels — Blake: "split in two as two separate models"').toBe(2);
  expect(geo.secs).toEqual(['airing', 'lantern']);
  // SIDE BY SIDE at desktop width: same row, different columns.
  expect(geo.boxes[0].y, 'the panels share a row').toBe(geo.boxes[1].y);
  expect(geo.boxes[1].x, 'the lantern sits to the right of airing').toBeGreaterThan(geo.boxes[0].x);
  expect(geo.boxes[0].w, 'each panel is a real, usable width').toBeGreaterThan(180);
});

test('item 1: the new-reviews rail keeps the top slot, full width above the panels', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarCatchup, null, { timeout: 20000 });

  const geo = await page.evaluate(() => {
    const m = window.rarCatchup;
    Object.assign(m.state, {
      fresh: [{ Title: 'One punch man', image: 'one-punch-man.png' }],
      airing: [{ id: 1, title: { english: 'A' } }],
      pings: [{ fromUid: 'x', fromDisplayName: 'B', verb: 'replied' }],
    });
    m.open();
    const fresh = document.querySelector('#catchup-body .catchup-sec--fresh');
    const panels = document.querySelector('#catchup-body .catchup-panels');
    const fr = fresh.getBoundingClientRect(), pr = panels.getBoundingClientRect();
    return { freshY: Math.round(fr.y), panelsY: Math.round(pr.y),
      freshW: Math.round(fr.width), panelsW: Math.round(pr.width) };
  });

  // Blake's call 2026-08-12: it KEEPS the top slot above the two panels.
  expect(geo.freshY, 'new reviews sit above the panels').toBeLessThan(geo.panelsY);
  expect(Math.abs(geo.freshW - geo.panelsW), 'and run the full width').toBeLessThanOrEqual(2);
});

test('item 1: one empty side still renders as a panel, not an orphan column', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarCatchup, null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    const m = window.rarCatchup;
    Object.assign(m.state, { fresh: [], airing: [], pings: [{ fromUid: 'x', fromDisplayName: 'B', verb: 'replied' }] });
    m.open();
    const cols = [...document.querySelectorAll('#catchup-body .catchup-col')];
    const empty = document.querySelector('#catchup-body .catchup-col-empty');
    return { n: cols.length, emptyText: empty && empty.textContent.trim() };
  });

  expect(out.n, 'both columns render so the frame stays two-up').toBe(2);
  expect(out.emptyText, 'the quiet side says so in words').toBeTruthy();
});

test('item 1: a quiet visit has no content, so Enter must not open anything', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarCatchup, null, { timeout: 20000 });

  const quiet = await page.evaluate(() => {
    const m = window.rarCatchup;
    Object.assign(m.state, { fresh: [], pings: [], airing: [] });
    return m.hasContent();
  });
  // Blake: nothing waiting → straight into the Den, no page telling you so.
  expect(quiet).toBe(false);
});

test('item 1: an airing row Blake HAS reviewed routes to his review, not the airing page', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarCatchup, null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    // the AniListId of a real catalog entry — the branch's whole point
    const list = (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData : [];
    const withId = list.find((a) => a && a.AniListId);
    const secondary = [];
    const realSecondary = window.openSecondaryFromKey;
    // ⚠️ openModal is MODULE-scope, not on window — stubbing window.openModal
    // intercepts nothing, and an earlier version of this test passed vacuously
    // because of exactly that. So the reviewed half is measured by its REAL
    // observable effect instead: openModal pushes #anime=<slug>.
    window.openSecondaryFromKey = (k) => { secondary.push(k); };
    let hashAfterReviewed = null;
    try {
      location.hash = '';
      window.rarCatchup.routeAiring(withId.AniListId);   // reviewed → his review
      hashAfterReviewed = decodeURIComponent(location.hash);
      window.rarCatchup.routeAiring(999999999);          // unknown  → airing page
    } finally {
      window.openSecondaryFromKey = realSecondary;
    }
    const mk = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return { secondary, hashAfterReviewed, expectSlug: mk(withId.Title), id: withId.AniListId };
  });

  // ⚠️ This branch did NOT exist before v2.2.0 — the airing rows called
  // openSecondaryFromKey unconditionally, so a title Blake had reviewed still
  // opened the AniList deep-dive. Blake: "whether it be my review or something
  // that's currently airing either one based on whether I reviewed it."
  expect(out.hashAfterReviewed, 'a reviewed title actually OPENS his review')
    .toContain('#anime=');
  expect(out.hashAfterReviewed, 'and it is the right anime')
    .toContain(out.expectSlug);
  expect(out.secondary, 'the unknown id falls through to the airing page')
    .toContain('al:999999999');
  expect(out.secondary, 'a reviewed title must NOT go to the airing page')
    .not.toContain('al:' + out.id);
});

// ⚠️ The tests above drive openCatchupSheet() directly. That proves the RENDER
// but not the WIRING — and the wiring is the whole feature. These two press the
// real Enter button on the real door.
test('item 1: pressing ENTER on the real door opens the surface', async ({ page }) => {
  // deliberately do NOT suppress the door — this test needs it
  await page.goto('/index.html');
  await page.waitForSelector('#welcome-splash:not([hidden])', { timeout: 20000 });
  await page.waitForFunction(() => !!window.rarCatchup, null, { timeout: 20000 });

  // something is waiting for this member
  await page.evaluate(() => {
    Object.assign(window.rarCatchup.state, {
      fresh: [], airing: [{ id: 101922, title: { english: 'Demon Slayer' } }],
      pings: [{ fromUid: 'x', fromDisplayName: 'Mika', verb: 'replied to you' }],
    });
  });

  await page.click('#welcome-enter');
  // the door closes and the sheet takes over
  await page.waitForSelector('#catchup-sheet:not([hidden])', { timeout: 10000 });
  await expect(page.locator('#welcome-splash')).toBeHidden();
  expect(await page.locator('#catchup-body .catchup-col').count(),
    'the two panels are what Enter lands on').toBe(2);
});

test('item 1: pressing ENTER with nothing waiting goes straight into the Den', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForSelector('#welcome-splash:not([hidden])', { timeout: 20000 });
  await page.waitForFunction(() => !!window.rarCatchup, null, { timeout: 20000 });

  await page.evaluate(() => {
    Object.assign(window.rarCatchup.state, { fresh: [], airing: [], pings: [] });
  });

  await page.click('#welcome-enter');
  await expect(page.locator('#welcome-splash')).toBeHidden({ timeout: 10000 });
  // wait past the door gap AND the signal cap — if the sheet were going to open
  // on a quiet visit, it would have opened by now.
  await page.waitForTimeout(2000);
  await expect(page.locator('#catchup-sheet'),
    'Blake: a quiet visit is not made to click through a page').toBeHidden();
});

test('item 1: the readiness gate always settles, so Enter can never hang', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  const js = await (await page.request.get('/script.js')).text();
  // The gate is a promise raced against a cap. Both halves must exist, and the
  // settle must sit in a `finally` — signal 2 carries early returns, and a
  // settle placed after them would be skipped on every empty watchlist.
  expect(js).toContain('CATCHUP_SIGNAL_CAP_MS');
  expect(js).toMatch(/finally\s*\{\s*settleCatchupReady\(\);\s*\}/);
  expect(js, 'signed-out settles too').toMatch(/settleCatchupReady\(\);\s*return;/);
});

// ---------------------------------------------------------------------------
// HEADER SEARCH — Blake, 2026-08-12: "The general search bar available
// everywhere (top right of the screen) if a user looks up an anime it should
// show animes that I haven't reviewed with the proper headline ofc."
// ⚠️ searchDiscover is STUBBED here on purpose: live AniList is barred from the
// deterministic suite (project rule), and a network-dependent assertion would
// flake. The stub exercises the real render + the real ranking split.
// ---------------------------------------------------------------------------

const FAKE_MEDIA = (id, romaji) => ({
  id, title: { romaji, english: romaji, native: romaji },
  coverImage: { large: '', extraLarge: '' },
  averageScore: 74, genres: ['Drama'], format: 'TV', seasonYear: 2026,
  episodes: 12, status: 'FINISHED', description: 'x',
});

test('header search: a not-reviewed shelf appears under the results, with the headline', async ({ page }) => {
  await noDoor(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarDiscovery, null, { timeout: 20000 });

  await page.evaluate(() => {
    // ids far outside the catalog so the ranking split puts them in `outside`
    window.rarDiscovery.searchDiscover = () => Promise.resolve([
      { id: 999000001, title: { romaji: 'Zzz Test Alpha', english: 'Zzz Test Alpha' },
        coverImage: { large: '' }, averageScore: 70, genres: ['Drama'], format: 'TV', seasonYear: 2026 },
      { id: 999000002, title: { romaji: 'Zzz Test Beta', english: 'Zzz Test Beta' },
        coverImage: { large: '' }, averageScore: 71, genres: ['Action'], format: 'TV', seasonYear: 2026 },
    ]);
  });

  await page.fill('#site-search', 'zzz test');
  await page.waitForSelector('#all-world:not([hidden]) .discover-results-grid .card', { timeout: 15000 });

  const out = await page.evaluate(() => {
    const host = document.getElementById('all-world');
    return {
      headline: host.querySelector('.aw-kicker').textContent.replace(/\s+/g, ' ').trim(),
      sub: host.querySelector('.aw-sub').textContent.trim(),
      cards: host.querySelectorAll('.card').length,
      badges: host.querySelectorAll('.not-reviewed-badge').length,
      goldPins: host.querySelectorAll('.blake-pin').length,
    };
  });

  expect(out.headline, 'the "proper headline" he asked for').toContain('NOT REVIEWED YET');
  expect(out.cards).toBeGreaterThan(0);
  // every card on this shelf must WEAR the not-reviewed marking
  expect(out.badges, 'each card is marked not reviewed').toBe(out.cards);
  // PROTECT THE HEART: gold marks what Blake actually reviewed. Never here.
  expect(out.goldPins, 'nothing on this shelf wears his gold pin').toBe(0);
});

test('header search: clearing the box removes the shelf', async ({ page }) => {
  await noDoor(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarDiscovery, null, { timeout: 20000 });
  await page.evaluate(() => {
    window.rarDiscovery.searchDiscover = () => Promise.resolve([
      { id: 999000003, title: { romaji: 'Zzz Test Gamma', english: 'Zzz Test Gamma' },
        coverImage: { large: '' }, averageScore: 70, genres: ['Drama'], format: 'TV', seasonYear: 2026 },
    ]);
  });
  await page.fill('#site-search', 'zzz test');
  await page.waitForSelector('#all-world:not([hidden]) .card', { timeout: 15000 });
  await page.fill('#site-search', '');
  await expect(page.locator('#all-world')).toBeHidden({ timeout: 10000 });
});

test('header search: the shelf ships its [hidden] twin', async ({ page }) => {
  // the 6th scalp of the [hidden]-vs-author-display trap, pre-empted
  await noDoor(page);
  await page.goto('/index.html');
  const d = await page.evaluate(() => {
    const el = document.createElement('section');
    el.className = 'all-world'; el.setAttribute('hidden', '');
    document.body.appendChild(el);
    const v = getComputedStyle(el).display;
    el.remove(); return v;
  });
  expect(d).toBe('none');
});

// ---------------------------------------------------------------------------
// ITEM 2 — mobile card sizing
// Blake: "you can actually scroll and see several different entries instead of
// only, like, one or two" · "Its not just one large oversized card looking at me."
// MEASURED BEFORE: every rail card was a fixed 200×581 at EVERY phone width.
// ---------------------------------------------------------------------------

test('item 2: several rail cards fit on a phone, and none is oversized', async ({ page }) => {
  await noDoor(page);
  for (const [w, h] of [[430, 932], [390, 844], [375, 812], [360, 780], [320, 700]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/index.html');
    await page.waitForSelector('#home-airing > *', { timeout: 25000 });
    const m = await page.evaluate(() => {
      const rail = document.querySelector('#home-airing');
      const first = rail.children[0].getBoundingClientRect();
      return {
        cardW: Math.round(first.width),
        cardH: Math.round(first.height),
        visible: rail.getBoundingClientRect().width / first.width,
        scrolls: rail.scrollWidth > rail.clientWidth,
        vh: window.innerHeight,
      };
    });
    // "several", not one or two. Before this change it was 1.44-1.99.
    expect(m.visible, `more than two cards in view at ${w}px`).toBeGreaterThan(2.2);
    expect(m.scrolls, `the rail scrolls at ${w}px`).toBe(true);
    // "not one large oversized card": before, 581px of an 844px screen (69%).
    expect(m.cardH / m.vh, `a card is well under half the screen at ${w}px`).toBeLessThan(0.55);
    expect(m.cardW, `and narrower than the old fixed 200px at ${w}px`).toBeLessThan(180);
  }
});

test('item 2 LANDMINE GUARD: the Top-10 spotlight card stays 275px on phones', async ({ page }) => {
  // ⚠️ `.spotlight-stack .card { width: 275px }` in mobile.css is the CUTOVER-EVE
  // fix that is the ENTIRE reason the Top-10 fits phones, and CODE-HANDOFF says
  // in terms: do not "unify" it back into the fluid rule. The item-2 rail work
  // deliberately did not touch it. This test exists so nobody can, by accident.
  await noDoor(page);
  for (const [w, h] of [[430, 932], [390, 844], [375, 812], [320, 700]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/index.html');
    await page.waitForSelector('.spotlight-stack .card', { timeout: 25000 });
    const m = await page.evaluate(() => ({
      spotlight: Math.round(document.querySelector('.spotlight-stack .card').getBoundingClientRect().width),
      docScrollW: document.documentElement.scrollWidth,
      vw: document.documentElement.clientWidth,
    }));
    // 275 everywhere except the sub-320 guard (max-width: calc(100vw - 32px))
    const expected = Math.min(275, w - 32);
    expect(m.spotlight, `the Top-10 card holds its size at ${w}px`).toBe(expected);
    expect(m.docScrollW, `and the page never scrolls sideways at ${w}px`).toBeLessThanOrEqual(m.vw);
  }
});

// ---------------------------------------------------------------------------
// ITEM 4 — the admin tiles
// ---------------------------------------------------------------------------

const openFab = () => {
  document.getElementById('admin-fab-root').classList.remove('admin-fab-hidden');
  document.getElementById('admin-fab-menu').classList.remove('admin-fab-menu-hidden');
};

test('item 4: the tools render as a real two-across tile grid', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!document.getElementById('admin-fab-menu'), null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    document.getElementById('admin-fab-root').classList.remove('admin-fab-hidden');
    document.getElementById('admin-fab-menu').classList.remove('admin-fab-menu-hidden');
    const tiles = [...document.querySelectorAll('.admin-fab-tile')];
    const boxes = tiles.map((t) => { const r = t.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
    const rowOne = boxes.filter((b) => b.y === boxes[0].y);
    return {
      n: tiles.length,
      perRow: rowOne.length,
      boxes,
      descs: tiles.map((t) => { const d = t.querySelector('.admin-fab-tile-desc'); return d ? d.textContent.trim() : null; }),
    };
  });

  expect(out.n, 'all eleven tools — Blake 2026-08-12: "all stay for now"').toBe(11);
  expect(out.perRow, 'rectangles across, not a single column').toBe(2);
  // Blake: "They say what it is in a quick description of what it's doing."
  expect(out.descs.filter(Boolean).length, 'every tile carries a description').toBe(11);
  // "short and sweet to the point" — his words. A sentence defeats the redesign.
  for (const d of out.descs) expect(d.length, `"${d}" is short`).toBeLessThanOrEqual(34);
  // real, tappable rectangles
  for (const b of out.boxes) {
    expect(b.h, 'a tile is a real rectangle').toBeGreaterThanOrEqual(44);
    expect(b.w).toBeGreaterThan(120);
  }
});

test('item 4: the tile grid SCROLLS — the old menu could not, and ran off-screen', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!document.getElementById('admin-fab-menu'), null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    document.getElementById('admin-fab-root').classList.remove('admin-fab-hidden');
    document.getElementById('admin-fab-menu').classList.remove('admin-fab-menu-hidden');
    const grid = document.querySelector('.admin-fab-grid');
    const cs = getComputedStyle(grid);
    const menu = document.getElementById('admin-fab-menu');
    const mr = menu.getBoundingClientRect();
    return {
      overflowY: cs.overflowY,
      scrollable: grid.scrollHeight > grid.clientHeight,
      menuTop: Math.round(mr.top),
      menuBottom: Math.round(mr.bottom),
      vh: window.innerHeight,
    };
  });

  // Blake: "as we add more models, we can, like, scroll down."
  expect(out.overflowY, 'the grid owns the scroll').toMatch(/auto|scroll/);
  // and the whole menu must FIT — the bug being fixed is that it did not
  expect(out.menuTop, 'the menu never runs off the top of the screen').toBeGreaterThanOrEqual(0);
  expect(out.menuBottom, 'nor off the bottom').toBeLessThanOrEqual(out.vh);
});

test('item 4: the badges survive the redesign and still hide at zero', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarFabBadges, null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    document.getElementById('admin-fab-root').classList.remove('admin-fab-hidden');
    document.getElementById('admin-fab-menu').classList.remove('admin-fab-menu-hidden');
    const m = window.rarFabBadges;
    Object.assign(m.counts, { suggestions: 4, reports: 0, letters: 2 });
    m.paint();
    const sug = document.querySelector('.admin-fab-badge[data-badge="suggestions"]');
    const rep = document.querySelector('.admin-fab-badge[data-badge="reports"]');
    const r = sug.getBoundingClientRect();
    const tile = sug.closest('.admin-fab-tile');
    const tr = tile.getBoundingClientRect();
    return {
      sugText: sug.textContent, sugH: Math.round(r.height),
      repHidden: rep.hidden,
      insideTile: r.top >= tr.top - 1 && r.bottom <= tr.bottom + 1,
    };
  });

  expect(out.sugText).toBe('4');
  expect(out.sugH, 'still a real pill after the reflow').toBeGreaterThanOrEqual(18);
  expect(out.repHidden, 'zero still hides').toBe(true);
  expect(out.insideTile, 'the badge stays within its tile').toBe(true);
});

// Blake, mid-session 2026-08-12: "I want them all of equal sizing and centered
// in the middle of my screen (on pc)."
test('item 4: every tile is exactly the same size, and no text is clipped', async ({ page }) => {
  await noDoor(page);
  for (const [w, h] of [[1280, 900], [1024, 768], [390, 844], [360, 780]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/index.html');
    await page.waitForFunction(() => !!document.getElementById('admin-fab-menu'), null, { timeout: 20000 });
    const out = await page.evaluate(() => {
      document.getElementById('admin-fab-root').classList.remove('admin-fab-hidden');
      document.getElementById('admin-fab-menu').classList.remove('admin-fab-menu-hidden');
      const tiles = [...document.querySelectorAll('.admin-fab-tile')];
      const boxes = tiles.map((t) => t.getBoundingClientRect());
      return {
        heights: [...new Set(boxes.map((b) => Math.round(b.height)))],
        widths: [...new Set(boxes.map((b) => Math.round(b.width)))],
        // a fixed row height is only safe if nothing overflows it
        clipped: tiles.filter((t) => t.scrollHeight > t.clientHeight + 1)
          .map((t) => t.querySelector('.admin-fab-menu-item-label').textContent),
      };
    });
    expect(out.heights, `all tiles share one height at ${w}px`).toHaveLength(1);
    expect(out.widths, `all tiles share one width at ${w}px`).toHaveLength(1);
    expect(out.clipped, `no tile clips its own text at ${w}px`).toEqual([]);
  }
});

test('item 4: on PC the menu is centred on the screen, not stuck in the corner', async ({ page }) => {
  await noDoor(page);
  for (const [w, h] of [[1920, 1080], [1280, 900], [1024, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/index.html');
    await page.waitForFunction(() => !!document.getElementById('admin-fab-menu'), null, { timeout: 20000 });
    const out = await page.evaluate(() => {
      document.getElementById('admin-fab-root').classList.remove('admin-fab-hidden');
      document.getElementById('admin-fab-menu').classList.remove('admin-fab-menu-hidden');
      const r = document.getElementById('admin-fab-menu').getBoundingClientRect();
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      return {
        dx: Math.round((r.left + r.right) / 2 - vw / 2),
        dy: Math.round((r.top + r.bottom) / 2 - vh / 2),
        onScreen: r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw,
      };
    });
    expect(Math.abs(out.dx), `horizontally centred at ${w}px`).toBeLessThanOrEqual(2);
    expect(Math.abs(out.dy), `vertically centred at ${w}px`).toBeLessThanOrEqual(2);
    expect(out.onScreen, `and fully on screen at ${w}px`).toBe(true);
  }
});

test('item 4: a phone width drops to one column rather than shipping cramped labels', async ({ page }) => {
  await noDoor(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!document.getElementById('admin-fab-menu'), null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    document.getElementById('admin-fab-root').classList.remove('admin-fab-hidden');
    document.getElementById('admin-fab-menu').classList.remove('admin-fab-menu-hidden');
    const tiles = [...document.querySelectorAll('.admin-fab-tile')];
    const boxes = tiles.map((t) => { const r = t.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), right: Math.round(r.right) }; });
    const perRow = boxes.filter((b) => b.y === boxes[0].y).length;
    const menu = document.getElementById('admin-fab-menu').getBoundingClientRect();
    return { perRow, widest: Math.max(...boxes.map((b) => b.right)), vw: window.innerWidth,
      menuRight: Math.round(menu.right) };
  });

  expect(out.perRow, 'one column at 360px — two tracks leave ~130px, too narrow').toBe(1);
  expect(out.widest, 'nothing overflows the viewport horizontally').toBeLessThanOrEqual(out.vw);
  expect(out.menuRight).toBeLessThanOrEqual(out.vw);
});
