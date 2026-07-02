const { test, expect } = require('./welcomed');

// gates 15-16 — public profiles. HEART INVARIANTS (gate-0 study §4d): a
// community profile carries NO gold token + NO count node; Blake's name goes
// to his DEN; banned → suspended tombstone; gone → graceful former member.
// Bio renders escape-first. Author names across surfaces carry the route.
test.describe('gates 15-16 — public profiles (static)', () => {

  test('PROTECT THE HEART: the profile header is purple, count-free; bio is escape-first; avatar https-only', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.profileHeaderHtml === 'function');
    const r = await page.evaluate(() => {
      const html = window.profileHeaderHtml({
        name: 'Mika', photo: 'http://evil.example/x.png',   // http -> must NOT render
        bio: '**hi** <img src=x onerror=alert(1)> ||spoiler||', sinceMs: 1700000000000,
      });
      const host = document.createElement('div'); host.innerHTML = html;
      return {
        gold: /#ff(d54a|b300|ce5a)|--gold|\bgold\b/i.test(html),
        count: /\d+\s*(posts?|threads?|repl(y|ies)|reviews?|votes?|likes?|karma|points?)/i.test(html),
        imgs: host.querySelectorAll('img').length,           // the http photo dropped -> initial avatar, no img
        scripts: host.querySelectorAll('[onerror],[onload],script').length,   // escaped text may SAY "onerror"; no NODE may carry it
        bold: !!host.querySelector('.profile-bio strong'),   // markdown still works in the bio
        spoiler: !!host.querySelector('.profile-bio .rar-spoiler'),
      };
    });
    expect(r.gold).toBe(false);
    expect(r.count).toBe(false);
    expect(r.imgs).toBe(0);
    expect(r.scripts).toBe(0);
    expect(r.bold).toBe(true);
    expect(r.spoiler).toBe(true);
  });

  // v1.10.2 (Blake's 3rd ask): his name opens THE CREATOR SHEET now — the
  // 'den' decision evolved to 'creator' (the sheet carries the Den path).
  test('profileDecision: Blake → the Creator sheet; banned → suspended; missing → former member; legacy users-doc → profile', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.profileDecision === 'function');
    const r = await page.evaluate(() => ({
      blake: window.profileDecision('G2jGRa14u8bzGAmeBTkvXy8PKmr1', { displayName: 'Blake' }, null),
      banned: window.profileDecision('u1', { displayName: 'X', isBanned: true }, null),
      normal: window.profileDecision('u2', { displayName: 'Y' }, null),
      legacy: window.profileDecision('u3', null, { username: 'Old' }),
      gone: window.profileDecision('u4', null, null),
    }));
    expect(r.blake).toBe('creator');
    expect(r.banned).toBe('suspended');
    expect(r.normal).toBe('profile');
    expect(r.legacy).toBe('profile-legacy');
    expect(r.gone).toBe('former');
  });

  test('author names carry the profile route on posts and cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.hubReplyHtml === 'function' && typeof window.hubThreadCardHtml === 'function');
    const r = await page.evaluate(() => {
      const post = window.hubReplyHtml({ id: 'p1', authorUid: 'mika-uid', body: 'hi' }, { authorName: 'Mika' });
      const card = window.hubThreadCardHtml({ id: 't1', authorUid: 'ren-uid', title: 'T', tag: 'general', createdAt: Date.now(), lastPostAt: Date.now(), pinned: false }, 'Ren');
      const h = (x) => { const d = document.createElement('div'); d.innerHTML = x; return d; };
      return {
        postUid: h(post).querySelector('.hub-post-name') ? h(post).querySelector('.hub-post-name').getAttribute('data-profile-uid') : null,
        cardUid: h(card).querySelector('.hub-card-by [data-profile-uid]') ? h(card).querySelector('.hub-card-by [data-profile-uid]').getAttribute('data-profile-uid') : null,
      };
    });
    expect(r.postUid).toBe('mika-uid');
    expect(r.cardUid).toBe('ren-uid');
  });
});
