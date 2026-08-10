<!-- author: Code | date: 2026-08-10 -->
# SHIP-OUTPUT — PART A items 6, 7, 2. **PART A IS COMPLETE — and v2.1.0 IS LIVE.**

**Deployed 2026-08-10** on Blake's "deploy it, rules then functions then hosting". That order was a deliberate deviation from the runbook, flagged to him first: hosting-first exists to protect the vote-count model (which this ship doesn't touch), and it would have put a Delete Account button in front of members before its backend existed. Going rules-first closed the console deletion hole before anything else moved.

Verified on the live site rather than assumed: version 2.1.0 with the update-log chip agreeing, all 43 functions including the three new ones, and — the one that matters — the new rules proven to actually BITE over the public API (an unauthenticated read of the stats doc returns 403, the public catalog still returns 200). Internal docs, the ~300 leftover scratch files and PERSONAL.md all 404.

## What Blake asked for, and what he got

**Item 6 — "track member stats included joined this month, active users, comments, reviews posted etc etc"**
A new admin page, **Member Stats**, in the Admin menu. Members total · joined this month · joined in the last 30 days · active members · a table of comments/reviews/replies/threads/posts (all-time and last-30-days) · letters sent · appreciates given. A **Refresh now** button when he doesn't want to wait for the daily count.

It reads **one document**. A scheduled function walks everything once a day and writes that single doc, so opening the page costs exactly one read no matter how often he refreshes it — and the two numbers that are impossible to count from a browser (active users, letter volume) are possible at all.

**Counts only, never content — structurally.** Every read names the exact fields it needs, and the letters lane names *none*, so a letter's text never reaches the process that builds this page. A test asserts a seeded message body and both members' ids are absent from the stored document. The page says so out loud, too.

**Item 7 — "New way to delete your account in user settings that's available to all members"**
A **Leaving** card at the bottom of account settings. Closed until asked for. It says what will happen *before* it asks for anything, then wants the word `DELETE` typed and the password re-entered. No pop-up boxes anywhere.

His locked policy is what it does: **tombstone the containers, erase the content.** Their words, pictures and name are gone; the empty slot stays where it was reading *[removed by the author]*, so the replies underneath still make sense — and **nobody else's post disappears because someone left.**

**Item 2 — "pin one review… a button that brings up a separate sheet of all the reviews"**
The pinned review leads the profile. Everything else is behind one **all reviews (N)** button that opens the full list as its own view of the same sheet, with a ← back chip. The profile stops being a wall of reviews.

## Two live problems found and fixed — both reproduced first

**1. Any member could have deleted their whole account from the browser console, today.** Not through the site — there was no button — but the rule that let them do it was live and unguarded, and the account-wipe cascade fired straight off it: no password check, no confirmation, no protection for the Creator's account. The deny-test was written first and *failed* against the live rules, which is how we know it was real. It's closed.

**2. When someone left, other members' words went with them.** The old cleanup deleted their forum thread — and a thread deletion takes every reply inside it, from everyone. Same for replies under their comment and discussion under their review. Innocent people lost writing because somebody else quit, and it contradicted what the site already tells visitors ("what they shared lives where they posted it"). Reproduced against the emulator: with the old code, a bystander's post *and* their reply were both destroyed. With the fix, both survive. That test is permanent now, and it's written from the bystander's side, because it was their loss.

⚠️ Worth saying plainly: **the first attempt to reproduce #2 was wrong** — it reported "everything survived" because the check finished before the cleanup had even run. Hardened, it reproduced immediately. A green result from a test that never exercised the thing is worse than no test.

## A third problem, found only because we measured against a baseline

While verifying, an unrelated test started failing. The tempting fix was to raise its timeout. Instead we re-ran the same suite against the pre-change code (79/79 green), which proved the regression was ours — and it turned out the redaction code was **recreating documents that had just been deleted**, because the Firestore call it used creates a document when one is missing. Ghost entries nobody wrote, triggering everything a real new post triggers. Fixed properly. Raising the timeout would have hidden a genuine bug in the deletion path.

## Blake's smoke — THIS IS LIVE NOW, so these are real

1. **Admin menu → Member Stats.** Numbers should appear (or "nothing counted yet" until the first daily run — press **Refresh now** and they fill in). Check it on your phone too.
2. **Any profile.** Your pinned review leads; below it one **all reviews (N)** button. Press it → the full list. Press **← Back to profile** → you're back where you were. Then the browser Back button — same thing.
3. **Copy a profile link while the reviews list is open** and open it in a new tab. It should land on the reviews list, not the top of the profile.
4. **Account → Settings, scroll to the bottom.** You'll see **Leaving**. Open it, read it, type `DELETE` — the red button wakes up. **Then press Keep my account.** Please don't test the real thing on your own account; if you want it tested end to end, make a throwaway account first.
5. **A thread someone else started, with your reply in it** — that reply must still be there after they leave. This is the one that mattered.

## Test floors (all re-run at the end, all green)
`npm test` **350** (was 320) · `test:rules` **218** (211) · `test:cf` **94** (79) · `test:functions` **94** (77) · `test:webkit` **24** (24).

(350, not 348: Blake's three post-build smoke fixes added two more — the search-proportionality guard across sixteen widths, and the header-token edge check.)

## One-liner reply
Part A is finished and v2.1.0 is live: members can delete their own accounts, nobody else loses their words when someone leaves, profiles no longer drown in reviews — and the two live problems we found on the way (any member could have wiped their account from a browser console, and a departure destroyed other members' posts) are closed in production, with the rules proven to bite rather than merely uploaded.
