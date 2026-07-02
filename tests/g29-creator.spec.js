// g29 — v1.10.2: THE CREATOR SHEET + the account-page nav.
// HEART pins: the gold dressing is .is-creator-scoped — a MEMBER sheet can
// never wear it; the Creator sheet never carries the Appreciate count.
const { test, expect } = require('@playwright/test');

const GOLD = ['255, 213, 74', '#ffd54a'];

test('g29 (heart): the gold kicker + den path are .is-creator-ONLY — member sheets stay purple', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const probe = (cls) => {
      const sheet = document.createElement('section');
      sheet.className = cls;
      sheet.innerHTML = '<div class="profile-kicker">K</div>';
      document.body.appendChild(sheet);
      const c = getComputedStyle(sheet.querySelector('.profile-kicker')).color;
      sheet.remove();
      return c;
    };
    return { member: probe('profile-sheet'), creator: probe('profile-sheet is-creator') };
  });
  expect(m.creator).toBe('rgb(255, 213, 74)');        // GOLD — his mark
  expect(m.member).not.toBe('rgb(255, 213, 74)');     // members never
});

test('g29 (heart): the den-path button is gold and its CSS exists once', async ({ page }) => {
  const css = await (await page.request.get('/style.css')).text();
  const block = css.slice(css.indexOf('.profile-den-path {'), css.indexOf('.profile-den-path {') + 600);
  expect(block).toContain('#ffd54a');
  // the gold stays scoped to the creator machinery — the accent palette is untouched
  expect(css).not.toMatch(/data-accent="[^"]*"\]\s*\{[^}]*ffd54a/);
});

test('g29: the Creator branch renders no Appreciate row and no report flag (source pins)', async ({ page }) => {
  const src = await (await page.request.get('/script.js')).text();
  expect(src).toContain("return 'creator'");                              // the decision
  expect(src).toMatch(/likesCount: isCreator \? undefined/);              // gold is never counted
  expect(src).toMatch(/isCreator \? '' : '<button type="button" class="profile-report"/); // no flag on the owner
  expect(src).toContain('profile-den-path');                              // the path home exists
  expect(src).toContain('function goHomeToDen');                          // and closes every layer
});

test('g29: the account page carries the FULL tool set (View All · Random · Filter)', async ({ page }) => {
  const html = await (await page.request.get('/account.html')).text();
  expect(html).toContain('id="view-all-btn"');
  expect(html).toContain('id="random-btn"');
  expect(html).toContain('id="filter-btn"');
  expect(html).toContain("index.html?open=random");
  expect(html).toContain("index.html?open=filter");
  // the boot handler honors the routes through the SAME wired buttons
  const src = await (await page.request.get('/script.js')).text();
  expect(src).toMatch(/searchParams|URLSearchParams\(location\.search\)\.get\('open'\)/);
  expect(src).toMatch(/_open === 'random' \|\| _open === 'filter'/);
});

test('g29: ?open=filter REALLY opens the filter panel after boot (door pre-dismissed)', async ({ page }) => {
  // adversarial MED: the first cut of this spec asserted aria-expanded only —
  // the exact attribute the boot-reset bug left stuck 'true' on an INVISIBLE
  // panel (false-green). Pin the open class AND painted visibility.
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
  await page.goto('/index.html?open=filter');
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const panel = document.getElementById('filter-panel');
    const cs = panel ? getComputedStyle(panel) : null;
    return {
      expanded: document.getElementById('filter-btn')?.getAttribute('aria-expanded'),
      open: !!(panel && panel.classList.contains('open')),
      opacity: cs ? cs.opacity : '0',
      pointer: cs ? cs.pointerEvents : 'none',
    };
  });
  expect(m.expanded).toBe('true');
  expect(m.open).toBe(true);            // the class the boot reset stripped
  expect(m.opacity).toBe('1');          // PAINTED, not just attributed
  expect(m.pointer).not.toBe('none');
});
