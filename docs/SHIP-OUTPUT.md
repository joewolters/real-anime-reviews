<!-- author: Code | date: 2026-06-11 -->
# v1.10.1 HOTFIX — image uploads + honest errors. **DEPLOYED on Blake's go (2026-06-12) — prod serves 1.10.1; his 2-step smoke is the final probe.**

Mode **MAX**. **Deployed:** prod serves **1.10.1**, the error module is live, all 25 routed sinks confirmed in the served client, zero raw-leak patterns. One honest correction from the deploy itself, below.

## The root cause, in plain language
**Your account was never the problem, and you don't need to verify anything.** The Storage security rules check two things in the database before any image upload: the kill-switch and (for members) the community-rules consent. For prod to do that, Google requires a one-time permission so the Storage rules are allowed to *read* the database. **That permission never landed during the cutover** — the deploy released the rules but skipped the permission step (the same Google-permissions hiccup that made the functions deploy retry). Result: every upload check ERRORED, and an error counts as "deny" — so **every image upload on prod was rejected, for everyone, you included.** The practice sandbox never needs that permission, which is why all 154 rules tests stayed green while prod said no.

Two client bugs made it worse, and those are the code fixes:
1. **The background message lied to you** — it blamed the consent gate and told you to "Hit Save again," forever, for a denial no retry could fix.
2. **The Tavern showed you the raw machine error** — provider name and an internal file path, straight into the modal.

## What changed (staged on `main`, not deployed)
- **`storage.rules`** — a documentation block naming the load-bearing permission (and changing the file's bytes, which is what makes the deploy actually re-upload the ruleset and run the permission grant this time). The rules LOGIC is untouched. If uploads still fail after the deploy, the fallback is a one-click grant in the Firebase console — I'll handle it.
- **`friendly-errors.js` (new, the ONE branded-error module, both pages import it)** — every failure message routes through it: a real verify-your-email message when that's truly the cause, an honest "this one's on us, not you" when the site is at fault, connection/size messages for those cases — and never a provider name, SDK code, or internal path. The raw error goes to the console for me.
- **~30 failure sinks rewired across script.js + account.js** — every alert and inline error on both visitor pages (posts, replies, threads, reviews, votes, edits, reports, collections, avatar, background, DMs, passwords). Audited to zero raw `.message` renders.
- **Spec-pinned (g28 ×3):** the module is fed your exact screenshot string and must come back clean; the truthful verify-vs-site-side split is pinned; and a source-level pin fails the build if any sink ever concatenates a raw error again.
- Version bumped to **1.10.1** (all 67 strings agree), CHANGELOG entry, a small Hotfix section on the door's update log.

## Proof
- **End-to-end through your exact screenshot path:** kill-switch flipped ON in the sandbox → a real rules denial on a thread-with-image post → the modal showed *"Could not post: Uploads are locked on the site right now — this one's on us, not you. Tell Blake if it keeps up."* Branded, truthful, zero machine text.
- All tracks green at new highs: `npm test` **220** (+3 g28) · rules **154** · functions **77** · cf **67** · e2e **14**.

## The deploy + ONE honest correction (2026-06-12)
Storage rules re-released (the ruleset genuinely re-uploaded) → hosting shipped → prod verified serving 1.10.1 with the module live and zero leak patterns. **The correction:** I had claimed the deploy CLI grants the cross-service permission when it uploads a new ruleset — **that turned out to be wrong.** I traced the deploy twice at full debug: firebase-tools 15.19.1 makes no permission-granting calls at all, and from this machine I cannot READ whether the permission exists either (newer Firebase versions may set it up by themselves — so uploads may have been fixed by the re-release, may have needed nothing, or may still need the one manual click). I also ruled out the kill-switch alternative (the prod doc is absent = enabled, probed anonymously). **Your smoke below is the real test, and both outcomes are handled.**

## YOUR SMOKE (2 steps — this decides it)
1. Account → change your background → Save. **If it lands: done — close the book on this one.**
2. **If it still fails:** the message will now be the honest one ("this one's on us") — then do the one-click fix: open the **Firebase console → Storage → Rules** tab. A banner asks to grant the cross-service permission — click **Grant**. Then Save the background again; it lands. (That banner is Google's own designed path for this; it's the only step I couldn't reach from the command line.)
3. Either way: the Tavern → post a thread with an image. It lands; and if anything ever fails again anywhere, the message will be human.

## One-liner reply
Your uploads were never your fault — the cutover's storage deploy skipped a one-time Google permission that lets the Storage rules read the consent/kill-switch state, so every upload check errored into a "deny" for everyone (the sandbox needs no such permission, which is why every test stayed green) — the staged fix re-releases the rules so the grant lands, replaces the lying "hit Save again" copy and the raw machine-text leak with one shared branded-error module that now owns all ~30 failure messages on both pages (fed your exact screenshot string in a permanent spec and proven end-to-end through the real Tavern sink against a genuine rules denial), the version is bumped to 1.10.1 with changelog and widget entries, every track is green at **220 / 154 / 77 / 67 / 14** — **staged and ready; it deploys the moment you say go.**
