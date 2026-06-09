const { test, expect } = require('./welcomed');

// v1.10.0 gates 12-14 — forum image attachments (static surface). The Storage
// rules + pipeline CF are proven in test:rules / test:cf; THESE pin the client
// render contract: hostile refs never reach the DOM, srcs are never string-built,
// every rendered image carries the Report affordance, and the surface is PURPLE
// (protect-the-heart). Plus the 8d composer preview-clear mechanism.
test.describe('v1.10.0 gates 12-14 — forum images (static surface)', () => {

  test('hubImagesHtml: hostile refs render NOTHING (scheme/shape gate)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubImagesHtml === 'function');
    const r = await page.evaluate(() => ({
      url: window.hubImagesHtml(['https://evil.example/x.png']),
      data: window.hubImagesHtml(['data:image/png;base64,AAAA']),
      traversal: window.hubImagesHtml(['uploads/u/../../secrets']),
      wrongRoot: window.hubImagesHtml(['avatars/u/d/i']),
      nonString: window.hubImagesHtml([42, null, {}]),
      injection: window.hubImagesHtml(['uploads/u/d/i" onerror="alert(1)']),
      empty: window.hubImagesHtml([]),
      missing: window.hubImagesHtml(undefined),
    }));
    for (const k of Object.keys(r)) expect(r[k]).toBe('');
  });

  test('hubImagesHtml: valid refs -> lazy img with data-imgref and NO src; >4 capped at 4', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubImagesHtml === 'function');
    const r = await page.evaluate(() => {
      const refs = ['uploads/u1/d1/a', 'uploads/u1/d1/b', 'uploads/u1/d1/c', 'uploads/u1/d1/d', 'uploads/u1/d1/e'];
      const html = window.hubImagesHtml(refs, { docPath: 'forum/t1/posts/p1', authorUid: 'u1' });
      const host = document.createElement('div'); host.innerHTML = html;
      const imgs = host.querySelectorAll('img.hub-post-img');
      return {
        count: imgs.length,
        anySrc: Array.from(imgs).some((i) => i.hasAttribute('src')),   // src ONLY via getDownloadURL later
        lazy: Array.from(imgs).every((i) => i.getAttribute('loading') === 'lazy'),
        refs: Array.from(imgs).map((i) => i.getAttribute('data-imgref')),
      };
    });
    expect(r.count).toBe(4);            // the 4-image cap holds at render too
    expect(r.anySrc).toBe(false);
    expect(r.lazy).toBe(true);
    expect(r.refs[0]).toBe('uploads/u1/d1/a');
  });

  test('every rendered image carries the ⚑ Report affordance (the one mandatory mitigation)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubImagesHtml === 'function');
    const r = await page.evaluate(() => {
      const html = window.hubImagesHtml(['uploads/u1/d1/a', 'uploads/u1/d1/b'], { docPath: 'forum/t1', authorUid: 'u1' });
      const host = document.createElement('div'); host.innerHTML = html;
      return {
        imgs: host.querySelectorAll('img.hub-post-img').length,
        flags: host.querySelectorAll('[data-img-report]').length,
        removes: host.querySelectorAll('[data-img-remove]').length,   // not admin here
        doc: host.querySelector('[data-img-report]').getAttribute('data-img-doc'),
      };
    });
    expect(r.flags).toBe(r.imgs);       // one Report per image, no exceptions
    expect(r.removes).toBe(0);          // 🗑 is admin-only
    expect(r.doc).toBe('forum/t1');
  });

  test('PROTECT THE HEART: the image surface is purple — no gold token, no count; admin sees 🗑', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubImagesHtml === 'function');
    const r = await page.evaluate(() => {
      window.__rarIsAdmin = true;
      const html = window.hubImagesHtml(['uploads/u1/d1/a'], { docPath: 'forum/t1', authorUid: 'u1' });
      window.__rarIsAdmin = false;
      return {
        gold: /#ff(d54a|b300|ce5a)|--gold|\bgold\b/i.test(html),
        count: /\d+\s*(posts?|repl(y|ies)|votes?|likes?|karma|points?)/i.test(html),
        adminRemove: /data-img-remove/.test(html),
      };
    });
    expect(r.gold).toBe(false);
    expect(r.count).toBe(false);
    expect(r.adminRemove).toBe(true);
  });

  test('8d fix #1 — clearing a composer + dispatching input empties the live preview', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarComposer && typeof window.RarComposer.enhance === 'function');
    const r = await page.evaluate(() => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const ta = document.createElement('textarea'); host.appendChild(ta);
      window.RarComposer.enhance(ta, { inline: true, submit: 'enter' });
      ta.value = 'some **bold** text';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const preview = host.querySelector('.composer-preview');
      const shownWhileTyping = preview && !preview.hidden && preview.innerHTML.length > 0;
      // the post-success pattern every composer now uses:
      ta.value = '';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const clearedAfterPost = preview && preview.hidden && preview.innerHTML === '';
      host.remove();
      return { shownWhileTyping, clearedAfterPost };
    });
    expect(r.shownWhileTyping).toBe(true);
    expect(r.clearedAfterPost).toBe(true);
  });
});
