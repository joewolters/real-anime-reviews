const { test, expect } = require('./welcomed');

// v1.9.1 / v1.9.1b — composer redesign + polish (window.RarComposer). The signed-in
// SUBMIT routing is covered by practice-mode smoke; here we pin the durable DOM, the
// XSS-safe live preview, the wrap primitive, and the v1.9.1b polish: the hint lives ONLY
// on the review composer (comments drop it), a read-only/signed-out composer hides its
// toolbar + preview, and the "My review" chip. Most logic is exercised on a CONSTRUCTED
// writable textarea so it's deterministic without auth (the real modal composers are
// read-only while signed out).
async function openFirstModal(page) {
  await page.goto('/');
  await page.click('#view-all-btn');
  await page.waitForSelector('.card-container .card');
  await page.locator('.card-container .card').first().click();
  await expect(page.locator('#anime-modal')).toBeVisible();
  await page.waitForSelector('.review-composer');
}

test.describe('v1.9.1b — composer redesign + polish', () => {
  test('signed-out modal: toolbars are injected but HIDDEN, comments have NO hint, "My review" chip hidden', async ({ page }) => {
    await openFirstModal(page);
    // toolbar structure is injected (3 buttons exist in the DOM)…
    await expect(page.locator('.review-composer .ct-btn')).toHaveCount(3);
    // …but hidden while signed out (read-only composer)
    await expect(page.locator('.review-composer .composer-toolbar')).toBeHidden();
    await expect(page.locator('.sheet--left .composer-body .composer-toolbar').first()).toBeHidden();
    // v1.9.1b: comment composers no longer carry a key hint at all
    await expect(page.locator('.sheet--left .composer-body .composer-keyhint')).toHaveCount(0);
    // the "My review" chip exists but is hidden (signed out → no own review)
    await expect(page.locator('.comm-mine-chip')).toHaveCount(1);
    await expect(page.locator('.comm-mine-chip')).toBeHidden();
  });

  test('review composer: live FULL-markdown preview (XSS-safe) + premium keycap hint', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarComposer && typeof window.RarComposer.enhance === 'function');
    const r = await page.evaluate(() => {
      const ta = document.createElement('textarea');
      document.body.appendChild(ta);
      const api = window.RarComposer.enhance(ta, { inline: false, submit: 'mod' });
      ta.value = '## Verdict\n**bold** and *italic* and <img src=x onerror=alert(1)>';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const previewHtml = api.preview.hidden ? null : api.preview.innerHTML;
      const hint = ta.parentNode.querySelector('.composer-keyhint');
      const hintInfo = hint ? { kbd: hint.querySelectorAll('.ck-kbd').length, text: hint.textContent } : null;
      const out = { previewHtml, hintInfo };
      ta.remove(); api.toolbar.remove(); api.preview.remove(); if (hint) hint.remove();
      return out;
    });
    expect(r.previewHtml).toBeTruthy();
    expect(r.previewHtml).toMatch(/<h[1-6]/);            // ## renders as a header (reviews allow headers)
    expect(r.previewHtml).toContain('<strong>bold</strong>');
    expect(r.previewHtml).toContain('<em>italic</em>');
    expect(r.previewHtml).not.toContain('<img');         // raw HTML escaped, never rendered
    expect(r.hintInfo).toBeTruthy();                     // reviews KEEP the hint
    expect(r.hintInfo.kbd).toBe(2);                      // two premium keycaps (MOD + Enter)
    expect(r.hintInfo.text).not.toContain('Shift+Enter');
  });

  test('comment composer: inline preview (conditional, no headers), NO hint, read-only hides it all', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarComposer && typeof window.RarComposer.enhance === 'function');
    const r = await page.evaluate(async () => {
      const ta = document.createElement('textarea');
      document.body.appendChild(ta);
      const api = window.RarComposer.enhance(ta, { inline: true, submit: 'enter' });

      ta.value = '**hi** ## not a header';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const shownHtml = api.preview.hidden ? null : api.preview.innerHTML;

      ta.value = 'just a plain comment';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const hiddenOnPlain = api.preview.hidden;

      const hasHint = !!ta.parentNode.querySelector('.composer-keyhint');

      // read-only → the MutationObserver hides toolbar + preview (wait a tick for it)
      ta.value = '**stuff**'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.readOnly = true;
      await new Promise((res) => setTimeout(res, 40));
      const out = {
        shownHtml, hiddenOnPlain, hasHint,
        roToolbarHidden: api.toolbar.hidden, roPreviewHidden: api.preview.hidden,
      };
      ta.remove(); api.toolbar.remove(); api.preview.remove();
      return out;
    });
    expect(r.shownHtml).toBeTruthy();
    expect(r.shownHtml).toContain('<strong>hi</strong>');
    expect(r.shownHtml).not.toContain('<h');             // inline renderer never emits headers
    expect(r.hiddenOnPlain).toBe(true);                  // plain text → no preview
    expect(r.hasHint).toBe(false);                       // v1.9.1b: comments lose the hint
    expect(r.roToolbarHidden).toBe(true);                // v1.9.1b: read-only/signed-out hides toolbar
    expect(r.roPreviewHidden).toBe(true);
  });

  test('RarComposer.wrap wraps the textarea selection (the B/I primitive)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarComposer && typeof window.RarComposer.wrap === 'function');
    const out = await page.evaluate(() => {
      const ta = document.createElement('textarea');
      ta.value = 'hello world';
      document.body.appendChild(ta);
      ta.setSelectionRange(0, 5);                       // select "hello"
      window.RarComposer.wrap(ta, '**', '**', 'x');
      const v = ta.value;
      ta.remove();
      return v;
    });
    expect(out).toBe('**hello** world');
  });
});
