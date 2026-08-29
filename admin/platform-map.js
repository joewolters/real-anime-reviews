'use strict';
// admin/platform-map.js
// <!-- author: Code | date: 2026-08-13 -->
// MOVED here from scripts/lib/ in v2.3.1, and made dual-mode. Reason: the
// "fix platforms" helper on the Edit page used to run on the Mode 1 desktop
// server. With that server gone the same rules have to run in the BROWSER — and
// `scripts/**` is firebase-ignored, so nothing under it can be loaded by a page.
// Moving beats copying: two copies of an allowlist drift, and a drift here means
// the edit page proposes different platforms than the backfill CLI does.
// Node still requires it (scripts/backfill-platforms.js); the page gets
// window.RarPlatformMap.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RarPlatformMap = api;
}(typeof self !== 'undefined' ? self : null, function () {
// <!-- author: Code | date: 2026-06-04 -->
// v1.8.1 (gate 4) — the platforms mapping/allowlist logic, EXTRACTED from
// scripts/backfill-platforms.js so two consumers share ONE source of truth:
//   1. the CLI  (node scripts/backfill-platforms.js [--dry-run])
//   2. the edit page's per-row "fix platforms" one-click (mode1-server's
//      POST /api/anime/:slug/platforms → this module → same proposal).
// Behaviour is byte-identical to backfill's prior inline copy (the CLI now
// requires this; the propose+override block moved here unchanged).

// AniList site (lowercased) → Blake's pill vocabulary. Keys define the US allowlist.
const PLATFORM_MAP = {
  'crunchyroll': 'Crunchyroll',
  'netflix': 'Netflix',
  'hulu': 'Hulu',
  'hidive': 'HIDIVE',
  'amazon prime video': 'Amazon Video',
  'amazon video': 'Amazon Video',
  'prime video': 'Amazon Video',
  'disney plus': 'Disney+',
  'disney+': 'Disney+',
  'disneyplus': 'Disney+',
  'max': 'Max',
  'hbo max': 'Max',
  'tubi': 'Tubi',
  'tubi tv': 'Tubi',
};
// Known-but-intentionally-excluded (regional / defunct) — for clearer flagging.
const KNOWN_EXCLUDED = new Set(['funimation', 'bilibili', 'bilibili tv', 'iq', 'iqiyi', 'laftel', 'bahamut', 'ani-one', 'anime onegai', 'youtube', 'vrv']);

// Gate 3d manual overrides (Blake-approved, keyed by normalized Title).
//  - Funimation titles: hand-add Crunchyroll ONLY where verified on Crunchyroll's
//    streaming catalog (2026-06-04 series-page checks):
//      • Parasyte: The Maxim → crunchyroll.com/series/G6K53VGGY (streaming) ✓ add
//      • Death Note         → crunchyroll.com/series/G6QWD3EE6 (streaming) ✓ add
//      • Boarding School Juliet → Crunchyroll Store/manga only, NO streaming page
//        (streams on Prime Video) → NO override (stays Amazon Video).
//  - Hatsune Miku: typo fix + physical-only is honest.
const normTitle = (s) => String(s || '').toLowerCase().replace(/[‘’']/g, "'").trim();
const MANUAL_OVERRIDES = {
  'parasyte: the maxim': { add: ['Crunchyroll'] },
  'death note': { add: ['Crunchyroll'] },
  "hatsune miku: colorful stage! a miku who can't sing": { set: ['Blu-ray only'] },
};

// AniList externalLinks → proposed platform list (normalized, allowlisted, deduped, A→Z).
// Returns { platforms:[...], filtered:[...] } where `filtered` is the excluded raw site names.
function proposePlatforms(externalLinks) {
  const streaming = (externalLinks || []).filter((l) => l && l.type === 'STREAMING' && l.site);
  const kept = new Map();   // display name -> true (dedupe)
  const filtered = [];
  for (const l of streaming) {
    const key = String(l.site).trim().toLowerCase();
    const mapped = PLATFORM_MAP[key];
    if (mapped) kept.set(mapped, true);
    else filtered.push(l.site);
  }
  const platforms = Array.from(kept.keys()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return { platforms, filtered };
}

// Full per-row proposal for a title: maps + allowlists the streaming links, builds
// the human flags (excluded/unmapped/no-links), then applies any manual override.
// `current` is the existing Watch value (preserved when AniList offers nothing usable,
// per rule: never blank a cell). Returns { platforms, proposed, filtered, flags, action }
// where action ∈ {CHANGE, SAME, KEEP}. This is backfill main()'s inner block, verbatim.
function proposePlatformsForRow(title, externalLinks, current) {
  current = String(current == null ? '' : current).trim();
  const { platforms, filtered } = proposePlatforms(externalLinks);
  const flags = [];
  if (filtered.length) {
    const excluded = filtered.filter((s) => KNOWN_EXCLUDED.has(String(s).toLowerCase()));
    const unknown = filtered.filter((s) => !KNOWN_EXCLUDED.has(String(s).toLowerCase()));
    if (excluded.length) flags.push(`excluded(regional/defunct): ${[...new Set(excluded)].join(', ')}`);
    if (unknown.length) flags.push(`UNMAPPED (Blake's eye): ${[...new Set(unknown)].join(', ')}`);
  }

  let proposed, action;
  if (!platforms.length) {
    // No usable US streaming on AniList → keep existing (never blank).
    proposed = current;
    action = 'KEEP';
    flags.unshift('AniList had no US streaming links — kept existing');
  } else {
    proposed = platforms.join(', ');
    action = (proposed === current) ? 'SAME' : 'CHANGE';
  }

  // Gate 3d manual overrides (Blake-approved).
  const ov = MANUAL_OVERRIDES[normTitle(title)];
  if (ov && ov.set) {
    proposed = ov.set.join(', ');
    action = (proposed === current) ? 'SAME' : 'CHANGE';
    flags.unshift('manual override (gate 3d)');
  } else if (ov && ov.add) {
    const merged = new Set(proposed ? proposed.split(',').map(s => s.trim()).filter(Boolean) : []);
    ov.add.forEach(p => merged.add(p));
    proposed = Array.from(merged).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join(', ');
    action = (proposed === current) ? 'SAME' : 'CHANGE';
    flags.unshift('manual +' + ov.add.join('/') + ' (verified, gate 3d)');
  }

  return { platforms, proposed, filtered, flags, action };
}

  return { PLATFORM_MAP, KNOWN_EXCLUDED, MANUAL_OVERRIDES, normTitle, proposePlatforms, proposePlatformsForRow };
}));
