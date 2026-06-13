// g28 — v1.10.1 HOTFIX contracts.
// 1. friendlyError (the ONE branded-error module) never lets a provider name,
//    SDK code, or internal path reach visitor UI — fed the EXACT hostile
//    string from Blake's prod screenshot.
// 2. The truthful split: unverified → the verify-email copy; verified denial →
//    the honest site-side copy (never "hit Save again" for an unfixable deny).
// 3. Source pins: no visitor sink concatenates a raw .message into alert/
//    textContent ever again (script.js + account.js).
const { test, expect } = require('@playwright/test');

const HOSTILE = {
  code: 'storage/unauthorized',
  message: "Firebase Storage: User does not have permission to access 'uploads/G2jGRa14u8bzGAmeBTkvXy8PKmr1/abc123/img1' (storage/unauthorized)",
};
const FORBIDDEN = [/firebase/i, /storage\//i, /uploads\//i, /firestore/i, /gstatic/i, /\(storage/i];

async function model(page) {
  await page.goto('/index.html');
  await page.addScriptTag({ type: 'module', content: "import './friendly-errors.js';" });
  await page.waitForFunction(() => window.friendlyErrorModel && typeof window.friendlyErrorModel.friendlyError === 'function');
}

test('g28 (1): the hostile prod error string can never reach visitor UI', async ({ page }) => {
  await model(page);
  const outs = await page.evaluate((hostile) => {
    const f = window.friendlyErrorModel.friendlyError;
    return [
      f(hostile, { kind: 'upload', user: { emailVerified: true } }),
      f(hostile, { kind: 'upload', user: { emailVerified: false } }),
      f(hostile, { kind: 'post', user: null }),
      f(hostile.message, {}),                       // a bare string err
      f({ message: 'firestore: Missing or insufficient permissions.' }, { kind: 'save' }),
      f(undefined, {}), f(null, { kind: 'upload' }), f(42, {}),
    ];
  }, HOSTILE);
  for (const out of outs) {
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(10);
    for (const re of FORBIDDEN) expect(out, `clean of ${re}`).not.toMatch(re);
  }
});

test('g28 (2): the truthful split — verify-email vs site-side, never retry-forever', async ({ page }) => {
  await model(page);
  const m = await page.evaluate((hostile) => {
    const f = window.friendlyErrorModel.friendlyError;
    return {
      unverified: f(hostile, { kind: 'upload', user: { emailVerified: false } }),
      verified: f(hostile, { kind: 'upload', user: { emailVerified: true } }),
      quota: f({ code: 'storage/quota-exceeded', message: 'quota' }, { kind: 'upload' }),
      network: f({ code: 'storage/retry-limit-exceeded', message: 'network timeout' }, { kind: 'upload' }),
    };
  }, HOSTILE);
  expect(m.unverified).toContain('Verify your email');
  expect(m.verified).toContain('on us');                 // honest: the site's fault
  expect(m.verified).not.toMatch(/hit save again|community.rules/i);  // the old lie is dead
  expect(m.quota).toContain('smaller');
  expect(m.network.toLowerCase()).toContain('connection');
});

test('g28 (3): no visitor sink renders a raw .message (source pin, both pages)', async ({ page }) => {
  for (const f of ['/script.js', '/account.js']) {
    const src = await (await page.request.get(f)).text();
    // any alert/textContent that concatenates a raw error .message is the leak class
    expect(src, `${f}: alert leak`).not.toMatch(/alert\([^\n]*\b(err|e|bgErr)\??\.message/);
    expect(src, `${f}: textContent leak`).not.toMatch(/textContent = \(?(err|e|bgErr)\??\.message/);
    // every visitor page imports the ONE module
    expect(src, `${f}: imports the module`).toMatch(/from '\.\/friendly-errors\.js\?v=[\d.]+'/);
  }
});
