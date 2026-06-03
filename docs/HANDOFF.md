<!-- author: Cowork | date: 2026-06-02 -->
# Session Handoff — v1.6.10 shipped · v1.6.11 in flight at gate 1b done

> **v1.6.10 closed at 2026-06-02.** Three polish wins live in prod. v1.6.11 (Suggestion Box + admin viewer) is mid-flight — gate 0 (recon) + gate 1b (public form + Firestore rules merge) both done. Gate 2 (admin viewer) is next.

---

## Current production

**Live:** `realanimereviews.com` serving v1.6.10. Commit `3539a06`. Blake verified prod clean.

**Commit chain (recent):** `4274293` (v1.6.7) → `601570f` (v1.6.8) → `7f4fe42` (v1.6.9) → `3539a06` (v1.6.10, live).

**v1.6.10 shipped scope (3 items):**
1. Per-row studio dedupe (`Array.from(new Set(...))` in both `renderMoreInfoEntry` + admin's `renderFranchisePanel`) — closes Frieren `MADHOUSE, MADHOUSE`.
2. Format pill inline on each franchise relation row (`TV` / `MOVIE` / `OVA` / `ONA` / `SPECIAL`) — reuses v1.6.9's `.more-info-rec-format-badge` class with inline `position: static` override.
3. STAFF cluster fallback cap 4 → 6.

**v1.6.10 cut (moved to v1.7.1):** Multi-hop franchise traversal + franchise-episode aggregation. Both required a nested-relations GraphQL shape that AniList returned 500 errors for on relation-heavy nodes (Demon Slayer-class). N+1 parallel-fetch redesign delivers both in v1.7.1.

---

## Gate structure — LOCKED 12-gate ship (effective v1.6.11+)

Replaces the old 16-gate sequence (gates 6-9's sequential CHANGELOG / widget / version / cascade prompts were ~4 wasted round-trips). Replaces the other Cowork chat's 9-gate proposal (which bundled audits with commit — broke the v1.6.10 integrity-boundary lesson).

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

Sub-gates (`1b` / `2b` / `3b` etc.) reserved for iteration when smoke or build finds bugs (precedent: v1.6.10 gate 2b reverted gate 2's multi-hop).

**Non-mergeable boundaries** (each step is its own pause): Gate 6 (audits) ≠ Gate 7 (commit) ≠ Gate 8 (preview deploy) ≠ Gate 9 (preview smoke) ≠ Gate 10 (prod deploy) ≠ Gate 11 (prod verify). The audit/commit boundary specifically — if `npm test` fails at gate 6, nothing has been committed yet → Code fixes the underlying code, retries audit → commits clean. Never half-state.

**Round-trip math:** ~8 Code prompts + ~3 Blake browser tasks = ~11 total events per ship (vs the old 16 = ~13 Code prompts).

### v1.6.11 might use a firestore:rules sub-step at gates 8 + 10

If a ship touches `firestore.rules` (v1.6.11 does): gate 8 (preview deploy) AND gate 10 (prod deploy) each gain a `firebase deploy --only firestore:rules` sub-step. Firestore rules are global per-project (no preview channel), so the rules deploy at gate 8 has immediate prod effect. Code should flag this clearly so Blake isn't surprised.

---

## In flight — v1.6.11 — Suggestion Box + admin viewer

**Gate 0 (recon + propose) — DONE.** Full recon in earlier `docs/SHIP-OUTPUT.md`. Scope decisions locked: Option B (`/suggest.html`), in-repo Firestore rules, client-side spam protection (honeypot + sessionStorage rate-limit).

**Gate 1b (public form + Firestore storage) — DONE.** 5 new files + 4 file extensions applied:
- `firestore.rules` (207 lines) — Console-merged ruleset (users/comments/reviews/official preserved verbatim from Blake's Console export, PLUS new `suggestions` block at lines 199-213 — anyone can create, ADMIN_UID-only read/list/update/delete).
- `firestore.indexes.json` (4 lines) — placeholder.
- `suggest.html` (73 lines), `suggest.js` (80 lines), `suggest.css` (59 lines) — public form page.
- `firebase.json` (+4) — `firestore` block added.
- `index.html` (+7) — CTA `"Didn't find what you were looking for? Suggest one →"` at bottom of `#all-anime-view` section.
- `style.css` (+18) — CTA styling.
- `scripts/bump-version.js` (+25) — 4 new `suggest.html` cache-bust targets (14 → 18, all at v1.6.10).

`node --check` clean on both edited JS files. No stop conditions hit.

**Gate 2 (admin viewer) — NEXT.** Mirror of suggest page but admin-side:
- `admin/suggestions.html` (NEW) — admin-gated shell mirroring `admin/new-anime.html`'s auth pattern (`<div id="admin-gate">` + `<main id="admin-main" hidden>`).
- `admin/suggestions.js` (NEW) — `ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1'` + `onAuthStateChanged` + redirect-on-non-admin; queries `collection(db, 'suggestions')` ordered by `submittedAt desc`; per-row Add/Mark-reviewed/Delete buttons.
- `admin/suggestions.css` (NEW) — queue row styling.
- `admin/new-anime.js` extension — read `?suggest=<title>` URLSearchParam at page-init, prefill `#title-input` (~5 lines added at the existing `URLSearchParams` plumbing line ~845).
- `scripts/bump-version.js` extension — add `admin/suggestions.html` to TARGETS.

Estimated ~30-40 min for gate 2 propose + apply.

---

## After v1.6.11 — consolidated v1.7 plan

- **v1.7.0 — AniList backfill + MAL integration.** Populate `AniListId` / `IdMal` / `AniListScore` / `AniListColor` for the existing ~44 reviews. ~3 hours.
- **v1.7.1 — Multi-fetch + multi-hop revival.** Closes v1.6.10's architectural debt via `Promise.all` parallel fetches. Multi-hop traversal + franchise-episode aggregation. ~4-5 hours.
- **v1.7.2 — In-site secondary modal.** Built on v1.7.1's data layer. Replaces v1.6.8's "open AniList in new tab" with in-site experience + watchlist + "Not Reviewed yet" treatment. ~5-6 hours.
- **v1.7.x polish slots** — Romaji subtitle on cards, AniList per-episode scores feasibility.
- **v1.6.x polish queue** — More Info panel polish bundle, Widget version-chip per `<li>`.

**Phase C+:** v1.8.0 (AniList tab on cards), v1.9.0 (mobile compatibility overhaul).

**Phase D — Mode 2** (autonomous caretaker, gated on Mode 1 in active use + v1.7.0 backfill complete).

---

## Lessons learned (carry forward)

1. **Tiered gates** — propose-then-apply for big code/design gates only; fast-track docs cascade / audits / commit / deploys. (`feedback_gate_tiering.md`)
2. **Code runs deploys** — `firebase hosting:channel:deploy` (gate 8) + `firebase deploy --only hosting` (gate 10) are Code's job. Blake does gate 4 (local smoke), gate 9 (preview smoke), gate 11 (prod verify). (`feedback_deploy_ownership.md`)
3. **Lean prompts for fast-track gates** — under ~30 lines. Trust Code's accumulated discipline. (`feedback_lean_prompts.md`)
4. **AniList query complexity has a budget** — v1.6.10 gate 2's nested-relations mega-query exceeded it on relation-heavy Media. Verify complexity on heaviest cases (Demon Slayer-class) before locking architecture.
5. **Don't ship features blocked on upstream APIs.** v1.6.10's franchise-episode aggregation and multi-hop both got cut; moved to v1.7.1.
6. **Blake's review model — one review per franchise**, not per season. Drove v1.6.8's universal AniList click-through and v1.6.9's source-Media-only aggregation. Will shape v1.7.1's multi-hop traversal too.
7. **Revert paths via `git show <commit>:<file>`** — v1.6.10 gate 2b restored gate-2's hybrid traversal byte-for-byte from commit `7f4fe42`. Pattern: pull target state from the named v1.6.X commit, write surgical Edits restoring each affected function/query/warning block; gate-3 + gate-4 changes that live in different code regions ride through untouched.
8. **Firestore rules deploy globally per-project** — there's no "preview channel" for rules. If a ship touches `firestore.rules`, gate 8 (preview deploy) has immediate prod effect on rules. Code flags this clearly. Pattern from v1.6.11 gate 1b: download Console rules first, merge with new collection block, deploy verbatim.
9. **Audit ≠ commit ≠ deploy** — the v1.6.10 integrity lesson. Bundle docs cascade (gate 5), but keep audits (6), commit (7), preview deploy (8), preview smoke (9), prod deploy (10), prod verify (11) all as separate gates.

---

## Process rules still apply

- Rule #1 (Excel canonical) — v1.6.11 adds `suggestions` Firestore collection but no new Excel columns.
- Rule #2 (author markers) — CHANGELOG + meaningful doc edits.
- Rule #5 (deploy ladder) — local (gate 4) → preview (gates 8-9) → production (gates 10-11).
- Rule #7 (`npm test` 7/7 — at gate 6). v1.6.11 should add a Playwright test for `/suggest` form path.
- Rule #8 (`.gitignore` ↔ `firebase.json` mirror — at gate 6). `firestore.rules` + `firestore.indexes.json` are NOT sensitive (encode public security boundaries) — deployed to Firebase, NOT firebase-ignored.

---

## Rolling files (current state)

- `docs/SHIP-PROMPT.md` — **currently the gate 2 (admin viewer) PROPOSE-FIRST prompt, READY for Code.** Replaced gate 1b at session pause 2026-06-02.
- `docs/SHIP-OUTPUT.md` — gate 1b apply report from Code (still the latest output; gate 2 hasn't run yet).
- `docs/HANDOFF.md` — this file. Updated at session pause OR ship close.
- `docs/COWORK-STYLE.md` — **NEW 2026-06-02.** Session-style bridge: tone, conventions, the 12-gate model, Blake's one-liners. Read on every fresh Cowork chat AFTER `AI-PRIMER.md` + this file.

The 3 SHIP-* / HANDOFF docs are firebase-ignored via `docs/SHIP-*.md` glob + explicit `docs/HANDOFF.md`. `COWORK-STYLE.md` is committed + deployed normally (it's a persistent style guide, not session-rolling state). All roll into v1.6.11's gate 7 commit.

---

## What the next chat does first (if session pauses)

1. **Read `docs/AI-PRIMER.md`** for project orientation.
2. **Read this HANDOFF.md end-to-end** for full state.
3. **Read `docs/COWORK-STYLE.md`** for tone + conventions (NEW — read this so the new chat acts like the prior one).
4. **Read `docs/SHIP-OUTPUT.md`** for Code's latest output (gate 1b apply report).
5. **Read `docs/SHIP-PROMPT.md`** — confirm it holds the gate 2 PROPOSE-FIRST prompt (it does, staged at session pause).
6. **Tell Blake:** *"The gate 2 prompt is ready in `docs/SHIP-PROMPT.md`. Paste this into Code: `Read docs/SHIP-PROMPT.md and follow the gate 2 propose-first instructions.`"*
7. Wait for Blake to come back with Code's report (he'll say `report`).

---

## State summary

- **Production:** v1.6.10 live, commit `3539a06`. Blake verified.
- **In flight:** v1.6.11, gate 1b done. **Gate 2 (admin viewer) PROMPT STAGED, waiting for Code to run it.**
- **Working tree:** 4 modified files (`firebase.json`, `index.html`, `scripts/bump-version.js`, `style.css`) + 5 new files (`firestore.rules`, `firestore.indexes.json`, `suggest.html`, `suggest.js`, `suggest.css`) — staged for gate 7 commit, awaiting gates 2-6 to add to the bundle.
- **Open architecture decisions:** None remaining. Gate 0's Q1/Q2/Q3 all answered. Gate 2's admin viewer specced. The 4 open questions in the gate 2 prompt are surface-level (copy, dim-vs-toggle, timestamp format) — Code's report will land them with recommendations.
- **Next move:** Blake pastes the kickoff command into a fresh Cowork chat → that chat tells Blake to paste the gate 2 command into Code → Code reports → Blake approves → Cowork writes gate 2b to apply.
