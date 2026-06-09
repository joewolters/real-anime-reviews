<!-- author: Cowork | date: 2026-06-09 -->
# v1.10.0 — BATCH: gate-4 checkpoint commit → reports "View" → Gate 5 → Gates 6-8 (the working Hub). APPLY all, NO deploy. Smoke ONCE at the end.

> **New cadence (Blake's call, 2026-06-09): batch to smoke MILESTONES, not gates.** Build straight through to a usable Community Hub, self-verifying hard at each step, then hand Blake ONE smoke of the whole Hub. This cuts the report/smoke churn that eats context. Everything stays STAGED — nothing deploys until the cutover (gate 21). Run your adversarial review before the smoke, since Blake isn't smoking mid-batch.

## ⭐ STANDING DIRECTIVE (every element, Blake 2026-06-09)
Every NEW interactive element ships at full brand parity BY DEFAULT — branded buttons (never raw `<button>`), hover states, purple vocabulary, spacing; counters/close/chips/tabs included. No native/unstyled control reaches the smoke. Eyeball everything you add. This is a verification item.

## STEP 0 — land the gate-4 checkpoint commit (smoke PASSED)
Gate-4 smoke passed (consent buttons, Esc fix, counters, reports queue all good). Commit the prepared gates-1→4 checkpoint now (Blake-authored, zero trailers, the 7 Cowork excludes restored out). STAGED — NO deploy.

## STEP 1 — reports "View the content" (Blake's gate-4 ask)
*"I would like an option to visit the comment, post, review that's being reported."* Each report row gets a branded **View** action that opens the reported comment/review/post in context (scroll + halo). For comments/reviews reuse the existing deep-link path; for forum posts it depends on Step 2's router — wire it through once that lands.

## STEP 2 — Gate 5: the forum/DM deep-link router (latent-bug fix)
`parseNotifTarget` already classifies `forum/<tid>` and `conversations/<id>`, but index.html has **no boot handler** for them — those notifications currently click into the void. Add the `#forum=<tid>` / `#conversations=<id>` boot handlers reusing the comment/review scroll-highlight machinery. (DMs land in gate 18; wire the forum half now, stub the DM half cleanly.)

## STEP 3 — Gates 6-8: the Community Hub (the milestone Blake smokes)
Per design study §4a/4b (**"The Lantern Room"** — Blake's pick) + the §4 protect-the-heart specs:
- **G6 — Hub surface:** Community = the 4th nav button; tapping it sets `data-surface='hub'` (the cozy veil step between Den and Discover, ≠ Den's resting value) and opens the thread **list as a left-anchored full-height sheet reusing the secondary-modal drawer stack** (z-6000, `[hidden]` symmetry). **The Den stays mounted + lit behind the dimmed hub veil** (structural non-co-equality). jp-mini kicker, Blake-voiced empty state.
- **G7 — thread list + cards:** the `forum` subscription, **Hot 注目 / New 新着 / Top 殿堂** sort tabs, a tag-filter chip row, quiet **purple, count-free** thread cards (no karma/post-count anywhere — heart spec). A single gold-gated **"From Blake's 44" pinned shelf** at the top of Hot = the ONE gold expression.
- **G8 — thread view + compose:** a single thread opens on the **secondary slide-in sheet** with `RarComposer` docked for replies, vote UI, admin pin/lock/remove→tombstone, and the **anime-cover chip** (an `anime:<slug>`-tagged thread shows **Blake's verdict rail** — his gold rating + pull-quote → deep-links into his review). New-thread composer = a primary modal. Consent-gate + spoiler-aware (spoiler markdown is gate 11 — leave the hook).
- ⚠️ Protect-the-heart Playwright specs (in `?emu=1`): no gold token on any community card/thread; no count node anywhere; hub veil cozier-than-Discover but ≠ Den; Blake's verdict rail carries the only gold.
- Seed the practice sandbox with forum threads (some `anime:<slug>`-tagged, some free, varied votes/ages so Hot/New/Top differ) for the smoke.

## Verify (before the smoke)
All tracks green (npm test 115+ with the new Hub + heart specs; rules/cf hold). **Run your 4-agent adversarial review** across the batch (XSS on user-authored thread/post content, the heart specs, the consent-gate on forum writes, the deep-link router). Walk the whole Hub yourself in `?emu=1`. Then hand Blake the milestone smoke.

## Report (lean): the checkpoint commit hash · each step in plain English (Blake reads this) · the adversarial-review findings+fixes · test counts · Blake's numbered Hub smoke (sign-ins, what to click, what he should see) · confirm production untouched. The next checkpoint commit is gate 10 per the map.
