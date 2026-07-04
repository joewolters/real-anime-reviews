#!/usr/bin/env node
/**
 * Real Anime Reviews — Excel → animeData.js sync (v1.5.0 milestone)
 * ============================================================================
 *
 * What this does
 * --------------
 * Reads `Master List/Anime_Master_Table.xlsx` (Excel = canonical per project
 * rule #1) and regenerates `animeData.js`. One command, every anime in sync.
 *
 * Replaces the old workflow of hand-editing `animeData.js` after every Excel
 * change. After this script ships, the canonical-source promise is real:
 * Excel is the truth, the JS file is downstream output.
 *
 * Field mappings (Excel column → animeData.js field)
 * --------------------------------------------------
 *   Title         → Title         (string)
 *   Rating        → Rating        (string, e.g. "9/10")
 *   Seasons       → Seasons       (string)
 *   Genre         → Genre         (string)
 *   Description   → Description   (string)
 *   Review        → Review        (string, multi-line OK)
 *   Tags          → Tags          (transform: strip "#", split, lowercase, hyphenate)
 *   Watch         → Platforms     (transform: split on comma, trim)
 *   Studio        → Studio        (string, kept comma-joined per decision)
 *   Trailer       → Trailer       (transform: normalize to youtube.com/embed/ format)
 *   Top10Rank     → Top10Rank     (number, only emitted when non-empty)
 *
 *   Excel "FORMAT:" and "EXAMPLE:" columns are SKIPPED (reference only).
 *   Excel "AniListId", "IdMal", "AniListScore", "AniListColor" columns are
 *   READ but only emitted into animeData.js when non-empty (Mode 1 will
 *   start populating these in v1.6.0).
 *
 * Image field handling (v1.5.0 limitation, resolved in v1.6.0)
 * -----------------------------------------------------------
 * Excel doesn't have an Image column. Per project rule #9 (hybrid image
 * curation), Mode 1 will handle images starting in v1.6.0. For v1.5.0:
 *   - Existing entries: image filename is read from current animeData.js
 *     and preserved (Title-keyed lookup)
 *   - New entries (Title in Excel but not in current animeData.js): script
 *     errors out and lists them — Blake adds the image manually OR waits
 *     for Mode 1
 *
 * Validation rules (sync FAILS if any violated)
 * ---------------------------------------------
 *   - Title required, non-empty
 *   - Rating matches /^\d+(\.\d+)?\/10$/
 *   - Trailer matches /^https:\/\/www\.youtube\.com\/embed\/[\w-]+$/ (post-normalization)
 *   - No duplicate Titles in Excel
 *   - Genre, Description, Review non-empty
 *   - Tags: at least one tag
 *   - Watch (Platforms): at least one platform
 *
 * Validation WARNINGS (sync continues, but logs)
 * ----------------------------------------------
 *   - Trailer URL was in youtu.be format and got normalized
 *   - Watch column had merged platforms (no comma between two names)
 *   - Genre is uncommon (likely typo, e.g., "Shoen" instead of "Shonen")
 *
 * Usage
 * -----
 *   npm run sync                 # full sync (writes animeData.js)
 *   npm run sync:check           # dry-run (shows diff, no write)
 *   node scripts/sync-excel-to-js.js --validate    # only validations, no diff
 *   node scripts/sync-excel-to-js.js --help
 *
 * Exit codes
 * ----------
 *   0 = success
 *   1 = validation failure (sync did not write)
 *   2 = file not found / read error
 *   3 = bad arguments
 *
 * Authored: Code, 2026-05-09. Phase A v1.5.0 milestone.
 * Schema reference: docs/schema-diff.md
 * AniList field reference: docs/anilist-spike.md
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  console.error('\x1b[31mERROR:\x1b[0m the "xlsx" package is not installed.');
  console.error('Run from Current Version/:  npm install');
  process.exit(2);
}

// ---- ANSI colors -----------------------------------------------------------
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

// ---- Paths -----------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.resolve(PROJECT_ROOT, '..', 'Master List', 'Anime_Master_Table.xlsx');
const OUTPUT_PATH = path.resolve(PROJECT_ROOT, 'animeData.js');

// ---- The "do nothing" image fallback when no existing entry exists --------
const DEFAULT_IMAGE = 'placeholder.png';

// ---- Known genres (warns if Excel has something off this list) ------------
// Both single-word tokens AND compound genres (e.g., "Slice of Life") are
// recognized. The check normalizes whitespace and slashes so "Romance/Slice
// of Life" and "Romance / Slice of Life" both parse correctly.
const KNOWN_GENRES = [
  'Shonen', 'Action', 'Fantasy', 'Supernatural', 'Thriller', 'Mystery',
  'Psychological', 'Isekai', 'Romance', 'Slice of Life', 'Drama', 'Comedy',
  'Sci-Fi', 'Horror', 'Sports', 'Music', 'Mecha', 'School', 'Adventure',
  'Historical', 'Studio Ghibli', 'Musical', 'Idol', 'Ecchi', 'Seinen', 'Shojo',
];

function checkGenre(genreString, title, warnings) {
  if (!genreString) return;
  // Split on slash (with optional whitespace), e.g. "Romance / Slice of Life"
  const parts = genreString.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (!KNOWN_GENRES.includes(p)) {
      warnings.push(`Genre "${genreString}" for "${title}" contains unrecognized part "${p}" — possible typo (e.g., "Shoen" instead of "Shonen")?`);
    }
  }
}

// Slugify a title to a filename-safe slug (matches Mode 1 server's slugify
// so the slug-based image fallback below finds files Mode 1 downloaded).
function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

// ---- Title normalization for matching ------------------------------------
// Excel often has curly apostrophes (’), Unicode dashes (− – —), and slightly
// different capitalization than animeData.js (which has straight apostrophes ',
// hyphen-minus -, and was hand-typed). We normalize for *matching* but preserve
// the Excel form for *output*.
function normalizeTitle(t) {
  if (!t) return '';
  return String(t)
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")  // curly singles → straight
    .replace(/[“”„‟]/g, '"')  // curly doubles → straight
    .replace(/[−–—‐]/g, '-')  // Unicode dashes (minus, en-dash, em-dash, hyphen) → hyphen-minus
    .replace(/\s+/g, ' ')                                     // collapse whitespace
    .trim();
}

// ---- Step 1: Read existing animeData.js to extract Title→image map --------
function buildExistingImageMap() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error(`${C.yellow}WARNING:${C.reset} ${OUTPUT_PATH} doesn't exist yet — image lookups will all fall back to "${DEFAULT_IMAGE}".`);
    return new Map();
  }
  const text = fs.readFileSync(OUTPUT_PATH, 'utf8');

  // Match each anime entry's Title and image fields.
  // Pattern: Title: "..." appears, then later in the same object, image: "..."
  // We use a permissive [\s\S]*? to match across newlines but stop at the closing brace.
  const entryPattern = /Title:\s*"([^"]+)"[\s\S]*?image:\s*"([^"]+)"/g;
  const map = new Map();
  let match;
  while ((match = entryPattern.exec(text)) !== null) {
    const [, title, image] = match;
    // Key by normalized title so curly-vs-straight apostrophes and capitalization
    // differences between Excel and the existing JS file don't cause false misses.
    map.set(normalizeTitle(title), image);
  }
  return map;
}

// ---- Step 2: Read Excel ----------------------------------------------------
function loadExcelRows() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`${C.red}ERROR:${C.reset} Excel file not found at ${EXCEL_PATH}`);
    console.error('Expected location: ../Master List/Anime_Master_Table.xlsx (relative to Current Version/)');
    process.exit(2);
  }
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // header: 1 → returns array-of-arrays. raw: false → format dates/numbers as strings.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
  if (rows.length === 0) {
    console.error(`${C.red}ERROR:${C.reset} Excel file is empty.`);
    process.exit(2);
  }
  const headers = rows[0].map((h) => (h == null ? '' : String(h).trim()));
  const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell != null && String(cell).trim() !== ''));
  return { headers, dataRows };
}

// ---- Step 3: Map row to anime object --------------------------------------
function indexOf(headers, name) {
  const idx = headers.indexOf(name);
  return idx === -1 ? null : idx;
}

function transformTags(rawTags) {
  // Excel: "#action #animation #fan service #OP MC"  (Blake also writes
  //        "#action, #underdog, #worldbuilding" — comma-separated hashtags)
  // Out:   ["action", "animation", "fan-service", "op-mc"]
  if (!rawTags) return [];
  // LAST CALL A6 — split on '#' AND ',' and strip trailing punctuation: the
  // '#'-only split kept each segment's trailing comma ("action,") and turned
  // interior ", " into ",-" ("friendly,-rivalry") — the comma'd tag pills in
  // Blake's screenshot. The transform is tolerant of BOTH Excel styles; Excel
  // itself stays untouched (canonical).
  return String(rawTags)
    .split(/[#,]/)
    .map((s) => s.trim().replace(/[,;、.]+$/g, ''))
    .filter(Boolean)
    .map((s) => s.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, ''));
}

function transformPlatforms(rawWatch, warnings) {
  // Excel: "Amazon Video, Hulu, Netflix hianime, 9anime, aniwave,"
  // Out:   ["Amazon Video", "Hulu", "Netflix", "hianime", "9anime", "aniwave"]
  if (!rawWatch) return [];
  // First split on comma, then check if any segment contains a known
  // platform name awkwardly merged with another (e.g. "Netflix hianime")
  // v1.7.3 — hianime / 9anime / aniwave removed (unofficial platforms dropped site-wide).
  const knownPlatforms = ['Crunchyroll', 'Netflix', 'Hulu', 'HIDIVE', 'Amazon Video', 'Amazon Prime Video', 'DisneyPlus', 'Disney+', 'Bilibili', 'Funimation', 'Tubi'];
  const segments = String(rawWatch).split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const seg of segments) {
    // Check if this segment is two platforms merged (e.g., "Netflix hianime")
    const split = splitMergedPlatforms(seg, knownPlatforms);
    if (split.length > 1) {
      warnings.push(`Watch column entry "${seg}" looked like merged platforms — split into ${split.map((p) => `"${p}"`).join(' + ')}.`);
    }
    out.push(...split);
  }
  return out;
}

function splitMergedPlatforms(seg, knownPlatforms) {
  // If seg contains spaces and matches "<KnownPlatform> <KnownPlatform>", split.
  // Greedy match against the longest known names first.
  const sorted = [...knownPlatforms].sort((a, b) => b.length - a.length);
  // Try every prefix that matches a known platform
  for (const p of sorted) {
    const prefix = p + ' ';
    if (seg.startsWith(prefix)) {
      const rest = seg.slice(prefix.length).trim();
      if (rest) {
        // Check if rest also starts with a known platform
        const isRestKnown = sorted.some((q) => rest === q || rest.startsWith(q + ' '));
        if (isRestKnown) {
          return [p, ...splitMergedPlatforms(rest, knownPlatforms)];
        }
      }
    }
  }
  return [seg];
}

function transformTrailer(rawTrailer, warnings) {
  // Accept several formats and normalize to https://www.youtube.com/embed/<ID>
  if (!rawTrailer) return null;
  const url = String(rawTrailer).trim();

  // Already in embed format?
  let m = url.match(/youtube\.com\/embed\/([\w-]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;

  // youtu.be share format?
  m = url.match(/youtu\.be\/([\w-]+)/);
  if (m) {
    warnings.push(`Trailer URL "${url}" was in youtu.be share format — normalized to /embed/.`);
    return `https://www.youtube.com/embed/${m[1]}`;
  }

  // youtube.com/watch?v=ID format?
  m = url.match(/youtube\.com\/watch\?v=([\w-]+)/);
  if (m) {
    warnings.push(`Trailer URL "${url}" was in watch?v= format — normalized to /embed/.`);
    return `https://www.youtube.com/embed/${m[1]}`;
  }

  // youtube.com/<ID> (missing /embed/, e.g. typo) — try to recover
  m = url.match(/^https?:\/\/www\.youtube\.com\/([\w-]{8,})$/);
  if (m) {
    warnings.push(`Trailer URL "${url}" was missing the /embed/ path segment — assumed it should be the video ID and normalized.`);
    return `https://www.youtube.com/embed/${m[1]}`;
  }

  // Unrecognized format — return as-is (validation will fail it)
  return url;
}

function rowToAnime(row, headers, imageMap, warnings) {
  const get = (name) => {
    const idx = indexOf(headers, name);
    if (idx == null) return null;
    const v = row[idx];
    return v == null ? null : String(v).trim();
  };

  const title = get('Title');
  if (!title) return null; // skip empty rows

  const rawTrailer = get('Trailer');
  const trailer = transformTrailer(rawTrailer, warnings);

  // Genre check — flag unrecognized parts as possible typos
  const genreRaw = get('Genre') || '';
  checkGenre(genreRaw, title, warnings);

  // Look up image from existing animeData.js using normalized-title matching.
  // (Handles curly-vs-straight apostrophes and capitalization differences
  // between Excel and the hand-typed JS without losing existing image references.)
  let image = imageMap.get(normalizeTitle(title));
  if (!image) {
    // BUG 9 fix: before falling back to placeholder, try the slug convention.
    // Mode 1 server downloads covers as `assets/<slug>.png`, so a freshly-added
    // entry's image will be there even if no prior animeData.js entry exists.
    const slug = slugify(title);
    const ASSETS_DIR = path.resolve(path.dirname(OUTPUT_PATH), 'assets');
    for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
      const candidate = `${slug}.${ext}`;
      if (fs.existsSync(path.join(ASSETS_DIR, candidate))) {
        image = candidate;
        break;
      }
    }
  }
  if (!image) {
    image = DEFAULT_IMAGE;
    warnings.push(`No image found for new entry "${title}" — using "${DEFAULT_IMAGE}". Drop a file at assets/${slugify(title)}.png (or .jpg/.webp) and re-run sync, OR use Mode 1 which downloads the AniList cover automatically.`);
  }

  const anime = {
    Title: title,
    Genre: genreRaw,
    Rating: get('Rating') || '',
    image,
    Seasons: get('Seasons') || '',
    Description: get('Description') || '',
    Review: get('Review') || '',
    Tags: transformTags(get('Tags')),
    Studio: get('Studio') || '',
    Platforms: transformPlatforms(get('Watch'), warnings),
    Trailer: trailer || '',
  };

  // Optional Top10Rank
  const top10 = get('Top10Rank');
  if (top10) {
    const n = parseInt(top10, 10);
    if (!isNaN(n) && n >= 1 && n <= 10) {
      anime.Top10Rank = n;
    } else {
      warnings.push(`Top10Rank "${top10}" for "${title}" is not a valid 1-10 number — skipping.`);
    }
  }

  // Optional AniList fields (read but only emit when present)
  for (const f of ['AniListId', 'IdMal', 'AniListScore']) {
    const v = get(f);
    if (v) {
      const n = parseInt(v, 10);
      if (!isNaN(n)) anime[f] = n;
    }
  }
  const color = get('AniListColor');
  if (color) anime.AniListColor = color;

  // v1.7.0 — backfilled title variants (stored only; display deferred to v1.7.x).
  const titleEnglish = get('TitleEnglish');
  if (titleEnglish) anime.TitleEnglish = titleEnglish;
  const titleRomaji = get('TitleRomaji');
  if (titleRomaji) anime.TitleRomaji = titleRomaji;
  const titleNative = get('TitleNative');
  if (titleNative) anime.TitleNative = titleNative;

  // v1.7.3 — watched-set columns: comma-separated AniListIds → number arrays.
  // WatchedAniListIds = the entries Blake watched (drive the ✓ REVIEWED pill);
  // KnownAniListIds = snapshot of the franchise tree at last save (for Mode 2's
  // future "new arc surfaced" diff — stored only, no logic this ship). Emitted
  // only when non-empty (until the gate-4 backfill, all rows are blank → omitted,
  // so the pill falls back to primary-AniListId behaviour exactly as v1.7.2).
  for (const f of ['WatchedAniListIds', 'KnownAniListIds']) {
    const raw = get(f);
    if (raw) {
      const ids = String(raw)
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      if (ids.length) anime[f] = ids;
    }
  }

  return anime;
}

// ---- Step 4: Validate ------------------------------------------------------
function validate(anime, errors, allTitles) {
  const t = anime.Title;
  if (!t) errors.push('Anime with empty Title.');
  if (!anime.Rating || !/^\d+(\.\d+)?\/10$/.test(anime.Rating)) {
    errors.push(`"${t}" — Rating "${anime.Rating}" doesn't match X/10 or X.Y/10 format.`);
  }
  if (!anime.Trailer || !/^https:\/\/www\.youtube\.com\/embed\/[\w-]+$/.test(anime.Trailer)) {
    errors.push(`"${t}" — Trailer "${anime.Trailer}" doesn't match the required https://www.youtube.com/embed/<id> format.`);
  }
  if (!anime.Genre) errors.push(`"${t}" — Genre is empty.`);
  if (!anime.Description) errors.push(`"${t}" — Description is empty.`);
  if (!anime.Review) errors.push(`"${t}" — Review is empty.`);
  if (!anime.Tags || anime.Tags.length === 0) errors.push(`"${t}" — Tags is empty.`);
  if (!anime.Platforms || anime.Platforms.length === 0) errors.push(`"${t}" — Platforms (Watch column) is empty.`);

  if (allTitles.has(t)) {
    errors.push(`Duplicate Title in Excel: "${t}".`);
  } else {
    allTitles.add(t);
  }
}

// ---- Step 5: Render to animeData.js ---------------------------------------
function renderJsFile(animes) {
  // Mirror the existing file's formatting style: 2-space indent, double quotes,
  // arrays on single lines, multi-line strings preserved.
  const escapeString = (s) => JSON.stringify(s); // handles quotes, newlines, etc.
  const renderArray = (arr) => '[' + arr.map(escapeString).join(',') + ']';

  const lines = [];
  lines.push('// AUTO-GENERATED by scripts/sync-excel-to-js.js — do not edit by hand.');
  lines.push('// Source of truth: ../Master List/Anime_Master_Table.xlsx');
  lines.push('// Last sync: ' + new Date().toISOString());
  lines.push('');
  lines.push('const animeData = [');
  for (const a of animes) {
    lines.push('  {');
    lines.push(`    Title: ${escapeString(a.Title)},`);
    lines.push(`    Genre: ${escapeString(a.Genre)},`);
    lines.push(`    Rating: ${escapeString(a.Rating)},`);
    lines.push(`    image: ${escapeString(a.image)},`);
    lines.push(`    Seasons: ${escapeString(a.Seasons)},`);
    lines.push(`    Description: ${escapeString(a.Description)},`);
    lines.push(`    Review: ${escapeString(a.Review)},`);
    lines.push(`    Tags: ${renderArray(a.Tags)},`);
    lines.push(`    Studio: ${escapeString(a.Studio)},`);
    lines.push(`    Platforms: ${renderArray(a.Platforms)},`);
    lines.push(`    Trailer: ${escapeString(a.Trailer)}`);
    if (a.Top10Rank != null) lines.push(`    ,Top10Rank: ${a.Top10Rank}`);
    if (a.AniListId != null) lines.push(`    ,AniListId: ${a.AniListId}`);
    if (a.IdMal != null) lines.push(`    ,IdMal: ${a.IdMal}`);
    if (a.AniListScore != null) lines.push(`    ,AniListScore: ${a.AniListScore}`);
    if (a.AniListColor != null) lines.push(`    ,AniListColor: ${escapeString(a.AniListColor)}`);
    if (a.TitleEnglish != null) lines.push(`    ,TitleEnglish: ${escapeString(a.TitleEnglish)}`);
    if (a.TitleRomaji != null) lines.push(`    ,TitleRomaji: ${escapeString(a.TitleRomaji)}`);
    if (a.TitleNative != null) lines.push(`    ,TitleNative: ${escapeString(a.TitleNative)}`);
    // v1.7.3 — watched-set arrays (numeric AniList ids). Parsed in rowToAnime;
    // these emit lines were the missing half (gate-6 catch) — without them the
    // ✓ REVIEWED pill silently fell back to primary-id only.
    if (Array.isArray(a.WatchedAniListIds) && a.WatchedAniListIds.length) lines.push(`    ,WatchedAniListIds: ${renderArray(a.WatchedAniListIds)}`);
    if (Array.isArray(a.KnownAniListIds) && a.KnownAniListIds.length) lines.push(`    ,KnownAniListIds: ${renderArray(a.KnownAniListIds)}`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

// ---- Step 6: Diff (dry-run support) ---------------------------------------
function summarizeDiff(oldText, newText) {
  if (oldText === newText) return { unchanged: true };
  // Count anime entries before/after
  const countAnimes = (txt) => (txt.match(/Title:\s*"/g) || []).length;
  return {
    unchanged: false,
    oldCount: countAnimes(oldText || ''),
    newCount: countAnimes(newText),
    oldBytes: Buffer.byteLength(oldText || '', 'utf8'),
    newBytes: Buffer.byteLength(newText, 'utf8'),
  };
}

// ---- Help ------------------------------------------------------------------
function printHelp() {
  console.log(`
${C.bold}Real Anime Reviews — Excel → animeData.js sync${C.reset}

  ${C.bold}Usage:${C.reset}
    npm run sync                             ${C.gray}# full sync (writes animeData.js)${C.reset}
    npm run sync:check                       ${C.gray}# dry-run (shows summary, no write)${C.reset}
    node scripts/sync-excel-to-js.js --validate
                                             ${C.gray}# only run validations, no diff${C.reset}
    node scripts/sync-excel-to-js.js --help

  ${C.bold}First-time setup (once after pulling this script):${C.reset}
    npm install                              ${C.gray}# installs the xlsx dependency${C.reset}

  ${C.bold}What gets read:${C.reset}
    ${EXCEL_PATH}

  ${C.bold}What gets written:${C.reset}
    ${OUTPUT_PATH}

  ${C.bold}Schema reference:${C.reset} docs/schema-diff.md
`);
}

// ---- Main ------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const validateOnly = args.includes('--validate');

  console.log(`${C.bold}${dryRun ? 'DRY RUN: ' : ''}Reading Excel...${C.reset}`);
  console.log(`  Source: ${C.gray}${EXCEL_PATH}${C.reset}`);

  const imageMap = buildExistingImageMap();
  console.log(`  Image lookup map: ${imageMap.size} existing Title→image entries`);

  const { headers, dataRows } = loadExcelRows();
  console.log(`  Excel: ${dataRows.length} data rows, ${headers.filter(Boolean).length} columns`);

  const warnings = [];
  const errors = [];
  const allTitles = new Set();
  const animes = [];

  for (const row of dataRows) {
    const a = rowToAnime(row, headers, imageMap, warnings);
    if (!a) continue;
    validate(a, errors, allTitles);
    animes.push(a);
  }

  console.log(`  Parsed: ${animes.length} anime entries`);
  console.log('');

  if (warnings.length > 0) {
    console.log(`${C.yellow}${C.bold}Warnings (${warnings.length}):${C.reset}`);
    for (const w of warnings) console.log(`  ${C.yellow}!${C.reset} ${w}`);
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`${C.red}${C.bold}Validation errors (${errors.length}) — sync ABORTED:${C.reset}`);
    for (const e of errors) console.log(`  ${C.red}x${C.reset} ${e}`);
    console.log('');
    console.log(`${C.red}Fix the errors above in Excel, then re-run.${C.reset}`);
    process.exit(1);
  }

  if (validateOnly) {
    console.log(`${C.green}OK:${C.reset} all validations passed (${animes.length} anime).`);
    return;
  }

  // v1.7.4 (gate 3) — refresh the season-review index on every real sync (even if
  // animeData is unchanged below; reviews live in markdown files independent of
  // Excel). The mode1 PUT/DELETE endpoints also rebuild it directly.
  if (!dryRun) {
    try {
      const { buildSeasonReviewIndex } = require('./lib/season-review-index');
      const idx = buildSeasonReviewIndex();
      console.log(`  Season-review index: ${idx.count} review(s) → season-reviews/index.json`);
    } catch (e) {
      console.log(`${C.yellow}!${C.reset} season-review index skipped: ${e.message}`);
    }
  }

  const newText = renderJsFile(animes);
  const oldText = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
  const diff = summarizeDiff(oldText, newText);

  if (diff.unchanged) {
    console.log(`${C.green}OK:${C.reset} animeData.js is already in sync. No changes.`);
    return;
  }

  console.log(`${C.bold}Diff summary:${C.reset}`);
  console.log(`  Anime count: ${diff.oldCount} → ${diff.newCount}`);
  console.log(`  File size:   ${diff.oldBytes} → ${diff.newBytes} bytes (${diff.newBytes - diff.oldBytes >= 0 ? '+' : ''}${diff.newBytes - diff.oldBytes})`);
  console.log('');

  if (dryRun) {
    console.log(`${C.yellow}DRY RUN:${C.reset} would write ${diff.newBytes} bytes to ${OUTPUT_PATH}.`);
    console.log(`${C.gray}Run without --dry-run to apply.${C.reset}`);
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, newText, 'utf8');
  console.log(`${C.green}DONE:${C.reset} wrote ${diff.newBytes} bytes to animeData.js.`);
  console.log('');
  console.log(`${C.bold}Next steps:${C.reset}`);
  console.log(`  1. ${C.gray}git diff animeData.js${C.reset} — review the changes`);
  console.log(`  2. ${C.gray}npm test${C.reset} — confirm Playwright tests still pass`);
  console.log(`  3. ${C.gray}node scripts/bump-version.js${C.reset} — bump version (PATCH or MINOR depending on data scope)`);
  console.log(`  4. Update CHANGELOG.md, commit, preview deploy, prod deploy.`);
  console.log(`  5. See ${C.gray}docs/SKILLS/release-skill.md${C.reset} for full release workflow.`);
}

main();
