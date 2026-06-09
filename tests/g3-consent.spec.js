const { test, expect } = require('./welcomed');

// v1.10.0 gate 3 — the community-rules consent gate. Static surface (no Firebase):
// the PURE gate decision (the durable adversarial check) + the branded render of
// the consent + suspended modals. The acceptRules callable + the live
// moderationGate read are exercised in the seeded practice sandbox
// (npm run practice -> ?emu=1), not here.
test.describe('v1.10.0 gate 3 — community-rules consent gate (static surface)', () => {

  test('consentGateDecision: fresh / consented / version-bump / banned', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.consentGateDecision === 'function');
    const r = await page.evaluate(() => {
      const d = window.consentGateDecision;
      return {
        freshNoDoc:       d(null, 1),                          // no doc -> consent before first write
        emptyDoc:         d({}, 1),                            // doc, no consentVersion -> consent
        consented:        d({ consentVersion: 1 }, 1),         // agreed -> hidden after consent
        versionBump:      d({ consentVersion: 1 }, 2),         // CURRENT_RULES_VERSION bumped -> re-prompt
        future:           d({ consentVersion: 3 }, 2),         // consented past the floor -> ok
        banned:           d({ banned: true }, 1),              // banned -> suspended
        bannedPrecedence: d({ banned: true, consentVersion: 1 }, 1), // ban wins over consent
      };
    });
    expect(r.freshNoDoc).toBe('consent');
    expect(r.emptyDoc).toBe('consent');
    expect(r.consented).toBe('ok');
    expect(r.versionBump).toBe('consent');
    expect(r.future).toBe('ok');
    expect(r.banned).toBe('suspended');
    expect(r.bannedPrecedence).toBe('suspended');
  });

  test('consent modal: verbatim rules copy, "I agree" button, jp-mini kicker', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__rarOpenConsent === 'function');
    await page.evaluate(() => { window.__rarOpenConsent(); });

    const modal = page.locator('.rar-consent-overlay .rar-consent-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');

    // the six rules, verbatim (Blake's 2026-06-08 revision)
    const rules = await modal.locator('.rar-consent-rules li').allTextContents();
    expect(rules).toEqual([
      'No harassment, hate speech, or personal attacks.',
      'Mark spoilers with the spoiler tag.',
      'No illegal content. No sexually explicit or graphic images.',
      'No spam, advertising, or impersonation.',
      'Post only content you have the right to share.',
      'Violations may result in content removal or a permanent account ban, at the moderator\'s discretion.',
    ]);
    await expect(modal.locator('.rar-consent-sub')).toHaveText('By posting, you agree to the following:');
    await expect(modal.locator('.rar-consent-agree')).toHaveText('I agree');
    await expect(modal.locator('.rar-consent-title .jp-mini')).toHaveText('規約');
  });

  test('PROTECT THE HEART: the consent modal carries NO gold (community = purple)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__rarOpenConsent === 'function');
    const r = await page.evaluate(() => {
      window.__rarOpenConsent();
      const modal = document.querySelector('.rar-consent-overlay .rar-consent-modal');
      const GOLD = 'rgb(255, 213, 74)'; // #ffd54a — Blake's color, forbidden on community surfaces
      const props = ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'];
      let goldHits = 0;
      for (const n of [modal, ...modal.querySelectorAll('*')]) {
        const cs = getComputedStyle(n);
        for (const p of props) { if (cs[p] === GOLD) goldHits++; }
      }
      const top = getComputedStyle(modal).borderTopColor.match(/\d+/g).map(Number);
      return { goldHits, purpleBorder: top[2] > top[0], hasGoldClass: !!modal.querySelector('[class*="gold"]') };
    });
    expect(r.goldHits).toBe(0);
    expect(r.purpleBorder).toBe(true);  // border blue-channel dominant => purple, not gold
    expect(r.hasGoldClass).toBe(false);
  });

  test('suspended modal: branded state, no native alert', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__rarOpenSuspended === 'function');
    // a native alert/confirm would surface as a dialog event — assert none fires
    let nativeDialog = false;
    page.on('dialog', (d) => { nativeDialog = true; d.dismiss(); });
    await page.evaluate(() => { window.__rarOpenSuspended(); });

    const modal = page.locator('.rar-consent-overlay .rar-suspended-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal.locator('.rar-consent-title')).toContainText('Account suspended');
    await expect(modal.locator('.rar-consent-title .jp-mini')).toHaveText('停止');
    expect(nativeDialog).toBe(false);
  });

  test('consent modal: Esc closes it (the clean cancel path)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__rarOpenConsent === 'function');
    await page.evaluate(() => { window.__rarOpenConsent(); });
    await expect(page.locator('.rar-consent-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.rar-consent-overlay')).toHaveCount(0);
  });

});
