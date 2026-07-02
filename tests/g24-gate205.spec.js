const { test, expect } = require('./welcomed');

// GATE 20.5 — static contracts: the frame-theme system (incl. Blake's
// rules-exclusive gold frame), the true-gradient accent ring, the catch-up
// sheet, rooms-everywhere, and the door's final shape.

test('20.5 (9b): the frame manifest carries 13 themes; only blake is exclusive; keys mirror the rules enum', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => Array.isArray(window.RAR_FRAMES));
  const m = await page.evaluate(() => ({
    keys: window.RAR_FRAMES.map((f) => f.key),
    exclusives: window.RAR_FRAMES.filter((f) => f.blakeOnly).map((f) => f.key),
    labeled: window.RAR_FRAMES.every((f) => f.label && f.jp),
  }));
  expect(m.keys).toEqual(['vines', 'stone', 'cosmos', 'witch', 'clover', 'journey', 'shadow',
    'sakura', 'ember', 'tide', 'storm', 'moonlit', 'blake']);   // the 3-way lock-step list
  expect(m.exclusives).toEqual(['blake']);
  expect(m.labeled).toBe(true);
});

test('20.5 (9b): a frame decorates the sheet edge; gold lives ONLY in the blake theme', async ({ page, request }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'profile-sheet';
    el.setAttribute('data-frame', 'witch');
    document.body.appendChild(el);
    const before = getComputedStyle(el, '::before');
    const out = { witchDecor: before.content !== 'none' || before.backgroundImage !== 'none' };
    el.setAttribute('data-frame', 'blake');
    const bb = getComputedStyle(el, '::before');
    out.blakeDecor = bb.content !== 'none' || bb.backgroundImage !== 'none';
    el.remove(); return out;
  });
  expect(m.witchDecor).toBe(true);
  expect(m.blakeDecor).toBe(true);
  // the heart grep: every gold hex in frames.css belongs to the Den's own
  // assets (the --rarf-den-* SVG URIs / the blake-section comment) — no USER
  // theme may carry one.
  const css = await (await request.get('/frames.css')).text();
  const goldLines = css.split('\n').filter((l) => /ffd54a|ffe082|ffb300/i.test(l));
  expect(goldLines.length).toBeGreaterThan(0);          // the Den Keeper IS gold
  const strays = goldLines.filter((l) => !/--rarf-den-|GOLD/.test(l));
  expect(strays).toEqual([]);                            // and gold lives nowhere else
});

test('20.5 (9): the accent ring is a REAL gradient layer on the card edge', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const host = document.createElement('div');
    host.className = 'profile-sheet';
    host.setAttribute('data-accent', 'g-nebula');
    host.style.cssText = 'position:relative;width:300px;height:160px;border-radius:14px;';
    const ring = document.createElement('span');
    ring.className = 'pf-accent-ring';
    host.appendChild(ring);
    document.body.appendChild(host);
    const cs = getComputedStyle(ring);
    const out = {
      visible: cs.opacity === '1',
      gradient: cs.backgroundImage.includes('linear-gradient'),
      twoStops: cs.backgroundImage.includes('rgb(187, 134, 252)') && cs.backgroundImage.includes('rgb(244, 143, 177)'),
      fullEdge: cs.position === 'absolute' && cs.inset === '0px',
    };
    host.remove(); return out;
  });
  expect(m.visible).toBe(true);
  expect(m.gradient).toBe(true);    // round 4 faked this with two solid rings — never again
  expect(m.twoStops).toBe(true);    // both stops resolve from the accent map
  expect(m.fullEdge).toBe(true);    // the WHOLE card edge, not just the avatar
});

test('20.5 (10): rooms render everywhere — the non-watched lead-in carries Blake\'s voice', async ({ request }) => {
  const js = await (await request.get('/script.js')).text();
  expect(js).toContain('function seasonRoomHtml(');
  expect(js).toContain('THE ROOM');
  expect(js).toContain('I haven’t reviewed this one (yet)');
  // the watched-gate conditional is gone from the room builder's call site
  expect(js).not.toContain('meta.alId && isWatched)');
  // and the decouple: the error branch mounts the room band too
  const errIdx = js.indexOf("state === 'error' || !detail");
  const errBlock = js.slice(errIdx, errIdx + 900);
  expect(errBlock).toContain('secondary-room-band');
});

test('20.5 (3): the catch-up sheet exists, [hidden]-symmetric, with its sections machinery', async ({ page, request }) => {
  const html = await (await request.get('/index.html')).text();
  expect(html).toContain('id="catchup-sheet"');
  expect(html).toContain('WHILE YOU WERE AWAY');
  await page.goto('/index.html');
  const d = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'catchup-sheet'; el.setAttribute('hidden', '');
    document.body.appendChild(el);
    const v = getComputedStyle(el).display;
    el.remove(); return v;
  });
  expect(d).toBe('none');
  const js = await (await request.get('/script.js')).text();
  expect(js).toContain('function openCatchupSheet(');
  expect(js).toContain('NEW FROM BLAKE');
});

test('20.5 (4+7): the renames hold — no "Blake\'s 44" or "Message Blake" left visitor-facing', async ({ request }) => {
  const acct = await (await request.get('/account.html')).text();
  expect(acct).not.toContain("Blake's 44");
  expect(acct).toContain("Blake's reviews");
  // gate A2: the "DM Blake" hero card died with the peer flip (Blake's word:
  // "Replace with dms and stuff normally.") — the phrase leaves with it.
  expect(acct).not.toContain('DM Blake');
  expect(acct).not.toContain('Message Blake');
});

test('20.5 (hardening): generation token + close-window guard + Tab containment are wired', async ({ request }) => {
  const js = await (await request.get('/script.js')).text();
  expect(js).toContain('secondaryLoadGen');
  expect(js).toContain('gen === secondaryLoadGen');
  expect(js).toContain("classList.contains('active')");
  const keydownIdx = js.indexOf('function onSecondaryKeydown');
  const keydownBlock = js.slice(keydownIdx, keydownIdx + 1600);
  expect(keydownBlock).toContain("e.key === 'Tab'");
});

test('20.5 (frame picker): the studio carries the Frame row + the tile chrome', async ({ page, request }) => {
  const html = await (await request.get('/account.html')).text();
  expect(html).toContain('id="acct-frames"');
  expect(html).toContain('frames.css');
  expect(html).toContain('frames.js');
  const idx = await (await request.get('/index.html')).text();
  expect(idx).toContain('frames.css');   // viewers render frames too
  expect(idx).toContain('frames.js');
  await page.goto('/index.html');
  const sw = await page.evaluate(() => {
    const el = document.createElement('span');
    el.className = 'frame-swatch'; el.setAttribute('data-frame', 'cosmos');
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const v = cs.backgroundImage !== 'none' || cs.borderTopWidth !== '0px';
    el.remove(); return v;
  });
  expect(sw).toBe(true);   // the swatch tiles carry real art
});
