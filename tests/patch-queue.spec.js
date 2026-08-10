// THE PATCH QUEUE (docs/NEXT.md:161) — Blake's own ordered post-cutover wants.
// <!-- author: Code | date: 2026-08-10 -->
// One spec file for the batch; each item gets its own block as it lands.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const has = (hay, needle, why) => expect(hay.includes(needle), why || needle).toBe(true);
const lacks = (hay, needle, why) => expect(hay.includes(needle), why || needle).toBe(false);

// Admin pages send non-admins away. Neuter ONLY that line so the real page,
// real stylesheet and real modules load; everything else is untouched.
async function openAdmin(page, name) {
  await page.route('**/admin/*.js*', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).split("window.location.replace('../index.html');").join('void 0;');
    await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/javascript' } });
  });
  await page.goto(`/admin/${name}.html`);
  await page.waitForFunction(() => !!document.getElementById('confirm-modal'), null, { timeout: 20000 });
}

// ---------------------------------------------------------------------------
// ITEM 2 — unify the duplicated admin dialogs
// ---------------------------------------------------------------------------

test('item 2: there is exactly ONE confirm/notice implementation for admin', () => {
  // reports.js's copies were literally commented "parameterized clone of
  // suggestions'". Two implementations of one dialog drift apart — fix the
  // focus trap in one and the other keeps the bug.
  const shared = read('admin/admin-modals.js');
  has(shared, 'export function confirmModal');
  has(shared, 'export function noticeModal');

  for (const f of ['admin/reports.js', 'admin/suggestions.js']) {
    const src = read(f);
    lacks(src, 'function confirmModal(', `${f} must not redefine confirmModal`);
    lacks(src, 'function noticeModal(', `${f} must not redefine noticeModal`);
    has(src, "from './admin-modals.js?v=", `${f} imports the shared dialogs`);
  }
});

test('item 2: no admin page has regrown a native dialog', () => {
  for (const f of ['reports', 'suggestions', 'new-anime', 'catalog', 'curation', 'stats',
    'studio', 'quotes', 'season-reviews', 'edit']) {
    const src = read(`admin/${f}.js`);
    // strip comments first — the banners legitimately mention "the alert() replacement"
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code, `${f}.js must not call a native dialog`).not.toMatch(/(^|[^.\w])(alert|confirm|prompt)\s*\(/m);
  }
});

test('item 2: the shared bump target exists for both new import specifiers', () => {
  const bump = read('scripts/bump-version.js');
  has(bump, 'admin-modals.js?v= import (reports)');
  has(bump, 'admin-modals.js?v= import (suggestions)');
});

for (const page of ['reports', 'suggestions']) {
  test(`REAL PIXELS: the shared dialog behaves identically on ${page}`, async ({ page: pg }) => {
    // suggestions.html gives its glyph/kicker NO ids and reports.html does —
    // the shared module looks them up by class precisely so neither page needs
    // markup surgery to share a dialog. That is what this proves.
    await openAdmin(pg, page);
    const r = await pg.evaluate(async () => {
      const m = await import('/admin/admin-modals.js?v=2.1.0');
      const p = m.confirmModal({ glyph: '🔥', kicker: 'TEST', kickerJp: '試験', body: 'Body text here', okLabel: 'Go' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const ov = document.getElementById('confirm-modal');
      const out = {
        visible: !ov.hidden,
        opened: ov.querySelector('.confirm-card').classList.contains('is-open'),
        glyph: ov.querySelector('.confirm-glyph').textContent,
        kicker: ov.querySelector('.confirm-kicker').textContent.trim(),
        jpEl: !!ov.querySelector('.confirm-kicker .jp-mini'),
        body: ov.querySelector('.confirm-body').textContent,
        okLabel: ov.querySelector('[data-confirm="ok"]').textContent,
        cancelFocusedFirst: document.activeElement === ov.querySelector('[data-confirm="cancel"]'),
      };
      ov.querySelector('[data-confirm="ok"]').click();
      out.okResolves = await p;
      out.hiddenAfter = ov.hidden;
      const np = m.noticeModal({ body: 'notice' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.cancelHiddenDuringNotice = ov.querySelector('[data-confirm="cancel"]').hidden;
      ov.querySelector('[data-confirm="ok"]').click();
      await np;
      out.cancelRestored = !ov.querySelector('[data-confirm="cancel"]').hidden;
      return out;
    });
    expect(r.visible).toBe(true);
    expect(r.opened, 'the entrance transition ran').toBe(true);
    expect(r.glyph).toBe('🔥');
    expect(r.kicker).toBe('TEST 試験');
    expect(r.jpEl, 'the jp sublabel is a real element, not interpolated markup').toBe(true);
    expect(r.body).toBe('Body text here');
    expect(r.okLabel).toBe('Go');
    expect(r.cancelFocusedFirst, 'the SAFE option takes focus first').toBe(true);
    expect(r.okResolves).toBe(true);
    expect(r.hiddenAfter).toBe(true);
    expect(r.cancelHiddenDuringNotice, 'a notice has one exit').toBe(true);
    expect(r.cancelRestored, 'the overlay is handed back intact for the next confirm').toBe(true);
  });
}

// ---------------------------------------------------------------------------
// ITEM 3 — the header search's own ✕
// ---------------------------------------------------------------------------

test('item 3: the ✕ exists on BOTH headers, and the native one really is killed', () => {
  // style.css:43 kills ::-webkit-search-cancel-button site-wide — that global
  // kill is exactly why this pill had no way to clear. If it were ever removed,
  // this custom ✕ would be a duplicate, so the two facts are pinned together.
  has(read('style.css'), '::-webkit-search-cancel-button', 'the native clear is suppressed site-wide');
  for (const f of ['index.html', 'account.html']) {
    has(read(f), 'id="site-search-clear"', `${f} carries the clear button`);
    expect(read(f), `${f} ships it hidden`).toMatch(/id="site-search-clear"[^>]*hidden/);
  }
  has(read('style.css'), '.search-clear[hidden]{ display: none; }', 'the [hidden] twin — it is a flex item');
});

test('item 3: clearing re-enters through the input handler, never a second code path', () => {
  // "Clear" and "delete the last character" must land in the same place, or the
  // live filter can be reset by one and not the other.
  const src = read('script.js');
  const block = src.slice(src.indexOf('PATCH QUEUE item 3'), src.indexOf('PATCH QUEUE item 3') + 900);
  has(block, 'new Event("input"', 'the ✕ dispatches input rather than duplicating the empty branch');
  has(block, 'searchInput.focus()');
});

test('REAL PIXELS: the ✕ appears only with text, clears, and stays out of the tight band', async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (e) {} });

  // wide: the ✕ does its job
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/index.html');
  const x = page.locator('#site-search-clear');
  await expect(x, 'hidden while empty — the pill keeps its resting width').toBeHidden();
  await page.fill('#site-search', 'demon');
  await expect(x).toBeVisible();
  await x.click();
  await expect(page.locator('#site-search')).toHaveValue('');
  await expect(x).toBeHidden();
  expect(await page.evaluate(() => document.activeElement === document.getElementById('site-search')),
    'focus returns to the input').toBe(true);

  // narrow: item 4's budgeted band is untouched
  for (const w of [390, 375, 360, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/index.html');
    await page.fill('#site-search', 'demon');
    await expect(x, `the ✕ must stay out of the ${w}px band`).toBeHidden();
    const m = await page.evaluate(() => ({
      acct: Math.round(document.querySelector('#auth-open').getBoundingClientRect().right),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(m.acct, `account button reachable at ${w}px`).toBeLessThanOrEqual(w);
    expect(m.over, `no overflow at ${w}px`).toBeLessThanOrEqual(0);
  }
});
