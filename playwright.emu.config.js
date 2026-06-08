// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Real Anime Reviews — EMULATOR end-to-end config (gate 6g).
 *
 * These specs drive deep-link LANDINGS against a LIVE practice sandbox (the
 * firebase auth/firestore/functions emulators + seeded comments/reviews/
 * notifications). They are deliberately NOT part of `npm test` (whose testDir is
 * ./tests and runs against a static python http.server) because they require the
 * emulator + Java. Run them in two steps:
 *     1) npm run practice        (boots the emulator + serves 8765 + seeds)
 *     2) npm run test:e2e        (in another shell)
 * No webServer here — the practice sandbox owns 8765.
 */
module.exports = defineConfig({
  testDir: './tests-e2e',
  timeout: 45 * 1000,
  expect: { timeout: 15000 },
  retries: 1,            // emulator + async render can flake once; a clean retry confirms
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8765',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
