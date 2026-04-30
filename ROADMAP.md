# Roadmap

> **North star:** A real working site for strangers looking for anime recommendations from an actual normal person.

## Current state

The site is live at [realanimereviews.com](https://realanimereviews.com), running v1.3.4. The infrastructure side just got a major upgrade: the project is now version-controlled in a private GitHub repo, has a formal documentation system (this file is part of it), and follows a `local → preview channel → production` deploy ladder.

**Up next:** v1.4.0 — the first feature release on the new infrastructure.

---

## Planned versions

Each release below is deliberately scoped. Slow-and-safe over fast-and-broken — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the deploy workflow.

### v1.4.0 — MINOR — Suggestion box + admin viewer

A way for anyone (signed-in or not) to send suggestions, with a viewer only Blake can see.

**Submission categories:**
- Specific anime request
- Website addition
- Inaccurate information on a card
- Bug report
- "Tell Blake how awesome he is"
- Other

**Behavior:**
- Submissions allowed without sign-in
- Admin viewer gated by admin UID (see PERSONAL.md)
- Submissions stored in Firestore under a new collection (path TBD during implementation)

### v1.4.1 — PATCH — Bug fixes

Stabilization patch after v1.4.0 ships. Specific bugs TBD based on what surfaces in production.

### v1.5.0 — MINOR — Anime font

Change the site's typography to something that feels more anime — not generic web fonts. Specific font choice TBD; verify with Blake before scoping.

### v1.6.0 — MINOR — @mentions

Tag other users in comments and discussion threads.

- Type `@name` → autocomplete suggests usernames
- Selecting a name tags the user
- Tagged user receives a notification of type `mention`
- Autocomplete is visible only to signed-in users (privacy: usernames aren't a public directory)

### v1.7.0 — TBD

Per the existing roadmap notes: "Add something big to the main page." Specifics not yet defined. **Verify with Blake before this version is scoped.**

---

## Big-vision ideas

Bigger swings — not on a release schedule. Each one is a "yes if/when," not a "soon."

- **Excel → animeData.js sync.** `Anime_Master_Table.xlsx` (in `Master List/`) is the canonical anime database, but it's currently propagated to `animeData.js` by hand. A sync script (Node / Python / PowerShell) would let edits in Excel flow to the deployed JS automatically.
- **AniList API integration.** Auto-fetch trailers, genres, ratings, streaming platforms, and related anime from [AniList](https://anilist.co/) instead of hand-entering them. Reduces per-anime maintenance overhead.
- **Auto-update for new seasons / episodes.** When a new season of a tracked anime drops, the site notices and either updates metadata silently or surfaces a "new season available" hint.
- **AI-suggested tags.** Use an LLM to suggest tags for new entries based on the review text + anime metadata, instead of hand-tagging.
- **Recommendation engine.** "If you favorited X and Y, you'd probably like Z" — based on tag/genre overlap or smarter signals.
- **Community Top 5 Favorites panel.** Aggregate-counted top 5 most-favorited anime across all users, surfaced on the home page. *(Originally planned as v1.1.0, postponed.)*
- **Stats dashboard.** Site-wide stats (most active threads, most prolific reviewers, vote distributions, etc.) — public or admin-only TBD.
- **Admin mode.** A logged-in-as-admin UI surface for moderating comments, deleting abusive content, pinning featured anime, etc. Admin UID is already configured in PERSONAL.md.

---

## Polish / tech debt

Smaller items worth doing whenever — not version-gated.

- **Favicon + Apple touch icons.** Currently the browser tab shows a generic icon.
- **Basic privacy notice.** Since the site stores user-generated content (comments, reviews, profiles), a short privacy statement is overdue.
- **Cloud Function for notification pruning.** Right now the client deletes anything past the newest 10 notifications when it sees them. A backend function would make this guaranteed (no reliance on the client opening the page).
- **Cloud Function for cascading deletes.** When a community review is deleted, its `threads/` subcollection is currently orphaned in Firestore. Either delete subcollections client-side on review delete, or use a backend trigger.
- **Search-bar matching tuning.** The current search matches Title / Genre / Studio / Tags. Some near-miss titles fall through; some matches are accidentally driven by tag/genre. Decide whether to tighten or accept as-is.

---

## Known issues

Bugs and inconsistencies in the live code that are documented but not yet fixed.

- **11 missing avatar files.** `script.js:3437` declares `AVATAR_CHOICES` referencing `assets/avatars/avatar-01.png` through `avatar-12.png`, but only `avatar-01.png` exists on disk. Avatars 02–12 would 404 if a user tried to pick them.
- **Curly-vs-straight quote inconsistency in `index.html`.** HTML attributes use straight ASCII quotes (correctly required by the HTML spec), while decorative text content (like "Anime by Genre", "My Top 10") uses curly typographic quotes. Renders fine in browsers but is inconsistent if you ever search/replace by quote character.

---

## What's NOT on this roadmap

Just so it's explicit:

- **Major architectural rewrites** (moving off vanilla JS to React/Vue/etc.) — not planned. The site is small enough that vanilla works.
- **Monetization** (ads, subscriptions, donations) — not planned. This is a pet project.
- **Multi-language support** — not planned, would conflict with the personal-voice nature of the reviews.