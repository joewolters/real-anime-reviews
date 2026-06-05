const base = require('@playwright/test');

// Returning-visitor fixture (v1.8.3 gate 5b). The welcome door is now once-per-SESSION
// (sessionStorage rar:welcomed), and Playwright's storageState can only seed localStorage
// — so interaction specs use this fixture, which runs an init script seeding
// sessionStorage before any page loads, so the door never intercepts their clicks.
// First-visit specs import '@playwright/test' directly (no seed → the door shows).
const test = base.test.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try { sessionStorage.setItem('rar:welcomed', '1'); } catch (_) {}
    });
    await use(context);
  },
});

module.exports = { test, expect: base.expect };
