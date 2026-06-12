<!-- author: Cowork | date: 2026-06-11 -->
# v1.10.0 — GATE 20.8 (two final fixes) → GATE 21: THE CUTOVER. This one deploys.

> **THE GO-SIGNAL IS GIVEN.** Blake, 2026-06-11, after his 20.7 smoke passed ("Finally it works and it looks great… It all looks amaizng. Thats the community overhaul I was looking for."): **"Let it fix those two bugs, I won't smoke them again, and let it push to the main site."** → The cutover is authorized, CONDITIONAL on the two Part-A fixes landing verified-green. If ANYTHING in Part A or the pre-flight surprises you — STOP before deploying and report instead. **Mode ULTRAMAX.**

## PART A — the two fixes (Blake's words; he will NOT re-smoke — verify like his eyes)

1. **Composer avatar, site-wide:** *"The star to the left of 'leave a comment' should be the users profile picture. Again, this needs to be applied across the entire website."* → every composer the signed-in user sees (room comments, review composer, Tavern new-thread + replies, DM Blake, anywhere the ★ chip renders) shows THEIR avatar instead of the star (fallback: their initial disc, matching the site's avatar fallback; signed-out keeps the current treatment). Live-updates when the avatar changes (profiles onSnapshot pattern). Walk it on every composer surface.
2. **Profile card → content behind the secondary modal:** *"When opening up someones profile, and then clikcing one of their reviews/threads i did it from the secondary modal of an anime card. The secondary modal doesn't close, the background opens up the review. So it should auto close/open to the users review/thread."* → when a profile-card item (review/thread/etc.) is clicked while the secondary (or any higher layer) is open, the stale layers must close/route so the target content lands ON TOP, scrolled + haloed — not opening invisibly behind. Audit every profile-card entry point (Tavern, rooms, comments, the catch-up sheet) for the same layering trap. Scroll-locks must unwind cleanly (the 20.7 lock lesson).

Both: ALL tracks green + new specs where pinnable + a focused adversarial look (the layering fix is a navigation/race surface; the avatar chip is a render-sink — keep it scheme-gated/escape-first).

## GATE 21 — THE CUTOVER (only after Part A is verified green)
Follow **`docs/CUTOVER-RUNBOOK.md`** + the design-study §6 close-out. The floor, in order:
1. **Pre-flight:** full test floor green (`npm test` + rules + functions + cf + e2e) · `.gitignore`↔`firebase.json` mirror check (now incl. Storage, `*.bat`, `*.ico`, `tmp*`) · no tmp/diagnostic files in the deploy root · bump to **APP_VERSION 1.10.0** via `node scripts/bump-version.js 1.10.0` + `--check`.
2. **Docs cascade BEFORE the deploy commits:** CHANGELOG.md (author marker) · the homepage widget `version-section` bullets per `widget-update-skill.md` (visitor-first; the new tier labels — this ships as a **Major Update**; do NOT skip the widget like v1.9.0 nearly did) · ROADMAP.md · NEXT.md state flip · the `docs/**` 404 scrub · the consent.js / lantern.js / cropper.js `?v=` cache-bust item.
3. **Commit + push** — Blake-authored (`Blake Wolters <196413457+joewolters@users.noreply.github.com>`), ZERO co-author trailers.
4. **DEPLOY, in this order, verify each step before the next:** `firestore:indexes` → `hosting` → `firestore:rules` → `storage` → `functions`. Low-traffic window. If any step fails: stop, assess, report — do not push past a failed step.
5. **Prod verify:** curl `APP_VERSION` = **1.10.0** · walk the critical prod path live (door → consent → a real comment → the Tavern renders → a profile card → the Lantern) · functions healthy (no error spikes) · Storage rules live (anon upload denied).
6. **Close-out:** refresh SHIP-OUTPUT with the full cutover report · update CODE-HANDOFF · list Blake's PROD verify steps (plain language, numbered — which page, what to click, what he should see on the REAL site).

## Report
Part A both fixes (evidence) · the pre-flight results · per-step deploy log (timestamps) · prod-verify results · the close-out confirmations · test counts · **Blake's numbered PROD smoke** · anything banked/deferred. If you stopped instead of deploying: exactly why, state of the world, nothing half-deployed across the rules/storage/functions boundary without saying so in the first line.
