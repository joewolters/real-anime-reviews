// g31 — THE MEGA-RUN's structural pins, gate by gate (A0 first).
// Gate A0: the Lantern is ONE module. script.js used to carry a duplicated
// twin of lantern.js that had already drifted (its mute list lacked
// request_done) — the twin is dead; index rides lantern.js through hooks.
const { test, expect } = require('@playwright/test');

test('gA0: script.js carries NO lantern twin — lantern.js is the single source', async ({ page }) => {
  const sjs = await (await page.request.get('/script.js')).text();
  // the twin's load-bearing structures may never come back
  expect(sjs).not.toContain('NOTIF_TYPE_META');
  expect(sjs).not.toContain('function subscribeNotifications');
  expect(sjs).not.toContain('function renderLanternCenter');
  // the ONE module rides in versioned (cache-bust discipline)
  expect(sjs).toMatch(/from '\.\/lantern\.js\?v=[\d.]+'/);
});

test('gA0: the index page hooks ride into the ONE Lantern (router, chip, scroll-lock)', async ({ page }) => {
  const sjs = await (await page.request.get('/script.js')).text();
  expect(sjs).toContain('openTarget: openNotifTarget');       // in-page deep-link router
  expect(sjs).toContain('onRowNavigate: showLanternBackChip'); // the back chip
  expect(sjs).toContain('onOpen: hideLanternBackChip');
  expect(sjs).toContain('keepScrollLock');                     // modal-under-lantern guard
});

test('gA0: the drift is dead — lantern.js mute strip carries request_done + the exports exist', async ({ page }) => {
  const ljs = await (await page.request.get('/lantern.js')).text();
  // the mute chip list (the exact drift the twin had)
  const mutes = ljs.slice(ljs.indexOf('renderLanternMutes'), ljs.indexOf('renderLanternMutes') + 600);
  expect(mutes).toContain("'request_done'");
  // the shared surface index depends on
  expect(ljs).toContain('export function initLantern');
  expect(ljs).toContain('export function openLanternCenter');
  expect(ljs).toContain('export async function markAllNotifsRead');
});

// ── gate A2 — THE LETTER ROOM ────────────────────────────────────────────────
test('gA2: decline is SILENT — the sender-side pins (pending == declined, generic block copy)', async ({ page }) => {
  const js = await (await page.request.get('/account.js')).text();
  // the sender's row treats 'request' and 'declined' identically — the two
  // states must be indistinguishable on their side (anti-harassment)
  expect(js).toMatch(/c\.state === 'request' \|\| c\.state === 'declined'/);
  // a rules-denied first letter renders GENERIC copy (a blocked member must
  // never learn they're blocked)
  expect(js).toContain("can't receive your letter");
  // the inbox never alert()s — the friendly status line owns failures
  const inboxBlock = js.slice(js.indexOf('function initInbox('));
  expect(inboxBlock).not.toContain('alert(');
});

test('gA2: every profile sheet carries the letter door (✉ Message → the Letter Room)', async ({ page }) => {
  const sjs = await (await page.request.get('/script.js')).text();
  expect(sjs).toContain('profile-message');
  expect(sjs).toContain("'account.html#inbox/new/'");
  const js = await (await page.request.get('/account.js')).text();
  expect(js).toMatch(/#inbox\\\/new\\\//);            // the route regex exists
  expect(js).toContain('openComposeNew');
});

test('gA2: request-first wiring pins — the strip, the flip, the block, the conv-mute', async ({ page }) => {
  const js = await (await page.request.get('/account.js')).text();
  expect(js).toContain('isIncomingRequest');
  expect(js).toMatch(/updateDoc\(doc\(db, 'conversations', openConvId\), \{ state: nextState \}\)/);
  expect(js).toMatch(/doc\(db, 'blocks', user\.uid, 'list'/);   // block writes to MY list
  expect(js).toContain("'conv:' + openConvId");                 // per-conversation mute key
  expect(js).toMatch(/kind: 'peer', state: 'request', creatorUid: user\.uid/); // the knock-first create
});

test('gA0: the live lantern still exposes the pure model on index (behavior anchor)', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.lanternModel === 'function', null, { timeout: 15000 });
  const m = await page.evaluate(() => {
    const now = Date.now();
    const r = window.lanternModel([
      { type: 'reply', fromUid: 'x', createdAtMillis: now },
      { type: 'blake_message', fromUid: 'G2jGRa14u8bzGAmeBTkvXy8PKmr1', createdAtMillis: now - 1000 },
      { type: 'comment_vote', fromUid: 'y', createdAtMillis: now },
    ], 0);
    return { unread: r.unreadCount, blake: r.unreadBlake, first: r.sorted[0].type, rollup: r.rollup.count };
  });
  expect(m.unread).toBe(3);
  expect(m.blake).toBe(1);
  expect(m.first).toBe('blake_message');   // Blake sorts first — gold discipline
  expect(m.rollup).toBe(1);                // votes collapse
});
