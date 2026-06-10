const { test, expect } = require('./welcomed');

// ROUND 3 + GATE 19 — static contracts: the site-wide focus discipline, the
// bright lantern headings, and the per-season comments routing seams.

test('FOCUS DISCIPLINE: keyboard focus wears the branded purple ring — never the UA default', async ({ page }) => {
  await page.goto('/index.html');
  // a bare unstyled control (no component ring) must still get the floor ring
  const m = await page.evaluate(() => {
    const b = document.createElement('button');
    b.textContent = 'probe'; b.id = 'focus-probe';
    document.body.appendChild(b);
    return true;
  });
  expect(m).toBe(true);
  await page.focus('#focus-probe');
  const o = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('focus-probe'));
    return { color: cs.outlineColor, style: cs.outlineStyle, width: cs.outlineWidth };
  });
  // the ring is the purple family (rgba(187,134,252,.85)) and not 'auto'/UA blue
  expect(o.style).toBe('solid');
  expect(o.color.replace(/\s/g, '')).toContain('187,134,252');
  await page.evaluate(() => document.getElementById('focus-probe').remove());
});

test('FOCUS DISCIPLINE: mouse focus shows NO outline (the :focus reset holds)', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.textContent = 'probe2'; b.id = 'focus-probe2';
    b.style.cssText = 'position:fixed;left:20px;top:20px;z-index:99999;';
    document.body.appendChild(b);
  });
  await page.click('#focus-probe2');
  const o = await page.evaluate(() => getComputedStyle(document.getElementById('focus-probe2')).outlineStyle);
  expect(o).toBe('none');
  await page.evaluate(() => document.getElementById('focus-probe2').remove());
});

test('round 3: panel headings are BRIGHT + big, with the lantern on the door', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const wrap = document.createElement('header'); wrap.className = 'panel-head';
    const txt = document.createElement('div'); txt.className = 'panel-head-text';
    const h = document.createElement('h3'); h.className = 'acct-kicker'; h.textContent = 'PROBE';
    txt.appendChild(h); wrap.appendChild(txt); document.body.appendChild(wrap);
    const cs = getComputedStyle(h);
    const before = getComputedStyle(h, '::before');
    const out = { size: parseFloat(cs.fontSize), color: cs.color, lantern: before.content };
    wrap.remove(); return out;
  });
  expect(m.size).toBeGreaterThanOrEqual(19);          // was ~10.5px — "dark and small"
  expect(m.color.replace(/\s/g, '')).toContain('246,239,255');   // #f6efff — full bright
  expect(m.lantern).toContain('🏮');                   // the lantern decoration
});

test('gate 19: the per-season key + the secondary deep-link bridge exist', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.communityKey === 'function' && typeof window.parseNotifTarget === 'function');
  const m = await page.evaluate(() => ({
    alKey: window.communityKey({ aniListId: 21386 }),
    catalogKey: window.communityKey({ Title: 'One punch man' }),
    parsed: window.parseNotifTarget('comments/al:21386/items/seed-s0'),
    bridge: typeof window.openSecondaryFromKey,
  }));
  expect(m.alKey).toBe('al:21386');                    // the season room's collection key
  expect(m.catalogKey).toBe('one-punch-man');          // catalog behavior unchanged
  expect(m.parsed).toEqual({ kind: 'comment', slug: 'al:21386', id: 'seed-s0' });
  expect(m.bridge).toBe('function');                   // a comments/al: notif can land on the secondary
});
