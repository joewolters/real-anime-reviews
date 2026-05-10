# Changelog

All notable changes to Real Anime Reviews, newest first. Versions follow [SemVer](https://semver.org/) (MAJOR.MINOR.PATCH):

- **MAJOR** — milestone or structural shift
- **MINOR** — new features that don't break existing behavior
- **PATCH** — small fixes, content updates, tweaks

For what's coming next, see [ROADMAP.md](ROADMAP.md).

---

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