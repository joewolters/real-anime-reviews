<!-- author: Code | date: 2026-06-06 -->
# v1.9.0 Community Overhaul — Firestore Data Model (the CONTRACT)

## ⚡ READ-FIRST
- **What this is:** the v1.9.0 **Firestore data model — the binding CONTRACT** that `firestore.rules`, the Cloud Functions (`functions/`), and the client all implement. Collections, doc shapes, CF-only-write rules, indexes, the path-collision ledger, and the protect-the-heart invariants.
- **When to open it:** any time you touch `firestore.rules`, a Cloud Function, or a community read/write (comments / reviews / forum / DMs / notifications / profiles / reports / suggestionCounts) — or you need to know WHY a write must be CF-only. The security fixes (H1–H5 / M1–M6) are binding.
- A fresh Code does NOT read this at session start — open it only when your gate works the data layer.

> ⛔ DEEP REFERENCE BELOW — do NOT read top-to-bottom. Open a section ONLY if you're stuck on that specific thing.

### Jump-to (only if stuck)
- **CHANGED — existing collections** — open if you touch notifications / suggestions / comments / reviews / official / replies, or the deferred `users/{uid}` tightening.
- **NEW — collections** — open if you touch the forum hub, per-season reuse, DMs (conversations/messages/reads), profiles, suggestionCounts, or reports.
- **CF-only writes — consolidated** — open if you need WHY a client rule can't do a write (and which CF owns it).
- **Cloud Functions inventory** — open if you need the CF list + what each does.
- **Path-collision ledger** — open if you're adding a collection/path and need to confirm no collision.
- **Indexes to add** — open if a query needs a composite index (`firestore.indexes.json`).
- **Test plan (two tracks)** — open if you need the rules-emulator + functions test split.
- **Protect-the-heart invariants (bake as assertions)** — open if you need the gold-is-Blake-only / community-supporting-cast invariants to assert.

> **This is the frozen data contract for the whole v1.9.0 ship.** Every later gate builds against it. It folds in Blake's 7 gate-0 answers and the 5 HIGH-severity + supporting security fixes from the adversarial review. The LIVE-today schema is in [ARCHITECTURE.md § Firestore data model](ARCHITECTURE.md); this doc is the **target**. Nothing here is applied yet — the rules rewrite is Gate 1.

**Conventions:**
- Types are Firestore primitives (`string`, `int`, `number`, `bool`, `timestamp`, `map`, `array`).
- **`CF-only`** = the client rule for that write is `allow … : if false;`. Only a Cloud Function (Admin SDK, which bypasses rules) writes it. This is how cross-user writes, counters, and cascades stay tamper-proof.
- **`ADMIN_UID`** = the single hardcoded admin uid already in `firestore.rules` (referred to symbolically here). M4 (below) recommends migrating it to a Firebase Auth custom claim.

**Blake's gate-0 answers (folded into this contract):**
1. **DMs:** admin↔visitor floor + message-Blake ship; **open user↔user (`kind:"peer"`) is BANKED** — the schema is peer-ready (one rules clause flips it on later, zero migration).
2. **Suggestions:** capture the signed-in **submitter uid** at submit time → enables the "suggestion reply" channel.
3. **Account deletion:** the **`onUserDelete` cascade is a DAY-1 Cloud Function** — "delete my account" really wipes content; the privacy page documents a real button.
4. **Hub sort:** launch on `lastActivityAt` ("Active"); the spoof-proof CF-computed **`hotScore`** switches on when the vote CF lands (same trigger).
5. **@mentions:** **deferred** — name+avatar identity ships now; no `mention` notification type in v1.9.0.
6. **Per-season comments:** each season is its own **`al:{aniListId}`** thread.
7. **Ship shape:** ONE ship, ~16 gates (gate-6 split point is an emergency exit only).

---

## CHANGED — existing collections

### `users/{uid}/notifications/{notifId}` — reworked (the #1 security change)
Path unchanged (the bell keeps reading it). Expanded shape:

| field | type | notes |
|---|---|---|
| `toUid` | string | == owning uid |
| `fromUid` | string | true sender, **CF-set** from the auth token |
| `fromDisplayName` | string | **CF-sourced from `profiles/{fromUid}`** — never client input |
| `fromPhotoURL` | string \| null | CF-sourced |
| `type` | string | enum (v1.9.0): `comment_vote`, `review_vote` (legacy, kept), `reply`, `dm`, `blake_message`, `suggestion_accepted`, `new_season`. **No `mention`** (deferred, Q5). |
| `verb` | string | short human phrase for rendering |
| `targetPath` | string | deep-link (`forum/<tid>`, `seasonComments/<al:id>`, `conversations/<convId>`, `#open=<slug>`) |
| `animeId`/`animeTitle`/`value` | string/string/int \| null | kept for vote pings (back-compat) |
| `read`/`readAt` | bool/timestamp | owner-flippable |
| `createdAt` | timestamp | CF `serverTimestamp` |

**Rules:** `create: if false` (CF-only — closes the spoof vector, see H3); `update: isOwner(uid) && diff.hasOnly(['read','readAt'])`; `delete: isOwner`. Native TTL on an `expiresAt` field self-prunes (retires the client-side `cleanupOldNotifications`).

### `suggestions/{docId}` — +submitter uid (Q2)
Add an **optional** `submitterUid` (signed-in submitters only; raw-title anonymous submissions still pass). Enables: (a) the suggestion-reply DM channel, (b) the `suggestion_accepted` notification. Keep the strict closed-key-set create rule; add `submitterUid` to the allowed keys with `== request.auth.uid` when present. ADMIN_UID-only read stays.

### `comments` + `reviews` + `official` — counts move to CF
⚠️ **H1 (binding):** DELETE the existing client `update … hasOnly(['likesCount','dislikesCount'])` clause (`firestore.rules:68-72`/`108-113`/`169-175`). Clients write only their own `votes/{uid}` doc; a vote CF owns the counters via `FieldValue.increment()`. Without this deletion the count CF is pointless — anyone can still `updateDoc({likesCount: 999999})`.

### `comments/{key}/items/{cid}/replies/{rid}` — NEW depth-1 replies
One level only (a reply cannot be replied to). ⚠️ Segment name **`replies`**, NOT `threads` (avoids the collection-group `{parentPath=**}/threads` rule). Add a parallel `{parentPath=**}/replies` collection-group rule if replies should appear in the activity feed. Lazy-subscribed (subscribe on open, server-count on the toggle) so listener fan-out stays flat. Render via `renderMarkdownInline` (headers OFF).

### `users/{uid}` get — tightening DEFERRED (verify-first flag fired)
> **⚠️ CONTRACT CORRECTION (2026-06-06, gate 1):** the study said tighten `users/{uid}` get to owner-only. **Verified the live code first and found three cross-user reads** — the comment/review/thread author-name+photo display reads other users' `users/{uid}` docs at `script.js:4125`, `:4898`, `:5124`. Tightening now would **break the live author display**. So for v1.9.0 `users/{uid}` get **stays public (`if true`, status quo)**; `profiles/{uid}` is added as the canonical public identity. The tightening happens only in a LATER gate, AFTER those three reads migrate to `profiles/{uid}` (a code change, out of the rules-only gate-1 scope). Until then, identity is dual-sourced (legacy `users` snapshot reads + the new `profiles` doc).

---

## NEW — collections

### `forum/{threadId}` + `/posts/{postId}` — the Community Hub
⚠️ Named `forum`/`posts` to dodge the existing `threads` collision (collision check PASSED — see ledger below).

`forum/{threadId}`: `authorUid/authorName/authorPhoto`, `title` (1–120), `body` (0–4000, `renderMarkdown`), `tag` (enum `general|recommend|blakes-44|offtopic`), `createdAt`, `editedAt`, **CF-only** `lastPostAt`/`postCount`/`reportCount`/`hotScore`, **admin-only** `pinned`/`locked`/`removed`. Public read.
`forum/{threadId}/posts/{postId}`: `authorUid/Name/Photo`, `body` (1–4000), `createdAt`, `editedAt`, **CF-only** `likesCount`/`reportCount`, `removed`. Create blocked when the parent is `locked` (rules `get()` on the parent).

- **Sort (Q4):** day-1 `orderBy('lastActivityAt','desc')` ("Active"); `hotScore = (up − down + 0.5·replyCount) / (ageHours + 2)^1.5` (CF-maintained) switches on when the vote CF lands. Tabs: Active/Hot · New · Top.
- **Rules — H2 (binding):** create pins `pinned==false && locked==false && removed==false && postCount==0 && reportCount==0` for ALL creators; owner update `hasOnly(['body','editedAt'])`; admin update may set `pinned`/`locked`/`removed`; **no client branch sets any counter**; `delete: if false` (soft-delete + CF cascade).
- **H5 (binding):** a mod removal (`removed=true`) MUST also null `body`/`title` server-side — a flag alone leaves "deleted" abuse console-readable.
- **Indexes:** `(removed, pinned DESC, lastPostAt DESC)`, `(tag, lastPostAt DESC)`, posts `(removed, createdAt ASC)`.

### Per-season comments + reviews (Q6) — REUSE `comments`/`reviews`, no new collection
> **⚠️ CONTRACT CORRECTION (2026-06-06, gate 1):** the gate-0 study contained a contradiction — design agent D1 proposed a separate `seasonComments/{aniListId}` collection while D7 proposed reusing `comments/al:{id}` / `reviews/al:{id}`. **Resolved in favor of reuse.** There is **NO separate `seasonComments` collection.** Per-season comments and reviews live in the EXISTING `comments/{key}/items` and `reviews/{key}/items`, where `key = communityKey(ctx)` = a catalog slug for Blake's modal or **`al:{aniListId}`** for the secondary (per-season) modal. Why: the existing `match /comments/{anime}/items` and `match /reviews/{anime}/items` rules use a wildcard `{anime}` segment that **already accepts `al:123`** (only `/` is illegal in a path segment; `:` is fine — verified by emulator test), so per-season comments need **zero new collection, zero new rules block, zero new code** — just the `communityKey()` key-picker and wiring the community block into the secondary modal (which has none today), **always after** Blake's `.secondary-review`.
- ⚠️ **M3 (binding):** the `comments`/`reviews` create rules already pin `uid == auth.uid` — that pin protects the `al:{id}` keys too (an attacker can't write a comment under a victim's uid into the victim's activity feed).
- The `al:{id}` items inherit the existing `(items collection-group)` activity rule and the existing `(removed/createdAt)` ordering — no new index beyond what `comments`/`reviews` already use.

### `conversations/{convId}` + `/messages/{msgId}` + `/reads/{uid}` — DMs (Q1)
`convId = sorted(uidA)__sorted(uidB)` (deterministic — one convo per pair in a single `getDoc`). `participants:[2 uids]`, `kind:"admin"|"peer"`, `origin:"message_blake"|"suggestion_reply"|"admin_outreach"|"peer"`, `suggestionRef`, `state:"open"|"locked"`, **CF-only** `lastMessageAt`/`lastMessageText`/`lastSenderUid`/`unread` map. `reads/{uid}.lastReadAt` (owner-only). `messages/{msgId}`: `senderUid/Name/Photo`, `text` (1–2000, `renderMarkdown`), `createdAt` — **no votes**, `update/delete: if false` (immutable).
- **Day-1 (`kind:"admin"`):** client-written, gated so one participant is always ADMIN_UID (safe — Blake is always a party; no stranger-to-stranger surface). Message-Blake = a convo with members `[visitorUid, ADMIN_UID]`, `origin:"message_blake"`. Suggestion-reply = same primitive seeded from a suggestion (needs Q2's `submitterUid`).
- **BANKED (`kind:"peer"`):** CF-created only (block-check + rate-limit live server-side). Adding it later = one additive rules clause, **zero migration**.
- ⚠️ **H4 (binding):** read rule `auth.uid in get(parent).participants`. **Never add a `{parentPath=**}/messages` collection-group rule** (it would expose all messages globally) — drive any "all my DMs" view off the `conversations` `array-contains` query. The deterministic convId is existence-probeable (acceptable, noted).
- **Indexes:** `conversations (participants ARRAY_CONTAINS, lastMessageAt DESC)`; `(kind, participants ARRAY_CONTAINS, lastMessageAt DESC)` for Blake's message-Blake inbox.

### `profiles/{uid}` — public identity (name+avatar baseline; full pages BANKED)
`uid`, `displayName`, `photoURL`, `bio` (0–500, `renderMarkdown`), `joinedAt`, **CF-only** `isAdmin` (the gold "this is Blake" badge), `isBanned`. Public read; owner writes `hasOnly(['displayName','photoURL','bio'])`.
- ⚠️ **M1 (binding):** owner-writable `displayName` lets a user set theirs to "Blake" and the notification CF then *launders* it into a trusted field. Mitigate: a reserved-name denylist (`blake`/`admin`/`mod`, homoglyph-normalized) in the profile-write path; the gold `isAdmin` badge is the ONLY authority signal in the UI.
- ⚠️ **M2 (binding):** constrain `photoURL` to your own storage origin (a raw external URL is a tracking-pixel/shock-image/content-swap vector; `escapeHtml` stops XSS but not the request leak).
- **`counts` map CUT** from v1.9.0 (public post-counts = a per-user leaderboard; heart-erosion). Profiles ship as a **mini-card** (tertiary modal, ≤5 recent items, count-free), not a public page.

### `suggestionCounts/{aniListId}` — the "N requested" aggregate
`count`, `title/coverImage/format/year` snapshot, `firstSuggestedAt`, `lastSuggestedAt`, `status`. **CF-only writes** (a client that could write it would inflate a title to pressure Blake). **ADMIN_UID-only read** (visitor-visible counts invite brigading). Index `(status, count DESC)`.

### `reports/{reportId}` — moderation queue
`reporterUid` (`== auth.uid`), `reason` (enum `spam|harassment|offtopic|other`), `note` (<500), `status:'new'`, `targetType/targetPath/targetUid`, `snapshotText`. **ADMIN_UID-only read** (mirror suggestions). Closed-key-set create, `createdAt == request.time`.
- ⚠️ **L3 (binding):** `snapshotText` is reporter-controlled → the admin queue **re-fetches live public content** from `targetPath` and labels the snapshot "reporter-supplied, unverified" (a reporter can otherwise fabricate evidence). Dedupe the queue by `targetPath`.

---

## CF-only writes — consolidated (why a client rule can't do it)
| Write | Why CF-only |
|---|---|
| All `notifications` creates | cross-user write; only the server knows the true sender + a non-spoofable name |
| All like/dislike/post/report counters (comments, reviews, threads, posts, seasonComments, official) | `FieldValue.increment()` race-safety + tamper-proofing (H1) |
| `forum.hotScore`, `lastPostAt`, `postCount` | client can't be trusted to write a sort key |
| `conversations` create + `messages` create (+ unread map) | verify the other member exists / not blocked / force-ADMIN for `kind:"blake"`; atomic summary update |
| `profiles.isAdmin` / `isBanned` | trust/enforcement flags (impersonation / ban-evasion) |
| `suggestionCounts` (all) | tamper-proof tally |
| Cascade deletes (review→threads→votes; thread→posts; **user→all authored content + foreign votes + conversations**) | Firestore doesn't cascade; a user can't delete others' subdocs under content they remove |

---

## Cloud Functions inventory

**Day-1 (the trustworthy core):**
1. `onVoteWriteNotify` — `onWrite` of the vote subcollections → `increment()` counts + a server-sourced notification. Enables notif `create:if false`.
2. `pruneNotificationsOnCreate` — keeps each inbox ≤10 server-side (+ a native TTL).
3. **Cascade deletes** — `reviews→threads→votes` (orphans TODAY), `forum→posts`, and **`onUserDelete`** (Q3 — day-1: deletes authored content, *foreign* `votes/{uid}` docs via a `votes` collection-group read, saves, notifications, profile, and tombstones every `conversations` the user is in).
4. `enforceRateLimit` — callable on new thread/post/DM writes (the load-bearing abuse defense given "no approval queue").

**Deferred:** `aggregateSuggestionCounts` (admin convenience), `onDirectMessageCreate` (build with peer DMs), scheduled `detectNewSeasonReviews` (the catch-up door — has a viable no-CF client-diff path).

**Cross-cutting CF rules (M6 binding):** idempotency via `context.eventId` on every counter/fan-out; DM send is a **callable transaction** (message + summary + notify atomic); per-function `maxInstances` + a GCP budget alert; no trigger writes a path it watches.

> **Gate-2 implementation additions (2026-06-06 — built, emulator-verified, NOT deployed):**
> - **`cfProcessed/{eventId}`** — NEW internal collection: the idempotency marker the vote CF `.create()`s per event (create-if-absent = atomic dedupe). **CF-only by default-deny** (no rules match it → clients can't read/write; Admin SDK bypasses). Self-expiring via an `expiresAt` field (+7 days; native TTL).
> - **CF notification shape:** the vote CF writes `fromDisplayName`/`fromPhotoURL` **server-sourced** from `profiles/{voterUid}` (falling back to legacy `users/{voterUid}.username/photoURL`), plus `type`, `value`, `verb`, `animeId` (the slug or `al:<id>` from the path), `targetPath`, `read:false`, `createdAt`, `expiresAt` (+90 days). **It does NOT set `animeTitle`** (the CF has no catalog access — the gate-6 notification center resolves the title from `animeId` client-side via `animeData`). Mutes are honored at the source via `users/{uid}/notifPrefs/prefs` (doc id `prefs`).

---

## Path-collision ledger (verified 2026-06-06 — PASS)
Grepped all `*.js` for `forum`/`posts`/`conversations`/`messages`/`reads`/`profiles`/`suggestionCounts`/`reports`/`replies` → **zero matches**; full read of `firestore.rules` confirms the only existing paths are `users`(+favorites/watchlist/notifications), `comments/items`, `reviews/items`(+`threads`), `official`, `suggestions`, `votes`, and the `{parentPath=**}/items` + `{parentPath=**}/threads` collection-group rules. **Two documented couplings:** (a) `seasonComments/.../items` intentionally inherits the `items` activity-feed rule (pin `uid==auth.uid` — M3); (b) the new `replies` subcollection needs its OWN collection-group rule (NOT named `threads`). No other collisions.

## Indexes to add (Gate 1 → `firestore.indexes.json`, currently an empty stub)
forum `(removed, pinned DESC, lastPostAt DESC)` + `(tag, lastPostAt DESC)` + `(hotScore DESC)`; posts `(removed, createdAt ASC)`; seasonComments items `(removed, createdAt DESC)`; conversations `(participants ARRAY_CONTAINS, lastMessageAt DESC)` + `(kind, participants ARRAY_CONTAINS, lastMessageAt DESC)`; suggestionCounts `(status, count DESC)`; plus the existing `items`/`threads`/`replies` collection-group activity indexes (`uid, createdAt DESC`).

## Test plan (two tracks)
- **`npm test`** — Playwright/DOM, static server, single worker. Adds the protect-the-heart assertions (see below).
- **`npm run test:functions`** — pure-logic CF units (`node --test functions/test/`, no emulator). Most CF bug surface (prune math, self-notify guard, rate-window) lives here.
- **Emulator integration** (`firebase emulators:exec`) — proves rules + (later) trigger wiring (vote→notification, delete→no-orphans, N suggestions→count). ⚠️ Needs a **JDK 21+** for the Firestore/Auth emulators (firebase-tools rejects Java < 21; functions-only is Node-only). `npm run test:rules` is the rules track (35 cases as of gate 1). Keep the tracks separate.

## Protect-the-heart invariants (bake as assertions)
Den is the only nav place with a resting gold accent · Blake's gold rating stays primary ABOVE the subordinate community histogram · `profiles.counts` cut · Blake-origin notifications sort above community pings · **`.secondary-review` precedes the community block in DOM order** · first catch-up-door row is Blake-origin · profile is a count-free mini-card · closeout: grep new community CSS for `gold` → zero hits except the Blake-rating ticks.
