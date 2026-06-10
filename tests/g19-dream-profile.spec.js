const { test, expect } = require('./welcomed');

// DREAM-PROFILE GATE — static contracts. The HEART rules are load-bearing here:
// the accent palette must hold no gold, the like row is the ONE count and it
// renders only on the profile sheet, and every customization string renders
// escape-first. Real-pixel proof (bg decodes, banner size, avatar click) lives
// in tests-e2e/dream-profile-emu.spec.js against the seeded sandbox.

test('account.html wears the account surface + the identity-studio scaffolding', async ({ request }) => {
  const res = await request.get('/account.html');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('data-surface="account"');
  expect(html).toContain('id="veil-pulse"');
  expect(html).toContain('id="acct-preview"');
  expect(html).toContain('id="prof-status"');
  expect(html).toContain('id="prof-bio"');
  expect(html).toContain('id="acct-tag-input"');
  expect(html).toContain('id="acct-accents"');
  expect(html).toContain('id="acct-bg-file"');
  expect(html).toContain('id="acct-featured"');
  expect(html).toContain('data-saved-controls="watchlist"');
  expect(html).toContain('data-saved-controls="favorites"');
  expect(html).toContain('id="acct-act-chips"');
});

test('the rotated account background webp ships (and is not a stub)', async ({ request }) => {
  const res = await request.get('/assets/account_background.webp');
  expect(res.status()).toBe(200);
  expect((await res.body()).length).toBeGreaterThan(100000);
});

test('the account veil step is its own density — personal, and NEVER the Den', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => document.documentElement.setAttribute('data-surface', 'account'));
  // @property veil vars transition over .45s — poll to the settled value.
  await expect
    .poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--veil-w0'))), { timeout: 5000 })
    .toBeCloseTo(0.62, 2);
  const w0 = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--veil-w0')));
  expect(w0).not.toBeCloseTo(0.80, 2);   // the Den's resting density stays Blake's
  expect(w0).not.toBeCloseTo(0.54, 2);   // and it's not just For-You re-badged
  // the account surface swaps the city for the neon-sakura night
  const bg = await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
  expect(bg).toContain('account_background.webp');
});

test('profileHeaderHtml: the carve-out count renders; gold never does; tags/status clamp; hostile strings stay inert', async ({ page }) => {
  await page.goto('/index.html');
  const out = await page.evaluate(() => window.profileHeaderHtml({
    name: 'Mika', photo: '', bio: 'plain bio', sinceMs: 0,
    status: 'S'.repeat(200),
    tags: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', '<img src=x onerror=alert(1)>'],
    likesCount: 5,
  }));
  // the ONE sanctioned count is present…
  expect(out).toContain('profile-like-count');
  expect(out).toContain('>5<');
  // …and nothing on the header is gold (heart)
  expect(out.toLowerCase()).not.toContain('#ffd54a');
  expect(out.toLowerCase()).not.toContain('#ffd866');
  // tags clamp to 6 even when 8 arrive (rules cap the count; render re-caps)
  expect((out.match(/class="profile-tag"/g) || []).length).toBe(6);
  // status clamps to 80 chars
  expect(out).not.toContain('S'.repeat(81));
  expect(out).toContain('S'.repeat(80));
  // hostile markup never lands raw
  expect(out).not.toContain('<img src=x');
  expect(out).not.toContain('<script');
});

test('profileHeaderHtml: no likesCount → NO like row (legacy users/ identities stay count-free)', async ({ page }) => {
  await page.goto('/index.html');
  const out = await page.evaluate(() => window.profileHeaderHtml({ name: 'Legacy', photo: '', bio: '', sinceMs: 0 }));
  expect(out).not.toContain('profile-like-row');
  expect(out).not.toContain('profile-like-count');
});

test('the accent palette: exactly the curated six, none of them gold', async ({ page }) => {
  await page.goto('/index.html');
  const colors = await page.evaluate(() => {
    const ACCENTS = ['violet', 'ember', 'teal', 'rose', 'sky', 'moss'];
    const host = document.createElement('section');
    host.className = 'profile-sheet';
    document.body.appendChild(host);
    const out = ACCENTS.map((a) => {
      host.setAttribute('data-accent', a);
      return getComputedStyle(host).getPropertyValue('--pf-accent').trim().toLowerCase();
    });
    host.remove();
    return out;
  });
  expect(colors).toHaveLength(6);
  for (const c of colors) {
    expect(c).toBeTruthy();
    expect(c).not.toBe('#ffd54a');
    expect(c).not.toBe('#ffd866');
  }
  // and an off-palette value falls back to the purple default (no arbitrary hex)
  const fallback = await page.evaluate(() => {
    const host = document.createElement('section');
    host.className = 'profile-sheet';
    host.setAttribute('data-accent', 'gold');
    document.body.appendChild(host);
    const v = getComputedStyle(host).getPropertyValue('--pf-accent').trim().toLowerCase();
    host.remove();
    return v;
  });
  expect(fallback).toBe('#bb86fc');
});

test('fix 1 CSS contract: a has-cover review row presents a full-width banner ABOVE a stacked headline', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const li = document.createElement('li');
    li.className = 'review-row has-cover';
    li.style.cssText = 'display:block;width:600px;';
    li.innerHTML = '<button type="button" class="row-toggle">'
      + '<span class="row-cover-banner"></span>'
      + '<span class="row-headline"><span class="row-avatar avatar">M</span><span class="row-title">T</span><span class="row-rating">9/10</span></span>'
      + '</button>';
    document.body.appendChild(li);
    const banner = li.querySelector('.row-cover-banner').getBoundingClientRect();
    const headline = li.querySelector('.row-headline').getBoundingClientRect();
    const toggle = li.querySelector('.row-toggle').getBoundingClientRect();
    const headlineDisplay = getComputedStyle(li.querySelector('.row-headline')).display;
    li.remove();
    return { bh: banner.height, bw: banner.width, tw: toggle.width, above: banner.bottom <= headline.top + 1, headlineDisplay };
  });
  expect(m.bh).toBeGreaterThanOrEqual(100);        // the old thumb was 34px tall
  expect(m.bw).toBeGreaterThan(m.tw * 0.85);       // …and 48px wide; the banner spans the row
  expect(m.above).toBe(true);
  expect(m.headlineDisplay).toBe('grid');
});

test('the deep-link router classifies profiles/<uid> (the profile_like ping) and rejects junk', async ({ page }) => {
  await page.goto('/index.html');
  const t = await page.evaluate(() => window.parseNotifTarget('profiles/prac-mika'));
  expect(t).toEqual({ kind: 'profile', uid: 'prac-mika' });
  const deep = await page.evaluate(() => window.parseNotifTarget('profiles/x/likes/y'));
  expect(deep.kind).toBe('none');
  const traversal = await page.evaluate(() => window.parseNotifTarget('profiles/../users/x'));
  expect(traversal.kind).toBe('none');
});
