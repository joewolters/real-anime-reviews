<!-- author: Code | date: 2026-05-12 -->
# What's Next — Real Anime Reviews Backlog

> **Persistent task list.** Cowork's in-session TaskList tool is per-conversation; this file outlives that. New sessions read this to know what's queued. Keep updated when items ship or get rescoped.
>
> **Source authority:** `ROADMAP.md` for the full strategic plan + project rules. This doc is the actionable distillation.

---

## Recently shipped

- **v1.6.7** (2026-05-12) — Admin form franchise aggregation (Part A of the franchise scope split). Fetching a multi-season anime in the admin form now aggregates AniList `relations` (PREQUEL / PARENT / MAIN / SEQUEL, filtered to `type:ANIME`) into a FRANCHISE INFO panel showing all entries in chronological order, plus franchise-aware Seasons + Studio field prefills. New amber `'warn'` status-kind for hint-level messages (PREQUEL heads-up). Single-hop traversal; multi-hop queued as a v1.6.x polish (see polish backlog below). See CHANGELOG.
- **v1.6.6** (2026-05-11) — Hotfix: cover images now fill the anime card frame cleanly. `object-fit: contain` → `object-fit: cover` on `.card img` in `style.css`. Same-day fix for the bug surfaced during v1.6.5 smoke. See CHANGELOG.
- **v1.6.5** (2026-05-11) — Live preview as you type for the admin form. Search-as-you-type AniList dropdown, ID-import as first-class entry point (the `b+` design), live card preview via the new shared `card-render.js`. Bundled fixes: sticky positioning (`overflow-x: clip`), title-case canonicalization on AniList fetch. First multi-gate Code/Cowork ship. See CHANGELOG.
- **v1.6.4** (2026-05-11) — Update log widget upgrade. Shipped-on dates on every change, date-grouped sections (`<div class="version-section">` + MM/DD/YYYY headers), cap raised 5 → 10, internal scroll containment via `.changelog-content { max-height: 300px; overflow-y: auto; }`. Widget skill (`widget-update-skill.md`) rewritten in the same ship: per-change granularity, MM/DD/YYYY format mandatory, backfill-consolidation rule removed. AniList `Media(search:)` recovered partway through this session — v1.6.5 is unblocked. See CHANGELOG.
- **v1.6.3** (2026-05-11) — Polish bundle + first widget update under the new visitor-first skill. `/api/health` reads `APP_VERSION` dynamically, `release-skill` and `hotfix-skill` cross-reference `widget-update-skill`, AI-PRIMER lists all three skill files, one combined backfill bullet on the homepage widget covers v1.6.1 + v1.6.2 + v1.6.3. Originally scheduled for live preview; deferred to v1.6.4 because of the AniList outage. See CHANGELOG.
- **v1.6.2** (2026-05-11) — Bug 10 prevention: Mode 1 server smoke-checks `runCmd` at startup (`smokeCheckSpawn` in `scripts/mode1-server.js`); new entry in `docs/DECISIONS.md` ("re-run the pipeline at the commit you're shipping"). See CHANGELOG.
- **v1.6.1** (2026-05-10) — Hotfix: spawn EINVAL on Windows + Node ≥20.12.2 (Bug 10). Reverted `runCmd` to `shell: true` for npm/npx/firebase wrappers in `scripts/mode1-server.js`. See CHANGELOG.

---

## Immediate next ship — v1.6.8 (More Information panel on public modal)

**Part B of the franchise scope split.** v1.6.7 shipped Part A (admin form aggregation). v1.6.8 ships Part B — the visitor-facing "More Information" panel on the public anime modal, surfacing the same franchise data (per-season studios, episode counts, years, plus prequels / sequels / OVAs / side stories) to site visitors when they click an anime card.

**Shared data shape:** Part A and Part B both consume AniList's `relations` field. Part A pre-fills the admin form; Part B renders to the public modal. Same GraphQL query expansion (`relations { edges { ... } }`), same filtering (type:ANIME, MAIN_RELATIONS = PREQUEL/PARENT/MAIN/SEQUEL).

**Implementation surface:** new modal-side section in `script.js`'s modal-render, plus matching CSS in `style.css`. Touches the public path (visitor-facing) — Tier A.

**Estimated:** 2-3 hours including modal layout work + the data-pipeline plumbing from `animeData.js` through the modal template.

---

## Phase B remaining (v1.6.x)

| Version | What | Notes |
|---|---|---|
| v1.6.9 | Suggestion Box + admin viewer | Public form (no sign-in, basic spam protection) → admin queue → "Add this anime" handoff into the Mode 1 form. Folded into Mode 1 from the originally-planned standalone v1.4.0 spec. |
| v1.6.x | Real one-click AI integration | Replace the current paste-back AI panel with a true one-click. See `docs/ai-integration-design.md` — recommended path is a Firebase Cloud Function. |
| v1.6.x | One-click full automation | Drop the explicit deploy confirmation gate after enough trust is built up. Mode 1 server option. |
| v1.6.x | Clickable live preview opens modal | Make the admin form's live preview card clickable; opens a mini-modal showing what the full review experience looks like (using the same modal code as the homepage). Requires extracting modal-opening logic from `script.js` similar to how `card-render.js` was extracted in v1.6.5. Estimated 1–2 hours. Requested by Blake during v1.6.5 smoke test ("I can't click on the live preview to see what a review would look like"). |
| v1.6.x | Multi-hop franchise aggregation polish | Extend `aggregateFranchise()` in `admin/new-anime.js` to recurse one level past the initial fetch's direct relations, catching late-chain seasons. **Canonical missing case:** fetching One Punch Man Season 1 currently catches Road to Hero (PREQUEL) and Season 2 (SEQUEL) but NOT Season 3 (which AniList stores as a SEQUEL of Season 2). Single-hop traversal stops one link out. Bundle scope: also dedupe per-entry studios in the FRANCHISE INFO panel row display — currently shows `MADHOUSE, MADHOUSE` on Frieren S2 because AniList double-credits the same studio. One-line fix (`Array.from(new Set(...))` in `renderFranchisePanel`). Estimated 1-2 hours combined. |
| v1.7.x | Romaji subtitle on anime cards + modal | Display the **romaji** title (e.g. "Sousou no Frieren", NOT the native kanji "葬送のフリーレン") as a smaller secondary line below the main English title on both the homepage card and the modal. Fits the existing "Call of the Night" aesthetic (project already uses Japanese accents like `プレビュー` and `モード1`). **Requires:** (1) new `TitleRomaji` field in `Anime_Master_Table.xlsx` and `animeData.js`; (2) sync script transformation update; (3) `card-render.js` template addition (new `<p class="title-romaji">` element); (4) CSS rule for the secondary title (smaller, muted color, matched font); (5) modal template update in `script.js`; (6) Mode 1 form integration — pull `title.romaji` from AniList on fetch (NOT `title.native`, which returns the kanji/kana form). **Data backfill best paired with v1.7.0** (the AniList backfill ship is already pulling per-anime data and adding Excel columns — adding `TitleRomaji` to that sweep is essentially free). **Display work could be its own v1.7.x ship after backfill.** Requested by Blake during v1.6.5 smoke test ("I want the main title to always be in English, but we could add the Japanese title somewhere on the anime card that looks smooth and is smaller than the main title — both on the preview and in the main card. I mean like Sousou no Frieren"). |

## Phase B-side — one-time data work

- **v1.7.0 — Backfill existing ~44 anime with AniList data** (PATCH). Pull AniList data for every existing anime; populate `AniListId`, `IdMal`, `AniListScore`, `AniListColor` columns in Excel; sync regenerates animeData.js with the new fields. One-time migration. Runs after Mode 1 baseline (so backfill uses Mode 1's pipeline).
- **v1.8.0 — AniList tab on cards** (MINOR). Each anime card gets a separate tab showing verified-source data (genres, ratings, episode counts, streaming where-to-watch badges) at-a-glance. Distinct from the v1.6.2 More Info panel — that's the deeper view; this is at-a-glance.

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
