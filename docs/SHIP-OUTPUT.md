<!-- author: Code | date: 2026-06-09 -->
# v1.10.0 — ROUND 3 account polish + GATE 19: the season room. DONE · STAGED · NO deploy

Mode **ULTRAMAX**. One pushed checkpoint. The **5-lens adversarial review caught 3 HIGH + 4 MED + 4 LOW** — all fixed, all re-proven. **All tracks green. Production untouched. Nothing deploys.**

## Design vision (1 para)
Round 3 makes the account read **finished** — full-bright lantern-lit headings, Blake-voiced lines under every one, a site-wide branded focus ring (zero browser blue anywhere), an Activity list that *takes you to the exact thing with the halo* (covers on review rows), a letter-room Inbox where Blake's letters wear his gold edge, and a saved-toast instead of a bare reload — while **gate 19** opens his banked idea: every season on the secondary modal gets its own room, **directly below his review** (his voice always precedes the room), running the full comments machinery (live composer, spoilers, images, consent, report/mod) on a per-season `al:<id>` key with zero new schema.

## Part A — his items (2–8)
2/3. Headings bright + big + 🏮 (swaying, decorative-only, reduced-motion-silent); unique Blake-voiced subtext per panel.
4. **The focus sweep:** a global floor — every focusable element site-wide gets the purple ring on keyboard focus, nothing on mouse; two components that carry their own glow are exempted (they were double-ringing); real-pixel specs guard it. Honest note: admin pages also load style.css (the floor reaches them; spot-checked benign — worth one keyboard pass when you're in the admin).
5. Activity rows **deep-link with the halo** (comments → the exact bubble; discussions → the review, which now **auto-expands**); review rows carry the **cover thumbnail**; whole row clickable.
6. Inbox reads complete: letter bubbles, your purple right edge, **Blake's gold edge on HIS letters** (identity-keyed — the panel caught it inverted on your own view), premium Message-Blake card.
7. Settings: professional pass (verify state as a pill; the gold-ish amber text went purple).
8. Go-all-out: the **saved toast**, the auto-expand landing, a 16s halo runway for slow loads, per-surface edit sweeps (no more silently eaten drafts on the other modal).

## Part B — Gate 19: THIS SEASON'S ROOM 話せ
- LEFT column, **directly below BLAKE'S REVIEW** — the H5 invariant verified in DOM order (`review → community → synopsis`).
- The full comments treatment via `communityKey()` → `comments/al:<id>/items`: live-in-box composer, consent-gated, spoilers + inline images, report/lock/mod, votes + rate-limits — all the primary modal's machinery, zero new schema.
- **Deep-linkable:** a `comments/al:<id>` notification opens the secondary modal and halos the exact comment (proven live — flash at t≈1.8s).
- **Rooms only where your presence precedes:** gated to WATCHED ids (an arbitrary never-watched AniList page gets no composer — no spam rooms you'd never visit).

## Adversarial findings → fixes
- **HIGH×3:** gate 19's two-concurrent-rooms situation exposed `subscribeComments`' SHARED unsub arrays (either room killed the other's live listeners — now per-instance); a permanent auth-observer leak per composer (now torn down with the surface, and a locked thread stays locked through auth events); the secondary dialog never took/restored keyboard focus (now it does — the gate-19 composer was Tab-unreachable).
- **MED×4 + LOW×4:** the never-watched room gate, the inbox gold inversion, closed-box review landings, the double-ring, draft-eating sweeps, lantern a11y, thumb fallbacks, toast runway.
- **Accepted + noted:** the season room depends on a live AniList fetch (slow networks = late halo; 16s runway; decoupling is the clean follow-up) · a recurring e2e for the al: landing needs an AniList stub (verified by real-pixel walk + an in-page flash log this round) · two pre-existing secondary-modal races (generation token + the 280ms close window) go on the cutover-polish list.

## Tests — ALL GREEN
`npm test` **170** · `test:rules` **126** · `test:functions` **56** · `test:cf` **57** · e2e **10**. (e2e needs practice WARM — first-run connection refusals are the documented boot race; re-run before believing a red.)

## Checkpoint / deploy
One pushed checkpoint. APP_VERSION stays **1.9.1**. **NO deploy.** Remaining: gate 20 (welcome catch-up + cherries + the imageRefs edit-strip sweeper) → gate 21 THE CUTOVER.

## YOUR NUMBERED SMOKE (practice is up + seeded: http://127.0.0.1:8765/?emu=1)
**Sign-ins:** `prac-mika`…`prac-sora` / `practice123`; admin `blake@practice.test` / `practice123`.

1. **The season room (your idea):** open **One Punch Man → More Info → Season 2** (the secondary modal). On the **left, right under BLAKE'S REVIEW**: "THIS SEASON'S ROOM 話せ" with two seeded takes (one behind a spoiler pill). Post one — the live composer, images, everything works here.
2. **Season deep-link:** sign in as **Yuki**, like Mika's season comment… or simpler: paste `#notif=comments/al:21386/items/seed-s0` onto the index URL → the **secondary** opens and the exact comment **halos**.
3. **Headings + lanterns:** Account — every panel head is bright, big, with a gently swaying 🏮.
4. **Focus ring:** Tab around anywhere (account, modals, the Tavern) — every stop shows the **purple ring**, never a blue rectangle. Click with the mouse — no ring at all.
5. **Activity → exact landings:** Account → My Activity — review rows show **cover art**; click a comment row → it lands on the exact bubble **with the halo**; click a "Discussion comment" row → the review opens **already expanded**.
6. **The inbox:** letters look like letters; **my replies carry the gold edge on YOUR screen too** (sign in as a member to see it from their side).
7. **The saved toast:** edit your profile → Save → "Saved — looking sharp ✓" lands before the refresh.

## One-liner reply
Round 3 landed the completeness bar — bright lantern-lit headings with your voice under them, a **site-wide purple focus ring** (zero browser blue, spec-guarded in real pixels), an Activity list that **deep-links to the exact comment with the halo** and shows cover art on reviews, a letter-room Inbox with **your gold edge keyed to your identity** (the panel caught it inverted on your own view), and a saved-toast — and **gate 19 shipped your left-side idea**: every watched season's secondary modal now carries **THIS SEASON'S ROOM directly below your review** (full live composer/spoilers/images/consent/mod, per-season `al:<id>` key, zero new schema, deep-linkable with the halo — proven live), with the adversarial panel catching **3 HIGH** (the two-concurrent-rooms listener cross-kill, a per-composer auth-observer leak, and the secondary dialog never taking keyboard focus) + 4 MED + 4 LOW, all fixed and re-proven at `npm test` **170** · rules **126** · functions **56** · cf **57** · e2e **10** green; **practice is up + seeded, the checkpoint is pushed, APP_VERSION stays 1.9.1, and nothing deploys — gate 20 and the cutover are what's left.**
