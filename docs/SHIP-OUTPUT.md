<!-- author: Code | date: 2026-06-09 -->
# v1.10.0 — ACCOUNT/PROFILE OVERHAUL ROUND 2: a real social platform. DONE · STAGED · NO deploy

Mode **ULTRAMAX**. One pushed checkpoint. The **5-lens adversarial review caught 2 HIGH + 4 MED + 4 LOW** — all fixed, all re-proven. **All tracks green. Production untouched. Nothing deploys.**

## Design vision (1 para)
The account becomes a **real settings platform**: a grouped Discord-style rail (Identity · Collections · Community · Settings) where every section owns a **full-width panel**; the profile editor goes wide under a **social-grade hero preview** (your background full-bleed, avatar overlapping, name/status/tags composed like a real platform header); an **Edit ↔ 👁 Public view** toggle shows the saved identity exactly as the room sees it; and the community-rules consent happens **in place** — a 🔓 banner + the branded modal, no more "go comment somewhere to accept the terms." Every label is a pill, every animation is compositor-only, and the heart law holds: gold is Blake's, Appreciate stays the one purple count.

## Blake's items, one by one
1. **Widen + enlarge** — 1340px canvas, full-column panels, a 2-col editor grid of branded field cards, the ~240px hero preview with a breathing ring.
2. **See what viewers see** — the 👁 toggle renders the SAVED profile with the live sheet's exact pieces (markdown bio, accent, tags, bg, featured pin, the Appreciate row), honest about the deltas ("activity loads on the live page · viewers can also report a profile"), and honest in the edge states: a suspended account previews the tombstone viewers actually get; Blake previews "your name leads home to the Den."
3. **Each section its own surface** — six dedicated panels behind the grouped rail; Watchlist/Favorites add a **list ↔ cover-grid** view toggle on top of the filter/sort/type controls.
4. **Settings split out** — Email / Password / Session set-cards under their own "Account" nav item (member-since flair + sign-out).
5. **More + unique tags via a dropdown** — a branded grouped catalog (Genres · Watch style · Identity, ~40 anime-flavored entries: Sakuga nerd, Lore historian, Waifu connoisseur, Gacha survivor, Night-shift watcher…), tick-marked when worn, multi-pick; custom tags still typed in; the 6-cap and tints intact.
6. **The consent dead-end — FIXED (the real bug):** consent now lives in ONE shared module (`consent.js`, imported by both pages — the round-1 "fix landed in only one copy" lesson applied). The account shows the 🔓 unlock banner, the branded modal opens right there, "I agree" mints consent through the `acceptRules` CF (never self-attested). Proven end-to-end in the emulator: fresh user → banner → modal → accept → unlocked → a full customization save persists.
7. **Unique animations** — panel slide-ins, the hero breathe ring, tag-chip pops, the dropdown drop, the floating 🔓, the Appreciate heart-beat, the rail's accent bar — all transform/opacity-only, all silent under reduced-motion.

## The new information architecture
**Identity** → Profile (hero + editor + public view) · **Collections** → Watchlist, Favorites (filter/sort/type + list/grid) · **Community** → My Activity (typed chips), Inbox (Message Blake) · **Settings** → Account (email/password/session).

## Adversarial findings → fixes (all in this checkpoint)
- **HIGH:** `addDoc` was used by the gate-18 inbox but never imported — **every "Message Blake"/Send has thrown since the mega-batch**; no spec drove the flow. Fixed + a new e2e performs a REAL send.
- **HIGH:** the round-1 520px tab clamp caged the new panels — the editor spilled ~670px past the card. Unlocked + a computed-style spec.
- **MED×4:** mid-session bans now re-checked on every gated action (no stale "ok" cache); suspended users get suspended copy (not "accept the rules"); viewer mode honors `isBanned` + special-cases Blake; the preview bio renders the same markdown as the live page.
- **LOW×4:** the rail's unread dot ignored `[hidden]` (painted forever — same trap class the walk caught on the banner); viewer name no longer falls back to auth PII; the Appreciate row always previews (coerced 0); honest partial-save copy + the gold-adjacent verify text went purple.

## Tests — ALL GREEN
`npm test` **166** · `test:rules` **126** · `test:functions` **56** · `test:cf` **57** · e2e **10** (incl. the real Message-Blake send). Real-pixel walk re-shot every panel; the spill measured fixed (offset == scroll).

## Checkpoint / deploy
One pushed checkpoint. APP_VERSION stays **1.9.1** (staged). **NO deploy.** Cutover note: `consent.js` is a new hosted file (verified not firebase-ignored); it joins lantern.js in the post-cutover ?v= version-busting item.

## YOUR NUMBERED SMOKE (practice is up + seeded: http://127.0.0.1:8765/?emu=1)
**Sign-ins:** `prac-mika`…`prac-sora` / `practice123`; admin `blake@practice.test` / `practice123`. **prac-newbie is the consent smoke** (fresh account, never accepted).

1. **The new shape:** sign in as Mika → Account. The left rail is grouped (Identity / Collections / Community / Settings); each item opens its **own full panel** with a slide-in.
2. **The wide editor:** Profile fills the column — the **hero preview** composes your identity over your background; every label is a pill; the panel **contains** everything (no spill past the card).
3. **👁 Public view:** flip the toggle — your saved profile renders exactly as viewers see it (badge says so), with your pinned review and the Appreciate row. Flip back to ✎ Edit.
4. **The tag dropdown:** in Tags, hit **⬡ Browse tags** — pick from Genres / Watch style / Identity (picked ones tick ✓); type a custom one too; 6 max.
5. **The consent fix (the bug you called):** sign in as **prac-newbie** → Account. The **🔓 unlock banner** sits on the Profile panel → **Read the rules** → the branded modal opens RIGHT THERE → **I agree** → banner gone, "your profile is unlocked." Now customize + Save — it sticks. No comment-section detour.
6. **Settings split:** the **Account** nav item owns email/password/session (member-since pill + sign out). The profile editor no longer mentions passwords.
7. **Collections:** Watchlist/Favorites — try the **▦ cover view** toggle next to the filter/sort/type controls.
8. **The inbox actually sends now:** as any member → Inbox → **Message Blake** → send a line (this was silently dead since the mega-batch — the adversarial review caught it; an e2e now drives the real send every run).

## One-liner reply
Round 2 rebuilt the account into a **real settings platform** — a grouped Discord-style rail where Profile/Watchlist/Favorites/Activity/Inbox/**Account-settings** each own a full panel, the profile editor went wide under a **hero preview** with an **Edit ↔ Public-view toggle**, tags moved into a **branded grouped dropdown** (~40 curated anime-flavored entries + custom), every label became a pill and every animation is compositor-cheap — and the **consent dead-end you called out is fixed in place** (a 🔓 banner + the branded modal wired to the acceptRules CF via ONE shared consent.js, proven end-to-end: fresh user accepts in the account and their customization saves); the 5-lens adversarial review then caught **2 HIGH** — the gate-18 inbox's send was silently DEAD since the mega-batch (`addDoc` never imported; fixed + a real-send e2e now guards it) and the round-1 520px clamp made the new editor **spill 670px past its card** (unlocked + spec'd) — plus 4 MED + 4 LOW (mid-session-ban re-checks, suspended-state honesty in copy + viewer mode, Blake's viewer special-case, the forever-lit unread dot, markdown-true bio preview), all fixed with `npm test` **166** · rules **126** · functions **56** · cf **57** · e2e **10** green; **practice is up + seeded, the checkpoint is pushed, APP_VERSION stays 1.9.1, nothing deploys.**
