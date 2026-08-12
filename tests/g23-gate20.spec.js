const { test, expect } = require('./welcomed');

// GATE 20 — static contracts. The headline tripwire: every brandSelect renders
// CLOSED (round 4 shipped them permanently open — .acct-dd-menu's display:flex
// beat the UA [hidden] rule, the same trap class as the consent banner and the
// inbox dot; Blake hit it on three different dropdowns).

test('gate 20 ROOT CAUSE: a [hidden] brandSelect menu paints display:none (closed by default)', async ({ page }) => {
  await page.goto('/index.html');
  const d = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'acct-dd-menu';
    el.setAttribute('hidden', '');
    document.body.appendChild(el);
    const v = getComputedStyle(el).display;
    el.remove(); return v;
  });
  expect(d).toBe('none');
});

test('gate 20: brandSelect builds its menu hidden (the factory contract)', async ({ request }) => {
  const js = await (await request.get('/account.js')).text();
  // the factory must set menu.hidden = true BEFORE mounting
  const factory = js.slice(js.indexOf('function brandSelect('), js.indexOf('function brandSelect(') + 2400);
  expect(factory).toContain('menu.hidden = true');
});

test('gate 20 (item 2): the avatar/background form rows are gone; the staging buffers remain', async ({ request }) => {
  const html = await (await request.get('/account.html')).text();
  expect(html).not.toContain('◉ Avatar');
  expect(html).not.toContain('🌌 Background</span>');
  expect(html).not.toContain('acct-bg-thumb');
  // the hover pills still have their machinery
  expect(html).toContain('id="avatar-file"');
  expect(html).toContain('id="acct-bg-file"');
  expect(html).toContain('id="avatar-pick"');
});

test('gate 20 (item 4): the section subtexts read plain (the creepy-intimate pass)', async ({ request }) => {
  const html = await (await request.get('/account.html')).text();
  expect(html).toContain('Anime you plan to watch');
  expect(html).toContain('Your favorite anime, all in one place.');
  expect(html).not.toContain('no judgment on the backlog');
  expect(html).not.toContain('stayed with you after the credits');
  expect(html).not.toContain('Every mark you');
});

test('gate 20 (items 6-7): the adder searches the wider world; collections carry descriptions', async ({ request }) => {
  const js = await (await request.get('/account.js')).text();
  expect(js).toContain('searchMediaList');                  // the live external search is wired
  expect(js).toContain("group('From the wider world'");     // no provider names in the copy
  expect(js).toContain('col-desc');                         // the description composer
  const html = await (await request.get('/account.html')).text();
  expect(html).toContain('id="col-desc"');
  // the public profile renders it too
  const sjs = await (await request.get('/script.js')).text();
  expect(sjs).toContain('profile-col-desc');
});

test('gate 20 (item 8): activity snippets are plain text (tokens stripped, no new HTML sink)', async ({ request }) => {
  const js = await (await request.get('/account.js')).text();
  expect(js).toContain('function activityPlain(');
  expect(js).toContain('activityPlain(it.desc)');
  // the renderer stays textContent — never innerHTML for the snippet
  const renderBlock = js.slice(js.indexOf('function activityPlain('), js.indexOf('function activityPlain(') + 3000);
  expect(renderBlock).not.toContain('desc.innerHTML');
});

test('gate 20 → A2: the LETTER ROOM wears the premium classes (the hero card is gone)', async ({ page, request }) => {
  const html = await (await request.get('/account.html')).text();
  // the peer flip killed the hero card + the People placeholder (Blake's word)
  expect(html).not.toContain('inbox-blake-card');
  expect(html).not.toContain('inbox-people-locked');
  expect(html).not.toContain('id="inbox-message-blake"');
  // the Letter Room surfaces
  expect(html).toContain('id="inbox-requests"');
  expect(html).toContain('id="inbox-req-bar"');
  expect(html).toContain('inbox-back-chip');
  expect(html).toContain('inbox-send-btn');
  expect(html).toContain('id="inbox-status"');
  // and the send button actually carries the premium paint (not a bare button)
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const b = document.createElement('button');
    b.className = 'inbox-send-btn'; document.body.appendChild(b);
    const cs = getComputedStyle(b);
    const out = { radius: cs.borderRadius, bg: cs.backgroundImage, cursor: cs.cursor };
    b.remove(); return out;
  });
  expect(m.radius).toContain('999');
  expect(m.bg).toContain('linear-gradient');
  expect(m.cursor).toBe('pointer');
});

// REWRITTEN v2.2.0 item 4 (2026-08-12). This used to assert the door CARRIED
// the catch-up strip. Blake: "I wanna completely get rid of that on both mobile
// and PC." So it now pins the opposite — the door is a door, and the surface it
// used to tease is reached by pressing Enter instead.
test('v2.2.0 item 1: the door carries NO catch-up strip and no Surprise-me', async ({ page, request }) => {
  const html = await (await request.get('/index.html')).text();
  expect(html).not.toContain('id="welcome-surprise"');   // removed per Blake — the nav's Random is the one dice
  expect(html, 'the door strip is gone from the markup').not.toContain('id="welcome-catchup"');
  const js = await (await request.get('/script.js')).text();
  // the strip's whole machinery went with it — not just its markup
  expect(js, 'the strip builder is gone').not.toContain('function catchupButton(');
  expect(js, 'the strip host is gone').not.toContain('function catchupHost(');
  // ...and Enter now routes through the gate that decides whether to show it
  expect(js, 'Enter goes through enterDen').toContain('function enterDen(');
  expect(js).toContain('enterBtn.addEventListener(\'click\', enterDen)');
  // the door's CSS went too — a stale .welcome-catchup rule would be dead weight
  const css = await (await request.get('/style.css')).text();
  expect(css).not.toContain('.welcome-catchup-btn');
  await page.goto('/index.html');
  // the door itself still opens and still has its Enter button
  expect(await page.locator('#welcome-enter').count()).toBe(1);
});

test('gate 20 (gold-flip): the secondary/<id> notif target parses and routes', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.parseNotifTarget === 'function');
  const m = await page.evaluate(() => ({
    ok: window.parseNotifTarget('secondary/21386'),
    junk: window.parseNotifTarget('secondary/not-a-number'),
    deep: window.parseNotifTarget('secondary/123/extra'),
  }));
  expect(m.ok).toEqual({ kind: 'secondary', id: '21386' });
  expect(m.junk).toEqual({ kind: 'none' });
  expect(m.deep).toEqual({ kind: 'none' });   // the regex is anchored — no smuggled paths
});

test('gate 20 (cherry): the footer wears the kicker vocabulary, copy untouched', async ({ page, request }) => {
  const html = await (await request.get('/index.html')).text();
  expect(html).toContain('ABOUT ME <span class="jp-mini">');
  expect(html).toContain('CONTACT ME <span class="jp-mini">');
  expect(html).toContain('could have never dreamed of');   // Blake's words (the B4 bio), untouched
  await page.goto('/index.html');
  const c = await page.evaluate(() => {
    const el = document.createElement('span');
    el.className = 'footer-kicker'; document.body.appendChild(el);
    const v = getComputedStyle(el).color;
    el.remove(); return v;
  });
  expect(c.replace(/\s/g, '')).toContain('246,239,255');     // full-bright, never dim
});

test('gate 20 (leak-class): the firebase ignore mirror covers the new root artifacts', async ({ request }) => {
  // firebase.json itself is hosting-ignored, so fetch it from disk via the test
  // process instead of the server.
  const fs = require('fs');
  const path = require('path');
  const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
  const ig = fb.hosting.ignore;
  for (const must of ['tests/**', 'tests-e2e/**', 'playwright.emu.config.js', '*.log', '*.bat', 'docs/**']) {
    expect(ig).toContain(must);
  }
});
