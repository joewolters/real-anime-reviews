const { test, expect } = require('./welcomed');

// v1.10.0 gates 6-8 — the Community Hub ("The Lantern Room"). Static surface (no
// Firebase): the PURE list model (sort + anime-tag parse), the protect-the-heart
// render invariants (no gold / no count on community cards; the gold lives ONLY in
// the "From Blake's 44" shelf + verdict rail), and the DOM open + veil step. The
// live forum data (subscription, posting, votes) is smoked in the seeded sandbox.
test.describe('v1.10.0 gates 6-8 — Community Hub (static surface)', () => {

  test('hubSortThreads: New=createdAt, Top=postCount, Hot=activity; pinned floats first', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubSortThreads === 'function');
    const r = await page.evaluate(() => {
      const T = [
        { id: 'a', createdAt: 100, lastPostAt: 100, postCount: 1 },
        { id: 'b', createdAt: 300, lastPostAt: 150, postCount: 9 },
        { id: 'c', createdAt: 200, lastPostAt: 500, postCount: 3 },
        { id: 'p', createdAt: 50,  lastPostAt: 50,  postCount: 0, pinned: true },
      ];
      const ids = (s) => window.hubSortThreads(T, s).map((t) => t.id);
      return { neu: ids('new'), top: ids('top'), hot: ids('hot') };
    });
    expect(r.neu[0]).toBe('p'); expect(r.top[0]).toBe('p'); expect(r.hot[0]).toBe('p'); // pinned first always
    expect(r.neu.slice(1)).toEqual(['b', 'c', 'a']);  // New: createdAt desc
    expect(r.top.slice(1)).toEqual(['b', 'c', 'a']);  // Top: postCount desc
    expect(r.hot.slice(1)).toEqual(['c', 'b', 'a']);  // Hot: lastPostAt (activity) desc
  });

  test('hubAnimeSlugFromTag parses anime:<slug> only', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubAnimeSlugFromTag === 'function');
    const r = await page.evaluate(() => ({
      ok: window.hubAnimeSlugFromTag('anime:one-punch-man'),
      gen: window.hubAnimeSlugFromTag('general'),
      bad: window.hubAnimeSlugFromTag('anime:One Punch'),
    }));
    expect(r.ok).toBe('one-punch-man');
    expect(r.gen).toBe(null);
    expect(r.bad).toBe(null);   // uppercase/space rejected (mirrors the rules regex)
  });

  test('PROTECT THE HEART: a thread card carries NO gold and NO count node', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubThreadCardHtml === 'function');
    const r = await page.evaluate(() => {
      const html = window.hubThreadCardHtml(
        { id: 't1', title: 'A normal thread', tag: 'general', createdAt: Date.now(), lastPostAt: Date.now(), postCount: 12, pinned: false },
        'Mika');
      return {
        gold: /#ff(d54a|b300|ce5a)|gold/i.test(html),
        count: /\d+\s*(posts?|repl(y|ies)|votes?|likes?|karma|points?)/i.test(html),
      };
    });
    expect(r.gold).toBe(false);   // community card = purple, never gold
    expect(r.count).toBe(false);  // no post/reply/vote count node (heart spec)
  });

  test('PROTECT THE HEART: the "From Blake\'s 44" shelf IS the one gold expression', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubBlakeShelfHtml === 'function' && typeof window.hubBlakes44 === 'function' && window.hubBlakes44().length > 0);
    const r = await page.evaluate(() => {
      const html = window.hubBlakeShelfHtml();
      return { has: !!html, gold: /#ffd54a|#ffb300|hub-shelf-rating/i.test(html) };
    });
    expect(r.has).toBe(true);     // Blake's 44 (animeData entries with a Rating) seed the shelf
    expect(r.gold).toBe(true);    // the ONE concentrated gold expression
  });

  test('PROTECT THE HEART: the verdict rail carries gold; a community card does not', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubVerdictRailHtml === 'function' && typeof window.hubBlakes44 === 'function' && window.hubBlakes44().length > 0);
    const r = await page.evaluate(() => {
      const a = window.hubBlakes44()[0];
      const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const rail = window.hubVerdictRailHtml('anime:' + slug(a.Title));
      const card = window.hubThreadCardHtml({ id: 'x', title: 'free thread', tag: 'general', createdAt: Date.now(), lastPostAt: Date.now() }, 'Ren');
      return { railGold: /hub-verdict-score|#ffd54a/i.test(rail), cardGold: /#ff(d54a|b300|ce5a)|gold/i.test(card) };
    });
    expect(r.railGold).toBe(true);   // his verdict = gold
    expect(r.cardGold).toBe(false);  // the community card = purple
  });

  test('Community opens the Hub drawer + flips the veil to "hub" (cozier than Discover, ≠ Den)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!document.getElementById('community-btn'));
    await page.click('#community-btn');
    await expect(page.locator('.hub-layer')).toBeVisible();
    await expect(page.locator('.hub-layer .hub-title')).toContainText('Tavern');   // gate 8b rename: "The Lantern Room" -> "The Tavern"
    await page.waitForTimeout(560);   // veil crossfade settles
    const r = await page.evaluate(() => ({
      surface: document.documentElement.dataset.surface,
      hubW0: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--veil-w0')),
    }));
    expect(r.surface).toBe('hub');
    expect(r.hubW0).toBeGreaterThan(0.28);  // cozier than Discover
    expect(r.hubW0).toBeLessThan(0.80);     // distinct from Den's resting value
  });

  // gate 8b/8c "The Tavern" — the deep reply bar: thumbs + Reply inline, with Report +
  // Edit/Delete in the ⋯ menu (gate 8c), while staying PURPLE + COUNT-FREE (heart rule).
  test('PROTECT THE HEART: a Tavern reply has thumbs + report + reply-to-reply but NO count and NO gold', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubReplyHtml === 'function');
    const r = await page.evaluate(() => {
      const html = window.hubReplyHtml(
        { id: 'p1', authorUid: 'u1', body: 'Rewatched all 12 and it still holds up.', createdAt: Date.now() },
        { depth: 0, authorName: 'Mika', isOwn: true, menuOpen: true });   // gate 8c: Report/Edit/Delete live in the ⋯ menu
      return {
        thumbUp:   /data-hub-vote="up"/.test(html) && /vote-ico/.test(html),
        thumbDown: /data-hub-vote="down"/.test(html) && /vote-ico--down/.test(html),
        report:    /data-report-post/.test(html),
        reply:     /data-reply-to/.test(html),
        editDel:   /data-edit-post/.test(html) && /data-del-post/.test(html),
        gold:      /#ff(d54a|b300|ce5a)|gold|vcount/i.test(html),
        count:     /\d+\s*(posts?|repl(y|ies)|votes?|likes?|karma|points?)/i.test(html),
      };
    });
    expect(r.thumbUp).toBe(true);     // 👍 (item 5)
    expect(r.thumbDown).toBe(true);   // 👎 a real downvote (item 6)
    expect(r.report).toBe(true);      // Report (in the ⋯ menu)
    expect(r.reply).toBe(true);       // reply-to-reply (item 6)
    expect(r.editDel).toBe(true);     // edit/delete-own (in the ⋯ menu)
    expect(r.gold).toBe(false);       // never gold, never a .vcount span
    expect(r.count).toBe(false);      // count-free even with digits in the body (heart rule)
  });

  // gate 8c extra — Blake's-pick is the ONLY gold permitted in the reply stream.
  test('PROTECT THE HEART: a reply is gold ONLY when Blake-picked', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubReplyHtml === 'function');
    const r = await page.evaluate(() => {
      const plain  = window.hubReplyHtml({ id: 'p1', authorUid: 'u1', body: 'a take', createdAt: Date.now() }, { depth: 0, authorName: 'Mika' });
      const picked = window.hubReplyHtml({ id: 'p2', authorUid: 'u1', body: 'the best take', createdAt: Date.now(), blakePick: true }, { depth: 0, authorName: 'Mika' });
      return {
        plainGold:  /hub-post--pick|hub-pick-badge/.test(plain),
        pickedGold: /hub-post--pick/.test(picked) && /hub-pick-badge/.test(picked),
      };
    });
    expect(r.plainGold).toBe(false);   // a normal community reply = purple, never gold
    expect(r.pickedGold).toBe(true);   // Blake's pick = the one owner-granted gold in the stream
  });

  // gate 8d — an attached-anime cover renders, but a NON-44 cover is never gold (heart).
  test('PROTECT THE HEART: an anime-cover card shows the cover but NO gold / NO count', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubThreadCardHtml === 'function');
    const r = await page.evaluate(() => {
      const html = window.hubThreadCardHtml({ id: 'c1', title: 'gorgeous season', tag: 'anime:al:16498', animeTitle: 'Some Anime', coverImage: 'https://s4.anilist.co/x.jpg', createdAt: Date.now(), lastPostAt: Date.now() }, 'Mika');
      return { cover: /hub-card-thumb/.test(html) && /s4\.anilist\.co/.test(html), gold: /#ff(d54a|b300|ce5a)|gold/i.test(html), count: /\d+\s*(posts?|repl(y|ies)|votes?|likes?|karma|points?)/i.test(html) };
    });
    expect(r.cover).toBe(true);    // the AniList cover renders on the card
    expect(r.gold).toBe(false);    // a non-44 attached anime = cover only, never gold
    expect(r.count).toBe(false);   // count-free
  });

  // gate 9 — the Rising rail: slot 1 gold (Blake's pinned pick), the rest purple, count-free.
  test('PROTECT THE HEART: the Rising rail is gold ONLY at slot 1 (Blake), rest purple, no count', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubRisingRailHtml === 'function');
    const r = await page.evaluate(() => {
      const threads = [
        { id: 'a', title: 'Blake pinned this', pinned: true, hotScore: 5, lastPostAt: 100 },
        { id: 'b', title: 'a community thread', hotScore: 9, lastPostAt: 200 },
        { id: 'c', title: 'another community thread', hotScore: 3, lastPostAt: 150 },
      ];
      const html = window.hubRisingRailHtml(threads);
      return {
        has: !!html,
        oneGold: (html.match(/is-blake/g) || []).length === 1,   // exactly one gold slot
        blakeFirst: html.indexOf('Blake pinned this') !== -1 && html.indexOf('is-blake') < html.indexOf('a community thread'),
        count: /\d+\s*(posts?|repl(y|ies)|votes?|likes?|karma|points?)/i.test(html),
      };
    });
    expect(r.has).toBe(true);
    expect(r.oneGold).toBe(true);    // ONLY slot 1 (Blake's pinned) is gold
    expect(r.blakeFirst).toBe(true); // Blake tops the rail; community rises beneath
    expect(r.count).toBe(false);     // no hotScore number / count shown
  });

});
