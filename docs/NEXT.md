<!-- author: Code | date: 2026-06-02 -->
# What's Next — Real Anime Reviews Backlog

> **Persistent task list.** Cowork's in-session TaskList tool is per-conversation; this file outlives that. New sessions read this to know what's queued. Keep updated when items ship or get rescoped.
>
> **Source authority:** `ROADMAP.md` for the full strategic plan + project rules. This doc is the actionable distillation.

---

## Recently shipped

- **v1.6.10** (2026-06-02) — More Info panel polish bundle. Three small visible polishes on every anime modal's More Info panel: duplicate studio names dedupe on franchise rows (`Array.from(new Set(...))` wrapper applied in both the public modal's `renderMoreInfoEntry` and the admin form's `renderFranchisePanel` for parity); each franchise row carries a small format pill (`TV` / `MOVIE` / `OVA` / `ONA` / `SPECIAL`) at the start of its meta line, reusing v1.6.9's `.more-info-rec-format-badge` class with an inline `position: static` override so it doesn't stack on top of the score badge; the STAFF cluster's fallback loop now collects up to 6 entries (was 4) when AniList doesn't list any of the four whitelist roles. Multi-hop franchise traversal and franchise-episode aggregation were originally scoped for v1.6.10 but deferred to v1.7.1 — both required a nested-relations GraphQL shape that AniList returns 500 errors for on relation-heavy nodes (Demon Slayer's id is the canonical 500-prone case). See CHANGELOG.
- **v1.6.9** (2026-05-13) — Richer Modal Data. Three new clusters added inline to the v1.6.8 More Info panel for the source anime: per-episode names (AniList `streamingEpisodes`, title-only, sorted by parsed episode number, collapsed behind `<details>` when > 8); top-5 community recommendations ("ALSO LIKED" cards — cover + English title + format pill, clickable to AniList, filtered to anime formats only, nulls dropped); key production staff (Director / Series Composition / Music / Character Design as `Role — Name` text, relevance-ranked fallback when those exact roles aren't listed). `fetchRelationsFromAniList` return shape extended to `{ sourceId, edges, streamingEpisodes, recommendations, staff }` (+ explicit `!media` failure guard); recommendation cards reuse v1.6.8's `.more-info-entry--clickable` + `data-anilist-id` (zero new event-handler branches); episode collapse is CSS-only `<details>/<summary>`. Known limitation: AniList's `streamingEpisodes` is current-streaming-feed-sourced, so for ongoing multi-season anime it may return the latest airing season's episodes rather than the source season's — franchise-episode aggregation queued for v1.6.10. See CHANGELOG.
- **v1.6.8** (2026-05-13) — More Info panel (Path B+). Visitor-facing surface of the v1.6.7 franchise scope split. Collapsible "Click for More Info" tab on every public anime modal expands into a panel showing the show's full franchise — PREQUEL/MAIN/SEQUEL/PARENT relations rendered as cards with cover thumbnails, English+romaji titles, year/episode count/studio meta, and AniList community scores. Every row clickable → opens that season's AniList page in a new tab. Lazy fetch on tab click, in-session cache. Popularity-sorted search (`Page(media:, sort:[POPULARITY_DESC, SCORE_DESC])`) so ambiguous titles like "Demon slayer" resolve to Kimetsu no Yaiba. Three internal iterations folded in: gate 4b (IIFE indent), gate 5b (null-constraint 404 fix), gate 5c (popularity sort + universal click-through + drop "unavailable" greying). Known limits queued for v1.6.10: single-hop relations (OPM S3 missing), per-entry studio dedupe (MADHOUSE,MADHOUSE). See CHANGELOG.
- **v1.6.7** (2026-05-12) — Admin form franchise aggregation (Part A of the franchise scope split). Fetching a multi-season anime in the admin form now aggregates AniList `relations` (PREQUEL / PARENT / MAIN / SEQUEL, filtered to `type:ANIME`) into a FRANCHISE INFO panel showing all entries in chronological order, plus franchise-aware Seasons + Studio field prefills. New amber `'warn'` status-kind for hint-level messages (PREQUEL heads-up). Single-hop traversal; multi-hop queued as a v1.6.x polish (see polish backlog below). See CHANGELOG.
- **v1.6.6** (2026-05-11) — Hotfix: cover images now fill the anime card frame cleanly. `object-fit: contain` → `object-fit: cover` on `.card img` in `style.css`. Same-day fix for the bug surfaced during v1.6.5 smoke. See CHANGELOG.
- **v1.6.5** (2026-05-11) — Live preview as you type for the admin form. Search-as-you-type AniList dropdown, ID-import as first-class entry point (the `b+` design), live card preview via the new shared `card-render.js`. Bundled fixes: sticky positioning (`overflow-x: clip`), title-case canonicalization on AniList fetch. First multi-gate Code/Cowork ship. See CHANGELOG.
- **v1.6.4** (2026-05-11) — Update log widget upgrade. Shipped-on dates on every change, date-grouped sections (`<div class="version-section">` + MM/DD/YYYY headers), cap raised 5 → 10, internal scroll containment via `.changelog-content { max-height: 300px; overflow-y: auto; }`. Widget skill (`widget-update-skill.md`) rewritten in the same ship: per-change granularity, MM/DD/YYYY format mandatory, backfill-consolidation rule removed. AniList `Media(search:)` recovered partway through this session — v1.6.5 is unblocked. See CHANGELOG.
- **v1.6.3** (2026-05-11) — Polish bundle + first widget update under the new visitor-first skill. `/api/health` reads `APP_VERSION` dynamically, `release-skill` and `hotfix-skill` cross-reference `widget-update-skill`, AI-PRIMER lists all three skill files, one combined backfill bullet on the homepage widget covers v1.6.1 + v1.6.2 + v1.6.3. Originally scheduled for live preview; deferred to v1.6.4 because of the AniList outage. See CHANGELOG.
- **v1.6.2** (2026-05-11) — Bug 10 prevention: Mode 1 server smoke-checks `runCmd` at startup (`smokeCheckSpawn` in `scripts/mode1-server.js`); new entry in `docs/DECISIONS.md` ("re-run the pipeline at the commit you're shipping"). See CHANGELOG.
- **v1.6.1** (2026-05-10) — Hotfix: spawn EINVAL on Windows + Node ≥20.12.2 (Bug 10). Reverted `runCmd` to `shell: true` for npm/npx/firebase wrappers in `scripts/mode1-server.js`. See CHANGELOG.

---

## Immediate next ship — v1.6.11 (Suggestion Box + admin viewer)

**Public form for visitors to request specific anime, plus an admin viewer that turns requests into pre-filled Mode 1 entries.**

- **Public suggestion form** — no sign-in required; basic spam protection (honeypot field + per-IP rate limit). Submission categories: specific anime request, website addition, inaccurate info, bug report, "tell Blake how awesome he is", other.
- **Admin viewer** — gated by admin UID; renders the request queue with category filters and submission timestamps.
- **One-click "Add this anime" handoff** — from a specific-anime-request row in the queue, opens the Mode 1 form with the requested title pre-filled. Blake writes his review and ships via Mode 1's existing pipeline.
- **Storage** — submissions stored in Firestore under a new collection (path TBD during implementation).

**Note:** this folds the originally-planned standalone v1.4.0 Suggestion Box spec into Mode 1's upgrade arc. The standalone version is no longer planned separately — it lands as part of Mode 1. (Cascaded from v1.6.9 by the v1.6.8 + v1.6.9 + v1.6.10 inserts.)

**Implementation surface:** new public `suggest.html` page + form-handler JS; new admin queue view in the existing admin panel; new Firestore collection + security rules. Mixed visitor-facing + admin-facing — Tier A.

**Estimated:** ~3-4 hours; ~10-12 gates.

---

## Phase B remaining (v1.6.x)

| Version | What | Notes |
|---|---|---|
| v1.6.x | Real one-click AI integration | Replace the current paste-back AI panel with a true one-click. See `docs/ai-integration-design.md` — recommended path is a Firebase Cloud Function. |
| v1.6.x | One-click full automation | Drop the explicit deploy confirmation gate after enough trust is built up. Mode 1 server option. |
| v1.6.x | Clickable live preview opens modal | Make the admin form's live preview card clickable; opens a mini-modal showing what the full review experience looks like (using the same modal code as the homepage). Requires extracting modal-opening logic from `script.js` similar to how `card-render.js` was extracted in v1.6.5. Estimated 1–2 hours. Requested by Blake during v1.6.5 smoke test ("I can't click on the live preview to see what a review would look like"). |
| v1.6.x | More Info panel polish bundle | Consolidates several panel-polish items that need to ride together. From v1.6.10 gate-5 smoke feedback. Specifically: **staff whitelist expansion** (currently 4 fixed roles — add 1-2 more like Sound Director / Series Director for richer common-case display); **Re:Zero source-vs-relation episode-list deduplication** (anomaly A from v1.6.10 gate 5 — addressed in v1.7.1 via aggregation infrastructure, but cosmetic dedupe could land sooner); **cosmetic season-header styling** (`.more-info-relation` reuse vs. dedicated class); other ad-hoc panel cleanups Blake spots during use. Indefinite slot — bundle ad-hoc when 2-3 items accumulate. |
| v1.6.x | Widget version chips per `<li>` | Each widget update-log `<li>` carries a small version chip (`v1.6.7`, `v1.6.5`, etc.) so visitors can see which update each bullet shipped with — per the v1.6.4 widget-upgrade convention. Requires: backfill the existing 10 bullets with their source versions (CHANGELOG.md has the history); markup change in `index.html` (per-bullet `<span class="changelog-version-chip">`); CSS for the chip; `widget-update-skill.md` updated to require a version chip on each new bullet. From v1.6.9 gate-5 smoke. Indefinite slot per Blake's lock — deferred to v1.6.x polish bundle. |
| v1.6.11 | Suggestion Box + admin viewer | Public form (no sign-in, basic spam protection) → admin queue → "Add this anime" handoff into the Mode 1 form. Folded into Mode 1 from the originally-planned standalone v1.4.0 spec. (Cascaded from v1.6.9 by the v1.6.8 + v1.6.9 + v1.6.10 inserts.) |

## Phase B-side — data infrastructure + secondary modal

- **v1.7.0 — AniList backfill + MAL integration** (PATCH). Foundation ship. Populates `AniListId` / `IdMal` / `AniListScore` / `AniListColor` for the existing ~44 reviews via Mode 1's pipeline. Excel and `animeData.js` both updated. Unlocks AniListId-based lookups everywhere — prerequisite for v1.7.1's multi-fetch architecture. Estimated ~3 hours.
- **v1.7.1 — Multi-fetch data architecture + multi-hop revival** (MINOR). Closes the v1.6.10 architectural debt. Build a batched parallel-fetch helper (`Promise.all`-based) for "given N AniList IDs, fetch their relations + streamingEpisodes in parallel and merge." Plumbs in two v1.6.10-deferred items: (a) **multi-hop franchise traversal** — surfaces Demon Slayer's Entertainment District / Swordsmith Village / Hashira Training / Infinity Castle arcs + OPM S3 + S3 Part 2 via N+1 per-relation fetches (the single nested mega-query AniList returned 500s for on relation-heavy nodes); (b) **franchise-episode aggregation** — fix Re:Zero's wrong-season episodes by fetching each related season's `streamingEpisodes` separately and merging. Estimated ~4-5 hours. Requires v1.7.0.
- **v1.7.2 — In-site secondary modal for franchise entries** (MINOR). Replaces v1.6.8's "open AniList in new tab" with an in-site experience. Requires v1.7.1's data layer. Secondary modal opens over the primary modal with a Back button, renders detailed AniList info per anime (extended description, episode list, characters, staff). Includes watchlist + "Not Reviewed yet" treatment for ALSO LIKED cards not in catalog. Per-episode click-for-more-info if per-episode content source decided. Estimated ~5-6 hours.
- **v1.7.x polish slots** (post-v1.7.2): **Romaji subtitle on cards** — display romaji title (e.g. "Sousou no Frieren") as smaller secondary line below the main English title on cards + modal. Best paired with v1.7.0 backfill (adds `TitleRomaji` to the migration sweep — essentially free); display work could land its own v1.7.x slot after v1.7.2. Requested by Blake during v1.6.5 smoke. **AniList per-episode scores feasibility check** — confirm whether AniList's `Episode` GraphQL type exposes per-episode community scores. If so, layer into the episode list; if not, shelve. Deferred from v1.6.9 planning.
- **v1.8.0 — AniList tab on cards** (MINOR). Each anime card gets a separate tab showing verified-source data (genres, ratings, episode counts, streaming where-to-watch badges) at-a-glance. Distinct from the v1.6.8 More Info panel — that's the deeper view; this is at-a-glance.

## Mobile compatibility (v1.9.0)

- **v1.9.0 — Mobile compatibility overhaul.** Site is currently broken at phone viewports per Blake's direct observation (2026-05-11), despite `mobile.css` being loaded under `@media (max-width: 900px)`. Two-step plan: (1) Tier A read-only audit at 375 / 414 / 768px viewports walking every major flow, output as `docs/MOBILE-AUDIT-{date}.md`; (2) one or more fix bundles grouped by area (layout, modal, form, images, fonts), each with its own preview deploy. Slotted after v1.8.0 so fixes target the final card design, before Phase D Mode 2. See ROADMAP `## v1.9.0` for the full spec.

## Phase D — Mode 2 (autonomous caretaker, future)

Cannot start until Mode 1 is in active use and backfill is done. Build order:

1. **Step 1: Read-only weekly health report** — no changes made, just observation, sent to Blake. Foundation for trust.
2. **Step 2: Autonomous data sync** — PATCH-tier updates only (season counts, episode counts, related anime, streaming links from AniList). Reports everything it changed.
3. **Step 3: Health-fix actions** — broken link repair, missing asset detection.
4. **Step 4: Content quality checks** — stale info, things rendering wrong.
5. **Step 5: Tune risk thresholds** based on observed quality.

Each step earns trust before the next is enabled. Mode 2 is constrained to PATCH-tier per project rule #4.

## Audit polish bundles (slot in between phases)

Step 3.5 audit had 56 findings; ~25 closed in v1.3.7 + v1.3.8. Remaining items group cleanly:

| Bundle | Audit refs | What |
|---|---|---|
| Bundle 1 (v1.4.x slot) | §2.1 + §4.1 + §2.3 | 404 page rebuild + return path + Google Fonts cleanup |
| Bundle 2 (v1.4.x slot) | §1.8 + §2.5 + §3.4 | 11 missing avatar files + filename casing + background image (WebP/AVIF) |
| Bundle 3 (v1.4.x slot) | §1.7 + §1.9 + §2.4 | `document.write` removal + inline `onclick`/`onsubmit` on account.html + Top 10 prev/next a11y |
| Standalone | §3.1 + §3.2 | Minify `script.js` (134KB) and `style.css` (107KB) — set up minify step in deploy flow |
| Standalone | §4.2 | Verify low-contrast secondary text (axe DevTools), fix to WCAG AA |

## Polish + tech debt (no version, do whenever)

- **Favicon + Apple touch icons** — browser tab currently shows generic icon
- **Basic privacy notice** — site stores user-generated content; short statement is overdue
- **Cloud Function for notification pruning** — currently client-side; backend would be guaranteed
- **Cloud Function for cascading deletes** — when community review deleted, threads/ subcollection orphaned in Firestore
- **Search-bar matching tuning** — tighten title-vs-tag/genre weighting
- **Investigate deploy file-count drift** — quick `find . -type f -not -path './.git/*' \| wc -l` diagnostic
- **Excel `Image` column** — currently sync derives image from slug fallback. Adding an explicit Image column would make the contract more obvious.
- **Mode 1 `customBullets` field on form** — let Blake write user-facing bullets per ship instead of always defaulting to "Added: <Title>"
- **Playwright test for Mode 1 server using `?skipPush=1`** — automate the synthetic-anime-via-AniList-ID smoke run that's been done manually around Bug 10 / Bug 9 verifications. Spawn the server, POST to `/api/submit?skipDeploy=1&skipPush=1`, assert all 9 SSE step events come through `done`, then revert+restore. Catches the v1.6.0-class regression class structurally, not just at server startup. Estimated 2-3 hour ship; queued behind v1.6.3 live preview.

## Big-vision ideas (no version, no immediate plan)

- **Recommendation engine** — "if you favorited X and Y, you'd probably like Z" (tag/genre overlap, then smarter signals)
- **AI-suggested tags for new entries** — LLM suggests tags from review text + AniList metadata
- **Community Top 5 Favorites panel** — aggregate-counted top 5 across all users on home page (originally v1.1.0, postponed)
- **Stats dashboard** — site-wide stats (most active threads, most prolific reviewers, vote distributions)
- **Admin mode UI** — moderating comments, deleting abusive content, pinning featured anime (admin UID already in PERSONAL.md)
- **Auto-update for new seasons / episodes** — Mode 2 capability once Mode 2 is mature

## Deferred (still real, just lower priority)

- **Anime font** — site typography currently fine; revisit if visual identity ever feels stale
- **@mentions in comments** — comment system works without it; revisit if community engagement grows

## Explicitly NOT happening

- Major architectural rewrites (vanilla JS → React/Vue) — site is small enough that vanilla works
- Monetization (ads, subscriptions, donations) — pet project
- Multi-language support — would conflict with personal-voice nature of reviews
- AniWave / unofficial-streaming-site integration in Mode 1 — AniList only (legal + data quality)
- AI-curated images — per project rule #9, image curation stays human (with hybrid AniList default)
