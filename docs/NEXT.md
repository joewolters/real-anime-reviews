<!-- author: Code | date: 2026-05-10 -->
# What's Next — Real Anime Reviews Backlog

> **Persistent task list.** Cowork's in-session TaskList tool is per-conversation; this file outlives that. New sessions read this to know what's queued. Keep updated when items ship or get rescoped.
>
> **Source authority:** `ROADMAP.md` for the full strategic plan + project rules. This doc is the actionable distillation.

---

## Recently shipped

- **v1.6.3** (2026-05-11) — Polish bundle + first widget update under the new visitor-first skill. `/api/health` reads `APP_VERSION` dynamically, `release-skill` and `hotfix-skill` cross-reference `widget-update-skill`, AI-PRIMER lists all three skill files, one combined backfill bullet on the homepage widget covers v1.6.1 + v1.6.2 + v1.6.3. Originally scheduled for live preview; deferred to v1.6.4 because of the AniList outage. See CHANGELOG.
- **v1.6.2** (2026-05-11) — Bug 10 prevention: Mode 1 server smoke-checks `runCmd` at startup (`smokeCheckSpawn` in `scripts/mode1-server.js`); new entry in `docs/DECISIONS.md` ("re-run the pipeline at the commit you're shipping"). See CHANGELOG.
- **v1.6.1** (2026-05-10) — Hotfix: spawn EINVAL on Windows + Node ≥20.12.2 (Bug 10). Reverted `runCmd` to `shell: true` for npm/npx/firebase wrappers in `scripts/mode1-server.js`. See CHANGELOG.

---

## Immediate next ship — v1.6.4 (Mode 1 polish)

**Live preview as you type.** Search-as-you-type AniList lookup with debounced dropdown of matching titles + live preview of how the anime card will look on the homepage. Requires extracting the homepage card-render function from `script.js` so the admin form can mirror it.

Per `docs/mode1-design.md` §7. Estimated 2-3 hours including the refactor.

**Design note (added 2026-05-11 after AniList search outage):** Live preview + ID-import (`b+` approach): build ID-input as first-class entry point alongside search-as-you-type, not as a fallback. AniList search outage exposed that ID-import is durable infrastructure, not a workaround.

**Currently blocked on:** AniList's `Media(search:)` endpoint has been returning `Not Found` for 30+ hours (rate-limit headers healthy, ID-based fetches still work — server-side search index issue). Live-preview UX literally requires search-as-you-type; ship lands when AniList recovers, or sooner if the `b+` ID-import path is built first as the recoverable foundation.

---

## Phase B remaining (v1.6.x)

| Version | What | Notes |
|---|---|---|
| v1.6.5 | "More Information" panel on anime cards | Left-side panel mirroring Community Tab — prequels, sequels, related anime, per-episode names, AniList & MAL scores per episode. |
| v1.6.6 | Suggestion Box + admin viewer | Public form (no sign-in, basic spam protection) → admin queue → "Add this anime" handoff into the Mode 1 form. Folded into Mode 1 from the originally-planned standalone v1.4.0 spec. |
| v1.6.x | Real one-click AI integration | Replace the current paste-back AI panel with a true one-click. See `docs/ai-integration-design.md` — recommended path is a Firebase Cloud Function. |
| v1.6.x | One-click full automation | Drop the explicit deploy confirmation gate after enough trust is built up. Mode 1 server option. |

## Phase B-side — one-time data work

- **v1.7.0 — Backfill existing ~44 anime with AniList data** (PATCH). Pull AniList data for every existing anime; populate `AniListId`, `IdMal`, `AniListScore`, `AniListColor` columns in Excel; sync regenerates animeData.js with the new fields. One-time migration. Runs after Mode 1 baseline (so backfill uses Mode 1's pipeline).
- **v1.8.0 — AniList tab on cards** (MINOR). Each anime card gets a separate tab showing verified-source data (genres, ratings, episode counts, streaming where-to-watch badges) at-a-glance. Distinct from the v1.6.2 More Info panel — that's the deeper view; this is at-a-glance.

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
