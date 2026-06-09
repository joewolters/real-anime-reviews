const { test, expect } = require('./welcomed');

// mega-batch Part B — the LIVE-IN-BOX composer (window.RarLive). The contract:
// the contenteditable is a VIEW; the hidden textarea is the MODEL + submit
// source; serialization is a whitelist walk; paste is text/plain only. These
// pin the round-trip, the live completion, the XSS fences, and the real-modal
// integration (no preview panel for users, ever again).
test.describe('mega-batch Part B — live-in-box composer', () => {

  test('REAL modal (signed out): the review composer is a live editor — NO preview panel anywhere', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    await page.locator('.card-container .card').first().click();
    await page.waitForSelector('.review-composer');
    await expect(page.locator('.review-composer .rar-live')).toHaveCount(1);
    await expect(page.locator('.review-composer .composer-preview')).toHaveCount(0);   // the panel is GONE
    await expect(page.locator('.sheet--left .composer-body .rar-live').first()).toBeAttached();
    await expect(page.locator('.sheet--left .composer-body .composer-preview')).toHaveCount(0);
    // signed out -> the editor mirrors the textarea's readOnly: not editable
    const editable = await page.locator('.review-composer .rar-live').getAttribute('contenteditable');
    expect(editable).toBe('false');
  });

  test('round-trip: model -> editor -> serialize === model (every supported construct)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    const r = await page.evaluate(() => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      const api = window.RarLive.mount(ta, { mode: 'block', submit: 'mod' });
      const model = '## Verdict\n**bold** and *ital* and `code` and ||secret|| and [img:2]\n[a link](https://x.example/p) plain';
      ta.value = model;
      ta.dispatchEvent(new Event('input', { bubbles: true }));   // external set -> rerender
      const out = {
        roundTrip: window.RarLive._serialize(api.editorEl),
        strong: !!api.editorEl.querySelector('strong'),
        em: !!api.editorEl.querySelector('em'),
        code: !!api.editorEl.querySelector('code'),
        spoiler: !!api.editorEl.querySelector('.rar-live-spoiler'),
        imgChip: api.editorEl.querySelector('.rar-live-img') ? api.editorEl.querySelector('.rar-live-img').getAttribute('data-img-token') : null,
        link: api.editorEl.querySelector('a') ? api.editorEl.querySelector('a').getAttribute('href') : null,
        headerStyled: !!api.editorEl.querySelector('.rar-live-line.is-h2'),
        model,
      };
      host.remove();
      return out;
    });
    expect(r.roundTrip).toBe(r.model);          // LOSSLESS — the load-bearing property
    expect(r.strong && r.em && r.code && r.spoiler).toBe(true);
    expect(r.imgChip).toBe('2');
    expect(r.link).toBe('https://x.example/p');
    expect(r.headerStyled).toBe(true);          // block mode styles the ## line
  });

  test('live completion: typing **bold** transforms in-box and the hidden model carries the markdown', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    const r = await page.evaluate(() => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      const api = window.RarLive.mount(ta, { mode: 'inline', submit: 'enter' });
      // simulate "the user just finished typing **bold**": a raw text node +
      // caret inside it, then the input event the keystroke would fire.
      const line = document.createElement('div'); line.className = 'rar-live-line';
      const t = document.createTextNode('so **bold** then');
      line.appendChild(t); api.editorEl.appendChild(line);
      const sel = window.getSelection(); const rng = document.createRange();
      rng.setStart(t, t.data.length); rng.collapse(true);
      sel.removeAllRanges(); sel.addRange(rng);
      api.editorEl.dispatchEvent(new Event('input', { bubbles: true }));
      const out = {
        strongInBox: !!api.editorEl.querySelector('strong'),
        model: ta.value,
      };
      host.remove();
      return out;
    });
    expect(r.strongInBox).toBe(true);
    expect(r.model).toContain('**bold**');
  });

  test('XSS: hostile MODEL text renders as literal text (no element), and survives the round-trip as text', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    const r = await page.evaluate(() => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      const api = window.RarLive.mount(ta, { mode: 'inline', submit: 'enter' });
      const hostile = '<img src=x onerror=alert(1)> and [evil](javascript:alert(1))';
      ta.value = hostile;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const out = {
        imgs: api.editorEl.querySelectorAll('img').length,
        links: api.editorEl.querySelectorAll('a').length,     // javascript: scheme NEVER matches the link rule
        text: api.editorEl.textContent.indexOf('<img') !== -1,
        roundTrip: window.RarLive._serialize(api.editorEl),
        hostile,
      };
      host.remove();
      return out;
    });
    expect(r.imgs).toBe(0);
    expect(r.links).toBe(0);
    expect(r.text).toBe(true);                 // shown as literal text, exactly what they typed
    expect(r.roundTrip).toBe(r.hostile);       // and stored as literal text
  });

  test('PASTE: text/html clipboards are flattened — only text/plain enters, live-formatted', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    const r = await page.evaluate(() => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      const api = window.RarLive.mount(ta, { mode: 'inline', submit: 'enter' });
      api.editorEl.focus();
      const sel = window.getSelection(); const rng = document.createRange();
      rng.selectNodeContents(api.editorEl); rng.collapse(false);
      sel.removeAllRanges(); sel.addRange(rng);
      const dt = new DataTransfer();
      dt.setData('text/html', '<img src=x onerror="alert(1)"><b onmouseover="alert(2)">evil</b>');
      dt.setData('text/plain', 'pasted **rich** text');
      api.editorEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      const out = {
        imgs: api.editorEl.querySelectorAll('img').length,
        handlers: api.editorEl.innerHTML.indexOf('onmouseover'),
        strong: !!api.editorEl.querySelector('strong'),
        model: ta.value,
      };
      host.remove();
      return out;
    });
    expect(r.imgs).toBe(0);
    expect(r.handlers).toBe(-1);               // the HTML clipboard NEVER touches the DOM
    expect(r.strong).toBe(true);               // the plain text still live-formats
    expect(r.model).toContain('**rich**');
  });

  test('the post-success clear pattern + readOnly mirror still work (zero composer changes)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    const r = await page.evaluate(async () => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      const api = window.RarLive.mount(ta, { mode: 'inline', submit: 'enter' });
      ta.value = 'about to post **this**';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const hadContent = api.editorEl.textContent.length > 0;
      // the existing post-success pattern, untouched in every composer:
      ta.value = '';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const cleared = api.editorEl.textContent.replace(/​/g, '') === '';
      ta.readOnly = true;
      await new Promise((res) => setTimeout(res, 40));
      const out = { hadContent, cleared, off: api.editorEl.getAttribute('contenteditable') === 'false', tbHidden: api.toolbar.hidden };
      host.remove();
      return out;
    });
    expect(r.hadContent).toBe(true);
    expect(r.cleared).toBe(true);
    expect(r.off).toBe(true);
    expect(r.tbHidden).toBe(true);
  });
});
