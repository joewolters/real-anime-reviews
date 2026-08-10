// Cloud migration — the permanent round-trip guard.
// ---------------------------------------------------------------------------
// The acceptance gate for moving the data master off Excel
// (docs/CLOUD-MIGRATION-STUDY.md §10): the Firestore-shaped catalog documents
// must regenerate animeData.js BYTE-FOR-BYTE. If this ever goes red, the cloud
// representation and the shipped catalog have diverged — stop and diff before
// publishing anything.
//
// Self-contained: derives everything from animeData.js in the repo. No
// emulator, no network, no migration folder.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  slug, parseAnimeData, toDocs, renderBody, splitAnimeDataFile, checkShrink,
} = require('../scripts/lib/catalog-model');

const ANIMEDATA = path.resolve(__dirname, '..', 'animeData.js');
// Normalise line endings: git's autocrlf checks the file out as CRLF on
// Windows while every generator writes LF. The data is what matters here.
const read = () => fs.readFileSync(ANIMEDATA, 'utf8').replace(/\r\n/g, '\n');

test('catalog docs regenerate animeData.js byte-for-byte', () => {
  const text = read();
  const { body } = splitAnimeDataFile(text);
  const docs = toDocs(parseAnimeData(text));
  expect(renderBody(docs)).toBe(body);
});

test('the whole file reconstructs from its header + generated body', () => {
  const text = read();
  const { header, body } = splitAnimeDataFile(text);
  const docs = toDocs(parseAnimeData(text));
  expect(header + renderBody(docs)).toBe(header + body);
});

test('every anime gets a unique, non-empty catalog id', () => {
  const docs = toDocs(parseAnimeData(read()));
  const ids = docs.map((d) => d.animeId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((i) => typeof i === 'string' && i.length > 0)).toBe(true);
});

test('order is dense 0..N-1 and preserves the live sequence', () => {
  // Excel row order is semantic: script.js picks animeData[length-1] as "the
  // latest drop" (pinned by foryou-surface.spec.js). A database has no row
  // order, so `order` must carry it.
  const list = parseAnimeData(read());
  const docs = toDocs(list);
  expect(docs.map((d) => d.order)).toEqual(list.map((_, i) => i));
  expect(docs[docs.length - 1].Title).toBe(list[list.length - 1].Title);
});

test('the catalog slug still matches the live comment-room key', () => {
  // slug() here MUST stay identical to script.js:484 / card-render.js:31 —
  // it is the Firestore room id for existing comments and community reviews.
  // A change here silently orphans real member content.
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'card-render.js'), 'utf8');
  const m = src.match(/function slug\(s\)\s*\{[\s\S]*?\n\s*\}/);
  expect(m, 'card-render.js slug() should be findable').toBeTruthy();
  const live = new Function('return (' + m[0].replace('function slug', 'function') + ')')();
  for (const t of ['Attack on Titan', "An Archdemon’s Dilemma: How to Love Your Elf Bride",
    'Hell’s Paradise', 'Re:ZERO − Starting Life in Another World', 'Kaiju No. 8']) {
    expect(slug(t)).toBe(live(t));
  }
});

test('no review text is lost in the document shape', () => {
  const list = parseAnimeData(read());
  const docs = toDocs(list);
  const sum = (xs) => xs.reduce((n, a) => n + String(a.Review || '').length, 0);
  expect(sum(docs)).toBe(sum(list));
  for (let i = 0; i < list.length; i++) expect(docs[i].Review).toBe(list[i].Review);
});

// --- the shrink tripwire: the alarm that was missing in May 2026 -----------

test('the browser seed builds the SAME documents as the node exporter', () => {
  // scripts/** is never served, so admin/catalog-model.js carries its own copy
  // of the doc-shaping. This is what stops the two from drifting.
  const browser = require('../admin/catalog-model.js');
  const list = parseAnimeData(read());
  expect(browser.toCatalogDocs(list)).toEqual(toDocs(list));
  expect(browser.slug('An Archdemon’s Dilemma')).toBe('an-archdemon-s-dilemma');
});

test('tripwire passes an unchanged catalog', () => {
  const list = parseAnimeData(read());
  expect(checkShrink(list, toDocs(list)).ok).toBe(true);
});

test('tripwire REFUSES the actual May 2026 regression', () => {
  // Rascal's review was silently replaced by a 209-char stub and shipped.
  // That exact event must never get past publish again.
  const list = parseAnimeData(read());
  const regressed = list.map((a) => (/rascal/i.test(a.Title)
    ? Object.assign({}, a, { Review: String(a.Review).slice(0, 209) }) : a));
  const r = checkShrink(list, regressed);
  expect(r.ok).toBe(false);
  expect(r.violations.join(' ')).toMatch(/Rascal/);
});

test('tripwire refuses a title disappearing entirely', () => {
  const list = parseAnimeData(read());
  const r = checkShrink(list, list.slice(0, list.length - 1));
  expect(r.ok).toBe(false);
  expect(r.violations.join(' ')).toMatch(/missing from the new catalog/);
});

test('tripwire does NOT false-alarm on an ordinary copy-edit', () => {
  // Trimming a few words must stay publishable, or the guard becomes noise
  // and gets disabled — which is worse than not having it.
  const list = parseAnimeData(read());
  const edited = list.map((a) => (/death note/i.test(a.Title)
    ? Object.assign({}, a, { Review: String(a.Review).replace(' honestly', '') }) : a));
  expect(checkShrink(list, edited).ok).toBe(true);
});

test('the Excel sync and the cloud publish share one renderer', () => {
  // Phase 2 retired sync-excel-to-js.js's private copy of the renderer. If a
  // future edit reintroduces one, the two paths can silently diverge.
  const sync = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'sync-excel-to-js.js'), 'utf8');
  expect(sync).toMatch(/require\(['"]\.\/lib\/catalog-model['"]\)/);
  expect(sync).not.toMatch(/lines\.push\('const animeData = \['\)/);
});
