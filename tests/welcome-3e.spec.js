// First-visit specs (no welcomed fixture) — the welcome door shows.
const { test, expect } = require('@playwright/test');

// v1.8.4 (gate 3e) — welcome-door polish. The :focus-visible Firefox cause was
// verified out-of-band (a Firefox Playwright probe); here we lock the behaviors
// that are deterministic in the default (chromium) project.
test.describe('v1.8.4 gate 3e — welcome door', () => {
  test('item 2: quotes appear immediately + item 1: floor >= 2, no overlap', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#welcome-enter', { state: 'visible' });
    await page.waitForTimeout(600);   // the first FLOOR bubbles launch immediately on open
    const info = await page.evaluate(() => {
      const live = [...document.querySelectorAll('.welcome-quote-bubble')].filter(b => b.dataset.busy === '1');
      let overlap = false;
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        if (live[i].dataset.side !== live[j].dataset.side) continue;   // same-side column
        const a = live[i].getBoundingClientRect(), b = live[j].getBoundingClientRect();
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlap = true;
      }
      return { liveCount: live.length, overlap };
    });
    expect(info.liveCount).toBeGreaterThanOrEqual(2);   // immediate start + concurrency floor
    expect(info.overlap).toBe(false);                   // collision avoidance
  });

  test('item 4: Enter button is NOT focused on open (no highlight); Tab focuses it', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#welcome-enter', { state: 'visible' });
    await page.waitForTimeout(400);                     // let the open-focus rAF run
    const onOpen = await page.evaluate(() => ({
      enterFocused: document.activeElement === document.getElementById('welcome-enter'),
      splashFocused: document.activeElement === document.getElementById('welcome-splash'),
    }));
    expect(onOpen.enterFocused).toBe(false);            // the button is NOT auto-focused
    expect(onOpen.splashFocused).toBe(true);            // the dialog traps focus instead
    await page.keyboard.press('Tab');
    const afterTab = await page.evaluate(() =>
      document.activeElement === document.getElementById('welcome-enter'));
    expect(afterTab).toBe(true);                        // keyboard still reaches Enter
  });

  test('item 4b: Enter key still closes the door', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#welcome-enter', { state: 'visible' });
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await expect(page.locator('#welcome-splash')).toBeHidden();
  });

  test('item 3: the line-pulse glow layer exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.welcome-line-pulse .wlp-glow')).toHaveCount(1);
  });
});
