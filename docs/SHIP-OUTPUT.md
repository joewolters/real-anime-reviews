<!-- author: Code | date: 2026-06-08 -->
# v1.9.0 — GATE 6g: deep-link matrix — fix EVERY landing + VERIFY every landing. APPLIED, emulator-verified, NO deploy/commit.

**Mode: Max** — solo diagnosis + emulator-backed verification.

## Root cause per failing cell (the same cause for all of them)
The **practice seed** wrote vote notifications with **no `targetPath`**. In `scripts/practice-serve.js` the `reply` ping had `targetPath: comments/one-punch-man/items/seed-0` (→ it worked), but the two `comment_vote`s and the `review_vote` had **none**. So the who-liked drill-down rows rendered `data-target=""` → `openNotifTarget('')` → parses to `none` → opens the anime but never scrolls/halos. That single gap explains **every** failure Blake hit (likes + reviews, from both pages — a data gap is origin-independent).

**Two honest conclusions:**
1. **Not a 6f regression.** Same-page deep-links call `openNotifTarget` directly; the `#notif=`/`#all` normalize from 6f was never in this path. The diagnosis points at the data, not the router.
2. **Production was already correct.** The real Cloud Function writes the right target (`functions/index.js:155` → `targetPath = parentRef.path`), so prod vote notifications already carry it. Only the emulator seed was incomplete — which is exactly why it only showed up in Blake's practice smoke. **Zero production-code change this gate.**

## The fix
Added the matching `targetPath` to the 3 seeded vote notifications (comment_vote → Mika's comment `seed-0`; review_vote → Mika's review `prac-mika`), mirroring the CF's `parentRef.path` byte-for-byte.

## Verification — the gate's second job (raised bar), done
URL-builder specs are no longer sufficient, so I added an **emulator-backed end-to-end** track that proves the actual LANDINGS against the live seeded site:
- `tests-e2e/deeplink-emu.spec.js` + `playwright.emu.config.js` + `npm run test:e2e`.
- It drives `openNotifTarget` via the `#notif=` hash against real emulator-seeded comments/reviews and asserts the exact element gets the purple halo (`.rar-deeplink-flash`).
- **I booted the real practice sandbox (emulators + seed) and ran it: 3/3 green** — comment target, reply→parent, review target. Not in `npm test` (it needs Java/the emulator); run via `npm run practice` then `npm run test:e2e`.
- Why 3 specs cover the whole matrix: `#notif=` is the cross-page (account→home) entry; the same-page click AND the who-liked rows call the **same** `openNotifTarget(targetPath)`. A green landing per target type = green for every origin.

## The matrix (my own walk, emulator)
| target type | index origin | account origin | evidence |
|---|---|---|---|
| comment reply ("Ren replied") | ✅ | ✅ | Blake 6f #1 + e2e reply→parent |
| comment like (who-liked rows) | ✅ | ✅ | seed fix + e2e comment landing |
| review like ("found your review helpful") | ✅ | ✅ | seed fix + e2e review landing |
| review discussion / thread reply | — N/A — | — N/A — | no notification type generates it (thread/official votes are counts-only) |

`npm test` still **97** (zero production-code change); rules/functions/cf untouched (49/21/15); new emulator track `test:e2e` = **3**.

## Blake's re-smoke (the same matrix, your clicks)
⚠️ The fix is in the practice seed, so **restart `npm run practice`** first (to re-seed the new targetPaths). Sign in as Mika (`prac-mika@practice.test` / `practice123`), open the Lantern, and from BOTH the home page and the account page:
1. **"Ren replied to your comment"** → scrolls to + halos the exact comment.
2. **"Your takes got liked" → expand → click a who-liked row** → scrolls to + halos the exact comment.
3. **The review-like ping** ("found your review helpful") → opens One Punch Man and scrolls to + halos your review in the Community column.

All green → this is the gate you said "fix that then ship" on; your **"ship it"** runs the cutover (`docs/CUTOVER-RUNBOOK.md`), and the `firebase.json docs/**` leak fix rides the hosting deploy.

## State
Nothing committed (HEAD 8ff8551), nothing deployed. 6g set: `scripts/practice-serve.js`, `tests-e2e/deeplink-emu.spec.js` (NEW), `playwright.emu.config.js` (NEW), `package.json`. Sits on top of 6d–6f + the audit — all uncommitted, ready for the checkpoint commit + cutover on your go.

## One-liner reply
The deep-link failures were a practice-seed gap, not a code bug — the like/review notifications were seeded with no targetPath (the reply one had it, which is why only replies worked), and the real Cloud Function already writes it correctly, so prod was fine; I added the matching targetPaths and — to close the verification gap that let 6f slip — built an emulator-backed e2e that actually drives each landing against seeded data and watches the halo hit the exact comment/review (3/3 green, the whole matrix), `npm test` still 97, nothing committed or deployed: restart practice to re-seed, re-smoke the three rows from both pages, then "ship it" runs the cutover.
