const { test, expect } = require('@playwright/test');

test.describe('Account page', () => {
  test('responds 200 and contains expected static structure', async ({ request }) => {
    // Raw HTTP fetch via the `request` fixture (no browser navigation).
    // Using `page.goto()` here was flaky: account.js redirects unsigned-in
    // users to index.html?signin=1, which frees the original response from
    // the browser's network cache before we can read its body.
    const resp = await request.get('/account.html');
    expect(resp.status()).toBe(200);

    const body = await resp.text();
    expect(body).toContain('id="acct-hello"');
    expect(body).toContain('My Account');
    expect(body).toContain('side-nav');
  });
});
