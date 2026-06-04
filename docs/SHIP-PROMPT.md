<!-- author: Cowork | date: 2026-06-04 -->
# v1.7.5 — Gate 0 (recon + propose plan — PROPOSE-FIRST)

Propose only. Do NOT apply yet. v1.7.4 shipped clean on 2026-06-04 (commit `7364500`). v1.7.5 is the **Watchlist + Favorites Schema Extension ship** — wiring the v1.7.4 secondary modal's reserved button slots to the existing watchlist + favorites infrastructure, extending the schema for non-catalog AniListId entries, plus per-episode click-for-more-info and a small character/staff polish bundle.

Blake's gate-0 brief style applies: bring full creative input on visual treatment + alternative architecture proposals. Surface 2-3 options where invited.

## Locked context (from v1.7.4 + earlier ships)

- **Watchlist + favorites infrastructure EXISTS** since the early Phase A days. Firestore: `users/{uid}/watchlist/{animeId}` + `users/{uid}/favorites/{animeId}` (firestore.rules:12-19). Account page tabs render them (`account.html` + `account.js`). Per-card watch + favorite buttons exist on every anime card (`script.js`).
- **Current schema is catalog-slug-keyed** — `animeId` in those collections is Blake's catalog slug, not an AniListId.
- **v1.7.4 gate 2b reserved layout slots** in the secondary modal header action row (order: request → [watchlist] → [favorites] → close) for the future buttons. `.secondary-header-actions` is `flex-wrap` with the slots ready — no layout reshuffle needed when the buttons land.

## Scope items

### 1. Watchlist + favorites schema extension for non-catalog AniListId entries

The secondary modal needs to "Add to watchlist" / "Add to favorites" for anime that are NOT in Blake's catalog (typical case: ALSO LIKED cards, the rest of a franchise's spine, etc.). The existing schema can't store these cleanly.

**Schema options for Code to recon + propose:**
- (a) **Discriminator field** on existing collections — `{ type: 'catalog'|'anilist', animeId, aniListId, addedAt }`. Single collection per kind, mixed entries.
- (b) **Parallel sub-collections** — `users/{uid}/watchlist-anilist/{aniListId}` + `users/{uid}/favorites-anilist/{aniListId}` alongside the existing ones. Two collections per kind, cleaner separation.
- (c) **Single document with both arrays** — `users/{uid}/watchlist/_doc` containing `{ catalogSlugs: [...], aniListIds: [...] }`. Simpler reads, but harder to add/remove individual items + worse Firestore rule granularity.
- (d) Your alternative.

**Cowork lean: (b) parallel sub-collections.** Clean separation, Firestore rules stay simple (`isOwner(uid)`), each entry is its own doc (easy add/remove with `setDoc`/`deleteDoc`), and the schema migration is purely additive — no risk to existing entries. But Code's call after recon.

### 2. "Add to watchlist" + "Add to favorites" buttons in the secondary modal

Visual + behavior per Code's creative latitude (matches v1.7.4 vocabulary — brand purple pill, hover-lift, etc.):
- Both buttons in the reserved header action row slot from v1.7.4 gate 2b
- **State** drives the visual: "Add to watchlist" → "✓ In watchlist" (toggle behavior, same as the per-card buttons), same for favorites
- **Auth gate** — if visitor isn't signed in, click prompts sign-in (existing Firebase Auth flow via `firebase.js`)
- **Sync to Firestore** — `onSnapshot` listener pattern, matches the existing per-card watchlist/favorite implementation in `script.js`
- Visual on hover/state changes — reduced-motion-guarded

### 3. Account page tab rendering for non-catalog entries

The watchlist + favorites tabs on `account.html` currently render catalog entries (linked via slug to Blake's reviews). With the schema extension, they also need to render non-catalog entries:
- **Display per-entry**: AniList cover + title + format + year (from cached AniList data — reuse `fetchMediaDetail` from `franchise-fetch.js`?)
- **Click behavior**: non-catalog entry click → opens the v1.7.4 secondary modal (in-site, not external)
- **Remove from watchlist/favorites** — existing UX pattern stays
- **Visual differentiation** (optional) — distinguish catalog entries (green ✓ REVIEWED pill) from non-catalog (no pill, or a distinct treatment) — Code's call

### 4. Per-episode click-for-more-info

When a visitor clicks an episode row in the secondary modal's episode list (currently just `<details>` with title), open a small detail view with that episode's specifics. **Content source decision required** — Code's recon to propose:

- (a) **TVDB API** — comprehensive per-episode data (summary, score, air date, thumbnail), but requires API key + cost + signup
- (b) **Blake-authored per-episode notes** — Blake writes brief markdown notes per episode he wants to flag (similar pattern to season reviews). Storage in `season-reviews/episodes/<aniListId>-<epNum>.md` or similar. Manual, free, optional per episode
- (c) **AniList's existing `Episode` GraphQL type** — confirm what fields it exposes (deferred feasibility check from v1.6.9)
- (d) **Streaming service descriptions** (Crunchyroll API / scraping) — variable quality, fragile
- (e) Skip per-episode entirely and defer to a future ship — surface this if the source decision is too contentious

**Cowork lean: (c) recon first, then (b) as the fallback if AniList doesn't expose enough.** Don't introduce a new external API dependency this ship if avoidable.

### 5. Character/staff polish

- **`__underscore-bold__` markdown support** — flagged at v1.7.4 gate 3c by Code. AniList sometimes uses `__bold__` (double underscores) instead of `**bold**` (asterisks). The shared `markdown.js` renderer doesn't handle it. ~5 line addition to the renderer; affects all 5 consumers.
- Any other character/staff polish Code surfaces during recon.

## Constraints (standing — same as v1.7.4)

- No new visitor-facing fonts; no new visitor-facing deps that hurt perf
- Premium UI floor — Blake's broad grant continues
- `prefers-reduced-motion` fallback on every new animation
- `[hidden]` symmetry on any toggleable element
- No `confirm()` / `alert()` / `prompt()` — branded modals only
- No service name in interrupting visitor copy (data attribution kickers like `ANILIST` on the score badge are the established carve-out)
- Project rule #1 (Excel canonical for anime data — not affected this ship; user-data goes to Firestore as usual)
- Project rule #8 (gitignore ↔ firebase.json mirror) — if new Firestore rules are needed, deploy them via `firebase deploy --only firestore:rules` at the deploy gate

## Recon targets

- `firestore.rules` — existing watchlist + favorites rules + how to extend for the new schema
- `users/{uid}/...` schema today — read script.js's `watchlistSet` + `favoritesSet` population logic
- `account.html` + `account.js` — tab rendering
- `script.js` — per-card watchlist/favorite buttons + `onSnapshot` listeners
- `franchise-fetch.js` — confirm `fetchMediaDetail` cache pattern available for account-page non-catalog entries
- AniList `Episode` GraphQL type — what fields exist for per-episode content

## Open questions for Blake — surface in your report

- Schema option (a/b/c/d) recommendation
- Account-page rendering for non-catalog entries — visual differentiation approach
- Per-episode content source pick — (a/b/c/d/e)
- Any other architecture calls during recon

## Stop conditions

- If extending the existing watchlist/favorites collections breaks any production-facing read path, surface for ratification
- If per-episode source decision needs more research, propose a feasibility-check sub-gate before committing

## Estimated total scope: ~5-8 hours

After Blake approves direction, Cowork writes gate 1 (build core — schema extension + Firestore rules deploy if needed). Likely 3-4 gates of build + the standard cascade/audits/commit/deploy gates.

## Report shape

Per scope item:
- Recon findings (what exists today, integration points)
- Proposed implementation (code outline)
- Estimated Δ per file
- **Code's creative additions / alternatives** with one-line "why"
- Any pushback or concerns

Plus answers to the open questions above. Bring your full creative latitude per `feedback_creative_latitude`.
