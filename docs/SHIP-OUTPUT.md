<!-- author: Code | date: 2026-08-12 -->
# SHIP-OUTPUT — banked items **1** (notification overhaul) and **4** (admin tiles)

**Built and committed. NOT deployed** — nothing here is live until Blake says so. v2.1.1 remains the live version; no version bump and no CHANGELOG entry yet, matching how the patch queue was handled (build commits stay clean; the bump and changelog land together at the ship gate).

Blake picked these two to share a session, and locked eight decisions before a line was written.

## Item 1 — the enter-page overhaul

**What he asked for:** kill the catch-up strip that appears on the welcome door a second or two after it opens, and replace it with a real surface *after* you press Enter — "While you were away" — with what's airing from your list on one side and your notifications on the other, every row clicking through to the exact anime or the exact comment.

**What he got.** The door is a door again: art, wordmark, tagline, Enter. Nothing loads late onto it and nothing reflows under the cursor any more — that whole class of bug is now impossible rather than merely fixed, because there is no longer anything on the door to arrive late.

Press Enter and the catch-up sheet opens. He was right that "a system like this kind of exists" — the sheet was already there, already headed **WHILE YOU WERE AWAY**, already deep-linking correctly. It was just buried behind a strip button. So this is the rebuild he asked for on top of machinery that already worked, not new plumbing:

- **Two panels, side by side** — *Airing for you* and *Your lantern* — his "split in two as two separate models". They collapse to a single stack on a phone, and they're equal height so the pair reads as deliberate.
- **New reviews keeps the top slot**, full width above the panels — his call. It's also the only part that works signed-out, so it's the one thing a logged-out visitor can be shown here.
- **A quiet visit skips the surface entirely** and goes straight into the Den. Nobody is made to click through a page telling them there's nothing waiting.
- **One empty side still renders** as a panel with a quiet line, rather than leaving a lone orphan column in a two-column frame.

## A gap found while building this — the handoff was wrong

The brief said the anime rows "already branch" to Blake's review versus the currently-airing page. **They did not.** Every airing row called the same function unconditionally, so a title Blake *had* reviewed still opened the AniList deep-dive instead of his own review — exactly the thing he asked for by name: *"whether it be my review or something that's currently airing either one based on whether I reviewed it."*

That branch is now built, reusing the two matchers the franchise rows already use rather than inventing a second definition of "reviewed". It is covered by a test that was **deliberately broken first to prove it bites** — the first version of that test passed against deliberately broken code, because it only asserted an absence. It now measures the review actually opening.

## A race that would never have reproduced

The notification and airing signals are asynchronous — auth plus two round-trips — while Enter is instant. A fast press beat them, and a member with letters waiting would have sailed straight into the Den having been shown nothing: silently, only on fast connections or warm sign-ins, and never reproducibly. Enter now waits for those signals, but only up to a bounded cap, so the door can never hang on a dead network. The settle sits in a `finally`, because the code path underneath has early exits that would otherwise have skipped it on every visit by someone with an empty watchlist.

## Item 4 — the admin menu

**What he asked for:** tiles instead of a list, each with a name and a very short description, scrollable as more get added, matching the site.

**What he got:** eleven tiles in a two-across grid, each with its name, its Japanese sublabel and a description short enough to read at a glance — "Write a brand-new review", "Watch status on every card", "Flagged comments and posts". Every description was written against what the page actually does, not guessed from its title. One column on the narrowest phones, where two tracks would have left every label wrapping three ways.

**The scroll he asked for was a real bug, not a nice-to-have.** The old menu had no height limit and no overflow at all: at eleven tools it grew to roughly 580px and ran off the top of a short screen, and every tool added made it worse. Measured after the change — the menu now fits on screen at every width from 320px to 1280px, and the tiles scroll inside it.

**Then he asked for two changes, mid-session, and got them:** every tile is now *exactly* the same size (a fixed row height per screen size — matching row heights alone wasn't enough, because one label that wrapped made its whole row taller), and on desktop the menu **opens centred in the middle of the screen** instead of in the bottom corner. Measured at eight screen sizes from 320px to 1920px: identical tiles everywhere, dead-centre on desktop, and no description clipped anywhere. Phones keep the corner, since he said "on pc".

Two smaller things: the live badge counts (suggestions, reports, unread letters) survive the redesign and sit on the tile's first line, where a long description can't push them out of view; and the file's header comment had claimed the button was in the bottom-right corner ever since it moved to the left in v1.7.3 — he was right about the corner, the comment was wrong.

## What he should look at

1. **Close the tab, reopen the site, press Enter.** If anything is waiting you should land on *While you were away* — new reviews across the top, airing on the left, your lantern on the right. Click a notification: it should take you to that exact comment and highlight it. Click an anime you've reviewed: **it should open your review**, not the airing page.
2. **Do it again when nothing is waiting.** You should go straight into the Den with no extra page.
3. **The door itself** — check there's no strip appearing on it a second after it opens, on both phone and desktop.
4. **Admin menu on desktop.** It should open **centred in the middle of your screen**, eleven tiles all exactly the same size, and scroll. Tell me if any description is wrong about what its page does — those are my words, not yours.
5. **Admin menu on your phone.** Still opens from the bottom-left corner there, two tiles across (one on the smallest phones), and scrolls.

## Still open, still honestly labelled

- The intermittent **"review deep-links don't always highlight"** report is **not** fixed and was not touched this run. One reachable gap was closed previously; the intermittent case has still never been reproduced.
- The **Razr Flip 8** question (folded or unfolded) is still unanswered, and still doesn't block anything.
- **Items 2 (mobile card sizing) and 6 (shelf autopopulate) were not started.** Mode 2 remains its own session, as agreed.

## Test floors — all re-run at the end

| track | floor | result |
|---|---|---|
| `npm test` | 368 → **382** | **382 pass, 0 fail** (14 new specs for this work) |
| `test:webkit` | 24 | **24 pass** |
| `test:functions` | 94 | **94 pass** |
| `test:rules` | 218 | not affected — no rules touched |
| `test:cf` | 94 | not affected — no functions touched |

⚠️ **Four different tests failed at some point across seven full runs — all environment, proven rather than assumed.** Each failed with a network-ish error (socket exhaustion, stray 404s, one timeout), each passed on its own, and the failures kept moving to different tests. The decisive check: your site was reverted to the pre-change code and the whole suite ran clean (368/368), then restored and run clean again (382/382). It's the machine running out of network handles on a long test run, not the new code. **Nothing was silenced and no timeout was raised.**

## One-liner reply
The door is a door again — Enter now opens a real two-panel "while you were away" page, the admin menu is eleven scrolling tiles, and an anime you've reviewed finally opens your review instead of the airing page.
