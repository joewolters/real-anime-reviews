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
 * Where the version lives (per CLAUDE.md "Version bump checklist")
 * ----------------------------------------------------------------
 *   index.html line   8: <script>window.APP_VERSION="X.Y.Z"</script>
 *   index.html line  24: <link ... href="style.css?v=X.Y.Z">
 *   index.html line  25: <link ... href="mobile.css?v=X.Y.Z" ...>
 *   index.html line 168: <span ... id="changelog-version">vX.Y.Z</span>
 *   account.html line 7: <script>window.APP_VERSION="X.Y.Z"</script>
 *   account.html line 23: <link ... href="style.css?v=X.Y.Z" />
 *   account.html line 24: <link ... href="mobile.css?v=X.Y.Z" ... />
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
 *   node scripts/bump-version.js --check         # verify all 7 strings agree
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
    node scripts/bump-version.js --check              ${C.gray}# verify all 7 agree${C.reset}
    node scripts/bump-version.js --help

  ${C.bold}Updates 7 places automatically:${C.reset}
    index.html   line   8  ${C.gray}window.APP_VERSION${C.reset}
    index.html   line  24  ${C.gray}style.css?v=${C.reset}
    index.html   line  25  ${C.gray}mobile.css?v=${C.reset}
    index.html   line 168  ${C.gray}changelog widget static fallback${C.reset}
    account.html line   7  ${C.gray}window.APP_VERSION${C.reset}
    account.html line  23  ${C.gray}style.css?v=${C.reset}
    account.html line  24  ${C.gray}mobile.css?v=${C.reset}

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
    console.log(`${C.green}OK:${C.reset} all 7 strings agree on ${C.bold}v${v}${C.reset}`);
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
