// g25 — GATE 20.6 contracts (Blake's 20.5-smoke polish round).
// 1. Every gradient accent pair is a REAL two-color pair (the round-3 root
//    cause was analogous stops reading solid on a thin ring).
// 2. Brightness parity: the profile background renders at FULL opacity and the
//    scrim is the two LOCALIZED caps, never a whole-card dim (both surfaces).
// 3. The cropper captures at 4:3 (the 16:9 stage was why the render chopped
//    what the preview promised).
// 4. The un-reviewed room lead-in is Blake's sentence VERBATIM.
// 5. The update-log tier label is "Major Update" (visitor copy).
// 6. The backgrounds requirements line is the spec-chip form.
// 7. The flat-four frames keep their personality layers (item 9 latitude).
const { test, expect } = require('@playwright/test');

const GRADIENT_KEYS = ['g-nebula', 'g-ember', 'g-ocean', 'g-meadow', 'g-dusk', 'g-sakura'];

test('20.6 (2): every gradient pair reads as TWO colors (no analogous stops)', async ({ page }) => {
  await page.goto('/index.html');
  const pairs = await page.evaluate((keys) => {
    const out = {};
    for (const k of keys) {
      const el = document.createElement('div');
      el.className = 'acct-preview';
      el.setAttribute('data-accent', k);
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      out[k] = { a: cs.getPropertyValue('--pf-accent').trim(), b: cs.getPropertyValue('--pf-accent2').trim() };
      el.remove();
    }
    return out;
  }, GRADIENT_KEYS);
  const rgb = (hex) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  for (const k of GRADIENT_KEYS) {
    const { a, b } = pairs[k];
    expect(a, `${k} stop 1 resolves`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(b, `${k} stop 2 resolves`).toMatch(/^#[0-9a-f]{6}$/i);
    const [r1, g1, b1] = rgb(a); const [r2, g2, b2] = rgb(b);
    const delta = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
    // nebula (the pair Blake called readable) scores 141 — every pair must
    // clear a 120 floor so no future tweak slides back to near-solid.
    expect(delta, `${k} two stops must differ strongly (Δ=${delta})`).toBeGreaterThanOrEqual(120);
  }
});

test('20.6 (2): the gradient ring anchors each color to a corner before the blend', async ({ page }) => {
  await page.goto('/index.html');
  const bg = await page.evaluate(() => {
    const host = document.createElement('div');
    host.className = 'acct-preview';
    host.setAttribute('data-accent', 'g-ember');
    const ring = document.createElement('span');
    ring.className = 'pf-accent-ring';
    host.appendChild(ring);
    document.body.appendChild(host);
    const cs = getComputedStyle(ring);
    return { image: cs.backgroundImage, padding: cs.padding };
  });
  expect(bg.image).toContain('linear-gradient');
  expect(bg.image).toContain('22%');   // stop 1 holds its corner
  expect(bg.image).toContain('78%');   // stop 2 holds its corner
  expect(bg.padding).toBe('4px');      // the bolder gradient edge
});

test('20.6 (1b): the background renders FULL brightness with localized caps, both surfaces', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const probe = (hostCls, wrapCls, imgCls) => {
      const host = document.createElement('div');
      host.className = hostCls;
      const wrap = document.createElement('span');
      wrap.className = wrapCls;
      const img = document.createElement('img');
      if (imgCls) img.className = imgCls;
      wrap.appendChild(img);
      host.appendChild(wrap);
      document.body.appendChild(host);
      const imgCs = getComputedStyle(img);
      const afterCs = getComputedStyle(wrap, '::after');
      const layers = (afterCs.backgroundImage.match(/linear-gradient\(/g) || []).length;
      const r = { opacity: imgCs.opacity, layers };
      host.remove();
      return r;
    };
    return {
      sheet: probe('profile-sheet has-bg', 'profile-bg-wrap', 'profile-bg'),
      hero: probe('acct-preview acct-preview--hero', 'acct-preview-bg', ''),
    };
  });
  // full brightness — the 0.38 dim is dead on BOTH surfaces
  expect(m.sheet.opacity).toBe('1');
  expect(m.hero.opacity).toBe('1');
  // the scrim is exactly the two localized caps (top cap + bottom floor)
  expect(m.sheet.layers).toBe(2);
  expect(m.hero.layers).toBe(2);
});

test('20.6 (1a): the cropper captures the card window at 4:3, not 16:9', async ({ page }) => {
  await page.goto('/index.html');
  await page.addScriptTag({ type: 'module', content: "import './cropper.js';" });
  await page.waitForFunction(() => window.cropperModel && window.cropperModel.bgAspect);
  const aspect = await page.evaluate(() => window.cropperModel.bgAspect);
  expect(aspect).toBeCloseTo(4 / 3, 3);
});

test('20.6 (3): the un-reviewed room lead-in is Blake\'s sentence verbatim', async ({ page }) => {
  const res = await page.request.get('/script.js');
  const src = await res.text();
  expect(src).toContain('I haven’t reviewed this one (yet). Feel free to discuss anyway.');
  expect(src).not.toContain('the room’s open anyway');   // the old refinement is gone
});

test('20.6 (7): the update-log tier label reads "Major Update" (visitor copy)', async ({ page }) => {
  const res = await page.request.get('/index.html');
  const html = await res.text();
  expect(html).not.toContain('Big Update');
  expect((html.match(/Major Update/g) || []).length).toBeGreaterThanOrEqual(1);
  // the rename is label-only: the purple "big" rail keys stay untouched
  expect(html).toContain('data-tier="big"');
});

test('20.6 (8): the backgrounds requirements line is the branded spec-chip form', async ({ page }) => {
  // static-markup pin (account.html redirects signed-out, so no DOM mount here)
  const res = await page.request.get('/account.html');
  const html = await res.text();
  expect((html.match(/class="acct-bg-spec"/g) || []).length).toBe(3);
  expect((html.match(/class="acct-bg-fine"/g) || []).length).toBe(1);
  expect(html).toContain('They follow the community rules and can be reported.');
  const css = await (await page.request.get('/style.css')).text();
  expect(css).toContain('.acct-bg-spec');   // the chip styling actually exists
});

test('20.6 (adversarial MED): mid-card surfaces carry their own plates when a background is live', async ({ page }) => {
  // the midband has NO cap by design (full-brightness picture), so rows/tabs/
  // tags/panels must each carry a real plate on a has-bg sheet — without one,
  // white-on-bright-image text measured 1.5-2.8:1 in the panel's audit.
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const sheet = document.createElement('div');
    sheet.className = 'profile-sheet has-bg';
    sheet.innerHTML = '<button class="profile-act-chip">t</button>'
      + '<button class="profile-act-chip is-active">a</button>'
      + '<li class="profile-item">r</li><span class="profile-tag">x</span>'
      + '<div class="profile-featured">f</div><div class="profile-col">c</div>';
    document.body.appendChild(sheet);
    const alpha = (el) => {
      const mm = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
      const p = mm ? mm[1].split(',') : [];
      return p.length === 4 ? parseFloat(p[3]) : (p.length === 3 ? 1 : 0);
    };
    const r = {
      chip: alpha(sheet.querySelector('.profile-act-chip:not(.is-active)')),
      active: alpha(sheet.querySelector('.profile-act-chip.is-active')),
      item: alpha(sheet.querySelector('.profile-item')),
      tag: alpha(sheet.querySelector('.profile-tag')),
      featured: alpha(sheet.querySelector('.profile-featured')),
      col: alpha(sheet.querySelector('.profile-col')),
    };
    sheet.remove();
    return r;
  });
  for (const [k, a] of Object.entries(m)) {
    expect(a, `${k} plate must be a real backdrop (alpha=${a})`).toBeGreaterThanOrEqual(0.5);
  }
});

test('20.6 (9): the flat-four frames keep their personality layers', async ({ page }) => {
  await page.goto('/index.html');
  await page.addStyleTag({ url: '/frames.css' });
  const counts = await page.evaluate(() => {
    const probe = (key) => {
      const el = document.createElement('div');
      el.className = 'acct-preview';
      el.setAttribute('data-frame', key);
      document.body.appendChild(el);
      const n = (getComputedStyle(el, '::after').backgroundImage.match(/url\(/g) || []).length;
      el.remove();
      return n;
    };
    return { ember: probe('ember'), tide: probe('tide'), storm: probe('storm'), moonlit: probe('moonlit') };
  });
  expect(counts.ember).toBe(2);     // bonfire heart + the running flame line
  expect(counts.tide).toBe(2);      // crisp crest + the far swell
  expect(counts.storm).toBe(3);     // two unequal strikes + the distant fork
  expect(counts.moonlit).toBe(3);   // moon + two drifting mist bands
});
