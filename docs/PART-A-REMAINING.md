<!-- author: Code | date: 2026-08-10 -->
# PART A — what's done, what's left, and how to finish it

> Handoff doc. Items 1, 3, 4, 5, 8a, 8b are SHIPPED (staged/committed). Items **6, 7, 2** remain.
> Recon for all eight is already done — this doc carries the distilled result so the next session
> does **not** need to re-run it. Floors at handoff: **npm test 320 · rules 211 · cf 79 · webkit 24**.

## ⚡ READ-FIRST
- **Blake's content-deletion decision is LOCKED (2026-08-10): "tombstone the containers, erase the content."** A comment/post/review keeps its slot reading `[removed by the author]`; the text, images and display name are erased. Threads stay coherent, nothing they wrote survives. Do NOT re-litigate this.
- **Two live hazards found during recon, both fixed by item 7 — treat as bugs, not features:**
  1. **A member can already fire the whole deletion cascade today.** `firestore.rules:245` allows `delete` on `users/{uid}` by its owner, and `onUserDelete` (functions/index.js:428-478) fans out from that doc's deletion. No UI does it, but devtools would. It is live and unguarded.
  2. **Today's erasure is not scoped to the leaver.** `recursiveDelete` on their forum thread takes **every other member's posts in it** (index.js:439-440); on their comment it takes others' replies; on their review it takes others' reply threads (index.js:434-435). Innocent third parties lose their words. This also contradicts shipped copy — the former-member tombstone at script.js:5606 says "what they shared lives where they posted it".
- **The admin account must be undeletable** (literal-UID guard, the `setBanState` shape at index.js:691-702).

---

## ITEM 6 — admin member-stats page (NOT started)
Blake: *"track member stats included joined this month, active users, comments, reviews posted etc etc"*. Branded, no native controls, counts only — never content.

### The design (decided, with the reasoning that settles it)
**A scheduled Cloud Function recomputes everything and writes ONE admin-read-only stats doc. NOT client-side `count()` aggregation.** Three reasons, in order of weight:
1. **Two metrics are impossible from a client at any price.** `users` list is owner-only (rules:244) and `conversations`/`messages` list is participant-only with no collection-group rule (rules:733, 864-865, 326). So "active users" and "DM volume" cannot be counted client-side even with unlimited budget. Once a CF is required for two tiles, running all of them there costs nothing extra and keeps ONE code path.
2. **Billing shape.** `count()` bills 1 read per 1000 index entries, re-charged on **every page open** (and Blake will refresh). A daily CF + a 1-doc read means the admin page costs exactly **1 read per open, forever**.
3. **Why NOT trigger-maintained counters:** the delete surface here is huge (onUserDelete, onBanCascade, recursiveDelete, soft-removes). One missed decrement corrupts the number permanently with no self-heal — and there is already proof in the tree: `forum.postCount` increments at index.js:311-319 and **nothing ever decrements it** (index.js:416-421). A scheduled recompute overwrites with ground truth, so the drift class cannot exist.

### Build order
1. `functions/lib/stats.js` — pure, db-injected core (mirror `lib/sweep.js` / `lib/moderation.js`), exporting the window math + the recompute. Unit-testable without the emulator.
2. `exports.recomputeStats` — `onSchedule('every 24 hours')`, mirroring `reapOrphanUploads` (index.js:1193-1201, the only existing scheduled CF). Writes `adminStats/current`.
3. `exports.refreshStatsNow` — admin-only `onCall` for a "Refresh now" button (shape: `backfillProfiles`, index.js:645-649).
4. Rules: `match /adminStats/{doc}` — `allow get: if isAdmin(); allow write: if false;` (CF-only, like `cfProcessed`).
5. `admin/stats.html` + `.js` + `.css` — copy the `admin/curation.html` scaffold exactly (gate with the `rendered` latch from curation.js:258-281). Register in `ADMIN_MENU_ITEMS` (admin-fab.js) **and** add the ~9 `bump-version.js` LATE_TARGETS rows in the SAME gate — the stale-TARGETS trap has bitten 3×.
6. Tests: unit-test the window math; pin the page scaffold + registrations like `tests/catalog-admin.spec.js` does.

### Metrics and their sources
| Tile | Source |
|---|---|
| Members total / joined this month | `profiles/*.joinedAt` (minted at signup, index.js:651) |
| Active users (define honestly) | writes in the last 30d across authored collections; state the definition **on the page** |
| Comments / reviews / threads / posts | collection-group counts of `items`, `threads`, `posts` |
| DM volume | `conversations/*/messages` — counts only, **never content** |
| Appreciates | `profiles/*.likesCount` (the count-free carve-out) |

---

## ITEM 7 — self-serve account deletion (NOT started)
Blake: *"New way to delete your account in user settings thats available to all members."*

### The content policy — LOCKED
**Tombstone the container, erase the content.** Per surface:
- **Comments / replies / forum posts / community reviews** — keep the doc so the thread holds its shape; blank `text`/`body`/`title`, drop `imageRefs`/`thumbImage`, set `displayName` to `[deleted]`, clear `photoURL`, and mark `authorDeleted: true`. **Precedent already in the codebase: the H5 redaction in `onBanCascade` (lib/moderation.js:109-137) — reuse that path rather than writing a second one.**
- **Forum threads they started** — tombstone the OP the same way. **Do NOT `recursiveDelete`** — that is hazard #2 and it destroys other members' posts.
- **Their votes** — delete (they are not content, and leaving them inflates counts).
- **Profile, saves, shelves, savedShelves, notifications, notifPrefs, consent/moderationGate, Storage `uploads/` + `avatars/` + profile bg** — hard delete.
- **DMs** — keep today's behaviour: lock the conversation, don't nuke the other person's thread (index.js:425 already states this policy).
- **Reports referencing them** — keep (moderation record), they point at a tombstone now rather than dangling.

### Build order
1. **Close hazard #1 first:** flip `firestore.rules:245` so `users/{uid}` delete is **no longer owner-writable** — deletion must go through the callable. This is a one-line rules change with a big safety payoff; do it even if the rest slips.
2. `exports.deleteMyAccount` — `onCall`, requires recent login (Firebase Auth reauth requirement), refuses the admin UID, then: tombstone pass → hard-delete pass → Auth user delete.
3. Rewrite the fan-out to tombstone-not-recursiveDelete (index.js:434-446), reusing `lib/moderation.js`'s redaction.
4. Settings UI in `account.html`/`account.js` — a branded "Danger" card, type-to-confirm, `friendlyError`, reauth prompt. **Zero native dialogs** (`showNotice` / the `confirmModal` shape at admin/suggestions.js:276-330).
5. Tests: rules (owner can no longer delete `users/{uid}`; admin undeletable), cf-cascade (tombstone leaves other members' posts intact — assert a third party's reply SURVIVES), and a page-scaffold spec.

### Also decided
**Immediate, not a grace period** — a grace period means retaining data after they asked you to stop.

---

## ITEM 2 — profile reviews rework (NOT started)
Blake: *"Users can pin one review and other users now have to click a button that brings up a separate sheet of all the reviews a user has made so it doesn't take up the entire profile."*

Entirely inside `script.js` + `style.css` — **no new file, so no bump-version TARGETS change**.
1. `script.js:5728-5739` — replace the `.profile-acts` tablist + `<ul class="profile-list" data-profile-acts>` with the pinned slot + one disclosure button in the existing `.profile-col-viewall` language (precedent: script.js:5850-5852 / style.css:10671, already on this sheet).
2. **Drop `role="tablist"`/`role="tab"`** — a one-tab tablist with no tabpanel is an a11y lie, and the chip was already vestigial (comment at script.js:5731-5735).
3. Keep the `featuredAnime` fetch (script.js:5772-5789); render the pinned review first.
4. The "all reviews (N)" button opens the existing sheet layer — reuse it, don't build a second.
5. **rarNav:** deep-link + Back must behave. NEVER close-then-push synchronously — use `rarNavCascade` (the LAST CALL entry documents the two HIGH races).

---

## Ops notes for whoever picks this up
- `npm run test:rules` / `test:cf` **fail in Git Bash** — the scripts call bare `firebase`, which is not on that shell's PATH. Run the same command with `npx firebase`, and set `JAVA_HOME=C:\Users\Owner\jdk-21.0.11+10` first. Sweep ports 8080/9199/5001/9099/8765 before starting emulators; send emulator output to a FILE, never a pipe (SIGPIPE strands port 8080).
- `npm run test:webkit` is the iOS track (3 iPhone sizes). Keep it separate from `npm test`.
- Two tests were deliberately changed this run because they **pinned defects**: `cf-profile.spec.js` (asserted an off-origin avatar IS copied) and `g4-comments.spec.js` (asserted the native `<option>`). Both have the reason recorded inline.
- The parallelism flake list gained `gate5-nav-home` "today's date" and the g15 lightbox `waitForFunction` — both pass isolated; re-run before believing a red.
