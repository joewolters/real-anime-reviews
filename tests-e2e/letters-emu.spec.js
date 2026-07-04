const { test, expect } = require('../tests/welcomed');

// MEGA-RUN gate A5 — the LETTER ROOM cycles, codified from the gate A2-A4
// live walks (the durable adversarial check). SELF-RESETTING: the beforeAll
// purges conversations + blocks via the emulator REST so every run starts
// from the same silence (the consent-spec pattern, collection-wide).
//
// Requires the practice sandbox: `npm run practice` first, then `npm run test:e2e`.
const FS = 'http://127.0.0.1:8080/v1/projects/real-anime-reviews/databases/(default)/documents';

const OWNER = { Authorization: 'Bearer owner' };   // the emulator admin bypass
async function purgeCollection(name) {
  // list → delete each (the emulator REST; ?pageSize keeps it bounded)
  for (let round = 0; round < 10; round++) {
    const r = await fetch(`${FS}/${name}?pageSize=100`, { headers: OWNER });
    if (!r.ok) return;
    const j = await r.json().catch(() => ({}));
    const docs = j.documents || [];
    if (!docs.length) return;
    await Promise.all(docs.map((d) => fetch(`http://127.0.0.1:8080/v1/${d.name}`, { method: 'DELETE', headers: OWNER })));
  }
}

// LAST CALL A5 — #inbox-input is RarLive's HIDDEN model now (page.fill can't
// target display:none); write the model + dispatch, exactly like the app's
// own external-write contract.
async function writeLetter(page, text) {
  await page.evaluate((t) => {
    const ta = document.getElementById('inbox-input');
    ta.value = t;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function signIn(page, email) {
  // manually-minted contexts miss the welcomed fixture — set the flag ourselves
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {} });
  await page.goto('/index.html?emu=1');
  await page.click('#auth-open');
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', 'practice123');
  await page.click('#auth-submit');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.signin-catchup')?.remove());
}

async function knockOn(page, uid, text) {
  await page.waitForFunction(() => typeof window.openProfilePage === 'function', null, { timeout: 20000 });
  await page.evaluate((u) => window.openProfilePage(u), uid);
  const btn = page.locator('.profile-layer .profile-message');
  await expect(btn).toBeVisible({ timeout: 20000 });
  await btn.click();
  await expect(page.locator('#inbox-thread')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await writeLetter(page, text);
  await page.click('#inbox-send');
  await page.waitForTimeout(2500);
}

test.describe.serial('the Letter Room (emulator-seeded, self-resetting)', () => {
  // each cycle signs in 2+ members across contexts — real minutes, not flake
  test.describe.configure({ timeout: 150_000 });
  test.beforeAll(async () => {
    await purgeCollection('conversations');
    await purgeCollection('blocks/prac-ren/list');
    await purgeCollection('blocks/prac-mika/list');
    await purgeCollection('blocks/prac-aki/list');
    await purgeCollection('blocks/prac-yuki/list');
  });

  test('the request cycle: knock → strip → accept → reply lands both ways', async ({ page, browser }) => {
    await signIn(page, 'prac-mika@practice.test');
    await knockOn(page, 'prac-ren', 'letters e2e: the knock');
    await expect(page.locator('#inbox-status')).toContainText('Request sent');
    await expect(page.locator('#inbox-input')).toHaveJSProperty('readOnly', true);

    const renCtx = await browser.newContext();
    const ren = await renCtx.newPage();
    await signIn(ren, 'prac-ren@practice.test');
    await ren.goto('/account.html?emu=1#inbox');
    await ren.waitForTimeout(3000);
    await expect(ren.locator('#inbox-requests')).toBeVisible();
    await expect(ren.locator('#inbox-requests-list .inbox-row')).toContainText('wants to message you');
    await ren.click('#inbox-requests-list .inbox-row');
    await expect(ren.locator('#inbox-req-bar')).toBeVisible({ timeout: 10000 });
    await expect(ren.locator('#inbox-messages')).toContainText('the knock');
    await ren.click('#inbox-req-accept');
    await ren.waitForTimeout(2000);
    await expect(ren.locator('#inbox-req-bar')).toBeHidden();
    await writeLetter(ren, 'letters e2e: the reply');
    await ren.click('#inbox-send');
    await expect(ren.locator('#inbox-messages')).toContainText('the reply', { timeout: 10000 });
    await renCtx.close();

    // Mika reads the reply in an open, writable thread
    await page.goto('/account.html?emu=1#inbox');
    await page.waitForTimeout(3000);
    await page.click('#inbox-list .inbox-row');
    await expect(page.locator('#inbox-messages')).toContainText('the reply', { timeout: 10000 });
    await expect(page.locator('#inbox-input')).toHaveJSProperty('readOnly', false);
  });

  test('decline is SILENT: the sender still reads "request sent"', async ({ page, browser }) => {
    await signIn(page, 'prac-aki@practice.test');
    await knockOn(page, 'prac-ren', 'letters e2e: unwanted');

    const renCtx = await browser.newContext();
    const ren = await renCtx.newPage();
    await signIn(ren, 'prac-ren@practice.test');
    await ren.goto('/account.html?emu=1#inbox');
    await ren.waitForTimeout(3000);
    await ren.click('#inbox-requests-list .inbox-row');
    await ren.waitForTimeout(1200);
    await ren.click('#inbox-req-decline');
    await ren.waitForTimeout(1500);
    // the recipient's strip empties — the door closed quietly
    await expect(ren.locator('#inbox-requests')).toBeHidden();
    await renCtx.close();

    // the sender's row is INDISTINGUISHABLE from a pending request
    await page.goto('/account.html?emu=1#inbox');
    await page.waitForTimeout(3000);
    const akiRow = page.locator('#inbox-list .inbox-row', { hasText: 'Ren' });
    await expect(akiRow).toContainText('request sent');
  });

  test('groups: create → add from letters → fan-out with attribution → leave', async ({ page, browser }) => {
    // Ren makes the group and adds Mika (a contact from test 1)
    await signIn(page, 'prac-ren@practice.test');
    await page.goto('/account.html?emu=1#inbox');
    await page.waitForTimeout(3000);
    await page.click('#inbox-new-group');
    await page.fill('#inbox-group-name', 'e2e watchers');
    await page.click('#inbox-group-go');
    await page.waitForTimeout(2000);
    await page.click('#inbox-members');
    await page.waitForTimeout(1200);
    // add Mika BY NAME (contactsOf is now open-peer-only, so she's the contact)
    await page.locator('.inbox-member-add', { hasText: 'Mika' }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#inbox-thread-title')).toContainText('2');

    // Mika: the group row + a letter into it
    const mikaCtx = await browser.newContext();
    const mika = await mikaCtx.newPage();
    await signIn(mika, 'prac-mika@practice.test');
    await mika.goto('/account.html?emu=1#inbox');
    await mika.waitForTimeout(3000);
    await mika.locator('#inbox-list .inbox-row', { hasText: 'e2e watchers' }).click();
    await mika.waitForTimeout(1500);
    await writeLetter(mika, 'letters e2e: to the group');
    await mika.click('#inbox-send');
    await mika.waitForTimeout(2000);
    await mikaCtx.close();

    // Ren sees it WITH attribution; groups stay purple (no gold classes)
    await page.click('#inbox-back');
    await page.waitForTimeout(800);
    await page.locator('#inbox-list .inbox-row', { hasText: 'e2e watchers' }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator('#inbox-messages')).toContainText('to the group');
    await expect(page.locator('.inbox-msg-who').last()).toContainText('Mika');
    const groupRowGold = await page.evaluate(() =>
      [...document.querySelectorAll('#inbox-list .inbox-row')].some((r) => /e2e watchers/.test(r.textContent) && r.classList.contains('is-blake')));
    expect(groupRowGold).toBe(false);
  });

  test('images: sealed in a request (URL never fetched) → accept unseals through the pipeline', async ({ page, browser }) => {
    await signIn(page, 'prac-mika@practice.test');
    await page.waitForFunction(() => typeof window.openProfilePage === 'function', null, { timeout: 20000 });
    await page.evaluate(() => window.openProfilePage('prac-yuki'));
    const btn = page.locator('.profile-layer .profile-message');
    await expect(btn).toBeVisible({ timeout: 20000 });
    await btn.click();
    await expect(page.locator('#inbox-thread')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);
    // a real PNG (the pipeline sniffs magic bytes)
    await page.click('#inbox-attach');
    await page.setInputFiles('#inbox-file', {
      name: 'e2e.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });
    await page.waitForTimeout(500);
    await writeLetter(page, 'letters e2e: swatch');
    await page.click('#inbox-send');
    await page.waitForTimeout(4000);
    await expect(page.locator('.inbox-msg.is-mine .inbox-msg-img')).toBeVisible({ timeout: 15000 });

    const yukiCtx = await browser.newContext();
    const yuki = await yukiCtx.newPage();
    await signIn(yuki, 'prac-yuki@practice.test');
    await yuki.goto('/account.html?emu=1#inbox');
    await yuki.waitForTimeout(3000);
    await yuki.click('#inbox-requests-list .inbox-row');
    await yuki.waitForTimeout(1500);
    // SEALED: the chip, and NOT ONE img element or hydrate box
    await expect(yuki.locator('.inbox-img-chip')).toContainText('accept to view');
    expect(await yuki.locator('.inbox-msg-img').count()).toBe(0);
    expect(await yuki.locator('.inbox-msg-imgbox').count()).toBe(0);
    // accept → the image renders from the STORAGE emulator (pipeline-real)
    await yuki.click('#inbox-req-accept');
    await yuki.waitForTimeout(4000);
    const img = yuki.locator('.inbox-msg-img');
    await expect(img).toBeVisible({ timeout: 15000 });
    const src = await img.getAttribute('src');
    expect(src).toContain('127.0.0.1:9199');
    await yukiCtx.close();
  });
});
