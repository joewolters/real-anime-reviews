// tests/v232-publish-button-alive.spec.js
// <!-- author: Code | date: 2026-08-29 -->
// =============================================================================
// Blake, again holding a finished review he could not post: "when I go to
// publish a new review nothing happens."
//
// It was not the cloud, the rules or the network. v2.3.0 deleted
// `validateBeforeGenerate()` along with the Mode 1 Excel pipeline but LEFT ITS
// CALL in the Publish click handler. Every press threw
//   ReferenceError: validateBeforeGenerate is not defined
// on the first line of the handler — before publishToCatalog() ran, before the
// error box was touched. No write, no message, no spinner. Nothing.
//
// ⚠️ WHY THE v2.3.0 SUITE STAYED GREEN: it reads the button's LABEL and asserts
// the page boots clean. It never clicks. A dead button looks perfect at rest.
// So this file guards the call graph itself: a handler may not name a helper
// that no longer exists.
// =============================================================================
const { test, expect } = require('@playwright/test');

// Comments, strings and REGEX LITERALS are blanked before scanning, or prose
// like "(the paste workflow)" reads as a call to `workflow()` — and a regex such
// as /["'.!?]+$/ would open a phantom string that swallows the rest of the file.
// Each blanked character becomes a space, so offsets stay identical to the raw
// source. The regex-vs-division test is the usual one: a `/` starts a literal
// when the previous non-space character cannot end an expression.
const REGEX_MAY_START_AFTER = '(,=:[!&|?{};+-*%~^<>';
const stripNonCode = (src) => {
  let out = '';
  let i = 0;
  const BS = '\\';
  const prevMeaningful = () => {
    for (let k = out.length - 1; k >= 0; k -= 1) {
      if (!/\s/.test(out[k])) return out[k];
    }
    return '';
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] !== '/' && src[i + 1] !== '*'
        && REGEX_MAY_START_AFTER.includes(prevMeaningful() || '(')) {
      let j = i + 1;
      let inClass = false;
      while (j < src.length) {
        if (src[j] === BS) { j += 2; continue; }
        if (src[j] === '\n') break;              // not a regex after all
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) { j += 1; break; }
        j += 1;
      }
      out += src.slice(i, j).replace(/[^\n]/g, ' '); i = j;
    } else if (c === '/' && src[i + 1] === '/') {
      let j = src.indexOf('\n', i); if (j < 0) j = src.length;
      out += ' '.repeat(j - i); i = j;
    } else if (c === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2;
      out += src.slice(i, j).replace(/[^\n]/g, ' '); i = j;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === BS) { j += 2; continue; }
        if (src[j] === c) { j += 1; break; }
        j += 1;
      }
      out += src.slice(i, j).replace(/[^\n]/g, ' '); i = j;
    } else { out += c; i += 1; }
  }
  return out;
};

// Every name this file declares or imports — anything else that is CALLED must
// be a browser global, and the list below is the allowlist for those.
const declaredIn = (code) => {
  const names = new Set();
  const add = (re, g = 1) => { let m; while ((m = re.exec(code))) names.add(m[g]); };
  add(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g);
  add(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g);
  add(/\bclass\s+([A-Za-z_$][\w$]*)/g);
  let m;
  const braced = /import\s*\{([^}]*)\}/g;
  while ((m = braced.exec(code))) {
    m[1].split(',').forEach((s) => { const n = s.split(' as ').pop().trim(); if (n) names.add(n); });
  }
  return names;
};

const BROWSER_GLOBALS = new Set([
  'console', 'document', 'window', 'setTimeout', 'clearTimeout', 'setInterval', 'fetch',
  'Promise', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Math', 'JSON', 'Date',
  'RegExp', 'Error', 'Map', 'Set', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'URL', 'URLSearchParams', 'localStorage',
  'sessionStorage', 'navigator', 'location', 'requestAnimationFrame', 'CustomEvent',
  // keywords that read like calls once the parser is this crude
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'await',
  'of', 'in', 'new', 'do', 'else', 'try', 'this', 'delete', 'void', 'yield', 'case',
  'throw', 'async',
]);

// the handler body for one `$('<id>').addEventListener('click', ...)`, brace-matched.
// stripNonCode replaces each blanked character with a space, so offsets in the
// raw source and the stripped copy line up exactly — find in raw, slice stripped.
const handlerBody = (raw, code, id) => {
  const start = raw.indexOf(`$('${id}').addEventListener('click'`);
  expect(start, `the ${id} click handler is still wired`).toBeGreaterThan(-1);
  let i = code.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < code.length; j += 1) {
    if (code[j] === '{') depth += 1;
    else if (code[j] === '}') { depth -= 1; if (depth === 0) return code.slice(i, j + 1); }
  }
  throw new Error(`unbalanced handler for ${id}`);
};

test('publish: the button calls nothing that has been deleted', async ({ request }) => {
  const src = await (await request.get('/admin/new-anime.js')).text();
  const code = stripNonCode(src);
  const declared = declaredIn(code);

  // THE regression. Named outright so a future deletion trips on the name.
  expect(declared.has('validateBeforeGenerate'),
    'validateBeforeGenerate is DEFINED, not just called').toBe(true);

  const bodies = [handlerBody(src, code, 'generate-btn')];
  const pub = code.indexOf('async function publishToCatalog');
  expect(pub, 'and the publish path itself is still here').toBeGreaterThan(-1);
  bodies.push(code.slice(pub, code.indexOf('\n}\n', pub)));

  const missing = [];
  for (const body of bodies) {
    let m;
    const call = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
    while ((m = call.exec(body))) {
      const name = m[2];
      if (BROWSER_GLOBALS.has(name) || declared.has(name)) continue;
      missing.push(name);
    }
  }
  expect([...new Set(missing)],
    'every helper the Publish path names still exists in the file').toEqual([]);
});

test('publish: validation goes through the SHARED model, not a second copy', async ({ page, request }) => {
  // The pre-flight check and the write must read the form the same way, or a
  // field passes one shape and saves in another. One reader: collectCoreFields.
  const src = await (await request.get('/admin/new-anime.js')).text();
  expect(src, 'one reader for the form').toContain('function collectCoreFields');
  expect(src, 'the pre-flight check defers to the shared rules').toContain('M.validate(collectCoreFields(M))');
  expect(src, 'and so does the write').toContain('...collectCoreFields(M)');

  // and those shared rules actually reject an empty form (a validator with no
  // teeth is the same bug wearing a different hat).
  await page.route((u) => /index\.html$/.test(u.pathname), (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/admin/new-anime.html');
  await page.waitForFunction(() => !!window.RarCatalogModel, null, { timeout: 20000 });
  const errs = await page.evaluate(() => window.RarCatalogModel.validate({}));
  expect(errs.length, 'an empty form does not pass').toBeGreaterThan(0);
});

test('add anime: the page no longer calls itself MODE 1', async ({ request }) => {
  // the header said MODE 1 モード1 on the one page whose Mode 1 workflow was
  // retired — the exact stale label that sent Blake looking for a desktop
  // server the last time. The cloud notice below it stays.
  const html = await (await request.get('/admin/new-anime.html')).text();
  expect(html).not.toContain('>MODE 1 <');
  expect(html, 'it says what it is').toContain('ADD ANIME');
  expect(html, 'and the cloud notice is still there').toContain('id="mode-notice"');
});
