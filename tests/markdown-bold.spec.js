const { test, expect } = require('@playwright/test');

// v1.7.5 (gate 3) — markdown.js is loaded as a classic script on the homepage and
// exposes window.renderMarkdownInline / window.renderMarkdown. This verifies the
// new __double-underscore__ bold support (AniList bios use it) and that it composes
// with the existing **asterisk** bold in one mixed string.
test.describe('markdown __bold__', () => {
  test('renders __bold__ and mixed **a** __b__', async ({ page }) => {
    await page.goto('/');

    // renderMarkdownInline must exist (classic markdown.js loaded).
    const hasFn = await page.evaluate(() => typeof window.renderMarkdownInline === 'function');
    expect(hasFn).toBe(true);

    // __bold__ → <strong>
    const underscore = await page.evaluate(() => window.renderMarkdownInline('__hello__'));
    expect(underscore).toBe('<strong>hello</strong>');

    // mixed **a** __b__ → both bolded, asterisk and underscore side by side
    const mixed = await page.evaluate(() => window.renderMarkdownInline('**a** __b__'));
    expect(mixed).toBe('<strong>a</strong> <strong>b</strong>');

    // a lone snake_case word is NOT italicized/bolded (single underscores untouched)
    const snake = await page.evaluate(() => window.renderMarkdownInline('some_var_name'));
    expect(snake).toBe('some_var_name');
  });
});
