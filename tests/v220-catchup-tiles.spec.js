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
// THE iPHONE SIGN-IN BUG — Blake: "on my phone I can never sign into my
// account… 'wrong password or username' when my login credentials are the same
// one I use on the computer." (iPhone 15, Arc.)
// Cause: the form advertised autocomplete="username" on a HIDDEN, ENABLED input
// while the visible identifier said "email". iOS / iCloud Keychain fills the
// USERNAME field — the invisible one — so the saved login landed out of sight
// and the visible Email box submitted empty. Firebase answered user-not-found,
// which the UI renders as "Incorrect email or password."
// ---------------------------------------------------------------------------

test('sign-in: no HIDDEN field may advertise a credential to autofill', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.click('#auth-open');
  await page.waitForSelector('#auth-modal.active', { timeout: 10000 });

  const out = await page.evaluate(() => {
    const f = document.getElementById('auth-form');
    const rows = [...f.querySelectorAll('input')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.id,
        ac: el.getAttribute('autocomplete'),
        disabled: el.disabled,
        visible: r.width > 0 && r.height > 0,
      };
    });
    return { rows, title: document.getElementById('auth-title').textContent.trim() };
  });

  expect(out.title).toBe('Sign in');
  const CREDENTIAL = ['username', 'current-password', 'new-password'];
  for (const r of out.rows) {
    if (!r.visible && CREDENTIAL.includes(r.ac)) {
      expect(r.disabled, `#${r.id} is hidden and advertises "${r.ac}" — it MUST be disabled or autofill will target it`).toBe(true);
    }
  }
  // the identifier a password manager fills must be the VISIBLE one
  const idField = out.rows.find((r) => r.ac === 'username' && !r.disabled);
  expect(idField, 'a visible, enabled username field exists').toBeTruthy();
  expect(idField.id, 'and it is the email box the member can actually see').toBe('auth-email');
  expect(idField.visible).toBe(true);
});

test('sign-in: switching to Create account re-arms the fields correctly', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.click('#auth-open');
  await page.waitForSelector('#auth-modal.active', { timeout: 10000 });
  await page.click('#auth-switch a[data-mode="signup"]');
  await page.waitForTimeout(200);

  const out = await page.evaluate(() => ({
    title: document.getElementById('auth-title').textContent.trim(),
    userDisabled: document.getElementById('auth-username').disabled,
    userAc: document.getElementById('auth-username').getAttribute('autocomplete'),
    emailAc: document.getElementById('auth-email').getAttribute('autocomplete'),
    passAc: document.getElementById('auth-password').getAttribute('autocomplete'),
  }));

  expect(out.title).toBe('Create account');
  expect(out.userDisabled, 'the display-name field is usable when shown').toBe(false);
  expect(out.userAc, 'a display name is not a credential').toBe('nickname');
  expect(out.emailAc, 'signup email is a new address, not the saved identifier').toBe('email');
  expect(out.passAc, 'so a manager offers to SAVE rather than fill').toBe('new-password');
});

// Blake, after v2.2.1: "I can press enter but It still doesn't log me in. I
// don't get an 'wrong password or email' just its sitting there."
// Cause: v2.2.1 made the identifier the autofill target, but it was type="email"
// — so a stored USERNAME failed browser validation and the form NEVER SUBMITTED.
// No request, no error, nothing. Silence is now impossible.
test('sign-in: the form can never fail silently', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  await page.click('#auth-open');
  await page.waitForSelector('#auth-modal.active', { timeout: 10000 });

  // the identifier must NOT be type="email", or the browser blocks submit itself
  const type = await page.getAttribute('#auth-email', 'type');
  expect(type, 'type=email silently refuses to submit a stored username').toBe('text');

  // a username-shaped identifier gets a message that says what to do
  await page.fill('#auth-email', 'blakewolters');
  await page.fill('#auth-password', 'somepassword');
  await page.click('#auth-submit');
  await page.waitForTimeout(400);
  const msg = await page.textContent('#auth-error');
  expect(msg.trim().length, 'it says something').toBeGreaterThan(0);
  expect(msg, 'and it names the actual problem').toMatch(/EMAIL/i);

  // an empty box says so too, rather than doing nothing
  await page.fill('#auth-email', '');
  await page.click('#auth-submit');
  await page.waitForTimeout(300);
  expect((await page.textContent('#auth-error')).trim().length).toBeGreaterThan(0);
});

test('sign-in: the email box is hardened against iOS autocorrect', async ({ page }) => {
  await noDoor(page);
  await page.goto('/index.html');
  const attrs = await page.evaluate(() => {
    const e = document.getElementById('auth-email');
    return {
      cap: e.getAttribute('autocapitalize'), corr: e.getAttribute('autocorrect'),
      spell: e.getAttribute('spellcheck'), mode: e.getAttribute('inputmode'),
    };
  });
  expect(attrs.cap).toBe('none');
  expect(attrs.corr).toBe('off');
  expect(attrs.spell).toBe('false');
  expect(attrs.mode).toBe('email');
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

// Blake, after the first pass: "the anime by genre (the den area just scroll
// down). It still looks the same size as before" · search results "look huge".
// Both were missed because the first pass named four containers instead of
// styling the card itself.
test('item 2: EVERY card surface is compact, not just the ones named first', async ({ page }) => {
  await noDoor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html');
  // ⚠️ the AIRING rail is lazy + network-fed, so `#home-airing > *` can be
  // SKELETONS rather than cards. The genre rails come from the local catalog
  // and always render — wait on those, and treat the airing rail as optional
  // so a slow AniList response cannot fail a layout assertion.
  await page.waitForSelector('#genre-rails .card', { timeout: 25000 });

  const den = await page.evaluate(() => {
    const one = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), pct: b.height / window.innerHeight };
    };
    return { rail: one('#home-airing .card'), genre: one('#genre-rails .card') };
  });

  // the genre rails were 220x616 (73% of the screen) when he reported it
  expect(den.genre, 'the Den has genre rails').toBeTruthy();
  expect(den.genre.w, 'a genre card is compact').toBeLessThan(180);
  expect(den.genre.pct, 'and well under half the screen').toBeLessThan(0.55);
  // and it must MATCH the home rail — one look, not two. Only when that rail
  // actually rendered; its data comes over the network.
  if (den.rail) {
    expect(Math.abs(den.genre.w - den.rail.w), 'genre and home rails are the same size').toBeLessThanOrEqual(2);
  }

  // the header-search results grid: was 2 columns of 174x526 (62%)
  await page.fill('#site-search', 'demon');
  await page.waitForTimeout(1200);
  const grid = await page.evaluate(() => {
    const g = document.querySelector('.card-container');
    const cards = [...g.querySelectorAll('.card')];
    const b = cards[0].getBoundingClientRect();
    return {
      cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
      w: Math.round(b.width), pct: b.height / window.innerHeight,
    };
  });
  expect(grid.cols, 'three across at 390px, like the rails').toBe(3);
  expect(grid.pct, 'a search result is not two-thirds of the screen').toBeLessThan(0.5);
});

// Blake: "lets also apply the same logic to the tavern and its threads.
// Threads just look pretty big."
// The Tavern's threads need a signed-in session, which a deterministic run
// doesn't have — so this mounts the real classes and reads the computed style,
// the same technique the [hidden]-twin specs use. It proves the RULES land.
test('item 2: the Tavern trims down on phones', async ({ page }) => {
  await noDoor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html');

  const phone = await page.evaluate(() => {
    const mk = (cls, tag = 'div') => {
      const el = document.createElement(tag);
      el.className = cls; el.textContent = 'x';
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const out = { padding: cs.padding, fontSize: cs.fontSize };
      el.remove(); return out;
    };
    return { card: mk('hub-card'), title: mk('hub-card-title', 'h3'),
      post: mk('hub-post'), postText: mk('hub-post-text') };
  });

  // desktop values are padding 13px 15px / title 1.02rem (16.32px) / post 10px 13px
  expect(phone.card.padding, 'thread card padding comes down').toBe('10px 12px');
  expect(parseFloat(phone.title.fontSize), 'thread title is smaller than desktop 16.32px').toBeLessThan(16);
  expect(phone.post.padding, 'post padding comes down').toBe('9px 11px');
  // ...but the BODY text stays readable — this is prose, not a card label
  expect(parseFloat(phone.postText.fontSize), 'post text stays legible').toBeGreaterThanOrEqual(13);
});

// REWRITTEN 2026-08-12 (second sizing pass). It used to assert the spotlight was
// exactly 275px with full-size text. **Blake reversed that himself**: "my top 10
// favorite anime also huge. Adjust to fit the layout of the rest." So the number
// changed — and pinning HIS preference was the wrong thing to pin anyway.
// What this guards now is the CUTOVER-EVE constraint, which has NOT changed: the
// card must carry an EXPLICIT, bounded width and must never be handed back to
// `.card { width: 100% }`, which is what inflated it to 1382px tall inside a
// fixed-height stack in the first place. A width that tracks the viewport fails.
test('item 2 LANDMINE GUARD: the Top-10 card is explicitly sized, never fluid', async ({ page }) => {
  await noDoor(page);
  const widths = [];
  for (const [w, h] of [[430, 932], [390, 844], [375, 812], [320, 700]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/index.html');
    await page.waitForSelector('.spotlight-stack .card', { timeout: 25000 });
    const m = await page.evaluate(() => ({
      spotlight: Math.round(document.querySelector('.spotlight-stack .card').getBoundingClientRect().width),
      stackH: document.querySelector('.spotlight-stack').getBoundingClientRect().height,
      vh: window.innerHeight,
      docScrollW: document.documentElement.scrollWidth,
      vw: document.documentElement.clientWidth,
    }));
    widths.push({ w, card: m.spotlight });
    // it must be a real, bounded card — never the full stack width
    expect(m.spotlight, `the Top-10 card is bounded at ${w}px`).toBeLessThanOrEqual(210);
    expect(m.spotlight, `and is still a real card at ${w}px`).toBeGreaterThan(120);
    expect(m.docScrollW, `and the page never scrolls sideways at ${w}px`).toBeLessThanOrEqual(m.vw);
    // it must also not swallow the screen — Blake's "also huge" complaint
    // "too big" is a FRACTION OF THE SCREEN, not a pixel count — the 320x700
    // case is what proved that (a fixed block is 47% of an iPhone 15 and 70% of
    // an SE), so the block scales and this is asserted against the viewport.
    expect(m.stackH / m.vh, `the Top-10 block is not swallowing the screen at ${w}px`).toBeLessThan(0.55);
    expect(m.spotlight / m.vw, `nor is the card itself at ${w}px`).toBeLessThan(0.6);
  }
  // THE CORE INVARIANT, stated correctly: the card is BOUNDED. The CUTOVER-EVE
  // bug was `.card{width:100%}` letting it inflate to the stack/viewport; a
  // clamp with a hard max is not that. So what must hold is the ceiling — the
  // card never grows past its max no matter how wide the screen gets.
  const widest = Math.max(...widths.map((x) => x.card));
  expect(widest, 'the card has a hard ceiling and never inflates').toBeLessThanOrEqual(210);
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

// Blake: "The website should open to the Den. Not my anime cards."
test('routing: a cold load never lands in the card grid', async ({ page }) => {
  await noDoor(page);
  for (const url of ['/index.html#all', '/index.html']) {
    await page.goto(url);
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({
      home: getComputedStyle(document.getElementById('home-view')).display,
      all: getComputedStyle(document.getElementById('all-anime-view')).display,
      hash: location.hash,
    }));
    expect(r.home, `the Den is what opens from ${url}`).not.toBe('none');
    expect(r.all, `and the card grid is not`).toBe('none');
    expect(r.hash, 'the tool-view hash is normalised away').toBe('');
  }
});

// Blake: the account nav was clipping "Favorites" mid-word inside a scroller.
test('account: the nav is an even tile grid, not a clipping scroller', async ({ page }) => {
  await page.route((url) => url.href.includes('signin=1'), (r) => r.fulfill({ status: 204, body: '' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/account.html');
  await page.waitForSelector('.side-link', { timeout: 20000 });
  const out = await page.evaluate(() => {
    const nav = document.querySelector('.account-v2 .account-side nav');
    const links = [...document.querySelectorAll('.side-link')];
    const vw = document.documentElement.clientWidth;
    return {
      overflowX: getComputedStyle(nav).overflowX,
      clipped: links.filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent.trim()),
      offscreen: links.filter((l) => l.getBoundingClientRect().right > vw + 1).length,
      minH: Math.min(...links.map((l) => Math.round(l.getBoundingClientRect().height))),
      perRow: links.filter((l) => Math.round(l.getBoundingClientRect().y) === Math.round(links[1].getBoundingClientRect().y)).length,
    };
  });
  expect(out.overflowX, 'the horizontal scroller is gone').not.toBe('auto');
  expect(out.clipped, 'no tab label is cut off mid-word').toEqual([]);
  expect(out.offscreen, 'nothing runs off the right edge').toBe(0);
  expect(out.minH, 'every tile clears the 44px tap floor').toBeGreaterThanOrEqual(44);
});
