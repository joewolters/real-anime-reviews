# Changelog

All notable changes to Real Anime Reviews, newest first. Versions follow [SemVer](https://semver.org/) (MAJOR.MINOR.PATCH):

- **MAJOR** — milestone or structural shift
- **MINOR** — new features that don't break existing behavior
- **PATCH** — small fixes, content updates, tweaks

For what's coming next, see [ROADMAP.md](ROADMAP.md).

---

<!-- author: Code | date: 2026-06-02 -->
## v1.6.10 — MINOR (2026-06-02)

**The More Info panel on every anime modal now reads a little cleaner: duplicate studio names dedupe, each franchise row carries a small format pill, and the STAFF cluster can show up to six roles when AniList's data falls outside the standard four-role whitelist.** Three small visible polishes, no new clusters and no new markup — the changes ride entirely on existing v1.6.8 / v1.6.9 styles. Click "Click for More Info" on any anime modal and the same three things land everywhere.

- **Per-row studio dedupe** — when AniList returns the same animation studio twice on a single relation row (Frieren S2's `MADHOUSE, MADHOUSE` is the canonical example), the modal now shows it once. The fix is a one-line `Array.from(new Set(...))` wrapper around the studio-name extraction, applied in both the public modal (`renderMoreInfoEntry`) and the admin form (`renderFranchisePanel`) so the admin-side FRANCHISE INFO panel stays visually consistent.
- **Format pill on each franchise row** — AniList's `format` field (`TV` / `MOVIE` / `OVA` / `ONA` / `SPECIAL`) renders as a small pill at the start of the row's meta line, in flow with the year / eps / studio text. Visitors can tell apart Mugen Train MOVIE from Mugen Train ARC TV at a glance — a stop-gap until v1.7.1's multi-hop traversal surfaces both seasons explicitly. The pill reuses the existing `.more-info-rec-format-badge` styling (introduced for recommendation cards in v1.6.9) with an inline `position: static` override so it doesn't stack on top of the row's score badge in the corner.
- **STAFF section bumped 4 → 6 roles** — when AniList doesn't list any of the four whitelist roles (Director, Series Composition, Music, Character Design), the fallback loop that walks `staff.edges` by relevance score now collects up to six entries instead of four. Anime with deeper credit lists (OVAs with named editors, animation-production specials) get a fuller STAFF cluster.

**Known limitations:**

- **Multi-hop franchise traversal and franchise-episode aggregation were both scoped for v1.6.10 but deferred to v1.7.1.** The original v1.6.10 plan chased relation chains two hops out (so Demon Slayer's modal would surface Entertainment District / Swordsmith Village / Hashira Training / Infinity Castle, and One-Punch Man would surface S3 + S3 Part 2) and aggregated per-season episode lists (closing v1.6.9's known limitation about wrong-season episodes for Re:Zero and other ongoing multi-season shows). Both required a nested-relations GraphQL shape that AniList returns 500 errors for on relation-heavy nodes (Demon Slayer's id is the canonical 500-prone case — its source-material pivot path exceeds AniList's per-query complexity budget). v1.7.1's redesign — N+1 parallel fetches in place of the single nested mega-query — will deliver both items. v1.6.10 ships small with the three polish wins above; the architectural debt is acknowledged and queued.

**Implementation files:**

- `script.js` (~+20 / ~-8) — `renderMoreInfoEntry`'s studio-split chain wrapped in `Array.from(new Set(...))`; the same renderer's meta-line construction extended to defensively extract `node.format` and prepend a `<span class="more-info-rec-format-badge" style="position: static;">` pill (the inline style overrides the class's `position: absolute` so the pill sits in the meta line, not in the top-right corner where `.more-info-score-badge` already lives); `renderStaffCredits`'s fallback loop bumped from `picked.length >= 4` to `>= 6`. No signature changes, no fetcher changes, no query changes.
- `admin/new-anime.js` (~+5 / ~-4) — admin parity for the studio dedupe: same `Array.from(new Set(...))` wrapper in `renderFranchisePanel`'s per-entry studio render, so the admin form's FRANCHISE INFO panel stays visually consistent with the public modal. Other admin paths (the studio-input prefill via `aggregateFranchise`'s studio-union Map) already deduped case-insensitively in v1.6.7 and are untouched.
- No new CSS — both changes reuse existing v1.6.8 / v1.6.9 classes (`.more-info-rec-format-badge` for the pill, the existing staff-row markup).
- No new HTML structure, no new event listeners.

Total: **~25 insertions / ~12 deletions** across 2 files (`script.js`, `admin/new-anime.js`) — plus the version-bump strings and the widget bullet in the gate-7/8 work.

Tier A — `script.js`, `admin/new-anime.js`, and the public anime modal + admin form are visitor-facing. `npm test` runs clean before commit (7/7 Playwright; the More Info panel's lazy-fetch path is not under test). Blake's local browser smoke verified Demon Slayer (single-hop relations correctly limited to Mugen Train Movie + Mugen Train Arc — Entertainment District / Swordsmith / Hashira / Infinity Castle absent, the deferred v1.7.1 scope), Frieren S2 (single Madhouse on the row, no duplicate), format pills visible on each TV / MOVIE / OVA / etc. relation, and the STAFF cluster showing 4-6 entries depending on which fallback path fires.

**Roadmap cascade:** v1.6.11 (Suggestion Box + admin viewer) is the next immediate ship — Cowork's Tier-B request queue is partly built and that's the cleanest next slot. v1.7.0 (AniList backfill — populates the `AniListId` column for every existing review so future modal fetches use the precise `Media(id:)` lookup instead of the popularity-sorted `Page(media:)` search) follows. v1.7.1 closes v1.6.10's architectural debt: N+1 parallel fetches replace the single nested mega-query, restoring multi-hop traversal AND enabling franchise-episode aggregation in a way that respects AniList's per-query complexity budget — the two deferred items from this ship land there. Other v1.7.x candidates (romaji subtitle, in-site secondary modal, watchlist hook on ALSO LIKED cards) keep their current slots.

<!-- author: Code | date: 2026-05-13 -->
## v1.6.9 — MINOR (2026-05-13)

**Visitors can now see per-episode names, related-anime recommendations, and staff credits inline on the More Info panel** — three new data clusters added below the franchise relations that v1.6.8 introduced. Click "Click for More Info" on any anime modal and the panel now lists the show's episodes, a handful of "if you liked this…" recommendations (each clickable to AniList), and the key production staff (director, series composition, music, character design).

- **Episodes section** — the source anime's episode list, pulled from AniList. The section header reads `EPISODES — {Anime Title}`. Long lists (more than 8 episodes) collapse under a "SHOW ALL N EPISODES" toggle (default closed). Episodes are sorted by episode number; entries without a recognizable number (OAD, specials) sort to the end. Title text only — no thumbnails, no links.
- **ALSO LIKED (recommendations) section** — AniList's top 5 community recommendations for the anime. Each card shows a cover thumbnail, the English title (romaji if there's no English title), and a small format pill (`TV` / `MOVIE` / `OVA` / etc.) in the corner. Cards are clickable — they open that anime's AniList page in a new tab, same as the franchise rows. Filtered to anime only (no manga recommendations); recommendations pointing at removed entries are skipped.
- **STAFF section** — four key roles: Director, Series Composition, Music, Character Design, shown as `Role — Name` (not clickable). If AniList doesn't list those exact roles for an anime, the panel falls back to the four most-relevant production roles instead.
- **Graceful when data is missing** — anime AniList has no episode data for simply don't show the EPISODES section (no broken state); same for recommendations and staff. The panel still renders everything it can.

**Known limitations:**

- **Episode lists for long-running / ongoing multi-season anime can be incomplete or show a later season's episodes.** AniList sources its episode list from current streaming-service feeds (Crunchyroll, etc.), not from a curated per-season list. For an ongoing franchise where a later season is currently airing, AniList may return that season's episodes — typically a partial, out-of-order slice — under the source anime's query. The panel sorts what it gets by episode number for readability but doesn't try to repair AniList's upstream data. Franchise-episode aggregation (fetching each season's episode list and merging) is queued as a future enhancement that would resolve this for multi-season shows.
- **Episode coverage isn't 100%** — anime without episode data on AniList simply omit the EPISODES section.

**Implementation files:**

- `script.js` (~+163 / ~-12) — both AniList queries (`MORE_INFO_QUERY_BY_SEARCH`, `MORE_INFO_QUERY_BY_ID`) extended in lockstep with `streamingEpisodes`, `recommendations`, and `staff` field blocks (`streamingEpisodes` is `title`-only — no thumbnails/URLs; `staff` is role + romanized name only — no portraits); `fetchRelationsFromAniList` now returns the extended `{ sourceId, edges, streamingEpisodes, recommendations, staff }` shape, with an explicit `!media` failure guard added so all four named failure paths (HTTP non-200, GraphQL errors, no Media match, network throw) return the full empty shape — graceful-degradation contract preserved; recommendations are filtered to non-null `mediaRecommendation` + anime formats at the fetcher; staff is kept raw at the fetcher with the role whitelist applied in the renderer (so the cache stores the full data); `fetchRelationsForModal`'s no-cache-key fallback updated to the new empty shape, cache passthrough otherwise unchanged; `renderMoreInfoPanel`'s success state extended to append three new renderers — `renderEpisodeList`, `renderRecommendations`, `renderStaffCredits` — after the existing relation list; the three renderers placed between `renderMoreInfoEntry` and `toYouTubeEmbedSrc` at the IIFE's 2-space outer indent; episode list collapsed via a CSS-only `<details>/<summary>` when over 8 entries; recommendation cards reuse v1.6.8's `.more-info-entry--clickable` + `data-anilist-id` pattern so the existing modal click-delegation handles them with zero new event-handler branches.
- `style.css` (~+79) — new "v1.6.9 — Richer modal data" section between v1.6.8's `.more-info-loading, .more-info-empty` and the COMMUNITY SHEET STYLES block. 8 new classes, brand-consistent with v1.6.8 (no new color tokens): `.more-info-section-header` (cluster divider — matches `.more-info-title` typography + a bottom border); `.more-info-episodes` / `.more-info-episode-row` (compact title-text rows on `rgba(15,5,28,.45)` 6px-radius backgrounds); `.more-info-episodes-details summary` (the collapsible toggle — `list-style: none` + `::-webkit-details-marker { display: none }` for cross-browser disclosure-marker hiding, `:hover` background change); `.more-info-recommendations` (section wrapper — cards reuse v1.6.8's `.more-info-entry` styles and the nested `.more-info-list` layout); `.more-info-rec-format-badge` (small `TV`/`MOVIE`/`OVA` pill in the rec card corner, mirrors `.more-info-score-badge`); `.more-info-staff` / `.more-info-staff-row` (`Role — Name` text rows, transparent background, no row separator).
- No `admin/new-anime.js` change — the new field blocks are public-modal-only; the admin form doesn't need them.
- No `openModal` markup change — the new clusters render via `renderMoreInfoPanel`'s string output into the existing `.more-info-content` div.

Total: **~242 insertions / ~12 deletions** across 2 files (`script.js`, `style.css`) — plus the version-bump strings and the docs cascade in the gate-8/9 work.

Tier A — `script.js`, `style.css`, and the public anime modal are visitor-facing. `npm test` runs clean before commit at gate 10 (7/7 Playwright; the More Info panel's lazy-fetch path is not under test). Blake's local browser smoke verified Demon Slayer (26-episode list collapsing cleanly, 5 ALSO LIKED cards, 4 STAFF roles), Re:Zero (recommendations + staff render; the episode list reflects AniList's current-feed slice — the known upstream limitation noted above), and a coverage-gap title (EPISODES section absent, no broken state).

**Roadmap cascade:** none — v1.6.9 lands in its planned slot. v1.6.10 (multi-hop franchise traversal + per-entry studio dedupe — closes v1.6.8's two known limitations) is the next immediate ship; two scope additions captured from v1.6.9's smoke feedback: a format badge on the franchise relation rows (visually differentiate Movie/TV/OVA entries), and franchise-episode aggregation as a polish item (the multi-hop traversal infrastructure makes per-season `streamingEpisodes` fetch-and-merge natural). v1.6.11 (Suggestion Box + admin viewer) and the v1.7.x candidates (romaji subtitle, in-site secondary modal — the latter's scope grows to include an "if it's not in the catalog yet" indicator + watchlist hook on the ALSO LIKED cards) remain on their current slots.

<!-- author: Code | date: 2026-05-13 -->
## v1.6.8 — MINOR (2026-05-13)

**Visitors can now click "Click for More Info" on any anime modal to see that show's full franchise — every season as a card, every card a click-through to AniList.** This is Part B of the franchise scope split that began in v1.6.7 (admin-form aggregation was Part A; this is the visitor-facing surface). A collapsible tab on the far-left edge of the anime modal expands into a panel listing the show's prequels, sequels, parents and the current entry itself — each with a cover thumbnail, relation badge, English + romaji title, year / episode count / animation studio, and AniList community score. Every row opens that season's AniList page in a new tab for the deep-dive data the review and community panels don't cover (episode lists, staff, characters, ratings).

- **Collapsible "Click for More Info" tab** on the far-left of the anime modal. Closed by default — clicking expands the panel and shifts the modal contents right; an X on the panel collapses it back. The panel re-opens collapsed for every new anime modal (no carry-over).
- **AniList relations rendered as cards** — one row per related anime (relation types PREQUEL / PARENT / MAIN / SEQUEL, filtered to `type:ANIME` so manga / light-novel adaptations don't pollute the list). Each card: cover thumbnail (AniList `coverImage.large`), relation badge, English title with a smaller romaji subtitle line, `year · N eps · studio(s)` meta line, and AniList `averageScore` as a small badge.
- **MAIN row is visually distinguished** — the current anime (your review's subject) gets a subtle purple border highlight so it's clear which entry you're reading about. It's also fully clickable like every other row.
- **Chronological sort** — entries ordered by season year, with a type-order tiebreaker (PREQUEL < PARENT < MAIN < SEQUEL) for same-year ties — same ordering logic as v1.6.7's admin-form franchise panel.
- **Every row is clickable** — opens `anilist.co/anime/{id}` in a new tab. Per Blake's design call, this includes MAIN: a visitor can deep-dive the current anime's verified AniList data (full episode list, staff credits, character list, community ratings) without leaving the review page.
- **Lazy fetch + session cache** — no AniList request fires until the visitor expands the panel. Once fetched, re-opening the panel for the same anime in the same session is instant (in-memory cache, cleared on page reload).
- **Popularity-sorted search** — the source anime is resolved against AniList via `Page(media:, sort: [POPULARITY_DESC, SCORE_DESC])` (mirroring the admin form's pattern), so an ambiguous short title like "Demon slayer" resolves to Kimetsu no Yaiba — the most-popular match — instead of an obscure same-named entry.
- **Graceful degradation** — AniList errors, rate-limits, or no-match all render a friendly "No franchise info available yet." state instead of breaking the modal. A standalone anime (no franchise relations) still shows its single clickable MAIN row.
- **Brand-consistent styling** — purple gradient, Montserrat header pattern, Japanese subtitle (`詳細情報`), 12px radius — the same visual vocabulary as v1.6.7's admin franchise panel and v1.6.5's live-preview panel.

**Known limitations (queued for v1.6.10):**

- **Multi-hop relations not yet traversed** — fetching One Punch Man Season 1 catches Season 2 (a SEQUEL) but not Season 3 (AniList stores S3 as a SEQUEL of S2, one hop further out). Same single-hop scope as v1.6.7's admin aggregation; multi-hop is queued for v1.6.10.
- **Per-entry studio dedupe** — entries like Frieren Season 2 show `MADHOUSE, MADHOUSE` because AniList double-credits the same studio. Cosmetic; the one-line fix is bundled into v1.6.10.

**Implementation files:**

The data shape (`relations.edges.node`) and the aggregation logic were already in place from v1.6.7's admin-form work — v1.6.8 reuses the same shape and renders it in a different surface (the public modal instead of the admin form's sidebar). Three files touched:

- `script.js` (+309) — `findInCatalog()` helper (carried over from the initial click-through design, now unused after the gate-5c switch to universal AniList click-through; left in place, reaped in a future polish gate); a new self-contained "More Info panel" block — `ANILIST_ENDPOINT_PUBLIC` constant, `MORE_INFO_QUERY_BY_SEARCH` (popularity-sorted `Page(media:)`) + `MORE_INFO_QUERY_BY_ID` (direct `Media(id:)`) GraphQL strings, `buildMainNode()` (synthesizes the MAIN row from local catalog data + the AniList-resolved source id), `fetchRelationsFromAniList()` (returns `{ sourceId, edges }`, no-throw graceful-empty contract), `fetchRelationsForModal()` (in-memory cache wrapper), `renderMoreInfoPanel()` (pure HTML-string renderer, four states), `renderMoreInfoEntry()` (per-row markup); `openModal()` gains the `.more-info-container` markup (collapsed tab + expanded panel + header + content slot) as the modal's first column, plus three event listeners (tab-click expand+fetch+render, X-close, card-click → `window.open` AniList in a new tab).
- `style.css` (+210 / -1) — new "v1.6.8 — More Info panel" section (~205 lines): `.more-info-container` (collapsed 140px / expanded 260px width transition), `.more-info-tab` (the far-left pill), `.more-info-panel` (slide-out, purple gradient), `.more-info-close` (mirrors the sheet close button), `.more-info-header` + reuse of the existing `.jp-mini`, entry-row classes (`.more-info-entry`, `--current`, `--clickable` + `:hover`, `.more-info-cover` + `--placeholder`, `.more-info-relation`, `.more-info-english`, `.more-info-romaji`, `.more-info-meta`, `.more-info-score-badge`), and `.more-info-loading` / `.more-info-empty` fallback states; the `.modal.duo .modal-content` grid changes from `1.6fr 1fr` to `auto 1.6fr 1fr` (the auto column is the More Info container); a one-line `.more-info-container { width: 100% !important; }` rule added inside the existing `@media (max-width: 1000px)` block so the new column stacks with the sheets on narrow viewports.
- `admin/new-anime.js` (+2) — `coverImage { large }` added to the `relations.edges.node` block in both `FULL_QUERY` and `FULL_QUERY_BY_ID` (parity), so the admin form's `relations` payload carries the cover URLs the public panel renders. Purely additive — no admin-form behavior change.

Total: **521 insertions / 1 deletion** across 3 files (vs the v1.6.7 commit).

Tier A — `script.js`, `style.css`, and the public anime modal are visitor-facing. `npm test` runs clean before commit at gate 10 (7/7 Playwright; the More Info panel's lazy-fetch path is not under test). Blake's local browser smoke verified the panel across Demon Slayer (multi-season franchise rows), Re:Zero, and a standalone title — collapsed tab → expand → AniList rows render with covers + badges + meta + scores → every row click-through to AniList in a new tab → X collapse. Three internal iteration passes (gate 4b re-indent for IIFE consistency; gate 5b query split fixing an AniList null-constraint 404; gate 5c popularity-sort fixing the "Demon slayer → Onigiri" misresolve plus the universal-click-through behavior change) folded into the final result.

**Roadmap cascade:** none — v1.6.8 lands in its planned slot. v1.6.9 (richer modal data — per-episode names + recommendations + staff credits) and v1.6.10 (multi-hop franchise traversal + per-entry studio dedupe — closes the two limitations noted above) remain on their current slots.

<!-- author: Code | date: 2026-05-12 -->
## v1.6.7 — MINOR (2026-05-12)

**The admin form now aggregates franchise data automatically when fetching multi-season anime.** Fetching One Punch Man pulls Season 1 + Season 2 + Road to Hero in one go and prefills the form with franchise totals (3 entries, 25 episodes, MADHOUSE / J.C.STAFF studio union) instead of just Season 1's data. A new FRANCHISE INFO panel surfaces the related entries (prequels, parents, sequels) in chronological order; an amber heads-up warning fires when the fetched entry has a PREQUEL, pointing toward the cleaner Season 1 fetch.

- **New FRANCHISE INFO panel** in Section 2 of the admin form. Populated automatically when AniList's `relations` field includes a franchise chain (relation types: PREQUEL / PARENT / MAIN / SEQUEL, filtered to `type:ANIME` so manga / light novel adaptations don't pollute the aggregate). Hidden for single-season entries. Brand-consistent styling (purple gradient, Montserrat header with `フランチャイズ` subtitle) mirrors the v1.6.5 live preview panel.
- **Seasons field now prefills from franchise season count** when aggregation finds multiple entries (e.g. `3 seasons` for OPM). Falls back to the existing single-entry format heuristic (`1 season` / `1 movie` / `1 ova` / etc.) when aggregation produces a single entry.
- **Studio field now unions all animation studios across franchise entries** when the count is >1 (e.g. `MADHOUSE, J.C.STAFF` for OPM where Season 1 was Madhouse and Season 2 was J.C.Staff). Falls back to the single-entry `pickAnimationStudios()` pick otherwise. Case-insensitive dedupe via Map keyed on lowercased name; original capitalization preserved through the existing `maybeCapitalize` helper (which intentionally doesn't transform all-caps studio names like `MADHOUSE`).
- **AniList summary line appends `franchise: N entries, X ep`** when aggregation finds multiple entries. Single-season fetches keep the old 3-part summary (`AniList ID · score · romaji title`) unchanged.
- **New amber `'warn'` status-kind** for hint-level messages — the PREQUEL heads-up reads *"Heads up: this entry has a PREQUEL on AniList — aggregation may miss earlier seasons. For the cleanest franchise data, fetch Season 1."*. Distinct visual treatment (`color: #ffb84d`) from the existing `'info'` (default neutral) and `'error'` (red) kinds. One-line surgical extension of `setStatus()` at the existing site.
- **Single-hop traversal scope.** Aggregation walks ONE hop of `media.relations.edges` from the fetched entry. **Known limitation:** late-chain seasons won't appear if AniList stores them under another season's SEQUEL relation. Canonical example: fetching OPM Season 1 catches PREQUEL Road to Hero and SEQUEL Season 2, but does NOT catch Season 3 (AniList stores it as a SEQUEL of Season 2). Acknowledged honestly here; multi-hop is queued for a future polish ship — see `docs/NEXT.md` v1.6.x polish backlog entry added in this ship's gate 9.

**Implementation files (Part A scope — admin form only):**

Part B ("More Information" panel on public anime modal) was split out to v1.6.8 at gate 0/1 per the lower-blast-radius recommendation — Part A and Part B share the same `relations` data shape but render in different surfaces, and shipping the admin-form aggregation first lets the next-anime-add immediately benefit while v1.6.8's public-modal panel work proceeds independently. v1.6.7 touches three admin-only files:

- `admin/new-anime.js` — `FULL_QUERY` and `FULL_QUERY_BY_ID` expanded with the `relations` block (+32 lines, parity for search-by-title and fetch-by-ID paths); new `aggregateFranchise()` helper with a `TYPE_ORDER` constant (`PREQUEL: 0, PARENT: 1, MAIN: 2, SEQUEL: 3`) used as the secondary sort key so same-year ties resolve in natural reading order (+56 lines including comment); `populateForm()` updated with 5 surgical edits (franchise computation up front, franchise-aware seasons logic, franchise-aware studio union, multi-part `anilist-summary`, PREQUEL warning + `renderFranchisePanel(franchise)` call before `updatePreview()`); new `renderFranchisePanel()` helper (~37 lines, pure-DOM, no async, reuses existing `$()`/`escapeHtml`/`maybeCapitalize`); one-line `setStatus()` extension for the new `'warn'` kind.
- `admin/new-anime.html` — new `#franchise-info-panel` block in Section 2 between the section head and the admin grid (+13 lines). IDs: `franchise-info-panel`, `franchise-season-count`, `franchise-total-ep`, `franchise-studios`, `franchise-entries` (each consumed by `renderFranchisePanel()`).
- `admin/new-anime.css` — new FRANCHISE INFO panel section at end of file (+90 lines): `.franchise-info-panel`, `.franchise-info-header` + `.jp-mini`, `.franchise-info-stats`, `.franchise-entries` row styling, plus the `.status-line.warn` amber variant.

Total: **269 insertions / 7 deletions** across 3 files. The 7 deletions are existing single-entry heuristic lines being replaced surgically by franchise-aware logic — no behavior loss, just decision-point swaps.

Tier A — admin form behavior change visible to admin user (UID-gated; visitor-facing path is unchanged in this ship). `npm test` runs clean before commit at gate 10 (7/7 Playwright; admin-form path not under test). Blake's local browser smoke verified Test 1 (OPM by ID 21087) end-to-end with all 5 visual criteria; Tests 2 (Frieren via search-as-you-type) and 3 (Charlotte single-season fallback) confirmed before ship.

**Roadmap cascade:** previously-queued v1.6.7 (the full panel-on-modal + aggregation bundle) split into Part A (this ship) + Part B (v1.6.8 — More Information panel on the public anime modal). Previously-queued v1.6.8 (Suggestion Box + admin viewer) shifts to v1.6.9.

<!-- author: Code | date: 2026-05-11 -->
## v1.6.6 — PATCH (2026-05-11)

**Hotfix: cover images now fill the anime card frame cleanly.** Switched `.card img` from `object-fit: contain` to `object-fit: cover` in `style.css:218` so AniList covers (and any source image not pixel-perfect 2:3) crop a few invisible edge pixels rather than letterboxing with visible dark bars inside the card frame.

- `style.css:218` — `object-fit: contain` → `object-fit: cover` on the `.card img` rule. Pure `+1 / -1` diff. Affects both homepage cards (via `card-render.js`'s output) AND the admin form's live preview slot (which inherits the rule via the shared `.card` class).

**Why it slipped through v1.6.5:** the rule was authored long before AniList sources came into use, and the project's 44 curated `assets/*.png` cover images happen to be ≈2:3 (most are 460×686, exactly the form copy's recommended ratio) — so `contain` and `cover` produced identical output in the live catalog. v1.6.5's live preview was the first feature to pipe an AniList CDN URL into a `.card` element, and AniList covers aren't always strictly 2:3 (the Gosick example Blake hit during v1.6.5 smoke is ~420×590, ratio 1:1.405 vs. 2:3's 1:1.5). Visible bars appeared. Queued in `docs/NEXT.md` v1.6.x as a polish ship; addressed here as a same-day hotfix since the AniList live-preview entry path was a v1.6.5 deliverable and visible-broken cards undermine the feature's value.

Tier A — `style.css` is visitor-facing (homepage cards). `npm test` ran clean (7/7 in 15.6s). Blake's local browser check confirmed: live preview card now shows the AniList cover filling the card frame, no empty bars.

<!-- author: Code | date: 2026-05-11 -->
## v1.6.5 — MINOR (2026-05-11)

**Live preview as you type ships for the admin form — type a title (search-as-you-type dropdown) or paste an AniList URL/ID, see the prefilled form AND a live preview card that mirrors the homepage card rendering 1:1, with the preview panel staying pinned as you scroll through edits.** The headline is the live preview, but the enabling refactor is the bigger structural shift: the card-render function moves out of `script.js`'s IIFE into a shared `card-render.js`, so both the homepage and the admin form draw cards from the same code — no fork, no drift, no copy-paste duplication. This is also the first ship driven by the multi-gate Code/Cowork workflow with rolling `docs/SHIP-PROMPT.md` + `docs/SHIP-OUTPUT.md` files; gate-level browser smoke tests caught two bugs pre-commit that would have shipped under the previous "test then ship" rhythm.

- `card-render.js` (NEW) — 92-line classic-script file containing the extracted `renderAnimeCardMarkup` and a local `slug()` helper. IIFE wrapper keeps everything local except one `window.renderAnimeCardMarkup = …` global attachment. Loaded by `index.html`, `account.html`, and `admin/new-anime.html` via `document.write` BEFORE any module so the function is reachable from module code. WHY-block comment in the file explains the byte-equivalence requirement (homepage must render identically post-refactor) and the slug duplication rationale (5-line cost beats touching `script.js`'s 6 other slug call sites).
- `script.js` — 44-line inline `renderAnimeCardMarkup` definition removed; `createCard` now calls `window.renderAnimeCardMarkup(...)` explicitly (explicit-form picked over implicit-global so a future local rename in `script.js` can't silently shadow). 5-line comment replaces the removed function explaining where it lives now.
- `admin/new-anime.js` — search-as-you-type wired on the title input (250ms debounce, AniList `Media(search:)` returns up to 8 results); arrow-key + Enter keyboard nav on the dropdown; click-outside dismisses; second entry path "Fetch by AniList ID or URL" parses bare numerics and `anilist.co/anime/<id>/…` URLs; `populateForm` now drives a live preview card that re-renders on title/genre/rating edits via a 120ms debounce; image-override toggling re-renders the preview in real time. Feature was originally spec'd in `docs/mode1-design.md` §7 ("Live preview as you type").
- `admin/new-anime.html` — Section 1 grows a sticky `<aside class="admin-card-preview-panel">` for the live preview; new `<input id="anilist-id-input">` + Fetch-by-ID button as a co-equal entry point per the `b+` design in `docs/NEXT.md`; Section 1 header renamed "Find the anime on AniList" → "Find the Anime" (the AniList qualifier was internal-jargon for the form's first-time admin user); `<script src="../card-render.js?v=${v}">` document.write injection before module loads.
- `admin/new-anime.css` — sticky preview panel (`position: sticky; top: 20px`), search-results dropdown (purple-tinted, brand-consistent), keyboard-highlight state, ID-input row layout, preview-slot frame.
- `style.css` — `html, body { overflow-x: hidden }` → `overflow-x: clip`. `clip` provides identical no-horizontal-scroll behavior as `hidden` but doesn't establish a containing block for `position: sticky` descendants. Browser support: Chrome 90+, Firefox 81+, Safari 16+ — all evergreen browsers as of 2026, no fallback needed. The classic CSS sticky-breaker that almost every codebase trips into once; commented in-place so a future "cleanup" can't revert it without seeing the why.
- `admin/new-anime.js` (gate 5c title-case fix) — `populateForm` overwrites the title input with AniList's canonical title (English → romaji → preserve-typed-value precedence) so saved data matches the show's official spelling. Caught at gate 5c smoke: typing `gosick` (lowercase) loaded `GOSICK` from AniList correctly, but the form kept the user's lowercase input — would have entered the catalog as `gosick`. Same expression pattern as the dropdown's `renderSearchResults` so display + save logic agree.
- `firebase.json` — `docs/SHIP-PROMPT.md` and `docs/SHIP-OUTPUT.md` added to the `ignore` array (rolling Cowork prompt + Code output files used during multi-gate ships should never deploy). Same `.gitignore` ↔ `firebase.json` mirroring discipline that fixed the v1.3.5 PERSONAL.md leak and v1.3.9 AUDIT_*.md leak.
- `scripts/bump-version.js` — header docstring + new TARGETS `NOTE:` comment clarify that TARGETS manages 14 STATIC version strings (CSS `<link>` cache-busts + the `APP_VERSION` script tag + the changelog widget span fallback). All JS file cache-busts (`script.js`, `firebase.js`, `admin-fab.js`, `account.js`, `new-anime.js`, `card-render.js`) use runtime template-literal interpolation (`${v}`) in `document.write` and are intentionally NOT in TARGETS — adding them would replace the `${v}` template with a concrete version on the first bump, corrupting the dynamic-versioning pattern. Documented as a deliberate deviation from Cowork's gate 5b spec which had assumed TARGETS should grow to 17.
- `index.html` widget content — one bullet stamped `05/11/2026` per the visitor-first widget skill: "Improved the tools used to add new anime to the catalog." Single bullet because all four pieces (refactor, search-as-you-type / ID-import / live preview, sticky fix, title-case fix) collapse to the same visitor-side delta (zero — admin form is UID-gated); multiple bullets all saying "improved" would dilute the per-change granularity rule. Bullet prepended to the existing `05/11/2026` section's `<ul>`; total visible widget now at the 10-bullet cap.

**Multi-gate browser smoke tests caught two plan-level misses pre-commit.** Gate 1's extraction plan assumed `script.js` was loaded in the admin-form context — it wasn't, because `admin/new-anime.html` only loads `firebase.js` + `new-anime.js` modules, not `script.js`. So `window.renderAnimeCardMarkup = …` assigned but the function was never defined in the admin-form's window. Gate 5b's interactive smoke surfaced this immediately (`typeof window.renderAnimeCardMarkup === 'undefined'` in the admin form console); the card-render.js extraction (above) is the proper fix. Gate 5c surfaced the second: the gosick title-case bug detailed in its own bullet above. Both bugs lived in working-tree code, not yet committed; both were caught by paused-for-review interactive verification BEFORE the commit existed — exactly the "test the pipeline at the commit you're shipping" discipline codified in the v1.6.2 DECISIONS lesson, now applied at the gate level rather than only at the ship level.

Tier A — `card-render.js`, `script.js`, both HTMLs, both CSS files, the admin form JS, and the widget content are all visitor-facing (homepage path) and admin-facing (admin form path). `npm test` ran clean at gate 5b (Playwright 7/7 in 14.3s) and again at gate 5c (7/7 in 15.5s). Live preview, search-as-you-type, ID-import, sticky panel, label rename, and title-case fix all verified in browser at `http://127.0.0.1:8888/admin/new-anime` before any code committed.

**Visitor-side reality:** nothing visible changes for site visitors. v1.6.5's work is admin tooling — the new-anime form is UID-gated, the homepage card rendering is byte-equivalent to v1.6.4 (`card-render.js` extraction was specifically gated on visual byte-equivalence), and the only visitor-touchable change is the one widget bullet ("Improved the tools used to add new anime to the catalog.") in the changelog box. The widget bullet's voice is honest: no version reference, no internal terms, no overclaim.

Roadmap cascade: v1.6.6 (More Information panel) and v1.6.7 (Suggestion Box) stay on their current slots — v1.6.5 lands on schedule and unblocks both successors.

<!-- author: Code | date: 2026-05-11 -->
## v1.6.4 — MINOR (2026-05-11)

**Update log widget upgrade — first feature ship under the new visitor-first widget skill.** The homepage update log gains shipped-on dates on every change, date-grouped sections (replacing the old flat list), capacity raised from 5 to 10 most-recent entries, and internal scroll containment so the widget no longer pushes the rest of the homepage down when content accumulates. The widget skill is updated in the same ship to codify the new rules.

- `index.html` — widget content area restructured from a flat `<ul class="changelog-list">` into nested `<div class="changelog-content">` → `<div class="version-section">` blocks, each with an `MM/DD/YYYY` `<div class="version-header">` above its bullets. Existing five production bullets retroactively distributed under their ship-date headers (`05/10/2026` for the four v1.6.0 entries; `05/11/2026` for the v1.6.3 backfill).
- `style.css` — added `.changelog-content` (max-height 300px + overflow-y auto + custom purple-gradient scrollbar matching the project palette), `.version-section`, `.version-header` (muted soft-white at 55% opacity, ~0.78rem Montserrat). No upstream changes to existing widget rules.
- `docs/SKILLS/widget-update-skill.md` — six surgical edits: cap raised 5 → 10, new "date header" rule item, granularity callout added to the curation table, multi-piece-ship example added to Good vs Bad, structural HTML example refreshed to match the actual widget (the old example referenced classes that didn't exist), backfill-consolidation section removed entirely, "Why this skill exists" trade-off paragraph updated for the new cap. Voice guidelines section unchanged.
- `index.html` widget content (per the new per-change rule) — four bullets stamped `05/11/2026`: "Added shipped-on dates to the update log," "Grouped the update log so changes appear by date," "Made the update log show 10 entries instead of 5," "Made the update log scroll inside its panel."
- `ROADMAP.md`, `docs/NEXT.md`, `docs/AI-PRIMER.md` — cascade for the deferred live-preview ship: live preview + ID-import → v1.6.5, More Information panel → v1.6.6, Suggestion Box → v1.6.7, TBD upgrades → v1.6.8+.

**AniList recovery note:** AniList's `Media(search:)` endpoint recovered partway through this session after ~36 hours down (verified against six titles including Vinland Saga, Naruto, Frieren). v1.6.5 (live preview + ID-import per the `b+` design) is unblocked once this widget upgrade ships.

Tier A — `index.html`, `style.css`, and the widget bullets are all visitor-facing. `npm test` ran clean (Playwright 7/7).

<!-- author: Code | date: 2026-05-11 -->
## v1.6.3 — PATCH (2026-05-11)

**Polish bundle + first widget update under the new visitor-first skill.** Originally scheduled for the live-preview-as-you-type Mode 1 feature, but that's deferred to v1.6.4 — AniList's `Media(search:)` endpoint has been returning `Not Found` for 30+ hours and the live-preview UX literally requires it. Shipped instead: small overdue items.

- `scripts/mode1-server.js` — `/api/health` reads `APP_VERSION` dynamically via the existing `readCurrentVersion()` helper instead of hardcoding (was stuck at `"1.6.1"` after v1.6.2 bumped past it). Drift class closed.
- `docs/SKILLS/release-skill.md` — new Step 4.5 ("Update the widget bullets") between the CHANGELOG step and the ROADMAP step, referencing `widget-update-skill.md`.
- `docs/SKILLS/hotfix-skill.md` — new decision #6 ("Widget bullets are required even for hotfixes"), names v1.6.1 as the precedent for the gap that v1.6.3 backfills.
- `docs/AI-PRIMER.md` — "For deeper context" section now lists all three skill files so new sessions find the procedure docs from the primer.
- `index.html` — homepage widget bullets updated under the new skill. One combined backfill bullet ("Made some behind-the-scenes improvements to how the site is built. Nothing visible changes.") covers v1.6.1 + v1.6.2 + v1.6.3 — all three tooling ships that didn't curate bullets at ship time. Per the skill's first-time-visitor rule, bullet doesn't reference any version. (Note: `account.html` not edited — the widget lives only in `index.html`, contrary to what the original `widget-update-skill.md` claimed; see next bullet.)
- `docs/SKILLS/widget-update-skill.md` — corrected a factual error in the "Where the bullets live" section: only `index.html` hosts the widget, not both files as the initial version of the skill claimed. Caught at gate 6 prep while reading the actual file structure — literally the verification discipline the v1.6.2 DECISIONS entry advocates, applied to the very skill being introduced.

Roadmap cascade: live preview as you type → v1.6.4 (with ID-import as first-class entry point — AniList outage exposed that ID-import is durable infrastructure, not a workaround), More Information panel → v1.6.5, Suggestion Box → v1.6.6.

Tier A — widget bullet in `index.html` is visitor-facing. `npm test` ran clean (gate 6).

<!-- author: Code | date: 2026-05-11 -->
## v1.6.2 — PATCH (2026-05-11)

**Prevention follow-up to Bug 10.** Mode 1 server now smoke-checks `runCmd` at startup — runs `npm --version` and `git --version` through the same code path the pipeline uses, before `app.listen()`. If either spawn throws (e.g., `spawn EINVAL`), the server exits with an error message that names Bug 10 by name, points at the WHY comment above `runCmd`, and (for `EINVAL` specifically) suggests the most likely regression cause.

- `scripts/mode1-server.js` — new `smokeCheckSpawn()` (~20 lines) placed near the existing pre-flight helpers; called via `.then()` before the `app.listen()` block.
- `docs/DECISIONS.md` — new entry "When you touch a pipeline's plumbing, re-run the pipeline at the commit you're shipping (lessons from Bug 10)" capturing the meta-lesson: pre-ship testing on prior-state code doesn't validate the post-edit code. The spawn config was the surface bug; the verification discipline is the structural fix.
- `docs/NEXT.md` — added "Playwright test for Mode 1 server using `?skipPush=1`" under Polish + tech debt (queued behind v1.6.3 live preview).

Tier B — Mode 1 server is tooling, not deployed to production. Tests not required per `CLAUDE.md` rule #7 (tooling exception). Manual verification before ship: ran the synthetic Mode 1 pipeline against AniList ID 21507 (Mob Psycho 100, fetched by ID since AniList search has been flaky) with `?skipPush=1` — smoke check ran cleanly at startup, all 9 pipeline steps completed green, no public footprint (synthetic ship rolled back).

Roadmap cascade: previously-queued v1.6.2 (live preview as you type) → v1.6.3, v1.6.3 (More Information panel) → v1.6.4, v1.6.4 (Suggestion Box) → v1.6.5.

<!-- author: Code | date: 2026-05-10 -->
## v1.6.1 — PATCH (2026-05-10)

**Hotfix: Mode 1 local server crashed at `npm test` on Windows + Node ≥20.12.2 with `spawn EINVAL`.** Reverted v1.6.0's `shell: false` + `.cmd`-extension change in `runCmd` back to `shell: true` for npm/npx/firebase.

- `scripts/mode1-server.js:60-72` — `runCmd` reverted to original spawn pattern; added a 17-line WHY comment naming Bug 10 and explaining DEP0190 doesn't apply (every `args[]` in this file is a static string literal — no user input flows into npm/firebase/npx).

This slipped through because v1.6.0's pre-ship Playwright suite ran via the `Bash` tool, not via the Mode 1 server pipeline — `runCmd` was never exercised. Caught immediately during the post-deploy "Mob Psycho 100" sanity test, before any user-visible damage. (The Bug 9 image-registration fix was confirmed working in the same test run.)

Tests not required per `CLAUDE.md` rule #7 (tooling exception — Mode 1 server isn't deployed to production). `npm test` was run anyway as a sanity check that the test pipeline itself isn't broken: 7/7 passed in 11.4s.

Bundled in this commit: `docs/SKILLS/hotfix-skill.md` (this skill, used to ship the hotfix it documents); `docs/NEXT.md` (persistent backlog file added by Cowork); `docs/AI-PRIMER.md` updated to current state; ROADMAP cascade — what was queued as v1.6.1 (live preview), v1.6.2 (More Information panel), v1.6.3 (Suggestion Box) shifts to v1.6.2 / v1.6.3 / v1.6.4 respectively.

<!-- author: Code | date: 2026-05-10 -->
## v1.6.0 — MINOR (2026-05-10)

**Phase B begins: Mode 1 baseline + local "one-click ship" server.** Adding a new anime drops from "edit JS by hand, copy to Excel manually, hope you got the format right, run sync, run tests, bump version, commit, push, deploy" down to **type a title, write a review, click Submit & Ship.** The local Node server orchestrates the whole pipeline in ~30 seconds with a real-time progress stream.

**Two ship modes (auto-detected by the form):**

- **Local mode** — `npm run mode1` starts an Express server on `http://localhost:8888`. Form detects the server, button reads "Submit & Ship", clicking it runs the full 9-step pipeline (Excel backup + append → image download → sync → widget update → version bump → CHANGELOG entry → tests → git commit + push → Firebase deploy) with SSE-streamed progress. Pauses for explicit confirmation before the production deploy.
- **Remote (deployed admin form, fallback)** — same form at `realanimereviews.com/admin/new-anime`, but no server reachable → button reads "Generate Excel Row" → outputs a tab-separated row + command sequence to run locally. Same data model, just two-step.

**New entry point:** floating "Admin" pill in the bottom-right corner of every page (visible ONLY when signed in as admin per UID match). Click → dropdown menu of admin tools → "+ Add Anime" navigates to the form. Designed to extend — future Mode 2 dashboards, audit views, etc. plug into the same `ADMIN_MENU_ITEMS` array.

**The form itself:**
- Type title → AniList GraphQL fetch (browser-side, CORS-friendly, no backend needed)
- Pre-fills genre, seasons, description (trimmed to ~600 chars), studio (with auto-capitalization for all-lowercase names), trailer (auto-normalized to `/embed/`), official streaming list, top 8 high-rank tags
- Image preview shows AniList default cover with dimensions and a "⚠ not 2:3" warning if aspect ratio is off; **Override** button reveals a filename input for Blake's manual file (per project rule #9 hybrid image curation)
- Watch is split into Official (green badge, AniList prefills) and Unofficial (orange badge, Blake fills) — combined + deduped on save
- Custom number stepper for Top 10 Rank (matches site purple gradient instead of browser default arrows)
- Inline AI suggestion panels next to Description and Tags — open Claude with a pre-filled prompt, paste response back, Use this populates the field. (Real one-click integration via Cloud Function planned in v1.6.x — see `docs/ai-integration-design.md`.)

**Mode 1 server safety baked in:**
- **Pre-flight checks** before any mutation: Excel lock file detection (friendly error if Excel is open), duplicate-title check against existing animeData.js
- **Excel backup** (`.bak.<timestamp>.xlsx`) before every write — recovery path for failed ships since git can't roll back Excel
- **Image overwrite refused** — server throws if `assets/<slug>.png` already exists (curated assets protected)
- **Slug-based image fallback in sync** — if the new entry has no prior animeData.js entry, sync looks for `assets/<slug>.png` (or .jpg/.webp) before falling back to placeholder. The Mode 1 download lands at exactly that path.
- **Override post-patch** — if Blake provided a custom filename, server patches animeData.js after sync to use it
- **Tests must pass** before commit — chain stops on `npm test` failure
- **Production deploy requires explicit UI confirmation** — server pauses with `awaitingDeploy: true`, form shows a "Yes, deploy now" button
- **Scoped git add** — only commits files this ship is supposed to touch (CHANGELOG, animeData.js, HTMLs, the new image), leaves unrelated WIP alone
- **`?skipPush=1` flag** for testing — runs everything except push and deploy, leaves zero public footprint
- **ANSI escape stripping** in log streams — server console output is readable in the form's collapsible "Show server output" details panel
- **No `shell: true` for git/node** — eliminates Node 22's DEP0190 deprecation warning AND the previous arg-mangling bug from cmd.exe quote handling

**Tooling extended:**
- `scripts/mode1-server.js` — the local Express server (~400 lines). One command: `npm run mode1`.
- `scripts/sync-excel-to-js.js` — added `slugify()` helper + slug-based image fallback (Bug 9 fix from the testing report).
- `scripts/bump-version.js` — extended from 7 to 14 version-string targets (added admin-fab.css cache-busts in index/account, plus 5 in admin/new-anime.html).
- `package.json` — added `express ^4.21.0` dev dependency, `mode1` npm script.

**New documentation:**
- `docs/mode1-design.md` — full architecture for the form + server, file layout, security model, upgrade arc through v1.6.x.
- `docs/ai-integration-design.md` — three-option plan for upgrading the inline AI panel from copy/paste to one-click (Cloud Function recommended).

**What's NOT in v1.6.0** (saved for v1.6.x):
- Live preview as you type (search-as-you-type AniList dropdown + live card preview)
- "More Information" panel on cards (left-side mirror of Community Tab)
- Suggestion box integration (public form + admin queue + handoff)
- Real one-click AI integration (replacing the current paste-back workaround)
- One-click full automation without the deploy confirmation gate

**Tested by Code** in a separate session via the `?skipPush=1` test path (Vinland Saga end-to-end). All 9 pipeline steps green; 8 bugs surfaced and fixed before this ship; clean rollback verified via Excel `.bak` restore + `git stash`. See test report from 2026-05-10 for details.

**Tests required and passed** (Tier A — production code change). Per project rule #7.

**Up next:** v1.6.1 polish — live preview as you type (search dropdown + live card preview). Then v1.6.2+ per the Phase B upgrade arc.

<!-- author: Code | date: 2026-05-09 -->
## v1.5.1 — PATCH (2026-05-09)

**Top 10 rank #1 corrected.** Excel had Farming Life in Another World listed as #1 (typo); should have been The Eminence in Shadow. Fixed in `Anime_Master_Table.xlsx`, propagated to `animeData.js` via the v1.5.0 sync pipeline. First real-world use of `npm run sync` for a content update — pipeline worked as designed.

<!-- author: Code | date: 2026-05-09 -->
## v1.5.0 — MINOR (2026-05-09)

**Phase A complete: Excel → animeData.js sync ships.** `Anime_Master_Table.xlsx` is now genuinely canonical for anime data per project rule #1. The hand-copy workflow that's been in place since launch is replaced by a single command: `npm run sync` reads Excel, transforms, validates, regenerates `animeData.js`. v1.5.0 is the foundation that makes Mode 1 (v1.6.0+) possible.

**New tooling:**
- `scripts/sync-excel-to-js.js` — Node script with `--dry-run`, `--validate`, and `--check` modes. Reads `.xlsx` via the `xlsx` Node library. Documented in `docs/SKILLS/release-skill.md` and `docs/schema-diff.md`.
- `xlsx@^0.18.5` added as a dev dependency. Run `npm install` once after pulling. The `npm audit` warning about `xlsx` is for malicious-user-input scenarios; not relevant when processing your own master file.
- `npm run sync`, `npm run sync:check`, `npm run bump`, `npm run anilist` shortcuts added to `package.json`.

**Excel structure: 12 existing columns + 5 new:**
- Existing: `Title, Rating, Seasons, Genre, Description, Review, Tags, Watch, Studio, Trailer, FORMAT:, EXAMPLE:`
- Added 2026-05-09: `Top10Rank, AniListId, IdMal, AniListScore, AniListColor` (last four empty until Mode 1 starts populating in v1.6.0)
- `FORMAT:` and `EXAMPLE:` are reference-only and ignored by the sync script

**Transformations the sync script applies:**
- `Tags`: Excel format `#action #fan service #OP MC` → JS array `["action", "fan-service", "op-mc"]`
- `Watch` → `Platforms`: comma-split with auto-detection of merged platform names (e.g., `Netflix hianime` → `["Netflix", "hianime"]`)
- `Trailer` URL normalization: `youtu.be/X?si=...`, `youtube.com/watch?v=X`, and bare `youtube.com/X` all auto-normalize to `https://www.youtube.com/embed/X`. Sync no longer fails on share URLs.

**Fuzzy title matching** preserves existing image filenames despite drift between hand-typed `animeData.js` and Excel: case-insensitive, curly apostrophes (`’`) normalized to straight (`'`), Unicode dashes (`−` `–` `—`) normalized to hyphen-minus (`-`), whitespace collapsed. 41 of 44 entries matched on first run; remaining 3 resolved via in-Excel typo fixes and one manual post-sync image patch.

**Validation rules** (sync FAILS on any of these):
- Title required, no duplicates
- Rating matches `X/10` or `X.Y/10`
- Trailer matches `https://www.youtube.com/embed/<id>` after normalization
- Genre, Description, Review, Tags, Watch all non-empty

**Image curation per project rule #9 (hybrid):**
- Existing entries: image filename preserved from current `animeData.js` via fuzzy title match
- Genuinely new entries: `placeholder.png` + warning logged. Mode 1 (v1.6.0) will auto-download covers from AniList.
- v1.5.0 ship: Apocalypse Bringer Mynoghra received a manual one-line image patch after sync (subtitle change made the fuzzy match miss; existing `apocalypse-bringer.png` re-linked)

**44 anime resynced.** `animeData.js` regenerated end-to-end. File diff: −860 bytes (script writes consistent JSON-style escaping vs prior hand-edits). All 7 Playwright tests pass against the new file. Web server log shows every cover image returning HTTP 200.

**Three Excel typos fixed by Blake during this ship:**
- Solo Leveling: `Shoen/Action` → `Shonen/Action`
- Frieren: Beyond Journey's End: `Fantasty/Drama` → `Fantasy/Drama`
- The Dangers in My Heart: `Romance/Slife of Life` → `Romance/Slice of Life`

Plus one DanDanDan → DanDaDan correction (the official transliteration of ダンダダン uses 2 n's, not 3).

**Top 10 list now editable in Excel** via the `Top10Rank` column (1-10 integer; empty = not in top 10). Position #8 currently empty by Blake's choice.

**Tests required and passed** (Tier A — production code change). Per project rule #7.

**What's next:** Phase B begins. v1.6.0 ships Mode 1 baseline (form-based new-anime creation with AniList prefill, admin UID gate). `docs/anilist-spike.md`, `docs/CODE-PROMPTS.md §1`, `docs/SKILLS/release-skill.md`, and `scripts/anilist-fetch.js` are all ready inputs.

<!-- author: Code | date: 2026-05-09 -->
## v1.4.3 — PATCH (2026-05-09)

**Tooling and docs infrastructure ship.** No production-facing code touched. Tests not required per docs-only/tooling exception in `CLAUDE.md` rule #7.

**Repository relocated.** Project moved from `C:\Users\Owner\Real Anime Reviews\` to `C:\Users\Owner\PROJECTS\Real Anime Reviews\` (next to other projects like CV Builder, PickleClipper). Same-drive Windows move, atomic. All 896 files preserved including `.git`, `Master List/`, `node_modules/`. Git remote URL updated separately during the move session from `ReaIGodzilla/real-anime-reviews.git` to `joewolters/real-anime-reviews.git` (consistent with the v1.4.2 owner-rename).

**New tooling:**
- `.gitattributes` — line-ending normalization (`* text=auto` plus per-extension overrides for `.sh`, `.json`, `.bat`, etc., and `binary` markers for images and Office docs). Permanently prevents the CRLF↔LF phantom-diff churn that surfaced earlier in this session — 9 files showed thousands of "changed" lines that were actually identical when whitespace was ignored.
- `scripts/bump-version.js` — Node script that updates the 7 version strings documented in `CLAUDE.md`'s "Version bump checklist" in one command. Modes: `node scripts/bump-version.js 1.5.0` to bump, `--dry-run` to preview, `--check` to verify all 7 strings agree (catches drift). Real-world test: this version bump (1.4.1 → 1.4.3) was the script's first live use.

**New documentation in `docs/`:**
- `anilist-spike.md` — full AniList GraphQL API reference with ready-to-paste queries, schema mapping to current `animeData.js`, and design recommendations for Phase A (v1.5.0) and Mode 1 (v1.6.0). Closes Phase A pre-work step 1.
- `AI-PRIMER.md` — 60-second orientation for any new AI session. Distills CLAUDE.md, ROADMAP.md, ARCHITECTURE.md, and DEPLOYMENT.md into the minimum context needed to start work without re-deriving everything.
- `CODE-PROMPTS.md` — 8 copy-paste prompts for common Code (CLI tool) tasks: add new anime, fix audit item, investigate bug, ship PATCH bundle, docs-only change, verify-only pass, preview deploy, audit-first cleanup. Each baked with show-don't-do, surgical-edits, version-bump-checklist discipline.
- `DECISIONS.md` — the WHY behind 18+ project decisions that aren't obvious from code (Excel-canonical, Mode 1/2 separation, image-curation rule, no-monetization, vanilla-no-framework, etc.). Future Blake and future AIs both forget the why fast; this preserves it.

**Project rule #9 updated — hybrid image curation.** SUPERSEDES the 2026-04-30 "always human" rule. New rule: Mode 1 fetches the AniList cover image and pre-populates it on the new-anime form as the default. Blake can either accept the AniList default with one click, or override by dropping a custom image into `assets/` and selecting it from the file dropdown. Mode 1 never silently changes images; the form always shows what's about to ship and Blake confirms before save. Mode 2 is NOT permitted to swap images on existing anime — image changes are always Blake-initiated. Mode 1 v1.6.0 spec in `ROADMAP.md` updated to match (image preview slot + Override button instead of always-required file selector). Full reasoning preserved in `DECISIONS.md`.

**Why these changes ship together as v1.4.3:** the move + tooling + docs + rule update were one continuous session (2026-05-09), all docs/tooling-only, no deployed-site code touched. Bundling them as one PATCH version mirrors the v1.4.1 docs-only-ship pattern. Version bump runs the new script through its first real use; CHANGELOG widget on the live site will display "v1.4.3" once a deploy happens (none required for this release per rule-7 exemption — next deploy will pick it up).

<!-- author: Code | date: 2026-05-09 -->
## v1.4.2 — PATCH (2026-05-09)

**Repository visibility changed from private to public; owning account renamed from `ReaIGodzilla` to `joewolters`.** No code changes — repo metadata only.

The repo is now public at https://github.com/joewolters/real-anime-reviews and is referenced as a portfolio link from Joe's CV (`Joe Wolters CV 2026 v3.pdf` in the parent `CV Builder` folder). GitHub auto-redirects the old `https://github.com/ReaIGodzilla/real-anime-reviews` URL to the new one (web + git access), but new references should use `joewolters` directly — old-name redirects are not guaranteed indefinitely, especially if the `ReaIGodzilla` handle is later reclaimed by another user.

**Pre-publication audit (passed all checks):**
- `.gitignore` correctly excludes `PERSONAL.md`, `.env`, `.env.*` (with `!.env.example` exception), and `AUDIT_*.md`. Confirmed against the file at this commit.
- `git log --all --full-history -- PERSONAL.md` returned empty — `PERSONAL.md` has never been committed in any branch's history.
- `git log --all -p` searched for `password|api_secret|admin_uid|service_account|private_key`. The only matches were UI code in `index.html`, `script.js`, and `account.js` for the auth modal (sign-in / password-reset form labels and Firebase SDK function names like `updatePassword`, `sendPasswordResetEmail`). No actual secrets in history.
- Firebase web API key in `firebase.js` is intentionally public per `docs/ARCHITECTURE.md` §"firebase.js (30 lines)" — Firebase web API keys identify the project, not authenticate access; security comes from Firestore rules.

**Note for future AI assistants and future-Blake:** as of 2026-05-09 this repo is **public**. Treat anything you commit as world-readable. The `.gitignore` ↔ `firebase.json` ignore-array mirror rule (codified in v1.3.9) and the project-rules in `CLAUDE.md` continue to apply, and matter even more now that anything that slips through is publicly fetchable from `realanimereviews.com/<filename>` until a corrective deploy purges it.

<!-- author: Code | date: 2026-04-30 -->
## v1.4.1 — PATCH (2026-04-30)

Documentation-only update. No code changes.

**`ROADMAP.md` rewritten in full.** Tonight's planning conversation produced enough corrections that a surgical edit would have left an inconsistent doc. The rewrite captures:
- Corrected version numbering after Phase C shipped as v1.4.0 — Phase A (Excel sync) is now v1.5.0, not v1.4.0.
- Mode 1 reframed as an upgrade arc across v1.6.0 → v1.6.3 instead of one bundled release: v1.6.0 baseline form, v1.6.1 live preview as you type, v1.6.2 "More Information" panel mirroring the Community Tab, v1.6.3 suggestion-box integration.
- Suggestion box folded into v1.6.3 (was originally a standalone v1.4.0 plan; that standalone is no longer scheduled).
- Project rules grew from 6 to 9: rule #7 (run tests before production-facing commits) and rule #8 (`.gitignore` ↔ `firebase.json` mirror) reference back to `CLAUDE.md`; rule #9 codifies image curation as a human-only step.
- Audit progress noted (~25 of 56 Step 3.5 findings closed). Remaining items grouped into suggested v1.4.x polish bundles (content/UX, image optimization, code modernization).
- Phase B-side split out — v1.7.0 backfill and v1.8.0 AniList tab on cards distinguished from Mode 1 capability work.
- "What's NOT on this roadmap" extended to make AniWave/streaming-scraper integration and AI image curation explicit non-goals.

**`README.md`** gains a "Design philosophy" section between About Me and Credits, documenting the *Call of the Night*-inspired visual identity (night sky, illuminated panels-as-apartment-windows, "would this fit in *Call of the Night*?" as the guiding design question).

No production-facing code touched. Tests not required per the docs-only exception in `CLAUDE.md` rule #7 (HTML version-string bumps for the version-bump checklist are mechanical metadata, not behavior changes).

<!-- author: Code | date: 2026-04-30 -->
## v1.4.0 — MINOR (2026-04-30)

**Phase C kickoff — verification scaffolding.** Playwright test infrastructure installed and the initial test suite in place. All future production-facing changes will run tests locally before shipping (per the new project rule below).

### Test infrastructure
- Installed `@playwright/test` (^1.59.1) as a dev dependency. Chromium browser binary installed in user-local cache (`~/AppData/Local/ms-playwright/`), not in `node_modules` — keeps the project tree at ~15 MB instead of ~165 MB.
- `playwright.config.js` runs tests against a local Python `http.server` on `127.0.0.1:8765` (the same pattern used during deploy verification). 0 retries in CI, 1 retry locally; screenshots on failure; single Chromium project.
- `npm test` is the canonical entry point.

### Initial test suite (7 tests in `tests/`)
- `homepage-loads.spec.js` — brand text, search input, View All button, Top 10 + Anime By Genre headings, no console errors.
- `search-works.spec.js` — typing "charlotte" and submitting filters the card grid; clearing and re-clicking View All restores the original count.
- `anime-modal-opens-and-closes.spec.js` — clicking a card opens the modal with title + rating; close button hides it.
- `modal-leak-check.spec.js` — 6 open/close cycles complete without console errors and the page stays responsive. Validates the v1.3.8 §1.2 fix (`activeOfficialUnsub` cleanup moved into `closeModal()`).
- `deep-link-first-load.spec.js` — `?open=charlotte` opens the modal on first load and the URL is cleaned. Validates the v1.3.8 §1.3 fix (deep-link handler hoisted out of `visibilitychange`).
- `account-page-loads.spec.js` — `/account.html` returns 200 with expected static structure (raw HTTP fetch via Playwright's `request` fixture — avoids race with `account.js`'s auth redirect).
- `404-page.spec.js` — non-existent paths return HTTP 404.

### Two new project rules codified in `CLAUDE.md`

**Rule A (Project rules §7) — Run tests before production-facing commits.** Before any commit that changes production-facing code (HTML, JS, CSS, `animeData.js`), Code runs `npm test` locally and reports results. Only after all tests pass does Code surface the change for review. Docs-only and tooling-config changes are exempt.

**Rule B (Operational gotchas) — `.gitignore` and `firebase.json` ignore arrays must mirror for sensitive files.** The two systems are independent — a file gitignored but not firebase-ignored will still be uploaded by `firebase deploy`. Precedents:
- v1.3.5 (commit `46b3291`) — `PERSONAL.md` would have leaked Firebase login email + admin UID + DNS values; fixed by adding `PERSONAL.md` and `UpdateLog/**` to `firebase.json` ignore.
- v1.3.9 (commit `6167da5`) — `AUDIT_2026-04-30.md` (full internal codebase critique) was actually exposed at production for the duration of v1.3.8; fixed by adding `AUDIT_*.md`.

### Notes
- This is Phase C of the original roadmap, reordered ahead of Phase A so subsequent code changes are protected by tests from day one rather than retrofitted later.
- New `firebase.json` ignore entries for tooling: `tests/**`, `playwright.config.js`, `package.json`, `package-lock.json`, `playwright-report/**`, `test-results/**`. None of this should ship to production.
- New `.gitignore` entries for ephemeral test artifacts: `playwright-report/`, `test-results/`, `.playwright/`. Test source files (`tests/`, `playwright.config.js`, `package.json`, `package-lock.json`) remain tracked.

<!-- author: Code | date: 2026-04-30 -->
## v1.3.9 — PATCH (2026-04-30)

Closed a deploy-config security gap. `AUDIT_2026-04-30.md` (the working audit doc from Step 3.5) was gitignored but **not** in `firebase.json`'s `ignore` array, so the v1.3.8 deploy uploaded it to Firebase Hosting. It was publicly fetchable at `realanimereviews.com/AUDIT_2026-04-30.md` between the v1.3.8 release and this fix.

- Added `AUDIT_*.md` to the `ignore` array in `firebase.json`.
- Redeploy purges the file from Hosting; verified `/AUDIT_2026-04-30.md` returns 404 after release.

**This is a recurring class of bug, not a one-off.** It's the same shape as v1.3.5 (commit `46b3291`), where `PERSONAL.md` was gitignored but not firebase-ignored and would have leaked the same way. The general rule: **any file added to `.gitignore` that lives in the deploy root also needs an entry in `firebase.json`'s `ignore` array** — the two ignore mechanisms are independent, and `firebase deploy` happily uploads gitignored files. To be codified as a `CLAUDE.md` rule next session so future Code instances catch the pattern before it ships.

<!-- author: Code | date: 2026-04-30 -->
## v1.3.8 — PATCH (2026-04-30)

Step 3.6 closing batch — bundled fixes from `AUDIT_2026-04-30.md`.

**Trailer:**
- *Call of the Night* trailer URL replaced (audit §1.5). The previous corrupted ID has been swapped for the original-series launch trailer.

**Content typos** (audit §6 — 14 corrections in `animeData.js`):
- Charlotte: physiological → psychological; quicky → quirky.
- Eminence in Shadow: Sonada → Sonata; devolved → developed.
- Call of the Night: seveal → several; "iv seems" → "I've seen".
- DanDaDan: consquences → consequences.
- *The Girl I Like Forget Her Glasses* → *Forgot* (matches existing image filename).
- My Stepmom's Daughter: continently → consistently.
- Magical Girl: passed → past (season 1).
- Gachiakuta: tangable → tangible; fanatastic → fantastic; philosphical → philosophical.

**Account page UI cleanup:**
- Removed the disabled Filter button on the account page (audit §1.10) — visible-disabled buttons confuse the UI; account page doesn't need filter controls.
- Hid the redundant "My Account" header button on the account page itself (audit §1.11) — the page already shows account context.

**Behavior fixes:**
- Fixed a memory leak in the anime modal (audit §1.2): the `activeOfficialUnsub` Firestore listener cleanup block was at module top-level after `closeModal()`, so it ran once on script load and never on close. Listener leaked on every modal open. Cleanup now runs inside `closeModal()` alongside the other live-listener teardowns.
- Fixed the `?open=<animeId>` deep link from the account page (audit §1.3): the handler was nested inside the `visibilitychange` event listener, so it only fired when the user backgrounded and refocused the tab. Hoisted into `init()` so it runs once on page load.

**Dead code removed:**
- `captureOpenState()` and its `openIds` Set in `script.js` (audit §1.13) — the captured state was never read.
- `signoutBtn` declaration and its listener in `account.js` (audit §1.14) — referenced an ID that doesn't exist on the account page.

<!-- author: Code | date: 2026-04-30 -->
## v1.3.7 — PATCH (2026-04-30)

Content and asset fixes from the Step 3.5 audit (see `AUDIT_2026-04-30.md`).

- **Duplicate stylesheet link removed** on `index.html` and `account.html` — both pages were loading `style.css` twice on every page (audit §1.1).
- **Status Assassin trailer URL fixed** in `animeData.js` — was missing `/embed/`, iframe was failing to load (audit §1.4).
- **Days with My Stepsister platforms cleaned up** — the title string had been pasted into the platforms array and was rendering as a fake platform chip (audit §1.6).
- **"About Me" text** on both `index.html` and `account.html` no longer mentions "or discord" — Instagram is the listed contact (audit §2.2).

The Call of the Night trailer (audit §1.5) is **deferred** — the corrupted YouTube ID can't be safely guessed; will be resolved in a separate PATCH once the right trailer is picked.

<!-- author: Code | date: 2026-04-30 -->
## v1.3.6 — PATCH (2026-04-30)

Rewrote ROADMAP.md to capture the two-mode end goal and added project-wide rules for any AI working on this codebase.

The end goal is now explicit:

- **Mode 1** — assisted review creation: human-initiated. Blake writes the review and rating; AI fills in metadata (description, genres, tags, streaming, trailer, thumbnail, seasons, episodes) and handles the version bump + commit + deploy
- **Mode 2** — autonomous site caretaker: AI-initiated, scheduled. Handles routine data maintenance, health monitoring, content quality watching, and reporting back to Blake. Capped at PATCH-tier changes

New rules added cover: Excel as the canonical anime data source; attribution markers (this very entry uses one) on every CHANGELOG entry and commit; strict Mode 1 vs Mode 2 separation; Mode 2 capped at PATCH-tier changes only; the `local → preview → production` deploy ladder is non-negotiable; and the homepage CHANGELOG widget must stay in sync with this file.

This commit also retroactively marks all prior CHANGELOG entries as `human (Blake)`. Going forward, any AI-authored entry will carry a `<!-- author: Code -->` marker.

<!-- author: human (Blake) | date: 2026-04-30 -->
## v1.3.5 — PATCH (2026-04-30)

Closed a deploy-config security gap. `firebase.json`'s `ignore` array didn't match `.gitignore`, so Firebase Hosting would have published `PERSONAL.md` (Firebase login email, admin UID, DNS values) at `realanimereviews.com/PERSONAL.md` on the next deploy.

- Added `PERSONAL.md` and `UpdateLog/**` to the ignore array in `firebase.json`
- Verified on a preview channel before production deploy: `/PERSONAL.md` returns 404 as expected

Commit: `46b3291`.

<!-- author: human (Blake) | date: 2026-04-30 -->
## v1.3.4 — PATCH (2026-04-30)

Cleaned up the changelog widget on the homepage so what visitors see actually matches the current version:

- Static fallback version tag now reads `v1.3.4` (was stuck at `v1.0.1`, even though `APP_VERSION` had moved on)
- Removed a duplicate "Anime by Genre" bullet
- Tightened the "Top 10 prev/next" and "Redesigned My Top 10" bullets
- Dropped the "Implemented" prefix from the bug-fixes bullet

Commit: `fe0dc4a`. This was a meta-fix — the changelog *display* itself was stale.

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.3.3 — PATCH

- Fixed Top 10 list

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.3.2 — PATCH

- Redid Top 10 list

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.3.1 — PATCH

- Added a new anime card

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.3.0 — MINOR

- Added an "Anime by Genre" shuffle control — refresh genre rails without reloading the page
- Added previous/next arrows for the Top 10 section so users can browse instantly
- Upgraded search bar styling to match the new button theme
- Redesigned the "My Top 10" section with cleaner visual hierarchy
- Various bug fixes and stability improvements across the site

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.2.0 — MINOR

- Added the Random anime button (dice icon) — opens a truly random anime in a modal
- Added a dice hover flip animation
- Upgraded header button styling (premium hover / glow / shimmer)
- Upgraded search bar styling to match the new button theme
- Fixed the shimmer "vertical line" artifact across buttons / search
- Smoothed the header hover background — no more harsh black line

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.0.1 — PATCH ("Content corrections only")

No new features — just polish.

- Misspellings and content corrections across reviews and descriptions
- Inaccurate platforms / tags / ratings updated
- Fixed studio names
- Fixed Instagram link
- Fixed website link + description
- Tiny CSS tweaks only (safe / minimal)

---

### Notes on this changelog

- Versions before `v1.0.1` shipped without formal changelog notes — they covered the initial site launch and pre-launch iteration when files were named more freely.
- **`v1.1.0`** ("Community Top 5 Favorites") was planned but never shipped under that number. See [ROADMAP.md](ROADMAP.md) for its current status (postponed → big-vision idea).
- Git commit hashes are only available from `v1.3.4` onward — the git repo was initialized after the prior versions had already deployed.