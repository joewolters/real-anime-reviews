<!-- author: Code | date: 2026-08-12 -->
# NEXT SESSION — Blake's banked brief

> Captured live from Blake on 2026-08-12, at his instruction ("Things I want to bank for next
> session"). **His words are quoted verbatim** — his phrasing carries the requirement, and every
> time this project has gone sideways it was because a session guessed at what he meant.
> My reading of each is marked separately, and my open questions are at the bottom of each item.
> **Do not treat my reading as his decision.**
>
> State when banked: **v2.1.0 LIVE**, Part A complete, **the patch queue is CLOSED** — items
> 2/3/5/6 shipped, 7 partial (one gap closed, the intermittent report still unreproduced),
> 4 closed-as-deliberate by Blake. 1 was already done by PART A item 8b.
> Floors: **npm test 368** · rules 218 · cf 94 · functions 94 · webkit 24. Nothing is deployed
> since v2.1.0 — every patch-queue change is committed and pushed but NOT live.

---

## ⚡ STATUS (updated 2026-08-12, after the items 1 + 4 session)

- 🚀 **v2.2.0 IS LIVE** (deployed 2026-08-12, hosting only, prod-smoked). Items 1, 4 and 2 plus the header-search shelf all reached real people.
- ✅ **Item 1 — DONE and LIVE.** Blake locked 5 decisions first; they are
  recorded in the gate log. ⚠️ **This brief's §1 claim that the anime routing "already branches
  this way" was WRONG** — it did not, and the branch had to be built. Left in place below so the
  next reader sees what a confident-but-unverified claim looks like.
- ✅ **Item 4 — DONE and LIVE.** All eleven tools stay; Blake: *"Ill tell
  you which ones to drop later."* The scroll he asked for turned out to be a real bug — the menu
  had no `max-height` and no `overflow` and ran off-screen.
- ✅ **Item 2 (mobile) — DONE and LIVE.** Rail cards had NO mobile override: fixed 200×581 at every width. Now 117×307, 3.06 visible, 36% of screen (was 69%). The `.spotlight-stack` 275px landmine is untouched and now test-guarded.
- ✅ **Header search** now shows a NOT REVIEWED YET shelf (his mid-session ask).
- ✅ **Item 6 (shelves) — DONE and LIVE** (v2.2.2). Source registry: reviewed → their lists → catalog; swappable for the AniList sync.
- ⏳ **ONLY ITEM 3 (Mode 2) REMAINS.** Blake: he wants to clarify some things before it starts. The seven decisions locked 2026-08-09 stand.
- **New floor: `npm test` 387.** webkit 24 · functions 94 held; rules 218 · cf 94 untouched.
- Full record: `docs/SHIP-OUTPUT.md` + the newest `docs/v1.10.0-GATE-LOG.md` entry.

---

## 1. NOTIFICATION SYSTEM OVERHAUL — replace the enter-page UI ✅ BUILT 2026-08-12 (not deployed)

### Blake, verbatim
> "Currently: when users have an item on a watchlist, whenever they first visit the website, they
> see the welcome page. And on that welcome page, after a second or two, is another screen that
> tells them, hey. Some of the things on your watchlist are airing right now, and it gives them a
> list. I wanna completely get rid of that on both mobile and PC. Instead, whenever you click
> enter, you get a new page that says, hey. While you were away, Here are the things on your list
> that are airing, and it straight up says and, like, a notification center. Maybe this page is
> split in two as two separate models. Here's who responded to you. Here's, uh, who messaged you,
> etcetera. And from each of those things, you can click and go to that specific point. So, like,
> for the, uh, anime you're watching, you can click on that anime. It will take you to the anime
> page, whether it be my review or something that's currently airing either one based on, you
> know, whether I reviewed it. And then, again, for notifications, it'll just take you to that
> specific comment, reply, or post and highlight it like it already does. A system like this kind
> of exists. So that's why I wanted to completely get rid of the enter page UI and replace it with
> a brand new, way more cooler and functional UI."

### My reading
- **Kill** the catch-up strip that appears *on* the welcome door a second or two after it opens.
- **Add** a new surface that appears **after Enter is pressed** — a "While you were away" page.
- That page is **two panels** (his word: "models", i.e. modals/panels):
  - **Airing from your list** — watchlist/favourites titles airing now.
  - **Notification centre** — who replied, who messaged, etc.
- Every row is a **link to the exact thing**:
  - an anime → its page; **his review if he's reviewed it, otherwise the currently-airing/deep-dive page** (~~the routing already branches this way~~ — ⚠️ **CORRECTION 2026-08-12: it did NOT.** `openSecondaryFromKey` fired unconditionally, so a reviewed title opened the AniList deep-dive instead of Blake's review. The branch was built this session as `openAiringTarget()`. I wrote this line confidently without reading the function; it would have shipped the bug had the next session trusted it).
  - a notification → the exact comment/reply/post, scrolled to and highlighted (**already exists** — `scrollHighlightNotif` / `parseNotifTarget`).
- He is explicit that **"a system like this kind of exists"** → this is a REBUILD of the surface on top of existing machinery, not new plumbing.

### Code touchpoints already located
- `index.html:898` — `<div id="welcome-catchup" class="welcome-catchup" hidden></div>` ← **the thing to delete**
- `index.html:864` — `#welcome-splash`, the door itself (Enter button is `#welcome-enter`)
- `.welcome-changelog` (`style.css:8681`) — the update log ALSO rides the door; decide whether it stays
- The Lantern (`lantern.js`) already models notifications, unread state and per-type rows
- `parseNotifTarget` / `openNotifTarget` / `scrollHighlightNotif` (`script.js:1780-1875`) — the deep-link + highlight engine, reuse as-is
- ⚠️ **PART A item 3 fought a bug here**: the catch-up strip used to overlap the update log, and the fix was re-homing it INTO the card so it sits in flow. Whatever replaces it must not reintroduce a floating overlay.

### Open questions for Blake
1. After Enter, is this a **full page** you dismiss to reach the Den, or a **panel over** the Den?
2. If a member has **nothing** waiting (no airing titles, no notifications) — skip it entirely and go straight in, or show a friendly empty state?
3. Signed-out visitors have no list and no notifications — do they just go straight to the Den?
4. Does the **update log** stay on the door, move to the new page, or stay where it is?
5. Should it appear **every visit**, once per session, or only when something is actually new?

---

## 2. MOBILE ENHANCEMENTS — the layout differs wildly per phone ✅ BUILT 2026-08-12 (not deployed)

### Blake, verbatim
> "(context: first and second image are from a pixel 10, 3rd image is from a razr flip 8, 4th is
> from an Samsung Galaxy 26 Ultra, 5th is an iphone 15) If you look at all the images, they all
> have vastly different mobile layouts. I want to keep how the mobile page looks on the iPhone
> fifteen for when you enter, but when you actually get to the website, it needs to look more like
> the Pixel ten because I hate how on the Razr eight and the iPhone fifteen that the page looks so
> switched together. But on the Google Pixel ten, the website looks shrunk, and you can actually
> scroll and see several different entries instead of only, like, one or two. So that's just the
> general mobile enhancement I wanna do. Ask if you need any clarifying questions."

### My reading
- **The door (welcome/Enter screen): keep the iPhone 15 look.** He likes it there.
- **The site itself (the Den and beyond): make it look like the Pixel 10** — content **smaller**, so
  **several cards are visible and scrollable** instead of one or two filling the screen.
- The named offenders are the **Razr Flip 8** and the **iPhone 15** once you're past the door —
  "so switched together" reads as *squished/crammed*, i.e. cards too large for the space.
- Net: on phones, the card rails should fit **more entries per screen**.

### Blake's clarification (2026-08-12), verbatim
> "Not sure... But no matter what I like the view he has. Its not just one large oversized card
> looking at me."
> "Whatever achieves that look I gave you."

### ✅ UNBLOCKED — this is now Code's problem, not Blake's
He does not know whether the Pixel is in Desktop-site mode and **has explicitly delegated the
means**: match the LOOK, by whatever route achieves it. So do not go back to him with the
Desktop-mode question — go and measure.

**What the screenshots actually imply (my analysis, to save the next session the work):** the Pixel
capture shows roughly **five cards across**; the iPhone 15 shows two or three, much larger. Mobile
cards are ~275px wide, so five-across cannot be a ~412px phone viewport — the Pixel shot is almost
certainly rendering at a **desktop-width viewport** (Desktop-site mode or a full-page capture).
Which means the honest translation of his ask is:

> **On phones, the cards are too big. Shrink them so several fit and the rail scrolls, instead of
> one oversized card filling the screen.**

That is achievable without desktop mode and without him changing a browser setting.

### ⚠️ The landmine in this item
`mobile.css`'s `.spotlight-stack .card { width: 275px }` is **the fix that made the Top-10 fit
phones at all** (PART A item 4), and CODE-HANDOFF says in terms: *don't "unify" it back into the
fluid grid rule.* Any card-size change here is touching hard-won ground — **measure at 320 / 360 /
375 / 390 / 430 before and after**, and keep the WebKit track (24 tests) green.

⚠️ Also relevant: PART A item 4 re-budgeted the header to the pixel for ≤400px, and the WebKit
track (24 tests, 3 iPhone sizes) pins tap targets, the 16px input floor and every header control
being on-screen. Any card-size change must keep those green — and the 44px tap-target floor and
16px-input rule (which stops iOS zooming the page) are **not** negotiable for aesthetics.

### Remaining open question (minor, does not block)
- The Razr Flip 8 shot — **folded (cover screen) or unfolded?** Affects which width to target for
  that device specifically. Everything else can proceed without him.

### The acceptance test, in his words
> "Its not just one large oversized card looking at me."

If a phone screenshot still shows one oversized card filling the view, it isn't done.

---

## 3. MODE 2 — confirmed

### Blake, verbatim
> "Mode 2 defintely for sure."

### My reading
Build it. The design already exists and is **not** to be re-litigated.

### What's already locked (do NOT reopen — Blake locked these 2026-08-09)
`docs/MODE-2-STUDY.md` is a complete gate-0 study with **seven** decisions:
weekly on **Sunday 2am** · **catalog only**, not the community side · dead streaming links
**always ask, never auto-remove** · Mode 2 **stages, never deploys** · phone and desktop both
first-class with drafts carrying between them · keep an **Excel download** · an explicit
**Publish** button.

Plus his verbatim requirement, already captured in the study's §9 **Season Watch**:
> "Mode 2 also needs to update me on if a new season is released that I need to update my review
> for the whole anime or seasonal reviews."

⚠️ **The non-obvious catch, from the study:** once a new season is detected, the `Seasons` field
must go **propose-only** for that anime — otherwise the site claims coverage Blake hasn't written.

**Its blocker is gone:** the cloud migration it depended on is complete.

---

## 4. ADMIN MENU UI — tiles, not a list ✅ BUILT 2026-08-12 (not deployed)

### Blake, verbatim
> "The current mobile or admin look is that in the bottom left corner, I click a little thing that
> says admin, and all these little things pop up after that. It's getting to the point where I have
> so many things. I have to click on it looks ugly. So instead, what I wanna do is when I click
> admin, eight models pop up, like, rectangles on my screen that look neat. They say what it is in
> a quick description of what it's doing. And I don't want these to be long descriptions that say,
> and you can edit your anime here. They need to be short and sweet to the point, like, edit anime,
> uh, change seasonal reviews. So just the cleanup of the admin page UI. And as we add more models,
> we can, like, scroll down. If if need be, I think we have, like, what, eight options so far. So
> just eight rectangles that look pretty and match the UI."

### My reading
- Replace the vertical text list with a **grid of tiles/rectangles**.
- Each tile: **name + a very short description**. His examples: "edit anime", "change seasonal
  reviews". **Short and sweet** — not sentences.
- **Scrollable** as more tools are added.
- Must **match the site's look** (purple-on-dark glass, the existing brand vocabulary).

### Facts to check against his memory
- He says "bottom left corner" — **correct**; `admin-fab.css:13` moved it left in v1.7.3 to avoid
  the search bar and chat drawer. (I doubted this in chat and was wrong.)
- He says "**eight** options" — there are currently **eleven** live items:
  Add Anime · Edit a Review · Season Reviews · Curator Studio · Curate Cards · Catalog · Quotes ·
  Suggestion Queue · Reports · **Letters** · **Member Stats**.
  The last two are new this run, which likely explains the gap. **Ask whether all eleven stay.**
- The badge counts built this run (suggestions / reports / unread letters) must survive the
  redesign — they live on the menu items.

### Open questions for Blake
1. All **eleven** tools stay, or should some be dropped/merged?
2. Tiles on **desktop too**, or is this a mobile-only complaint?
3. Do you want **icons** on the tiles, or text only?

---

## 6. SHELF BUILDING — autopopulate from what they've already watched ✅ SHIPPED v2.2.2

### Blake, verbatim (2026-08-12)
> "Watchlist tracker needs to autopopulic FIRSTly with things the user has either watched or
> already reviewed when building shelves. it makes the most logical sense."

### My reading
When a member is **building a shelf** (the collection add-picker), it should lead with the titles
they have **already watched or already reviewed** — not open cold on the whole catalog. Their own
history is the most likely source of what they want on a shelf, so it goes first.

### My reading of the ordering (confirm before building)
1. Anime they have **reviewed** (strongest signal — they finished it and had opinions)
2. Anime on their **watchlist / marked watched**
3. Everything else / free search (today's behaviour)

### Why this matters more than it looks
This is **the same seam as item 5's sync**. If AniList linking ever lands, "things you've watched"
stops being just this site's watchlist and becomes their real completed list — and this picker is
exactly where the research says it should surface ("12 completed titles from your AniList — add any
to a shelf?"). **Build the picker so its source list is swappable**, and the sync feature later
plugs straight in instead of needing a second picker.

### Code touchpoint
`account.js` — the collections add-picker (`.col-adder` / `col-adder-list`, style.css ~10703).

---

## 5. APP / STREAMING SUPPORT — research pending

### Blake, verbatim
> "is it possible to have the website connect to my crunchyroll account (and eventaully other
> peoples) to be able to save and autatically update what they are watching, save their
> crunchylists and update in real time and then be able to prompt users to write a review on an
> anime they just finished? ... Not just crunchyroll eventually netflix, hulu, hidive etc. I just
> want users to be able to link information with their animes"
> "also note for how creating lists for users work."
> "Plus looking into the app supports"

### RESEARCH COMPLETE (2026-08-12) — five lanes, each adversarially re-checked

**The Crunchyroll half is CLOSED. Everything else he asked for is buildable.**

- **Crunchyroll: no.** No developer programme, no "Log in with Crunchyroll", no application to
  fill in. The only third party ever granted a real account link is Discord, via a corporate deal.
  Netflix killed its public API in 2014 and never replaced it; Hulu, Disney+, HIDIVE, Prime are the
  same or worse. **No major streamer offers user-level OAuth to third parties for viewing data.**
- **The unofficial routes are refused, not merely risky.** They need the member's actual password
  or a session token dug out of devtools. Both breach Crunchyroll's terms (no credential sharing;
  they may cancel a paid account "for any reason"), both endanger a member's paid subscription, and
  asking an anime fan to type their Crunchyroll password into this site is indistinguishable from a
  phishing page. ⚠️ Crunchyroll itself settled a **$16M class action** over leaking viewing data,
  and was sued again March 2026 — storing what people watched is regulated even at hobby scale.

**THE KEY IDEA — connect to the thing that already knows.** Members already use trackers
(**AniList**, MyAnimeList, **Simkl**) which *want* third-party connections. Registering an AniList
app takes minutes, costs nothing, needs no approval. And a bridge from Crunchyroll into those
trackers already exists, maintained by other people: **MAL-Sync** (70k+ users) and Simkl's own
extension. Chain: **Crunchyroll → (someone else's extension) → tracker → this site.** We never
touch Crunchyroll and never see a streaming password. For live-action, **Trakt** has built-in
Netflix/Hulu/Disney+/Prime sync configured in Trakt's own app (does NOT cover Crunchyroll/HIDIVE).

**What that honestly delivers:** auto-update what they're watching ✓ · detect
watching→completed and prompt for a review ✓ (the strongest part) · **"real time" ✗** — nobody in
the chain offers push, so poll every ~15 min, which is fine for "you finished this yesterday" ·
**Crunchylists specifically: UNVERIFIED** — the bridges carry watch *history*; treat list import as
unproven · members who watch only on the CR phone app or a console and install nothing get nothing,
**so always keep a manual "mark as finished" button.**

**⚠️ Known traps:** AniList tokens last **one year with no auto-renew** — build "reconnect" from
day one or the feature dies silently in twelve months; tokens have **no permission scoping**, so
store them server-side ONLY. AniList terms have a competing-service clause with an explicit
exception for real syncing — send a courtesy email to contact@anilist.co and keep the reply.
AniList is currently at **30 req/min** (reduced from 90). **Skip MyAnimeList** — its developer
agreement forbids storing user list data on our server. **Skip Kitsu** — login requires collecting
the user's actual password. Keep analytics/ad pixels OFF any page showing viewing history; that
combination is exactly what the lawsuits target.

**Recommended first step (small and provable):** build ONE thing — *"Connect your AniList
account."* Pull their list once, poll every 15 min, and when something flips to completed show
"You finished this — write a review?" No Crunchyroll, no extensions, no Simkl/Trakt in v1. It's
free, needs no approval, and **uses the AniList IDs this site already has**. If it works, a help
page pointing members at MAL-Sync makes their Crunchyroll viewing flow in by itself — and the
feature looks like Crunchyroll integration without us having built any.

*This is research, not legal advice.*

### How lists would work (his "note for how creating lists for users work")
Keep **shelves** as the thing members hand-build and show off. A synced tracker list is a different
animal and mixing them will confuse people:
- **Watch status** (watching / completed / dropped + episode count) comes from the tracker, is
  **read-only** here, and drives exactly one thing: the review prompt. It is data, not a collection.
- **Shelves stay hand-made.** Sync only offers a shortcut — "12 completed titles from your AniList,
  add any to a shelf?" They pick. **Nothing is ever auto-dumped into a shelf.**
- **Default everything synced to PRIVATE.** A public "currently watching" feed is precisely the
  fact pattern in the viewing-privacy lawsuits — separate, off-by-default opt-in, never bundled
  into the "connect account" button.
- **"Disconnect" is its own button**, distinct from deleting the account: revoke the link, delete
  the imported history, keep their reviews and shelves. (This lands on top of the item-7 deletion
  policy already shipped.)
- **Show "last synced: 2 hours ago."** When a member's extension silently breaks after a
  Crunchyroll redesign, the site just keeps seeing "no new data" and nobody notices. That one line
  prevents most of the support load.

⚠️ If this becomes a build, this project's own rule applies: **a genuinely new feature run gets its
own gate-0 design study first**, not code.

---

## Sequencing — my recommendation, not a decision
1. **Notification overhaul** (item 1) — most user-visible, and the machinery already exists.
2. **Admin menu tiles** (item 4) — self-contained, low risk, immediate quality-of-life for Blake.
3. **Mobile** (item 2) — **only after the clarifying questions are answered.**
4. **Mode 2** (item 3) — the biggest, and it deserves its own run.

Items 1 and 4 could share a session. Mode 2 should not share one with anything.
