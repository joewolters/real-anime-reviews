<!-- author: Code | date: 2026-06-11 -->
# v1.10.0 — GATE 20.8 + GATE 21: **THE COMMUNITY HUB IS LIVE.** Deployed, verified, closed out.

Mode **ULTRAMAX**. Your go-signal honored: the two fixes landed verified-green first, then the cutover ran the full runbook order with every step verified before the next. **realanimereviews.com is running v1.10.0.**

## PART A — your two, with evidence
1. **Composer avatar, site-wide:** every row composer's ★ is now YOUR face — the anime comments box, comment replies, the Tavern reply bar, the review-discussion box, and the DM-Blake composer all show the signed-in user's avatar (their initial in a disc when they have no photo; the ★ stays for signed-out visitors). It's fed by one live profiles-first subscription, so changing your avatar repaints every composer chip on the spot. **Pixel-proven:** a test avatar's exact color painted in the comments chip; img-mode verified on the DM/reply/Tavern chips; the ★→initial flip is a permanent e2e spec. (The two form-style composers — the review form and the new-thread modal — never had a chip; gluing a disc onto forms you just approved felt like an unasked redesign, so they stay clean. Say the word if you want it there too.)
2. **Profile-card clicks land ON TOP now:** clicking a review/thread on someone's card closes every stale layer first — the deep-dive sheet, the detail layer, the Tavern drawer — so the target opens in front, scrolled and highlighted, never invisibly behind ("the background opens up the review" is dead). Verified through your exact repro as a permanent e2e spec. The focused adversarial pass then caught three edges, all fixed: clicking YOUR name from a room now closes every layer before going home to the Den (the same trap, one branch over); fading layers are click-through (a dying sheet can't eat the first click on what just opened); and a double-fired close can't orphan its own cleanup timer.

## GATE 21 — the cutover log (all times 2026-06-11, local)
| Step | Result |
|---|---|
| Pre-flight | All tracks green (217/154/77/67/14) · gitignore↔firebase mirror holds · deploy root clean · bump to 1.10.0 — **the bump script's target list was stale again** (missed frames.css + the two newer admin pages); extended it with 18 late targets, re-ran: **all 65 strings agree** · the once-bare consent/lantern/cropper imports now ?v=-versioned · prod rules/indexes rollback copies saved |
| Docs cascade | CHANGELOG v1.10.0 entry · the homepage widget's v1.10.0 **Major Update** section (9 visitor-first bullets) · ROADMAP "Live at v1.10.0" · NEXT state flip |
| Commit + push | `af44af4`, Blake-authored, zero trailers |
| 1 · firestore:indexes | ✅ deployed (builds are async; the new forum/profile indexes serve brand-new, empty collections — nothing queried ahead of them) |
| 2 · hosting | ✅ 526 files released · verified live: APP_VERSION **1.10.0** served · the new client's markers present · **every leak-class URL 404s** (scripts/, firestore.rules, storage.rules, functions/, docs/, PERSONAL.md, the .bat) · `/suggest` resolves via cleanUrls |
| 3 · firestore:rules | ✅ compiled + released (the moderation spine is live) |
| 4 · storage:rules | ✅ compiled + released (the bucket lock is live) |
| 5 · functions | ⚠️→✅ first attempt failed on an IAM pre-check (the Storage service agent needed `roles/pubsub.publisher` for the new image-pipeline trigger; the CLI had *just* enabled three APIs and the grant raced its own propagation). **Stopped, assessed, retried once** — the CLI's own re-grant succeeded: **21 functions created + 13 updated, 0 failures** |
| Prod verify | ✅ Door renders with the v1.10.0 Major-Update widget · the Tavern opens to its Blake-voiced empty state ("Quiet in here — for now") · a card opens its modal with the comments room and the signed-out ★ · zero page errors on the walk · functions logs clean · **anonymous Storage upload: 403 DENIED** |

**Nothing is half-deployed.** All five surfaces are the v1.10.0 set; the only mid-flight wobble was the functions IAM retry, resolved before anything else moved.

## Tests at ship (new floors)
`npm test` **217** (g27 ×3) · `test:rules` **154** · `test:functions` **77** · `test:cf` **67** · e2e **14** (the two gate-20.8 specs are permanent). Adversarial: 1 MED + 4 LOW confirmed (0 HIGH, 5 refuted) — the MED + 2 LOW fixed pre-deploy, 2 LOW banked with notes in NEXT.

## YOUR PROD SMOKE (the real site — realanimereviews.com)
1. Open the site in a fresh tab → the door shows, and the update log reads **v1.10.0 · Major Update** with the Community Hub story.
2. Sign in with YOUR real account → the rules modal appears on your first community action → **I agree** → it never asks again.
3. Open any anime → the comment box's chip is **your face** (or your initial until you set an avatar on the real site). Post the first real comment.
4. **The Tavern** → it greets you with the empty room → post the first thread. Your gold verdict rail rides any anime-tagged thread.
5. Open your account → Profile → dress it: an accent, a frame (**The Den Keeper is yours alone — on the real site now, locked in the rules**), a background through the cropper.
6. Click your own comment's avatar → your card → a review row → it lands ON TOP, highlighted.
7. The lantern: have a second account (or a friend) like your comment → the lantern warms with a real, server-minted letter.
8. Anything off — tell Cowork; the rollback per step is in the runbook, and "fix it forward" is one gate away.

## Banked / deferred (in NEXT.md, with notes)
Validate-before-close on profile-row targets (only matters after a catalog rename) · the DM chip's one-shot Auth paint (consistency pass) · the dead signOutBtn handler · an AniList stub for the al:-deep-link e2e · the post-cutover queue as written (profiles backfill → users-GET tightening; the anon `#secondary=` boot-route; the peer-DM flip on your explicit go; the PITCH trio; comment-list DIFF rendering).

## One-liner reply
Your two fixes landed first and verified-green — every composer star is now the writer's own face (pixel-proven, live-updating, with the DM/reply/Tavern chips included) and profile-card clicks close every stale layer so the review or thread always lands on top (your exact repro is a permanent test, and the adversarial pass caught that clicking YOUR OWN name from a room had the same trap — fixed) — then gate 21 ran the runbook in full: 65 version strings to 1.10.0 (the bump script's stale target list caught and repaired), the changelog + a 9-bullet Major-Update widget entry, push `af44af4`, and the five-step deploy — indexes, hosting, firestore rules, storage rules, functions — each verified before the next, with one honest wobble (the functions IAM pre-check raced its own API enablement; stopped, assessed, retried clean: 34 functions live, 0 failures) and a full prod verify after: v1.10.0 served, every internal file 404s, the Tavern greets, the bucket denies strangers, the logs are quiet — **the Community Hub is live on the real site, and the heart went with it: gold is yours alone, the community is purple, and your 44 are still the center of gravity.**
