<!-- author: Cowork | date: 2026-06-06 -->
# v1.9.0 — GATE 3: cascade + rate-limit + suggestionCounts, then the FIRST CHECKPOINT COMMIT (APPLY — emulator finish line, NO deploy)

> Gate 2 closed green (18/18 units · 5/5 CF integration · 35/35 rules; CFs emulator-only until the gate-6 atomic cutover — your call, approved). Build gate 3 against `docs/DATA-MODEL.md`, then commit the P0→3 checkpoint.

## 1 — Cascade deletes
1. **`reviews/items` cascade** — on review delete, remove its `threads` + all `votes` (this orphan exists in production TODAY; the CF closes it at cutover).
2. **`forum/{tid}` cascade** — thread removal cleans its `posts` (+ their votes if any).
3. **`onUserDelete` — DAY-1 per Blake's locked answer.** Account deletion wipes: all authored content (comments/reviews/posts/threads), the user's **foreign `votes/{uid}` docs** (the collection-group sweep from your study, M6/L5), their notifications/saves/profile, and **tombstones every `conversations` they're in**. This is the function that makes the privacy page's deletion promise true — be thorough.

## 2 — Rate limiting
Implement per your own gate-0 §5 plan — **detect-and-undo `onCreate` trigger first** (doesn't change the client write path), the callable pre-block stays the documented escalation if abuse appears. If you've since changed your mind on that ordering, say so in the report with reasoning — your call, named explicitly.

## 3 — `aggregateSuggestionCounts`
On each `suggestions` create: increment the count-only `suggestionCounts/{anilistId}` doc (+ snapshot title/cover/format/year per the contract). Idempotent like gate 2 (`cfProcessed` marker).

## 4 — Verify (emulator)
No orphans after each cascade · `onUserDelete` leaves ZERO trace of the user (assert the foreign-votes sweep + convo tombstones specifically) · flood gets detected-and-undone · rollup count exact under concurrent suggestions · all three existing tracks still green. Report all counts.

## 5 — FIRST CHECKPOINT COMMIT (after everything above is green)
One Blake-authored commit of the P0→3 working tree (`Blake Wolters <196413457+joewolters@users.noreply.github.com>`, **zero trailers**), your established excludes pattern for the Cowork-managed rolling docs, push to origin. **NO deploy of any kind** — this is a git save-point only; production stays byte-for-byte unchanged. Confirm `npm test` (the 84 floor) still passes pre-commit per project rule #7 — server-only changes shouldn't move it, but prove it.

## Report back (SHIP-OUTPUT.md)
Plain-English function descriptions (Blake reads this) · test counts all tracks · the rate-limit ordering call · commit hash + what's in it + push confirmation · production-untouched confirmation · working-tree state for gate 4 (comments overhaul — the first VISITOR-FACING gate; flag anything it should know).

House rules apply. Stop after the checkpoint commit.
