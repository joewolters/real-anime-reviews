const { test, expect } = require('./welcomed');

// ACCOUNT OVERHAUL ROUND 2 — static contracts. The IA promise (every section
// its own panel, settings split out), the Edit↔Public-view toggle, the branded
// tag dropdown, and the consent dead-end fix (ONE shared implementation —
// consent.js — wired into BOTH pages; the duplicate-implementation class that
// produced round 1's lantern HIGH must not regrow).

test('account v2: six panels, settings split out, mode toggle + consent banner + tag dropdown scaffolding', async ({ request }) => {
  const res = await request.get('/account.html');
  expect(res.status()).toBe(200);
  const html = await res.text();
  // the six dedicated surfaces
  for (const id of ['tab-profile', 'tab-watchlist', 'tab-favorites', 'tab-activity', 'tab-inbox', 'tab-settings']) {
    expect(html).toContain(`id="${id}"`);
  }
  // the grouped rail
  expect(html).toContain('side-group-label');
  expect(html).toContain('data-tab="settings"');
  // the Edit ↔ Public-view toggle + the viewer host
  expect(html).toContain('id="acct-mode-edit"');
  expect(html).toContain('id="acct-mode-view"');
  expect(html).toContain('id="acct-viewer"');
  // the consent dead-end fix lives IN the account page
  expect(html).toContain('id="acct-consent-banner"');
  expect(html).toContain('id="acct-consent-open"');
  // the branded tag dropdown replaced the flat suggest strip
  expect(html).toContain('id="acct-tag-dd-btn"');
  expect(html).toContain('id="acct-tag-dd"');
  expect(html).not.toContain('acct-tag-suggest');
  // the hero preview class
  expect(html).toContain('acct-preview--hero');
  // view-mode toggles on both collections
  expect(html).toContain('data-viewmode="watchlist"');
  expect(html).toContain('data-viewmode="favorites"');
});

test('account v2: settings owns email/password — the profile editor does not', async ({ request }) => {
  const html = await (await request.get('/account.html')).text();
  const profileStart = html.indexOf('id="tab-profile"');
  const settingsStart = html.indexOf('id="tab-settings"');
  const emailAt = html.indexOf('id="prof-email"');
  const passAt = html.indexOf('id="acct-change-pass"');
  expect(profileStart).toBeGreaterThan(-1);
  expect(settingsStart).toBeGreaterThan(profileStart);
  // email + password controls live AFTER the settings panel opens
  expect(emailAt).toBeGreaterThan(settingsStart);
  expect(passAt).toBeGreaterThan(settingsStart);
  // and the session card exists
  expect(html).toContain('id="acct-signout-2"');
  expect(html).toContain('id="set-member-since"');
});

test('consent is ONE shared implementation: consent.js exists, both pages import it', async ({ request }) => {
  const mod = await request.get('/consent.js');
  expect(mod.status()).toBe(200);
  const modText = await mod.text();
  // the CF-minted flow (never self-attested) + Blake's rules copy live here
  expect(modText).toContain("httpsCallable(functions, 'acceptRules')");
  expect(modText).toContain('No harassment, hate speech, or personal attacks.');
  expect(modText).toContain('CURRENT_RULES_VERSION = 1');
  // both pages import the ONE module (no second copy of the modal markup)
  const scriptText = await (await request.get('/script.js')).text();
  const accountText = await (await request.get('/account.js')).text();
  expect(scriptText).toContain("from './consent.js'");
  expect(accountText).toContain("from './consent.js'");
  expect(scriptText).not.toContain('rar-consent-rules');   // the markup lives ONLY in consent.js
  expect(accountText).not.toContain('rar-consent-rules');
});

test('the consent banner honors [hidden] in REAL pixels (the display-flex trap)', async ({ page }) => {
  // .acct-consent-banner is display:flex — without the [hidden]{display:none}
  // symmetry rule it rendered for EVERYONE while the attribute said hidden
  // (caught by screenshot in the round-2 walk; the locator lied).
  await page.goto('/index.html');
  const d = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'acct-consent-banner';
    el.setAttribute('hidden', '');
    document.body.appendChild(el);
    const v = getComputedStyle(el).display;
    el.remove();
    return v;
  });
  expect(d).toBe('none');
});

test('the round-1 520px clamp does NOT cage the v2 panels (the spill bug)', async ({ page }) => {
  // .account-card.is-tab carries a 520px height lock from round 1; the round-2
  // panels must beat it or the editor spills past the painted card (adversarial
  // HIGH, measured at 671px of naked overflow).
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const wrap = document.createElement('main'); wrap.className = 'account-wrap account-v2';
    const card = document.createElement('article'); card.className = 'account-card account-panel-card is-tab';
    wrap.appendChild(card); document.body.appendChild(wrap);
    const cs = getComputedStyle(card);
    const out = { maxHeight: cs.maxHeight, minHeight: cs.minHeight };
    wrap.remove(); return out;
  });
  expect(m.maxHeight).toBe('none');
  expect(parseFloat(m.minHeight)).toBeGreaterThanOrEqual(540);
});

test('the inbox unread dot honors [hidden] in REAL pixels (same trap class as the banner)', async ({ page }) => {
  await page.goto('/index.html');
  const d = await page.evaluate(() => {
    const el = document.createElement('span');
    el.className = 'inbox-dot';
    el.setAttribute('hidden', '');
    document.body.appendChild(el);
    const v = getComputedStyle(el).display;
    el.remove(); return v;
  });
  expect(d).toBe('none');
});

test('account.js imports addDoc (the dead-inbox ReferenceError class)', async ({ request }) => {
  const js = await (await request.get('/account.js')).text();
  // the import list must carry addDoc — it is USED by the inbox send/create
  const importBlock = js.slice(0, js.indexOf("from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js'"));
  expect(importBlock).toContain('addDoc');
});

test('the index consent hooks survive the extraction (g3 contract intact)', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.consentGateDecision === 'function' && typeof window.__rarOpenConsent === 'function');
  const d = await page.evaluate(() => window.consentGateDecision(null, 1));
  expect(d).toBe('consent');
  await page.evaluate(() => { window.__rarOpenConsent(); });
  await expect(page.locator('.rar-consent-overlay .rar-consent-modal')).toBeVisible();
  await expect(page.locator('.rar-consent-rules li')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(page.locator('.rar-consent-overlay')).toHaveCount(0);
});
