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

  // CUTOVER-EVE fix 1 — the spoiler trap ("it stays as a box forever"): the
  // toolbar-👁 path inserted the pill with NO ZWS landing pad, so the caret sat
  // at a bare inline boundary and every keystroke extended the pill. These two
  // pins drive REAL keystrokes (trusted events — synthetic dispatches don't
  // exercise contentEditable boundary behavior, which IS the bug).
  test('REAL KEYS: toolbar 👁 on a selection — typing lands OUTSIDE the pill (the spoiler-trap escape)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    await page.evaluate(() => {
      const host = document.createElement('div'); host.id = 'tmp-sp-host';
      host.style.cssText = 'position:fixed;top:10px;left:10px;width:420px;background:#141225;z-index:99999;padding:10px;';
      document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      window.RarLive.mount(ta, { mode: 'inline', submit: 'mod' });
      window.__spTa = ta;
    });
    const editor = page.locator('#tmp-sp-host .rar-live');
    await editor.click();
    await page.keyboard.type('secret');
    await page.keyboard.press('Shift+Home');                          // a real selection
    await page.locator('#tmp-sp-host .ct-btn[data-md="spoiler"]').click();
    await expect(page.locator('#tmp-sp-host .rar-live-spoiler')).toHaveText('secret');
    await page.keyboard.type(' after');                                // MUST land outside
    const model = await page.evaluate(() => window.__spTa.value);
    expect(model).toBe('||secret|| after');                            // escaped — not ||secret after||
    await page.evaluate(() => document.getElementById('tmp-sp-host').remove());
  });

  test('REAL KEYS: 👁 with the caret INSIDE a pill = leave it (toggle-off escape, never a nested pill)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    await page.evaluate(() => {
      const host = document.createElement('div'); host.id = 'tmp-sp2-host';
      host.style.cssText = 'position:fixed;top:10px;left:10px;width:420px;background:#141225;z-index:99999;padding:10px;';
      document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      window.RarLive.mount(ta, { mode: 'inline', submit: 'mod' });
      ta.value = 'before ||hidden|| tail';
      ta.dispatchEvent(new Event('input', { bubbles: true }));         // render the pill
      window.__sp2Ta = ta;
    });
    await page.locator('#tmp-sp2-host .rar-live-spoiler').click();     // caret INSIDE the pill
    await page.locator('#tmp-sp2-host .ct-btn[data-md="spoiler"]').click();  // 👁 again = leave
    await page.keyboard.type('X');
    const model = await page.evaluate(() => window.__sp2Ta.value);
    expect(model).toBe('before ||hidden||X tail');                     // X escaped the pill
    expect(await page.locator('#tmp-sp2-host .rar-live-spoiler').count()).toBe(1);  // no nesting
    await page.evaluate(() => document.getElementById('tmp-sp2-host').remove());
  });

  // panel HIGH (CUTOVER-EVE): a toolbar-wrapped selection carrying newlines or
  // pipes used to serialize into ||…|| markdown the reader-side regex can
  // NEVER re-hide — the spoiler LEAKED as plain text while the editor showed
  // an intact pill. The wrap now joins lines and drops pipes, so the model
  // always round-trips the same grammar the typing path produces.
  test('REAL KEYS: 👁 on multi-line and pipe-carrying selections yields reader-hideable markdown (no spoiler leak)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    const READER_RX = /\|\|([^|\n]+)\|\|/g;   // markdown.js:48 — what readers can actually hide

    // A — multi-line selection
    await page.evaluate(() => {
      const host = document.createElement('div'); host.id = 'tmp-sp3-host';
      host.style.cssText = 'position:fixed;top:10px;left:10px;width:420px;background:#141225;z-index:99999;padding:10px;';
      document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      window.RarLive.mount(ta, { mode: 'inline', submit: 'mod' });
      ta.value = 'the villain wins\neveryone dies';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      window.__sp3Ta = ta;
    });
    await page.locator('#tmp-sp3-host .rar-live').click();
    await page.keyboard.press('Control+a');
    await page.locator('#tmp-sp3-host .ct-btn[data-md="spoiler"]').click();
    let model = await page.evaluate(() => window.__sp3Ta.value);
    let hidden = Array.from(model.matchAll(READER_RX)).map((m) => m[1]).join(' ');
    expect(hidden).toContain('the villain wins everyone dies');   // ALL of it hides
    expect(model.replace(READER_RX, '')).not.toContain('villain');   // nothing leaks outside pills
    await page.evaluate(() => document.getElementById('tmp-sp3-host').remove());

    // B — selection containing literal pipes
    await page.evaluate(() => {
      const host = document.createElement('div'); host.id = 'tmp-sp4-host';
      host.style.cssText = 'position:fixed;top:10px;left:10px;width:420px;background:#141225;z-index:99999;padding:10px;';
      document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      window.RarLive.mount(ta, { mode: 'inline', submit: 'mod' });
      window.__sp4Ta = ta;
    });
    const ed4 = page.locator('#tmp-sp4-host .rar-live');
    await ed4.click();
    await page.keyboard.type('rating | he dies');
    await page.keyboard.press('Control+a');
    await page.locator('#tmp-sp4-host .ct-btn[data-md="spoiler"]').click();
    model = await page.evaluate(() => window.__sp4Ta.value);
    hidden = Array.from(model.matchAll(READER_RX)).map((m) => m[1]).join(' ');
    expect(hidden).toContain('he dies');                            // the payload hides
    expect(model.replace(READER_RX, '').trim()).toBe('');           // no leaked tail
    await page.evaluate(() => document.getElementById('tmp-sp4-host').remove());
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
