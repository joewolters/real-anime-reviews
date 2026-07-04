<!-- author: Code | date: 2026-07-04 -->
# CUTOVER-EVE — Report 10: **all four fixes in, walked by real keystrokes and real pixels, panel'd, every track green. The door is open — the cutover script below stands as written, waiting on your word.**

Mode MAX (per the prompt). Surgical: four fixes + the panel's catches in the same seams — nothing else moved. **NO deploy — nothing is live until your go.**

## THE FOUR (your numbering, with evidence)

**1 🔴 The spoiler trap — dead, on every surface, in your browser.**
Root cause confirmed exactly as staged: the toolbar-👁 path inserted the spoiler box with **no landing pad** after it, so the caret sat on the box's edge and every keystroke fell INSIDE — a one-way door. The typing path (`||text||`) always dropped a pad; the toolbar path now does too, and clicking 👁 while you're inside a box **leaves it** (that's your toggle-off).
- Walked by REAL keystrokes signed in as you, on BOTH surfaces (a card's community tab + a Tavern thread), in **Chromium AND Firefox**: create via select+👁 → type lands outside ✓ · toggle-off ✓ · arrow-right ✓ · End ✓ · click-after ✓. Posted it — the reader-side pill renders and hides correctly.
- **The audit found a sibling worse than the trap** (panel HIGH, fixed): wrapping a selection that contained a line-break or a `|` produced markdown the reader-side could **never re-hide** — the editor showed an intact spoiler box while readers saw the text in the open. A spoiler LEAK. The wrap now joins lines with spaces and drops pipes, so what you hide is exactly what stays hidden. Also fixed (panel MED): dragging a selection partly across an existing box could split it strangely or leave an invisible empty box that re-armed the trap — swept.
- Bold/italic audited by the same real-keystroke method, both browsers: typing at a bold edge continues bold (same as Discord/Docs) and **Ctrl+B / the B button always escapes** — no trap there, nothing changed.
- Pinned: 3 new real-keystroke specs in the composer suite (escape, toggle-off, no-leak).

**2 ⭐ Feature this shelf — ON the cards now.**
Every shelf card in Personal Collections carries the control: **"⭐ Feature this shelf"** on public shelves, **"★ Featured"** (click to un-feature) on the current pick, and on private shelves it's dimmed with hover copy — *"Private shelves can't be featured — make it public first."* One at a time is automatic (it's one field); featuring a second un-features the first. The Studio dropdown still works and follows the card pick instantly, both directions.
- The demo is fixed at the root: Mika's two public shelves + her featured pick are **in the seed now** (the old walk had seeded them by hand into the live emulator; the next restart wiped them — that's why you never saw one).
- Walked owner-side as Mika (feature/un-feature cycle, the ★ moving, the dropdown following, the private-shelf copy) and member-side as you: **"Comfort rewatches 📌 FEATURED" leads, "view all shelves (2)" below** — screenshots `tmp-walk-shelf-owner.png` / `tmp-walk-shelf-member.png`.
- Panel catches fixed in the same seam: a featured shelf that fell outside the freshest-8 window now still leads member-side (fetched directly); the ⭐ decision reads the live pick at click time; no empty-state flash on first open. Rules pinned: the card's exact write shape (merge, only `featuredShelf`) is a new rules test.

**3 📱 Mobile Top-10 overlap — root-caused and measured, not patched.**
The phone stylesheet's fluid card rule (`width:100%`, meant for the 2-column grid) was inflating the spotlight card with the viewport — **1,382px tall at 900px wide, inside a frame fixed at 630px** — so the centered card spilled out both ends, burying the heading above and the Featured Drop below. One scoped rule restores the desktop portrait (275px) inside the spotlight only; the grid and rails keep their fluid cards.
- Pixel-verified at **320/360/375/414/560/768/900**: card 275px, zero overlap, zero spill, zero horizontal scroll at every width (before: +21px overlap at 375, +50 at 414, +354 at 900). Screenshots `tmp-top10-375-after.png` / `tmp-top10-414-after.png`. Pinned with a live measuring spec at 360/375/414.

**4 🏷 Black Clover — "friendly-rivalry", one tag.**
One cell in the canonical Excel (G8: the stray comma in `#friendly, rivalry` removed — byte-surgical, every other cell verified untouched) → resync → the animeData diff is **exactly the tag line** plus the auto sync-timestamp. Pinned. ⚠️ First attempt via a spreadsheet library re-encoded other cells' line endings — caught it in the diff gate, rolled back, and patched the one string inside the file instead. The master is clean.

**5 🔒 Attack on Titan "15/10"** — logged in CODE-HANDOFF's deliberate-calls list AND now enforced by a spec: if any future pass "normalizes" it, a test fails with *"someone fixed his voice: put it back."*

## THE PANEL (lite, per the prompt: composer + shelf rules)
2 finders → 9 raw findings → per-finding skeptics: **5 confirmed (1 HIGH · 2 MED · 2 LOW) — all five FIXED** (details above) · 4 refuted. One accepted quirk, noted: with a rename box open on one card, the first click of a ⭐ on another card commits the rename and repaints — the ⭐ needs a second click. Same behavior as every other card button mid-rename; self-heals.

## Green (the new floors)
Playwright **285** (+3 composer escape/leak pins, +4 cutover-eve pins) · rules **204** (+1 the card-⭐ write shape) · functions **77** · triggers **78** · e2e **25** — all re-run AFTER the panel fixes. Practice is UP and freshly seeded for your smoke.

## YOUR SHORT SMOKE (~3 minutes; `http://127.0.0.1:8765/?emu=1` · you = `blake@practice.test` / `practice123`)
1. **The spoiler escape:** open any anime → community tab → type a sentence, select a word, click 👁 → keep typing — it lands OUTSIDE the box. Click into the box, click 👁 again — you're out. Try it across two lines too: select both lines, 👁 — it becomes one clean box.
2. **Feature a shelf:** Account → Personal collections → make a shelf public if you haven't → click **⭐ Feature this shelf**. Then open Mika's profile from any of her comments — her featured shelf leads with the 📌.
3. **Top-10 on a narrow window:** drag your browser narrow (or your phone) — the Top-10 card sits inside its frame, nothing behind anything.

## THE CUTOVER — the click-by-click script (Report 9's, standing as written; nothing runs until your word)
When you say go, this is the whole thing, in order. I do every step except ONE console command that must run as you:
1. **I bump to v2.0.0** (`npm run bump -- 2.0.0` + CHANGELOG + the widget bullets), commit, and push. Nothing is live yet.
2. **I deploy ONE function only** — the profile backfill. Still nothing visitor-facing.
3. **YOUR one console step** (I'll be right here): open **realanimereviews.com** in Chrome and sign in as yourself. Press **F12** — a panel opens on the right. Click the word **Console** at the top of that panel. Click once in the empty line at the bottom (next to the `>`), paste exactly this, and press Enter:
   `await window.__rarBackfillProfiles()`
   Wait a few seconds. It prints a result like `{minted: N, existing: M, total: T}`. **Read me the three numbers.** They must satisfy minted + existing = total. If they do, say so and you're done — close the panel. If they don't match, or you see red text: change nothing, tell me exactly what it says, and we stop safely (nothing visitor-facing has changed yet).
4. **I deploy the rest in the corruption-proof order:** indexes → hosting → firestore rules → storage rules → functions — verifying each step, with a rollback plan per step.
5. **We smoke prod together (5 min):** one vote, one letter, one card pill, one studio save, one shared link + Back-walk, one Discord paste for the preview.
6. **I run the close-out checklist:** version strings, changelog widget, docs 404 scrub, ROADMAP.

## One-liner reply
All four of your fixes are in and proven the hard way — the spoiler box now lets you leave by every door (and the audit caught something better: multi-line spoilers used to leak visible to readers, fixed and pinned), featuring a shelf is one click on the card itself with Mika's demo finally seeded to show it, the Top-10 card sits inside its frame at every phone width with the pixels to prove it, Black Clover reads friendly-rivalry from the one Excel cell you called — floors up at 285/204/77/78/25, the panel's five catches all fixed, and the cutover script above is loaded and waiting on nothing but your word.
