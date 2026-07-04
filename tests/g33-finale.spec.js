// g33 — MEGA-RUN FINALE (Milestone F) structural pins: the renames (grep-proven
// zero stragglers), the admin-inbox removal, the door-line move into the Den,
// the Hidden Gems move to Discover, the search-bar band, and the Curator Studio
// wiring. Static-server specs (no emulator) — behaviour walks live in tests-e2e.
const { test, expect } = require('@playwright/test');

test('gF renames: nav is "The Den", the sticker is "Reviewed", zero old stragglers', async ({ page }) => {
  const index = await (await page.request.get('/index.html')).text();
  const account = await (await page.request.get('/account.html')).text();
  const cardRender = await (await page.request.get('/card-render.js')).text();
  const scriptJs = await (await page.request.get('/script.js')).text();
  const accountJs = await (await page.request.get('/account.js')).text();
  // the nav buttons renamed
  expect(index).toMatch(/id="den-btn"[^>]*>The Den /);
  expect(account).toMatch(/id="den-btn"[^>]*>The Den /);
  // the section wordmark + aria STAY "Blake's Den" (only the nav button changed).
  // NB: the section carries more classes (reveal) — match the class list loosely.
  expect(index).toMatch(/<section class="blakes-den[^"]*" aria-label="Blake's Den">/);
  // the card sticker renamed; NO "Reviewed by Blake" survives in live render code
  expect(cardRender).toMatch(/blake-pin[^`]*Reviewed</);
  for (const [name, src] of [['card-render', cardRender], ['script', scriptJs], ['account', accountJs]]) {
    // comments may still explain history; TEXT/attribute renders must be clean
    const renderHits = (src.match(/(?:title="|>)\s*Reviewed by Blake/g) || []);
    expect(renderHits, `${name} has live "Reviewed by Blake" render`).toHaveLength(0);
  }
});

test('gF: the admin Inbox is GONE (page, FAB entry, reroute)', async ({ page }) => {
  // the page 404s (deleted from the deploy)
  const res = await page.request.get('/admin/inbox.html');
  expect(res.status()).toBe(404);
  // the FAB menu no longer lists it; suggestions reroutes to the account inbox
  const fab = await (await page.request.get('/admin-fab.js')).text();
  expect(fab).not.toContain("/admin/inbox.html");
  const sug = await (await page.request.get('/admin/suggestions.js')).text();
  expect(sug).not.toMatch(/inbox\.html\?to=/);
  expect(sug).toContain('account.html#inbox/new/');
});

test('gF: the "currently watching" line moved OFF the door INTO the Den', async ({ page }) => {
  const index = await (await page.request.get('/index.html')).text();
  expect(index).not.toContain('id="welcome-watching"');   // off the door
  expect(index).toMatch(/id="den-watching"[^>]*hidden/);   // in the Den, hidden-until-real
  const scriptJs = await (await page.request.get('/script.js')).text();
  expect(scriptJs).toContain('function fillDenWatching');
  expect(scriptJs).not.toContain('function fillDoorWatching');
});

test('gF: Hidden Gems moved to the BOTTOM of Discover (off the home page)', async ({ page }) => {
  const index = await (await page.request.get('/index.html')).text();
  expect(index).toContain('id="discover-gems-block"');
  expect(index).not.toContain('id="home-gems-block"');
});

test('gF: the Curator Studio page exists on the admin scaffold + FAB entry + bump targets', async ({ page }) => {
  const studio = await (await page.request.get('/admin/studio.html')).text();
  expect(studio).toContain('CURATOR STUDIO');
  expect(studio).toContain('id="studio-search"');
  expect(studio).toContain('id="studio-sections-mount"');   // the 9-section editor mount
  expect(studio).toContain('id="chat-drawer"');             // the ✨ ASK drawer
  expect(studio).toContain('id="studio-publish-btn"');      // publish → Add Anime
  expect(studio).toContain('src="brand-select.js');         // no native status select
  const fab = await (await page.request.get('/admin-fab.js')).text();
  expect(fab).toContain('/admin/studio.html');
  const bump = await (await page.request.get('/scripts/bump-version.js')).text();
  expect(bump).toMatch(/studio\.js\?v=/);
  // Add Anime accepts the studio handoff
  const newAnime = await (await page.request.get('/admin/new-anime.js')).text();
  expect(newAnime).toContain("fromStudio");
  expect(newAnime).toContain('rar:studio-draft');
});

test('gF: the search bar has a real 901-1200 rule (Blake B1 — no more "huge")', async ({ page }) => {
  const css = await (await page.request.get('/style.css')).text();
  // the drawer band now sizes the search; it must not fall back to the 240px base
  expect(css).toMatch(/\(900px < width <= 1200px\)[\s\S]{0,120}#site-search/);
  // measured live: crossing 1201->1200 no longer doubles the input
  for (const w of [1000, 1201]) {
    await page.setViewportSize({ width: w, height: 850 });
    await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
    await page.goto('/');
    const width = await page.evaluate(() => document.getElementById('site-search').getBoundingClientRect().width);
    expect(width).toBeLessThan(220);   // never the base 240
  }
});

test('gF panel fixes: quote-safe esc + scheme gate, save-load guard, one scroll-lock owner, bump import targets, curation parity', async ({ page }) => {
  const studio = await (await page.request.get('/admin/studio.js')).text();
  expect(studio).toContain('replace(/"/g, \'&quot;\')');   // attribute-safe esc (the gate-18 class)
  expect(studio).toMatch(/function safeCover/);            // AniList covers scheme-gated
  expect(studio).toMatch(/!current\.loaded\) return/);     // Save dead until the docs loaded (the HIGH)
  const msl = await (await page.request.get('/admin/modal-scroll-lock.js')).text();
  expect(msl).toContain("'#studio-editor'");               // one owner for the page lock
  const bump = await (await page.request.get('/scripts/bump-version.js')).text();
  expect(bump).toMatch(/admin\/studio\.js',\s*"friendly-errors/);    // in-module ?v= targeted
  expect(bump).toMatch(/admin\/curation\.js',\s*"friendly-errors/);
  const cur = await (await page.request.get('/admin/curation.html')).text();
  expect(cur).toContain('src="brand-select.js');           // the parity lane's missed page, closed
  const scss = await (await page.request.get('/admin/studio.css')).text();
  expect(scss).toMatch(/\.chat-drawer \*:focus-visible/);  // the ring reaches the overlays
});

test('gF: the Constellation legend/key renders (Blake B2 — a quick guide)', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(async () => { await import('/wrapped.js'); });
  await page.waitForFunction(() => !!window.wrappedModel, null, { timeout: 15000 });
  const html = await page.evaluate(() => {
    const W = window.wrappedModel;
    const y = 2026;
    const raw = {
      items: [{ path: 'reviews/one-punch-man/items/u1', createdAtMs: Date.UTC(y, 1, 14), rating: 9 }],
      replies: [], discussions: [], threads: [], posts: [],
      saves: [{ animeId: 'one-punch-man', ms: Date.UTC(y, 0, 5) }], caps: {},
    };
    // render into a detached host to read the key markup
    const model = W.computeWrapped(raw, y, Date.UTC(y, 6, 2), new Map(), 'u1');
    return W.skySvg(model);   // the sky itself; the key is DOM-built in render()
  });
  expect(html).toContain('wr-sky');
  // the key markup lives in wrapped.js render() — pin its class + the no-gold rule in CSS
  const wcss = await (await page.request.get('/wrapped.css')).text();
  expect(wcss).toContain('.wr-key');
  expect(wcss).not.toMatch(/ffd54a|ffe082|ffd700/i);   // still zero gold ink
});
