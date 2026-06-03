#!/usr/bin/env node
/**
 * Real Anime Reviews — version-bump script
 * ============================================================================
 *
 * What this does
 * --------------
 * Bumps the site's version string everywhere it appears, in one command.
 * Replaces the 7-step manual checklist documented in CLAUDE.md (which is
 * error-prone — the v1.3.4 changelog widget bug was exactly this category:
 * APP_VERSION was bumped but the static fallback got missed).
 *
 * Where the version lives (14 total static strings across 3 HTML files)
 * --------------------------------------------------------------
 *   index.html              window.APP_VERSION + style/mobile/admin-fab
 *                           cache-busts + changelog widget tag           (5)
 *   account.html            window.APP_VERSION + style/mobile/admin-fab
 *                           cache-busts                                   (4)
 *   admin/new-anime.html    window.APP_VERSION + style/mobile/admin-fab/
 *                           new-anime cache-busts                         (5)
 *
 * JS files (script.js, account.js, firebase.js, admin-fab.js, new-anime.js,
 * card-render.js as of v1.6.5) are NOT in this list — they're loaded via
 * document.write with `${v}` template literal interpolation, runtime-versioned
 * from window.APP_VERSION. Same bump, no manual TARGETS upkeep.
 *
 * Authoritative source: the TARGETS array below. When you add a new HTML
 * file or cache-busted asset, add an entry there.
 *
 * The hardcoded fallback `const v = window.APP_VERSION || "1.0.1"` in both
 * HTML files is INTENTIONALLY NOT bumped. That fallback represents the
 * original launch version and only matters if APP_VERSION fails to load
 * (extreme edge case). Leaving it alone preserves the historical marker.
 *
 * Usage
 * -----
 *   node scripts/bump-version.js 1.5.0          # bump everything to 1.5.0
 *   node scripts/bump-version.js 1.5.0 --dry-run  # show what would change, no write
 *   node scripts/bump-version.js --check         # verify all 14 strings agree
 *   node scripts/bump-version.js --help          # this help
 *
 * Run from the project root (the folder containing index.html and account.html).
 *
 * Exit codes
 * ----------
 *   0 = success
 *   1 = error (invalid version, missing file, mismatch in --check, etc.)
 *
 * Authored by Code per the docs/SKILLS or scripts/ pattern. Date: 2026-05-09.
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---- ANSI color codes (no dependency, works in PowerShell + most terminals) --
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// ---- The bump targets ------------------------------------------------------
// Each entry says: which file, what regex to find, and how to build the
// replacement. The regex captures the OLD version string so we can show the
// user what was there before. The replacement uses the captured groups around
// the version so we don't have to re-type the surrounding HTML exactly.

const TARGETS = [
  {
    file: 'index.html',
    label: 'window.APP_VERSION (index)',
    pattern: /(<script>window\.APP_VERSION=")([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'index.html',
    label: 'style.css?v= (index)',
    pattern: /(href="style\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'index.html',
    label: 'mobile.css?v= (index)',
    pattern: /(href="mobile\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'index.html',
    label: 'changelog widget static fallback',
    pattern: /(id="changelog-version">v)([^<]+)(<)/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'account.html',
    label: 'window.APP_VERSION (account)',
    pattern: /(<script>window\.APP_VERSION=")([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'account.html',
    label: 'style.css?v= (account)',
    pattern: /(href="style\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'account.html',
    label: 'mobile.css?v= (account)',
    pattern: /(href="mobile\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  // ---- Added in v1.6.0 (Mode 1 baseline) ----
  {
    file: 'index.html',
    label: 'admin-fab.css?v= (index)',
    pattern: /(href="admin-fab\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'account.html',
    label: 'admin-fab.css?v= (account)',
    pattern: /(href="admin-fab\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/new-anime.html',
    label: 'window.APP_VERSION (admin)',
    pattern: /(<script>window\.APP_VERSION=")([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/new-anime.html',
    label: 'style.css?v= (admin)',
    pattern: /(href="\.\.\/style\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/new-anime.html',
    label: 'mobile.css?v= (admin)',
    pattern: /(href="\.\.\/mobile\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/new-anime.html',
    label: 'admin-fab.css?v= (admin)',
    pattern: /(href="\.\.\/admin-fab\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/new-anime.html',
    label: 'new-anime.css?v= (admin)',
    pattern: /(href="new-anime\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  // ---- Added in v1.6.11 (Suggestion Box) ----
  {
    file: 'suggest.html',
    label: 'window.APP_VERSION (suggest)',
    pattern: /(<script>window\.APP_VERSION=")([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'suggest.html',
    label: 'style.css?v= (suggest)',
    pattern: /(href="style\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'suggest.html',
    label: 'mobile.css?v= (suggest)',
    pattern: /(href="mobile\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'suggest.html',
    label: 'suggest.css?v= (suggest)',
    pattern: /(href="suggest\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  // ---- Added in v1.6.11 gate 2 (Suggestions admin queue) ----
  {
    file: 'admin/suggestions.html',
    label: 'window.APP_VERSION (suggestions)',
    pattern: /(<script>window\.APP_VERSION=")([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/suggestions.html',
    label: 'style.css?v= (suggestions)',
    pattern: /(href="\.\.\/style\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/suggestions.html',
    label: 'mobile.css?v= (suggestions)',
    pattern: /(href="\.\.\/mobile\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/suggestions.html',
    label: 'suggestions.css?v= (suggestions)',
    pattern: /(href="suggestions\.css\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  // ---- Added in v1.6.11 gate 5b (static JS-script cache-busters) ----
  // Most HTML files load their JS via `document.write` with runtime APP_VERSION
  // interpolation, so the JS cache-bust comes free with each bump. BUT
  // suggest.html (gate 1b) and admin/suggestions.html (gate 2b) load their
  // module scripts via static <script type="module" src="...?v=X.Y.Z"> tags
  // instead. Those 4 cache-busters DO need TARGETS entries to stay in sync.
  {
    file: 'suggest.html',
    label: 'firebase.js?v= (suggest)',
    pattern: /(src="firebase\.js\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'suggest.html',
    label: 'suggest.js?v= (suggest)',
    pattern: /(src="suggest\.js\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/suggestions.html',
    label: 'firebase.js?v= (suggestions)',
    pattern: /(src="\.\.\/firebase\.js\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  {
    file: 'admin/suggestions.html',
    label: 'suggestions.js?v= (suggestions)',
    pattern: /(src="suggestions\.js\?v=)([^"]+)(")/,
    replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
  },
  // NOTE: All OTHER JS files (script.js, account.js, firebase.js loaded into
  // index.html/account.html/admin/new-anime.html, admin-fab.js, new-anime.js,
  // card-render.js) intentionally are NOT in TARGETS. Those HTML files use
  // `document.write` with `${v}` template literal interpolation in the HTML
  // script blocks — the cache-bust comes from APP_VERSION at runtime. Adding
  // those JS files here would create a maintenance burden with no benefit
  // (the runtime interpolation already updates them every bump).
];

// ---- Helpers ---------------------------------------------------------------

function isValidVersion(v) {
  // SemVer-ish: X.Y.Z where each is a non-negative integer
  return /^\d+\.\d+\.\d+$/.test(v);
}

function loadFile(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.error(`${C.red}ERROR:${C.reset} ${file} not found at ${abs}`);
    console.error(`Run this script from the project root (the folder containing index.html).`);
    process.exit(1);
  }
  return fs.readFileSync(abs, 'utf8');
}

function findCurrentVersions() {
  // Group targets by file so we only read each file once
  const byFile = {};
  for (const t of TARGETS) {
    byFile[t.file] = byFile[t.file] || [];
    byFile[t.file].push(t);
  }

  const found = [];
  for (const [file, targets] of Object.entries(byFile)) {
    const text = loadFile(file);
    for (const t of targets) {
      const match = text.match(t.pattern);
      if (!match) {
        console.error(`${C.red}ERROR:${C.reset} pattern not found in ${file}: ${t.label}`);
        console.error(`Looked for: ${t.pattern}`);
        process.exit(1);
      }
      found.push({ ...t, currentVersion: match[2] });
    }
  }
  return found;
}

// ---- Subcommands -----------------------------------------------------------

function cmdHelp() {
  console.log(`
${C.bold}Real Anime Reviews — version-bump script${C.reset}

  ${C.bold}Usage:${C.reset}
    node scripts/bump-version.js ${C.green}1.5.0${C.reset}              ${C.gray}# bump to 1.5.0${C.reset}
    node scripts/bump-version.js ${C.green}1.5.0${C.reset} --dry-run    ${C.gray}# preview, no write${C.reset}
    node scripts/bump-version.js --check              ${C.gray}# verify all 14 agree${C.reset}
    node scripts/bump-version.js --help

  ${C.bold}Updates 14 places automatically:${C.reset}
    index.html              ${C.gray}APP_VERSION + style/mobile/admin-fab cache-busts + widget tag${C.reset}  (5)
    account.html            ${C.gray}APP_VERSION + style/mobile/admin-fab cache-busts${C.reset}              (4)
    admin/new-anime.html    ${C.gray}APP_VERSION + style/mobile/admin-fab/new-anime cache-busts${C.reset}    (5)

  ${C.bold}Run from:${C.reset} the project root (folder containing index.html).
`);
}

function cmdCheck() {
  console.log(`${C.bold}Checking version-string consistency...${C.reset}\n`);
  const found = findCurrentVersions();
  const versions = new Set(found.map((f) => f.currentVersion));

  for (const f of found) {
    console.log(`  ${C.gray}${f.file.padEnd(13)}${C.reset}  ${f.label.padEnd(40)}  ${f.currentVersion}`);
  }
  console.log('');

  if (versions.size === 1) {
    const [v] = versions;
    console.log(`${C.green}OK:${C.reset} all ${found.length} strings agree on ${C.bold}v${v}${C.reset}`);
    process.exit(0);
  } else {
    console.log(`${C.red}MISMATCH:${C.reset} found ${versions.size} different versions: ${[...versions].join(', ')}`);
    console.log(`${C.yellow}Fix:${C.reset} run "node scripts/bump-version.js <correct-version>" to bring them into sync.`);
    process.exit(1);
  }
}

function cmdBump(newVersion, dryRun) {
  if (!isValidVersion(newVersion)) {
    console.error(`${C.red}ERROR:${C.reset} "${newVersion}" is not a valid version string.`);
    console.error(`Expected format: X.Y.Z (e.g., 1.5.0)`);
    process.exit(1);
  }

  const found = findCurrentVersions();
  const currentVersions = new Set(found.map((f) => f.currentVersion));

  console.log(`${C.bold}${dryRun ? 'DRY RUN: ' : ''}Bumping to v${newVersion}${C.reset}\n`);

  if (currentVersions.size > 1) {
    console.log(`${C.yellow}Note:${C.reset} found mismatched current versions: ${[...currentVersions].join(', ')}`);
    console.log(`${C.yellow}      ${C.reset} all will be brought to v${newVersion}.\n`);
  }

  // Group targets by file, apply all replacements, write once
  const byFile = {};
  for (const f of found) {
    byFile[f.file] = byFile[f.file] || { text: loadFile(f.file), targets: [] };
    byFile[f.file].targets.push(f);
  }

  let totalChanges = 0;
  for (const [file, info] of Object.entries(byFile)) {
    let text = info.text;
    for (const t of info.targets) {
      const before = t.currentVersion;
      if (before === newVersion) {
        console.log(`  ${C.gray}=${C.reset} ${file.padEnd(13)} ${t.label.padEnd(40)} already at v${newVersion}`);
        continue;
      }
      text = text.replace(t.pattern, t.replacement(newVersion));
      console.log(`  ${C.green}+${C.reset} ${file.padEnd(13)} ${t.label.padEnd(40)} ${C.gray}v${before}${C.reset} -> ${C.bold}v${newVersion}${C.reset}`);
      totalChanges++;
    }
    if (!dryRun && text !== info.text) {
      fs.writeFileSync(path.resolve(file), text, 'utf8');
    }
  }

  console.log('');
  if (dryRun) {
    console.log(`${C.yellow}DRY RUN:${C.reset} ${totalChanges} change${totalChanges === 1 ? '' : 's'} would be made. Run without --dry-run to apply.`);
  } else if (totalChanges === 0) {
    console.log(`${C.green}OK:${C.reset} all strings were already at v${newVersion}. No changes made.`);
  } else {
    console.log(`${C.green}DONE:${C.reset} ${totalChanges} string${totalChanges === 1 ? '' : 's'} updated.`);
    console.log(`${C.gray}Next:${C.reset} verify with ${C.bold}node scripts/bump-version.js --check${C.reset}, then commit.`);
  }
}

// ---- Main ------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    cmdHelp();
    return;
  }

  if (args[0] === '--check') {
    cmdCheck();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const versionArg = args.find((a) => !a.startsWith('--'));

  if (!versionArg) {
    console.error(`${C.red}ERROR:${C.reset} no version specified.`);
    console.error(`Usage: node scripts/bump-version.js 1.5.0`);
    process.exit(1);
  }

  cmdBump(versionArg, dryRun);
}

main();
