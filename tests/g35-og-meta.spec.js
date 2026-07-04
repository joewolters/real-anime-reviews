// g35 — LAST CALL B2 social-preview pins: the og image moved to the NEW
// assets/og-preview.jpg (scrapers cache by URL — the rename is the refresh),
// carries explicit width/height, and the Blake-voiced description landed.
// Static-server spec (no emulator), g33/g34 request.get style.
const { test, expect } = require('@playwright/test');

test('g35: index og meta points at og-preview.jpg (sized), new description, no stale preview.jpg', async ({ page }) => {
  const index = await (await page.request.get('/index.html')).text();
  // the fresh art + explicit dimensions
  expect(index).toContain('assets/og-preview.jpg');
  expect(index).toContain('og:image:width" content="1200');
  // the Blake-voiced description
  expect(index).toContain('under one roof');
  // zero stragglers pointing at the old cached filename
  expect(index).not.toContain('assets/preview.jpg');
  // and the asset itself serves
  const img = await page.request.get('/assets/og-preview.jpg');
  expect(img.status()).toBe(200);
});
