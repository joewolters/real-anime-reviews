const { test, expect } = require('@playwright/test');
const { test: webTest } = require('./welcomed');
const model = require('../admin/reports-model.js');

// v1.10.0 gate 4 — admin reports queue + Part-A consent-modal fixes.
// Node specs exercise the PURE queue model (dedupe + escape-safety) without a
// browser; browser specs exercise the Esc-scope fix, the branded button, and the
// deterministic report id on the served static site. The admin reports PAGE itself
// (auth-gated, redirects non-admins) is smoked in the seeded practice sandbox.

test.describe('v1.10.0 gate 4 — reports-model (pure, Node)', () => {
  test('dedupeReportsByTarget collapses by targetPath with count + reporters + sort', () => {
    const reports = [
      { id: 'r1', reporterUid: 'u1', reason: 'spam',       targetType: 'comment', targetPath: 'comments/a/items/x', targetUid: 'bad', createdAt: 100 },
      { id: 'r2', reporterUid: 'u2', reason: 'harassment', targetType: 'comment', targetPath: 'comments/a/items/x', targetUid: 'bad', createdAt: 300 },
      { id: 'r3', reporterUid: 'u3', reason: 'spam',       targetType: 'review',  targetPath: 'reviews/a/items/y',  targetUid: 'ok',  createdAt: 200 },
    ];
    const rows = model.dedupeReportsByTarget(reports);
    expect(rows.length).toBe(2);                          // 3 reports -> 2 targets
    expect(rows[0].targetPath).toBe('comments/a/items/x'); // the ×2 target sorts first
    expect(rows[0].reportCount).toBe(2);
    expect(rows[0].reporters.slice().sort()).toEqual(['u1', 'u2']);
    expect(rows[0].reasons.slice().sort()).toEqual(['harassment', 'spam']);
    expect(rows[0].ids.slice().sort()).toEqual(['r1', 'r2']);
    expect(rows[0].latest.id).toBe('r2');                  // newest representative
    expect(rows[1].reportCount).toBe(1);
  });

  test('dedupe sort tiebreak: equal counts -> most recent first', () => {
    const rows = model.dedupeReportsByTarget([
      { id: 'a', targetPath: 'p/1', createdAt: 100 },
      { id: 'b', targetPath: 'p/2', createdAt: 500 },
    ]);
    expect(rows.map((r) => r.targetPath)).toEqual(['p/2', 'p/1']);
  });

  test('escapeReportText + reportSnapshotHtml are escape-first (stored-XSS guard)', () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const esc = model.escapeReportText(evil);
    expect(esc).not.toContain('<img');
    expect(esc).not.toContain('<script');
    expect(esc).toContain('&lt;img');
    // In Node (no window.renderMarkdownInline) the snapshot renderer falls back to escape.
    const snap = model.reportSnapshotHtml(evil);
    expect(snap).not.toContain('<img');
    expect(snap).not.toContain('<script');
  });
});

webTest.describe('v1.10.0 gate 4 — Part A fixes + report id (browser)', () => {
  webTest('Esc on the consent modal closes ONLY it, not the anime modal beneath', async ({ page }) => {
    await page.goto('/');
    await page.click('#view-all-btn');
    await page.waitForSelector('.card-container .card');
    await page.locator('.card-container .card').first().click();
    await expect(page.locator('#anime-modal')).toBeVisible();

    await page.waitForFunction(() => typeof window.__rarOpenConsent === 'function');
    await page.evaluate(() => { window.__rarOpenConsent(); });
    await expect(page.locator('.rar-consent-overlay')).toBeVisible();

    await page.keyboard.press('Escape');

    // The fix: Esc closes the consent layer but the anime modal stays open
    // (without stopPropagation it would bubble to the window handler -> closeModal).
    await expect(page.locator('.rar-consent-overlay')).toHaveCount(0);
    await expect(page.locator('#anime-modal')).toBeVisible();
  });

  webTest('consent buttons are branded: "I agree" is a gradient pill, Cancel is a flat ghost', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__rarOpenConsent === 'function');
    await page.evaluate(() => { window.__rarOpenConsent(); });
    const r = await page.evaluate(() => {
      const agree = document.querySelector('.rar-consent-agree');
      const cancel = document.querySelector('.rar-consent-cancel');
      return {
        agreeBg: getComputedStyle(agree).backgroundImage,
        cancelBg: getComputedStyle(cancel).backgroundImage,
        agreeTag: agree.tagName,
        cancelTag: cancel.tagName,
      };
    });
    expect(r.agreeBg).toContain('gradient');   // primary purple gradient pill
    expect(r.cancelBg).not.toContain('gradient'); // quiet flat ghost
    expect(r.agreeTag).toBe('BUTTON');          // branded <button>, never a raw control elsewhere
    expect(r.cancelTag).toBe('BUTTON');
  });

  webTest('reportDocId is deterministic + Firestore-id-safe (no slashes)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.reportDocId === 'function');
    const r = await page.evaluate(() => ({
      id: window.reportDocId('u1', 'comments/one-punch-man/items/seed-0'),
      same: window.reportDocId('u1', 'comments/a/items/x') === window.reportDocId('u1', 'comments/a/items/x'),
      diffUser: window.reportDocId('u1', 'comments/a/items/x') !== window.reportDocId('u2', 'comments/a/items/x'),
    }));
    expect(r.id).toBe('u1__comments~one-punch-man~items~seed-0');
    expect(r.id).not.toContain('/');   // '/' is invalid in a Firestore doc id
    expect(r.same).toBe(true);         // same reporter + target -> same id (dupe-blocked by rules)
    expect(r.diffUser).toBe(true);     // different reporters -> different ids (both can report)
  });
});
