// scripts/lib/quotes-store.js — read/write the public welcome-door quotes file.
// <!-- author: Code | date: 2026-06-06 -->
// v1.8.4 (gate 8). quotes.json lives at the deploy root (Current Version/quotes.json) so it
// ships as a static asset the homepage door fetches at runtime — it is NOT in firebase.json's
// ignore array (public by design). Mirrors scripts/lib/season-review-index.js's placement and
// house style (2-space JSON + trailing newline) so git diffs stay clean.
'use strict';

const fs = require('fs');
const path = require('path');

const QUOTES_PATH = path.resolve(__dirname, '..', '..', 'quotes.json'); // -> Current Version/quotes.json

function readQuotes() {
  try {
    const data = JSON.parse(fs.readFileSync(QUOTES_PATH, 'utf8'));
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.quotes)) return data.quotes;
    return [];
  } catch (_) {
    return [];
  }
}

function writeQuotes(arr) {
  const list = Array.isArray(arr) ? arr : [];
  fs.writeFileSync(QUOTES_PATH, JSON.stringify(list, null, 2) + '\n', 'utf8');
  return list;
}

module.exports = { readQuotes, writeQuotes, QUOTES_PATH };
