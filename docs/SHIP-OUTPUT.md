<!-- author: Code | date: 2026-06-03 -->
# v1.7.3 — Gate 6 (audits — FAST-TRACK, PASS ✓ — caught + fixed a ship-blocker)

> Audit battery green AFTER fixing a **ship-blocking bug the audit caught**: the watched-set data was never reaching `animeData.js` (the headline feature would have shipped dead). Root cause + fix below. `npm test` re-passed 7/7 post-fix. Ready for gate 7.

## ⚠️ HEADLINE — caught + fixed: watched-set data wasn't in `animeData.js`
**The discipline paid off.** Cowork's gate-5 prompt asserted "backfill complete — `WatchedAniListIds` + `KnownAniListIds` populated across all 44 rows." I grep'd the real state instead of trusting it and found **`animeData.js` had 0 `WatchedAniListIds`** — so the `✓ REVIEWED` pill would have silently fallen back to primary-id-only (= v1.7.2 behavior), shipping the entire watched-set feature **non-functional**.

**Diagnosis (precise):**
- Excel: `WatchedAniListIds` + `KnownAniListIds` populated **44/44** (cols 20/21) — Blake's backfill DID run correctly.
- `animeData.js` was regenerated (59473 bytes, matching Cowork's claim) — but with **zero watched data**.
- **Root cause:** `scripts/sync-excel-to-js.js` *parses* the columns in `rowToAnime` (gate-1 work) but its hand-rolled **serializer** (`:457-458`) only emits explicitly-listed fields — and I never added the emit lines at gate 1. Parse ✓, serialize ✗ → data computed, never written. The backfill report showed Excel writes succeeding, which masked the sync-emit gap.

**Fix (2 lines, in-scope, per the gate-6 "fix the underlying cause and re-run" constraint):** added `WatchedAniListIds`/`KnownAniListIds` emit lines to the serializer (`renderArray`, numeric), re-ran `npm run sync`.
- **Verified:** `animeData.js` now has **44/44** watched arrays (numeric, e.g. `WatchedAniListIds: [101922,112151,...]`), 44/44 known, valid JS (`node --check`), 59473 → **63716 bytes**, unofficial still **0**. `npm test` → **7 passed** post-fix.

## Audit 1 — `npm test` ✓
**7 passed** (full set) — ran before the fix, and **re-ran after the re-sync** (production-facing `animeData.js` change) → still 7 passed.

## Audit 2 — `.gitignore` ↔ `firebase.json` mirror ✓
- **`.env`** (added this ship for the Anthropic key): in `.gitignore` (lines 72/94/95) AND firebase-ignored via `**/.*` (gate-3 confirmed, still holds). **Not tracked** by git. Key never commits/deploys.
- **New scripts** (`strip-unofficial.js`, `backfill-watched.js`) + `franchise-fetch.js`: **no secrets** (grep clean). `franchise-fetch.js` is a runtime file (deploys, no ignore). The two `scripts/*.js` deploy publicly per the pre-existing precedent — contain no secrets.
- **Rolling docs** (`HANDOFF`/`SHIP-*`/`COWORK-STYLE`/`CODE-HANDOFF`) still firebase-ignored — no leak-class regression.

## Audit 3 — `git diff --stat` scope ✓
Matches the expected shape: large `admin/new-anime.{html,js,css}` (watched tree + chatbot), `script.js` −205 (offset by the `franchise-fetch.js` extraction), `mode1-server.js` +95 (`/api/chat` + caching), `sync-excel-to-js.js` +25 (watched parse + **serialize fix** + unofficial whitelist), `animeData.js` 170 (watched/known arrays + unofficial strip), `index.html` 33 (script tag + widget restore + v1.7.3 bullets + bump), `admin-fab.css` 8 (bottom-left), CHANGELOG/ROADMAP/NEXT, version-bump-only HTML. **New untracked:** `franchise-fetch.js`, `scripts/strip-unofficial.js`, `scripts/backfill-watched.js`. **No unexpected files.** The 7 Cowork excludes (6 tracked: AI-PRIMER, CODE-PROMPTS, SKILLS×4 + untracked COWORK-STYLE) present → restore-staged at gate 7.

## Audit 4 — Smart-quote sweep ✓
**Clean.** Authoritative Grep-tool check = **0 curly quotes** in every touched code/HTML file (`admin/new-anime.{html,js,css}`, `mode1-server.js`, `franchise-fetch.js`, both CLIs, `index.html`). ⚠️ Note: bash `grep -lE "[“”]"` *false-flagged* all files — that's CODE-HANDOFF gotcha #9 (bash byte-vs-char on multibyte text); the ripgrep-backed Grep tool is authoritative and reports clean.

## Final summary
**Ready for gate 7.** All four audits pass. The one blocker (watched data absent from `animeData.js`) was caught in audit and fixed at the root (sync serializer) + re-verified end-to-end (44/44 in animeData, npm test 7/7). Without the grep-the-real-state check, v1.7.3's headline feature would have shipped dead.

## Phantom-drift audit
The "backfill done / populated" claim was **half-true** (Excel yes, animeData no) — surfaced + resolved. No other drift. `widget-update-skill.md` (Cowork exclude, 10-cap removed by Cowork) untouched by me.

## One-liner reply
v1.7.3 Gate 6 audits **pass — but caught a ship-blocker first**: grepping the real state (not trusting Cowork's "backfill populated" claim) revealed **`animeData.js` had 0 `WatchedAniListIds`** even though Excel was 44/44 populated — root cause was my gate-1 omission (the sync *parsed* the watched columns but the hand-rolled serializer never *emitted* them), so the `✓ REVIEWED` feature would've shipped non-functional (silent fallback to primary-id); fixed with 2 serializer lines, re-synced (animeData 59473→63716, **44/44** numeric watched arrays, unofficial still 0, valid JS), and **re-ran `npm test` → 7 passed**; the rest of the battery is green — `.env` gitignored+firebase-ignored (not tracked, no key leak), no secrets in the 3 new files, rolling docs still firebase-ignored, `git diff --stat` matches the expected scope with no unexpected files (3 new untracked + the 7 Cowork excludes to restore-stage at gate 7), and the smart-quote sweep is clean via the Grep tool (the bash `grep -l` that flagged everything is the known gotcha-9 byte-vs-char false positive); ready for gate 7 commit.
