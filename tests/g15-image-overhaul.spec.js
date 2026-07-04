const { test, expect } = require('./welcomed');

// IMAGE OVERHAUL (post gates 12-14) — the inline-placement contract, the
// thread thumbnail, the lightbox, and the spoiler-image interaction. The
// Storage/rules side is proven in test:rules/test:cf; THESE pin the client.
test.describe('image overhaul — inline tokens, thumbnail, lightbox (static)', () => {

  test('[img:N] emits an empty slot for 1-4 only; body text never carries a path', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.renderMarkdownInline === 'function');
    const r = await page.evaluate(() => ({
      one: window.renderMarkdownInline('look [img:1] here'),
      four: window.renderMarkdownInline('[img:4]'),
      five: window.renderMarkdownInline('[img:5]'),
      zero: window.renderMarkdownInline('[img:0]'),
      hostile: window.renderMarkdownInline('[img:1"><script>alert(1)</script>]'),
    }));
    expect(r.one).toContain('data-img-slot="1"');
    expect(r.one).not.toContain('uploads/');          // no path in the rendered body, ever
    expect(r.four).toContain('data-img-slot="4"');
    expect(r.five).not.toContain('data-img-slot');    // out of range stays literal
    expect(r.zero).not.toContain('data-img-slot');
    expect(r.hostile).not.toContain('<script>');      // escape-first holds
  });

  test('resolveImageSlots: text order wins, duplicates drop, missing refs drop, leftovers reported', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.resolveImageSlots === 'function');
    const r = await page.evaluate(() => {
      const refs = ['uploads/u1/d1/a', 'uploads/u1/d1/b', 'uploads/u1/d1/c'];
      const host = document.createElement('div');
      // slot 2 appears BEFORE slot 1 in the prose; slot 2 repeats; slot 4 has no ref
      host.innerHTML = window.renderMarkdownInline('x [img:2] y [img:1] z [img:2] w [img:4]');
      const used = window.resolveImageSlots(host, refs, { docPath: 'forum/t1', authorUid: 'u1' });
      const order = Array.from(host.querySelectorAll('img.hub-post-img')).map((i) => i.getAttribute('data-imgref'));
      return { order, usedSize: used.size, leftovers: refs.filter((p) => !used.has(p)) };
    });
    expect(r.order).toEqual(['uploads/u1/d1/b', 'uploads/u1/d1/a']);  // prose order, correct refs
    expect(r.usedSize).toBe(2);                                       // dup + missing both dropped
    expect(r.leftovers).toEqual(['uploads/u1/d1/c']);                 // gallery still gets the rest
  });

  test('thread card: user thumbnail renders (no src — SDK-hydrated); anime cover wins; hostile renders nothing', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubThreadCardHtml === 'function');
    const r = await page.evaluate(() => {
      const base = { id: 't1', title: 'T', tag: 'general', createdAt: Date.now(), lastPostAt: Date.now(), pinned: false };
      const own = window.hubThreadCardHtml({ ...base, thumbImage: 'uploads/u1/t1/pic' }, 'Mika');
      const both = window.hubThreadCardHtml({ ...base, thumbImage: 'uploads/u1/t1/pic', coverImage: 'https://img.anili.st/x.jpg' }, 'Mika');
      const evil = window.hubThreadCardHtml({ ...base, thumbImage: 'https://evil.example/x.png' }, 'Mika');
      const host = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
      return {
        ownThumb: host(own).querySelector('.hub-card-thumb') ? host(own).querySelector('.hub-card-thumb').getAttribute('data-imgref') : null,
        ownSrc: host(own).querySelector('.hub-card-thumb') ? host(own).querySelector('.hub-card-thumb').hasAttribute('src') : null,
        bothSrc: host(both).querySelector('.hub-card-thumb').getAttribute('src'),
        evilThumb: !!host(evil).querySelector('.hub-card-thumb'),
        gold: /#ff(d54a|b300)|--gold/i.test(own),
      };
    });
    expect(r.ownThumb).toBe('uploads/u1/t1/pic');
    expect(r.ownSrc).toBe(false);                                  // src only via getDownloadURL
    expect(r.bothSrc).toBe('https://img.anili.st/x.jpg');          // the anime cover wins
    expect(r.evilThumb).toBe(false);                               // hostile path → no thumb at all
    expect(r.gold).toBe(false);                                    // heart: thumbnails are purple-edged
  });

  test('lightbox: clicking a loaded post image opens the overlay with the SAME src; Esc closes', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubImagesHtml === 'function');
    const r = await page.evaluate(() => new Promise((resolve) => {
      const host = document.createElement('div'); document.body.appendChild(host);
      host.innerHTML = window.hubImagesHtml(['uploads/u1/d1/a'], { docPath: 'forum/t1', authorUid: 'u1' });
      const img = host.querySelector('img.hub-post-img');
      img.src = 'http://127.0.0.1:1/fake.png';  // never fetched in time — only the attribute matters
      img.classList.add('is-loaded');
      img.click();
      requestAnimationFrame(() => {
        const lb = document.querySelector('.rar-lightbox');
        const lbSrc = lb && lb.querySelector('.rar-lightbox-img') ? lb.querySelector('.rar-lightbox-img').getAttribute('src') : null;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        requestAnimationFrame(() => {
          resolve({ opened: !!lb, lbSrc, closed: !document.querySelector('.rar-lightbox') });
          host.remove();
        });
      });
    }));
    expect(r.opened).toBe(true);
    expect(r.lbSrc).toBe('http://127.0.0.1:1/fake.png');
    expect(r.closed).toBe(true);
  });

  test('spoiler + image: an [img:N] inside ||…|| resolves INSIDE the hidden spoiler', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.resolveImageSlots === 'function');
    const r = await page.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = window.renderMarkdownInline('the panel: ||[img:1]||');
      window.resolveImageSlots(host, ['uploads/u1/d1/a'], { docPath: 'forum/t1', authorUid: 'u1' });
      const sp = host.querySelector('.rar-spoiler');
      return { inSpoiler: !!(sp && sp.querySelector('img.hub-post-img')) };
    });
    expect(r.inSpoiler).toBe(true);   // blurred until revealed (visibility:hidden children)
  });

  // LAST CALL A5 — the toolbar 📷 is DEAD everywhere (the picker strip's
  // "Add an image" is THE one affordance), and the 🔗 button died with it.
  // The toolbar is exactly B / I / 👁 no matter what options are passed.
  test('RarLive toolbar: never an image button, never a link button — B/I/👁 only', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.RarLive && typeof window.RarLive.mount === 'function');
    const r = await page.evaluate(() => {
      const mk = (opts) => {
        const host = document.createElement('div'); document.body.appendChild(host);
        const ta = document.createElement('textarea'); host.appendChild(ta);
        window.RarLive.mount(ta, opts);
        const n = host.querySelectorAll('.ct-btn').length;
        const cam = !!host.querySelector('[data-md="image"]');
        const link = !!host.querySelector('[data-md="link"]');
        host.remove();
        return { n, cam, link };
      };
      return { with: mk({ inline: true, submit: 'enter', onImage: () => {} }), without: mk({ inline: true, submit: 'enter' }) };
    });
    expect(r.with.n).toBe(3);    expect(r.with.cam).toBe(false);  expect(r.with.link).toBe(false);
    expect(r.without.n).toBe(3); expect(r.without.cam).toBe(false); expect(r.without.link).toBe(false);
  });
});
