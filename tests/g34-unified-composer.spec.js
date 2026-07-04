// g34 — LAST CALL A5: the ONE composer, Discord-grade, everywhere.
// Replaces tests/composer-redesign.spec.js (which pinned the superseded
// RarComposer **-marker engine — deleted this gate). Pins: the old engine is
// GONE, bare pasted URLs auto-link at render (scheme-gated), explicit links
// never double-wrap, and the DM/bio surfaces mount the same RarLive engine.
const { test, expect } = require('@playwright/test');

test('the superseded **-marker engine is GONE (file, loader, global)', async ({ page }) => {
  const res = await page.request.get('/composer-toolbar.js');
  expect(res.status()).toBe(404);
  const index = await (await page.request.get('/index.html')).text();
  expect(index).not.toContain('composer-toolbar.js');
  await page.goto('/');
  const gone = await page.evaluate(() => typeof window.RarComposer === 'undefined');
  expect(gone).toBe(true);
});

test('markdown render: bare https URLs auto-link, scheme-gated, no double-wrap', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.renderMarkdownInline === 'function');
  const r = await page.evaluate(() => ({
    bare: window.renderMarkdownInline('look at https://example.com/x?a=1 today'),
    punct: window.renderMarkdownInline('see https://example.com/page.'),
    evil: window.renderMarkdownInline('try javascript:alert(1) and ftp://x'),
    explicit: window.renderMarkdownInline('[the site](https://example.com) and https://other.dev'),
    urlAsText: window.renderMarkdownInline('[https://a.com](https://b.com)'),
  }));
  expect(r.bare).toContain('<a href="https://example.com/x?a=1"');
  expect(r.bare).toContain('rel="noopener noreferrer"');
  // trailing sentence punctuation stays OUTSIDE the link
  expect(r.punct).toContain('<a href="https://example.com/page"');
  expect(r.punct).toMatch(/<\/a>\./);
  // only http(s) ever links
  expect(r.evil).not.toContain('<a ');
  // an explicit [text](url) link survives untouched; the second URL links
  expect((r.explicit.match(/<a /g) || []).length).toBe(2);
  // a URL used as explicit link TEXT is never wrapped in a second anchor
  expect((r.urlAsText.match(/<a /g) || []).length).toBe(1);
  expect(r.urlAsText).toContain('href="https://b.com"');
});

test('the Letter Room + bio joined the ONE engine (source pins)', async ({ page }) => {
  const accountJs = await (await page.request.get('/account.js')).text();
  const accountHtml = await (await page.request.get('/account.html')).text();
  expect(accountHtml).toContain('live-composer.js');
  expect(accountJs).toMatch(/RarLive\.mount\(inputEl/);          // the DM box
  expect(accountJs).toMatch(/RarLive\.mount\(bioTa/);            // the bio
  expect(accountJs).toContain('renderMarkdownInline(m.text');    // letters render markdown now
  const scriptJs = await (await page.request.get('/script.js')).text();
  // the once-bare edit surfaces mount the engine too
  expect(scriptJs).toMatch(/RarLive\.mount\(bIn/);               // review edit
  expect(scriptJs).toMatch(/\.hub-edit-input'\)\.forEach/);      // hub post edit re-mounts per paint
});

test('a mounted composer live-toggles via the model — no literal ** doubling', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
  const r = await page.evaluate(() => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const ta = document.createElement('textarea'); host.appendChild(ta);
    window.RarLive.mount(ta, { inline: true, submit: 'enter' });
    const ed = host.querySelector('.rar-live');
    // select typed text and hit the toolbar B — the model must serialize
    // **bold** exactly once (the live element IS the format; no marker soup)
    ed.focus();
    ed.textContent = 'make me bold';
    const range = document.createRange(); range.selectNodeContents(ed);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    host.querySelector('[data-md="bold"]').click();
    const model = ta.value;
    const strongInView = !!ed.querySelector('b, strong');
    host.remove();
    return { model, strongInView };
  });
  expect(r.strongInView).toBe(true);
  expect(r.model).toBe('**make me bold**');
});
