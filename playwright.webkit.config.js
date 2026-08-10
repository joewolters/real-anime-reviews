// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Real Anime Reviews — the WebKit / iOS track (Part A item 4).
 * ---------------------------------------------------------------------------
 * Blake, on the v2.0 responsive work: Safari and Arc on iPhone "do not show the
 * improved mobile work. It looks bloated and not optimized… Especially in the
 * deeper modal pages. Like account and stuff."
 *
 * Root cause of the gap: the responsive suite only ever ran under Chromium.
 * WebKit is a different engine with genuinely different behaviour for dvh/svh,
 * -webkit-fill-available, safe-area insets, position:fixed under the keyboard,
 * and backdrop-filter cost. Chromium passing says nothing about any of it.
 *
 * A SEPARATE config on purpose: adding a webkit project to playwright.config.js
 * would double every run of `npm test` (320 specs) for no benefit on the specs
 * that aren't about layout. This track runs the iOS surfaces only.
 *
 *   npm run test:webkit
 *
 * Note: Arc on iOS uses WebKit — Apple requires it — so Arc and Safari share an
 * engine. Testing WebKit covers both; the differences Blake sees between them
 * are chrome (toolbars, viewport insets), which the two viewport sizes below
 * are chosen to bracket.
 */
module.exports = defineConfig({
  testDir: './tests-webkit',
  timeout: 45 * 1000,
  expect: { timeout: 7000 },
  retries: process.env.CI ? 0 : 1,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:8765',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // The small end — an iPhone SE/13 mini class viewport (375px) is where the
    // Top-10 and the modal layers were tightest.
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
    // The common modern size.
    { name: 'iphone-13', use: { ...devices['iPhone 13'] } },
    // The large end, and the one with the deepest safe-area insets.
    { name: 'iphone-14-pro-max', use: { ...devices['iPhone 14 Pro Max'] } },
  ],

  webServer: {
    command: 'python -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
