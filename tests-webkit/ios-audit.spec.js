// Part A item 4 — the WebKit / iOS audit.
// <!-- author: Code | date: 2026-08-09 -->
// ---------------------------------------------------------------------------
// Blake: Safari + Arc on iPhone "do not show the improved mobile work. It looks
// bloated and not optimized… Especially in the deeper modal pages. Like account
// and stuff." And today: on Arc/iPhone the search UI "still feels messy and
// unorganized".
//
// The v2.0 responsive work was only ever verified under Chromium. This runs the
// same surfaces on the engine Blake actually uses. Arc on iOS is WebKit too —
// Apple requires it — so this covers both.
//
// These are MEASUREMENTS, not opinions: horizontal overflow, elements escaping
// the viewport, tap-target sizes, and the input font-size that makes iOS Safari
// zoom the page on focus.
const base = require('@playwright/test');
const test = base.test.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {}
    });
    await use(context);
  },
});
const { expect } = base;

/** Horizontal overflow in CSS px. Anything > 0 means the page scrolls sideways. */
const overflowOf = (page) => page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Every element whose right edge escapes the viewport — names the culprit. */
const escapees = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (r.right > vw + 1 || r.left < -1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: (el.className && String(el.className).slice(0, 60)) || null,
        left: Math.round(r.left), right: Math.round(r.right), vw,
      });
    }
  }
  // de-dupe by class+id so a repeated card doesn't flood the report
  const seen = new Set();
  return out.filter((e) => {
    const k = `${e.tag}#${e.id}.${e.cls}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  }).slice(0, 12);
});

for (const path of ['/', '/account']) {
  test(`${path} — no sideways scroll on iOS`, async ({ page }, testInfo) => {
    await page.goto(path);
    await page.waitForTimeout(600);
    const over = await overflowOf(page);
    if (over > 0) {
      // eslint-disable-next-line no-console
      console.log(`OVERFLOW ${over}px on ${path} @ ${testInfo.project.name}`,
        JSON.stringify(await escapees(page), null, 1));
    }
    await page.screenshot({ path: `tmp-ios-${testInfo.project.name}${path.replace(/\//g, '-') || '-home'}.png`, fullPage: false });
    expect(over, `${path} scrolls sideways by ${over}px`).toBeLessThanOrEqual(0);
  });
}

test('inputs are >=16px so iOS never zooms the page on focus', async ({ page }) => {
  // Under 16px, Safari zooms the whole viewport when an input takes focus —
  // which is exactly what "bloated and not optimized" feels like.
  await page.goto('/');
  await page.waitForTimeout(400);
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('input, textarea, select')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) out.push({ id: el.id || null, cls: String(el.className).slice(0, 50), fontSize: fs });
    }
    return out.slice(0, 10);
  });
  expect(small, `these inputs will zoom the page on focus: ${JSON.stringify(small)}`).toEqual([]);
});

test('the search bar fits and behaves', async ({ page }, testInfo) => {
  // Blake singled this out on Arc/iPhone: "still feels messy and unorganized".
  await page.goto('/');
  await page.waitForTimeout(400);
  const search = page.locator('#site-search');
  if (await search.count() === 0) test.skip(true, 'no #site-search on this page');
  const box = await search.boundingBox();
  const vw = page.viewportSize().width;
  expect(box, 'search bar has a box').toBeTruthy();
  expect(box.x, 'search starts inside the viewport').toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `search overflows: ends at ${Math.round(box.x + box.width)} of ${vw}`)
    .toBeLessThanOrEqual(vw + 1);
  expect(box.height, 'search is a real tap target').toBeGreaterThanOrEqual(36);

  // THE ACTUAL BUG Blake saw: the placeholder rendered as "Search a" — clipped
  // mid-word — because "Search anime…" needs 103px and the pill gives ~50 on a
  // phone. The box FITTING the viewport was never the problem, which is why the
  // earlier assertions all passed while the thing still looked broken.
  const fit = await page.evaluate(() => {
    const el = document.getElementById('site-search');
    const cs = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    probe.style.font = cs.font;
    probe.textContent = el.placeholder || '';
    document.body.appendChild(probe);
    const needs = Math.ceil(probe.getBoundingClientRect().width);
    probe.remove();
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    return { needs, avail: Math.floor(el.getBoundingClientRect().width - pad), text: el.placeholder };
  });
  // +6px of slack, not a squeak: a probe span measures the text box, but the
  // rendered glyph's antialiased edge extends past it, so "fits exactly" still
  // clipped the 'h' in Search on a 320px screen.
  expect(fit.needs + 6, `placeholder "${fit.text}" needs ${fit.needs}px (+6 slack) but only ${fit.avail}px is visible — the last glyph clips`)
    .toBeLessThanOrEqual(fit.avail);
  await page.screenshot({ path: `tmp-ios-${testInfo.project.name}-search.png` });
});

test('tap targets in the header are reachable', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(400);
  const tiny = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('header button, header a, .toolbar button')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 32) out.push({ text: (el.textContent || '').trim().slice(0, 24), h: Math.round(r.height) });
    }
    return out.slice(0, 8);
  });
  expect(tiny, `these header controls are under 32px tall: ${JSON.stringify(tiny)}`).toEqual([]);
});

test('an open anime modal does not exceed the screen', async ({ page }, testInfo) => {
  // "Especially in the deeper modal pages" — the layer Blake called out.
  await page.goto('/?open=charlotte');
  await page.waitForTimeout(1200);
  const modal = page.locator('#anime-modal');
  if (await modal.count() === 0) test.skip(true, 'no modal');
  const visible = await modal.isVisible().catch(() => false);
  if (!visible) test.skip(true, 'modal did not open from the deep link');
  const over = await overflowOf(page);
  if (over > 0) {
    // eslint-disable-next-line no-console
    console.log(`MODAL OVERFLOW ${over}px @ ${testInfo.project.name}`, JSON.stringify(await escapees(page), null, 1));
  }
  await page.screenshot({ path: `tmp-ios-${testInfo.project.name}-modal.png` });
  expect(over, `the open modal scrolls the page sideways by ${over}px`).toBeLessThanOrEqual(0);
});

test('every header control is REACHABLE — none pushed off the right edge', async ({ page }) => {
  // The bug this exists for: the account button sat at x=342-386 regardless of
  // viewport, so on anything under ~390px it was completely off-screen and
  // sign-in was unreachable. There was no sideways scroll to notice (the body
  // clips it) and Chromium desktop never renders this narrow, so nothing caught
  // it. Reachability, not just presence.
  await page.goto('/');
  await page.waitForTimeout(500);
  const bad = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const sel of ['#nav-drawer-toggle', '#site-search', '#notif-btn', '#auth-open']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      if (b.right > vw + 1 || b.left < -1) out.push({ sel, left: Math.round(b.left), right: Math.round(b.right), vw });
    }
    return out;
  });
  expect(bad, `header controls pushed outside the viewport: ${JSON.stringify(bad)}`).toEqual([]);
});

test('the header tokens stay real tap targets on the smallest phone', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  const sizes = await page.evaluate(() => ['#notif-btn', '#auth-open']
    .map((s) => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect(); return { s, w: Math.round(b.width), h: Math.round(b.height) }; })
    .filter(Boolean));
  for (const t of sizes) {
    expect(t.h, `${t.s} is only ${t.h}px tall`).toBeGreaterThanOrEqual(40);
    expect(t.w, `${t.s} is only ${t.w}px wide`).toBeGreaterThanOrEqual(40);
  }
});
