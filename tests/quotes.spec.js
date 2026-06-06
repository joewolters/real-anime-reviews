// First-visit specs (no welcomed fixture) — the welcome door shows.
const { test, expect } = require('@playwright/test');

// v1.8.4 (gate 8) — the welcome-door quotes moved out of script.js into a public
// /quotes.json (managed from the admin Quotes page), with a hardcoded fallback so the
// door is NEVER quoteless. Lock the data contract + the end-to-end door pipeline. The
// live AniList airing strip is irrelevant here (we assert the door, not home content).
test.describe('v1.8.4 gate 8 — welcome-door quotes', () => {
  test('quotes.json is served and is a valid {quote,source}[] contract', async ({ page }) => {
    const res = await page.request.get('/quotes.json');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const q of data) {
      expect(typeof q.quote).toBe('string');
      expect(q.quote.trim().length).toBeGreaterThan(0);
      expect(typeof q.source).toBe('string');   // present (may be empty) — the door reads q.source || ''
    }
  });

  test('the door shows quote bubbles fed by the quote pipeline', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#welcome-enter', { state: 'visible' });
    await page.waitForTimeout(600);   // the FLOOR bubbles launch immediately on open
    const info = await page.evaluate(() => {
      const live = [...document.querySelectorAll('.welcome-quote-bubble')].filter(b => b.dataset.busy === '1');
      const texted = live
        .map(b => ((b.querySelector('.wq-text') || {}).textContent || '').trim())
        .filter(Boolean);
      return { liveCount: live.length, textedCount: texted.length, sample: texted[0] || '' };
    });
    expect(info.liveCount).toBeGreaterThanOrEqual(1);
    expect(info.textedCount).toBeGreaterThanOrEqual(1);   // fillBubble ran with a real quote object
    expect(info.sample.length).toBeGreaterThan(2);        // non-empty quote text rendered
  });
});
