# Changelog

All notable changes to Real Anime Reviews, newest first. Versions follow [SemVer](https://semver.org/) (MAJOR.MINOR.PATCH):

- **MAJOR** — milestone or structural shift
- **MINOR** — new features that don't break existing behavior
- **PATCH** — small fixes, content updates, tweaks

For what's coming next, see [ROADMAP.md](ROADMAP.md).

---

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