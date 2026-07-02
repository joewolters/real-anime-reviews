<!-- author: Code | date: 2026-06-06 -->
# v1.9.0 CUTOVER RUNBOOK — the one moment prod changes

## ⚡ READ-FIRST
- **What this doc is:** the step-by-step runbook for the v1.9.0 production cutover (new client + staged `firestore.rules` + Cloud Functions all going live together). It is a DEEP REFERENCE, not session-start reading.
- **⚠️ PERMANENT lesson from the v1.10.0 cutover (confirmed by Blake 2026-06-12):** Storage rules that cross-read Firestore (`firestore.get()/exists()`) need the **cross-service IAM grant** (firebase-rules service agent → `roles/firebaserules.firestoreServiceAgent`) on PROD. **The deploy CLI does NOT grant it** (proven, firebase-tools 15.19.1 --debug) and the emulator never needs it — every rules test stays green while prod denies ALL uploads. Pre-flight for ANY storage-rules deploy touching cross-reads: verify the grant in the Firebase console (Storage → Rules — the permission banner / its one-click Grant). v1.10.1's root, fixed by Blake clicking exactly that banner.
- **Open it ONLY when:** Blake has said "ship it" and you are actually triggering/working the v1.9.0 cutover.
- **Open it ONLY when:** you are mid-cutover and need the exact deploy order, a per-step verify command, or a rollback.
- **Otherwise SKIP it** — a fresh Code does not need this doc to do normal v1.9.0 work; reading it top-to-bottom burns context for no gain.

> ⛔ DEEP REFERENCE BELOW — do NOT read top-to-bottom. Open a section ONLY if you're stuck on that specific thing.

### Jump-to (only if stuck)
- **What's changing in one breath** — open if you need the one-paragraph summary of what goes live vs. what prod runs today.
- **⚠️ The ordering rule (why the sequence below)** — open if you need to understand why client→rules→functions is the order (double-count vs. denied-write).
- **THE SEQUENCE (run in order; verify each before the next)** — open if you need the exact commands and per-step verify checks (pre-flight → close-out).
- **STALE CACHED CLIENT — what they experience + why it's bounded** — open if you need to know what a not-yet-reloaded user sees and why it self-heals.
- **PREVIEW CHANNEL — what it CAN and CANNOT verify (be explicit)** — open if you're deciding what a preview deploy actually proves before the cutover.
- **ROLLBACK (per step)** — open if a step went wrong and you need the per-step undo or full abort.
- **The 7 things that must already be true before you start** — open if you need the pre-cutover go/no-go checklist.

> **Written at gate 6. NOT run yet.** This is exactly what Blake's "ship it" triggers. Read it whole before starting. Do it at a **deliberately quiet moment** (near-zero concurrent voters). Everything below was rehearsed in the emulator (`npm run practice` + `test:rules 49` / `test:cf 15`).

## What's changing in one breath
The staged `firestore.rules` (DENY client count/notif writes; `notifications create: if false`) + the Cloud Functions (own all counts + notifications) + the new client (writes ONLY vote docs; has the Lantern; no count/notif writes) all go live together. Production today runs the OLD rules + OLD client + only the `ping` function.

## ⚠️ The ordering rule (why the sequence below)
Two failure modes to avoid:
- **DOUBLE-COUNT (permanent corruption):** a Cloud Function increments a count while ANY client is *also* writing that count directly. Only the OLD client writes counts. So **the count CFs must NOT be live while a count-writing client is.**
- **DENIED-WRITE (recoverable):** once the new rules are live, the OLD (cached) client's count/notif writes are denied → its voting breaks until the user reloads (cache-busting delivers the new client on next load).

Corruption is permanent; denied-writes/frozen-counts are brief and recoverable. **So we deploy the new client, then the rules (which stop ALL clients from writing counts), then the functions** — the CFs only ever go live *after* no client can double them. The short window between rules-deploy and functions-deploy has frozen counts + no new notifications (recoverable), never corruption.

## THE SEQUENCE (run in order; verify each before the next)

### 0. Pre-flight (no prod change yet)
```
cd "Current Version"
git status                      # confirm only the v1.9.0 set is staged
npm test                        # Playwright floor — must be 93
npm run test:rules              # 49
npm run test:cf                 # 15
npm run test:functions          # 21
```
All four green or **STOP**.

### 1. Checkpoint commit #2 (commit only — NO deploy)
Per the commit discipline (Blake author, zero trailers, restore-stage the 7 Cowork excludes):
```
git add -A
git restore --staged docs/COWORK-STYLE.md docs/AI-PRIMER.md docs/CODE-PROMPTS.md docs/SKILLS/README.md docs/SKILLS/hotfix-skill.md docs/SKILLS/release-skill.md docs/SKILLS/widget-update-skill.md
git diff --cached --name-only       # confirm the 7 are ABSENT
git commit -m @'
v1.9.0 checkpoint (gates 4-6): comments/reviews overhaul + the Lantern + cutover-ready CFs

<body>
'@ --author="Blake Wolters <196413457+joewolters@users.noreply.github.com>"
git log -1 --format="%an %ae"                                   # Blake / the noreply email
git log -1 --format=%B | grep -ciE "co-authored-by|🤖|claude|generated with"   # must print 0
git push
```
A push is NOT a deploy. Nothing is live yet.

### 2. Bump the version (cache-busting) + deploy the NEW CLIENT (hosting)
```
node scripts/bump-version.js 1.9.0 --dry-run     # re-derive the target list; it has been stale before
node scripts/bump-version.js 1.9.0
node scripts/bump-version.js --check             # APP_VERSION == the static fallback (fe0dc4a bug guard)
firebase deploy --only hosting
```
- The `?v=1.9.0` asset URLs force browsers to fetch the new client on next load (cache-bust).
- **State now:** new client available; old (cached) clients still work under the still-old rules (no double — no CFs yet). New clients that reload write only vote docs → their counts are *frozen* until step 4 (votes register, the pill highlights, the number doesn't move yet). This is the only mildly-confusing window — keep steps 3+4 back-to-back.
- **Verify:**
```
curl -s -o /dev/null -w "%{http_code}\n" https://realanimereviews.com/                      # 200
curl -s "https://realanimereviews.com/script.js?v=1.9.0" | grep -c "lanternModel"            # >=1 (new client served)
curl -s -o /dev/null -w "%{http_code}\n" https://realanimereviews.com/scripts/practice-serve.js   # 404 — scripts/ NOT leaked
curl -s -o /dev/null -w "%{http_code}\n" https://realanimereviews.com/firestore.rules        # 404 — rules NOT leaked
curl -s -o /dev/null -w "%{http_code}\n" https://realanimereviews.com/functions/index.js     # 404 — functions NOT leaked
```
The 404s confirm the firebase.json `ignore` array still excludes the new `scripts/` files (the v1.3.9 AUDIT leak class). If any returns 200 → **ROLLBACK hosting** (below) and fix firebase.json before retrying.

### 3. Deploy the RULES + indexes (the flip)
```
firebase deploy --only firestore       # rules + indexes together
```
- **State now:** NO client can write counts (old denied, new never did). `notifications create: if false`. Counts are frozen for everyone + no new notifications mint (the CFs land next). OLD cached clients now error on vote (their count/notif write is denied) until they reload.
- The NEW composite indexes (forum/conversations/suggestionCounts) build async — they're for gates 7+, NOT needed by anything live today, so the build delay blocks nothing.
- **Verify:** open the live site in a fresh private window (gets the new client), open a comment thread — it should LOAD (reads are still public). Don't vote yet (counts won't move until step 4).

### 4. Deploy the FUNCTIONS (CFs go live) — IMMEDIATELY after step 3
```
npm run deploy:functions
```
- **State now:** the CFs own all counts + notifications. New clients fully work: vote → CF increments the count + mints a server-sourced notification → the Lantern lights.
- **Verify the CFs mint in prod (the real proof):** signed in as a test/second account on the live site, **like a comment** → within a few seconds the count increments AND (as the comment's author on another account) the Lantern goes warm with a new notification. Then **unvote** → count returns. If counts/notifs do NOT move → the CFs aren't firing → **ROLLBACK** (below).
- Votes cast in the brief step-3→step-4 window are simply un-counted (the CF didn't exist yet) — a tiny undercount, never a corruption. Backfill only if it matters (it won't at a quiet moment).

### 5. Close-out verify
```
curl -sH "Cache-Control: no-cache" "https://realanimereviews.com/" | grep -o 'APP_VERSION="[0-9.]*"'   # 1.9.0
```
- The Lantern lights/clears, the notification center opens, votes move counts, "Helpful/Not helpful" works, the histogram renders. Update CHANGELOG widget + ROADMAP "running v1.9.0".

## STALE CACHED CLIENT — what they experience + why it's bounded
A user who has the OLD client cached and has NOT reloaded since step 2:
- Reads (comments/reviews/notifications) keep working (read rules unchanged/public).
- **Voting breaks** the moment step 3 lands: the old client's count+notif transaction is denied → "Vote failed" / the vote doesn't register.
- **Bound:** the next time they load any page, the `?v=1.9.0` asset URLs cache-bust → they get the new client, which votes correctly (vote-doc-only) and swallows any transient permission-denied silently. So the broken window per user = "until their next page load." For a small personal site, that's their next visit. No indefinite breakage.

## PREVIEW CHANNEL — what it CAN and CANNOT verify (be explicit)
`firebase hosting:channel:deploy preview-v1-9-0` gives a preview URL of the NEW CLIENT — but **rules + functions are PROJECT-WIDE, not per-channel.** A preview hits the LIVE rules (still old at preview time) + LIVE functions (only `ping`). So:
- **Preview CAN verify:** the new client loads with no JS errors; the Lantern glyph + center render; the community reviews surface (markdown, Helpful pills, histogram, sort/filter) renders; layout/responsive; the composer.
- **Preview CANNOT verify:** the vote→count→notification flow, the `notifications create:if false` flip, or any CF behavior — those need the new rules+functions, which can only be deployed project-wide (the moment of the cutover). **That full flow was verified in the emulator (`npm run practice`, test:rules/test:cf), which is the real dress rehearsal.**
- So **Blake's "ship it" = the project-wide rules+functions change.** A preview is a useful last UI check but cannot rehearse the data flow.

## ROLLBACK (per step)
- **After step 2 (hosting):** `firebase hosting:rollback` (or re-deploy the prior release from the Firebase console's hosting release list). The old client returns; nothing else touched.
- **After step 3 (rules):** re-deploy the PREVIOUS rules. `git stash` or `git checkout <pre-cutover-commit> -- firestore.rules firestore.indexes.json && firebase deploy --only firestore`. This restores the old rules so the OLD (cached) clients can vote again. (Keep a copy of the pre-cutover rules handy before step 3.)
- **After step 4 (functions):** if the CFs misbehave (e.g. counts not minting, or double-firing), `firebase functions:delete onCommentVote onReviewVote onReplyVote onThreadVote onOfficialVote pruneNotificationsOnCreate ...` OR redeploy a fixed build. If you also roll back rules (step-3 rollback), the old client works again as a full restore.
- **Full abort:** roll back hosting (step 2) + rules (step 3) + delete the new functions → production is back to v1.8.4 behavior. The committed code stays in git; re-attempt later.

## The 7 things that must already be true before you start
1. `npm test` 92 / `test:rules` 49 / `test:cf` 15 / `test:functions` 21 all green.
2. JDK 21 visible (for the emulator rehearsal); Blaze billing on (CFs need it) + the budget alert set.
3. `firebase.json` ignore array still excludes `scripts/**`, `functions/**`, `firestore.rules`, `docs/SHIP-*` (verify the step-2 404s).
4. A copy of the CURRENT prod `firestore.rules` saved (for the step-3 rollback).
5. The cutover is at a quiet traffic moment.
6. Blake has said "ship it" in chat.
7. You have the Firebase console open (to watch the functions deploy + index builds + use the rollback UI if needed).
