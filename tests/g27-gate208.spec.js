// g27 — GATE 20.8 contracts (the two pre-cutover fixes).
// 1. The composer chip is the signed-in user's avatar (★ only signed-out):
//    the shared helper + painter exist, every row composer carries the chip,
//    and the chip CSS clips an img into the disc.
// 2. Profile-card rows close stale overlays BEFORE routing (the content must
//    land ON TOP, never behind the secondary sheet).
const { test, expect } = require('@playwright/test');

test('20.8 (1): the composer-chip machinery exists and every row composer carries it', async ({ page }) => {
  const src = await (await page.request.get('/script.js')).text();
  expect(src).toContain('function composerAvaHTML');
  expect(src).toContain('function paintComposerAvatars');
  // signed-out keeps the star (the helper's null branch)
  expect(src).toMatch(/_selfIdent\) return '<div class="avatar composer-ava" aria-hidden="true">&#9733;/);
  // the four row composers in script.js build through the helper
  expect((src.match(/composerAvaHTML\(\)/g) || []).length).toBeGreaterThanOrEqual(5); // 4 templates + painter/helper uses
  // the DM composer chip (account page)
  const acct = await (await page.request.get('/account.html')).text();
  expect(acct).toContain('id="inbox-self-ava"');
  const accjs = await (await page.request.get('/account.js')).text();
  expect(accjs).toContain('inbox-self-ava');
});

test('20.8 (1): the chip CSS is a 36px disc that clips an avatar img', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const av = document.createElement('div');
    av.className = 'avatar composer-ava';
    av.innerHTML = '<img alt="">';
    document.body.appendChild(av);
    const cs = getComputedStyle(av);
    const ics = getComputedStyle(av.querySelector('img'));
    const r = { w: cs.width, h: cs.height, overflow: cs.overflow, fit: ics.objectFit };
    av.remove();
    return r;
  });
  expect(m.w).toBe('36px');
  expect(m.h).toBe('36px');
  expect(m.overflow).toBe('hidden');
  expect(m.fit).toBe('cover');
});

test('20.8 (2) → LAST CALL B3: profile rows route through the rarNav CASCADE close', async ({ page }) => {
  const src = await (await page.request.get('/script.js')).text();
  expect(src).toContain('function closeStaleOverlays');
  // LAST CALL: the row-routing rides rarNavCascade now — the same top-down
  // close discipline PLUS one history rewind, with the open deferred past the
  // swallowed popstate (the panel's go-vs-push race). The thread branch left
  // with the public Threads tab (A8).
  expect(src).toMatch(/rarNavCascade\(\[closeProfilePage, closeStaleOverlays\]/);
  expect(src).toContain('function rarNavCascade');
  // tertiary closes before secondary (the detail layer lives inside the sheet),
  // and the hub drawer (its own z-6000 layer) is covered too
  const fnBody = src.slice(src.indexOf('function closeStaleOverlays'), src.indexOf('function closeStaleOverlays') + 800);
  expect(fnBody.indexOf('closeTertiary')).toBeLessThan(fnBody.indexOf('closeSecondaryModal'));
  expect(fnBody).toContain('closeHubDrawer');
});
