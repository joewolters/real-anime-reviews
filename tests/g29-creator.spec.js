// g29 — v1.10.2R: THE CREATOR KICKER + the account-page nav.
// Blake's clarified spec (2026-07-02): his sheet is a MEMBER sheet — his own
// Studio choices, nothing imposed — and the ONE difference is the CREATOR
// kicker. HEART pins: the gold kicker is .is-creator-scoped (a MEMBER sheet
// can never wear it); the Creator sheet never carries the Appreciate count.
const { test, expect } = require('@playwright/test');

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

test('g29 (heart): gold is the KICKER only — the old showcase dressing is gone', async ({ page }) => {
  const css = await (await page.request.get('/style.css')).text();
  // v1.10.2R: the gold door + imposed gold dressing left with the old spec
  expect(css).not.toContain('.profile-den-path');
  expect(css).not.toContain('.is-creator .profile-avatar');
  expect(css).not.toContain('.is-creator .profile-name');
  // the gold stays scoped to the creator kicker — the accent palette is untouched
  expect(css).not.toMatch(/data-accent="[^"]*"\]\s*\{[^}]*ffd54a/);
});

test('g29: the Creator sheet is a MEMBER sheet + kicker — no flag, Appreciate ON, nothing imposed (source pins)', async ({ page }) => {
  const src = await (await page.request.get('/script.js')).text();
  expect(src).toContain("return 'creator'");                              // never a tombstone
  expect(src).not.toMatch(/likesCount: isCreator/);                       // Appreciate rides his sheet (Blake's 2026-07-02 call)
  expect(src).toMatch(/isCreator \? '' : '<button type="button" class="profile-report"/); // no flag on the owner
  // v1.10.2R (Blake's clarified spec): member parity — nothing imposed
  expect(src).not.toContain('profile-den-path');                          // the gold door is gone
  expect(src).not.toContain('goHomeToDen');
  expect(src).not.toMatch(/setAttribute\('data-frame', 'blake'\)/);       // no forced frame default
  // ⚠️ CHANGED DELIBERATELY in PART A item 2. This pinned the one-tab tablist
  // ("Reviews tab for everyone"), which item 2 replaced with the pinned slot +
  // one disclosure door. The POINT of the assertion — the Creator's sheet gets
  // exactly what a member's sheet gets, nothing added and nothing withheld —
  // is unchanged, so it is re-pinned against the control that exists now.
  expect(src).toContain('profile-reviews-slot');                          // the same reviews surface for everyone
  expect(src).not.toMatch(/isCreator[^\n]*profile-reviews-(slot|open)/);  // never conditioned on who it is
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
