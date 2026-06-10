<!-- author: Cowork | date: 2026-06-09 -->
# v1.10.0 — Account polish pass (go-all-out) + Gate 19: per-season comments on the secondary modal. APPLY, practice verify, NO deploy.

> 🎉 **From Blake (relay verbatim — he asked me to note it): "IT LOOKS AMAZING. SUPER HAPPY. Make sure to note how my jaw dropped with this."** The account round-2 landed the "my jaw dropped" bar. Now: one more all-out polish pass on it + the per-season Tavern-style comments on the secondary modal. **Mode ULTRAMAX, full latitude — "Want code to go all out one more time… code to decide what the user experience wants and what we didn't consider. Go all out."** 5-agent adversarial review. Checkpoint-commit + push at the end. STAGED — no deploy.

## ⭐ THE BAR
"I want the UI to look complete, feel like a real social media website." Every surface complete + premium; no plain/dark/small text; no native focus outlines anywhere; unique tasteful motion. Protect-the-heart holds (gold = Blake only; Appreciate the one purple count).

## PART A — account/profile polish (Blake's items, his words)
1. ✅ (the redesign — jaw dropped).
2. **Headings too dark + generic.** *"the heading starting with 'your constellation' looks dark. fix it. Make text unique under it as well."* → brighten the "YOUR CONSTELLATION" header (full-bright, legible over the night) and give its subtext a unique, Blake-voiced line (not generic).
3. **Every heading dark + small.** *"Every heading looks dark and small. Fix the sizing. It should be nice to read. Maybe add some lanterns as decoration."* → all section headers across the account get a brighter, larger, premium treatment; **add lantern motifs as decoration** (the Tavern lantern vocabulary, perf-cheap).
4. **Native focus outline STILL appearing (recurring).** *"UI when clicking still has a blue rectangle, white outlines."* → a COMPREHENSIVE sweep: EVERY focusable element site-wide (account, hub, modals, dropdowns, chips, buttons, inputs) gets the branded purple focus ring — **zero browser-default blue rectangles / white outlines anywhere.** Audit, don't spot-fix.
5. **My Activity → intuitive deep-links + review thumbnails.** *"When clicking comments make sure it takes to that exact comment with halo. It should show reviews with the thumbnail for easy look at it. be intuitive."* → each My-Activity row is clickable and **deep-links to the exact comment/reply/thread/review with the halo** (reuse the deep-link machinery); review rows show the **anime thumbnail**; the whole list reads scannable + intuitive.
6. **Inbox / Message-Blake looks unfinished.** *"UI looks incomplete as well sometimes. Message blake etc."* → flesh out the Inbox + Message-Blake surface so it reads complete + premium (not a stub).
7. **Account page more professional.** *"Make the account page more professional if possible."* → tighten the Account/Settings surface to a polished, professional finish.
8. **Go-all-out pass:** "code to decide what the user experience wants and what we didn't consider" — add the social-platform completeness touches that make it feel like a real site (cohesive empty/loading states, micro-interactions, anything that reads "unfinished" → finished). Clean; heart-safe.

## PART B — Gate 19: per-season comments on the secondary modal (Blake's banked "left side" idea)
The secondary modal (a non-primary season / non-catalog AniList entry) gets its **own community comments block**, keyed per `al:<id>` (the `communityKey({al})` picker already exists — `comments/al:{id}/items`, zero new schema). Blake's seed: *"should they live on the left side of the modal?"* → place it **LEFT side, BELOW Blake's review** (the H5 invariant — Blake's review always precedes the community block in DOM order). Full treatment: the **live-in-box composer**, consent-gated, **inline images + spoilers** (the systems already exist), report/mod, deep-linkable. So a viewer on a specific season can discuss THAT season. Heart: purple + count-free; gold only on Blake's review above it.

## Verify
ALL tracks green + new specs (the focus-ring sweep, the My-Activity deep-links + thumbnails, the secondary-modal comments mount + H5 order + heart). **5-agent adversarial review** — lenses: the new comment surface (XSS/consent/heart parity with the main comments), the focus sweep completeness, deep-link correctness, and perf on the new motion. Walk it yourself (Storage emulator up). Then Blake's numbered smoke.

## Report (lean): the design vision (1 para) · Part A per-item (2-8) · Part B the secondary-modal comments + H5 order · adversarial findings · checkpoint hash · test counts · Blake's numbered smoke. NO deploy.
