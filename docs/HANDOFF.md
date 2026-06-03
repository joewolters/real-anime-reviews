<!-- author: Cowork | date: 2026-06-03 -->
# Session Handoff — v1.6.12 shipped · v1.7.0 queued next

> **v1.6.12 closed 2026-06-03.** Two ships out the door this arc: v1.6.11 (Suggestion Box + admin viewer, the big visitor-facing feature) and v1.6.12 (admin queue iteration patch). Both live on `realanimereviews.com`. Next up is v1.7.0 — AniList backfill + MAL integration for the existing ~44 reviews.

---

## Current production

**Live:** `realanimereviews.com` serving **v1.6.12**. Commits: `aaa96f0` (v1.6.11 base), `5a5ab9b` (v1.6.11 state-clear hardening), `ce04594` (v1.6.12 apply), `05158e0` (v1.6.12 iteration 1), `244d22f` (v1.6.12 iteration 2 — `[hidden]` symmetry), `a8c60ac` (ROADMAP close-out). Blake verified prod clean at gate 11.

**Commit chain (recent):** `3539a06` (v1.6.10) → `aaa96f0` (v1.6.11) → `5a5ab9b` (v1.6.11 fix) → `ce04594` (v1.6.12) → `05158e0` (v1.6.12 iter 1) → `244d22f` (v1.6.12 iter 2) → `a8c60ac` (ROADMAP close-out, HEAD/live).

**v1.6.11 shipped scope** — Suggestion Box public form at `/suggest` with live AniList search-as-you-type dropdown (covers + format + year + keyboard nav), selection confirmation card with Ken Burns drift, premium-UI shell + glow + shimmer everywhere, homepage banner CTA at the bottom of the anime grid (sliding 2rem arrow + banner-scale shimmer sweep), admin Suggestions Queue at `/admin/suggestions` accessible from the floating Admin pill, Mode 1 handoff via `?suggest=<title>&anilistId=<id>` URL params (skips the typing + Fetch step), extended `firestore.rules` for the new optional fields (deployed globally), bidirectional transition-coordinated swap choreography on input ↔ selection card, reduced-motion fallbacks everywhere.

**v1.6.12 shipped scope** — Admin queue iteration patch: (1) `loadQueue()` clears stale empty/error cards before each fetch + `renderQueue()` belt-and-suspenders hides error on every success branch; (2) custom branded delete confirmation modal (🗑️ + `DELETE SUGGESTION 削除` kicker, layered gradient card, focus trap, Escape/backdrop cancel) replacing native `confirm()`; (3) NEW / REVIEWED moved to side-by-side `1fr 1fr` CSS-Grid columns (stack at 768px) with inline `Nothing yet` / `Nothing reviewed yet` placeholders, Mark Reviewed reworked from horizontal slide to fade+scale; (4) `[hidden]` symmetry fix on `.suggestions-empty-card` / `.suggestions-error-card` / `.admin-main` (the real reason the cards were sticking around); plus DM-style admin↔visitor inbox feature documented for v1.8.x in NEXT.md + ROADMAP.md (auth prereq: capture visitor identity at submission time).

---

## Gate structure — LOCKED 12-gate ship (effective v1.6.11+, validated through v1.6.12)

| # | Gate | Owner | Tier |
|---|------|-------|------|
| 0 | Recon + propose plan | Code → Blake approves | PROPOSE-FIRST |
| 1 | Build core feature | Code → Blake approves | PROPOSE-FIRST |
| 2 | Build supporting features | Code → Blake approves | PROPOSE-FIRST |
| 3 | Reserved for iteration / fixes | Code → Blake approves | PROPOSE-FIRST |
| 4 | Local browser smoke | Blake | — |
| 5 | Docs cascade (CHANGELOG + widget bullet + version bump + NEXT.md + ROADMAP, one Code prompt with sub-step checklist) | Code | FAST-TRACK |
| 6 | Audits (`npm test` 7/7 + `firebase.json` ↔ `.gitignore` mirror + `git diff` review) | Code | FAST-TRACK |
| 7 | Commit + push | Code | FAST-TRACK |
| 8 | Preview deploy (`firebase hosting:channel:deploy preview-v1-6-X` + `firebase deploy --only firestore:rules` IF rules touched) | Code | FAST-TRACK |
| 9 | Preview smoke | Blake | — |
| 10 | Production deploy (`firebase deploy --only hosting`) on Blake's "ship it" | Code | FAST-TRACK |
| 11 | Production verify | Blake | — |

Sub-gates (`1b` / `2b` / `3b` / `3c` / `3d` / `3e` / `3f` / `3g` etc.) reserved for iteration when smoke or build finds bugs. v1.6.11 used 3b–3g, v1.6.12 used two named iteration rounds — pattern works.

**Integrity boundary:** Gate 6 (audits) ≠ Gate 7 (commit) ≠ Gate 8 (preview deploy) ≠ Gate 9 (preview smoke) ≠ Gate 10 (prod deploy) ≠ Gate 11 (prod verify). If `npm test` fails at gate 6, nothing has been committed yet → Code fixes the underlying code, retries audit → commits clean. Never half-state.

**Compressed apply for iteration rounds:** sub-iterations (3g-commit+redeploy / v1.6.12 iter 1 / iter 2) successfully bundled apply + test + commit + push + preview-redeploy into a single fast-track sweep for small fixes (<50 lines, no breaking changes). The 12-gate integrity boundaries still hold; the bundling just collapses the typing in chat.

**Round-trip math:** v1.6.11 took ~8 Code prompts main path + 6 iteration rounds = ~14 events; v1.6.12 took ~5 Code prompts main path + 2 iteration rounds = ~7 events. Iteration rounds are where the volume lives — diagnosing first then applying second is faster than guessing.

---

## In flight

**None.** v1.6.12 closed cleanly. Working tree state below documents the holdover Cowork docs.

---

## Working tree state (post-v1.6.12 ship close)

7 Cowork-managed docs are still in the working tree, intentionally excluded from every v1.6.11 + v1.6.12 commit per Blake's explicit call:

- `docs/COWORK-STYLE.md` (untracked)
- `docs/AI-PRIMER.md` (modified)
- `docs/CODE-PROMPTS.md` (modified)
- `docs/SKILLS/README.md` (modified)
- `docs/SKILLS/hotfix-skill.md` (modified)
- `docs/SKILLS/release-skill.md` (modified)
- `docs/SKILLS/widget-update-skill.md` (modified)

Plus the rolling SHIP-PROMPT.md + SHIP-OUTPUT.md state per gate.

**Two of these (`docs/CODE-HANDOFF.md` + `docs/COWORK-STYLE.md`) were added to `firebase.json` ignore during v1.6.12 apply** — Code caught they were not in the ignore list and would have publicly deployed. Verified 404 on prod post-ship. Blake hasn't yet ratified whether to commit them (with the ignore protecting against deploy) OR revert them entirely. Status: deferred — Blake's call when he wants to handle.

---

## Phase B continued — consolidated v1.7.x plan

- **v1.7.0 — AniList backfill + MAL integration** (NEXT). Populate `AniListId` / `IdMal` / `AniListScore` / `AniListColor` for the existing ~44 reviews via Mode 1's pipeline. Excel + animeData.js both updated. Once shipped, every modal fetch can use the precise `Media(id:)` lookup instead of the popularity-sorted `Page(media:)` search. ~3 hours.
- **v1.7.1 — Multi-fetch + multi-hop revival.** Closes v1.6.10's architectural debt via `Promise.all` parallel fetches. Multi-hop traversal + franchise-episode aggregation. ~4-5 hours.
- **v1.7.2 — In-site secondary modal.** Built on v1.7.1's data layer. Replaces v1.6.8's "open AniList in new tab" with in-site experience + watchlist + "Not Reviewed yet" treatment. ~5-6 hours.
- **v1.7.x polish slots** — Romaji subtitle on cards, AniList per-episode scores feasibility.

**v1.8.x queue:**
- **v1.8.0 — AniList tab on cards.**
- **v1.8.x — Suggestion DM Inbox** (new — added at v1.6.12 close). Admin replies directly to suggestion submitters; visitor gets an Inbox UI. Auth prereq: capture visitor identity (email or anon Firebase Auth UID) at submission time, requires schema change on `suggestions` docs.

**Phase C+:** v1.9.0 mobile compatibility overhaul.

**Phase D — Mode 2** (autonomous caretaker, gated on Mode 1 in active use + v1.7.0 backfill complete).

---

## Lessons learned (carry forward)

1. **Tiered gates** — propose-then-apply for big code/design gates only; fast-track docs cascade / audits / commit / deploys. (`feedback_gate_tiering.md`)
2. **Code runs deploys** — `firebase hosting:channel:deploy` (gate 8) + `firebase deploy --only hosting` (gate 10) are Code's job. Blake does gate 4 (local smoke), gate 9 (preview smoke), gate 11 (prod verify). (`feedback_deploy_ownership.md`)
3. **Lean prompts for fast-track gates** — under ~30 lines. Trust Code's accumulated discipline. (`feedback_lean_prompts.md`)
4. **`[hidden]` attribute symmetry** — every element with non-none `display` that gets `hidden`-toggled needs an explicit `[hidden] { display: none; }` rule. Bug class has bitten 3+ times (gate 3g + v1.6.12 iteration 2 each closed sets of missing rules). NOW a hard-coded check in Cowork prompts for new UI elements. (`feedback_hidden_attribute_symmetry.md`)
5. **Custom branded modals only** — never `confirm()` / `alert()` / `prompt()` in any UI Blake or visitors see. (`feedback_no_native_dialogs.md`)
6. **No AniList branding in visitor UI** — error copy, loading states, attribution all use generic phrasing. Admin UI is exempt. (`feedback_no_anilist_in_visitor_ui.md`)
7. **Catch-branch element IDs need to be updated when elements get split/renamed** — v1.6.12 iter 1 caught the dead `#suggestions-list` reference in `loadQueue()`'s catch (renamed to `-new` / `-reviewed` at gate 0 but the catch was missed). Refactor → grep for the old ID everywhere it could be referenced, not just the success path.
8. **Premium UI floor on EVERY new element** — gradient + Bebas/Montserrat/Outfit + JP kicker + hover states by default; "minimum CSS to function" is unacceptable starting point. (`feedback_ui_polish_default.md`)
9. **Code has creative latitude on design** — propose techniques/effects beyond the literal prompt scope; PROPOSE-FIRST is the safety net. (`feedback_creative_latitude.md`)
10. **AniList query complexity has a budget** — v1.6.10 gate 2's nested-relations mega-query exceeded it. v1.7.1's `Promise.all` parallel approach is the architectural workaround.
11. **Don't ship features blocked on upstream APIs.** v1.6.10's franchise-episode aggregation got cut; moved to v1.7.1.
12. **Blake's review model — one review per franchise**, not per season. Will continue to shape v1.7.1's multi-hop traversal.
13. **Revert paths via `git show <commit>:<file>`** — v1.6.10 gate 2b precedent.
14. **Firestore rules deploy globally per-project** — no preview channel. v1.6.11 gate 8 + v1.6.12 (no rules touched) both confirmed safe widening doesn't break anything when admin UID-locked.
15. **Audit ≠ commit ≠ deploy** — v1.6.10 integrity lesson. Keep separate as a discipline; compressed bundling still respects the boundary even when collapsed for typing.
16. **Workflow-doc deploy leak class** — Code caught at v1.6.12 that internal workflow docs (`docs/CODE-HANDOFF.md`, `docs/COWORK-STYLE.md`) were not in `firebase.json` ignore and would have deployed publicly. Added to ignore (safe-direction action), verified 404 on prod. Same precedent class as PERSONAL.md v1.3.5 and AUDIT_*.md v1.3.9. **Pattern:** when adding any new doc, audit firebase.json ignore symmetry before deploy.

---

## Process rules still apply

- Rule #1 (Excel canonical) — v1.7.0 will write back to Excel via Mode 1's pipeline for the ~44 backfilled reviews.
- Rule #2 (author markers) — CHANGELOG + meaningful doc edits.
- Rule #5 (deploy ladder) — local (gate 4) → preview (gates 8-9) → production (gates 10-11).
- Rule #7 (`npm test` 7/7 — at gate 6). v1.6.11 added Suggestion Box Playwright tests; v1.7.0 should add backfill tests.
- Rule #8 (`.gitignore` ↔ `firebase.json` mirror — at gate 6). Now also: audit new docs against firebase.json ignore before deploy (per Lesson 16).

---

## Rolling files (post-v1.6.12 close)

- `docs/SHIP-PROMPT.md` — currently holds the v1.6.12 gate 10 prompt. Will be overwritten when v1.7.0 gate 0 stages.
- `docs/SHIP-OUTPUT.md` — currently holds the v1.6.12 gate 10 + close-out report. Will be overwritten per gate.
- `docs/HANDOFF.md` — this file. Just updated.
- `docs/COWORK-STYLE.md` — persistent style guide, still untracked per Blake's call.

The 3 SHIP-* / HANDOFF docs are firebase-ignored via the explicit + glob ignore patterns. They roll into the next ship's gate-7 commit.

---

## What the next chat does first (if session pauses)

1. **Read `docs/AI-PRIMER.md`** for project orientation.
2. **Read this HANDOFF.md end-to-end** for full state.
3. **Read `docs/COWORK-STYLE.md`** for tone + conventions.
4. **Read `docs/SHIP-OUTPUT.md`** for Code's latest output (v1.6.12 gate 10 + close-out).
5. **Read `docs/SHIP-PROMPT.md`** — confirms it holds the v1.6.12 gate 10 prompt (no new ship started yet).
6. **Tell Blake:** *"v1.6.12 is shipped + verified. v1.7.0 (AniList backfill + MAL integration, ~3 hours) is queued next per NEXT.md. Want to start v1.7.0, or pause?"*
7. If Blake wants to start v1.7.0: stage a propose-first gate 0 prompt covering the recon + plan for the backfill pipeline.

---

## State summary

- **Production:** v1.6.12 live, commit `a8c60ac` (with the v1.6.12 code at `244d22f`). Blake verified clean at gate 11.
- **In flight:** None. v1.6.12 ship is complete.
- **Working tree:** 7 Cowork docs holdover (Blake-excluded) + the rolling SHIP-* files. Two firebase.json ignore entries added at v1.6.12 protecting against future leak.
- **Open architecture decisions:** None remaining for v1.6.x. v1.7.0 will introduce the backfill pipeline shape — recon happens at gate 0 when Blake's ready.
- **Next move:** Blake's call — start v1.7.0 (AniList backfill + MAL integration, ~3 hours) or pause.
