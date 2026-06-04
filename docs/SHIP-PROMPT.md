<!-- author: Cowork | date: 2026-06-04 -->
# v1.8.0 — Compressed sweep (docs cascade + audits + commit + preview — FAST-TRACK)

Blake's verdict on gate 1b: feels marginally better at best, no visual complaints (frost not missed, scrollbars good). His call: **ship v1.8.0 as-is, ASAP, and move on.** The gate-1b stop-condition (read what the profiler says is left) is overridden by Blake's explicit close-out — the remaining perf levers move to backlog, not built now. Version → **1.8.0**.

## Gate: docs cascade
1. **CHANGELOG.md** v1.8.0 entry — honest framing: blur architecture removed (universal repaint-tax elimination, mechanism-level win), lighter frost radius → static premium dim, branded purple scrollbars site-wide, trailer-iframe console-warning fix, Firefox/cross-engine perf investigation documented (G0 profiling + the headless-can't-measure finding).
2. **Widget bullets** — visitor-first and DON'T overstate the speed win (Blake felt marginal change). Good angles: the new purple scrollbars, behind-the-scenes work to make the site run lighter in more browsers. No "blazing fast" claims.
3. `node scripts/bump-version.js 1.8.0` + `--check` (33 expected).
4. **NEXT.md + ROADMAP.md:**
   - Mark v1.8.0 shipped (scope: what actually landed — G1+G1b+scrollbars+console fix).
   - **New backlog entry: "Smoothness round 2 (v1.8.x candidate)"** — the un-built measured levers: G3 render-on-navigate caching (innerHTML rebuild + image re-decode), G4 Firebase SDK defer (~600KB eager on every page, the biggest universal first-load win), image right-sizing (extraLarge→large), G5 perf-regression guard, minify-last (esbuild, the Mode 1 wiring plan from gate 0). Note Blake's verdict ("felt the same after blur removal") + that these are measured, not speculative.
   - The roadmap ladder otherwise unchanged (next: v1.8.1 admin edit page).

## Gate: audits
`npm test` (8) · `.gitignore` ↔ `firebase.json` mirror · `git diff` review · smart-quote sweep (Grep tool) · confirm `firestore.rules` untouched.

## Gate: commit + push
Blake-authored, no AI trailers, 7 Cowork excludes out, rolling docs ride in.

## Gate: preview deploy
Channel deploy. Post-deploy: `APP_VERSION 1.8.0`, leak checks 404, scrollbar CSS + dim present on-channel.

## Report shape
Standard sweep report: per-gate results, bullets as written, commit hash, preview URL + checks. Then Blake's preview smoke → "ship it" → prod.
