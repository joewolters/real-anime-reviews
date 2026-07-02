const { test, expect } = require('./welcomed');

// Gate 6 — the Lantern. Static surface (no Firebase): the pure notification model
// (unread math, Blake-origin-first sort = critic H4, vote rollup) + the glyph swap.
// The CF mute/no-ping behavior is covered by the emulator CF tests.
test.describe('v1.9.0 gate 6 — the Lantern (static surface)', () => {
  test('lanternModel: unread count, Blake-origin-first sort (H4), vote rollup', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.lanternModel === 'function');
    const ADMIN = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
    const r = await page.evaluate((ADMIN) => {
      const notifs = [
        { id: 'a', type: 'reply', fromUid: 'u1', createdAtMillis: 100 },
        { id: 'b', type: 'blake_message', fromUid: ADMIN, createdAtMillis: 50 },  // Blake-origin (by type)
        { id: 'c', type: 'comment_vote', fromUid: 'u2', createdAtMillis: 120 },   // vote -> rollup
        { id: 'd', type: 'review_vote', fromUid: 'u3', createdAtMillis: 130 },    // vote -> rollup
        { id: 'e', type: 'reply', fromUid: 'u4', createdAtMillis: 200 },          // newest non-vote
        { id: 'f', type: 'dm', fromUid: ADMIN, createdAtMillis: 80 },             // Blake-origin (by uid)
      ];
      const m = window.lanternModel(notifs, 90, ADMIN);
      return { unread: m.unreadCount, order: m.sorted.map((n) => n.id), rollup: m.rollup };
    }, ADMIN);
    expect(r.unread).toBe(4);                       // createdAtMillis > 90: a,c,d,e
    expect(r.order).toEqual(['f', 'b', 'e', 'a']);  // Blake-origin first (f>b), then non-Blake newest (e>a)
    expect(r.rollup).toEqual({ count: 2, hasAny: true });
  });

  test('the bell is replaced by the Lantern glyph (old dropdown gone)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!document.querySelector('#notif-btn'));
    const r = await page.evaluate(() => ({
      hasLanternIcon: !!document.querySelector('#notif-btn .lantern-icon'),
      noOldMenu: !document.querySelector('#notif-menu'),
    }));
    expect(r.hasLanternIcon).toBe(true);
    expect(r.noOldMenu).toBe(true);
  });

  test('deep-link parse (item 5): comment/reply -> parent comment, review -> review row, forum -> hash', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.parseNotifTarget === 'function');
    const r = await page.evaluate(() => ({
      comment: window.parseNotifTarget('comments/one-punch-man/items/seed-0'),
      reply: window.parseNotifTarget('comments/x/items/c1/replies/r1'), // a reply ping lands on its parent comment
      review: window.parseNotifTarget('reviews/x/items/uid1'),
      forum: window.parseNotifTarget('forum/t1'),
      none: window.parseNotifTarget(''),
    }));
    expect(r.comment).toEqual({ kind: 'comment', slug: 'one-punch-man', id: 'seed-0' });
    expect(r.reply).toEqual({ kind: 'comment', slug: 'x', id: 'c1' });
    expect(r.review).toEqual({ kind: 'review', slug: 'x', id: 'uid1' });
    expect(r.forum.kind).toBe('hash');
    expect(r.none.kind).toBe('none');
  });

  test('lanternModel: gold ember gates on Blake-origin unread only (unreadBlake)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.lanternModel === 'function');
    const ADMIN = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
    const r = await page.evaluate((ADMIN) => {
      // seen=100. Mixed: one community-unread + one Blake-unread + one read.
      const mixed = window.lanternModel([
        { id: 'g', type: 'reply', fromUid: 'u1', createdAtMillis: 200 },          // community unread
        { id: 'h', type: 'blake_message', fromUid: ADMIN, createdAtMillis: 150 }, // Blake unread
        { id: 'i', type: 'dm', fromUid: 'u2', createdAtMillis: 50 },              // read (<=100)
      ], 100, ADMIN);
      // community-only unread → NO gold (unreadBlake 0).
      const community = window.lanternModel([
        { id: 'j', type: 'reply', fromUid: 'u1', createdAtMillis: 200 },
      ], 100, ADMIN);
      return {
        mixed: { u: mixed.unreadCount, b: mixed.unreadBlake },
        community: { u: community.unreadCount, b: community.unreadBlake },
      };
    }, ADMIN);
    expect(r.mixed).toEqual({ u: 2, b: 1 });        // Blake present → gold ember
    expect(r.community).toEqual({ u: 1, b: 0 });    // community only → cool ember, never gold
  });

  test('gate 6d: header rail — Lantern + account silhouette as composed tokens', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!document.querySelector('#notif-btn'));
    const r = await page.evaluate(() => ({
      hasTokens: !!document.querySelector('.nav-links .header-tokens'),
      lanternInTokens: !!document.querySelector('.header-tokens #notif-btn .lantern-icon'),
      authInTokens: !!document.querySelector('.header-tokens #auth-open'),
      // signed-out → the account affordance is a head silhouette token, not the word "Sign in"
      silhouette: !!document.querySelector('#auth-open .account-silhouette'),
      noOldTopline: !document.querySelector('.nav-topline'),
    }));
    expect(r.hasTokens).toBe(true);
    expect(r.lanternInTokens).toBe(true);
    expect(r.authInTokens).toBe(true);
    expect(r.silhouette).toBe(true);
    expect(r.noOldTopline).toBe(true);
  });

  test('gate 6e: account page loads the Lantern module cleanly (item 2 + item 4)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/account.html');
    await page.waitForFunction(() => typeof window.lanternModel === 'function', null, { timeout: 8000 });
    const r = await page.evaluate(() => ({
      hasModel: typeof window.lanternModel === 'function',   // lantern.js imported + initLantern() ran
      hasBtn: !!document.querySelector('#notif-btn .lantern-icon'),  // Lantern lives in the account header
      noSearchX: !document.querySelector('.clear-btn'),     // item 4: the stray ✕ is gone
    }));
    expect(r.hasModel).toBe(true);
    expect(r.hasBtn).toBe(true);
    expect(r.noSearchX).toBe(true);
    expect(errors).toEqual([]);   // account page loads with no module/runtime errors
  });

  test('gate 6f: account deep-links carry the full target via #notif= (cross-page scroll)', async ({ page }) => {
    // gate A0 hardening: import on INDEX — the pure helper is page-agnostic, and
    // account.html's signed-out boot can navigate mid-evaluate (context-destroyed flake).
    await page.goto('/index.html');
    // Import the module directly + call the exported pure helper (reliable regardless
    // of page auto-init timing). notifHref is exactly what openNotifTarget navigates with.
    const r = await page.evaluate(async () => {
      const f = (await import('/lantern.js')).notifHref;
      return {
        comment: f('comments/one-punch-man/items/seed-0'),
        reply: f('comments/x/items/c1/replies/r1'),   // reply → carries full target (lands on parent c1)
        review: f('reviews/x/items/uid1'),
        forum: f('forum/t1'),
        animeOnly: f('', 'demon-slayer'),
      };
    });
    // comment/review carry the FULL target (so index scrolls to the exact message)…
    expect(r.comment).toBe('index.html#notif=' + encodeURIComponent('comments/one-punch-man/items/seed-0'));
    expect(r.reply).toBe('index.html#notif=' + encodeURIComponent('comments/x/items/c1/replies/r1'));
    expect(r.review).toBe('index.html#notif=' + encodeURIComponent('reviews/x/items/uid1'));
    // …forum/conversations keep their hash route; bare animeId falls back to #open=
    expect(r.forum).toBe('index.html#forum/t1');
    expect(r.animeOnly).toBe('index.html#open=demon-slayer');
  });
});
