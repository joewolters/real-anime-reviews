// g30 — v1.10.2R: the member-reported prod bugs, pinned at the root.
// (a) the pinned-review picker's 60-option menu crushed its rows (flex
//     min-height collapse under overflow:hidden) — pinned with a REAL render;
// (b) the Admin FAB's relative hrefs doubled under /admin/ → /admin/admin/404.
const { test, expect } = require('@playwright/test');

test('g30 (bug 3a): a 60-option brand-select menu keeps full-height rows and scrolls', async ({ page }) => {
  // probe on index (same style.css) — account.html's signed-out boot navigates
  // and would race the evaluate (context-destroyed flake)
  await page.goto('/index.html');
  await page.waitForLoadState('load');
  const m = await page.evaluate(() => {
    // the real component shape from brandSelect(): wrap > menu > 60 opts
    const wrap = document.createElement('div');
    wrap.className = 'acct-dd-wrap';
    const menu = document.createElement('div');
    menu.className = 'acct-dd-menu';
    for (let i = 0; i < 60; i++) {
      const b = document.createElement('button');
      b.className = 'acct-dd-opt';
      b.textContent = 'One Punch Man — 9/10 (option ' + i + ')';
      menu.appendChild(b);
    }
    wrap.appendChild(menu);
    document.body.appendChild(wrap);
    const rows = menu.querySelectorAll('.acct-dd-opt');
    const first = rows[0].getBoundingClientRect();
    const second = rows[1].getBoundingClientRect();
    const out = {
      rowHeight: first.height,
      overlap: second.top < first.bottom - 1,      // rows may never paint into each other
      menuScrolls: menu.scrollHeight > menu.clientHeight + 40,  // the cap overflows → scrollbar, not a crush
    };
    wrap.remove();
    return out;
  });
  expect(m.rowHeight).toBeGreaterThan(20);   // a crushed row measured ~3px
  expect(m.overlap).toBe(false);
  expect(m.menuScrolls).toBe(true);
});

test('g30 (bug 3b): every Admin FAB destination is root-absolute — no /admin/admin doubling', async ({ page }) => {
  const src = await (await page.request.get('/admin-fab.js')).text();
  const hrefs = [...src.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
  expect(hrefs.length).toBeGreaterThan(3);   // the menu really was parsed
  for (const h of hrefs) {
    expect(h.startsWith('/')).toBe(true);    // relative hrefs double under /admin/
  }
});

test('g30 (bug 3c): the suggestion queue carries the expandable detail view', async ({ page }) => {
  const js = await (await page.request.get('/admin/suggestions.js')).text();
  expect(js).toContain('nameFor');           // requester resolves profiles → users fallback
  expect(js).toContain('submitterUid');
  expect(js).toContain('aria-expanded');     // the row is a real, accessible toggle
  expect(js).toContain('Anonymous');         // pre-gate-20.5 docs stay honest
  const css = await (await page.request.get('/admin/suggestions.css')).text();
  expect(css).toContain('.row-detail[hidden]');                    // the [hidden] twin
  const meta = css.slice(css.indexOf('.suggestion-row .meta {'));
  expect(meta.slice(0, meta.indexOf('}'))).toContain('flex-wrap: wrap');  // the NEW-badge clip, root-fixed
});

test('g30 (bug 3b): admin pages say plainly what needs Mode 1 — and never name a provider', async ({ page }) => {
  const na = await (await page.request.get('/admin/new-anime.html')).text();
  expect(na).toContain('mode-notice');                             // the dual-mode banner exists
  expect(na).toMatch(/\.mode-notice\[hidden\]\s*\{\s*display:\s*none/);
  for (const p of ['/admin/chat-drawer.js', '/admin/new-anime.js', '/admin/quotes.html', '/admin/season-reviews.html']) {
    const src = await (await page.request.get(p)).text();
    // provider names may never render (the /i anthropic net + the brand-cased
    // OpenAI — a bare /openai/i would false-match the removed openAiPanel
    // identifier in a history comment)
    expect(src).not.toMatch(/anthropic/i);
    expect(src).not.toMatch(/OpenAI/);
    expect(src).toContain('Mode 1');                               // the plain-English notice voice
  }
});
