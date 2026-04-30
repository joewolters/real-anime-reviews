// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Real Anime Reviews — Playwright config.
 *
 * Tests run against a local Python http.server bound to 127.0.0.1:8765
 * (matches the local-server pattern used during deploy verification).
 * Playwright starts the server before tests and stops it after.
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },

  // Per the brief: 0 retries in CI, 1 retry locally.
  retries: process.env.CI ? 0 : 1,
  // Single worker keeps the local server stable.
  workers: 1,
  reporter: process.env.CI ? 'list' : 'html',

  use: {
    baseURL: 'http://127.0.0.1:8765',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'python -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
