// g36 — LAST CALL Part C: the parity pins. Zero native dialogs on every
// visitor page (the 40+ alert()s + the plaintext password prompt()s retired
// into showNotice / the inline pass-form), the audit's [hidden] twins, the
// composer cap guards, and the reduced-motion guard on the A2 sweep.
const { test, expect } = require('@playwright/test');

const LIVE_DIALOG = /(?<![.\w'])(alert|confirm|prompt)\(/;

test('zero native dialogs on the visitor pages (the g22 zero-select pin, dialog edition)', async ({ page }) => {
  for (const f of ['/script.js', '/account.js', '/suggest.js', '/wrapped.js', '/lantern.js']) {
    const src = await (await page.request.get(f)).text();
    const live = src.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l) && LIVE_DIALOG.test(l));
    expect(live, f + ' has live native dialog calls:\n' + live.join('\n')).toHaveLength(0);
  }
  // the branded replacements exist
  const fe = await (await page.request.get('/friendly-errors.js')).text();
  expect(fe).toContain('export function showNotice');
  const acct = await (await page.request.get('/account.js')).text();
  expect(acct).toContain('acct-pass-form');   // the prompt() replacement
});

test('the audit twins + cap guards + RM sweep guard hold', async ({ page }) => {
  const css = await (await page.request.get('/style.css')).text();
  expect(css).toContain('.col-composer[hidden]');
  expect(css).toContain('.profile-like-btn[hidden]');
  expect(css).toContain('.profile-col[hidden]');
  // the A2 sweep is stilled under reduced motion
  expect(css).toMatch(/prefers-reduced-motion[\s\S]{0,200}\.discover-search-wrap/);
  const js = await (await page.request.get('/script.js')).text();
  expect(js).toMatch(/bIn\.value\.length <= 2000/);          // review edit cap
  expect(js).toMatch(/body\.length > 4000/);                  // new-thread pre-flight
  expect(js).toMatch(/val\.length > 4000/);                   // post-edit guard
});

test('the branded notice toast renders + dismisses (live)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.friendlyErrorModel);
  await page.evaluate(async () => {
    const m = await import('/friendly-errors.js?v=1.10.2');
    m.showNotice('parity pin: hello');
  });
  const card = page.locator('.rar-notice');
  await expect(card).toBeVisible();
  await expect(card).toContainText('parity pin: hello');
  await card.locator('.rar-notice-x').click();
  await expect(page.locator('.rar-notice')).toHaveCount(0);
});
