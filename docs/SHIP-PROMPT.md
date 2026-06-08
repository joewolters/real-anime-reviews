<!-- author: Cowork | date: 2026-06-08 -->
# v1.9.0 — THE CUTOVER (PRODUCTION DEPLOY) — Blake's go-signal GIVEN

> **Blake's go-signal, verbatim, in chat 2026-06-08:** *"push it anyway. log for a quick fix in the following update."* (Said after his 6g re-smoke: comment-reply + comment-like deep-links pass from both pages; the review-like deep-link still misses — LOGGED in NEXT.md as the first post-cutover quick fix, shipping with this known cosmetic bug at Blake's explicit call.)
>
> This is the irreversible step. Execute `docs/CUTOVER-RUNBOOK.md` exactly. Blake doesn't open a terminal — you run every command.

## Run the runbook, in its locked order
1. **Checkpoint commit #2** — the entire v1.9.0 working tree (gates 4→6g + the same-day consistency-audit fixes incl. the `firebase.json docs/**` leak fix), authored **Blake Wolters <196413457+joewolters@users.noreply.github.com>**, **zero trailers**, the Cowork-managed excludes restore-staged out. Push.
2. **Pre-deploy gates:** `npm test` (97 floor) green; re-run `test:rules` / `test:functions` / `test:cf` (49/21/15) green on a clean emulator boot; `bump-version` to 1.9.0 across all targets + `--check`. Do NOT proceed if any floor fails.
3. **Deploy in the runbook's order — `hosting → firestore (rules+indexes) → functions`** — the order that makes double-count corruption impossible. Verify each step before the next (the runbook's curl checks + the `docs/`/`scripts/`/`functions/`/`firestore.rules` 404 leak checks + a real prod vote→count→notification test).
4. **Per-step rollback armed** — if any step fails its verify, STOP and roll back that step per the runbook; report rather than push through.

## Verify live (report these back as a table)
`window.APP_VERSION === "1.9.0"` · homepage + account + a modal's comments/reviews 200 · the Lantern renders + a real notification flows · vote→count is CF-owned (no client double-write) · `realanimereviews.com/docs/NEXT.md` now **404** (leak scrubbed) · `/scripts/practice-serve.js` 404 · every staged rule live (a hostile write denied in prod). 

## Report (SHIP-OUTPUT.md): commit hash · bump confirmation · per-step deploy+verify table · the live-verification table · anything that needed a rollback · confirm the review-deep-link known-bug is the only carried item. Then Cowork closes the ship + updates HANDOFF.

⚠️ If ANY pre-deploy floor fails or a deploy step won't verify, do NOT force it — stop and report; Blake's "push it" covers a clean runbook execution, not pushing through a red gate.
