const { test, expect } = require('@playwright/test');

// v1.8.2 (gate 3b) — the section-aware editor parses stored review markdown into
// editable fields on load and compiles them back on save. The load-bearing contract
// is a LOSSLESS round-trip: render(compile(parse(x))) === render(x) for any input,
// including gnarly legacy content. markdown.js (classic script on the homepage)
// exposes window.parseReviewSections / window.compileReviewSections.
test.describe('section-aware review round-trip', () => {
  test('render(compile(parse(x))) === render(x) over a gnarly battery', async ({ page }) => {
    await page.goto('/');

    const hasApi = await page.evaluate(() =>
      typeof window.parseReviewSections === 'function' && typeof window.compileReviewSections === 'function');
    expect(hasApi).toBe(true);

    const cases = [
      'just legacy prose\n\nsecond paragraph',                         // no sections (the 44 legacy reviews)
      'intro line\n\n## Animation\nGreat work.\n\n## Story\nSolid.',   // intro + sections
      '## Animation\n\nblank line then body\n\n### Sub inside\nmore',  // blank line + ### sub-heading inside a section
      '## Animation bjasfkjajskf',                                     // content-on-heading (Blake's foot-gun) loads as the title
      '## Story\n- a\n- b\n\n**bold** and [x](https://x.com)',         // lists + inline markdown in a body
      '## Dup\nfirst\n\n## Dup\nsecond',                               // duplicate titles
      '#single\n##nospace\n## real Section\nbody',                     // #/##nospace are NOT level-2 sections
      '',                                                              // empty
    ];

    // Render-equality is the contract (whitespace may normalize; content must not).
    const results = await page.evaluate((inputs) => inputs.map((x) => {
      const rt = window.compileReviewSections(window.parseReviewSections(x));
      return {
        renderEqual: window.renderMarkdown(rt) === window.renderMarkdown(x),
        // compile is idempotent after the first pass (stable canonical form)
        idempotent: window.compileReviewSections(window.parseReviewSections(rt)) === rt,
      };
    }), cases);
    for (let i = 0; i < results.length; i++) {
      expect(results[i].renderEqual, 'render-equal case ' + i).toBe(true);
      expect(results[i].idempotent, 'idempotent case ' + i).toBe(true);
    }

    // Structural spot-checks.
    const legacy = await page.evaluate(() => window.parseReviewSections('just prose'));
    expect(legacy).toEqual({ intro: 'just prose', sections: [] });

    const parsed = await page.evaluate(() => window.parseReviewSections('## Animation\nGood\n\n## Story\nNice'));
    expect(parsed.intro).toBe('');
    expect(parsed.sections).toEqual([
      { title: 'Animation', body: 'Good' },
      { title: 'Story', body: 'Nice' },
    ]);

    // ### is carried in the body, not split into a section.
    const sub = await page.evaluate(() => window.parseReviewSections('## A\n### inner\ntext').sections);
    expect(sub).toEqual([{ title: 'A', body: '### inner\ntext' }]);
  });
});
