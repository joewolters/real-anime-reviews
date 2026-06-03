<!-- author: Code | date: 2026-06-03 -->
# v1.7.0 — Gate 5 (docs cascade — DONE ✓, FAST-TRACK)

> Version bumped 1.6.12 → 1.7.0 (26/26 agree), CHANGELOG entry prepended, visitor widget bullet added (cap held at 10 by dropping the oldest), NEXT.md + ROADMAP.md rolled forward. `npm test` 7/7. No commit (gate 7).

---

## Files touched

| File | Δ | What |
|---|---|---|
| 7 HTML files (index/account/suggest/admin × cache-busters) | 26 strings | `bump-version.js 1.7.0` |
| `index.html` | +7 / −1 | New `06/03/2026` widget section (1 bullet); dropped the oldest bullet to hold the 10-cap |
| `CHANGELOG.md` | +~30 | v1.7.0 MINOR entry prepended |
| `docs/NEXT.md` | +3 / ~6 moved | v1.7.0 → Recently shipped; v1.7.0-polish promoted to Immediate next ship; Phase B-side v1.7.0 marked ✅ shipped |
| `ROADMAP.md` | +2 / ~2 | Current state → Live at v1.7.0 + v1.7.0 clause; v1.7.0 shipped-highlight bullet; "Up next" rewritten to v1.7.0-polish → v1.7.1 → v1.7.2 |

## Final widget bullet (index.html, visitor-facing)
> When you open an anime, you'll now see the AniList community score right next to my rating — so you can see where my take lines up with the wider community.

Blake's first-person voice, casual, no class names/IDs. "AniList" appears as data attribution (allowed per the updated memory). Cap math: was 10 bullets → added 1, dropped the oldest (`"Made the update log scroll inside its panel."`) → still 10.

## CHANGELOG entry body (summary)
`## v1.7.0 — MINOR (2026-06-03)` — headline: *AniList enrichment for the legacy catalog.*
- **Visitor-facing:** community-score twin badge (`RATING · 8.5` / `ANILIST · 8.1`, gold vs purple, hidden when no score); More Info panel resolves by exact `Media(id:)` (v1.6.8 path auto-activated by the backfilled IDs).
- **Behind the scenes:** one-time `npm run backfill` populated 6 fields on the 44 reviews (40 matched / 4 skipped); idempotent, `--dry-run`/`--auto`, sequential queries, one-time backup, markdown report outside the deploy root. `IdMal` + `TitleRomaji` banked for later.
- **Implementation files** list: `anilist-backfill.js` (new ~290), `lib/excel-backup.js` (new), `sync-excel-to-js.js` (+8), `anilist-fetch.js` (+2), `package.json` (+1), `script.js` (~+18 twin badges), `style.css` (~+45).

## NEXT.md diff (summary)
- **Recently shipped:** new v1.7.0 bullet at top (backfill + twin badge + id-path activation; 40/44).
- **Immediate next ship:** was `v1.7.0 (AniList backfill)` → now **`v1.7.0-polish (widget version chips per <li>)`**, ~1-2h.
- **Phase B-side:** the v1.7.0 entry marked `✅ shipped 2026-06-03`; v1.7.0-polish + v1.7.1 unchanged in their slots.

## ROADMAP.md diff (summary)
- **Current state:** `Live at v1.6.12` → **`Live at v1.7.0`**; appended a v1.7.0 clause to the running ship narrative.
- **Shipped highlights:** new `- v1.7.0 (2026-06-03)` detail bullet before "Up next".
- **Up next:** rewritten `v1.7.0` → **`v1.7.0-polish (widget chips) → v1.7.1 (multi-fetch) → v1.7.2 (secondary modal)`**.

## Verify (all green)
- `bump-version.js --check` → **all 26 agree on v1.7.0**
- `grep -c v1.7.0` → CHANGELOG **4**, ROADMAP **8**, NEXT.md **8** (≥1 each ✓)
- Widget bullet = plain visitor copy, no class names/IDs ✓
- `npm test` → **7 passed (16.2s)**

## Anything unexpected
The ROADMAP "shipped highlights" list had no v1.6.12 detail bullet (gate 10 only updated the Current-state line), so I appended the v1.7.0 bullet at the end of that list (before "Up next") rather than "after v1.6.12's" — same outcome, just noting the prompt's anchor didn't exist. Nothing else.

## One-liner reply
v1.7.0 gate-5 docs cascade done (FAST-TRACK): bumped 1.6.12 → 1.7.0 (26/26 strings agree), prepended the v1.7.0 MINOR CHANGELOG entry (visitor: community-score twin badge + precise `Media(id:)` More Info lookups; behind-the-scenes: the `npm run backfill` one-time 6-field populate of the 44 legacy reviews, 40 matched/4 skipped, plus the new `anilist-backfill.js` + shared `lib/excel-backup.js`), added one visitor widget bullet in Blake's voice ("…now see the AniList community score right next to my rating…", no class names, cap held at 10 by dropping the oldest), moved v1.7.0 into NEXT.md Recently-shipped and promoted v1.7.0-polish (widget version chips) to Immediate-next, and rolled ROADMAP Current-state to Live at v1.7.0 with the "Up next" rewritten to v1.7.0-polish → v1.7.1 → v1.7.2; verified — 26 strings agree on v1.7.0, v1.7.0 present in all three docs, widget copy clean, `npm test` 7/7; one minor note (ROADMAP had no v1.6.12 detail bullet so the v1.7.0 highlight was appended to the list end); ready for gate 6 audits → gate 7 commit.
