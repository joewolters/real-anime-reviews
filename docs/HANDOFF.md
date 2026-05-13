<!-- author: Cowork | date: 2026-05-12 -->
# Session Handoff — pick up here in the new chat (2026-05-13 morning)

> **Purpose:** Blake closed the previous session after shipping v1.6.7 and locked tomorrow's full-day plan (three chained ships: v1.6.8 → v1.6.9 → v1.6.10). This file captures the plan + scope decisions so a fresh chat can resume execution without re-scoping.

---

## TL;DR for the new chat

**Three ships planned for today (2026-05-13):**

1. **v1.6.8 — More Info panel (Path B+)** — visitor-facing relations panel on the public anime modal. ~3-4 hours, ~10-12 gates.
2. **v1.6.9 — Richer modal data** — per-episode names/counts + recommendations + staff credits. ~3-4 hours, ~10-12 gates.
3. **v1.6.10 — Multi-hop franchise polish + per-entry dedupe** — closes the two v1.6.7 known limitations (OPM S3 missing, MADHOUSE/MADHOUSE dupe). ~2 hours, ~6-8 gates.

**Scope is locked for all three.** Blake confirmed every decision point on 2026-05-12 before going to bed. Don't re-scope; execute.

**Starting state:** `docs/SHIP-PROMPT.md` is pre-staged for v1.6.8 gate 0 (Code's reconnaissance + propose-gate-plan pass). Blake's first action of the morning is sending Code the one-liner *"read docs/SHIP-PROMPT.md and proceed."* Code probes the relevant files + AniList, writes a gate plan proposal to `docs/SHIP-OUTPUT.md`, and Blake brings the proposal to Cowork (the new chat) for gate 1 lock-in.

---

## Today's plan — full detail

### Ship 1 — v1.6.8 — More Info panel (Path B+)

**Visitor-facing.** Left-side full-height panel on the public anime modal that surfaces franchise relations to site visitors when they click any anime card. Mirror of v1.6.7's admin-form FRANCHISE INFO panel, but richer rendering (cover images + click-through + romaji subtitle) because the modal has more space than the admin form's compact sidebar.

**Scope decisions locked by Blake (2026-05-12):**
- **Path B+ confirmed** — relations only, no per-episode/MAL features in this ship.
- **Location:** left side of the existing anime detail modal/page. The Community Tab is on the right; More Info panel mirrors it on the left. Full-height vertical layout (Community Tab is small; More Info can fill out the available space).
- **Per-entry rendering:** card-style row with cover image thumbnail (AniList `coverImage.medium`), relation badge (PREQUEL / PARENT / MAIN / SEQUEL — same filter set as v1.6.7), English title + smaller romaji subtitle line underneath (free v1.7.x romaji feature groundwork), year + episode count + animation studio(s), AniList `averageScore` as a small badge.
- **Sort order:** same as v1.6.7 — chronological by year, with `TYPE_ORDER` tiebreaker (PREQUEL < PARENT < MAIN < SEQUEL) for same-year ties.
- **Click-through:** if a related entry already exists in the site's catalog, the card is clickable and opens that anime's own modal. Greyed-out / non-clickable if not in catalog. Detection logic: check related entry's AniList ID against `animeData.js` — falls back to title-match if `AniListId` field isn't populated for an existing anime (v1.7.0 backfill hasn't run yet, so coverage is currently small).
- **What's NOT in v1.6.8:** per-episode names/counts/scores, MAL data, recommendations, staff credits, "other AniList metadata."

**Out-of-scope reminders:** No new GraphQL fields beyond v1.6.7's `relations` block (the cover image URLs are already returned via `relations.edges.node.coverImage`). No data migration. No Excel column changes.

**Estimated:** 3-4 hours, ~10-12 gates. Lighter than v1.6.7 because the data-shape work and the aggregation logic are already done.

### Ship 2 — v1.6.9 — Richer modal data

**Visitor-facing.** Three new data clusters on the More Info panel from v1.6.8:

1. **Per-episode names + counts** — uses AniList's `streamingEpisodes` field. Coverage isn't 100% (some anime have it, some don't — handle gracefully). For long-running shows (One Piece, Naruto, Detective Conan), wrap the list in collapsible "show more" UX so the panel doesn't blow out vertically. Render below the relations cluster on the More Info panel.
2. **Recommendations** — AniList's `recommendations` field returns "people who liked X also liked..." anime. Visitor-meaningful sidebar. Show 3-5 recommended anime with cover images + titles. Click-through pattern matches v1.6.8's relation click-through (in-catalog clickable, not-in-catalog greyed).
3. **Staff credits** — AniList's `staff` field returns director, composer, writer, etc. Show the key 4-6 roles (director, series composition, music, character design) — not the full staff list which gets unwieldy. Each name optionally clickable to a TBD staff page (defer the staff-page itself; just non-clickable text in v1.6.9 is fine).

**What's NOT in v1.6.9:** AniList per-episode scores (feasibility uncertain — needs validation against AniList schema; defer to v1.7.x or split-out ship). MAL integration.

**Estimated:** 3-4 hours, ~10-12 gates. Three data clusters means three sub-features in one ship — propose-then-apply discipline matters more here than in v1.6.8.

### Ship 3 — v1.6.10 — Multi-hop franchise polish + per-entry dedupe

**Admin-side, invisible to visitors but closes the two v1.6.7 known limitations honestly.**

1. **Multi-hop traversal.** Extend `aggregateFranchise()` in `admin/new-anime.js` to recurse one level past the initial fetch's direct relations. Add a depth limit (max 2 hops) to prevent infinite loops. Canonical case to verify: fetching One Punch Man Season 1 should now also catch Season 3 (currently missing because AniList stores S3 as SEQUEL of S2).
2. **Per-entry studio dedupe** — one-line fix (`Array.from(new Set(...))` in `renderFranchisePanel`) to suppress `MADHOUSE, MADHOUSE` and similar AniList double-credits.

**Bonus tightening (Cowork's suggestion, defer-able):** the "3 seasons" overcounting issue where OPM's PREQUEL OVA gets counted as a season. Could refine the season count to only include TV-format entries (`format: 'TV'` filter). Discuss at gate 0/1.

**Estimated:** 2 hours, ~6-8 gates. Short ship, high confidence, satisfying loop-closure.

---

## Cascade through v1.6.11+ (post-tomorrow)

Each tomorrow ship cascades the existing v1.6.x slots back by one:

- **v1.6.11** — Suggestion Box + admin viewer (cascaded from v1.6.9 → v1.6.11 via two tomorrow ships)
- **v1.6.x slots** — Clickable live preview opens modal, real one-click AI integration via Cloud Function, one-click full automation (unchanged from v1.6.7's NEXT.md state)
- **v1.7.0** — AniList backfill for existing ~44 anime + MAL integration paired (MAL is the right home here per v1.6.7 cascade)
- **v1.7.x** — AniList per-episode scores feasibility check (if confirmed available in schema, ship the render; if not, mark deferred-indefinitely)
- **v1.8.0** — AniList tab on cards (verified-source at-a-glance data)
- **v1.9.0** — Mobile compatibility overhaul

---

## Current state at session end (end of 2026-05-12)

### Production
- **Live:** `realanimereviews.com` serving v1.6.7
- **Commit:** `4274293` on `main`
- **Preview channel:** `https://real-anime-reviews--preview-v1-6-7-et0ehz3m.web.app` (auto-expires 2026-05-19, no cleanup needed)

### v1.6.7 in one sentence
The admin form aggregates AniList `relations` so fetching a multi-season anime (e.g. One Punch Man) pulls Season 1 + Season 2 + Road to Hero in one go and prefills franchise-aware Seasons/Studio fields plus a FRANCHISE INFO panel; new amber `'warn'` status-kind for the PREQUEL heads-up; single-hop scope.

### Known limitations carried forward (will be closed in v1.6.10)
1. **Single-hop traversal** — OPM Season 3 doesn't appear when fetching Season 1.
2. **`MADHOUSE, MADHOUSE` per-entry duplicate** — Frieren S2 row shows the studio twice.
3. **All-caps studio names preserved** — intentional, no change planned.

### Working tree at session end
- 2 rolling `docs/SHIP-*.md` modifications (this HANDOFF.md update + the pre-staged v1.6.8 gate 0 SHIP-PROMPT.md). Firebase-ignored. Will roll into v1.6.8's first commit.

---

## What the new chat does first

1. **Read this HANDOFF.md end-to-end.** Internalize the three-ship plan + scope locks.
2. **Read `docs/SHIP-PROMPT.md`.** It's pre-staged for v1.6.8 gate 0 (Code's recon prompt). Cowork's job at the start of the new chat is to verify the prompt still makes sense after a fresh read.
3. **Tell Blake the one-liner to send Code:** `read docs/SHIP-PROMPT.md and proceed.` — this kicks off v1.6.8 gate 0 (Code's reconnaissance).
4. **When Code returns with the gate plan proposal**, Cowork reviews + locks at gate 1, then implementation gates start.

---

## Key context the new chat must internalize (unchanged from yesterday)

### Blake
- Basic coder. Learns best from clear, slow, step-by-step instructions. **Tell him exactly what to copy/paste and where.** Don't assume he knows project structure, terminal commands, or debugging steps.
- Preference: send one short message at a time to Code; Cowork holds the strategy.
- He shipped 8 ships across 2 days (v1.6.0 → v1.6.7); discipline has been excellent. Don't break the rhythm.

### The Cowork ↔ Code split (HARD rule)
- **Cowork = the chat agent.** Plans, reviews, prompts, writes to `docs/SHIP-PROMPT.md` and `docs/HANDOFF.md`.
- **Code = the build-tool agent.** Reads `docs/SHIP-PROMPT.md`, edits files, writes to `docs/SHIP-OUTPUT.md`.
- **Blake is the courier.** Copies Cowork's one-liner reply, pastes to Code, copies Code's one-liner back to Cowork.
- **Show-then-apply for ALL non-rolling-file edits.** Each piece proposes in SHIP-OUTPUT.md, gets Cowork approval, THEN applies. Code applying without approval is a discipline violation.
- **Always round-trip through Cowork.** Blake should NOT auto-advance gates from Code's one-liners; pass each one back to the chat for review. This is the discipline that catches things like the v1.6.7 HANDOFF.md leak at gate 10.

### The rolling-file pattern
- `docs/SHIP-PROMPT.md` — Cowork's active prompt to Code. **Overwrite per gate.**
- `docs/SHIP-OUTPUT.md` — Code's latest output. **Overwrite per gate.**
- `docs/HANDOFF.md` — Cowork's cross-session handoff doc (this file). **Overwrite at session pause OR ship close.**
- All three firebase-ignored (gate 10b of v1.6.7 added HANDOFF.md alongside the existing `docs/SHIP-*.md` pattern).

### Project rules still apply
- **Rule #1** (Excel canonical) — none of the three tomorrow ships add Excel columns; data flows from AniList at fetch time.
- **Rule #2** (author markers) — required on CHANGELOG and meaningful doc edits.
- **Rule #5** (slow-and-safe deploy ladder) — local → preview → production, per-ship.
- **Rule #7** (test pass before production commit) — `npm test` 7/7 at gate 10 of each ship.
- **Rule #8** (`.gitignore` ↔ `firebase.json` mirror) — re-check at gate 10 of each ship; v1.6.7 caught a HANDOFF.md drift here.
- **Gate 13 ≠ Gate 14** — preview deploy is its own pause; production needs separate explicit go-signal.
- **Gate 14 ≠ Gate 15** — production deploy is its own pause; verification needs Blake's browser confirm.

---

## Discipline wins from v1.6.7 worth preserving

1. **Code's post-apply greps catch real things.** Gate 8b (6-vs-5 grep mismatch → benign historical annotation), gate 9b (post-apply grep found two stale v1.6.7 refs in ROADMAP that the gate 9 scope missed). Encourage this pattern.
2. **HANDOFF.md leak caught at gate 10** — third leak class after PERSONAL.md (v1.3.5) and AUDIT_*.md (v1.3.9). Gate 10's status check + embarrassment-grep discipline is what catches these. Don't skip.
3. **Atomic-pointer-flip production deploy** — preview-deploy populates CDN blobs, production-deploy flips the release pointer with 0/1 new file uploads. Continue using `preview-v1-6-X` channel naming convention.
4. **Multi-gate discipline scales** — v1.6.7 ran 15 gates + 4 amendments + 1 sub-gate = 20 discrete pauses, zero discipline breaches, zero post-deploy fires.

---

## Files to read first in the new chat (priority order)

1. **`docs/HANDOFF.md`** — this file. Plan + state + scope locks.
2. **`docs/SHIP-PROMPT.md`** — pre-staged v1.6.8 gate 0 prompt for Code.
3. **`docs/NEXT.md`** — "Immediate next ship" section (v1.6.8 — More Info panel) for the source-of-truth spec.
4. **`CHANGELOG.md`** — top entry (v1.6.7) for context on what just shipped and the data shape v1.6.8 inherits.
5. **`admin/new-anime.js`** — see `aggregateFranchise()` and `renderFranchisePanel()` for the v1.6.7 reference impl that v1.6.8's modal-side renderer will mirror.
6. **`docs/SKILLS/release-skill.md`** + **`docs/SKILLS/widget-update-skill.md`** — discipline reference for gate 6 (CHANGELOG) + gate 7 (widget bullet) of each tomorrow ship.

---

## What I'd do at the start of the new chat

Verify HANDOFF.md and SHIP-PROMPT.md still make sense after a fresh read (no overnight discoveries that change scope), confirm Blake's morning energy/timeline, tell him to send Code the one-liner kicking off v1.6.8 gate 0. From there it's the v1.6.7 rhythm: Code's output → Blake brings to Cowork → Cowork's one-liner → repeat.
