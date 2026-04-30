# Roadmap

> **North star:** A real working site for strangers looking for anime recommendations from an actual normal person.

---

## End goal — the two modes

Everything on this roadmap eventually serves one of two AI-powered modes. They are **separate AI systems** with separate roles, separate trust gates, and possibly separate underlying models. Don't conflate them.

### Mode 1 — Assisted review creation *(human-initiated)*

Blake writes the review and rating. The AI does everything else.

**Flow:**
1. Blake opens an admin "new anime" page
2. Types a title → AniList API fills in description, genres (2 best-fit, or new), tags, streaming links, trailer, thumbnail, seasons, episodes
3. Blake writes his review and rating
4. Clicks save
5. AI bumps version (PATCH), writes CHANGELOG entry, updates `animeData.js`, **updates the Excel master**, commits with a proper message, pushes, deploys to preview channel
6. **Gate: Blake verifies the preview, approves prod deploy**
7. AI deploys to production

**Trust gate:** Manual approval before production. Same discipline as the current local → preview → production ladder, just compressed and triggered by clicking save.

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

---

## Current state

The site is live at [realanimereviews.com](https://realanimereviews.com), running v1.3.9. Foundation work is done:

- Private GitHub repo with formal documentation system (this file is part of it)
- `local → preview channel → production` deploy ladder, validated end-to-end
- Security: `PERSONAL.md` properly excluded from Firebase Hosting deploys (closed in v1.3.5)

**Up next:**
1. **Step 3.5** — read-only audit of codebase + live site, produces categorized report
2. **Step 3.6** — fix prioritized items from audit, scoped per-fix commits
3. **Phase A** begins — Excel sync (v1.4.0), then AniList integration + Mode 1 admin page (v1.5.0)

---

## Phase A — Foundation for Mode 1

### v1.4.0 — MINOR — Excel → animeData.js sync

`Anime_Master_Table.xlsx` (in `Master List/`) becomes canonical. A sync script propagates Excel edits to the deployed `animeData.js`.

**Scope:**
- Sync direction: Excel → animeData.js (one-way for v1.4.0)
- Runner: Node script, dry-run mode required before any real write
- Future-aware: design so two-way sync (AI → Excel) can be added cleanly in v1.5.0

**Why this is first:** every Mode 1 and Mode 2 capability requires a single source of truth for anime data. Without v1.4.0, the AIs would be guessing at which file is canonical.

### v1.5.0 — MINOR — AniList integration + Mode 1 admin page

The first AI mode goes live. Includes:
- AniList API wrapper (Node module that fetches description, genres, tags, streaming, trailer, thumbnail, seasons, episodes by title)
- Admin "new anime" page (gated by admin UID)
- Form: title field + fetch button + review/rating fields + save button
- On save: full Mode 1 flow (version bump → CHANGELOG entry → animeData.js update → Excel update → commit → push → preview deploy → human approval → prod deploy)

---

## Phase B — Mode 1 polish

### v1.5.1 — PATCH — Backfill existing anime

One-time data migration: pull AniList data for the existing ~44 anime, populate the new fields. Excel and animeData.js both updated.

### v1.6.0 — MINOR — AniList tab on cards

Each anime card gets a separate "AniList" section/tab displaying the verified-source data (genres, ratings, episode counts, streaming where-to-watch badges) alongside Blake's review. Two distinct voices: Blake's human take, AniList's data take.

---

## Phase C — Verification scaffolding

Prerequisite for Mode 2. Mode 2 cannot run without this, because Mode 2 makes changes without per-change human approval — which only works if there's automation to catch mistakes.

- **Basic automated test suite.** Playwright (or similar) clicks through key flows: homepage loads, cards render, search works, sign-in modal opens, account page loads. Catches regressions.
- **Dry-run mode.** Every data-modifying script supports a `--dry-run` flag that shows what would change without writing. Mode 2 always dry-runs first; deviations between dry-run and real run get logged.
- **Change-log generation.** Any script that touches data auto-generates a structured change log entry (what changed, why, source).

---

## Phase D — Mode 2: site caretaker AI

The full autonomous caretaker. Runs on a schedule (GitHub Actions or equivalent), executes the responsibilities listed in the End goal section.

**Build order within Phase D:**
1. Read-only weekly health report (no changes made — just observation, sent to Blake)
2. Add data sync (low-risk PATCH-tier updates with reporting)
3. Add health-fix actions (broken link repair, missing asset detection)
4. Add content quality checks
5. Tune risk thresholds based on observed quality

Each step earns trust before the next is enabled.

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

Smaller items worth doing whenever — not version-gated.

- **Favicon + Apple touch icons.** Browser tab currently shows a generic icon.
- **Basic privacy notice.** Site stores user-generated content; a short statement is overdue.
- **Cloud Function for notification pruning.** Right now the client deletes anything past the newest 10 notifications when it sees them. A backend function would make this guaranteed.
- **Cloud Function for cascading deletes.** When a community review is deleted, its `threads/` subcollection is currently orphaned in Firestore. Either client-side cascade on delete, or backend trigger.
- **Search-bar matching tuning.** Current search matches Title / Genre / Studio / Tags. Some near-miss titles fall through; some matches are accidentally driven by tag/genre. Decide whether to tighten.

---

## Known issues

Bugs documented but not yet fixed. Step 3.5 audit will likely surface more.

- **11 missing avatar files.** `script.js:3437` declares `AVATAR_CHOICES` referencing `assets/avatars/avatar-01.png` through `avatar-12.png`, but only `avatar-01.png` exists. Avatars 02–12 would 404 if a user picked them.
- **Curly-vs-straight quote inconsistency in `index.html`.** HTML attributes use straight ASCII quotes (correctly required by HTML spec); decorative text content uses curly typographic quotes. Renders fine but is inconsistent if you ever search/replace by quote character.
- **"About Me" text on live site** still says "reach out via Instagram or discord" — README was updated to drop "or discord" but the live `index.html` text wasn't.

---

## Deferred

Originally near-term, now lower priority. Still real features — just not in the critical path toward Mode 1 / Mode 2.

- **Suggestion box + admin viewer.** A way for visitors to send suggestions, with an admin viewer. Was originally v1.4.0.
- **Anime font.** Site typography that feels more anime than generic web fonts. Was originally v1.5.0.
- **@mentions in comments.** Tag other users in discussion threads. Was originally v1.6.0.

---

## What's NOT on this roadmap

Just so it's explicit:

- **Major architectural rewrites** (vanilla JS → React/Vue/etc.) — not planned. The site is small enough that vanilla works.
- **Monetization** (ads, subscriptions, donations) — not planned. This is a pet project.
- **Multi-language support** — not planned, would conflict with the personal-voice nature of the reviews.