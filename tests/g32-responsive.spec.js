// g32 — MILESTONE D: the v2.0 responsive overhaul's structural pins.
// The header NEVER wraps again (one row 1201→2560, measured 2026-07-02); the
// nav drawer owns ≤1200; the card grid never clips in the 901-1200 band; touch
// affordances fire on input capability, not viewport width.
const { test, expect } = require('@playwright/test');

// the desktop one-row invariant — the exact geometry check the build was
// measured with: logo, a place, a tool, and the search all share one band.
async function headerOneRow(page) {
  return page.evaluate(() => {
    const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    const h1 = document.querySelector('body > header h1');
    const den = document.getElementById('den-btn');
    const filt = document.getElementById('filter-btn');
    const search = document.getElementById('site-search');
    const same = (a, b) => Math.abs(mid(a) - mid(b)) < 12;
    return {
      oneRow: same(h1, den) && same(den, filt) && same(filt, search),
      logoOneLine: h1.getBoundingClientRect().height <= 82 && h1.scrollWidth <= h1.getBoundingClientRect().width + 2,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

for (const w of [2560, 1920, 1520, 1440, 1280, 1201]) {
  test(`gD: the desktop header holds ONE row at ${w}px (no wrap, no overflow, one-line logo)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
    await page.goto('/');
    const m = await headerOneRow(page);
    expect(m.oneRow).toBe(true);
    expect(m.logoOneLine).toBe(true);
    expect(m.overflow).toBe(false);
    await expect(page.locator('#nav-drawer-toggle')).toBeHidden();
  });
}

// TRUE-panel (MED→fixed): the old "one slim row" line here computed and never
// asserted — the mobile header had ZERO geometry pins, and it genuinely
// overflowed (sign-in token 39px off-canvas at 375). This is the real pin.
for (const w of [900, 430, 375]) {
  test(`gD: the ≤1200 header is one ON-SCREEN row at ${w}px (toggle·logo·search·tokens all reachable)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 850 });
    await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
    await page.goto('/');
    const m = await page.evaluate(() => {
      const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
      const els = ['#nav-drawer-toggle', 'body > header h1', '#site-search', '#notif-btn', '#auth-open']
        .map((s) => document.querySelector(s));
      const rects = els.map((el) => el.getBoundingClientRect());
      return {
        oneRow: rects.every((r) => Math.abs((r.top + r.height / 2) - mid(els[0])) < 14),
        allOnScreen: rects.every((r) => r.x >= 0 && Math.round(r.right) <= innerWidth + 1 && r.width > 0),
        // the VISIBLE pill (.search-wrap) — the input can extend clipped under
        // overflow:hidden, so measuring it lies (TRUE-panel lesson)
        searchUsable: document.querySelector('.search-wrap').getBoundingClientRect().width >= 80,
        logoOneLine: rects[1].height <= 82,
      };
    });
    expect(m.oneRow).toBe(true);
    expect(m.allOnScreen).toBe(true);     // the sign-in token must be TAPPABLE
    expect(m.searchUsable).toBe(true);    // never an 18px sliver again
    expect(m.logoOneLine).toBe(true);
  });
}

test('gD: ≤1200 the drawer owns the nav — toggle 44px, open/Esc choreography, scrim twin', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
  await page.goto('/');
  const toggle = page.locator('#nav-drawer-toggle');
  await expect(toggle).toBeVisible();
  const tb = await toggle.boundingBox();
  expect(tb.width).toBeGreaterThanOrEqual(44);
  expect(tb.height).toBeGreaterThanOrEqual(44);
  // open
  await toggle.click();
  await page.waitForTimeout(450);
  await expect(page.locator('body')).toHaveClass(/nav-open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const tx = await page.evaluate(() => Math.round(document.getElementById('main-toolbar').getBoundingClientRect().x));
  expect(tx).toBe(0);
  const denBox = await page.locator('#den-btn').boundingBox();
  expect(denBox.height).toBeGreaterThanOrEqual(44);        // drawer nav = touch targets
  // scroll locked while open
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  // Esc closes, releases, hides the scrim
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
  await expect(page.locator('body')).not.toHaveClass(/nav-open/);
  expect(await page.evaluate(() => document.getElementById('nav-drawer-scrim').hidden)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  // TRUE-panel (HIGH, fixed): a reopen INSIDE the 300ms close window must not
  // let the stale timer strand the drawer scrimless + lockless.
  await toggle.click();                    // open
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');     // begin closing…
  await page.waitForTimeout(60);
  await toggle.click();                    // …reopen mid-window
  await page.waitForTimeout(500);          // let the stale timer's moment pass
  const after = await page.evaluate(() => ({
    open: document.body.classList.contains('nav-open'),
    scrimHidden: document.getElementById('nav-drawer-scrim').hidden,
    lock: document.documentElement.style.overflow,
  }));
  expect(after.open).toBe(true);
  expect(after.scrimHidden).toBe(false);   // the scrim survived the stale timer
  expect(after.lock).toBe('hidden');       // so did the lock
  // Tab containment: forward-Tab cycles ONLY the drawer's controls — the
  // scrim-covered logo link may never become an invisible focus stop.
  const cycled = await page.evaluate(async () => {
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(ev);
      await new Promise((r) => setTimeout(r, 20));
      seen.add(document.activeElement.id || document.activeElement.className);
    }
    return { leaked: seen.has('home-button'), stops: seen.size };
  });
  expect(cycled.leaked).toBe(false);
  await page.keyboard.press('Escape');
});

test('gD: a drawer place-click closes AND switches the surface (the veil funnel keeps working)', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
  await page.goto('/');
  await page.locator('#nav-drawer-toggle').click();
  await page.waitForTimeout(400);
  await page.locator('#discover-btn').click();
  await page.waitForTimeout(600);
  await expect(page.locator('body')).not.toHaveClass(/nav-open/);
  expect(await page.evaluate(() => document.documentElement.dataset.surface)).toBe('discover');
});

for (const w of [1440, 1280, 1024, 901]) {
  test(`gD: the catalog grid never clips at ${w}px (the 901-1200 band used to hide cards off-screen)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
    // ⚠️ CHANGED 2026-08-12: this used to `goto('/#all')`. Blake: "The website
    // should open to the Den. Not my anime cards." A browser that restores the
    // last URL was cold-booting him straight into the grid, so `#all` — a TOOL
    // view, the one place rarNav lights no nav place — is now normalised away on
    // a cold load. The grid is reached the way a person reaches it instead.
    // What this test guards is unchanged: the catalog grid must not clip.
    await page.goto('/');
    // ⚠️ at <=1200px the nav lives in the drawer, so the button is not on screen
    // until it is opened — the reason two of these four widths failed the first
    // time this was rewritten.
    const viewAll = page.locator('#view-all-btn');
    if (!(await viewAll.isVisible())) {
      await page.click('#nav-drawer-toggle');
      await viewAll.waitFor({ state: 'visible', timeout: 8000 });
    }
    await viewAll.click();
    await page.waitForSelector('.card-container .card', { timeout: 15000 });
    const g = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.card-container .card'));
      const xs = cards.map((c) => c.getBoundingClientRect());
      return {
        minX: Math.min(...xs.map((r) => r.x)),
        maxRight: Math.max(...xs.map((r) => r.right)),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(g.minX).toBeGreaterThanOrEqual(0);
    expect(Math.round(g.maxRight)).toBeLessThanOrEqual(w + 1);
    expect(g.overflow).toBe(false);
  });
}

test('gD: source pins — touch block promoted, mobile.css slimmed, the shared drawer module wired', async ({ page }) => {
  const css = await (await page.request.get('/style.css')).text();
  // the touch block lives UNGATED in style.css (input capability, not width)
  expect(css).toMatch(/@media \(hover: none\), \(pointer: coarse\) \{[\s\S]{0,400}?\.card \.icon-row/);
  // the card grid is auto-fit, never a fixed 4-track again
  expect(css).toContain('repeat(auto-fit, 275px)');
  expect(css).not.toContain('repeat(4, 275px)');
  // the scrim ships its [hidden] twin
  expect(css).toMatch(/\.nav-drawer-scrim\[hidden\] \{ display: none; \}/);
  const mob = await (await page.request.get('/mobile.css')).text();
  // mobile.css no longer owns touch behavior or the column-stacked header
  expect(mob).not.toMatch(/hover: none/);
  expect(mob).not.toMatch(/flex-direction: column/);
  // both pages import the ONE drawer module, versioned from birth
  const sjs = await (await page.request.get('/script.js')).text();
  const ajs = await (await page.request.get('/account.js')).text();
  expect(sjs).toMatch(/from '\.\/nav-drawer\.js\?v=[\d.]+'/);
  expect(ajs).toMatch(/from '\.\/nav-drawer\.js\?v=[\d.]+'/);
  // account.html carries the toggle + the shared toolbar id + the scrim
  const acct = await (await page.request.get('/account.html')).text();
  expect(acct).toContain('id="nav-drawer-toggle"');
  expect(acct).toContain('id="main-toolbar"');
  expect(acct).toContain('id="nav-drawer-scrim"');
  // the ≤900 account grid track is minmax(0,1fr) — a bare 1fr let the 8-tab
  // strip's min-content size every panel (~1040px in a 900px viewport: the
  // Wrapped sky clipped, Inbox sat unreachable — caught by the D3 sweep)
  expect(css).toMatch(/\.account-v2 \.account-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  // TRUE-panel: the fluid logo lives in the BASE h1 rule (a same-selector
  // duplicate earlier in the file was dead CSS) — exactly ONE clamp, and no
  // competing bare 2.4rem font-size on the same selector anywhere.
  expect((css.match(/body > header h1 \{[^}]*clamp\(/g) || []).length).toBe(1);
  expect(css).not.toMatch(/body > header h1 \{[^}]*font-size: 2\.4rem/);
  // TRUE-panel: the closed filter panel is visibility:hidden — ~211 invisible
  // tab stops lived in the header when opacity alone hid it.
  expect(css).toMatch(/#filter-panel \{[^}]*visibility: hidden/s);
  // the drawer's toolbar click-close listens on CAPTURE — the filter button's
  // bubble stopPropagation must never strand the drawer over the panel
  const drawer = await (await page.request.get('/nav-drawer.js')).text();
  expect(drawer).toMatch(/toolbar\.addEventListener\('click'[\s\S]{0,200}?, true\)/);
});

// ---------------------------------------------------------------------------
// PART A follow-up (Blake, 2026-08-10): "the search bar is WAY too big… lets
// shrink it down to look proportional."
// ---------------------------------------------------------------------------
test('the header search stays PROPORTIONAL across every band (measured, not asserted)', async ({ page }) => {
  // The pill is `flex: 1 1 auto` under mobile.css so a phone can give it what
  // is left of the row — and it had no ceiling, so the moment there was spare
  // room it took all of it: 60% of the viewport at 900px, 55% at 800px, while
  // 901px (the desktop rule) sat at 27%. Crossing one pixel doubled it.
  //
  // This is the SECOND time this exact complaint has been raised — Milestone F
  // fixed the 901-1200 band and stopped at the media boundary. Pinned by
  // measurement this time so the next band cannot be missed quietly.
  const BUDGET = 0.40;   // no width where the search may exceed 40% of the screen
  const seen = [];
  for (const width of [1440, 1280, 1100, 950, 901, 900, 860, 800, 700, 600, 500, 430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/index.html');
    const m = await page.evaluate(() => {
      const wrap = document.querySelector('#search-form');
      const acct = document.querySelector('#auth-open');
      const w = wrap.getBoundingClientRect();
      const a = acct ? acct.getBoundingClientRect() : null;
      return {
        wrap: Math.round(w.width),
        acctRight: a ? Math.round(a.right) : 0,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const share = m.wrap / width;
    seen.push(`${width}:${m.wrap}px(${Math.round(share * 100)}%)`);
    expect(share, `search pill at ${width}px is ${Math.round(share * 100)}% of the viewport — ${seen.join(' ')}`)
      .toBeLessThanOrEqual(BUDGET);
    // and the item-4 guarantee still holds: the account button stays reachable
    expect(m.acctRight, `account button off-screen at ${width}px`).toBeLessThanOrEqual(width);
    expect(m.overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test('capping the search did not strand the header tokens mid-row', async ({ page }) => {
  // The pill's growth is what used to push the Lantern + account head to the
  // right edge. Capping it left them floating 231px short at 900px until the
  // tokens were given `margin-left:auto`. The edge is the design.
  for (const width of [900, 800, 700, 600]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/index.html');
    const right = await page.evaluate(() =>
      Math.round(document.querySelector('#auth-open').getBoundingClientRect().right));
    expect(width - right, `account head floats ${width - right}px short of the edge at ${width}px`)
      .toBeLessThanOrEqual(24);
  }
});
