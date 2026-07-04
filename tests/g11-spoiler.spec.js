const { test, expect } = require('./welcomed');

// v1.10.0 gate 11 — the ||spoiler|| markdown token. Escape-first (XSS holds),
// hidden by default, revealed by the capture-phase click listener, inner
// formatting still applies, and the reveal does NOT bubble into a parent's own
// click handler (a spoiler inside a hub card must not open the thread).
test.describe('v1.10.0 gate 11 — ||spoiler||', () => {

  test('renders a hidden, accessible spoiler span; inner bold still applies', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.renderMarkdownInline === 'function');
    const r = await page.evaluate(() => {
      const html = window.renderMarkdownInline('the twist: ||**he** dies||');
      const host = document.createElement('div'); host.innerHTML = html;
      const sp = host.querySelector('.rar-spoiler');
      return {
        present: !!sp,
        role: sp && sp.getAttribute('role'),
        tab: sp && sp.getAttribute('tabindex'),
        boldInside: !!(sp && sp.querySelector('strong')),
        text: sp && sp.textContent,
      };
    });
    expect(r.present).toBe(true);
    expect(r.role).toBe('button');
    expect(r.tab).toBe('0');
    expect(r.boldInside).toBe(true);
    expect(r.text).toBe('he dies');
  });

  test('XSS: hostile content inside the spoiler stays escaped', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.renderMarkdownInline === 'function');
    const r = await page.evaluate(() => {
      const html = window.renderMarkdownInline('||<img src=x onerror=alert(1)>||');
      const host = document.createElement('div'); host.innerHTML = html;
      return { imgs: host.querySelectorAll('img').length, raw: html.indexOf('<img') };
    });
    expect(r.imgs).toBe(0);
    expect(r.raw).toBe(-1);
  });

  test('block mode (reviews) carries the token too; unclosed/empty pipes stay literal', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.renderMarkdown === 'function');
    const r = await page.evaluate(() => ({
      block: window.renderMarkdown('## Verdict\n||worth it||'),
      unclosed: window.renderMarkdownInline('a ||dangling spoiler'),
      empty: window.renderMarkdownInline('||||'),
    }));
    expect(r.block).toContain('rar-spoiler');
    expect(r.unclosed).not.toContain('rar-spoiler');
    expect(r.empty).not.toContain('rar-spoiler');
  });

  test('click reveals; the reveal is swallowed (no bubble into a parent click)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.renderMarkdownInline === 'function');
    const r = await page.evaluate(() => new Promise((resolve) => {
      const host = document.createElement('div');
      let parentClicked = 0;
      host.addEventListener('click', () => { parentClicked++; });
      host.innerHTML = window.renderMarkdownInline('||secret||');
      document.body.appendChild(host);
      const sp = host.querySelector('.rar-spoiler');
      const hiddenBefore = getComputedStyle(sp).color;
      sp.click();
      requestAnimationFrame(() => {
        resolve({
          hiddenBefore,
          revealed: sp.classList.contains('is-revealed'),
          parentClicked,
          colorAfter: getComputedStyle(sp).color,
        });
        host.remove();
      });
    }));
    expect(r.hiddenBefore).toBe('rgba(0, 0, 0, 0)');     // REAL PIXELS: transparent text while hidden
    expect(r.revealed).toBe(true);
    expect(r.parentClicked).toBe(0);                      // capture-phase swallow held
    expect(r.colorAfter).not.toBe('rgba(0, 0, 0, 0)');    // visible after reveal
  });

  // LAST CALL A5 — ported to the ONE engine (RarLive): the 👁 wraps the live
  // selection into a spoiler pill and the hidden model serializes ||…||.
  test('the composer toolbar grew the 👁 spoiler button and it wraps the selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    const r = await page.evaluate(() => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      window.RarLive.mount(ta, { inline: true, submit: 'enter' });
      ta.value = 'he dies';
      ta.dispatchEvent(new Event('input', { bubbles: true }));   // external write → re-render
      const ed = host.querySelector('.rar-live');
      const range = document.createRange(); range.selectNodeContents(ed);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      const btn = host.querySelector('[data-md="spoiler"]');
      if (btn) btn.click();
      const out = { present: !!btn, value: ta.value };
      host.remove();
      return out;
    });
    expect(r.present).toBe(true);
    expect(r.value).toBe('||he dies||');
  });
});
