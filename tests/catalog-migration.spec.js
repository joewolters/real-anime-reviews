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
  slug, parseAnimeData, toDocs, renderBody, splitAnimeDataFile,
} = require('../scripts/lib/catalog-model');

const ANIMEDATA = path.resolve(__dirname, '..', 'animeData.js');
const read = () => fs.readFileSync(ANIMEDATA, 'utf8');

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
