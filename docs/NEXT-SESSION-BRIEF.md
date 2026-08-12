<!-- author: Code | date: 2026-08-12 -->
# NEXT SESSION — Blake's banked brief

> Captured live from Blake on 2026-08-12, at his instruction ("Things I want to bank for next
> session"). **His words are quoted verbatim** — his phrasing carries the requirement, and every
> time this project has gone sideways it was because a session guessed at what he meant.
> My reading of each is marked separately, and my open questions are at the bottom of each item.
> **Do not treat my reading as his decision.**
>
> State when banked: **v2.1.0 LIVE**, Part A complete, patch queue items 2/3/5 shipped,
> 7 partial, 4 closed-as-deliberate, 6 (comment-list) being done at the end of the banking session.
> Floors: npm test 365 · rules 218 · cf 94 · functions 94 · webkit 24.

---

## 1. NOTIFICATION SYSTEM OVERHAUL — replace the enter-page UI

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
  - an anime → its page; **his review if he's reviewed it, otherwise the currently-airing/deep-dive page** (the routing already branches this way).
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

## 2. MOBILE ENHANCEMENTS — the layout differs wildly per phone

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

### ⚠️ Do NOT start this without answering the questions below
The five screenshots are at different capture scales, so I **cannot** tell from them alone whether
the Pixel 10 is genuinely rendering a narrower CSS layout or whether that browser is in
**"Desktop site" mode** (which would explain "looks shrunk" exactly). Guessing here would mean
rebuilding the phone layout against a target that isn't real.

⚠️ Also relevant: PART A item 4 re-budgeted the header to the pixel for ≤400px, and the WebKit
track (24 tests, 3 iPhone sizes) pins tap targets, the 16px input floor and every header control
being on-screen. Any card-size change must keep those green — and the 44px tap-target floor and
16px-input rule (which stops iOS zooming the page) are **not** negotiable for aesthetics.

### Open questions for Blake
1. **Is the Pixel 10's Chrome set to "Desktop site"?** (Menu → tick "Desktop site".) This is the
   single most important question — it decides whether this is a CSS job or a non-issue.
2. When you say the Pixel looks right — do you mean **more cards per row**, or **the same rail with
   smaller cards you scroll through faster**?
3. The Razr Flip 8 — is that screenshot the phone **folded (cover screen)** or **unfolded**?
4. Is it just the **card rails**, or does everything (headings, spacing, text) need to come down a size?

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

## 4. ADMIN MENU UI — tiles, not a list

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

## 5. APP / STREAMING SUPPORT — research pending

### Blake, verbatim
> "is it possible to have the website connect to my crunchyroll account (and eventaully other
> peoples) to be able to save and autatically update what they are watching, save their
> crunchylists and update in real time and then be able to prompt users to write a review on an
> anime they just finished? ... Not just crunchyroll eventually netflix, hulu, hidive etc. I just
> want users to be able to link information with their animes"
> "also note for how creating lists for users work."
> "Plus looking into the app supports"

### Status
A five-lane research pass (Crunchyroll · other streamers · anime trackers · scrobbler bridges ·
legal/privacy), each adversarially re-checked, was running when this brief was written.
**Its findings are not in this file yet — read them before scoping anything here.**

⚠️ If this becomes a build, this project's own rule applies: **a genuinely new feature run gets its
own gate-0 design study first**, not code.

---

## Sequencing — my recommendation, not a decision
1. **Notification overhaul** (item 1) — most user-visible, and the machinery already exists.
2. **Admin menu tiles** (item 4) — self-contained, low risk, immediate quality-of-life for Blake.
3. **Mobile** (item 2) — **only after the clarifying questions are answered.**
4. **Mode 2** (item 3) — the biggest, and it deserves its own run.

Items 1 and 4 could share a session. Mode 2 should not share one with anything.
