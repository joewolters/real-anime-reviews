# Changelog

All notable changes to Real Anime Reviews, newest first. Versions follow [SemVer](https://semver.org/) (MAJOR.MINOR.PATCH):

- **MAJOR** — milestone or structural shift
- **MINOR** — new features that don't break existing behavior
- **PATCH** — small fixes, content updates, tweaks

For what's coming next, see [ROADMAP.md](ROADMAP.md).

---

## v1.3.4 — PATCH (2026-04-30)

Cleaned up the changelog widget on the homepage so what visitors see actually matches the current version:

- Static fallback version tag now reads `v1.3.4` (was stuck at `v1.0.1`, even though `APP_VERSION` had moved on)
- Removed a duplicate "Anime by Genre" bullet
- Tightened the "Top 10 prev/next" and "Redesigned My Top 10" bullets
- Dropped the "Implemented" prefix from the bug-fixes bullet

Commit: `fe0dc4a`. This was a meta-fix — the changelog *display* itself was stale.

## v1.3.3 — PATCH

- Fixed Top 10 list

## v1.3.2 — PATCH

- Redid Top 10 list

## v1.3.1 — PATCH

- Added a new anime card

## v1.3.0 — MINOR

- Added an "Anime by Genre" shuffle control — refresh genre rails without reloading the page
- Added previous/next arrows for the Top 10 section so users can browse instantly
- Upgraded search bar styling to match the new button theme
- Redesigned the "My Top 10" section with cleaner visual hierarchy
- Various bug fixes and stability improvements across the site

## v1.2.0 — MINOR

- Added the Random anime button (dice icon) — opens a truly random anime in a modal
- Added a dice hover flip animation
- Upgraded header button styling (premium hover / glow / shimmer)
- Upgraded search bar styling to match the new button theme
- Fixed the shimmer "vertical line" artifact across buttons / search
- Smoothed the header hover background — no more harsh black line

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