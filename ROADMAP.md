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

**Mode 1 is a *capability*, not a single version.** It ships in v1.6.0 as a baseline (form-based workflow) and gets upgraded across v1.6.1+ as new sub-features land. See Phase B for the upgrade arc.

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

9. **Image curation is a human step.** Blake drops poster images into `assets/` manually. Mode 1 references the filename Blake provides; it does not search the web for images or judge image quality. This intentionally keeps the most subjective part of new-anime creation in human hands.

---

## Current state

**Live at v1.4.2** ([realanimereviews.com](https://realanimereviews.com)). Foundation complete:

- **Public** GitHub repo at `https://github.com/joewolters/real-anime-reviews` (went public + owner renamed from `ReaIGodzilla` → `joewolters` in v1.4.2 on 2026-05-09); formal documentation system (this file is part of it)
- `local → preview channel → production` deploy ladder, validated end-to-end
- Two security gaps closed (`PERSONAL.md` in v1.3.5, `AUDIT_*.md` in v1.3.9)
- Step 3.5 audit complete (56 findings); Step 3.6 first batches shipped (~25 findings closed across v1.3.7 and v1.3.8)
- Phase C verification scaffolding shipped in v1.4.0: Playwright test infrastructure + 7 initial flow tests + two new project rules in `CLAUDE.md`
- v1.4.1 (2026-04-30) — `ROADMAP.md` rewritten to current shape; `README.md` gained the "Design philosophy" (Call of the Night–inspired) section. Docs-only.
- v1.4.2 (2026-05-09) — repo public + owner rename. No code changes; metadata only.

**Up next:** Phase A — Excel sync (v1.5.0), then Mode 1 baseline (v1.6.0), then Mode 1 upgrade arc (v1.6.1+).

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
- AniList API wrapper (Node module that fetches description, genres, tags, streaming, trailer, episode count, seasons, related anime by title)
- Admin "new anime" page (gated by admin UID, returns 404 to non-admins)
- Form fields: title input, fetch button, review textarea, rating widget (matching the existing community rating widget style), image filename selector
- On save, full Mode 1 flow runs: version bump → CHANGELOG entry → animeData.js update → Excel update → commit → push → preview deploy → human approval gate → prod deploy

**Explicitly NOT in v1.6.0** (saved for upgrade arc):
- Live preview as you type (v1.6.1)
- "More Information" panel on anime cards (v1.6.2)
- Suggestion box integration (v1.6.3)
- Image curation automation (out of scope by design — see Project rule #9)

**Design note:** the admin panel uses the existing visual language — same purple-glow panel style as the homepage trio (Update Log / Top 10 / Latest Drop), same input styles as the search bar, same button styles, same modal patterns. Admin panel should feel like another illuminated window in the cityscape, not a separate utilitarian tool.

### v1.6.1 — MINOR — Mode 1 polish: live preview as you type

Upgrade Mode 1 with reactive UX. As Blake types in the form, AniList lookup fires automatically and the right side of the panel shows what the anime card will look like on the homepage.

**Includes:**
- Search-as-you-type AniList lookup with debouncing
- Dropdown of matching anime when title input is ambiguous
- Live data display for selected anime (poster, genres, description, etc.)
- Live card preview using the same rendering code as the homepage cards
- Refactor: extract anime-card render function so it can be reused in the admin panel

**Why this is its own version, not bundled into v1.6.0:** baseline Mode 1 needs to ship and be used before Blake knows whether live preview is essential or nice-to-have. The refactor required for live preview is significant; doing it after the baseline is shipped lets that refactor be informed by real usage.

### v1.6.2 — MINOR — Mode 1 expansion: "More Information" panel

Add a left-side mirror of the existing Community Tab on each anime page. Populated by Mode 1 with deeper AniList-derived data that doesn't fit on the main card.

**Panel contents:**
- Prequels, sequels, related anime (with links to those entries if they exist on the site)
- Per-episode names and counts
- AniList score per episode (where available)
- MyAnimeList score per episode (where available)
- Other AniList metadata that doesn't belong on the main card

**Note:** this is a *separate* feature from the existing main card metadata, not a replacement. The main card stays focused on Blake's review + headline data; the More Information panel is the deeper data nerd view alongside it. Two distinct voices on the page: Blake on the main card, AniList in the More Information panel, community in the Community Tab.

**Design constraint:** the panel mirrors the Community Tab's layout, dimensions, and styling so the page feels symmetrical.

### v1.6.3 — MINOR — Mode 1 + Suggestion Box integration

Visitors can request specific anime via a public form. Requests appear in the admin panel as a queue. Blake can click "Add this anime" on a request to pre-fill the new-anime form with the requested title, then write his review and ship via Mode 1.

**Includes:**
- Public suggestion form (no sign-in required, basic spam protection)
- Submission categories: specific anime request, website addition, inaccurate info, bug report, "tell Blake how awesome he is", other
- Admin viewer (gated by admin UID) showing the request queue
- One-click "Add this anime" handoff from request → new-anime form
- Submissions stored in Firestore under a new collection (path TBD during implementation)

**Note:** this combines what was originally planned as standalone "v1.4.0 — Suggestion box + admin viewer" with Mode 1 integration. The standalone version is no longer planned separately — it lands as part of Mode 1's upgrade arc.

### v1.6.4+ — TBD upgrades

Future Mode 1 upgrades land here, scoped based on what Blake learns from using v1.6.0 through v1.6.3. Don't pre-plan specific versions; let real usage drive the next features.

---

## Phase B-side — One-time data work

### v1.7.0 — PATCH — Backfill existing anime

One-time data migration: pull AniList data for the existing ~44 anime, populate the new fields. Excel and animeData.js both updated. Runs after Phase A (v1.5.0) and Phase B (v1.6.0+) so Blake has Mode 1 working before backfill, and so backfill itself uses the Mode 1 pipeline.

### v1.8.0 — MINOR — AniList tab on cards

Each anime card gets a separate "AniList" section/tab on the main card, displaying verified-source data (genres, ratings, episode counts, streaming where-to-watch badges) at-a-glance.

**This is a separate feature from the v1.6.2 "More Information" panel.** The AniList tab on the main card shows headline data at-a-glance for everyone visiting the page. The More Information panel is the deeper data nerd view that pairs with the Community Tab. Both display AniList-derived data; they serve different reading patterns.

**Two distinct voices:** Blake's main review (human take), the AniList tab (verified-source headline data), the More Information panel (deeper data), the Community Tab (other users' takes).

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

- **Suggestion box + admin viewer.** Folded into v1.6.3 with Mode 1 integration.
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
