<!-- author: Code | date: 2026-06-09 -->
# v1.10.0 — BATCH: 8d polish + anime-attach covers + Gate 9 (hotScore/Rising) + Gate 10 (mod polish + CHECKPOINT COMMIT). DONE · STAGED · NO deploy

Mode **ULTRAMAX**, built straight through (Blake: "take as much time as it needs"). Recon workflows up front, the UI built solo, the **Gate-9 CF delegated to a background agent** (functions/ only — no overlap), a 4-agent adversarial review after (**XSS clean · heart PASS · brand/perf PASS**; fixed 1 HIGH CF race + 3 minor). Blake's practice was shut down to free the emulator (restart `npm run practice` to smoke). **All tracks green.**

## Part A — Tavern polish (Blake's 8c re-smoke)
1. **Backdrop over-blur REVERTED** — the 8c `tavern-blur.webp` was soupy; back to the sharp `tavern.png` + dark gradient (cozy AND high-contrast). The blur asset is deleted.
2. **Nav → "The Tavern"** (with "The") on both index.html + account.html.
3. **Heading legibility — FIXED (real-pixel verified).** The dimness wasn't the text color (it was always `#fff`) — it was **low contrast over the warm art**. Added a dark gradient backing behind the header (`.hub-header::before`); "The Tavern" + "Community" now render bright white, matching body text. (Caught only by screenshot — computed color lied the whole time.)
4. Second-level slide-out unchanged (good).

## Part B — anime-attach with cover art
The new-thread **"Attach an anime"** slot now uses the **full live AniList search** (the same debounced/AbortController/cover search as the request-an-anime page, replicated in `hubAniListSearch`). **Your 44 are starred (★)** in the results (matched by AniList id incl. season ids) — picking one tags `anime:<slug>` and keeps your **gold verdict rail**. Any **other** anime tags `anime:al:<id>` and gets **only the cover** (no verdict, no gold — heart-safe). The cover (`coverImage`) + `animeTitle` store on the thread and render on the **card thumb + thread-view cover**. `hubSafeCover` scheme-gates every render (https/assets only). Rules: `anime:al:<id>` regex + `coverImage`/`animeTitle` validated (string + capped).

## Part C — wide topics + branded dropdown
The topic chips became a **branded dropdown**. The set went wide: **General · Recommendations · Hot Takes · Episode Discussion · Theories · Animation · Music & OST · News · Manga · Cosplay · Off-topic** (new tags = additive rules-enum widening + tests). "Attach an anime" is its own clear slot, separate from the topic.

## Part D — Gate 9: hotScore + the Rising rail
- **CFs (`functions/`):** `onForumPostVote` (counts-only — updates the post + the thread's aggregate likes/dislikes, recomputes hotScore) + `onForumPostCreate` (postCount + lastPostAt + hotScore, **transactional** after the review). Pure `lib/hotscore.js`: `(likes − dislikes + 0.5·postCount)/(ageHours+2)^1.5`, NaN/future-safe.
- **The "Rising" rail** at the top of the Hot view: threads by hotScore, **slot 1 = your gold pinned pick** (community velocity tops out beneath you), the rest purple, **count-free** (order conveys rising — no number shown).

## Part E — Gate 10: mod polish + the checkpoint commit
- **Mod controls verified:** pin/lock/remove + the locked-thread badge/note all solid (gate 8b); removed threads drop from the list and show a tombstone on deep-link (no void).
- **CHECKPOINT COMMIT** landed: gates 5→10, Blake-authored, **zero trailers**, the 7 Cowork excludes held out, **`git add assets/tavern.png`** (the blur webp was reverted/deleted, so only `tavern.png`). **STAGED — NO deploy.** (Hash in the chat reply + `git log`.)

## Adversarial review (4 agents) — findings fixed
- **XSS: CLEAN** (every cover/AniList sink escaped + scheme-gated). **Heart: PASS** (gold only on Blake's surfaces; Rising rail slot-1-only; non-44 covers carry no gold; count-free).
- **Fixed — HIGH:** `onForumPostCreate` read-then-write could under-count `postCount` under concurrency → wrapped in a **transaction**.
- **Fixed — MED:** the seed had no vote docs (thread aggregate stayed 0) → seeded a few post votes so hotScore/Rising reflect votes.
- **Fixed — LOW:** a raw `anime:al:<id>` chip in the thread head → `animeTitle` fallback; the topic-dropdown ARIA → disclosure pattern.

## Tests — ALL GREEN
`npm test` 123 → **125** (+cover heart spec, +Rising heart spec) · `test:rules` 60 → **68** (+wide topics, +`anime:al:<id>`, +cover fields) · `test:cf` 24 → **31** (+hotScore unit + forum CF integration) · `test:functions` **21**. Real-pixel verified the heading brightness + the modal-stack widths.

## Your smoke (RESTART `npm run practice` — the seed changed: covers, votes, the new CFs)
1. **The Tavern** opens with a sharp cozy backdrop + **bright white "The Tavern"** heading. The pinned thread shows a **cover** (One Punch Man) + the gold verdict rail.
2. **Rising rail** at the top of Hot: your **pinned thread is slot-1 gold ("Blake's pick")**, the rest purple, no numbers. Tap one → opens it.
3. **New thread** → the **topic dropdown** (wide list) + **"Attach an anime"** → type to search **any** anime (live AniList, covers). Pick one of your 44 (★) → it carries your verdict rail; pick another → cover only. Post → the thread shows the cover.
4. Reply/vote on a post (as a consented user) → the thread's hotScore lifts (the CFs are live in practice).
5. **Account page** nav now says **"The Tavern"** → click → lands home with the Tavern open.
6. **Heart check:** purple + count-free everywhere; gold only on the shelf, verdict rails, a Blake-picked reply, and the Rising slot-1.

## One-liner reply
The whole batch shipped — the Tavern backdrop is un-blurred and the "The Tavern"/"Community" headings are genuinely bright now (it was a contrast problem over the art, fixed with a dark header backing — verified in real pixels, the computed color was white all along); "Attach an anime" now uses the **full live AniList search with cover art** (your 44 starred → gold verdict rail, any other anime → cover only, never gold), the topics went **wide in a branded dropdown**, **Gate 9's hotScore CFs + the gold-topped "Rising" rail** are in (test:cf 24→31), and it's all wrapped in the **gate-10 checkpoint commit** (gates 5→10, Blake-authored, trailer-clean, `tavern.png` added, 7 excludes held out) — a 4-agent review came back XSS-clean + heart-PASS and I fixed a HIGH postCount race (transaction) plus 3 minor issues, with `npm test` 123→**125**, `test:rules` 60→**68**, `test:cf` 24→**31** all green; **NO deploy — restart `npm run practice` and smoke it.**
