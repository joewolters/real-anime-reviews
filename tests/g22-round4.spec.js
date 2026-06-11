const { test, expect } = require('./welcomed');

// ROUND 4 — static contracts. The two RECURRING fixes get their durable
// tripwires here. The dim-heading bug was NEVER a color value — the bare
// `header` site-header rules matched every semantic <header> in the app and
// painted their ::before scrim OVER the static heading text (computed color
// said #f6efff while the pixels said dim — three rounds of recoloring passed
// computed-style specs and changed nothing). The contract is therefore about
// RULE SCOPE, not color: a nested <header> must carry none of the site-header
// machinery, and the real body-level header must keep all of it.

test('recurring #1 ROOT CAUSE: a nested <header class=panel-head> carries NO leaked site-header machinery', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    // the REAL panel-head shape: nested (account panels are never body children)
    const host = document.createElement('div');
    host.innerHTML = '<header class="panel-head"><div class="panel-head-text">'
      + '<h3 class="acct-kicker">PROBE</h3></div></header>';
    document.body.appendChild(host);
    const ph = host.querySelector('.panel-head');
    const cs = getComputedStyle(ph);
    const before = getComputedStyle(ph, '::before');
    const kicker = getComputedStyle(ph.querySelector('.acct-kicker'));
    const out = {
      pos: cs.position, height: cs.height,
      scrim: before.content,                       // 'none' = no leaked ::before
      kColor: kicker.color, kSize: parseFloat(kicker.fontSize),
    };
    host.remove(); return out;
  });
  expect(m.pos).not.toBe('sticky');                // the site-header sticky must not leak
  expect(m.height).not.toBe('80px');               // nor its fixed height
  expect(m.scrim).toBe('none');                    // THE tripwire: no scrim over headings
  expect(m.kColor.replace(/\s/g, '')).toContain('246,239,255');
  expect(m.kSize).toBeGreaterThanOrEqual(19);
});

test('recurring #1 flip-side: the REAL site header keeps its backdrop (scoping did not strip it)', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const h = document.querySelector('body > header');
    const cs = getComputedStyle(h);
    const before = getComputedStyle(h, '::before');
    return {
      pos: cs.position, bg: before.backgroundImage,
      inner: getComputedStyle(h.querySelector('.header-inner')).zIndex,
    };
  });
  expect(['sticky', 'fixed']).toContain(m.pos);
  expect(m.bg).toContain('linear-gradient');       // the premium backdrop survives
  expect(m.inner).toBe('1');                       // content stays above it
});

test('round 4: the tavern header owns its row layout (it used to borrow the leaked one)', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = '<header class="hub-header hub-header--tavern"></header>';
    document.body.appendChild(host);
    const cs = getComputedStyle(host.firstChild);
    const out = { display: cs.display, height: cs.height, justify: cs.justifyContent };
    host.remove(); return out;
  });
  expect(m.display).toBe('flex');
  expect(m.height).toBe('80px');
  expect(m.justify).toBe('space-between');
});

test('round 4: the heading subtext wears the pill + Blake\'s new constellation copy', async ({ page, request }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="panel-head-text"><p class="acct-section-sub">probe</p></div>';
    document.body.appendChild(host);
    const cs = getComputedStyle(host.querySelector('.acct-section-sub'));
    const out = { radius: cs.borderRadius, border: cs.borderTopWidth, display: cs.display };
    host.remove(); return out;
  });
  expect(m.radius).toContain('999');               // pill
  expect(m.border).toBe('1px');                    // bordered, not loose text
  expect(m.display).toBe('inline-flex');
  const html = await (await request.get('/account.html')).text();
  expect(html).toContain('Customize your profile, bio, send messages and more');
});

test('recurring #2: ZERO native <select> in the account page markup; branded hosts stand ready', async ({ request }) => {
  const html = await (await request.get('/account.html')).text();
  expect(html).not.toContain('<select');
  expect(html).toContain('id="acct-featured-host"');
  expect((html.match(/data-sort-dd/g) || []).length).toBe(2);
  // and the wiring exists (the factory + both call sites)
  const js = await (await request.get('/account.js')).text();
  expect(js).toContain('function brandSelect(');
  expect((js.match(/brandSelect\(\{/g) || []).length).toBeGreaterThanOrEqual(3);
});

test('round 4: the cropper module loads and its cover-clamp math holds', async ({ page }) => {
  await page.goto('/index.html');
  await page.addScriptTag({ type: 'module', content: "import './cropper.js';" });
  await page.waitForFunction(() => window.cropperModel && typeof window.cropperModel.coverClamp === 'function');
  const m = await page.evaluate(() => {
    const c = window.cropperModel.coverClamp;
    // a 1000x500 image in a 280x280 view: cover scale must fill the SHORT side
    const fit = c(1000, 500, 280, 280, 0.1, 0, 0);
    // panned way out of bounds at scale 1 — x/y must clamp back into coverage
    const clamped = c(1000, 500, 280, 280, 1, 500, 500);
    return { minScale: fit.minScale, x: clamped.x, y: clamped.y };
  });
  expect(m.minScale).toBeCloseTo(280 / 500, 3);    // the short side rules cover
  expect(m.x).toBeLessThanOrEqual(0);              // the image edge never leaves the frame
  expect(m.y).toBeLessThanOrEqual(0);
});

test('round 4: the accent map carries gradients + glow + pearl, and still owns no gold', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'acct-preview';
    el.setAttribute('data-accent', 'g-nebula');
    el.setAttribute('data-accent-glow', '');
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const out = {
      a1: cs.getPropertyValue('--pf-accent').trim(),
      a2: cs.getPropertyValue('--pf-accent2').trim(),
      glow: cs.boxShadow,
    };
    el.setAttribute('data-accent', 'pearl');
    out.pearl = getComputedStyle(el).getPropertyValue('--pf-accent').trim();
    el.remove(); return out;
  });
  expect(m.a1).toBe('#bb86fc');
  expect(m.a2).toBe('#f48fb1');                    // a real two-stop gradient key
  expect(m.glow).not.toBe('none');                 // the glow switch glows
  expect(m.pearl).toBe('#e3e1ec');
  // heart: no gold-family accent may exist (Blake's color is not on this menu)
  const goldLeak = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
      for (const r of rules) {
        if (r.selectorText && /data-accent=/.test(r.selectorText)
          && /ffd54a|gold/i.test(r.cssText)) return r.selectorText;
      }
    }
    return '';
  });
  expect(goldLeak).toBe('');
});

test('round 4: profile-modal kickers joined the bright rule', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const k = document.createElement('div'); k.className = 'profile-kicker';
    const f = document.createElement('span'); f.className = 'profile-featured-kicker';
    document.body.appendChild(k); document.body.appendChild(f);
    const out = { k: getComputedStyle(k).color, f: getComputedStyle(f).color };
    k.remove(); f.remove(); return out;
  });
  expect(m.k.replace(/\s/g, '')).toContain('246,239,255');
  expect(m.f.replace(/\s/g, '')).toContain('246,239,255');
});

test('round 4: personal collections — rail item + panel + composer (hidden at rest) + consent-fronted publish', async ({ request }) => {
  const html = await (await request.get('/account.html')).text();
  expect(html).toContain('data-tab="collections"');
  expect(html).toContain('id="tab-collections"');
  expect(html).toContain('id="col-composer" hidden');
  expect(html).toContain('id="col-new"');
  expect(html).toContain('Personal Collections');
  const js = await (await request.get('/account.js')).text();
  // publishing rides the ONE consent implementation (never a second modal)
  const colBlock = js.slice(js.indexOf('PERSONAL COLLECTIONS'));
  expect(colBlock).toContain('ensureConsent(');
  // covers on this sink are scheme-gated (the hubSafeCover discipline)
  expect(js).toContain('function colSafeCover(');
});

test('gate 20: the season room is a FULL-WIDTH bottom band (after the body, before MORE LIKE THIS) and the review DOM-precedes it', async ({ page }) => {
  // round 4's left rail misread Blake's item 9 — the room now lives in a wide
  // band under the columns (his circled spot). The contract: band markup sits
  // BETWEEN .secondary-body and the recs block, the band spans the modal, and
  // BLAKE'S REVIEW still precedes the room in DOM order (H5).
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.style.width = '1000px';
    wrap.innerHTML = '<div class="secondary-body"><div class="secondary-col secondary-col--main"><section class="secondary-review"></section></div>'
      + '<div class="secondary-col secondary-col--side"></div></div>'
      + '<div class="secondary-room-band"><section class="secondary-community"></section></div>'
      + '<div class="secondary-recs-block"></div>';
    document.body.appendChild(wrap);
    const body = wrap.querySelector('.secondary-body');
    const band = wrap.querySelector('.secondary-room-band');
    const recs = wrap.querySelector('.secondary-recs-block');
    const review = wrap.querySelector('.secondary-review');
    const out = {
      bandAfterBody: !!(body.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING),
      bandBeforeRecs: !!(band.compareDocumentPosition(recs) & Node.DOCUMENT_POSITION_FOLLOWING),
      bandWide: band.getBoundingClientRect().width >= wrap.getBoundingClientRect().width * 0.95,
      reviewFirst: !!(review.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING),
      scrollCap: getComputedStyle(band.querySelector('.secondary-community')).marginTop,
    };
    wrap.remove(); return out;
  });
  expect(m.bandAfterBody).toBe(true);              // under the columns (LINKS included)
  expect(m.bandBeforeRecs).toBe(true);             // above MORE LIKE THIS
  expect(m.bandWide).toBe(true);                   // "pretty wide to fit the secondary modal"
  expect(m.reviewFirst).toBe(true);                // H5: his voice precedes the room
  expect(m.scrollCap).toBe('0px');                 // the band styling is live
});

test('round 4: catalog saved rows wear the rich cover treatment (CSS contract)', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const li = document.createElement('li'); li.className = 'saved-item';
    li.innerHTML = '<button class="saved-open saved-open--catalog saved-open--rich">'
      + '<span class="saved-cover saved-cover--ph"></span>'
      + '<span class="saved-meta"><span class="saved-title">probe</span>'
      + '<span class="saved-reviewed">✓ REVIEWED</span></span></button>';
    document.body.appendChild(li);
    const cov = getComputedStyle(li.querySelector('.saved-cover'));
    const open = getComputedStyle(li.querySelector('.saved-open'));
    const out = { w: cov.width, h: cov.height, display: open.display };
    li.remove(); return out;
  });
  expect(m.w).toBe('42px');
  expect(m.h).toBe('60px');
  expect(m.display).toBe('flex');
});
