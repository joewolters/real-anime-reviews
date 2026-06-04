<!-- author: Cowork | date: 2026-06-04 -->
# Session Handoff — v1.7.5 LIVE · v1.7.6 (account routing fix) next

> **v1.7.5 shipped 2026-06-04** (commit `b085ec1`). Watchlist + Favorites everywhere: secondary-modal save pills on any AniList entry via the `al:<aniListId>` discriminator schema (Code's gate-0 recommendation over Cowork's parallel-collections lean — zero Firestore rules change, zero new listeners), account-page rendering of non-catalog saves (instant paint from save-time snapshots) + green ✓ REVIEWED on catalog rows + the new in-site `#secondary=<aniListId>` route, per-episode in-row expand (thumbnail + equal-weight multi-platform official watch links), a WHERE TO WATCH section atop the secondary's side column, signed-out saves → branded sign-in modal (+ a real auth z-index bug found & fixed), `__underscore-bold__` in the shared markdown renderer, and a platforms backfill (`scripts/backfill-platforms.js`) that corrected 41/44 reviews' streaming listings from AniList (US 8-platform allowlist; Parasyte + Death Note got verified Crunchyroll adds; Boarding School Juliet correctly didn't; Miku → "Blu-ray only"). Blake's "ship it" honored at gate 9.

---

## Current production

**Live:** `realanimereviews.com` serving **v1.7.5** (commit `b085ec1`, deployed 2026-06-04). Preview channel + `origin/main` + prod all aligned. All leak checks 404 (incl. `COWORK-STYLE.md`, added to the check list this ship). `firestore.rules` untouched since v1.7.4.

---

## ⚡ For the next Cowork chat (session-start instructions)

**v1.7.5 closed cleanly. Next ship: v1.7.6 — account saved-entry routing fix** (Blake's gate-8 preview-smoke flag, logged in NEXT.md). No gate-0 prompt staged yet — stage it at next session start.

**Read order (per `docs/COWORK-STYLE.md`):** AI-PRIMER → this file → COWORK-STYLE → SHIP-OUTPUT (v1.7.5 gate 9 prod LIVE) → SHIP-PROMPT (holds the spent v1.7.5 gate 9 prompt — overwrite when staging v1.7.6 gate 0).

**The v1.7.6 fix (small, ~1-2h):** account rows saved via the secondary pills always route `#secondary=<id>`, even when that AniListId belongs to a reviewed franchise; Blake expects the primary modal with his review. Code's sketch (gate-9 report): `primarySlugForAniListId(id)` check in the account click handler → `#anime=<slug>` when it resolves, else `#secondary=<id>`. Helpers exist. Gate-0 recon should verify which saves actually collide before asserting.

## What this v1.7.5 session learned (carry-forward)

1. **Code keeps catching Cowork phantoms — verify-state discipline is load-bearing.** Three this ship: "(b) keeps rules simple" (gate 0 — re-derived to favor (a)), "catalog rows keep the green ✓" (gate 2 — no such affordance existed), "More Info panel + secondary episode rows" (gate 3 — the secondary had no episode list; the panel rows are BFS-fed renumbered labels). All surfaced loudly, none silently built.
2. **Blake's artifact cadence:** update `rar-ops` at session end only, not per gate (memory `feedback_artifact_update_cadence`).
3. **Dry-run-then-pause works for Excel-writing backfills** — the gate 3c/3d split (CLI + dry-run diff table + Blake's 4 decisions + live write) is the pattern for future data corrections.
4. **Crunchyroll-verification precedent:** when a platform mapping is uncertain, Code checks the actual catalog (real series pages) instead of assuming — Boarding School Juliet correctly excluded.
5. **Pill parity rule:** no platform gets privileged styling/ordering in visitor UI (Blake: "make sure crunchyroll isn't automatically highlighted").
6. **Compressed sweep again clean** (gates 4-7 in one prompt; the numbering drifted from the 12-gate model as usual — Code follows the file).

**Commit chain (recent):** `7364500` (v1.7.4) → **`b085ec1` (v1.7.5, HEAD, LIVE)**.

---

## Backlog top (see NEXT.md for full list)

- **v1.7.6 candidate — account saved-entry routing fix** (above).
- **v1.7.x/v1.8.x — Structured review template** (Blake's fixed sections: Intro/Animation/Story/Characters/Design/Music/Feel/Extra Thoughts/Overall). Cowork+Code brainstorm logged in NEXT.md — both lean: `## Heading` markdown convention + admin "Insert template" button + jump-pills/collapsible render + no forced migration of the 44.
- **v1.7.x/v1.8.x — Per-episode "full course"** (Blake-authored episode notes and/or richer source; extend expand to the More Info panel rows with canary care).
- **v1.7.x — Admin edit page** for existing reviews (pairs with both items above).
- **v1.8.0** AniList tab on cards · **v1.8.5** Community + Account UI/UX overhaul · **v1.9.0** mobile · **Phase D** Mode 2.

---

## Working tree state

- 7 Cowork-managed workflow docs still excluded from commits per Blake's standing call (`COWORK-STYLE.md` untracked; `AI-PRIMER`, `CODE-PROMPTS`, 4 SKILLS docs modified). Unchanged status, his call pending.
- Rolling docs: `CODE-HANDOFF.md` + `SHIP-OUTPUT.md` refreshed post-deploy, uncommitted (ride the next ship's docs commit, firebase-ignored).

## Process rules still apply

Rule #1 Excel canonical (the platforms backfill honored it — Excel written first, then sync) · #2 author markers · #5 deploy ladder · #7 `npm test` (now 8 specs) · #8 gitignore↔firebase mirror.

## Rolling files (current state)

- **`docs/SHIP-PROMPT.md`** — spent v1.7.5 gate 9 prompt. Overwrite when staging v1.7.6 gate 0.
- **`docs/SHIP-OUTPUT.md`** — Code's v1.7.5 gate 9 prod-deploy report (LIVE).
- **`docs/HANDOFF.md`** — this file, just rewritten (stale v1.7.2-era tail sections swept).
- **`docs/COWORK-STYLE.md`** — unchanged, still untracked.
