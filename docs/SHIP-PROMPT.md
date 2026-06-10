<!-- author: Cowork | date: 2026-06-09 -->
# v1.10.0 — THE DREAM PROFILE/ACCOUNT PLATFORM (+ 2 small fixes). APPLY, practice verify, NO deploy.

> Blake's mega-mandate: the account/profile page becomes a **full customization platform — "THE WORKS."** This is a big, open-ended creative build. **Mode ULTRAMAX, full latitude — Blake explicitly wants "functionality I can't even dream of" and "to see the ingenuity."** Build your best, lead the report with a 1-para design vision so Blake sees the thinking. Checkpoint-commit at the end (pushed). 5-agent adversarial review (the new upload/customization surface + the heart carve-out). STAGED — no deploy. Take the time you need; start fresh if context is tight.

## ⭐ THE UX MANDATE STILL RULES
Clean, professional, intentional — "social media platform for user customization," NOT "in training." Essentials done beautifully. Full brand parity on every new control.

## TWO SMALL FIXES FIRST
1. **Community-review thumbnail redesign.** *"the community reviews thumbnail needs to look better. I propose a little redesign before someone clicks in. Thumbnail looks terrible and not large."* → the cover on the collapsed review row needs a better, larger, cleaner presentation.
2. **Click pfp OR name → profile.** *"lets change it to clicking on their profile picture or name."* → both the avatar AND the name open the profile (currently name-only).

## THE DREAM PROFILE/ACCOUNT PLATFORM (Blake's verbatim mandate is the spec)
> *"COMPLETE UI/UX/LOOK REDESIGN… change pfp, edit bio, add tags to their bio, precise controls over favorites, watchlist, filters, functionality I can't even dream of, activity shown and separated by comments, threads, reviews, replies ETC. A DREAM account page. upvote profiles. add a BACKground to their profile. HECK even GIFs as their background. look AMAZING for user profiles. THE WORKS. feel like a social media platform for user customization. unique profiles… the ingenuity of the community."*

Build the full set (propose + implement; mark anything genuinely huge as PITCH):
1. **Complete account.html redesign** — scrap the current "frankly sucks" layout; a premium, modern, customizable profile/account experience. **The account page gets its OWN whole-page aesthetic (Blake, 2026-06-09): "a new aesthetic design that's like the constellation veil. It should feel personal and unique."** → build a distinct account-page backdrop in the **constellation-veil vocabulary** (the cosmos / line-work / purple-veil language from the rest of the site), whole-page, that reads **personal + unique** (not the generic city backdrop). The **new `assets/account_background.png`** (1200×2400, currently SIDEWAYS — **rotate to correct orientation first**) is available as an element/layer if it fits the veil aesthetic; the GOAL is the personal constellation-veil feel, not just dropping in the PNG. Perf-safe (compositor-cheap, reduced-motion, the Firefox-Profiler discipline).
2. **Profile customization** (the user's own profile, editable from account):
   - Change **pfp** (avatar upload via the image pipeline; the existing rules/cap/EXIF/dedupe apply).
   - **Edit bio** + **bio tags** (a small structured set of self-tags — e.g. favorite genres, "sub/dub", etc.; propose the tag model).
   - **Profile background** — upload an **image OR GIF** as their profile background. ⚠️ Rides the existing Storage pipeline + moderation (⚑ report / admin remove / cascade) + **perf-safety** (reduced-motion disables GIF animation; never tank the page — pause off-screen; size caps). It's user content → fully moderatable.
3. **Profile upvotes/likes** — users can like a profile. ⚠️ **HEART CARVE-OUT (Cowork-approved):** profile likes are the ONE allowed community count — user-to-user social, **NEVER gold**, and they must not create a Blake-vs-community leaderboard. Update the protect-the-heart specs to permit a profile-like count while keeping **gold = Blake only** and no counts on threads/comments/reviews/cards. (If Blake vetoes likes, drop this cleanly.)
4. **Activity feed, separated by type** — the profile/account shows the user's activity split into **comments · threads · reviews · replies** (tabs or filterable sections; reuse the collection-group reads — the public docs are already individually readable).
5. **Precise watchlist/favorites controls + filters** — better management UX (reorder/remove/filter/sort), the cover-art fix intact, the `al:<id>` + `#open=`/`#secondary=` routing intact.
6. **Go-all-out latitude** — "functionality I can't even dream of": think about what makes a profile feel ALIVE and unique (profile themes/accent color, a featured-review pin, a status line, join-date flair, an empty-state that invites customization, etc.). Propose + build the tasteful set. Keep it clean (the UX mandate), keep the heart (Blake supreme; community is the room, not the house).

## Verify
ALL tracks green + new specs (profile customization round-trip, the bg/GIF upload + moderation + perf guards, the profile-like heart carve-out spec, the activity-by-type reads, the watchlist controls). **5-agent adversarial review** — lenses: the new upload surface (bg/GIF/pfp — same XSS/spoof/cap protections, no SVG, origin-gated), the profile-like rules (no inflation, CF-owned count), privacy (what's public vs private), the heart carve-out (likes allowed, gold still Blake-only, no other counts leaked), and perf (GIF backgrounds). Rotate the new asset correctly. Walk it yourself (Storage emulator up). Then Blake's smoke.

## Report (lean): the design VISION (1 para) · the 2 fixes · the dream-profile features built + any PITCHed · the heart carve-out implementation · the bg/GIF moderation+perf approach · adversarial findings · the checkpoint hash · test counts · Blake's numbered smoke. NO deploy.
