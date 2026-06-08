<!-- author: Code | date: 2026-06-08 -->
# v1.9.1c — review deep-link HALO: real bug found + fixed, e2e upgraded to assert VISIBILITY. BUILT + VERIFIED (awaiting re-smoke → hosting-only deploy on "ship it")

This is the test-integrity round. I was wrong twice on this halo — once trusting a class-presence e2e, once over-attributing to environment. This time I inspected the actual rendered pixels (screenshots + the box-shadow animation curve), found the real root cause, fixed the visible glow, and rebuilt the e2e to assert it actually paints. Still client-side only; nothing committed/deployed.

## Root cause — TWO bugs, both real, both confirmed in a real browser
1. **The halo was clipped to nothing.** The flash class sat on `.row-toggle`, a child of `.review-row` — and `.review-row { overflow:hidden }` (for its rounded corners + title line-clamp). A `box-shadow` glow renders *outside* the element's box, so the parent's `overflow:hidden` clipped it away entirely. Diagnostic dump: the `.row-toggle` had a live animated box-shadow, but its immediate ancestor `.review-row` is an `overflow:hidden` clipper, and `.review-row` itself had `box-shadow: none`. Comments never hit this — `.bubble` has no clipping ancestor.
2. **My own sticky re-apply was resetting the animation.** `applyReviewDeepLink` did `remove → reflow → add` on *every* render, so during the initial snapshot/auth churn it kept restarting the 2.4s glow back to 0% (transparent) before it ever reached its visible peak — so even after fixing the clip, the glow looked absent.

## The fix
- **Halo the whole `.review-row`,** not its `.row-toggle` child. An element's own outset box-shadow is NOT clipped by its own `overflow:hidden` (that only clips descendants), so on the row the glow renders as a visible purple card-glow — matching how the comment halo lands on the `.bubble`.
- **Add the class only if missing** (drop the reflow-restart). A freshly rebuilt row plays the glow from its start; a persisting row keeps glowing uninterrupted — no more resets.
- Both origins (index + account) go through the same `openNotifTarget → applyReviewDeepLink`, so both are fixed.

**Real-browser proof:** sampled the row's computed box-shadow continuously from load — it ramps cleanly to the designed peak (**alpha 0.55** = the 15% keyframe) at ~1.3s and fades by ~3.1s, ONE clean play. Screenshot at peak shows the target row visibly ringed in purple while the others aren't.

## The e2e: from class-presence → VISIBILITY (so this can't recur)
The old spec asserted `.row-toggle.rar-deeplink-flash` (class on an element) — which is exactly why it stayed green while the browser showed nothing. The rewrite asserts the **visible result**:
- the halo class is on the **`.review-row`** itself (a clipped child would fail), in viewport, visible;
- **poll the row's actual computed box-shadow alpha** until it exceeds 0.25 (peaks ~0.55) — so the glow must really paint;
- still flashed + in view after a 1.5s settle (survives the re-render).
- **A/B (re-run): reverted the fix (flash back on the clipped child) → the upgraded e2e went RED** (the `.review-row` received no halo class / no painted box-shadow); restored → green.
- Honest limitation: the box-shadow poll proves the glow *paints on the visible row*; it doesn't pixel-verify against a future NEW clipping ancestor. It does catch this bug class (and the diag screenshots back it visually). A pixel sampler would be stronger but flaky.

## Tests
- `npm test` (deterministic) — **104**.
- `npm run test:e2e` (emulator) — **3** green, incl. the rewritten visibility-asserting review spec; **A/B-proven red on the broken landing**.
- `test:rules` 49 · `test:functions` 21 · `test:cf` 15 — untouched.

## What ships in v1.9.1 overall (this + the earlier rounds)
Composer redesign (`composer-toolbar.js` → `RarComposer`: B/I/🔗 + ⌘/Ctrl+B/I + live preview, XSS-safe) · v1.9.1b polish (declutter, hint only on reviews, signed-out hide, "★ My review" chip) · self-rolling season label (Spring 2026 · 春) · **review deep-link halo now genuinely visible**.

## Files changed this round (client-side only)
- `script.js` — `applyReviewDeepLink`: halo `.review-row` + add-if-missing (no reflow-restart).
- `tests-e2e/deeplink-emu.spec.js` — review spec rewritten to assert painted box-shadow visibility.

## Blake's 1-step re-smoke — sandbox is running: `http://127.0.0.1:8765/?emu=1`
Sign in (`prac-mika@practice.test` / `practice123`), open the Lantern → "found your review helpful" → the review opens and **its card visibly pulses purple** and holds through the list settling. Do it from **both** the home page and the account page. (Comment + reply halos still flash as before.)

## Deploy (ONLY on your "ship it")
Hosting-only: `npm test` green → `bump-version` 1.9.1 → `CHANGELOG.md` + homepage widget `version-section` bullets (per `widget-update-skill.md`) → `firebase deploy --only hosting` → verify (APP_VERSION 1.9.1, widget newest = v1.9.1). Commit Blake-authored, zero trailers, the 7 Cowork excludes restored out.

## One-liner reply
The review deep-link halo is now genuinely visible — I was wrong twice (a class-presence e2e, then over-blaming environment), so this round I looked at the actual pixels and found two real bugs: the flash sat on `.row-toggle` whose glow was clipped to nothing by `.review-row { overflow:hidden }`, AND my sticky re-apply was restarting the animation back to transparent every render; fixed by haloing the whole `.review-row` (its own outset shadow escapes its own overflow) and only adding the class if missing, confirmed by the box-shadow ramping to its real peak (0.55) in a screenshot, and the e2e is rebuilt to poll the row's actual painted box-shadow (A/B-proven red on the clipped version) so "green test, invisible result" can't recur — `npm test` 104, e2e 3, nothing committed, sandbox up for your 1-step re-smoke from both pages.
