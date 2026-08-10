// Cloud migration phase 3 — the Cloud Admin catalog editor.
// <!-- author: Code | date: 2026-08-09 -->
// Covers the pure model (validation, normalisation, the phone<->desktop draft
// hand-off) and the page scaffold (gating, registration, brand parity, and a
// REAL-PIXEL check at phone width — Blake edits from his phone by decision).
const { test, expect } = require('@playwright/test');
const M = require('../admin/catalog-model.js');

// ---------------------------------------------------------------------------
// the model
// ---------------------------------------------------------------------------

test('validation mirrors the Excel sync so a bad row can never be stored', () => {
  const good = {
    Title: 'X', Genre: 'Shonen/Action', Rating: '9/10', Description: 'd', Review: 'r',
    Tags: 'action, revenge', Platforms: 'Netflix', Trailer: 'https://youtu.be/abc123',
  };
  expect(M.validate(good)).toEqual([]);
  expect(M.validate({ ...good, Rating: '9 out of 10' }).join(' ')).toMatch(/Rating/);
  expect(M.validate({ ...good, Review: '' }).join(' ')).toMatch(/Review/);
  expect(M.validate({ ...good, Tags: '' }).join(' ')).toMatch(/tag/);
  expect(M.validate({ ...good, Platforms: '' }).join(' ')).toMatch(/watch/);
  expect(M.validate({ ...good, Trailer: 'not-a-link' }).join(' ')).toMatch(/Trailer/);
  expect(M.validate({ ...good, Top10Rank: 44 }).join(' ')).toMatch(/Top 10/);
});

test("Attack on Titan's deliberate 15/10 still validates", () => {
  // Spec-pinned hyperbole (g35). A validator that 'fixes' it is a bug.
  const errs = M.validate({
    Title: 'Attack on Titan', Genre: 'Action', Rating: '15/10', Description: 'd', Review: 'r',
    Tags: 'action', Platforms: 'Crunchyroll', Trailer: 'https://www.youtube.com/embed/abc',
  });
  expect(errs).toEqual([]);
});

test('tags and platforms normalise exactly like the sync', () => {
  expect(M.normalizeTags('#action #fan service #OP MC')).toEqual(['action', 'fan-service', 'op-mc']);
  expect(M.normalizeTags('action, underdog, worldbuilding')).toEqual(['action', 'underdog', 'worldbuilding']);
  // the comma'd-tag-pill bug from LAST CALL A6 must stay fixed
  expect(M.normalizeTags('#friendly rivalry')).toEqual(['friendly-rivalry']);
  expect(M.normalizePlatforms('Crunchyroll, Netflix ,Hulu')).toEqual(['Crunchyroll', 'Netflix', 'Hulu']);
});

test('any YouTube link shape is tidied to the embed form', () => {
  const want = 'https://www.youtube.com/embed/VQGCKyvzIM4';
  expect(M.normalizeTrailer('https://youtu.be/VQGCKyvzIM4?si=zrdb')).toBe(want);
  expect(M.normalizeTrailer('https://www.youtube.com/watch?v=VQGCKyvzIM4')).toBe(want);
  expect(M.normalizeTrailer(want)).toBe(want);
});

test('dirty detection ignores cosmetic input differences', () => {
  const doc = { Review: 'hello', Tags: ['a', 'b'], Rating: '9/10' };
  expect(M.isDirty(doc, { Review: 'hello', Tags: 'a, b', Rating: '9/10' })).toBe(false);
  expect(M.isDirty(doc, { Review: 'hello there', Tags: 'a, b', Rating: '9/10' })).toBe(true);
  expect(M.diffFields(doc, { Review: 'hello', Tags: 'a, b, c', Rating: '9/10' })).toEqual(['Tags']);
});

test('the phone <-> desktop hand-off never silently clobbers the other device', () => {
  const doc = { Review: 'published text' };
  const phoneDraft = { fields: { Review: 'half-written on the train' }, deviceId: 'phone1', deviceLabel: 'your phone' };

  // same device -> restore silently
  expect(M.draftState(phoneDraft, doc, 'phone1').kind).toBe('mine');
  // different device -> OFFER it, don't apply it
  const other = M.draftState(phoneDraft, doc, 'desktop1');
  expect(other.kind).toBe('other');
  expect(M.describeDraft(other)).toMatch(/your phone/);
  // a draft that matches what's published is just noise
  expect(M.draftState({ fields: { Review: 'published text' }, deviceId: 'x' }, doc, 'y').kind).toBe('stale');
  expect(M.draftState(null, doc, 'y').kind).toBe('none');
});

test('device labels read like a person, not a user agent', () => {
  expect(M.deviceLabelFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 390)).toBe('your phone');
  expect(M.deviceLabelFrom('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 1440)).toBe('your desktop');
  expect(M.deviceLabelFrom('Mozilla/5.0 (iPad; CPU OS 17_0)', 820)).toBe('your tablet');
});

test('the editor cannot write identity or image fields', () => {
  // slug is the live comment-room key; image is Mode 1's territory (rule #9).
  for (const forbidden of ['animeId', 'slug', 'order', 'image', 'AniListId']) {
    expect(M.EDITABLE).not.toContain(forbidden);
  }
});

// ---------------------------------------------------------------------------
// the page
// ---------------------------------------------------------------------------

test('the catalog page ships the admin scaffold, gate and registrations', async ({ page }) => {
  const html = await (await page.request.get('/admin/catalog.html')).text();
  expect(html).toContain('id="admin-gate"');
  expect(html).toContain('id="admin-main"');
  expect(html).toContain('hidden');                        // main is shielded until admin
  expect(html).toContain('id="cat-list"');
  expect(html).toContain('id="cat-save"');
  expect(html).toContain('id="cat-draft-banner"');         // the hand-off banner
  expect(html).toContain('src="catalog-model.js');
  expect(html).toContain('noindex, nofollow');

  const js = await (await page.request.get('/admin/catalog.js')).text();
  expect(js).toContain("uid === ADMIN_UID");               // client gate
  expect(js).toContain('draft');                           // server-side drafts
  expect(js).toContain('revisions');                       // append-only history
  expect(js).toContain('friendlyError');                   // no raw error strings
  expect(js).not.toMatch(/\balert\(|\bconfirm\(/);         // zero native dialogs

  const fab = await (await page.request.get('/admin-fab.js')).text();
  expect(fab).toContain('/admin/catalog.html');            // reachable from the FAB
  const bump = await (await page.request.get('/scripts/bump-version.js')).text();
  expect(bump).toMatch(/catalog\.js\?v=/);                 // the stale-TARGETS trap, closed
});

test('every flex/grid component ships its [hidden] twin', async ({ page }) => {
  // The trap with five prior scalps: a display:flex rule beats the hidden
  // attribute, so a "hidden" panel renders anyway.
  const css = await (await page.request.get('/admin/catalog.css')).text();
  for (const sel of ['.catalog-list', '.catalog-draft-banner', '.catalog-form',
    '.catalog-errors', '.catalog-actions', '.catalog-row']) {
    expect(css, `${sel} needs a [hidden] twin`).toContain(`${sel}[hidden] { display: none; }`);
  }
});

test('gold stays Blake-only: the editor chrome is community purple', async ({ page }) => {
  const css = await (await page.request.get('/admin/catalog.css')).text();
  expect(css).not.toMatch(/#f5c518|#ffd700|goldenrod/i);
});

test('REAL PIXELS: the editor fits a 360px phone with no sideways scroll', async ({ page }) => {
  // Blake's decision made the phone a first-class surface, so this is measured,
  // not asserted from class names.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/admin/catalog.html');

  // Let the auth gate SETTLE before revealing the shell. onAuthStateChanged
  // fires asynchronously and re-hides #admin-main when signed out, so an
  // immediate unhide races it — this test passed alone and failed under full
  // suite load until the wait was added. Wait for the settled "Admin only."
  // state (or give up and reveal anyway if firebase never resolves offline).
  await page.waitForFunction(
    () => /Admin only/.test(document.getElementById('admin-gate').textContent || ''),
    null, { timeout: 15000 },
  ).catch(() => {});

  // Reveal the shell without auth (the gate is a client-side hide, not a route).
  await page.evaluate(() => {
    document.getElementById('admin-gate').hidden = true;
    const m = document.getElementById('admin-main');
    m.hidden = false;
    document.getElementById('cat-list-view').hidden = true;
    document.getElementById('cat-edit-view').hidden = false;
  });
  await expect(page.locator('#admin-main')).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll at 360px').toBeLessThanOrEqual(0);

  // inputs must be >=16px or iOS Safari zooms the viewport on focus
  const fs = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('f-Review')).fontSize));
  expect(fs).toBeGreaterThanOrEqual(16);

  // the Save button must be a real thumb target and inside the viewport width
  const box = await page.locator('#cat-save').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(360);

  // ...and it must actually be REACHABLE by scrolling. The first version of
  // this row was position:sticky, which silently never stuck: the shared
  // .admin-shell sets overflow:hidden (kills sticky) and backdrop-filter
  // (traps fixed). Asserting the box existed passed anyway — only scrolling
  // and looking caught it. So this asserts the behaviour, not the box.
  await page.locator('#cat-save').scrollIntoViewIfNeeded();
  await expect(page.locator('#cat-save')).toBeInViewport();
});

test('the action row does not rely on sticky/fixed inside the admin shell', () => {
  // Regression guard for the above: .admin-shell's overflow:hidden +
  // backdrop-filter make both positioning modes silently inert here.
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'admin', 'catalog.css'), 'utf8');
  const block = css.slice(css.indexOf('.catalog-actions {'), css.indexOf('.catalog-savestate'));
  expect(block).not.toMatch(/position:\s*(sticky|fixed)/);
});
