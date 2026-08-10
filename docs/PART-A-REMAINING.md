<!-- author: Code | date: 2026-08-10 -->
# PART A — **COMPLETE** (all eight items shipped staged)

> Items 1, 3, 4, 5, 8a, 8b landed 2026-08-09/10. **Items 6, 7 and 2 landed 2026-08-10** — this
> file is now the record of what was built, not a brief. Nothing here is outstanding.
> Floors after: **npm test 348 · rules 218 · cf 94 · functions 94 · webkit 24**.

## ⚡ READ-FIRST
- **Blake's content-deletion decision (2026-08-10) is LOCKED and IMPLEMENTED: "tombstone the containers, erase the content."** A comment/post/review keeps its slot reading `[removed by the author]`; the text, images and display name are erased. Threads stay coherent, nothing they wrote survives. Do NOT re-litigate it.
- **Both live hazards are CLOSED, each reproduced against the emulator before it was fixed:**
  1. ~~A member can fire the whole deletion cascade from devtools.~~ **CLOSED.** `firestore.rules` `users/{uid}` is now `allow create, update: if isOwner(uid); allow delete: if false;`. Reproduced first: the deny-test FAILED against the old rules (216/218), passes now.
  2. ~~The erasure is not scoped to the leaver.~~ **CLOSED.** The cascade tombstones instead of `recursiveDelete`. Reproduced first: with the old code and the cascade PROVEN to have run, the bystander's post AND reply were both gone; with the new code both survive. ⚠️ The FIRST reproduction attempt was a false negative (the wait exited before the trigger fired) — hardened, then it reproduced.
- **The admin account is undeletable at BOTH entry points** — `deleteAccountGuard` (the callable) and `runAccountErasure` itself (the users-delete trigger, which no guard had covered).

---

## ITEM 6 — admin member-stats page ✅ SHIPPED
Blake: *"track member stats included joined this month, active users, comments, reviews posted etc etc"*.

**Built as designed: a scheduled recompute writes ONE admin-read-only doc.** Opening the page costs exactly 1 Firestore read, forever.
- `functions/lib/stats.js` — pure window math + a db-injected recompute (the `lib/sweep.js` shape). 17 unit tests, no emulator.
- `exports.recomputeStats` — `onSchedule('every 24 hours')`, 540s/512MiB (a full-tree pass needs the same room the orphan reaper needed).
- `exports.refreshStatsNow` — admin-only `onCall` behind the page's "Refresh now".
- Rules: `match /adminStats/{doc}` — admin `get` only; no list, no client write of any kind (4 rules tests, including "not even the admin can write it").
- `admin/stats.{html,js,css}` + `ADMIN_MENU_ITEMS` + **8 `bump-version.js` LATE_TARGETS rows in the same gate** (`--check` shows 111 strings agreeing).
- **Privacy is structural, not a promise:** every read is `.select()`-projected, and the DM lane names NO fields — a letter's body never reaches the function. A cf-test asserts a seeded message body and both member uids are absent from the written doc.
- **Real-pixel caught a real defect:** the Refresh button painted 37px. Fixed to the item-4 44px tap-target floor.

## ITEM 7 — self-serve account deletion ✅ SHIPPED
Blake: *"New way to delete your account in user settings thats available to all members."*
- **Rules hazard closed first** (one line, biggest payoff).
- `functions/lib/account.js` — `runAccountErasure` is the ONE definition of leaving, called by BOTH the callable and the users-delete trigger. Tombstone pass (reusing `lib/moderation.js`'s H5 redaction with a different flag) → hard-delete pass → DM lock.
- `exports.deleteMyAccount` — `onCall`; refuses the admin UID, refuses a token whose `auth_time` is older than 5 minutes (an unattended signed-in browser cannot delete an account), erases, then deletes the Auth user so they cannot simply sign back in.
- Client: the **Leaving** card in account settings — closed by default, states what happens BEFORE asking, type-to-confirm `DELETE`, then a password reauth. Zero native dialogs.
- Client tombstone rendering on all six surfaces: `[removed by the author]`, distinct from the moderator's `[removed]`.
- ⚠️ **`authorDeleted`, deliberately NOT `removed`** — the hub list filters `removed !== true`, so the moderator mark would hide the thread and take the bystanders' posts out of reach anyway.

### 🔴 A REAL DEFECT FOUND WHILE VERIFYING — read this before touching the redaction
`redactAuthored` used `batch.set(ref, upd, {merge:true})`, and **set-with-merge CREATES a document that isn't there.** The query and the write are not atomic, so any doc deleted in between was **resurrected as a ghost tombstone** that then fired the create-triggers. Invisible while the path only ran on a ban (rare, target's docs alive); item 7 put it on the erasure path, where things are being deleted all around it. It surfaced as a trigger storm that starved an unrelated cascade for 75s. **Root-caused by re-running the pre-change baseline (79/79 green), not by raising the timeout.** Fixed: per-doc `update()`, which carries an implicit exists-precondition. Pinned by a regression test.

## ITEM 2 — profile reviews rework ✅ SHIPPED
Blake: *"Users can pin one review and other users now have to click a button that brings up a separate sheet of all the reviews a user has made so it doesn't take up the entire profile."*
- The pinned review leads; everything else lives behind ONE `all reviews (N)` door in the shelves' existing `.profile-col-viewall` language.
- **The one-tab tablist is gone, not restyled** — `role="tablist"` with a single `role="tab"` and no tabpanel is an accessibility lie.
- The all-reviews view is a second VIEW of the SAME sheet: the profile body is hidden, never rebuilt, so every listener already bound to it survives the round trip and Back costs no refetch.
- **rarNav:** `profileReviews` is its own step; Back/Esc consume the entry and let popstate close (never close-then-push). `#profile=<uid>/reviews` is a real deep link — the suffix is split off BEFORE decoding so a `%2F` can't forge it.
- Two older specs pinned the removed tablist and were changed deliberately, with the reason inline (`g26-gate207`, `g29-creator`).

---

## Ops notes (still true)
- `npm run test:rules` / `test:cf` **fail in Git Bash** — the scripts call bare `firebase`. Use `npx firebase`, with `JAVA_HOME=C:\Users\Owner\jdk-21.0.11+10`. Sweep 8080/9199/5001/9099/8765 first; send emulator output to a FILE, never a pipe.
- `npm run test:webkit` is the iOS track. Keep it separate from `npm test`.
- ⚠️ **cf-track ordering matters.** Running an ad-hoc subset in a different order made `cf-moderation` fail on a 20s wait; the canonical 8-file order is green. Judge the floor by the canonical command, not by a convenient subset.
- Tests changed deliberately this run because they pinned the old behaviour: `cf-cascade` (asserted the destroy-everything cascade), `g26-gate207` + `g29-creator` (the tablist). Reasons are inline in each.
