// tests/v223-auth-session.spec.js
// <!-- author: Code | date: 2026-08-12 -->
// =============================================================================
// "I still cannot sign in." — Blake, on his phone, in TWO browsers:
//   Arc:        "tells me my password and email are wrong"
//   DuckDuckGo: "after I click enter it brings me to the home page and actually
//                doesn't sign me in"
//
// The DuckDuckGo half is the informative one: the credential is ACCEPTED and the
// session then isn't there. Firebase persists sessions in IndexedDB by default,
// which is exactly what privacy-first browsers block, partition or wipe — and
// when it fails the SDK can fall back to IN-MEMORY, where the session dies on
// the next navigation. To the person using it that is identical to "it didn't
// sign me in".
// =============================================================================
const { test, expect } = require('@playwright/test');

test('auth: the session is stored in an explicitly chosen, durable place', async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (e) {} });
  await page.goto('/index.html');
  await page.waitForFunction(
    () => window.__rarAuthPersistence && window.__rarAuthPersistence !== 'pending',
    null, { timeout: 20000 });

  const tier = await page.evaluate(() => window.__rarAuthPersistence);
  // in a browser that allows site data this MUST land on the strongest tier —
  // if this ever reports 'memory', every member silently loses their session on
  // the next page load.
  expect(tier, 'the durable store won').toBe('local');
});

test('auth: the same guarantee holds on the account page', async ({ page }) => {
  // account.js redirects a signed-out visitor; the 204 keeps the document alive
  // (abort() kills it and leaves nothing to read).
  await page.route((url) => url.href.includes('signin=1'), (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/account.html');
  await page.waitForFunction(
    () => window.__rarAuthPersistence && window.__rarAuthPersistence !== 'pending',
    null, { timeout: 20000 });
  expect(await page.evaluate(() => window.__rarAuthPersistence)).toBe('local');
});

test('auth: a blocked store degrades down the chain instead of failing', async ({ page, request }) => {
  // The fallback ORDER is the promise: localStorage → sessionStorage → memory.
  // It cannot be exercised for real without a browser that blocks storage, so
  // the chain itself is pinned — stated plainly rather than dressed up as a
  // behavioural test.
  const js = await (await request.get('/firebase.js')).text();
  expect(js).toContain('browserLocalPersistence');
  expect(js).toContain('browserSessionPersistence');
  expect(js).toContain('inMemoryPersistence');
  // and the order must be strongest-first
  const iLocal = js.indexOf("['local'");
  const iSession = js.indexOf("['session'");
  const iMemory = js.indexOf("['memory'");
  expect(iLocal).toBeGreaterThan(-1);
  expect(iSession, 'session comes after local').toBeGreaterThan(iLocal);
  expect(iMemory, 'memory is the last resort').toBeGreaterThan(iSession);
});

test('auth: a session that will not persist is reported, never silently closed', async ({ page, request }) => {
  const js = await (await request.get('/script.js')).text();
  // the success path checks the tier and refuses to close the modal on a
  // session the browser is going to throw away
  expect(js).toContain("window.__rarAuthPersistence");
  expect(js).toMatch(/store === 'memory' \|\| store === 'none'/);
  expect(js, 'and it says so in words a person can act on').toContain('blocking site data');
});

test('auth: "incorrect email or password" tells you where to look', async ({ page }) => {
  // Blake got this in Arc with credentials that work on his desktop. The usual
  // cause is the browser filling a DIFFERENT saved address into the box, which
  // is invisible unless you are told to check it.
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (e) {} });
  await page.goto('/index.html');
  await page.click('#auth-open');
  await page.waitForSelector('#auth-modal.active', { timeout: 10000 });
  await page.fill('#auth-email', 'definitely-not-a-real-account@example.com');
  await page.fill('#auth-password', 'wrongpassword123');
  await page.click('#auth-submit');
  await page.waitForFunction(
    () => (document.getElementById('auth-error').textContent || '').length > 0,
    null, { timeout: 20000 });
  const msg = await page.textContent('#auth-error');
  expect(msg, 'it points at the email box').toMatch(/email box/i);
});

// ⚠️ v2.2.4 — THE INCIDENT. Adding `authPersistenceReady` to script.js's import
// list took the whole site down for anyone holding a cached copy of the module:
// script.js imports './firebase.js' with a BARE specifier (no ?v=), which is a
// SEPARATE cache entry from the versioned one the page loads. A stale bare copy
// has no such export, the ES module import throws, and script.js never executes —
// the static shell renders while nothing dynamic loads. Blake: "it has the admin
// thing in the bottom left but nothing is loading and I can't access my account."
// admin-fab.js imports the same bare module but only needs auth+db, which the
// old copy still exports — which is exactly why the FAB survived alone.
test('incident guard: script.js must not import new names from the bare firebase module', async ({ request }) => {
  const js = await (await request.get('/script.js')).text();
  const m = js.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/firebase\.js'/);
  expect(m, 'script.js imports the bare module').toBeTruthy();
  const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  // These four have existed for many releases, so every cached copy has them.
  // Anything NEW here is a site-wide outage for cached clients.
  expect(names.sort()).toEqual(['auth', 'db', 'functions', 'storage']);
});

test('incident guard: the bare-imported modules are never cached stale', async () => {
  const fs = require('fs');
  const path = require('path');
  const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
  const hs = fb.hosting.headers || [];
  const bare = hs.find((h) => h.source.includes('firebase|'));
  expect(bare, 'the bare-specifier modules have their own rule').toBeTruthy();
  expect(bare.headers[0].value).toMatch(/no-cache/);
  // and it must come AFTER the generic asset rule, or that rule overrides it
  const iAsset = hs.findIndex((h) => /js\|css/.test(h.source));
  const iBare = hs.findIndex((h) => h.source.includes('firebase|'));
  expect(iBare, 'the no-cache rule wins over the generic asset cache').toBeGreaterThan(iAsset);
});

test('authcheck: the diagnostic is opt-in and reports the real facts', async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (e) {} });
  // invisible unless asked for
  await page.goto('/index.html');
  await page.waitForTimeout(800);
  expect(await page.locator('text=SIGN-IN CHECK').count(), 'never shown by default').toBe(0);

  await page.goto('/index.html?authcheck=1');
  await page.waitForSelector('#rar-authcheck', { timeout: 15000 });
  // it must resolve to a REAL answer, not leave him screenshotting "pending"
  await page.waitForFunction(
    () => !/Session store:\s*pending/.test(document.getElementById('rar-authcheck').textContent),
    null, { timeout: 15000 });
  const txt = await page.textContent('#rar-authcheck');
  expect(txt).toContain('Session store');
  expect(txt).toContain('Can save site data');
  expect(txt, 'and it reports the tier that was actually chosen').toMatch(/local|session|memory/);
});
