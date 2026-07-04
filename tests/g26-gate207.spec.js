// g26 — GATE 20.7 contracts (Blake's 20.6 smoke fixes).
// 1. The public profile carries Threads + Reviews ONLY (item 3).
// 2. The 👁 demand chip docks under the cover thumbnail (item 4).
// 3. The crop note exists with its [hidden] twin (item 1 — note, not geometry).
// 4. The avatar origin gates carry the localhost-scoped practice branch (item 2).
// 5. The sign-in catch-up strip is styled + focusable (item 5c; live flow = e2e).
const { test, expect } = require('@playwright/test');

test('20.7 (3) → LAST CALL A8: the public profile tab source carries Reviews ONLY', async ({ page }) => {
  const src = await (await page.request.get('/script.js')).text();
  // gate 20.7 dropped Comments/Replies; LAST CALL A8 dropped Threads too
  // (Blake: "threads hidden on public pages; reviews only, plus anything pinned")
  expect(src).toContain('data-act="reviews"');
  expect(src).not.toContain('data-act="threads"');
  expect(src).not.toContain('data-act="comments"');
  expect(src).not.toContain('data-act="replies"');
});

test('20.7 (4): the demand chip docks in the cover column', async ({ page }) => {
  const src = await (await page.request.get('/script.js')).text();
  expect(src).toContain('secondary-cover-col');
  const css = await (await page.request.get('/style.css')).text();
  expect(css).toContain('.secondary-cover-col');
  // the column stacks the chip under the thumbnail
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const col = document.createElement('div');
    col.className = 'secondary-cover-col';
    document.body.appendChild(col);
    const cs = getComputedStyle(col);
    const r = { display: cs.display, direction: cs.flexDirection };
    col.remove();
    return r;
  });
  expect(m.display).toBe('flex');
  expect(m.direction).toBe('column');
});

test('20.7 (1): the crop note ships hidden with a real [hidden] twin', async ({ page }) => {
  const html = await (await page.request.get('/account.html')).text();
  expect(html).toContain('id="acct-crop-note"');
  expect(html).toMatch(/id="acct-crop-note"[^>]*hidden|hidden[^>]*id="acct-crop-note"/);
  expect(html).toContain('Public view');
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const n = document.createElement('span');
    n.className = 'acct-crop-note';
    document.body.appendChild(n);
    const shown = getComputedStyle(n).display;
    n.hidden = true;
    const hid = getComputedStyle(n).display;
    n.remove();
    return { shown, hid };
  });
  expect(m.shown).toBe('block');
  expect(m.hid).toBe('none');   // the [hidden]-vs-author-display trap class
});

test('20.7 (2): every avatar origin gate carries the localhost-scoped practice branch', async ({ page }) => {
  // three client gates mirror the rules' allowlist — all three must carry the
  // practice origin AND keep it hostname-scoped (https-only on prod hosts)
  for (const f of ['/script.js', '/account.js', '/lantern.js']) {
    const src = await (await page.request.get(f)).text();
    // the origin lives inside a regex literal (escaped dots) — match either form
    expect(src, `${f} carries the practice origin`).toMatch(/127\\?\.0\\?\.0\\?\.1:9199/);
    expect(src, `${f} scopes it to localhost`).toMatch(/location\.hostname === '127\.0\.0\.1'/);
  }
});

test('20.7 (5c): the sign-in catch-up strip is branded, layered under modals, focus-visible', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const bar = document.createElement('div');
    bar.className = 'signin-catchup';
    const btn = document.createElement('button');
    btn.className = 'signin-catchup-btn';
    bar.appendChild(btn);
    document.body.appendChild(bar);
    const cs = getComputedStyle(bar);
    const r = { position: cs.position, z: parseInt(cs.zIndex, 10) };
    bar.remove();
    return r;
  });
  expect(m.position).toBe('fixed');
  expect(m.z).toBeGreaterThan(0);
  expect(m.z).toBeLessThan(5000);   // never above the modal stack
  const css = await (await page.request.get('/style.css')).text();
  expect(css).toContain('.signin-catchup :is(.signin-catchup-btn, .signin-catchup-x):focus-visible');
  expect(css).toMatch(/prefers-reduced-motion: reduce[^}]*\{[^}]*\.signin-catchup \{ animation: none/s);
});
