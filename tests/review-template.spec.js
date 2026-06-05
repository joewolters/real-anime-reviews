const { test, expect } = require('@playwright/test');

// v1.8.2 (gate 1) — markdown.js (classic script on the homepage) now emits anchorable
// heading ids for the structured-review jump-pills and exposes window.extractSections
// + window.REVIEW_TEMPLATE. This verifies the renderer contract the G2 pills rely on:
// id emission, section order, heading-less -> [], XSS-safe slugs, dedupe, and that
// extractSections' ids match renderMarkdown's output exactly.
test.describe('structured review template (renderer)', () => {
  test('emits anchorable heading ids + extractSections contract', async ({ page }) => {
    await page.goto('/');

    // The new API must exist (classic markdown.js loaded).
    const hasApi = await page.evaluate(() =>
      typeof window.extractSections === 'function' && typeof window.REVIEW_TEMPLATE === 'string');
    expect(hasApi).toBe(true);

    // ## heading -> <h5 id="rsec-..." class="md-h">
    const h = await page.evaluate(() => window.renderMarkdown('## Animation'));
    expect(h).toContain('id="rsec-animation"');
    expect(h).toContain('class="md-h"');
    expect(h).toContain('>Animation</h5>');

    // extractSections: level-2 headings, in order.
    const sections = await page.evaluate(() => window.extractSections('## Story\n\n## Music'));
    expect(sections).toEqual([
      { id: 'rsec-story', label: 'Story', level: 2 },
      { id: 'rsec-music', label: 'Music', level: 2 },
    ]);

    // Heading-less input -> no sections (legacy prose reviews stay pill-free).
    const none = await page.evaluate(() => window.extractSections('just some prose\n\nand more prose'));
    expect(none).toEqual([]);

    // Only ## counts toward the pills (# and ### are not level-2).
    const onlyH2 = await page.evaluate(() => window.extractSections('# Title\n\n## Story\n\n### Sub'));
    expect(onlyH2).toEqual([{ id: 'rsec-story', label: 'Story', level: 2 }]);

    // XSS-safe slug: no markup can leak into the id (strict [a-z0-9-] whitelist).
    const xss = await page.evaluate(() => window.extractSections('## <img src=x onerror=alert(1)>')[0].id);
    expect(xss).toMatch(/^rsec-[a-z0-9-]*$/);
    expect(xss).not.toContain('<');
    expect(xss).not.toContain('>');
    // ...and the rendered heading text is escaped, not live markup.
    const xssHtml = await page.evaluate(() => window.renderMarkdown('## <script>alert(1)</script>'));
    expect(xssHtml).toContain('&lt;script&gt;');
    expect(xssHtml).not.toContain('<script>');

    // Duplicate headings get a -2/-3 counter; extractSections ids match renderMarkdown's.
    const dupSections = await page.evaluate(() => window.extractSections('## Intro\n\n## Intro'));
    expect(dupSections.map(s => s.id)).toEqual(['rsec-intro', 'rsec-intro-2']);
    const dupHtml = await page.evaluate(() => window.renderMarkdown('## Intro\n\n## Intro'));
    expect(dupHtml).toContain('id="rsec-intro"');
    expect(dupHtml).toContain('id="rsec-intro-2"');

    // The template is the 9 locked sections.
    const tpl = await page.evaluate(() => window.REVIEW_TEMPLATE);
    for (const s of ['Intro', 'Animation', 'Story', 'Characters', 'Design', 'Music', 'Feel', 'Extra Thoughts', 'Overall']) {
      expect(tpl).toContain('## ' + s);
    }
    expect((tpl.match(/^## /gm) || []).length).toBe(9);
  });
});
