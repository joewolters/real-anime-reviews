<!-- author: Code | date: 2026-07-04 -->
# 🎉 v2.0.0 IS LIVE — Report 11: **the cutover ran clean, end to end, on your word. The mega-run is shipped.**

realanimereviews.com is on **v2.0.0**, curl-verified, smoked live. Every step of the script ran in order and verified before the next.

## THE CUTOVER AS IT RAN
1. **The bump** — 93 version strings to 2.0.0 (checker-verified), the CHANGELOG's MAJOR entry, and the update-log widget's **first gold Milestone tier** (that gold border has been wired and dark since v1.9 — it lit today, for this). Full test suite over the bumped tree: 285 green. Committed as you, pushed.
2. **One adjustment, said aloud before running:** your console helper shipped in Milestone E — the OLD live site didn't have it, so your step moved to right after the hosting deploy (the new page carries it). The load-bearing rule — *the backfill finishes before the rules land* — held exactly.
3. **backfillProfiles deployed alone** → indexes → hosting. Verified live: v2.0.0 on the page, your helper present, the door preview image serving, internal docs still 404.
4. **Your backfill, run by you:** `minted 7 + existing 5 = 12` ✓ — every member has a profile doc; nobody gets tombstoned.
5. **Firestore rules → storage rules → functions** — all clean; the storage cross-service grant held; zero surprise deletions.
6. **Prod smoke, my half — all green:** a cold shared card link opens Demon Slayer's card ON PROD and Back retraces home (rarNav's first real-world contact — it works on the apex domain); the Top-10 at 375px real prod pixels: card in its frame, nothing buried; the widget wears gold; `/suggest` clean-URL resolves.

## YOUR 5-MINUTE PROD SMOKE (whenever you like — it's your site now)
1. **One vote** on any review — the count moves, the author gets the lantern ping (this exact loop has never run on prod with real data).
2. **One letter** to a member — the knock, the Letter Room.
3. **One card pill** — flip something to "watching" in the Studio and watch the card breathe.
4. **One studio save** — track something, note something, publish it into a review draft.
5. **One Discord paste** of realanimereviews.com — the preview wears the door now.
6. And from your phone: open a shared card link cold, press Back a few times.

## What to watch this first week (real humans, first contact)
- Does "strangers knock first" land? (the request-first DM copy)
- The Hidden Gems rail under real traffic (the canary paces the AniList quota)
- Whether "the Creator" reads warm once you hear members use it — your call, no rush.

## One carry-over that predates the run (first PATCH candidate)
Review-targeted notification deep-links don't always scroll-to-highlight the exact review (comments and replies do). Queued in NEXT alongside the post-cutover polish list.

## One-liner reply
v2.0.0 is live and verified — the bump, your backfill (7+5=12, perfect), rules, storage, functions, and the smoke all ran clean in order, the update log wears its first gold Milestone badge, a shared link opens straight to the card on the real domain and Back walks home, and the site you asked for — letters, one composer, every screen, your Studio — is the site that's on the internet right now.
