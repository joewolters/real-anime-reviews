# Roadmap

> **North star:** A real working site for strangers looking for anime recommendations from an actual normal person.

---

## End goal — the two modes

Everything on this roadmap eventually serves one of two AI-powered modes. They are **separate AI systems** with separate roles, separate trust gates, and possibly separate underlying models. Don't conflate them.

### Mode 1 — Assisted review creation *(human-initiated)*

Blake writes the review and rating. The AI does everything else.

**Flow:**
1. Blake drops a poster image into `assets/` (manual step — image curation stays human)
2. Blake opens an admin "new anime" page
3. Types a title → AniList API fills in description, genres (2 best-fit, or new), tags, streaming links, trailer, episode count, seasons, related anime
4. Blake writes his review, rating, and selects the image he just dropped
5. Clicks save
6. AI bumps version (PATCH), writes CHANGELOG entry, updates `animeData.js`, **updates the Excel master**, commits with a proper message, pushes, deploys to preview channel
7. **Gate: Blake verifies the preview, approves prod deploy**
8. AI deploys to production

**Trust gate:** Manual approval before production. Same discipline as the current local → preview → production ladder, just compressed and triggered by clicking save.

**Mode 1 is a *capability*, not a single version.** It ships in v1.6.0 as a baseline (form-based workflow) and gets upgraded across v1.6.5+ as new sub-features land. See Phase B for the upgrade arc.

### Mode 2 — Autonomous site caretaker *(AI-initiated, scheduled)*

Mode 2's job is "watch over the site." Runs on a schedule (likely weekly) without Blake initiating each run.

**Responsibilities:**
- **Data maintenance** — pulls latest AniList data for tracked anime, applies safe updates (season counts, episode counts, related anime, streaming links)
- **Health monitoring** — uptime, console errors, broken links, missing assets
- **Content quality watching** — stale info, things rendering wrong, content drift
- **Reporting** — sends Blake a change report covering everything it did and everything it noticed
- **Excel sync** — keeps the Excel master in sync with every change it makes

**Trust gate:** No per-change approval. Mode 2 ships PATCH changes autonomously; anything bigger gets escalated to Blake. Trust is earned through good reporting, not gated approvals.

---

## Project rules for any AI working on this codebase

These rules apply to every AI system that touches the project — Code (the build tool), Mode 1, Mode 2, and any future AI added later. They are not phase-specific; they are always on.

1. **Excel is canonical.** `Anime_Master_Table.xlsx` (in `Master List/`) is the source of truth for anime data. Any AI that changes anime data also updates Excel. Excel is never allowed to drift out of sync with what's deployed. Blake can always open Excel and see ground truth, including data Mode 2 changed while he wasn't watching.

2. **Every AI marks its changes.** Every CHANGELOG entry — and any meaningful documentation update — includes an HTML comment marker on the line above:
   ```
   <!-- author: [Code | Mode 1 | Mode 2 | human (Blake)] | date: YYYY-MM-DD -->
   ```
   For Mode 2 entries, also include a `type:` field describing the maintenance category (e.g. `type: weekly-maintenance`, `type: health-fix`).

3. **Mode 1 and Mode 2 are separate AI systems.** Different roles, different gates, possibly different underlying models. Don't conflate them in code, prompts, or docs.

4. **Mode 2 is constrained to PATCH-tier changes.** If Mode 2 wants to make a MINOR or MAJOR change, that requires escalation to Blake. This protects against Mode 2 silently claiming larger scope than it should.

5. **Slow-and-safe over fast-and-broken.** Every meaningful change ladders local → preview → production. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

6. **Every code-and-data change updates the website's CHANGELOG widget.** When Mode 1 or Mode 2 ships, the version visible to site visitors bumps and the new entry is what they see. The internal CHANGELOG.md and the runtime widget stay in sync.

7. **Run tests before production-facing commits.** See `CLAUDE.md` for full rule. Codified in v1.4.0.

8. **`.gitignore` and `firebase.json` ignore arrays must mirror for sensitive files.** See `CLAUDE.md` for full rule. Codified in v1.4.0 after v1.3.5 and v1.3.9 leak incidents.

9. **Image curation is hybrid: AniList default with manual override.** Mode 1 fetches the AniList cover image and pre-populates it on the new-anime form as the default. Blake can either (a) accept the AniList default with one click, or (b) replace it by dropping a custom image into `assets/` and selecting it from the file dropdown. Mode 1 never silently changes images; the form always shows what's about to ship and Blake confirms before save. Mode 2 is NOT permitted to swap images on existing anime — image changes are always Blake-initiated. *(Updated 2026-05-09 from earlier "always human" rule.)*

---

## Current state

**Live at v1.7.4** ([realanimereviews.com](https://realanimereviews.com)). Foundation complete; Phase A shipped; Mode 1 baseline + server shipped (v1.6.0); spawn-EINVAL hotfix shipped (v1.6.1); Bug 10 prevention ship — startup smoke check + DECISIONS lesson — shipped (v1.6.2); polish bundle + first widget update under the new visitor-first skill shipped (v1.6.3); update log widget upgrade — dates, grouping, 10-cap, scroll containment — shipped (v1.6.4); Mode 1 live preview as you type (search-as-you-type + ID-import + card-render extraction) shipped (v1.6.5); cover-image fill hotfix (`object-fit: cover` so AniList covers no longer letterbox) shipped (v1.6.6); admin form franchise aggregation Part A (FRANCHISE INFO panel + franchise-aware Seasons/Studio prefill + PREQUEL warning, single-hop scope) shipped (v1.6.7); More Info panel Part B+ — visitor-facing franchise relations on the public anime modal, every season a card with cover/title/meta/score and a click-through to AniList — shipped (v1.6.8); Richer Modal Data — per-episode names, AniList recommendations, and key staff credits added inline to the More Info panel for the source anime — shipped (v1.6.9); More Info panel polish bundle — per-row studio dedupe, small format pill on each franchise row, STAFF cluster cap bumped 4→6 — shipped (v1.6.10); Suggestion Box + admin viewer — public `/suggest` page with live search-as-you-type + selection card + premium UI throughout, admin queue at `/admin/suggestions` accessible from the floating Admin pill with Add/Mark-reviewed/Delete actions + AniList-payload handoff to Mode 1 — shipped (v1.6.11); admin Suggestions Queue patch — error-card-on-success fix, custom branded delete-confirmation modal replacing native `confirm()`, and a side-by-side NEW/REVIEWED column split with `[hidden]` cascade-symmetry fixes — shipped (v1.6.12); AniList enrichment — one-time backfill of 6 fields on the legacy 44 reviews (40 matched / 4 skipped) via the new `npm run backfill` CLI, a community-score twin badge (`RATING · X` / `ANILIST · Y`) on every anime modal, and precise `Media(id:)` franchise lookups activating the v1.6.8 id-path — shipped (v1.7.0); AniList enrichment polish bundle — Japanese/romaji subtitles on cards + modal (`pickSubtitle` + native fallback, 3-line wrap), per-anime `AniListColor` badge accent with luminance guard, premium `NO MATCHES` empty-state, update-log version chips, the 4 skipped anime backfilled (all 44 enriched), and the `--add-native` / `TitleNative` pipeline — shipped (v1.7.1); More Info panel overhaul — multi-fetch data architecture (batched parallel fetches + BFS multi-hop franchise traversal) + per-season episode aggregation with byte-identical-list dedupe, a panel UX redesign (spine chain + connector line + relationType-grouped sections + `✓ Reviewed` in-catalog pill opening Blake's own modal + partial-fail/retry + 24h localStorage cache + PER SEASON/CONTINUOUS episode-counter toggle), plus an undated-entry sort fix + `UPCOMING` kicker — shipped (v1.7.2); Watched Set + Admin Form Completion — shared `franchise-fetch.js` module extraction (homepage modal + admin + CLI), `WatchedAniListIds`/`KnownAniListIds` columns so the `✓ REVIEWED` pill covers every watched entry (not just S1), unofficial-platform removal (official-only site-wide), an admin watched-set checkbox tree + a `✨ ASK` chatbot drawer (`/api/chat`, Anthropic Haiku) replacing the paste-back AI, a backfill CLI (all 44 populated), and update-log infinite-scroll (10-cap removed, restored to the v1.6.1 floor) — shipped (v1.7.3); Modal Architecture Overhaul — always-visible 3-column modal (More Info | Main | Community; proportional shrink + <900px stack; "Click for More Info" tab removed), a LARGE in-site secondary modal replacing the external-tab jump (banner/cover/synopsis/genres/tags/character grid/staff/trailer/"more like this" carousel + replace-content history-back + a "Request this anime" button), per-season markdown reviews (`season-reviews/<id>.md` + sync-emitted index + a shared XSS-safe `markdown.js` + a gold "BLAKE'S REVIEW" section + a `/admin/season-reviews` live-preview editor + `/api/season-review` CRUD + inline "✎ Edit review" deep-link), a routing split (primary id → main modal; watched-not-primary + source row → secondary w/ per-season section; non-catalog → secondary synopsis-only), a clickable character/staff tertiary detail layer (additive `CHARACTER_/STAFF_DETAIL_QUERY`), markdown rendering in the main Review/Description + the admin new-anime form (preview + B/I/link toolbar), and brand-purple markdown links across 5 surfaces — shipped (v1.7.4):

- **Public** GitHub repo at `https://github.com/joewolters/real-anime-reviews` (went public + owner renamed from `ReaIGodzilla` → `joewolters` in v1.4.2 on 2026-05-09); formal documentation system (this file is part of it)
- `local → preview channel → production` deploy ladder, validated end-to-end
- Two security gaps closed (`PERSONAL.md` in v1.3.5, `AUDIT_*.md` in v1.3.9)
- Step 3.5 audit complete (56 findings); Step 3.6 first batches shipped (~25 findings closed across v1.3.7 and v1.3.8)
- Phase C verification scaffolding shipped in v1.4.0: Playwright test infrastructure + 7 initial flow tests + two new project rules in `CLAUDE.md`
- v1.4.1 (2026-04-30) — `ROADMAP.md` rewritten to current shape; `README.md` gained the "Design philosophy" (Call of the Night–inspired) section. Docs-only.
- v1.4.2 (2026-05-09) — repo public + owner rename. No code changes; metadata only.
- v1.4.3 (2026-05-09) — project relocated to `C:\Users\Owner\PROJECTS\Real Anime Reviews\`; tooling additions (`.gitattributes`, `scripts/bump-version.js`); new docs (`anilist-spike.md`, `AI-PRIMER.md`, `CODE-PROMPTS.md`, `DECISIONS.md`); project rule #9 updated to hybrid image curation. Docs/tooling only.
- v1.5.0 (2026-05-09) — **Phase A complete.** `scripts/sync-excel-to-js.js` ships; `Anime_Master_Table.xlsx` is now genuinely canonical. `npm run sync` regenerates `animeData.js` from Excel in one command, with validation, transformation, and fuzzy title matching to preserve image references. 5 new Excel columns (Top10Rank + 4 AniList placeholders) added in same ship. 44 anime resynced; all 7 Playwright tests pass.
- v1.5.1 (2026-05-09) — Top 10 rank #1 fix (Eminence in Shadow, was Farming Life). First real-world use of the v1.5.0 sync pipeline for a content edit.
- v1.6.0 (2026-05-10) — **Phase B Mode 1 ships.** Admin "Add Anime" floating button + form + local Express server (`npm run mode1`) that turns "type submit and boom" into reality. AniList prefill, hybrid image curation per rule #9, 9-step ship pipeline with SSE-streamed progress, explicit deploy confirmation gate, scoped git add, Excel backup, ANSI-stripped logs. 8 bugs caught and fixed by Code's pre-ship test session. Two-mode form: local server for one-click, deployed paste-fallback for off-device.
- v1.6.1 (2026-05-10) — Hotfix: Mode 1 server `spawn EINVAL` on Windows + Node ≥20.12.2 (Bug 10 from v1.6.0 post-deploy testing). Reverted `runCmd` to `shell: true` for npm/npx/firebase wrappers; added a 17-line WHY comment naming the bug so a future session doesn't re-introduce the same fix attempt.
- v1.6.2 (2026-05-11) — Bug 10 prevention. Mode 1 server now smoke-checks `runCmd` at startup (`npm --version` + `git --version` through the same code path) — fails fast with a Bug-10-pointer if the spawn config regresses. New `docs/DECISIONS.md` entry captures the meta-lesson: when you change pipeline plumbing, re-run the pipeline at the commit you're shipping (the Vinland Saga pre-ship test ran on pre-spawn-change code, not the code that shipped).
- v1.6.3 (2026-05-11) — Polish bundle + first widget update under the new visitor-first skill. `/api/health` now reads `APP_VERSION` dynamically (was stuck at hardcoded `"1.6.1"` after v1.6.2 bumped past it); `release-skill.md` and `hotfix-skill.md` now cross-reference `widget-update-skill.md` for bullet curation; `docs/AI-PRIMER.md` "For deeper context" lists all three skill files; one combined backfill bullet on the homepage widget covers v1.6.1 + v1.6.2 + v1.6.3 (all three were tooling ships that didn't curate bullets at the time). Originally scheduled for live preview as you type; deferred to v1.6.4 because AniList's `Media(search:)` endpoint had been returning Not Found for 30+ hours.
- v1.6.4 (2026-05-11) — Update log widget upgrade. Homepage widget now shows shipped-on dates on every change, groups bullets by date, holds up to 10 entries (was 5), and scrolls inside its panel rather than pushing the page down. The widget skill (`widget-update-skill.md`) is updated in the same ship to codify the new rules — per-change granularity, MM/DD/YYYY date format, 10-cap, "backfill consolidation" rule removed. AniList `Media(search:)` recovered partway through this session; v1.6.5 (live preview + ID-import) is unblocked.
- v1.6.5 (2026-05-11) — Live preview as you type for the admin form. Search-as-you-type AniList dropdown with debounced lookup; ID-import as first-class entry point (the `b+` design from `docs/NEXT.md`, made co-equal during the AniList `Media(search:)` outage); live card preview that reuses the homepage's render code via a new shared `card-render.js` file (extracted from `script.js`'s IIFE so both the homepage and the admin form draw cards identically). Bundled fixes: sticky positioning (`overflow-x: clip` on `html, body` — `hidden` was breaking sticky context on every descendant); title-case canonicalization on AniList fetch (typing `gosick` now saves as `GOSICK` per AniList canonical). First ship driven by the multi-gate Code/Cowork workflow with rolling `docs/SHIP-PROMPT.md` + `docs/SHIP-OUTPUT.md` files; gate-level browser smoke tests caught two plan-level misses pre-commit.
- v1.6.6 (2026-05-11) — Hotfix: cover images now fill the anime card frame cleanly. `style.css:218` — `object-fit: contain` → `object-fit: cover` on `.card img`. Surfaced by Blake during v1.6.5's live preview testing (Gosick example showed dark bars), queued in `docs/NEXT.md` and resolved same-day. Affects both homepage cards and the admin form's live preview via the shared `.card` class.
- v1.6.7 (2026-05-12) — Admin form franchise aggregation Part A. Mode 1 form now pulls AniList `relations` and aggregates across the franchise — fetching One Punch Man populates Seasons as "3 seasons" and Studio as "MADHOUSE, J.C.STAFF" instead of just Season 1's values. New FRANCHISE INFO panel surfaces per-entry breakdown in Section 2. Amber `'warn'` status-kind for hint-level messages (PREQUEL heads-up to refetch Season 1 for cleanest aggregation). Single-hop traversal scope; multi-hop polish queued in `docs/NEXT.md`. Part B (public-modal More Information panel) split out to v1.6.8 at gate 0/1 for lower blast radius; Suggestion Box cascaded.
- v1.6.8 (2026-05-13) — More Info panel (Path B+). Visitor-facing surface of the v1.6.7 franchise split. Collapsible "Click for More Info" tab on every public anime modal expands into a panel showing the show's full franchise — PREQUEL/MAIN/SEQUEL/PARENT relations rendered as cards with cover thumbnails, English+romaji titles, year/episode count/studio meta, and AniList community scores; every row clickable → opens that season's AniList page in a new tab. Lazy fetch on tab click, in-session cache, popularity-sorted search (`Page(media:, sort:[POPULARITY_DESC, SCORE_DESC])`) so ambiguous titles like "Demon slayer" resolve to Kimetsu no Yaiba. Three internal iterations folded in (gate 4b IIFE indent, gate 5b null-constraint 404 fix, gate 5c popularity sort + universal click-through). Known limits queued for v1.6.10: single-hop relations (OPM S3 missing when fetching S1), per-entry studio dedupe (MADHOUSE,MADHOUSE on Frieren S2).
- v1.6.9 (2026-05-13) — Richer Modal Data. Three new data clusters added inline to the v1.6.8 More Info panel for the source anime: per-episode names (AniList `streamingEpisodes`, title-only, sorted by parsed episode number, collapsed behind `<details>` when > 8); top-5 community recommendations ("ALSO LIKED" cards — cover + English title + format pill, clickable to AniList, filtered to anime formats); key production staff (Director / Series Composition / Music / Character Design, `Role — Name` text, with a relevance-ranked fallback). Each cluster renders empty when AniList has no data for it. Known limitation: AniList's `streamingEpisodes` is sourced from current streaming-service feeds, so for ongoing multi-season anime it may return the latest airing season's episodes rather than the source season's — franchise-episode aggregation queued for v1.6.10.

- v1.6.11 (2026-06-02) — Suggestion Box + admin viewer. New visitor `/suggest` page: search-as-you-type AniList lookup (350ms debounce + AbortController in-flight cancellation), 5-8 result dropdown with covers + format pill + year + romaji secondary line + 50ms staggered fade-up entrance + tactile hover micro-interactions (cover scale+tilt+glow, title underline grow from left, layered-gradient background brighten), keyboard nav (arrow up/down + Enter + Escape), selected-anime confirmation card replacing the input with bidirectional swap choreography (forward 380ms in / reverse 260ms out, transition-coordinated double-rAF JS so animations replay reliably every toggle), Change Selection button with ported `.inline-header-btn` shimmer + hover lift + glow, 9-second Ken Burns drift on the selected cover, conic-gradient spinner, honeypot + 60-second sessionStorage rate-limit for spam defense. Homepage banner CTA at the bottom of the anime grid: layered purple gradient + backdrop blur + Bebas Neue 1.6rem headline `Tell Blake what to review next` + 2rem arrow that slides 6px right on hover + 115° banner-scale shimmer sweep. Admin queue at `/admin/suggestions`: accessible via the floating Admin pill's new `Suggestion Queue 提案` dropdown entry, rows render visitor-chosen cover thumb (50×70) + title + truncated reason + relative timestamp (`<1h ago` / `Xh ago` / `M/D/YY`) + format pill + year + status pill + per-row Add/Mark-reviewed/Delete with `::before` shimmer ports + smooth dim/collapse transitions, skeleton shimmer loaders pre-fetch, live `X NEW · Y REVIEWED` stats counter, polished error-state card (`⚠️ COULDN'T LOAD 接続` + Reload button). "Add this anime" hands Mode 1 the full search data via `?suggest=<title>&anilistId=<id>` so the admin form auto-fetches the AniList payload via the existing Fetch-by-ID handler. `firestore.rules` `suggestions` collection's `allow create` extended with 6 new optional AniList enrichment fields (`anilistId`, `coverImage`, `format`, `year`, `englishTitle`, `romajiTitle`) + per-field type/range checks (safe widening; admin gate unchanged). Reduced-motion respected on every new keyframe + transition. Hard rule: zero "AniList" mention in visitor-facing copy (admin UI exempt).

- v1.6.10 (2026-06-02) — More Info panel polish bundle. Three small visible polishes on every anime modal's More Info panel: duplicate studio names dedupe on franchise rows (`Array.from(new Set(...))` wrapper applied in both the public modal's `renderMoreInfoEntry` and the admin form's `renderFranchisePanel` for parity); each franchise row carries a small format pill (`TV` / `MOVIE` / `OVA` / `ONA` / `SPECIAL`) at the start of its meta line, reusing v1.6.9's `.more-info-rec-format-badge` class with an inline `position: static` override so it doesn't stack on top of the score badge in the row's top-right corner; the STAFF cluster's fallback loop now collects up to 6 entries (was 4) when AniList doesn't list any of the four whitelist roles. Multi-hop franchise traversal and franchise-episode aggregation were originally scoped for v1.6.10 but deferred to v1.7.1 — both required a nested-relations GraphQL shape that AniList returns 500 errors for on relation-heavy nodes (Demon Slayer's id is the canonical 500-prone case). v1.7.1's N+1 parallel-fetch redesign delivers both deferred items.

- v1.7.0 (2026-06-03) — AniList enrichment + community-score badge. One-time interactive backfill CLI (`npm run backfill` → new `scripts/anilist-backfill.js`, sharing `scripts/lib/excel-backup.js` extracted from Mode 1) walked the canonical Excel and populated 6 fields (`AniListId` / `IdMal` / `AniListScore` / `AniListColor` / `TitleEnglish` / `TitleRomaji`) on the legacy 44 reviews — 40 matched, 4 skipped (idempotent; `--dry-run` + `--auto` exact-match modes; sequential rate-limit-friendly queries; one-time Excel backup; markdown report outside the deploy root). Every anime modal now renders a `RATING · X` / `ANILIST · Y` twin badge (inline-flex kicker·divider·score, gold vs purple gradient, staggered fade-in, hidden when AniList has no score; reads the static `AniListScore`, no API call). The More Info panel's relations chain now resolves by exact `Media(id:)` instead of fuzzy popularity-sorted title search — the v1.6.8 id-path activated automatically once IDs landed (no new modal code). `IdMal` + `TitleRomaji` banked for later (MAL API + romaji subtitles deferred). AniList named only as data attribution (badge kicker), never as third-party brand interruption.

- v1.7.1 (2026-06-03) — AniList enrichment polish bundle. Japanese/romaji subtitle on every card + modal (homepage grid, View All, Top 10 carousel, Latest Drop, modal) in `「 」` brackets via the `pickSubtitle` resolver — romanized reading (Outfit Light Italic) when meaningfully different from English (normalized compare), else native Japanese (Noto Sans JP) via the `--add-native`-populated `TitleNative`; up to 3-line clamp. Per-anime `AniListColor` accent on the `ANILIST` badge (border + gradient + kicker) with a luminance guard lifting dark colors (Chainsaw Man `#6b1a1a` → readable dusty rose); brand-purple fallback when null. Premium `🔍 NO MATCHES 該当なし` empty-state card with a `SUGGEST ONE →` CTA, grid-centered. Update-log version chips per date (stacked 1-2, arrow range 3+). The 4 v1.7.0-skipped anime backfilled by explicit `--match` id — all 44 now enriched. New `--add-native` + `--match` backfill modes + `TitleNative` Excel column read/emitted by the sync. Top 10 glass portrait expanded; Latest Drop got the subtitle + centering fix.

<!-- author: Code | date: 2026-06-03 -->
- v1.7.2 (2026-06-03) — More Info panel overhaul (data architecture + UX redesign). Closed the multi-season debt deferred since v1.6.10: a batched parallel-fetch layer (`Promise.all` groups of 3-4 + inter-batch delays + 429/Retry-After retry via a slim `MORE_INFO_QUERY_NODE`) feeds a BFS franchise walk (seen-set cycle guard, 30-node/10-hop caps; recurses PREQUEL/PARENT/SEQUEL spine, collects non-spine 1-hop). Panel UX redesign: spine chain with `--current` highlight + gradient connector line; relationType-grouped sections (SIDE STORIES / ALTERNATIVE / etc.) with friendly headers + "Show all N" past 6; `✓ Reviewed` in-catalog pill that opens Blake's own modal for catalog matches; per-season collapsible episodes (all closed by default) with byte-identical-list signature dedupe (Re:Zero) + title-prefix-strip renumber + a PER SEASON/CONTINUOUS toggle persisted to `localStorage`; conditional empty-state copy; partial-fail notice + cache-bypass retry; two-tier cache (in-memory L1 + version-keyed 24h `localStorage` L2, prefix-swept). Iteration gates added an undated-entry sort fix (null `seasonYear` → bottom via a shared render-layer `compareSeason`) + an `UPCOMING` kicker on unannounced/`NOT_YET_RELEASED` rows using the already-fetched `status` field. The ratified data layer stayed untouched through the UX/ordering gates (render-layer fixes only). See CHANGELOG.

<!-- author: Code | date: 2026-06-03 -->
- v1.7.3 (2026-06-03) — Watched Set + Admin Form Completion. The `✓ REVIEWED` pill now matches a per-review **watched set** (new `WatchedAniListIds` + `KnownAniListIds` Excel columns → sync arrays → render-layer set-membership) instead of the single primary `AniListId`, so it lights up on every watched season/movie/special. Foundational: extracted the v1.7.2 traversal into a shared `franchise-fetch.js` (homepage modal + admin picker + CLI). Admin rewire: FRANCHISE INFO panel → a multi-hop **watched-set checkbox tree** (FINISHED-only defaults, source ticked+disabled, Select-all/none/spine-only + count chip); removed the per-field `✨ AI` paste-back panels + the Unofficial field; added a "Fill from AniList" button; generated row + Mode 1 server persist both new columns (+ bonus `TitleEnglish/Romaji/Native` fill). New `✨ ASK` **chatbot drawer** backed by a local `/api/chat` (Anthropic Haiku, one-shot, ephemeral-cache structure, per-anime sessionStorage). Unofficial platforms (hianime/9anime/aniwave) stripped site-wide (Excel + sync whitelist + admin + render). Update-log **infinite-scroll** (10-cap removed, sections restored to the v1.6.1 floor). Backfill CLI (`scripts/backfill-watched.js`) populated all 44 rows. admin-fab moved bottom-left; chat drawer raised above the sticky header. See CHANGELOG.

<!-- author: Code | date: 2026-06-04 -->
- v1.7.4 (2026-06-04) — Modal Architecture Overhaul. Always-visible **3-column modal** (More Info | Main | Community; proportional `fr` shrink → single-column stack <900px; "Click for More Info" tab removed). LARGE in-site **secondary modal** replacing the external-tab jump: banner + cover + synopsis + genres/tags + character grid + key staff + trailer + a "more like this" carousel with replace-content **history-back** navigation + a "📝 Request this anime" button (non-watched entries). **Per-season reviews:** markdown files (`season-reviews/<id>.md`) + a sync-emitted `index.json` + a shared XSS-safe `markdown.js` (`window.renderMarkdown`, 5 consumers) + a gold "BLAKE'S REVIEW" section in the secondary + a `/admin/season-reviews` panel (live-preview markdown editor) + a local `/api/season-review` CRUD endpoint + an inline admin "✎ Edit review" deep-link (auto-fills the season title). **Routing split** (`catalogSlugForAniListId` → `primarySlugForAniListId` + `isWatchedAniListId`): a review's primary id → main franchise modal; watched-but-not-primary + the "currently viewing" source row → secondary modal w/ the per-season section; non-catalog → secondary synopsis-only. **Clickable characters + staff** → a **tertiary** detail layer (bio + JP voice-actors + appearances / staff credits) via additive `CHARACTER_DETAIL_QUERY` / `STAFF_DETAIL_QUERY` + `rar:character:`/`rar:staff:` 24h caches. Markdown rendering wired into the main Review/Description + the admin new-anime form (live preview + B/I/🔗 toolbar); bio/review links styled brand-purple across 5 surfaces. `/suggest` now reads `?title=&anilistId=` for the Request button. `bump-version` targets 26 → 33. See CHANGELOG.

<!-- author: Cowork | date: 2026-06-04 -->
**Up next:** v1.7.5 — watchlist + favorites extensions (button entry points on the secondary modal — the slot is already reserved — + schema for non-catalog AniListId entries) + per-episode click-for-more-info + character/staff polish; v1.8.0 — AniList tab on cards (at-a-glance verified-source data); **v1.8.5 — Community + Account UI/UX Overhaul** (community tab on the secondary modal, comments overhaul, community-reviews refresh, notifications system overhaul, my-account redesign — large dedicated ship slotted before v1.9.0 mobile work, surfaced 2026-06-04 during v1.7.4); v1.9.0 — Mobile compatibility overhaul.

---

## Phase A — Foundation for Mode 1

### v1.5.0 — MINOR — Excel → animeData.js sync

`Anime_Master_Table.xlsx` (in `Master List/`) becomes canonical. A Node sync script propagates Excel edits to the deployed `animeData.js`.

**Scope:**
- Sync direction: Excel → animeData.js (one-way for v1.5.0)
- Runner: Node script in `scripts/sync-excel-to-js.js`
- **Dry-run mode required** before any real write — shows what would change without writing
- Validation at sync time: trailer URLs in `/embed/` format, ratings are valid numbers, no duplicate titles, required fields present
- Schema mapping documented (Excel column → JS field) before any code is written
- Future-aware: design so two-way sync (AI writes back to Excel) can be added cleanly when Mode 1 needs it

**Why this is first:** every Mode 1 and Mode 2 capability requires a single source of truth for anime data. Without v1.5.0, the AIs would be guessing at which file is canonical.

**Pre-work for v1.5.0:**
- Read-only spike on the AniList API to understand what fields it returns. Findings inform the Excel schema (we want Excel columns to mirror AniList field names where sensible).
- Read-only comparison of `Anime_Master_Table.xlsx` columns vs `animeData.js` fields. Surfaces gaps that need design decisions before the sync script is written.

---

## Phase B — Mode 1 (the upgrade arc)

Mode 1 is a capability, not a single version. It ships in v1.6.0 as a baseline and gets richer across subsequent versions as Blake learns what he wants from real use.

### v1.6.0 — MINOR — Mode 1 baseline: form-based new anime creation

The first AI mode goes live. Minimum viable Mode 1.

**Includes:**
- AniList API wrapper (Node module that fetches description, genres, tags, streaming, trailer, episode count, seasons, related anime, and **cover image URL** by title)
- Admin "new anime" page (gated by admin UID, returns 404 to non-admins)
- Form fields: title input, fetch button, review textarea, rating widget (matching the existing community rating widget style), **image preview slot showing the AniList default with an "Override" button** (clicking Override reveals the file dropdown so Blake can pick a custom file from `assets/`)
- On save, full Mode 1 flow runs: version bump → CHANGELOG entry → animeData.js update → Excel update → commit → push → preview deploy → human approval gate → prod deploy
- If Blake accepted the AniList default, Mode 1 downloads the cover URL into `assets/` with a slug-based filename (`{slug-of-title}.png`) before commit, so the deployed site serves it locally

**Explicitly NOT in v1.6.0** (saved for upgrade arc):
- Live preview as you type (v1.6.5)
- "More Information" panel on anime cards (v1.6.8)
- Suggestion box integration (v1.6.9)
- Mode 2 swapping images on existing anime (out of scope by design — see Project rule #9)

**Design note:** the admin panel uses the existing visual language — same purple-glow panel style as the homepage trio (Update Log / Top 10 / Latest Drop), same input styles as the search bar, same button styles, same modal patterns. Admin panel should feel like another illuminated window in the cityscape, not a separate utilitarian tool.

### v1.6.5 — MINOR — Mode 1 polish: live preview as you type

Upgrade Mode 1 with reactive UX. As Blake types in the form, AniList lookup fires automatically and the right side of the panel shows what the anime card will look like on the homepage.

**Includes:**
- Search-as-you-type AniList lookup with debouncing
- Dropdown of matching anime when title input is ambiguous
- Live data display for selected anime (poster, genres, description, etc.)
- Live card preview using the same rendering code as the homepage cards
- Refactor: extract anime-card render function so it can be reused in the admin panel

**Why this is its own version, not bundled into v1.6.0:** baseline Mode 1 needs to ship and be used before Blake knows whether live preview is essential or nice-to-have. The refactor required for live preview is significant; doing it after the baseline is shipped lets that refactor be informed by real usage.

### v1.6.8 — MINOR — Mode 1 expansion: "More Information" panel

Add a left-side mirror of the existing Community Tab on each anime page. Populated by Mode 1 with deeper AniList-derived data that doesn't fit on the main card.

**Panel contents:**
- Prequels, sequels, related anime (with links to those entries if they exist on the site)
- Per-episode names and counts
- AniList score per episode (where available)
- MyAnimeList score per episode (where available)
- Other AniList metadata that doesn't belong on the main card

**Note:** this is a *separate* feature from the existing main card metadata, not a replacement. The main card stays focused on Blake's review + headline data; the More Information panel is the deeper data nerd view alongside it. Two distinct voices on the page: Blake on the main card, AniList in the More Information panel, community in the Community Tab.

**Design constraint:** the panel mirrors the Community Tab's layout, dimensions, and styling so the page feels symmetrical.

### v1.6.9 — MINOR — Richer modal data

Three new data clusters inline in the More Info panel from v1.6.8:

1. **Per-episode names + counts** via AniList's `streamingEpisodes` field. Coverage isn't 100% — handle gracefully. Long-running shows (One Piece, Naruto, Detective Conan) wrap the list in collapsible "show more" UX so the panel doesn't blow out vertically.
2. **Recommendations** via AniList's `recommendations` field. Show 3-5 recommended anime with cover thumbnails + titles; same click-through pattern as v1.6.8's relation rows (opens AniList in a new tab).
3. **Staff credits** via AniList's `staff` field. Show 4-6 key roles (director, series composition, music, character design) — not the full staff list. Names non-clickable for v1.6.9; a dedicated staff page is deferred.

**Not in v1.6.9:** AniList per-episode scores (feasibility uncertain — needs schema validation; defer to v1.7.x), MAL integration (paired with the v1.7.0 backfill).

**Implementation surface:** extends the `renderMoreInfoPanel` / `renderMoreInfoEntry` block in `script.js` plus the `MORE_INFO_QUERY_*` GraphQL strings; matching CSS in `style.css`. Tier A.

### v1.6.10 — MINOR — Multi-hop franchise polish + per-entry studio dedupe

Closes the two known limitations carried out of v1.6.7's admin aggregation and v1.6.8's public panel.

1. **Multi-hop traversal.** Extend franchise traversal — both `aggregateFranchise()` in `admin/new-anime.js` AND the public modal's relations fetch in `script.js` — to recurse one level past the initial fetch's direct relations. Add a depth limit (max 2 hops) to prevent infinite loops. **Canonical case to verify:** fetching One Punch Man Season 1 should now also catch Season 3 (currently missing because AniList stores S3 as a SEQUEL of S2, one link further out).
2. **Per-entry studio dedupe** — one-line fix (`Array.from(new Set(...))`) to suppress `MADHOUSE, MADHOUSE` and similar AniList double-credits.
3. **Format badge on relation rows** (from v1.6.9 smoke) — add a small format badge (TV / MOVIE / OVA / OAD / SPECIAL) to each franchise relation row in the More Info panel. AniList's `format` field is already in the v1.6.8 GraphQL response — surface it visually so visitors can distinguish e.g. the Demon Slayer Mugen Train MOVIE from the Mugen Train ARC TV series, both currently labeled 'SEQUEL'.
4. **Franchise-episode aggregation** (from v1.6.9 smoke) — for multi-season anime, fetch each related season's `streamingEpisodes` and merge into a unified franchise episode list. Solves the v1.6.9 known limitation where AniList's `streamingEpisodes` returns the current Crunchyroll feed (often the latest airing season) rather than the source season. Requires N+1 fetches; v1.6.10's multi-hop traversal infrastructure makes this natural.

**Bonus tightening (defer-able):** the "3 seasons" overcounting where OPM's PREQUEL OVA gets counted as a season — could refine the season count to TV-format entries only.

### v1.6.11 — MINOR — Mode 1 + Suggestion Box integration

Visitors can request specific anime via a public form. Requests appear in the admin panel as a queue. Blake can click "Add this anime" on a request to pre-fill the new-anime form with the requested title, then write his review and ship via Mode 1.

**Includes:**
- Public suggestion form (no sign-in required, basic spam protection)
- Submission categories: specific anime request, website addition, inaccurate info, bug report, "tell Blake how awesome he is", other
- Admin viewer (gated by admin UID) showing the request queue
- One-click "Add this anime" handoff from request → new-anime form
- Submissions stored in Firestore under a new collection (path TBD during implementation)

**Note:** this combines what was originally planned as standalone "v1.4.0 — Suggestion box + admin viewer" with Mode 1 integration. The standalone version is no longer planned separately — it lands as part of Mode 1's upgrade arc. (Cascaded from v1.6.9 by the v1.6.8 + v1.6.9 + v1.6.10 inserts.)

### v1.6.x+ — TBD upgrades

Future Mode 1 upgrades land here, scoped based on what Blake learns from using v1.6.0 onward. Don't pre-plan specific versions; let real usage drive the next features.

Known polish item (no version slot yet):
- **Widget version chips per `<li>`** (from v1.6.9 gate-5 smoke) — each widget update-log `<li>` carries a small version chip (`v1.6.7`, `v1.6.5`, etc.) so the visitor can see which update each bullet shipped with. Per the v1.6.4 widget-upgrade convention. Requires: backfill the existing 10 bullets with their source versions (CHANGELOG.md has the history); markup change in `index.html` (per-bullet `<span class="changelog-version-chip">`); CSS for the chip styling; the `widget-update-skill.md` updated to require a version chip on each new bullet.

---

## Phase B-side — One-time data work

### v1.7.0 — PATCH — AniList backfill + MAL integration

Foundation ship — unlocks AniListId-based lookups everywhere. Populates `AniListId`, `IdMal`, `AniListScore`, `AniListColor` for the existing ~44 reviews via Mode 1's pipeline. Excel and `animeData.js` both updated. Once shipped, every modal fetch can use the precise `Media(id:)` lookup instead of the popularity-sorted `Page(media:)` search — a prerequisite for v1.7.2's multi-fetch data architecture. Runs after Phase A (v1.5.0) and Phase B (v1.6.0+) so Blake has Mode 1 working before backfill, and so backfill itself uses the Mode 1 pipeline. Estimated ~3 hours.

### v1.8.0 — MINOR — AniList tab on cards

Each anime card gets a separate "AniList" section/tab on the main card, displaying verified-source data (genres, ratings, episode counts, streaming where-to-watch badges) at-a-glance.

**This is a separate feature from the v1.6.8 "More Information" panel.** The AniList tab on the main card shows headline data at-a-glance for everyone visiting the page. The More Information panel is the deeper data nerd view that pairs with the Community Tab. Both display AniList-derived data; they serve different reading patterns.

**Two distinct voices:** Blake's main review (human take), the AniList tab (verified-source headline data), the More Information panel (deeper data), the Community Tab (other users' takes).

<!-- author: Cowork | date: 2026-06-03 -->
### v1.7.2 — MINOR — More Info panel overhaul (data architecture + UX redesign)

Per Blake's "Option 3" call at gate 0, this ship is the de facto More Info panel overhaul — bundling the v1.6.10 architectural debt closure with a meaningful UX redesign. Full scope:

1. **Parallel-fetch architecture** — `Promise.all`-batched (3-4 ids, 250ms inter-batch, 429/Retry-After single retry) via a slim `MORE_INFO_QUERY_NODE`.
2. **Multi-hop franchise traversal** — BFS with seen-set cycle guard + 30-node/10-hop belt-and-suspenders caps. Recurses spine edges (PREQUEL/PARENT/SEQUEL); collects non-spine 1-hop (SIDE_STORY/ALTERNATIVE/MOVIE/etc.) without recursing. Surfaces Demon Slayer's Entertainment District / Swordsmith Village / Hashira Training / Infinity Castle arcs + OPM S3 + Re:Zero's full chain.
3. **Franchise-episode aggregation** — per-season `streamingEpisodes` fetched separately and merged into a unified per-season collapsible `<details>` list (all closed by default per Blake's gate 4 call). Closes v1.6.9's wrong-season-episodes limitation.
4. **UX overhaul of the panel** — spine chain w/ `--current` highlight on source + gradient connector line; grouped sections by relationType (SIDE STORIES / ALTERNATIVE / SPIN-OFFS / MOVIES via format pill / OTHER) with friendly headers + "Show all N" expansion past 6 entries.
5. **"✓ Reviewed" in-catalog pill** — rows whose `node.id` matches a catalog `AniListId` get a brand-gradient pill AND open Blake's modal instead of `anilist.co/anime/{id}`. Non-catalog rows still open AniList externally. (v1.7.3 will extend this to multi-season watched sets.)
6. **Partial-fail notice + retry** — subtle inline message when 1+ sub-fetch errors (no service-name in copy); cache-bypass full re-traverse via Retry button.
7. **24h localStorage L2 cache** — keyed `rar:moreinfo:v{APP_VERSION}:{id}`, version-prefix sweep on first write each session, in-memory L1 (`franchiseTreeCache`) preserved as fast path. Legacy `moreInfoCache` untouched.
8. **Episode counter toggle** — segmented control next to the EPISODES header (PER SEASON / CONTINUOUS), persists to localStorage `rar:episodeNumbering`, prefers-reduced-motion-guarded.
9. **Backwards compat** — no-AniListId entries fall through to today's single-hop title-search path.

**Estimated:** ~6-8 hours (data + UX + caching bundled). Requires v1.7.0's `AniListId` backfill.

### v1.7.3 — MINOR — Watched-set feature

Slotted in 2026-06-03 during v1.7.2 gate 4 smoke. Today's "✓ Reviewed" pill matches only the primary `AniListId`, but Blake reviews ONE entry per franchise even when he's watched multiple seasons / OVAs / movies. Result: viewers see ✓ Reviewed on S1 only, missing the fact that S2 + the movie + the OVAs are also under Blake's coverage.

Plan:
- New `WatchedAniListIds` column on `Anime_Master_Table.xlsx` — comma-separated list of every AniListId the single review actually covers
- `scripts/sync-excel-to-js.js` reads it into `animeData.js` as an array
- `renderFranchiseEntry`'s catalog-pill lookup (v1.7.2) checks set membership instead of just the primary id
- Admin form (`admin/new-anime.{html,js}`) gets a multi-select UI showing the franchise tree (reuses `traverseFranchise` from v1.7.2) with checkboxes — default: all spine entries pre-checked, Blake unchecks stragglers
- Mode 1 server auto-fills the default since Blake "watches everything affiliated"
- One-time ~20-min backfill across all 44 existing reviews

**Estimated:** ~4-6 hours. Requires v1.7.2's `traverseFranchise` infrastructure.

### v1.7.4 — MINOR — In-site secondary modal for franchise entries

(Pushed back from v1.7.3 by the watched-set slot-in.) Replaces v1.6.8's "open AniList in new tab" with an in-site experience. Requires v1.7.2's data layer. Currently v1.6.8 opens AniList in a new tab when a visitor clicks any row in the More Info panel — visitors leave the site. This ship replaces the new-tab navigation with a secondary modal that opens over the primary modal, showing that specific season's full AniList data (extended description, episode list, characters, staff credits) in the site's own visual vocabulary. Includes a "Back" button to return to the primary review modal. Conceptually pairs with v1.8.0's "AniList tab on cards." Requested by Blake during v1.6.8 gate-5c smoke test (2026-05-13). **Benefits from v1.7.3:** by the time this ships, the in-catalog pill works correctly across every watched season, so the secondary modal's "Reviewed" treatment is accurate.

**Scope additions (from v1.6.9 gate-5 smoke):**
- **Watchlist + "Not Reviewed yet" on ALSO LIKED.** When a visitor clicks an ALSO LIKED card (a recommended anime not in Blake's catalog), the secondary modal opens in-site showing "Not yet reviewed" state + an "Add to watchlist" CTA. Watchlist functionality (storage, UI, per-user persistence) is a prerequisite — may need its own separate ship.
- **Per-episode click-for-more-info.** Clicking an episode row opens the secondary modal with that episode's details. Prerequisite: a per-episode content source — AniList only exposes title/url/thumbnail. Options to evaluate: TVDB integration, Blake-authored per-episode notes, scraping streaming-service descriptions, or deferring further.

**Estimated:** ~5-6 hours.

### v1.7.x polish slots (post-v1.7.4)

- ~~**Romaji subtitle on cards**~~ ✅ **shipped in v1.7.1** — romaji + native Japanese subtitle below the title on both cards and the modal, in `「 」` brackets via `pickSubtitle`. (Was requested by Blake during v1.6.5 smoke; landed as part of the v1.7.1 polish bundle.)
- **AniList per-episode scores feasibility check** — confirm whether AniList's `Episode` GraphQL type exposes per-episode community scores. If so, layer them into the episode list. If not, document and shelve. Deferred from v1.6.9 planning.
<!-- author: Cowork | date: 2026-06-03 -->
- **Admin edit page for existing reviews** (v1.7.x polish, surfaced 2026-06-03). The v1.7.3 admin form (`/admin/new-anime`) is add-only — existing reviews need direct Excel edits + `npm run sync`, or a `backfill-watched.js` re-run. Add `/admin/edit/<slug>` that pre-populates an editable form for an existing review (watched-set toggle + tags + description + everything the new-anime form has). Saves back via Mode 1 or a new edit endpoint. ~3-5 hours.

---

<!-- author: Cowork | date: 2026-06-04 -->
## v1.8.5 — Community + Account UI/UX Overhaul

Dedicated overhaul ship surfaced 2026-06-04 during v1.7.4 close-out. Slotted before v1.9.0 mobile work because the community/account surfaces should be in their final form before the mobile compatibility audit targets them. Likely large enough to be MAJOR depending on scope growth.

### Why this ship

The main franchise modal has a Community Tab (comments + community reviews + voting) since the early Phase A days. The v1.7.4 secondary modal does NOT carry that tab — per-season visitor engagement currently has no surface. Plus the broader community/notification/account UI is the oldest unmodernized part of the site (predates the v1.6.x premium-UI floor), so a unified overhaul makes more sense than piecemeal touches.

### Scope

1. **Community tab on the secondary modal** — per-season or per-franchise (design call at gate 0). May share data with the main modal's tab or be its own collection. Visitors should be able to leave comments + reviews on a specific season, not just the franchise-wide review.
2. **Comments overhaul** — UI refresh to brand-current vocabulary, threaded replies, moderation tooling (admin), sort + filter (newest / oldest / most-voted), character limits + markdown rendering (likely reusing the v1.7.4 shared `markdown.js` renderer).
3. **Community-reviews refresh** — visitor-side per-anime reviews UI gets the premium pass, sort + filter, rating distribution chart, "helpful" votes, possibly per-season visibility.
4. **Notifications system overhaul** — Cloud Function for backend-guaranteed pruning (already in the tech-debt backlog as a `## Polish + tech debt` item), notification UI redesign, mute/snooze controls, per-type granularity (replies, mentions, suggestion-accepted, etc.).
5. **My Account UI/UX overhaul** — `account.html` rework. Profile tab + watchlist tab (post-v1.7.5) + favorites tab + activity tab all get a premium UI pass matching the rest of the site's vocabulary. Likely subsumes or pairs with the previously-slotted **v1.8.x Suggestion DM Inbox** scope (admin↔visitor messaging — the inbox naturally lives in the My Account redesign + pairs with the notification overhaul).
6. **Forward-compat for v1.9.0 mobile** — design tokens + responsive patterns chosen with mobile in mind so the v1.9.0 mobile pass targets a stable + accessible foundation.

### Estimated scope

~15-20+ hours depending on how the comments/notifications/account redesigns interact. **Potentially MAJOR version** if scope grows or if the notification backend refactor warrants it.

### Dependencies

- v1.7.5 watchlist/favorites schema extensions (so non-catalog AniListId entries render in the account-page tabs)
- v1.7.4's shared `markdown.js` renderer (for comments + reviews)
- v1.7.4's secondary modal architecture (the community tab attaches there)

### What this REPLACES in the prior roadmap

- The standalone v1.8.x Suggestion DM Inbox entry is absorbed into the My Account + notifications overhaul (still happens, just bundled here).
- The "Cloud Function for notification pruning" item in the tech-debt backlog becomes part of this ship.

---

<!-- author: Code | date: 2026-05-11 -->
## v1.9.0 — Mobile compatibility overhaul

**Status as of 2026-05-11:** the site doesn't work on mobile at all per Blake's direct observation, despite `mobile.css` being loaded via `@media (max-width: 900px)`. Something between the rules in that file and the site's actual structure doesn't add up, and the result is unusable for visitors on phones.

**Approach — two steps:**

1. **Mobile audit ship** (Tier A, read-only — no fixes). Code loads the site at common mobile viewport widths (375px iPhone, 414px larger phones, 768px tablet), walks every major flow (homepage browse, search, modal open/close, Top 10 prev/next, account page, admin form, the new dated changelog widget), and produces a structured findings report classified by severity and grouped by viewport. Output lands as a new `docs/MOBILE-AUDIT-{date}.md` file (gitignored AND firebase-ignored per rule #8 since it may name internal areas).

2. **Fix bundles** (one or more PATCH ships, possibly a MINOR if the work is structural). Group findings by area — layout, navigation, modal sizing, form usability, image scaling, font sizing — and ship in bundles small enough to verify visually per bundle. Each fix bundle gets its own preview-deploy with manual visual inspection on actual mobile-viewport sizes.

**Scope clarification:** this is NOT a redesign. The desktop experience stays unchanged. The goal is "site is usable on a phone" — readable text, reachable buttons, no horizontal overflow, no broken layouts. If a future Phase looks at a full mobile-first redesign, that's separate work.

**Why slotted here:** Mode 1 polish (Phase B) and Phase B-side (v1.7.0 backfill, v1.8.0 AniList tab) make cards visibly richer. Mobile compatibility lands AFTER those so the mobile work targets the FINAL card design, not a soon-to-be-replaced version. Slotted before Phase D Mode 2 because Mode 2 is autonomous-caretaker work and assumes the site is in a healthy baseline state on all viewports.

**Project rules that still apply:** rule #9 (image curation hybrid) is unchanged — mobile work doesn't swap any images. Rule #7 (tests before prod-facing commits) applies to every fix-bundle ship.

---

## Phase C — Verification scaffolding ✅ SHIPPED in v1.4.0

Prerequisite for Mode 2. Built before Phase A so subsequent code changes are protected from day one.

**Shipped:**
- Playwright test suite — 7 initial flow tests covering homepage load, search, modal open/close, modal-leak regression (audit §1.2), deep-link first-load regression (audit §1.3), account page, 404 path
- Test-before-commit rule codified in `CLAUDE.md` (project rule #7)
- `.gitignore` ↔ `firebase.json` mirror rule codified in `CLAUDE.md` (operational gotcha)
- `firebase.json` ignore patterns extended to exclude all test infrastructure from production deploys

**Still to add over time** (no specific version — fits in whenever):
- Dry-run mode for any data-modifying script (relevant to v1.5.0 and Mode 2 work)
- Change-log generation when scripts touch data
- Additional flow tests as new features ship (Mode 1 admin panel will need its own tests)

---

## Phase D — Mode 2: site caretaker AI

The full autonomous caretaker. Runs on a schedule (GitHub Actions or equivalent).

**Build order within Phase D:**
1. **Read-only weekly health report** — no changes made, just observation, sent to Blake
2. **Add data sync** — low-risk PATCH-tier updates with reporting
3. **Add health-fix actions** — broken link repair, missing asset detection
4. **Add content quality checks** — stale info, things rendering wrong
5. **Tune risk thresholds** based on observed quality

Each step earns trust before the next is enabled. Mode 2 cannot start until Phase A and Phase B baseline are solid — the autonomous caretaker needs reliable data plumbing and a working Mode 1 pipeline as its substrate.

---

## Big-vision ideas

Bigger swings — not on a release schedule. Each is a "yes if/when," not a "soon."

- **Recommendation engine.** "If you favorited X and Y, you'd probably like Z" — based on tag/genre overlap or smarter signals.
- **AI-suggested tags for new entries.** Use an LLM to suggest tags based on review text + metadata.
- **Community Top 5 Favorites panel.** Aggregate-counted top 5 across all users, surfaced on home page. *(Originally planned as v1.1.0, postponed.)*
- **Stats dashboard.** Site-wide stats (most active threads, most prolific reviewers, vote distributions) — public or admin-only TBD.
- **Admin mode UI.** Logged-in-as-admin surface for moderating comments, deleting abusive content, pinning featured anime. Admin UID already configured in PERSONAL.md.
<!-- author: Code | date: 2026-06-02 -->
- **Suggestion DM inbox.** Admin replies directly to suggestion submitters (DM-style) and can tell them if Blake liked it — gated on capturing a stable submitter identity at submission time. Pairs with the notification/comment overhaul. (See NEXT.md v1.8.x.)

---

## Polish / tech debt

Smaller items worth doing whenever — not version-gated. Audit-derived items below are the remaining HIGH/MEDIUM findings from Step 3.5 not yet shipped.

**From Step 3.5 audit (remaining):**
- §1.7 — `document.write` for script loading (replace with direct `<script>` tags)
- §1.8 — 11 missing avatar files (data + asset work)
- §1.9 — inline `onclick`/`onsubmit` handlers on account.html
- §2.1 + §4.1 — 404 page is unbranded Firebase boilerplate (real UX work + return path)
- §2.3 — Two Google Fonts requests (consolidate, drop unused families)
- §2.4 — Top 10 prev/next buttons inside `<h2>` (a11y)
- §2.5 — Inconsistent image filename casing (rename + edit references)
- §3.1 — script.js 134 KB unminified
- §3.2 — style.css 107 KB unminified
- §3.4 — Background image not optimized (WebP/AVIF conversion)
- §4.2 — Low-contrast secondary text (verify with axe DevTools)

**Other:**
- **Favicon + Apple touch icons.** Browser tab currently shows a generic icon.
- **Basic privacy notice.** Site stores user-generated content; a short statement is overdue.
- **Cloud Function for notification pruning.** Right now the client deletes anything past the newest 10 notifications when it sees them. A backend function would make this guaranteed.
- **Cloud Function for cascading deletes.** When a community review is deleted, its `threads/` subcollection is currently orphaned in Firestore. Either client-side cascade on delete, or backend trigger.
- **Search-bar matching tuning.** Current search matches Title / Genre / Studio / Tags. Some near-miss titles fall through; some matches are accidentally driven by tag/genre. Decide whether to tighten.
- **Investigate deploy file-count drift.** Production deploys grew from 199 → 235 files across recent ships, none from Phase C tooling. Could be `.firebase/` cache growth. Worth a quick `find` next session.

**Suggested grouping of remaining audit items** (slot in between phases when momentum is good):
- v1.4.x content polish bundle: 404 page rebuild + return path + Google Fonts cleanup (§2.1, §2.3, §4.1)
- v1.4.x image optimization bundle: avatars + filename casing + background image (§1.8, §2.5, §3.4)
- v1.4.x code modernization bundle: document.write removal + inline handlers + Top 10 a11y (§1.7, §1.9, §2.4)

These are not gating Phase A. They slot in whenever there's time.

---

## Known issues

Bugs documented but not yet fixed.

- **11 missing avatar files.** `script.js:3437` declares `AVATAR_CHOICES` referencing `assets/avatars/avatar-01.png` through `avatar-12.png`, but only `avatar-01.png` exists. Avatars 02–12 would 404 if a user picked them.
- **Curly-vs-straight quote inconsistency in `index.html`.** HTML attributes use straight ASCII quotes; decorative text content uses curly typographic quotes. Renders fine but is inconsistent if you ever search/replace by quote character.

---

## Deferred (no longer scheduled separately)

These were originally planned as standalone features but are now folded into the Mode 1 upgrade arc or deprioritized:

- **Suggestion box + admin viewer.** Folded into v1.6.9 with Mode 1 integration.
- **Anime font.** Lower priority; site typography is currently fine. Revisit if the visual identity ever feels stale.
- **@mentions in comments.** Lower priority; the existing comment system works without it. Revisit if community engagement grows enough to need it.

---

## What's NOT on this roadmap

Just so it's explicit:

- **Major architectural rewrites** (vanilla JS → React/Vue/etc.) — not planned. The site is small enough that vanilla works.
- **Monetization** (ads, subscriptions, donations) — not planned. This is a pet project.
- **Multi-language support** — not planned, would conflict with the personal-voice nature of the reviews.
- **AniWave (or other unofficial streaming sites) integration.** Mode 1 uses AniList only. Streaming-where-to-watch links come from AniList's `externalLinks` field, not from scraping streaming aggregators.
- **AI-curated images.** By design — see Project rule #9. Image selection stays human.
