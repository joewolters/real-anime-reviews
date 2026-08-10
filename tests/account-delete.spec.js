// PART A item 7 — self-serve account deletion.
// <!-- author: Code | date: 2026-08-10 -->
// The client half: the Leaving card in account settings (its frictions, its
// honesty, and its real painted pixels) plus the author-deletion tombstone in
// the hub renderers. The server half — including the third-party-survival
// hazard — is proved in functions/cf-tests/cf-account.spec.js.
const { test, expect } = require('@playwright/test');

// account.js sends a signed-out visitor to index.html?signin=1, which would end
// every browser test here before it starts. Stub the ONE assignment so the page
// stays put — the Leaving card's markup, styles and handlers are all wired at
// module load and don't depend on a session, so what paints is the real thing.
// window.location is [Unforgeable] (an init script can't shadow it) and
// aborting the main-frame navigation destroys the execution context. So the
// ONE line that sends a signed-out visitor away is neutered in the served
// module instead: everything else — the real markup, the real stylesheet, the
// real handlers — is exactly what a member gets.
async function openAccount(page) {
  await page.route('**/account.js*', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).split("location.href = 'index.html?signin=1';").join('void 0;');
    await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/javascript' } });
  });
  await page.goto('/account.html');
  await page.waitForFunction(() => !!document.getElementById('acct-del-open'), null, { timeout: 20000 });
  // The Leaving card lives in the Settings panel — one of eight tabs, hidden
  // until selected. The rail is not used here: for a signed-out visitor its
  // handler isn't wired, and clicking it navigates. The panel is a client-side
  // hide, not a route, so reveal it directly (the catalog-admin precedent) —
  // what then paints is the real card with the real stylesheet.
  await page.evaluate(() => {
    const t = document.getElementById('tab-settings');
    if (t) t.hidden = false;
  });
  await page.waitForSelector('#acct-del-open', { state: 'visible', timeout: 10000 });
}

// ---------------------------------------------------------------------------
// the Leaving card
// ---------------------------------------------------------------------------

test('the Leaving card exists, is closed by default, and uses zero native dialogs', async ({ page }) => {
  const html = await (await page.request.get('/account.html')).text();
  expect(html).toContain('id="acct-danger"');
  expect(html).toContain('id="acct-del-open"');
  expect(html).toContain('id="acct-del-panel"');
  expect(html).toContain('id="acct-del-confirm"');
  expect(html).toContain('id="acct-del-go"');
  // the panel ships hidden — nobody lands on an armed delete form
  expect(html).toMatch(/id="acct-del-panel"[^>]*hidden/);

  const js = await (await page.request.get('/account.js')).text();
  expect(js).toContain('deleteMyAccount');
  expect(js).toContain('reauthenticateWithCredential');
  expect(js).toContain('getIdToken(true)');   // force a fresh auth_time for the callable
  const block = js.slice(js.indexOf('const delOpenBtn'), js.indexOf('avatarPick?.addEventListener'));
  expect(block).not.toMatch(/\balert\(|\bconfirm\(|\bprompt\(/);
});

test('the card says what happens BEFORE it asks for anything', async ({ page }) => {
  // Blake's locked policy, stated to the member in their own terms. If the copy
  // and the cascade ever disagree, one of them is lying to a real person.
  const html = await (await page.request.get('/account.html')).text();
  const card = html.slice(html.indexOf('id="acct-danger"'), html.indexOf('id="acct-danger"') + 3000);
  expect(card).toMatch(/erased/i);                       // their words go
  expect(card).toMatch(/removed by the author/i);        // what the slot will read
  expect(card).toMatch(/other members keep their words/i); // hazard #2, promised out loud
  expect(card).toMatch(/letters are closed, not destroyed/i);
  expect(card).toMatch(/cannot be undone/i);
  expect(card).toMatch(/straight away|no waiting period/i); // immediate, not a grace period
  expect(card).toMatch(/Type <b>DELETE<\/b>/);
});

test('REAL PIXELS: the delete button is armed only by the typed word', async ({ page }) => {
  await openAccount(page);
  const open = page.locator('#acct-del-open');
  await expect(open).toBeVisible();
  await expect(page.locator('#acct-del-panel')).toBeHidden();

  await open.click();
  await expect(page.locator('#acct-del-panel')).toBeVisible();
  await expect(open).toBeHidden();

  const go = page.locator('#acct-del-go');
  await expect(go).toBeDisabled();
  await page.locator('#acct-del-confirm').fill('delete');       // wrong case
  await expect(go, 'lowercase must not arm it').toBeDisabled();
  await page.locator('#acct-del-confirm').fill('DELETE ME');
  await expect(go).toBeDisabled();
  await page.locator('#acct-del-confirm').fill('  DELETE  ');   // surrounding space is forgiven
  await expect(go).toBeEnabled();

  // the item-4 tap-target floor, on the most irreversible button on the site
  const box = await go.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('REAL PIXELS: Escape and Cancel both back out and re-disarm the button', async ({ page }) => {
  await openAccount(page);
  await page.locator('#acct-del-open').click();
  await page.locator('#acct-del-confirm').fill('DELETE');
  await expect(page.locator('#acct-del-go')).toBeEnabled();

  await page.locator('#acct-del-cancel').click();
  await expect(page.locator('#acct-del-panel')).toBeHidden();
  await expect(page.locator('#acct-del-open')).toBeVisible();

  // re-opening must NOT come back pre-armed
  await page.locator('#acct-del-open').click();
  await expect(page.locator('#acct-del-confirm')).toHaveValue('');
  await expect(page.locator('#acct-del-go')).toBeDisabled();

  await page.locator('#acct-del-confirm').fill('DELETE');
  await page.locator('#acct-del-confirm').press('Escape');
  await expect(page.locator('#acct-del-panel')).toBeHidden();
  await page.locator('#acct-del-open').click();
  await expect(page.locator('#acct-del-go')).toBeDisabled();
});

test('REAL PIXELS: the Leaving card fits a 360px phone with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await openAccount(page);
  await page.locator('#acct-del-open').click();
  await expect(page.locator('#acct-del-panel')).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll at 360px').toBeLessThanOrEqual(0);
  const box = await page.locator('#acct-del-go').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(360);
});

test('every new display:flex/grid block in the Leaving card ships its [hidden] twin', async ({ page }) => {
  const css = await (await page.request.get('/style.css')).text();
  for (const sel of ['.acct-del-panel', '.acct-del-list', '.acct-del-actions', '.acct-del-status',
    // the opener rides .inline-header-btn (display:inline-flex) — measured as
    // still-visible with hidden="" set, so it needs its own twin
    '#acct-del-open']) {
    expect(css, `${sel} needs a [hidden] twin`).toMatch(
      new RegExp(sel.replace('.', '\\.') + '\\[hidden\\]\\s*\\{\\s*display:\\s*none'));
  }
});

// ---------------------------------------------------------------------------
// the tombstone
// ---------------------------------------------------------------------------

test('REAL PIXELS: a departed author\'s thread keeps its card and says who removed it', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.hubThreadCardHtml && !!window.rarTombstone, null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    const gone = window.hubThreadCardHtml({
      id: 't1', authorUid: 'u1', title: '', body: '', tag: 'general',
      authorDeleted: true, thumbImage: 'uploads/u1/t1/x', createdAt: Date.now(),
    }, {});
    const modded = window.hubThreadCardHtml({
      id: 't2', authorUid: 'u2', title: 'gone', body: '', tag: 'general',
      removed: true, createdAt: Date.now(),
    }, {});
    const live = window.hubThreadCardHtml({
      id: 't3', authorUid: 'u3', title: 'Still here', body: 'b', tag: 'general',
      createdAt: Date.now(),
    }, {});
    return { gone, modded, live };
  });

  // the author's own departure reads as theirs, not a moderator's
  expect(out.gone).toContain('[removed by the author]');
  expect(out.gone).not.toContain('[removed]</em>');
  // ...and their picture does not survive the erasure on the card
  expect(out.gone).not.toContain('hub-card-thumb');
  // a moderator takedown still reads as a moderator takedown
  expect(out.modded).toContain('[removed]');
  expect(out.modded).not.toContain('by the author');
  // and a live thread is untouched by any of this
  expect(out.live).toContain('Still here');
  expect(out.live).not.toContain('removed');
});

test('REAL PIXELS: a departed author\'s post is a tombstone whose CHILDREN survive', async ({ page }) => {
  // This is hazard #2 stated in the renderer: the replies under a departed
  // member's post must still be on the page.
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.hubReplyHtml, null, { timeout: 20000 });

  const html = await page.evaluate(() => window.hubReplyHtml(
    { id: 'p1', authorUid: 'u1', body: '', authorDeleted: true },
    { depth: 0, childHtml: '<li class="hub-post" data-post-id="child">a bystander reply</li>' },
  ));
  expect(html).toContain('[removed by the author]');
  expect(html).toContain('a bystander reply');
  expect(html).toContain('is-author-gone');
});

test('the tombstone mark is authorDeleted, never removed (or the thread would vanish)', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarTombstone, null, { timeout: 20000 });
  const m = await page.evaluate(() => ({
    gone: window.rarTombstone.isAuthorGone({ authorDeleted: true }),
    modded: window.rarTombstone.isAuthorGone({ removed: true }),
    live: window.rarTombstone.isAuthorGone({}),
    nothing: window.rarTombstone.isAuthorGone(null),
    // strict: a truthy-but-not-true value must not tombstone live content
    stringy: window.rarTombstone.isAuthorGone({ authorDeleted: 'true' }),
    html: window.rarTombstone.authorGoneHtml(),
  }));
  expect(m.gone).toBe(true);
  expect(m.modded).toBe(false);
  expect(m.live).toBe(false);
  expect(m.nothing).toBe(false);
  expect(m.stringy).toBe(false);
  expect(m.html).toContain('[removed by the author]');
});

// ---------------------------------------------------------------------------
// the rule that closed the detonator
// ---------------------------------------------------------------------------

test('firestore.rules no longer lets an owner delete their own users/{uid} doc', async ({ page }) => {
  // A member deleting that doc used to fire the entire account cascade from
  // devtools. The emulator proof lives in rules.spec.js; this pins the source
  // so the line can't be "tidied" back to `create, update, delete`.
  const rules = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'firestore.rules'), 'utf8');
  const block = rules.slice(rules.indexOf('match /users/{uid} {'), rules.indexOf('match /favorites/{animeId}'));
  expect(block).toContain('allow create, update: if isOwner(uid);');
  expect(block).toContain('allow delete: if false;');
  expect(block).not.toMatch(/allow create, update, delete: if isOwner\(uid\);/);
});
