<!-- author: Cowork | date: 2026-06-04 -->
# Session Handoff — v1.7.4 LIVE · v1.7.5 (watchlist + favorites + per-episode) up next

> **v1.7.4 shipped 2026-06-04 ~14:20 UTC** (commit `7364500`). The Modal Architecture Overhaul — always-visible 3-col modal layout (More Info | Main | Community) with proportional column shrink, LARGE in-site secondary modal replacing external AniList tabs (banner + cover + synopsis + character grid + staff + trailer + MORE LIKE THIS carousel + replace-content history-back + "📝 Request this anime" button), full per-season review feature (markdown storage in `season-reviews/<id>.md` + sync-emitted index + shared XSS-safe `markdown.js` renderer + gold BLAKE'S REVIEW section in secondary + `/admin/season-reviews` panel with live-preview editor + inline "✎ Edit review" admin link + `/api/season-review` CRUD), routing change (primary AniListId → main modal; watched-but-not-primary + "currently viewing" source row → secondary), clickable characters + staff with tertiary detail layer (bio + VAs + appearances + credits), markdown rendering in main modal reviews + admin form preview pane with B/I/🔗 toolbar, brand-purple markdown link styling across 5 surfaces. Blake's "ship it" go-signal honored at gate 8.

---

## Current production

**Live:** `realanimereviews.com` serving **v1.7.4** (commit `7364500`, deployed 2026-06-04 ~14:20 UTC). All v1.7.3 functionality intact (44/44 `WatchedAniListIds` in deployed `animeData.js`, official-only platforms, chatbot drawer locally available via Mode 1, infinite-scroll log). New visitor-facing surfaces: always-open More Info, LARGE secondary deep-dive modal, clickable character/staff tertiaries, per-season review surfaces (empty until Blake writes content via `/admin/season-reviews`). Preview channel + `origin/main` + prod all aligned on `7364500`.

---

## ⚡ For the next Cowork chat (session-start instructions)

**v1.7.4 closed cleanly. v1.7.5 gate 0 propose-first prompt is staged in `docs/SHIP-PROMPT.md`** — ready for the new chat to direct Blake to paste the one-liner into Code.

**Read order (per `docs/COWORK-STYLE.md`):**
1. `docs/AI-PRIMER.md` — project orientation
2. `docs/HANDOFF.md` (this file) — live state
3. `docs/COWORK-STYLE.md` — tone + conventions + 12-gate model + Blake's one-liners
4. `docs/SHIP-OUTPUT.md` — Code's last apply report (v1.7.4 gate 8 prod deploy LIVE)
5. `docs/SHIP-PROMPT.md` — confirm it holds the **v1.7.5 gate 0 propose-first prompt**

**Then tell Blake:** the v1.7.5 gate 0 propose-first prompt is staged. v1.7.5 is the Watchlist + Favorites schema extension ship (wires the v1.7.4 secondary modal's reserved button slots to the existing Firestore infrastructure for non-catalog AniListId entries) + per-episode click-for-more-info + character/staff polish (incl. `__underscore-bold__` markdown addition). Paste this into Code when ready:

```
Read docs/SHIP-PROMPT.md and follow the v1.7.5 gate 0 propose-first instructions.
```

**Don't propose changes to the staged prompt unless Blake asks** — it was deliberately scoped with the v1.7.4 close-out context fresh.

## What this v1.7.4 chat learned (carry-forward for the new Cowork)

These are baked into `docs/COWORK-STYLE.md` + the memory file system already, but worth highlighting:

1. **Always verify state before asserting in SHIP-PROMPTs.** Code's grep-the-real-state discipline caught two Cowork phantom claims this ship (the `/suggest` param wiring at gate 2b, the `WatchedAniListIds` "still empty" claim at gate 3). See memory `feedback_verify_state_assertions`.
2. **No service-name in visitor copy is a recurring drift.** Cowork drifted three times this session ("check AniList", "jumping to AniList", a widget bullet). Code caught all of them. See memory `feedback_no_anilist_in_visitor_ui`.
3. **The sync script has separate parse + serialize halves.** Edit BOTH when adding a new animeData field — gate-1 of v1.7.3 missed the serialize half and the headline feature would have shipped dead if gate-6 audit hadn't grep-verified. See `feedback_verify_state_assertions`.
4. **Use the Grep tool for smart-quote sweep, not bash `grep -l`.** Bash false-positives on multibyte text (CODE-HANDOFF.md gotcha #9).
5. **The `.env` file holds the Anthropic API key.** Gitignored + firebase-ignored via `**/.*`. Re-verify it 404s on every prod deploy.
6. **Gate numbering drifts on big ships.** v1.7.4 went 0 → 1/1b/1c → 2/2b → 3/3b/3c/3d → 4 docs → 5 audits → 6 commit → 7 preview → 8 prod (numbering doesn't strictly match the 12-gate model when there are many sub-gates). Code follows the file when prompts disagree.
7. **Code has full creative latitude on design** — Blake's explicit and repeated grant. Surface 2-3 alternatives on major calls.
8. **Blake's standing "no mobile testing till v2" decision** still holds. Stack rules in `style.css` handle the narrow path; `mobile.css` is off-limits until v1.9.0.

**Commit chain (recent):**
`3539a06` (v1.6.10) → `aaa96f0` (v1.6.11) → `5a5ab9b` (v1.6.11 fix) → `ce04594` (v1.6.12) → `05158e0` (iter 1) → `244d22f` (iter 2) → `a8c60ac` (ROADMAP close-out) → `2ed9874` (v1.7.0) → **`e78f7d6` (v1.7.1, HEAD, on main, prod pending)**.

---

## v1.7.0 shipped scope (recap)

AniList enrichment foundation ship. Backfilled `AniListId` / `IdMal` / `AniListScore` / `AniListColor` / `TitleEnglish` / `TitleRomaji` on all 44 reviews (40 via interactive picker, 4 manually via `--match` flag for skipped ones at v1.7.1 iteration). Activated `script.js`'s pre-built `Media(id:)` lookup path (v1.6.8 anticipated this). Added the gold RATING / purple ANILIST twin badge to every modal (kicker pattern, identical structure). New CLI `npm run backfill`. Shared `lib/excel-backup.js`. Visitor sees the community score directly.

## v1.7.1 shipped scope (commit `e78f7d6`, live)

Polish bundle on top of v1.7.0. **All visitor-facing.**

- **Romaji subtitle on cards + modal** in Japanese typographic brackets `「 」` (Outfit Light Italic, purple brackets, hover-brighten); 3-line wrap clamp; centered alignment
- **Japanese native title fallback** — when romaji is meaningfully identical to English (`norm()` comparison strips non-alphanumerics + lowercases), falls back to `TitleNative` rendered in Noto Sans JP. Chainsaw Man shows `「チェンソーマン」`, Death Note shows `「DEATH NOTE」`, etc.
- **New `--add-native` backfill mode** populates `TitleNative` for all 44 anime via `Media(id:)` queries (300ms delay — flagged as too aggressive for v1.7.2; AniList rate-limits hit on 14 entries during Blake's run, he re-ran successfully after 60s pause)
- **Per-anime AniListColor accent** on the ANILIST badge with a JS luminance guard (`readableAccent()`) — Chainsaw Man's `#6b1a1a` lifts to readable dusty rose; vivid colors untouched; null colors fall back to brand purple
- **Premium "no matches" empty-state card** — 🔍 + `NO MATCHES 該当なし` kicker + dynamic body with searched query + `SUGGEST ONE →` CTA linking to `/suggest`. Glyph float + kicker shimmer + 350ms fade-up + ported `.inline-header-btn` shimmer on the CTA. Centered via `grid-column: 1 / -1`.
- **Widget update-log version chips** above each date section with the rule Blake set:
  - 1-2 ships in a date → stack chips newest-first
  - 3+ ships → arrow notation `v<earliest> → v<latest>`
  - Result: 06/03 stacks `v1.7.1` / `v1.7.0`; 06/02 shows `v1.6.10 → v1.6.12`; 05/13 stacks `v1.6.9` / `v1.6.8`; 05/12 shows `v1.6.7`; 05/11 shows `v1.6.2 → v1.6.6`
- **`widget-update-skill.md` updated** with the 1-2-stack / 3+-arrow rule for future ships
- **Latest Anime Drop card** now renders the romaji subtitle (separate render path `buildFeaturedDrop()` at script.js:1480, distinct from `card-render.js`). Centering bug root-caused to `.featured-card { text-align: left }` → flipped to center fixed title + romaji + genre all together
- **Top 10 carousel glass portrait** expanded twice (gate 1f +56px then gate 1h +24px) to accommodate subtitle line; final: `.spotlight-stack { height: 630px; }` + `::before { height: clamp(632px, 68vw, 672px); }`
- **4 previously-skipped anime backfilled** via new `--match "<Title>" <id>` flag — My Stepmom's Daughter Is My Ex / Watari-kun's ****** / An Archdemon's Dilemma / Hatsune Miku: Colorful Stage!. All 44 anime now have AniList enrichment.
- **NEXT.md + ROADMAP.md renumbered** — what was v1.7.1 (multi-fetch) → now **v1.7.2**; what was v1.7.2 (secondary modal) → now **v1.7.3**.

---

## Gate structure — LOCKED 12-gate ship (effective v1.6.11+, validated through v1.7.1)

| # | Gate | Owner | Tier |
|---|------|-------|------|
| 0 | Recon + propose plan | Code → Blake approves | PROPOSE-FIRST |
| 1 | Build core feature (sub-gates 1a/1b/.../1h for iteration) | Code → Blake approves | PROPOSE-FIRST or APPLY |
| 2 | Build supporting features | Code → Blake approves | PROPOSE-FIRST |
| 3 | Reserved for iteration / fixes | Code → Blake approves | PROPOSE-FIRST |
| 4 | Local browser smoke | Blake | — |
| 5 | Docs cascade | Code | FAST-TRACK |
| 6 | Audits | Code | FAST-TRACK |
| 7 | Commit + push | Code | FAST-TRACK |
| 8 | Preview deploy (+ rules deploy if touched) | Code | FAST-TRACK |
| 9 | Preview smoke | Blake | — |
| 10 | Production deploy on Blake's "ship it" | Code | FAST-TRACK |
| 11 | Production verify | Blake | — |

**Compressed sweeps for fast-track gates work well** — v1.6.12 / v1.7.0 / v1.7.1 all bundled 5+6+7+8 into a single Code prompt with discrete sub-steps, saving round-trips while preserving the integrity boundary.

**Sub-gate convention for iteration:** v1.7.1 used 1a → 1h (8 iteration sub-gates) before docs cascade. Pattern works for visual polish ships.

---

## v1.7.2 — pre-scoped, ready for gate 0 (the DE FACTO More Info panel overhaul)

Blake just made the scope-shaping calls. **Per his "Option 3" choice — v1.7.2 + v1.7.3 together ARE the More Info panel overhaul** (data architecture this ship + in-site secondary modal next ship = redesigned panel in practice, distributed across two ships).

### Decisions locked in 2026-06-03 planning session

| # | Decision |
|---|---|
| 1 | Safe parallel-fetch concurrency — batch in groups of 3-4 with delays |
| 2 | Full chain traversal — walk relations as deep as they go, **filter to TYPE=ANIME only** (no manga / light novels / etc.) |
| 3 | Episode list UI — **Code's creative latitude** (Blake said "let code come up with cool UI ideas") |
| 4 | Progressive render — each relation row appears as its parallel fetch returns; visitors don't wait on slowest call |
| 5 | "AniList down" partial-fail message — Code brainstorms with Blake's creative latitude. Cowork's pick: subtle inline notice when 1+ sub-fetch fails (`Some related entries couldn't load — try again later`) |
| 6 | Visitor interaction details — **Code's creative latitude** (Blake said "you and code think of visitor interactions and what the people might want to see") |
| 7 | Light localStorage cache — ~24-hour TTL on cached relation data, key by AniListId |
| 8 | MAL integration — **DEFERRED** to its own ship (v1.7.4 or v1.8.x). MAL IDs are stored but not called this ship. |

### Cowork's brainstorm to feed into Code's propose-first

**For the relations chain UI** (Demon Slayer's arcs, OPM S3, etc.):
- Group relations by **relation type** with section headers — `SEQUELS`, `MOVIES`, `SPIN-OFFS`, `ALTERNATIVE`, etc. Today's panel is flat
- Show a small **"in catalog"** indicator on rows linking to Blake's reviews vs. rows that go to AniList
- Compact mode by default with "show all N entries" expansion for super-long franchises
- Subtle line connecting strict sequel chains (S1 → S2 → S3) — visual aid

**For the episode list UI** (Re:Zero merged seasons):
- Collapsible per-season — `▶ Season 1 (25 episodes)` / `▶ Season 2 (50 episodes)` — click expands
- OR tabs across the top with the list below
- OR continuous list with subtle season divider lines
- Could show season cover thumbnail next to each season header
- Episode rows highlighted when AniList has per-episode scores (separate roadmap polish item; check feasibility this ship)

**For the partial-fail / AniList-down messaging:**
- Subtle inline notice at the bottom of the panel: `Some related entries couldn't load — try again later`
- Subtle yellow-tinted card, dismissable
- Silent partial render (visitors don't know)
- Cowork's pick: **subtle inline notice when 1+ sub-fetch fails** — honest but not alarming

### Scope items for v1.7.2

1. **Parallel-fetch architecture** — `Promise.all`-based helper, batched in groups of 3-4 with 200-300ms delays between batches (NOT the v1.7.1 `--add-native`'s aggressive 300ms-no-batch pattern that hit rate limits)
2. **Multi-hop traversal** — recursive walk of TYPE=ANIME relations from a starting AniListId, until exhausted, with cycle detection (some franchises loop back)
3. **Episode aggregation** — fetch each related season's `streamingEpisodes` separately, merge with season labels
4. **UX overhaul of the More Info panel** — relation grouping by type, episode list redesign (Code picks final UI from brainstorm), partial-fail messaging
5. **Light localStorage cache** — ~24h TTL keyed by AniListId, stores the parallel-fetched relation tree
6. **Backwards compat** — entries without AniListId gracefully fall back to current title-search behavior
7. **Standing rules apply** — premium UI floor, `[hidden]` symmetry on any new toggleable elements, no AniList in interrupting copy (data attribution like kickers is OK per updated memory)

### Estimated scope: 6-8 hours

Bigger than v1.7.1's polish (~2-3hr build) and v1.7.0's data (~3-4hr) because it bundles data architecture + meaningful UX redesign + caching. PROPOSE-FIRST is essential — recon needs to map current `fetchRelationsFromAniList` + existing relation render + episode list code.

### Code's brainstorming latitude

Blake explicitly said "make sure code also provides its thoughts" on items 3 (episode UI), 5 (down message), and 6 (visitor interactions). The gate 0 propose-first prompt should invite Code to surface 2-3 alternatives per design call.

---

## After v1.7.2 — v1.7.x continued (renumbered)

- **v1.7.3 — Watched set feature** (NEW, slotted in 2026-06-03 during v1.7.2 gate 4 smoke). New `WatchedAniListIds` column on `Anime_Master_Table.xlsx` (comma-separated list of every AniListId Blake's single review actually covers — S1 + S2 + OVAs + movies he watched). Sync script reads it into `animeData.js` as an array. `renderFranchiseEntry`'s catalog-pill lookup checks set-membership instead of just primary `AniListId`. Admin form gets a multi-select UI showing the franchise tree (reuses `traverseFranchise` from v1.7.2) with checkboxes — default: all spine entries pre-checked, Blake unchecks stragglers. Mode 1 auto-fills the default. One-time ~20-min backfill across 44 existing reviews. ~4-6 hours.
- **v1.7.4 — In-site secondary modal** (pushed back from v1.7.3 by the v1.7.3 slot-in). Click any related anime in the More Info panel → opens a secondary modal IN-SITE with that anime's full AniList data (extended description, episode list, characters, staff). Back button returns to primary review modal. Includes watchlist + "Not Reviewed yet" treatment for ALSO LIKED rows not in Blake's catalog. Benefits from v1.7.3 because "✓ REVIEWED" pills will work correctly across all watched seasons by the time this lands. ~5-6 hours.
- **v1.7.x polish slots** — AniList per-episode scores feasibility check.
- **v1.7.4 — Future MAL integration slot** (deferred from v1.7.2). Use stored `IdMal` field via Jikan (unofficial MAL API). Could be: fallback when AniList errors, OR parallel data source showing MAL score on modals. UX needs scoping.
- **v1.8.0 — AniList tab on cards.** Each card gets a separate AniList tab.
- **v1.8.x — Suggestion DM Inbox** (admin↔visitor messaging).
- **v1.9.0** — mobile compatibility overhaul.
- **Phase D — Mode 2** autonomous caretaker.

---

## Working tree state

**Pending Blake decisions (still in working tree, never committed):**

7 Cowork-managed workflow docs Blake explicitly excluded from every commit since v1.6.11:
- `docs/COWORK-STYLE.md` (untracked)
- `docs/AI-PRIMER.md`, `docs/CODE-PROMPTS.md`, `docs/SKILLS/README.md`, `docs/SKILLS/hotfix-skill.md`, `docs/SKILLS/release-skill.md`, `docs/SKILLS/widget-update-skill.md` (all modified)

`firebase.json` ignore was extended at v1.6.12 to cover `COWORK-STYLE.md` + `CODE-HANDOFF.md` (Code caught the leak risk and added). Blake hasn't ratified whether to ever commit any of these or revert; status = deferred, his call.

**Plus the rolling SHIP-PROMPT.md + SHIP-OUTPUT.md** — overwritten per gate, committed at gate 7, firebase-ignored so they never deploy.

---

## Lessons learned (carry forward — full list)

1. **Tiered gates** — propose-then-apply for big code/design; fast-track docs cascade / audits / commit / deploys. (`feedback_gate_tiering.md`)
2. **Code runs deploys** — gates 8+10 are Code's. Blake does gates 4, 9, 11. (`feedback_deploy_ownership.md`)
3. **Lean prompts on fast-track** — under ~30 lines. (`feedback_lean_prompts.md`)
4. **`[hidden]` symmetry** — every element with non-none display that gets hidden-toggled needs `[hidden] { display: none; }`. Bitten 3+ times (gate 3g, v1.6.12 iter 2). (`feedback_hidden_attribute_symmetry.md`)
5. **Custom branded modals only** — never `confirm()` / `alert()`. (`feedback_no_native_dialogs.md`)
6. **No AniList branding in interrupting visitor UI** — generic phrasing in error/loading/empty states; but **data attribution is OK** (`ANILIST` kicker labeling a score is fine, updated 2026-06-03). (`feedback_no_anilist_in_visitor_ui.md`)
7. **Code has creative latitude on design** — propose elevations; PROPOSE-FIRST is the safety net. (`feedback_creative_latitude.md`)
8. **Premium UI floor on new elements** — brand parity by default. (`feedback_ui_polish_default.md`)
9. **AniList rate-limit reality** — 90 req/min cap. v1.7.1 `--add-native` hit 429s with 300ms-no-batch on 14/44. v1.7.2 must batch 3-4 at a time with 200-300ms inter-batch delays.
10. **AniList query complexity has a budget** — v1.6.10 confirmed. The parallel-fetch architecture in v1.7.2 explicitly works around this.
11. **Blake's review model — one review per franchise**, not per season. Multi-hop traversal must respect this (the source anime is "Blake's review subject"; related seasons are surfaced as relations, not as separate reviews).
12. **Workflow-doc deploy leak class** — Code caught at v1.6.12. Pattern: when adding any new doc, audit firebase.json ignore symmetry.
13. **Phantom-feature catch by Code at v1.7.1 gate 1e** — Cowork referenced `--add-native` / `pickSubtitle` / `TitleNative` as if built at a non-existent prior gate. Code grep-checked, found zero hits, flagged before silently building. Cowork apologized and re-staged a proper build gate. Pattern: Code's habit of grep-verifying references against codebase reality is load-bearing.
14. **`norm()` slug-style comparison beats raw string** for romaji-vs-english matching. v1.7.1 gate 1g shipped this fix.
15. **Klee One was a v1.7.1 dead font load** — once Outfit italic replaced it for cards + modal, the import in index.html + admin/new-anime.html became unused. Candidate for future cleanup.
16. **Compressed sweep pattern** — gates 5+6+7+8 bundle worked cleanly across v1.6.12, v1.7.0, v1.7.1. Pattern is now established.

---

## Process rules still apply

- Rule #1 (Excel canonical) — v1.7.2 doesn't write Excel.
- Rule #2 (author markers) — CHANGELOG + meaningful doc edits.
- Rule #5 (deploy ladder) — local → preview → production.
- Rule #7 (`npm test` 7/7) at gate 6.
- Rule #8 (`.gitignore` ↔ `firebase.json` mirror) — at gate 6.

---

## Rolling files (current state)

- **`docs/SHIP-PROMPT.md`** — **currently staged: v1.7.2 gate 0 propose-first prompt**. Ready for Code on paste of the one-liner.
- **`docs/SHIP-OUTPUT.md`** — currently holds Code's v1.7.1 gate 5+6+7+8 compressed-sweep apply report. Will be overwritten when next Code prompt runs.
- **`docs/HANDOFF.md`** — this file. Just updated.
- **`docs/COWORK-STYLE.md`** — Cowork's tone/conventions style guide. Still untracked per Blake's exclude.

---

## What the next chat does first

1. **Read `docs/AI-PRIMER.md`** for project orientation.
2. **Read this `HANDOFF.md` end-to-end** for full state.
3. **Read `docs/COWORK-STYLE.md`** for tone + conventions.
4. **Read `docs/SHIP-OUTPUT.md`** for Code's last output (v1.7.1 gates 5-8 sweep).
5. **Read `docs/SHIP-PROMPT.md`** — confirm it holds the **v1.7.2 gate 0 propose-first prompt** (staged at this session pause).
6. **Tell Blake:**
   > Confirmed — `docs/SHIP-PROMPT.md` holds the v1.7.2 gate 0 propose-first prompt. **Before that, note: v1.7.1 is at gate 10 pending your explicit `ship it` go-signal for prod deploy** (preview URL `https://real-anime-reviews--preview-v1-7-1-ldw7i7yf.web.app`, commit `e78f7d6` pushed to main). Two paths:
   >
   > - **Finish v1.7.1 first:** say `ship it`, I'll re-stage gate 10 prod deploy, then we move to v1.7.2 after gate 11 verify.
   > - **Start v1.7.2 now:** paste this into Code:
   >   ```
   >   Read docs/SHIP-PROMPT.md and follow the v1.7.2 gate 0 propose-first instructions.
   >   ```
   > Which?
7. **Wait for Blake's pick**, then proceed.

---

## State summary

- **Production:** v1.7.1 live, commit `e78f7d6`. Gate 10 + 11 closed between sessions.
- **In flight:** v1.7.2 fully pre-scoped, gate 0 propose-first prompt staged in `docs/SHIP-PROMPT.md`, awaiting Blake's paste-into-Code.
- **Working tree:** 7 Cowork doc excludes + rolling SHIP-* files.
- **Open architecture decisions:** None remaining. Blake's 8 v1.7.2 questions all answered. Code has explicit creative latitude on items 3, 5, 6 of the v1.7.2 scope.
- **Next move:** Blake pastes the v1.7.2 gate 0 one-liner into Code.
