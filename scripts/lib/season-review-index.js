// scripts/lib/season-review-index.js
// <!-- author: Code | date: 2026-06-04 -->
// v1.7.4 (gate 3) — Shared season-review index builder. Scans
// Current Version/season-reviews/<aniListId>.md, parses each file's frontmatter,
// and writes season-reviews/index.json so the homepage can tell which AniListIds
// have a written season review WITHOUT probing every file. Used by:
//   - scripts/sync-excel-to-js.js  (full `npm run sync`)
//   - scripts/mode1-server.js      (fast rebuild on PUT/DELETE — no Excel read)
// Pure Node (fs/path); no deps.
'use strict';

const fs = require('fs');
const path = require('path');

const SEASON_DIR = path.resolve(__dirname, '..', '..', 'season-reviews');
const INDEX_PATH = path.join(SEASON_DIR, 'index.json');

// Minimal YAML-ish frontmatter parse: `---\n key: value …\n---\n body`.
// Returns { meta:{...}, body:"..." }. No nesting, no arrays — flat key:value only.
function parseFrontmatter(text) {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(String(text || ''));
  if (!m) return { meta: {}, body: String(text || '') };
  const meta = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i === -1) return;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    // strip surrounding quotes if present
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k) meta[k] = v;
  });
  return { meta, body: m[2] };
}

// Scan the dir, (re)write index.json, return the index object.
function buildSeasonReviewIndex() {
  let files = [];
  try { files = fs.readdirSync(SEASON_DIR); } catch (_) { /* dir may not exist yet */ }
  const ids = [];
  const meta = {};
  for (const f of files) {
    const fm = /^(\d+)\.md$/.exec(f);
    if (!fm) continue;
    const id = parseInt(fm[1], 10);
    let front = {};
    try { front = parseFrontmatter(fs.readFileSync(path.join(SEASON_DIR, f), 'utf8')).meta; } catch (_) {}
    ids.push(id);
    meta[id] = { title: front.title || '', date: front.date || '', rating: front.rating || '' };
  }
  ids.sort((a, b) => a - b);
  const index = { generatedAt: new Date().toISOString(), count: ids.length, ids, meta };
  try {
    fs.mkdirSync(SEASON_DIR, { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');
  } catch (_) {}
  return index;
}

module.exports = { buildSeasonReviewIndex, parseFrontmatter, SEASON_DIR, INDEX_PATH };
