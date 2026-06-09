<!-- author: Cowork | date: 2026-06-09 -->
# v1.10.0 — BATCH: Tavern polish (8d) + anime-attach-with-covers + Gate 9 (hotScore/Rising) + Gate 10 (mod polish + CHECKPOINT COMMIT). APPLY all, NO deploy. ONE smoke at the end.

> **Cadence (Blake): batch the polish + the next couple gates into one ULTRAMAX run — "code is allowed to take as much time as it needs."** Build straight through, self-verify hard + adversarial review, then ONE milestone smoke. Everything STAGED — no deploy. The gate-10 checkpoint commit lands at the end.

## ⭐ STANDING DIRECTIVE
Every interactive element at full brand parity by default — branded, hover states, purple-not-gold, **legible AT REST** (heading text must match plain white body text, not a dimmer "stylized" tone). No native/unstyled control reaches smoke.

## PART A — Tavern polish (Blake's 8c re-smoke, his words)
1. **Backdrop over-blurred — REVERT.** *"The tavern backdrop is WAY too blurred now. Restore the blur to what it was before."* The `tavern-blur.webp` overshot — go back to the lighter shade-blur from 8b (the sharp `tavern.png` + dark gradient, or a much gentler pre-blur). Cozy, not soupy.
2. **Nav rename → "The Tavern"** (WITH "The") in the nav headers on BOTH index.html + account.html (8c set it to "Tavern").
3. **Heading legibility — STILL too dim.** *"The Tavern letters still aren't bright enough. Same with community. Like they look dimmed compared to all other white text."* → make "The Tavern" title + the "Community" kicker render at the SAME brightness as the site's normal white text. Stop dimming them; the text-shadow can stay for contrast but the fill must be full-bright.
4. (Second-level slide-out = good, no change.)

## PART B — anime-attach with cover art (reshapes "About a title", Blake's idea)
*"if the user is basing it on an anime they should have that same anime search function thats given to them when requesting an anime for me to watch. That way it gives the thread/forum a nice picture to go with the topic."*
- The new-thread **"attach an anime"** flow uses the **full AniList search** (the suggest.js/request-an-anime search — debounced, covers, AbortController), NOT just Blake's 44.
- ⚠️ **Blake's reviewed-anime quick-pick must NOT go away** (his note): *"Make sure my thing for choosing one of my reviewed anime doesn't go away for a thread. Just if they want to specifically look for an anime I haven't reviewed that option is available."* → keep a quick path to his 44 AND allow searching any anime. Unify cleanly: his 44 surface marked/gold in the search; any other anime is also findable.
- The attached anime gives the thread a **cover image** (the AniList cover) shown on the thread card + thread view.
- **Heart:** if the attached anime is one of Blake's 44 → the thread gets his **gold verdict rail** (as now). If it's NOT reviewed → just the cover, no verdict (heart-safe; his reviews stay the only gold). A non-catalog anime tags as `anime:al:<id>` (additive rules — Code already uses the `al:<id>` discriminator); keep `anime:<slug>` for the 44.
- (User-uploaded thread images are gates 12-14 — the `📷` placeholder stays; this is the cover-art step toward it.)

## PART C — topic expansion + dropdown (Blake: "I meant for code to add more topics, going wide")
- **Propose a full, expansive anime-discussion topic set** (e.g. General · Recommendations · Hot Takes · Episode Discussion · Theories · Animation · Music/OST · News · Manga · Cosplay · Off-topic — your call, go wide and tasteful).
- Because the list is now long, **the topic picker becomes a branded DROPDOWN** (Blake: *"there should also be a drop down menu for these"*) — not a wrapping chip row. Branded (not a raw `<select>`), searchable/scrollable, with the "attach an anime" as its own clear slot separate from the topic.
- New topics = additive `forum` tag-enum widening + tests.

## PART D — Gate 9: hotScore + the Rising rail (study idea #7)
- **`recomputeHotScore` CF** (binding the live `handleVoteWrite` template) — `(up−down+0.5·postCount)/(ageHours+2)^1.5` on each thread; drives the **Hot** sort properly (replace the interim `lastActivityAt` proxy).
- **A "Rising" rail** with **slot 1 permanently Blake's gold pick** (his pinned anime-tagged thread / verdict) — community velocity literally tops out beneath Blake. Propose placement (top of the Tavern Hot view, or a homepage teaser). Heart: slot-1 gold, the rest purple + count-free.

## PART E — Gate 10: final mod polish + the CHECKPOINT COMMIT
- Pin/lock/remove→tombstone + the Blake's-Reviews shelf already shipped (gate 8) — verify they're solid, fill any gaps (e.g. a locked-thread visible state, a removed-thread tombstone in the list).
- **Then the gate-10 CHECKPOINT COMMIT** — gates 5→10 working tree, Blake-authored, zero trailers, the 7 Cowork excludes restored out. ⚠️ **`git add` the two public assets** `assets/tavern.png` + `assets/tavern-blur.webp` (or whichever pre-blur survives Part A). STAGED — NO deploy.

## Verify
All tracks green (npm test current+ with updated specs; the new tag-enum + anime-attach + hotScore + Rising-rail heart specs; run `test:rules` if practice frees 8080, else note the expected count). **4-agent adversarial review** across the batch (XSS on the AniList-search results + thread covers, the heart specs on the Rising rail + covers, the hotScore CF idempotency, the new tag rules). Walk everything yourself. Then Blake's ONE numbered smoke.

## Report (lean): Part A/B/C per-item · the topic set you chose · the anime-attach UX · Part D hotScore+Rising · Part E gaps-filled + the **commit hash** + the asset adds · adversarial findings · test counts · Blake's numbered smoke. NO deploy.
