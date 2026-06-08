<!-- author: Code | date: 2026-06-06 -->
# Architecture

## ⚡ READ-FIRST

- **What this doc is:** the verified map of how LIVE Real Anime Reviews fits together — static site → `animeData.js` → AniList GraphQL → Firebase (Firestore/Auth/Storage), plus the new `functions/` Cloud Functions surface.
- **Do NOT read this top-to-bottom at session start** — it is deep reference. The one-line shape is in `CLAUDE.md`; come here only for a specific lookup.
- **Open it when:** you're touching the data flow / `npm run sync` pipeline, the Firestore data model or `firestore.rules`, the `script.js` modal/places/discovery subsystems, Cloud Functions, or chasing one of the known quirks (e.g. `window.animeData` undefined, `.secondary-layer` not an id).
- **For the v1.9.0 forward-looking data model** (forum, DMs, profiles, reworked notifications) read **[`docs/DATA-MODEL.md`](DATA-MODEL.md)** instead — not here.

> ⛔ DEEP REFERENCE BELOW — do NOT read top-to-bottom. Open a section ONLY if you're stuck on that specific thing.

### Jump-to (only if stuck)

- **Data flow** — open if you need how Excel → `animeData.js` → site → AniList/Firestore wire together, or how `npm run sync` works.
- **File structure (top of `Current Version/`)** — open if you need what a given file/folder is for.
- **Code organization** — open if you need the `script.js`/`account.js`/`firebase.js` subsystem breakdown.
- **Firestore data model (LIVE today — verified from `firestore.rules`)** — open if you need the live collection shapes, rules, or security/index caveats.
- **Cloud Functions (NEW in v1.9.0 — first-ever server surface)** — open if you need the `functions/` scaffold, test tracks, or why CF exists.
- **Notable quirks and lessons** — open if you hit a surprising bug and want the known gotcha + fix.

How the pieces of Real Anime Reviews fit together. The high-level shape: a **static site** (no production server) reads from a hand-maintained anime database (`animeData.js`), enriches it live from **AniList** (GraphQL), renders the UI, and talks to **Firebase** (Firestore + Auth + Storage) for everything user-generated. Deployed via **Firebase Hosting**.

> **Ground-truth note (2026-06-06, v1.8.4 LIVE):** this doc was rewritten to the *verified* current state at the v1.9.0 gate-0 study (the prior version had drifted — it described a pre-v1.7.4 single-IIFE `script.js` and omitted `suggestions`, the secondary/tertiary modal, the constellation veil, and the real notification rules). The **v1.9.0 Community Overhaul** then extends the data model substantially — that forward-looking contract lives in **[`docs/DATA-MODEL.md`](DATA-MODEL.md)**, not here. This doc describes what is LIVE today.

## Data flow

```
Anime_Master_Table.xlsx  (in Master List/, canonical — Code edits it programmatically)
        │  scripts/sync-excel-to-js.js  (npm run sync)
        ▼
   animeData.js  (global `animeData` array — classic script, NOT a module)
        │  loaded as a classic <script> by index.html
        ▼
   Live site (realanimereviews.com)  ──fetch──▶  AniList GraphQL  (covers, relations, characters, trending/airing)
        │                                          (franchise-fetch.js)
        └──read/write user content──▶  Firestore  ──onSnapshot live listeners──▶  back to the site
```

**Plain English:**
1. Blake maintains anime entries in `Anime_Master_Table.xlsx` (outside the repo, in `Master List/`). Blake does **not** open Excel — Code performs all Excel writes programmatically (hard project rule).
2. `npm run sync` (`scripts/sync-excel-to-js.js`) regenerates `animeData.js`. ⚠️ That script has **two halves** — a parse half (`rowToAnime`) and a hand-rolled serialize half (`renderJsFile`); any new field must be edited in BOTH or it's silently dropped.
3. `index.html` loads `animeData.js` as a classic `<script>`, exposing a global `animeData` array. ⚠️ It is a lexical `const`, **not** a `window` property — read the bare global in any `page.evaluate`/test.
4. `script.js` renders cards, the modal stack, search, filters, the three nav "places," and the discovery surfaces, all from that array + live AniList data.
5. For anything user-generated (comments, community reviews, votes, favorites, watchlist, notifications, suggestions), the site talks to Firestore directly via the Firebase Web SDK. There is **no production server** — `scripts/mode1-server.js` is a local admin/dev tool only.
6. Firestore pushes live updates via `onSnapshot` — comments/vote counts update without a refresh.

---

## File structure (top of `Current Version/`)

| File / folder | Role |
|---|---|
| `index.html` | Main page — header + nav places (Den / For You / Discover), the home composition, the 3-layer modal stack, auth/profile modals, the welcome "door," the constellation veil |
| `account.html` | Account page — tabs (Profile / Watchlist / Favorites / Activity); carries `data-surface="foryou"` + the lit veil |
| `suggest.html` | Public "suggest an anime" page |
| `404.html` | Firebase Hosting fallback |
| `admin/` | Admin-only pages (`new-anime`, `edit`, `season-reviews`, `suggestions`, `quotes`) + shared admin modules (`chat-drawer.js`, `section-editor.js`, `modal-scroll-lock.js`, `admin-fab.js`); auth-gated client-side via a hardcoded `ADMIN_UID`, with `firestore.rules` as the real security |
| `style.css` / `mobile.css` | Desktop styling / mobile overrides (`@media (max-width:900px)`); mobile is deferred to v2.0 |
| `animeData.js` | Global `animeData` array — every catalog entry. Classic script, no module exports. |
| `script.js` | Main-page logic — a **~5,500-line ES module** (`type="module"`): the nav places, the home composition, the 3-layer modal, comments + community reviews + votes, the discovery surfaces, the veil |
| `account.js` | Account-page logic — ES module |
| `firebase.js` | Initializes Firebase and exports `app`, `auth`, `db` — ES module. The web config is intentionally public (security is in the rules). |
| `franchise-fetch.js` | Shared AniList GraphQL layer (`window.franchiseFetch` + `module.exports`) — franchise traversal, media/character/staff detail, and the discovery queries (`searchMediaList`/`fetchTrendingList`/`fetchAiringList`) |
| `markdown.js` | The **single, shared, XSS-safe** renderer — `window.renderMarkdown` (block) + `window.renderMarkdownInline` (no headers/lists) + `module.exports`. Escapes ALL input first, then re-introduces a fixed markdown whitelist. The one place user-authored text is turned into HTML. |
| `card-render.js` | Shared card markup (`createCard`) used by the homepage and admin previews |
| `season-reviews/` | `<aniListId>.md` per-season reviews + a generated `index.json`; static-deployed |
| `scripts/` | Local tooling — `sync-excel-to-js.js`, `bump-version.js`, `mode1-server.js` (local Express; `npm run mode1`), AniList backfills, `lib/` shared helpers. Never deployed to hosting. |
| **`functions/`** | **NEW (v1.9.0 P1) — Cloud Functions** (first-ever server surface). Own `package.json`/deps; gen-2 functions; deployed via `firebase deploy --only functions`, **never** to hosting. See [DATA-MODEL.md](DATA-MODEL.md) + [DEPLOYMENT.md § Cloud Functions](DEPLOYMENT.md). |
| `firebase.json` | Hosting config (public dir + ignore array + redirects) + `firestore` rules/indexes + (new) `functions` + `emulators` blocks |
| `.firebaserc` | Pins the deploy target to project `real-anime-reviews` |
| `tests/` | Playwright suite (DOM, runs against a local static server). CF tests live separately in `functions/test/`. |
| `docs/` | This dir — ARCHITECTURE, DEPLOYMENT, DATA-MODEL, plus the rolling Code/Cowork docs |

---

## Code organization

- **`script.js`** (~5,500-line ES module) — the homepage + modal monolith. Notable subsystems: the three nav **places** (`setActivePlace` is the single funnel that flips `data-surface` on `<html>`; `moveMarker` slides the gold marker; `showForYou`/`showDiscover`/the Den); the **3-layer modal** (`openModal` primary → `openSecondaryModal`/`.secondary-layer` z6000 → tertiary z7000); **comments** (`subscribeComments`/`wireComments`); **community reviews** (`subscribeReviews`/`communityMarkup`) with a per-review `threads` reply subcollection; **official-rating votes**; the **discovery layer** (`window.rarDiscovery` — caches + `createDiscoveryCard` + the Den/For-You/Discover rails); the **constellation veil** (`body::after` + per-surface `data-surface` density + the `#veil-pulse` animation, index.html only); the **welcome door**; and the client-side notification listener (`cleanupOldNotifications`, `NOTIF_KEEP=10`).
- **`account.js`** (ES module) — `activateTab`, `subscribeSavedLists` (favorites + watchlist, incl. non-catalog `al:<aniListId>` saves), `subscribeActivity` (merges the `collectionGroup('items')` + `collectionGroup('threads')` queries — this is what needs the composite indexes), `subscribeNotifications` (the bell), the avatar upload pipeline (resizes → Firebase Storage `avatars/{uid}/…`).
- **`firebase.js`** — initializes Firebase, exports `app`/`auth`/`db`. Web API key is intentionally public.

---

## Firestore data model (LIVE today — verified from `firestore.rules`)

> For the **v1.9.0** additions (the Community Hub `forum`, per-season `seasonComments`, `conversations`/DMs, `profiles`, `suggestionCounts`, `reports`, the reworked notifications) and every proposed rule change, see **[`docs/DATA-MODEL.md`](DATA-MODEL.md)**. Below is what exists in production now.

### 1. User profiles + per-user lists
```
/users/{uid}                          — profile doc (get: public — "tighten later"; write: owner)
/users/{uid}/favorites/{animeId}      — owner only
/users/{uid}/watchlist/{animeId}      — owner only
/users/{uid}/notifications/{notifId}  — owner reads; CLIENT-written (see vuln note)
```
Favorites/watchlist hold both catalog slugs and non-catalog `al:<aniListId>` doc-ids. Notifications are pruned to the newest 10 **client-side** (`script.js:1585` `cleanupOldNotifications`, fired by the listener at `:1720`) — so pruning only runs when the recipient loads a page.

> **⚠️ Security note — the notification create rule is a live spoof/spam vector.** `firestore.rules:20-36` lets **any signed-in user create a notification in any other user's subcollection**, constrained only to `type ∈ {comment_vote, review_vote}`, `value ±1`, and a field shape — it **never checks `fromDisplayName` against the real sender**, and there is no `createdAt == request.time` clamp. A hand-rolled client can therefore spam a victim's bell with backdated notifications forged "from Blake." **Fix plan (v1.9.0):** all cross-user notification creates move to **Cloud-Function-written** (Admin SDK), the client `create` rule becomes `if false`, and `update` tightens to `hasOnly(['read','readAt'])`. This is the single most important rule change in v1.9.0 — see [DATA-MODEL.md § Notifications](DATA-MODEL.md).

### 2. Comments (under Blake's catalog reviews)
```
/comments/{animeSlug}/items/{commentId}
/comments/{animeSlug}/items/{commentId}/votes/{voterUid}   — value 1 | -1
```
Public read; signed-in create (`uid == auth.uid`); owner edits text / owner deletes. ⚠️ The vote-count update rule lets **anyone** bump `likesCount`/`dislikesCount` directly (no vote-doc backing) — flagged for the v1.9.0 count→Cloud-Function rework.

### 3. Community reviews (one per user per anime)
```
/reviews/{animeSlug}/items/{reviewerUid}                     — doc id == reviewer uid (1-per-user)
/reviews/{animeSlug}/items/{reviewerUid}/votes/{voterUid}
/reviews/{animeSlug}/items/{reviewerUid}/threads/{tid}       — replies under the review
/reviews/{animeSlug}/items/{reviewerUid}/threads/{tid}/votes/{voterUid}
```
Using the uid as the doc id makes "does this user already have a review?" a single `getDoc`. ⚠️ Deleting a review does **not** cascade-delete its `threads/` subtree (Firestore has no cascade) — see Quirks + the v1.9.0 cascade Cloud Function.

### 4. Official (Blake) rating votes
```
/official/{animeId}                    — aggregate likesCount/dislikesCount
/official/{animeId}/votes/{voterUid}   — value 1 | -1
```
By design these do **not** notify and do **not** appear in the activity feed. (Same world-writable-count caveat as comments.)

### 5. Suggestions (the public "suggest an anime" box)
```
/suggestions/{docId}   — PUBLIC create (strict field shape: title/reason/status/submittedAt
                          + optional anilistId/coverImage/format/year/englishTitle/romajiTitle)
```
**ADMIN_UID is the only reader/lister/updater/deleter** — the queue is a private admin surface (`admin/suggestions`). ⚠️ Today a suggestion stores **no submitter uid** (anonymous-by-shape) — v1.9.0 adds an optional signed-in submitter uid so Blake can reply (the "suggestion reply" channel).

### 6. Required composite indexes
Two collection-group indexes power the My Activity feed in `account.js` (`collectionGroup('items')` + `collectionGroup('threads')`, each `uid ASC + createdAt DESC`). There are also the two collection-group **rules** `{parentPath=**}/items` and `{parentPath=**}/threads` (owner-only reads). ⚠️ `firestore.indexes.json` is currently an **empty stub** (`{"indexes":[],"fieldOverrides":[]}`) — the live indexes were auto-created via the console "create index" link. **v1.9.0 Gate 1 codifies all indexes into that file** (the new `forum`/`conversations`/`seasonComments`/`suggestionCounts` queries need composites). If activity ever returns "query requires an index," click the link Firebase prints.

---

## Cloud Functions (NEW in v1.9.0 — first-ever server surface)

Before v1.9.0 there was **no server-side code** — everything was static hosting + client-written Firestore. Cloud Functions enter to do the three things `firestore.rules` cannot: (1) write into a document the acting user doesn't own (trustworthy notification fan-out), (2) cascade-delete a subtree, (3) count / rate-limit across documents.

- **Scaffold (gate P1, LIVE in the repo):** `functions/` with its own `package.json` (gen-2 functions, `firebase-admin` + `firebase-functions`), a global `maxInstances` billing cap, and a no-op **`ping`** health-check proving the deploy path. `firebase.json` gained `functions` + `emulators` blocks; `functions/**` is in the hosting ignore so server code never deploys to the static site.
- **Tests are a separate track:** `npm run test:functions` (pure-logic units via `node --test functions/test/`, no emulator) vs. `npm test` (Playwright/DOM). Emulator-backed integration specs use `firebase emulators:exec` (needs a JDK installed for the Firestore/Auth emulators).
- **The day-1 function inventory + every rule change + the security reasoning live in [`docs/DATA-MODEL.md`](DATA-MODEL.md).** Deploy/Blaze/budget details: [DEPLOYMENT.md § Cloud Functions](DEPLOYMENT.md).

---

## Notable quirks and lessons

- **Runtime version-tag rewrite.** On `DOMContentLoaded`, `script.js` overwrites the changelog version span with `` `v${window.APP_VERSION}` ``, so the static HTML can differ from what users see post-JS. Keep the static fallback in sync with `APP_VERSION` (the v1.3.4-era bug).
- **HTML quote-convention split.** HTML *attributes* use straight ASCII `"` (curly breaks parsing); decorative *text content* may use curly `"…"`. The `Edit` tool can silently swap them — `git diff` after every HTML edit and verify with byte-level inspection if it matters.
- **One review per user per anime.** Enforced by using `auth.uid` as the doc id at `/reviews/{slug}/items/{uid}`. Side effect: deleting + recreating a review leaves the old `/threads/` subcollection orphaned — Firestore client SDK does not cascade. The v1.9.0 cascade Cloud Function fixes this for real.
- **`window.animeData` is undefined.** `animeData` is a classic-script lexical `const`, not a `window` property. Read the bare global.
- **The secondary modal is `.secondary-layer` (a CLASS), not an id.** Tests/probes using `#secondary-layer` will report "not visible."
- **`data-surface` is set in exactly one place** (`setActivePlace`, `script.js:3209`) — the single funnel that drives the veil density per nav place. Don't write it elsewhere.
- **`sync-excel-to-js.js` is parse + serialize.** Any new `animeData` field must be added to BOTH halves or it's dropped on the next sync.
- **Featured "Latest Drop" = last entry in `animeData`** — appending a new anime makes it the featured drop automatically; no toggle.
