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
