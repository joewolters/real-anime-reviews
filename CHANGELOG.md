# Changelog

All notable changes to Real Anime Reviews, newest first. Versions follow [SemVer](https://semver.org/) (MAJOR.MINOR.PATCH):

- **MAJOR** — milestone or structural shift
- **MINOR** — new features that don't break existing behavior
- **PATCH** — small fixes, content updates, tweaks

For what's coming next, see [ROADMAP.md](ROADMAP.md).

## ⚡ READ-FIRST
- This is the FULL version history, newest-first — a DEEP-REFERENCE archive (~870 lines), NOT onboarding reading. For the CURRENT ship's state read `docs/CODE-HANDOFF.md`; for what's next read `ROADMAP.md` + `docs/NEXT.md`.
- **Open this only to read a specific past version** — search for its `## vX.Y.Z` heading. Do NOT read top-to-bottom.
- This file + git = the authoritative shipped record; the site's runtime "Update Log" widget mirrors it (project rule #6).

> ⛔ DEEP REFERENCE BELOW — do NOT read top-to-bottom. Open a section ONLY if you're stuck on that specific thing.

### Jump-to (only if stuck)
- **The version entries (`## vX.Y.Z — TIER (date)`, newest first)** — search the exact version you need; each is a self-contained per-ship record.

---

<!-- author: Code | date: 2026-08-13 -->
## v2.2.5 — PATCH (2026-08-13)

**The site opens on the Den again.** If your browser reopens tabs exactly where you left them, you could land straight in the full card grid rather than the front page — that grid is a tool you choose to open, not somewhere you should arrive. Every real link still goes where it points: an anime, a profile, a thread, a notification.

**The account page is readable on a phone.** Its tabs sat in a sideways-scrolling strip that cut labels off mid-word — "Favorites" appeared as "Favor" — which was most of why the page felt cramped. They are now an even grid of tiles, the same shape as the admin menu, with nothing clipped, a proper tap size on every one, and consistent spacing down the rest of the page: tighter cards, an even colour picker instead of a ragged one, and room at the bottom so the admin button stops covering the last row.

**A way to check sign-in problems.** If signing in fails on your phone, add `?authcheck=1` to the address. The page will tell you where it is keeping your session, whether your browser is allowing site data at all, and whether you are currently signed in — enough to say what is wrong instead of guessing.

---

<!-- author: Code | date: 2026-08-12 -->
## v2.2.4 — PATCH (2026-08-12)

**Fixes a page that loaded but did nothing.** The previous release could leave the site half-alive for anyone whose browser was holding an older copy of one particular file: the page itself appeared, but nothing on it loaded and the account page was unreachable. The cause was ours — that release started asking one shared file for something only its newest version provides, and browsers are allowed to keep an older copy of that file for an hour. When the two didn't match, the page's main script stopped before it began. The request has been withdrawn, and the handful of files this applies to are no longer allowed to go stale, so the same mistake cannot have the same effect again.

**Updates arrive straight away now.** Separately, every release had been sitting behind an hour of browser caching before anyone saw it — and because the page is what points at the current styles and scripts, a cached page also asked for the *previous* release's files. Pages now check for a newer version on every visit, which is why this fix reaches you immediately.

---

<!-- author: Code | date: 2026-08-12 -->
## v2.2.3 — PATCH (2026-08-12)

**Staying signed in on a phone.** This site was keeping your session in a browser store that privacy-focused browsers block, partition or wipe — and when that store is unavailable the sign-in library quietly falls back to keeping the session in memory only, where it does not survive moving to another page. The result, from the outside, was a sign-in that was accepted and then instantly forgotten: you pressed the button, landed back on the home page, and were still signed out, with nothing to tell you why. The session is now written somewhere those browsers allow, chosen explicitly rather than left to a default, and if a browser refuses every option the site says so in the sign-in box instead of closing it and pretending the sign-in worked.

**"Incorrect email or password" now tells you where to look.** On a phone the usual cause is not the password — it is the browser filling a *different* saved address into the email box, which you would never notice unless something told you to check. The message now does.

---

<!-- author: Code | date: 2026-08-12 -->
## v2.2.2 — PATCH (2026-08-12)

**Signing in tells you what happened.** The previous release stopped your phone filling your saved login into a hidden field, but it left a worse failure behind: if what you typed — or what your password manager filled — wasn't shaped like an email address, the form quietly did nothing at all. No error, no response, nothing to act on. That was ours, and it's gone. Every attempt now answers, the answer appears where you can see it rather than below the fold of a scrolling panel, and an unexpected failure names itself so it can be reported in one line.

**Building a shelf starts with what you've already seen.** The add-anime picker leads with the anime *you have reviewed*, then the ones on your lists, then everything else, in labelled groups instead of one long alphabetical run — because your next shelf entry is far more likely to come from what you've already watched than from the middle of the catalogue. A title you've reviewed that's also on the site appears once, at the top, with its cover.

**Anime By Genre reaches the edge of the screen.** On a phone it was penned inside a frame with wide margins on both sides — a small box floating in the middle of the page rather than a rail. It now runs the full width, like the others.

**Less oversized everywhere else on phones.** Latest Drop was taking roughly four fifths of the screen for one title and is now a cover beside its text. The Top-10 card scales with the screen rather than sitting at a fixed size — the same card is a reasonable share of a large phone and most of a small one. Continue Where You Left Off, and the results after you press Enter on a search, are now sized like everything else; both had been missed because they were built from a different container.

---

<!-- author: Code | date: 2026-08-12 -->
## v2.2.1 — PATCH (2026-08-12)

**Signing in on an iPhone works now.** If your phone offered to fill in your saved login, it was putting it into a field this page kept hidden — so the box you could actually see stayed empty, and the site answered that your email or password was wrong when it wasn't. The same details always worked on a computer, which is exactly what made it so confusing. The cause was ours: the form told password managers that the hidden field was the account name, and iOS believed it. The visible email box is now the one your password manager fills, the hidden field is switched off entirely while it's out of sight, and the email box no longer lets autocorrect edit what you typed.

**The rest of the site caught up on phones.** The previous release shrank the cards in the home rails, but only there — the anime-by-genre rows further down the Den, and the results you get from the search box, were still at their desktop size, with a single card taking about three quarters of the screen. Card sizing is now one rule that applies everywhere rather than a list of places somebody has to remember to extend, so those surfaces match the rest, and search results sit three across instead of two.

**The Tavern reads tighter on a phone.** Thread cards and posts carry less padding and chrome. The writing itself is unchanged in size — a thread you have to squint at is not an improvement.

**The Top-10 is deliberately untouched** and keeps its full-size card, as it did before.

---

<!-- author: Code | date: 2026-08-12 -->
## v2.2.0 — MINOR (2026-08-12)

**"While you were away."** The welcome door used to interrupt itself: a second or so after it opened, a strip appeared over it listing what you'd missed. That's gone entirely, on phones and on desktop. Press *Enter* and you land on a proper page instead — what's airing from your watchlist on one side, who replied to you and who wrote to you on the other, and anything newly reviewed across the top. Every row goes to that exact anime or that exact comment, scrolled to and highlighted. If nothing is waiting for you, the page doesn't appear at all and you go straight in; nobody gets made to click through a screen telling them there's nothing.

**An anime from your list opens the right page now.** Clicking a title in that airing list takes you to the full review when one exists, and to the currently-airing page when it doesn't. Until now it always did the second — so a title that *had* been reviewed still sent you to the generic page instead of the review.

**Phones show more, not less.** Every card in the home rails was a fixed size — the same card on a 320px phone as on a 1440px monitor. That meant one card could occupy about two thirds of the screen and you'd see one or two at a time. Cards are now sized for the screen they're on, so several fit and scroll, and long titles no longer stretch a card to five lines. The Top-10 spotlight deliberately keeps its full-size card.

**Search reaches past the reviews.** Looking something up in the box at the top used to search the reviews here and stop. Now the reviews come first and everything else that matches follows underneath, under *Not reviewed yet*, each clearly marked. It appears even when nothing here matches at all — which is precisely the search where it was missing.

**Admin.** The admin menu is a scrolling grid of tiles, each with a short line saying what it does, centred on the screen on desktop. It had no height limit before, so at eleven tools it ran off the top of the screen — and every tool added made that worse.

---

<!-- author: Code | date: 2026-08-12 -->
## v2.1.1 — PATCH (2026-08-12)

**Your half-written reply stops disappearing.** Until now, every time anything changed in a comment section — someone posting, someone voting, a sort changing — the whole list was thrown away and rebuilt. So if you were partway through writing a reply and somebody else commented, your text vanished and your open reply panel snapped shut. The list now updates only the rows that actually changed and leaves everything else exactly where it was, including whatever you're typing and where your cursor is.

**The search box has its ✕ back.** The header search filters as you type, and an earlier change had removed the only way to clear it without selecting the text and deleting it. It's there again whenever there's something to clear — and deliberately stays out of the way on the narrowest phones, where the box needs every pixel for your actual words.

**Smaller things.** Review notifications now find their target even when a rating filter is hiding it. Behind the scenes, two admin pages that had grown their own private copies of the same pop-up dialog now share one, and the admin menu shows counts for new suggestions, open reports and unread letters.

---

<!-- author: Code | date: 2026-08-10 -->
## v2.1.0 — MINOR (2026-08-10)

**You can delete your account.** It's in your settings, at the bottom, under *Leaving*. It happens straight away — there's no quiet waiting period where the site keeps your things after you've asked it to stop. What goes: everything you wrote, your name on it, your pictures, your profile, your shelves, your votes. What stays: the empty slot where a comment or review used to be, reading *[removed by the author]* — because that's the only way the replies underneath it still make sense. Letters are closed rather than destroyed; half of every conversation belongs to the other person.

**Nobody else loses their words when someone leaves.** This is the part that matters. Until now, a member deleting their account took their forum thread with them — and a thread takes every reply inside it, from everyone. The same for replies under their comment and discussion under their review. People who had done nothing would have lost writing because somebody else quit. It also flatly contradicted what this site already tells you when you visit a departed member's page: *what they shared lives where they posted it.* Now it does.

**Two related fixes, said plainly.** Deleting an account used to be possible from a browser's developer console with no password check and no confirmation — no button on the site did it, but the door was open. It's shut. And while proving the new deletion worked, a second problem surfaced in the code that blanks a departing member's posts: it could recreate documents that had just been deleted, leaving empty entries nobody wrote. Also fixed.

**Profiles don't drown in reviews any more.** Your pinned review leads the page, and everything else lives behind one **all reviews** button that opens the full list. The list is shareable — copy the address bar while it's open and the link lands there.

**iPhone and Safari, properly this time.** The whole responsive rebuild had only ever been tested in one browser, which hid four real bugs. The worst: on any phone narrower than about 390 pixels — including the iPhone SE — the account button sat entirely off the edge of the screen, so **signing in was impossible**. Also fixed: tapping a filter box zoomed the entire page (that "bloated" feeling), the search placeholder rendered clipped mid-word, and buttons throughout the header were too small to hit reliably. All measured on three iPhone sizes, which now have their own permanent test run.

**A profile bug that had no workaround.** Members who joined before profiles existed could never save their profile — every attempt failed silently and told them to wait and try again, forever. The cause was an avatar address copied in from the old account system that the site's own rules then refused to accept. Their next save now fixes itself; nothing for them to do.

**Smaller things.** The comic quote bubbles no longer appear on phones. The catch-up strip stopped overlapping the update log. The last four plain dropdowns became branded ones. The profile editor's heading is *Your Corner* instead of a second *Your Constellation*. And the header search bar, which grew to sixty percent of the screen on tablets and small laptops, is proportional again at every width.

**Behind the scenes.** The anime catalog finished moving out of a spreadsheet and into a proper database with per-field history and one-click undo, and there's a new admin page for member counts. Nothing there changes what you see.

---

<!-- author: Code | date: 2026-08-09 -->
## v2.0.1 — PATCH (2026-08-09)

**Four reviews come home.** Back in December Blake rewrote most of his reviews; in May a sync quietly replaced some of that work with older, shorter text, and nobody noticed for two months. A full forensic pass over every snapshot the project has — git, 42 Excel backups, the old text export, the web archive — found exactly which ones were lost and put them back: **Rascal Does Not Dream of Bunny Girl Senpai** (213 → 710 characters), **An Archdemon's Dilemma** (112 → 337), **Attack on Titan** and **Demon Slayer**. Attack on Titan keeps its "top 3 anime" opening, Blake's call. Two candidates that *looked* recoverable turned out to be corrupt editor scaffolding and were left alone — the versions on the site were already the good ones.

**So it can't happen again.** Publishing now refuses to ship a material shrink in review text: the exact May regression, replayed against the new guard, is stopped with the review named and the character count shown. Behind the scenes the anime catalog also now exists as a proper database with per-field history and one-click undo, proven to reproduce the site's data file byte-for-byte, plus an admin editor that works from a phone. None of that is visitor-facing yet — the site still reads the same static file it always has.

<!-- author: Code | date: 2026-07-04 -->
## v2.0.0 — MAJOR (2026-07-04)

**The mega-run lands.** One directive — *"everything must work. It should be intuitive."* — carried through seven milestones, seven adversarial panels, and one long week. The site's biggest single ship, and it reads like three ships wearing one coat:

**The messaging era.** Members can finally write to each other. Peer letters are request-first — a stranger's first message is a quiet knock, never a flood; decline is silent; blocks are real and enforced at the rules layer. Group letters hold up to 15 people. Images ride the full moderation pipeline and stay **sealed until you accept** — the URL is never even fetched before then. Everything lands in the Letter Room, one inbox where Blake's letters are gold by identity and everyone else's are the community's purple. Every message is reportable with the evidence attached.

**The site becomes an app.** One composer everywhere — bold, italic, spoiler boxes, and links render live as you type, in every box on the site (and this release kills the spoiler trap for good: the box lets you leave by every door, and what you hide is exactly what stays hidden for readers). Every view — card, season, deep-dive character, thread, profile — has a real URL you can share, and the Back button retraces your actual steps. Link previews wear the door. The whole layout was rebuilt to hold from a 320px phone to an ultrawide, including the Top-10 spotlight that used to bury its own heading at phone widths.

**The curator's house.** The Curator Studio: track any anime — in the catalog or far outside it — set a live status that breathes on the cards ("BLAKE IS WATCHING"), keep private notes in a nine-section editor, and publish them straight into a pre-filled review. The Den carries the watching line. Discover gained Hidden Gems and the honest yellow tape — 「 NOT REVIEWED — Blake hasn't watched this one yet 」 — with a live community room on every title, reviewed or not. Profiles grew shelves (public, private, one **featured** shelf leading the page — now one click on the card itself), frames, backgrounds, and the Constellation: every member's year drawn as a night sky, one gold star for the day they joined.

Under it all: member emails went private (the users-GET tightening + the profiles backfill), the de-Blake sweep moved his name out of the wallpaper and kept it only where identity is the point, and Black Clover finally reads **friendly-rivalry** — one tag, his call. Floors at ship: Playwright 285 · rules 204 · functions 77 · triggers 78 · e2e 25.

<!-- author: Code | date: 2026-07-02 -->
## v1.10.2 — MINOR (2026-07-02)

**The Creator profile + a fully working admin.** Blake's clarified spec replaced the staged gold-showcase design before it ever deployed: his profile is now a MEMBER sheet — his own Studio choices (accent, frame, background, bio, tags, status, pinned review), nothing imposed — rendering wherever a member's would, and the ONE difference is the gold **CREATOR 創り手** kicker where members wear purple MEMBER 旅人. By his explicit call (*"I want my account to be appreicated."*) the **Appreciate button + count now ride his sheet like any member's** — the rules' like-on-Blake denial is gone and the carve-out count extends to him, purple like everyone's (self-like stays denied for all). The no-report guard stays (nobody reports the owner to the owner), the rules' reserved-name carve-out stays (the real Blake saves; impersonators bounce), and the gold Visit-the-Den door, the forced Den Keeper frame default, and the suppressed Reviews tab all left with the old spec (the Den Keeper frame stays his alone — optional, never forced). The account page keeps the full **View All · Random · Filter** nav.

**Member-reported prod bugs, dead at the root:**
- **The pinned-review picker crushed its rows** — a flex min-height collapse (`overflow:hidden` on the options zeroed their minimum, so 60 rows squeezed into the 300px menu at ~3px each). One rule fixes every brand-select menu: options never flex-shrink; the menu scrolls.
- **Admin nav 404s** (`/admin/admin/quotes.html`) — the Admin FAB's relative hrefs doubled under `/admin/` pages. All destinations are root-absolute now, spec-pinned.
- **The suggestion queue** — rows now expand to a detail view (requester name resolved from `submitterUid` via profiles→users, "Anonymous" for pre-v1.10.0 docs, the FULL request text, submitted date, AniList fields), keyboard-accessible; the NEW-badge clipping is root-fixed (`flex-wrap` on the meta strip) along with the mobile "ADD THIS ANIM" button truncation.

**Admin honesty pass (the pages must say what needs Mode 1):** the quotes + season-reviews banners now say plainly what works on the live site vs what needs the desktop server; the Add-Anime page shows which mode it's in; the ✨ASK drawer explains it needs Mode 1 instead of erroring raw — and its copy no longer names the AI provider (the same no-provider-names rule the visitor pages follow).

**The Mode-1 desktop launcher works like an app now (third report, root causes found):** the server never opened a browser (a working start looked like nothing happened) and a second double-click died on a raw port collision. Now: double-click → greeting banner → the browser opens to Mode 1 by itself; a second double-click detects the running server and just opens the browser to it; every failure path prints plain English and pauses. Verified on real double-click semantics, twice over.

Tests: Playwright 229 · rules 157 · functions 77 · cf 67 · e2e 16 — the g29 specs re-pinned to the clarified Creator spec (Appreciate ON), the rules reversal tested both ways, new g30 specs pin every member-reported bug at the root.

<!-- author: Code | date: 2026-06-11 -->
## v1.10.1 — PATCH (2026-06-11)

**Hotfix: image uploads unlocked + honest error messages.** Blake's prod verify caught two live bugs. (1) Every image upload (backgrounds, post images) was being denied: the Storage rules read consent/kill-switch state from Firestore, and the cross-service permission that read requires never landed during the cutover's storage deploy — the emulator needs no such grant, so all 154 rules tests stayed green while prod denied everyone. This ship's storage.rules carries the documentation block (and forces the ruleset re-upload that triggers the CLI's grant hook). (2) The failure copy lied: the background path blamed the consent gate and said "Hit Save again" forever, and the Tavern composer rendered a RAW SDK error — provider name and internal path — on screen. A new shared `friendly-errors.js` module now owns every failure message: truthful splits (verify-your-email vs site-side lock vs connection), branded copy only, the raw error to the console. All ~30 visitor-facing failure sinks across both pages route through it, spec-pinned so no provider-named or internal-path string can ever render again.

<!-- author: Code | date: 2026-06-11 -->
## v1.10.0 — MINOR (2026-06-11)

**Overhaul: the Community Hub.** The community era — a full forum (The Tavern), a real moderation spine (community rules, reports, bans), an image pipeline with locked-down Storage, public member profiles with deep customization, DM-Blake messaging, rooms on every season, and a notification system that catches you up on what you missed. Built across 26 staged gates, adversarially reviewed each round, and shipped in one cutover: indexes → hosting → firestore rules → storage rules → functions.

**Visitor-facing:**

- **The Tavern** — a real community forum: threads with tags, replies (including reply-to-reply chains), helpful votes, Hot/New/Top sorting, and a "Rising" rail. Threads about an anime carry Blake's gold verdict rail; the rest is the community's purple room.
- **Public profiles** — click any member's name or avatar to see their card: bio, tags, status, their threads and reviews. Customize your own with 16 accent colors (6 true gradients), a glow, 13 frame themes, a profile background with a real cropper, and a featured-anime pin. Blake's name leads home to the Den — and The Den Keeper frame is his alone, locked in the security rules themselves.
- **Images in posts** — attach images to comments, replies, reviews, and Tavern posts: inline placement, a lightbox, EXIF-stripped uploads, and a 5 MB cap. Every image can be reported.
- **Rooms everywhere** — every season's deep-dive carries a discussion room, in Blake's voice when he hasn't reviewed it yet.
- **DM Blake** — a private letter to the host from your account's Inbox tab; his replies land in your lantern in gold.
- **The lantern grew letters** — the notification lantern catches you up: a WHILE-YOU-WERE-AWAY strip on the welcome door (and after any sign-in), opening a full catch-up sheet of new reviews, your unread letters, and your watchlist's airing titles.
- **Request an anime** — the suggestion page now carries a search-and-pick flow; a "👁 requested" chip shows demand under a title's cover, and when Blake reviews it, the requester gets a gold letter.
- **Spoiler tags** — `||spoiler||` works in every composer; spoilers render blurred until tapped.
- **Community rules + reporting** — one "I agree" before your first post; report any comment, review, post, image, or profile in two taps. Blake moderates everything himself.
- **Composer identity** — every composer chip shows your own avatar; your face follows your posts live across the whole site.

**Under the hood:** a `moderationGate` consent/ban spine on every write rule; Cloud Functions own all counts, notifications, suggestion rollups, image validation (magic-byte + EXIF strip), storage sweepers, and the ban cascade; default-deny Storage rules with an uploads kill-switch; public `profiles/` identity docs (profiles-first author reads); composite indexes for the forum and profile queries; `?v=` cache-busting extended to the once-bare module imports; the practice sandbox now routes extensionless URLs like prod and seeds deterministic demo state.

<!-- author: Code | date: 2026-06-08 -->
## v1.9.1 — MINOR (2026-06-08)

**Composer redesign + community polish.** The comment and review composers are rebuilt with a real formatting toolbar, a live styled preview, and keyboard shortcuts; reviewers can filter to their own review; and two live bugs are fixed (the season label and the review-notification scroll-to-highlight). All client-side — a hosting-only ship.

**Visitor-facing:**

- **Rebuilt comment + review composers** — a B / I / link toolbar, Ctrl/⌘+B/I shortcuts, a live preview that renders your formatting as you type, and Enter-to-post (Ctrl/⌘+Enter on the long-form review). The toolbar hides when signed out.
- **"My review" filter** — isolate your own review on any anime's community list.
- **Season label fix** — the "airing now" dateline now derives the current season from today's date (Spring 2026 · 春) and self-rolls each month, instead of showing a stale season.
- **Review-notification halo** — a "found your review helpful" notification now scrolls to AND visibly highlights the exact review (it was opening the anime, but the highlight was clipped invisible).

**Under the hood:**

- New `composer-toolbar.js` (`window.RarComposer`) shared by the review / comment / reply / discussion composers; reuses the markdown renderer (XSS-safe, escape-first) and the section-editor `wrap()` primitive. No rules / functions / schema touched.
- Self-rolling `currentSeasonInfo(date)` helper (anime broadcast-season convention: Jan–Mar WINTER, Apr–Jun SPRING, Jul–Sep SUMMER, Oct–Dec FALL).
- Sticky review deep-link that survives the review list's per-snapshot rebuild; the halo now lands on the `.review-row` itself (its own box-shadow isn't clipped by the row's `overflow:hidden` — the cause of the invisible halo).
- Tests: `npm test` 104 (added season-label + composer specs); the emulator deep-link e2e rewritten to assert the halo's painted box-shadow (visibility), not class presence.

<!-- author: Code | date: 2026-06-08 -->
## v1.9.0 — MINOR (2026-06-08)

**Community Overhaul.** The site gains a real community layer — comments, reviews, and a notification center — while Blake's voice stays the unmistakable center (his rating leads; gold is his alone, community is purple).

**Visitor-facing:**

- **Comments + replies** on every anime: write in markdown, like the ones you find helpful, and sort by Top / Newest / Most-helpful. Threaded one level deep.
- **Community reviews:** leave a full review with a rating, mark others' reviews Helpful or Not-helpful, and see the spread on a rating histogram — purple bars for the community, a single gold tick for Blake's score, which always leads above it.
- **The Lantern** — a notification center in the header. It glows gold when Blake himself pings you and a cooler purple for community activity, lights unread items until you read them, and takes you straight to the exact comment when you tap a notification. On both the home and account pages.
- **A composed header rail** (search · the Lantern · your head/avatar) with the real navigation now on the account page too.

**Under the hood:**

- All vote counts and cross-user notifications are now written by the server (Cloud Functions), closing a notification-spoofing hole — the browser only records your own vote.
- New security rules for every community surface, plus new database indexes.
- An internal-docs exposure fix (some project notes were reachable on the public site; no user data was ever involved).

**Known issue (fix coming):** a notification that points at a *review* doesn't always scroll you to the exact review yet.

<!-- author: Code | date: 2026-06-06 -->
## v1.8.4 — MINOR (2026-06-06)

**Discovery & Blend.** The biggest visitor-facing expansion yet — the site grew from a personal catalog into a *blended* one. Blake's 44 hand-written reviews still lead, but the wider world of anime now sits alongside them, always clearly marked as the supporting cast. New **For You** and **Discover** places, a real navigation, a composed homepage, and a site-wide "constellation veil" that lifts as you move outward.

**Visitor-facing:**

- **Discover — the wider world.** A new place to search every anime out there. Live search-as-you-type surfaces results instantly; the ones **Blake's reviewed light up gold** and pin to the front, while everything else carries a clear **NOT REVIEWED** sticker and the community's score. Plus rails for what's **airing now**, **airing by genre**, and what's **popular right now**, all gently auto-drifting — with a fresh shuffle each time you log on.
- **For You — his shelf, leaning your way.** Signed in, a personalized place where Blake's gold reviews lead each rail, pulled toward the genres you keep saving, with the wider world filling in behind. Signed out, an honest "what the world's watching" taster with a nudge to sign in.
- **Open any outside anime for free.** Every not-yet-reviewed title opens a full detail view — synopsis, characters, staff, where to watch — and a one-tap **Request this anime** so you can ask Blake to cover it. Save anything to your watchlist or favorites, reviewed or not.
- **A real navigation.** The header now has three named places — **Blake's Den · For You · Discover** — with a sliding gold marker that tracks where you are; the Den is the home you always glide back to.
- **A composed homepage.** Below the Den masthead: an **AIRING NOW** strip (a glimpse of the wider world), a **For You** teaser, and the **Top 10** and **Latest Drop** redesigned to sit side-by-side as a matched pair.
- **A living background.** A translucent "constellation veil" of etched line-work now sits over the city backdrop site-wide — darkest and coziest in the Den, opening up as you step out toward Discover, so the journey feels like one room breathing. The lines **gently pulse** with a slow travelling glow.
- **A deep-dive hint.** A quiet once-per-visit pill teaches that the seasons in an anime's More-Info panel open a richer detail view.
- **The update log, restyled.** It now lives on the welcome door, and each update is its own group set off by a colored rail and a plain-English tier label (Minor / Big Update).

**Behind the scenes:**

- **Admin:** a new **Quotes** page to curate the welcome-door quotes from a UI — add / edit / delete, drag or ▲▼ to reorder, live search, a duplicate-and-length check, and the ✨ ASK assistant built in. The quotes now live in a small public file the door reads at runtime.
- All new motion is reduced-motion-aware (the veil pulse falls back to a static glow; drag + reveals are instant). **No streaming-provider names** appear anywhere in the visitor copy — the wider world is described in Blake's voice. The live anime data rides three lean queries on a shared cache, so the homepage's first paint stays fast (the Den is local).

**Implementation files:** `franchise-fetch.js` (3 additive flat AniList queries), `script.js` (the Discover + For-You surfaces, the taste engine, the blended cards, the real nav + sliding marker, the composed homepage, the veil-pulse init, the quotes fetch, the deep-dive hint), `style.css` (the constellation veil + animated pulse, the surfaces, the nav, the showcase, the update-log tier rails, the hint pill), `index.html` / `account.html` / `suggest.html` (the veil layer + surface mounts), `card-render.js` (the blended card shell), new `admin/quotes.{html,css,js}` + `scripts/lib/quotes-store.js` + a `/api/quotes` Mode-1 endpoint + `quotes.json`, plus ~25 new Playwright specs. `bump-version` is **47 targets**. No new dependencies; `animeData.js` untouched.

<!-- author: Code | date: 2026-06-05 -->
## v1.8.3 — MINOR (2026-06-05)

**Website identity.** The site got a front door and a personality: a first-visit welcome splash, a named "Blake's Den" home section, a redesigned filter, live search, and a handful of premium touches across the cards and modal.

**Visitor-facing:**

- **A welcome "door."** On your first visit each session, the site opens with an atmospheric splash — a banner of Blake's own design faded into a deep-purple field with fine line-work, a ようこそ / WELCOME kicker, the wordmark, and a glowing **Enter**. Outline-style anime quote bubbles drift slowly up the sides like the page is floating in space. Press Enter (or Esc) to step through into the site. It shows once per browser session — close the tab and come back later and it greets you again, but it won't interrupt you while you're browsing.
- **Blake's Den.** The homepage is reorganized around a proper masthead — **BLAKE'S DEN 隠れ家** — gathering the Top 10 and the latest drop, with the header now a defined, always-present bar. Sections gently fade and rise in as you scroll.
- **A redesigned filter.** Filters are now tappable **chips** (genres, tags, studios) with a **find-as-you-type** box to narrow the options, a **Saved** quick-filter for your watchlist + favorites, a live count of how many anime match before you apply, and it **remembers your last filter** between reloads. Duplicate studio names (e.g. different spellings of the same studio) are merged into one chip.
- **Live search.** Typing in the search bar now surfaces matches **instantly** (no need to press Enter), and when only a few results come up they sit **centered** instead of hugging the left. "View All Animes" and the site title now clear any active filters, too.
- **Continue where you left off.** A new homepage rail shows the last few anime you opened, so you can jump straight back in.
- **Card + modal touches.** Cards got a subtle "shelf" footer with a gold rating pill, and every row now lines its ratings up cleanly. Opening an anime shows a small **"👁 Blake watched N seasons of this franchise"** line under the rating, so you can see how much of it he actually watched.
- **Search-result logo.** Behind the scenes, the site now ships proper favicon sizes and a structured-data block so search engines can show the site's own icon instead of a generic globe (this takes effect after the next search-engine crawl).

**Behind the scenes:**

- **Admin:** the **✎ Edit review** deep-link moved out of the rating badges to sit alongside the provenance line, in one clean row under the "Agree with my Rating?" bar (admin-only — visitors never see it).
- All new motion is reduced-motion-aware (instant / static when the OS prefers reduced motion), and the welcome banner is optimized (2.49 MB → 140 KB WebP) and only loads when the door actually shows.

**Implementation files:** `index.html` (home restructure, welcome splash + curtain, filter panel, head icon/JSON-LD), `style.css` (the Den, header, welcome door + quote bubbles, filter chip redesign, card footer + alignment, modal provenance, scroll-reveal), `script.js` (welcome/quotes/continue-rail/scroll-reveal logic, filter chips + live-narrow + Saved + memory + studio dedup, live search + sparse + relevance order, modal provenance), `card-render.js` (footer classes + `reviewed` scaffold), `assets/rar_banner.{png,webp}`, new Playwright specs (`welcome-splash`, `filter-search`, `g4b-fixes`, `g5` + a `welcomed` fixture). No new dependencies. `bump-version` is 40 targets.

<!-- author: Code | date: 2026-06-04 -->
## v1.8.2 — MINOR (2026-06-04)

**Structured, scannable reviews.** Reviews can now be written in labelled sections (Intro / Animation / Story / Characters / Design / Music / Feel / Extra Thoughts / Overall) so you can jump straight to the part you care about — with a behind-the-scenes editor rebuilt so each section is its own field.

**Visitor-facing:**

- **Jump-to-section pills on reviews.** When a review is written in sections, a row of pills appears above it (Animation, Story, Music…). Click one to jump to that section; the active pill highlights as you scroll, and the **Overall** section gets a gold accent matching the rating badge. Each pill carries a small Japanese label, in keeping with the site's bilingual styling. A plain unsectioned review looks exactly as before — the pills only appear when there are sections.
- **The frosted backdrop is back.** Opening a review's deep-dive (and the character/staff detail layer) again blurs the page behind it — the richer "frosted glass" depth, restored on both layers.
- **Tidier deep-dive header.** The action row at the top of the deep-dive modal (Request / Watchlist / Favorite / close) now sits in one clean line instead of wrapping and clipping over the banner art.

**Behind the scenes (admin tooling):**

- **Section-aware Review editor** on all three admin surfaces (edit page, season reviews, add-new-anime). Instead of typing raw heading syntax, each section is a dedicated block: a title picker (the nine standard sections with their Japanese labels, or a custom title), its own body field, a B / I / link toolbar, delete, and **drag-and-drop** (or ▲/▼) reordering. An "Add all nine" button drops the full template; the picker greys out sections already added. **Ctrl/⌘ + B / I** work inside any field. The stored format is unchanged (one markdown string), and the editor round-trips existing reviews losslessly — the 44 legacy reviews load as a single intro block to be carved into sections at will.
- **Premium edit-page polish** — a larger, sticky live-preview pane (with the real pill rail), a kicker-styled Review heading, and a framed Save/Ship helper.
- New Playwright coverage for the section round-trip and the markdown renderer's section ids (14 specs).

**Implementation files:** `markdown.js` (anchorable heading ids + `extractSections` + `parseReviewSections`/`compileReviewSections` + the section template), new `admin/section-editor.{js,css}`, `script.js` (the pill rail + scroll-spy on both review surfaces, the secondary header bar), `style.css` (pill/header styling, the restored backdrops, the header bar), `admin/edit.{html,js,css}` + `admin/season-reviews.{html,js}` + `admin/new-anime.{html,js}` (the editor swap), `tests/review-template.spec.js` + `tests/review-sections.spec.js`. No new dependencies. `bump-version` is 40 targets.

<!-- author: Code | date: 2026-06-04 -->
## v1.8.1 — MINOR (2026-06-04)

**The Admin Edit Page.** A premium, brand-parity admin surface for editing existing reviews end-to-end — no more hand-editing Excel. This ship is almost entirely behind-the-scenes tooling; visitors see nothing new except an admin-only edit link that never renders for them.

**Visitor-facing:**

- Nothing user-visible. The only new on-page element — an "edit review" link on a review's badge row — is gated to the admin account and never shown to visitors.

**Behind the scenes (admin tooling):**

- **New `/admin/edit` page.** Lists every catalog review (cover + title, searchable) loaded straight from `animeData.js`, then an editable form for Rating / Seasons / Genre / Studio / Where-to-watch / Trailer / Tags / Top-10 rank / Description and a live-markdown Review preview. Reachable from the admin menu and from an inline "edit review" link on the main review modal (which deep-links straight to that anime's form).
- **Two save tiers.** A quiet **Save** (Tier-1) writes the edited fields back to Excel through a hard column allowlist — it can never touch the title, the AniList-derived fields, or any other row — then regenerates `animeData.js`. A big-deal **Ship live** (Tier-2) reuses Mode 1's full publish chain (changelog widget -> version bump -> CHANGELOG -> Playwright tests -> commit + push -> deploy) behind a branded confirm that is the production go-signal.
- **Change-diff confirm.** Both Save and Ship show a readable before -> after table of exactly the fields that changed (long fields shown in full, scrollable) — so an accidental edit can't silently publish. No changes -> the write is skipped.
- **Interactive watched-set tree.** The franchise checkbox tree (Select all / none / spine, live count, pre-checked from the row's existing set) ported from the new-anime page, so the "reviewed" badges across the site stay correct after an edit.
- **Live preview overlay.** A "Preview live" button opens the real homepage review modal for that anime in a full-screen iframe (and clicking into a franchise season or "also liked" entry reaches the real deep-dive) — the genuine both-modals experience, reflecting the last saved data.
- **Revert.** Discards unsaved edits and resets every field, including the watched tree, back to the saved values (branded confirm).
- **Per-row "Fix from AniList".** One click pulls the row's current US streaming platforms from AniList (same mapping/allowlist/override rules as the platforms backfill, now extracted to a shared `scripts/lib/platform-map.js`), shows current -> proposed, and fills the field on Apply.
- **The shared assistant on Edit.** The new-anime "ASK" Haiku drawer is mounted on the edit page too (same backend, per-anime history) via a shared drawer module.
- **Origin-aware navigation.** Opening the form from a review's edit link returns you to that anime's modal on Cancel/back; opening it from the edit list returns you to the list.
- **Quality + safety.** Page scroll is now locked behind every admin overlay (a shared helper applied to all four admin pages); the Top-10 rank field uses a branded up/down stepper that looks identical across browsers; and a new Playwright spec boots the Mode 1 server and exercises its publish + edit paths in dry-run (no writes) so the pipeline is regression-covered.

**Implementation files:** new `admin/edit.{html,js,css}`, `admin/chat-drawer.js`, `admin/modal-scroll-lock.js`, `scripts/lib/platform-map.js`, `tests/mode1-server.spec.js`; updated `scripts/mode1-server.js` (edit Save/Ship endpoints + per-row platforms + dry-run/test-port hooks), `scripts/backfill-platforms.js` (now reuses the shared platform map), `script.js` (admin edit link), `admin/new-anime.{html,css}` + `admin/season-reviews.html` + `admin/suggestions.html` (scroll-lock + new-anime preview hint), `style.css`. No new dependencies or fonts. `bump-version` is 40 targets.

<!-- author: Code | date: 2026-06-04 -->
## v1.8.0 — MINOR (2026-06-04)

**Smoothness Overhaul (round 1) + branded scrollbars.** A perf-focused ship targeting the modal lag Blake reported on Firefox/Gecko (Chrome was already smooth). Root-caused to the layered modals' live `backdrop-filter`; reworked the blur architecture and added site-wide branded scrollbars. Honest scope note: the felt speed change was marginal — the bigger universal levers (see ROADMAP "Smoothness round 2") are measured and queued, not built here.

**Visitor-facing:**

- **Brand-purple scrollbars site-wide.** The default white scrollbars (glaring on the modal columns + the detail pop-out) are now brand-purple — `::-webkit-scrollbar` on Chromium/WebKit + `scrollbar-color`/`scrollbar-width` on Firefox.
- **Lighter, cleaner pop-out backdrop.** The detail pop-out's dimmed background was reworked from a live frosted blur to a premium static gradient dim, so it runs lighter across more browsers (especially Firefox) without the constant re-render cost.

**Behind the scenes:**

- **Blur architecture removed (the mechanism-level win).** The secondary + tertiary modal backdrops used a live full-viewport `backdrop-filter`, which **re-resolves the blur on every repaint** (hover/scroll) — the source of the Firefox Paint cost (profiled at ~49%→41%, ~98% Graphics). A live backdrop-filter structurally can't be cached, so it was replaced with a static dim: **every engine stops paying the per-repaint re-resolve tax.** An interim Firefox-only layer-promote (`@supports(-moz-appearance)`) was tried first and removed once the static dim made it moot.
- **Cross-engine perf investigation.** Profiled the offending pattern on Blink/Gecko/WebKit (all three Playwright engines). Documented finding: the headless harness **cannot isolate the GPU backdrop-filter cost** (dim ≈ backdrop-filter ≈ filter-on-static in headless), so the diagnosis rests on the live `backdrop-filter` re-resolve mechanism + Blake's headed Firefox Profiler, not headless FPS. Verified the modal's hovers already composite (transform/box-shadow, no `filter`), so the lag was purely the blur amplification — no speculative hover surgery added.
- **Console-warning fix.** Trimmed the trailer iframe `allow` attribute (`autoplay; encrypted-media; picture-in-picture`) to stop Firefox's "unsupported feature" Feature-Policy warnings. Triaged the rest of Blake's Firefox console: the `data:`-URI CORS block + `unreachable code` in a hashed bundle are browser-extension noise (not site code, grep-confirmed); the YouTube-embed cookie/CSP notices are third-party.

**Implementation files:** `style.css` (backdrop-filter → static dims on `.secondary-backdrop`/`.tertiary-backdrop`, branded `::-webkit-scrollbar*` + `scrollbar-color`), `script.js` (trailer iframe `allow` trim, both call sites). No new dependencies or fonts. `bump-version` stays 33 targets.

<!-- author: Code | date: 2026-06-04 -->
## v1.7.6 — PATCH (2026-06-04)

**Quick-nags polish.** Five small fixes clearing the backlog before the v1.8.0 Smoothness Overhaul — deliberately render-path-neutral (no new animations or blur) so they don't muddy that ship's before/after.

**Visitor-facing:**

- **Saved reviewed anime open the full review.** Opening a saved anime from your watchlist or favorites now takes you straight to its full franchise review when one exists, instead of the lighter detail view. (Seasons/movies that aren't the main reviewed entry still open the detail view, where their per-season note lives.)
- **Fixed a layout glitch in "also liked."** A wide format label (like `MOVIE`) could overlap a short title in the "also liked" suggestions — titles now keep clear of the badge.
- **More crew in the detail panel.** The staff list can now surface a couple more key roles (Series Director, Sound Director).
- **Cleaner per-season headers.** The per-season episode headers in the franchise panel are now styled as distinct dividers, easier to scan.
- **The site has its own icon.** A brand favicon (white "R" on purple) now shows in your browser tab and when you save the site to a phone home screen.

**Behind the scenes:**

- **Routing fix location.** The primary-id → main-modal upgrade lives in the `#secondary=<aniListId>` hash handler (where the catalog routing helpers `primarySlugForAniListId`/`isWatchedAniListId` are in scope — they aren't reachable from `account.js`), mirroring `renderRecommendations`' existing three-way split. Watched-not-primary + non-catalog saves keep routing to the secondary modal.
- **Favicon pipeline.** Downscaled 16/32/180/192/512 PNG rasters generated from `assets/favicon.png` (1254×1254 source kept in `assets/`) via `System.Drawing`; `<link>` icon/apple-touch/manifest tags added to all 7 pages (`index`, `account`, `suggest`, `404`, 3 admin) using root-absolute `/assets/` paths + a new `site.webmanifest`.
- **ROADMAP restructure.** The stale per-version sections (old v1.8.0 AniList tab, v1.8.5, old v1.9.0 mobile) were renumbered/annotated to the locked post-v1.7.5 ladder.

**Implementation files:** `script.js` (routing handler + staff whitelist), `style.css` (rec-card badge spacing + season-header), `index.html`/`account.html`/`suggest.html`/`404.html`/`admin/*.html` (favicon `<link>`s + version bump), new `site.webmanifest` + `assets/{favicon-16,favicon-32,apple-touch-icon,icon-192,icon-512}.png`. No new visitor-facing dependencies or fonts. `bump-version` stays 33 targets.

<!-- author: Code | date: 2026-06-04 -->
## v1.7.5 — MINOR (2026-06-04)

**Watchlist + Favorites everywhere, per-episode & where-to-watch, platforms refresh.** The watchlist/favorites system now works on any AniList entry (not just catalog cards), the in-site detail view gained per-episode info + a Where to Watch section, signed-out saves prompt sign-in, and all 44 reviews' streaming listings were corrected from AniList. Built across gates 1–3e on the v1.7.4 modal architecture.

**Visitor-facing:**

- **Save anything to watchlist / favorites.** The detail view (secondary modal) now has Watchlist + Favorite buttons, so any season, movie, or special — not just the main catalog cards — can be saved. Signed-out clicks (here and on the homepage cards) open the sign-in box instead of doing nothing.
- **Account page renders saved non-catalog entries.** Watchlist + favorites tabs now show cover art, title, and format/year for AniList entries you've saved; clicking one opens its detail view in-site (never an external tab). Catalog (reviewed) entries carry a green **✓ REVIEWED** tag.
- **Per-episode info.** Episode rows in the detail view are clickable — each expands to a thumbnail, full title, and every official place to watch that episode (the episode-direct link plus the show's other official streaming services), all equal-weight with none privileged.
- **Where to Watch section.** The detail view now leads its sidebar with a Where to Watch section listing every official streaming service for the anime.
- **Accurate streaming listings.** All 44 reviews' where-to-watch listings were corrected from verified source data (stale/duplicate/typo'd entries cleaned; physical-only titles marked honestly).
- **Bold formatting in bios.** Character/staff bios now render `__double-underscore__` bold (the style AniList uses), matching the existing `**asterisk**` bold.

**Behind the scenes (admin / data):**

- **Non-catalog save schema (`al:` discriminator).** Non-catalog saves live in the existing `users/{uid}/{watchlist|favorites}` collections under an `al:<aniListId>` doc id with a `{ type:'anilist', aniListId, title, coverImage, format, year }` snapshot saved at write-time (so the account page paints with no per-row fetch). No Firestore rules change — the existing `isOwner(uid)` rules validate no field shape, so the discriminator rides free.
- **In-site secondary deep-link route.** New `#secondary=<aniListId>` hash route opens the detail view directly (the path the account page's non-catalog rows use); `account.html` loads `franchise-fetch.js` for legacy-row cover backfill.
- **Per-episode + Where-to-watch data.** `MEDIA_DETAIL_QUERY.streamingEpisodes` gained `url`/`site`; the detail view dedupes/sorts the show's `externalLinks` (type STREAMING) for both the per-episode links and the Where to Watch section. No new AniList query — `externalLinks` was already fetched.
- **Sign-in modal z-index fix.** The sign-in modal/overlay were raised above the secondary (6000) and tertiary (7000) layers so a save-triggered sign-in renders on top, not behind the open detail view.
- **Platforms backfill CLI.** New `scripts/backfill-platforms.js` (dry-run + live) rewrites the Excel `Watch` column from each anime's primary-AniListId `externalLinks` (type STREAMING) with a US-centric allowlist + name normalization, Excel backup + lock-check + sync regen, and a report file — used to correct all 44 rows (41 changed). Crunchyroll availability was verified per-title for the defunct-Funimation cases.
- **Shared markdown.** `__bold__` added to the single-source `markdown.js` (after the `**` pass; `_italic_` deliberately skipped for snake_case/URL-underscore collisions) — all five consumers ride along. Covered by a new test.

**Implementation files:** new `scripts/backfill-platforms.js`, `tests/markdown-bold.spec.js`; `script.js` (secondary-modal save pills + handlers, per-episode expand, Where to Watch section, `#secondary=` route, signed-out → sign-in), `style.css` (save pills, episode expand, platform pills, account green ✓, auth z-index), `account.js` + `account.html` (non-catalog row rendering + `franchise-fetch.js` load), `franchise-fetch.js` (`streamingEpisodes` `url`/`site`), `markdown.js` (`__bold__`), `animeData.js` (regenerated — corrected Platforms). No new visitor-facing dependencies or fonts. `bump-version.js` stays 33 targets (no new versioned page).

<!-- author: Code | date: 2026-06-04 -->
## v1.7.4 — MINOR (2026-06-04)

**Modal Architecture Overhaul.** The anime modal's franchise panel is now always visible; clicking any related anime opens a large in-site detail view instead of an external tab; each season/movie/OVA can carry its own written review; and characters + staff are clickable into full profiles. Built across 10 gates (1 → 3d) on the v1.7.2/v1.7.3 data layer.

**Visitor-facing:**

- **Always-visible franchise panel.** The "More Info" panel (franchise tree, episodes, recommendations) no longer hides behind a "Click for More Info" tab — it's a permanent third column in a 3-column modal (More Info | Main Review | Community) that shrinks proportionally on smaller screens and stacks to a single clean column on narrow/mobile widths.
- **In-site detail view (secondary modal).** Clicking a related anime used to jump to an external tab; now a large drawer slides in over the dimmed review, showing a banner + cover, full synopsis, genres, tags, a character grid, key staff, the trailer, and a "more like this" row — all in the site's own look. Browse through "more like this" cards and step back one at a time; a "📝 Request this anime" button appears on anything not yet reviewed.
- **Per-season reviews.** Each season, movie, OVA, or special in a franchise can now have its own dedicated written take, shown in a gold-accented "Blake's Review" section in the detail view — distinct from the overall franchise review on the main modal. The "currently viewing" row in the franchise panel opens the detail view so the source season gets its own review surface too.
- **Clickable characters + staff.** Character and staff cards open a full profile — bio, voice actors and where you've seen a character before, or a staff member's credits and notable characters — with links in those bios now clickable.
- **Formatting in reviews.** Reviews and descriptions now support light formatting (bold, italics, links, lists) so write-ups read cleanly.

**Behind the scenes (admin / data):**

- **Per-season review storage + editor.** Reviews live as markdown files (`season-reviews/<id>.md`) with a sync-emitted index; a new `/admin/season-reviews` panel lists every watched season with a live-preview markdown editor (save/delete via a new local `/api/season-review` endpoint that rebuilds the index), reachable from the Admin pill and via an inline "✎ Edit review" link in the detail view (deep-link auto-fills the season title).
- **Shared markdown renderer.** A single hand-rolled, XSS-safe `markdown.js` (`window.renderMarkdown`) feeds five surfaces — main Review/Description, per-season reviews, character/staff bios, and both admin preview panes — so there's one parser site-wide. The admin new-anime form gained a Review live-preview pane + a B / I / 🔗 toolbar.
- **Routing split.** `catalogSlugForAniListId` split into `primarySlugForAniListId` (a review's primary id → main franchise modal) + `isWatchedAniListId` (any watched id → green ✓ pill); watched-but-not-primary + the source row now open the secondary modal (with the per-season section), non-watched non-catalog open it without one.
- **Additive AniList queries.** New sibling queries in `franchise-fetch.js` — `MEDIA_DETAIL_QUERY` (rich single-anime detail + recommendations) and `CHARACTER_DETAIL_QUERY` / `STAFF_DETAIL_QUERY` — alongside per-anime / per-character / per-staff 24h `localStorage` caches (`rar:anime:` / `rar:character:` / `rar:staff:`). The load-bearing traversal query is untouched.
- **Suggest-page prefill.** The public `/suggest` page now reads `?title=&anilistId=` (it previously read no params) so the detail view's Request button lands on a pre-filled form.

**Implementation files:** new `markdown.js`, `season-reviews/` (+ `index.json`), `scripts/lib/season-review-index.js`, `admin/season-reviews.{html,js,css}`; `script.js` (always-visible layout, secondary + tertiary modals, routing split, markdown wiring), `franchise-fetch.js` (3 additive queries + fetchers), `style.css` (3-col + secondary/tertiary/review styling), `index.html` (3-col + `markdown.js` load), `admin/new-anime.{html,js,css}` (Review preview + toolbar), `admin-fab.js` (Season Reviews link + `window.__rarIsAdmin`), `suggest.js` (param prefill), `scripts/mode1-server.js` (`/api/season-review` CRUD), `scripts/sync-excel-to-js.js` (index emit), `scripts/bump-version.js` (7 new targets, 26 → 33). No new visitor-facing dependencies or fonts.

<!-- author: Code | date: 2026-06-03 -->
## v1.7.3 — MINOR (2026-06-03)

**Watched Set + Admin Form Completion.** The `✓ REVIEWED` badge now lights up on *every* entry a review actually covers — not just the primary season — and the admin/Mode 1 workflow gained a chatbot assistant, a watched-set picker, and a few cleanups. Built on a shared franchise-traversal module extracted this ship.

**Visitor-facing:**

- **`✓ REVIEWED` across the whole watched set.** Previously the badge matched only one AniList entry per review, so a franchise review lit up Season 1 only. Each review now carries the full set of entries it covers (`WatchedAniListIds`), so the badge appears on every watched season, movie, OVA, and special site-wide.
- **Official-only where-to-watch.** Unofficial/aggregator platforms (hianime, 9anime, aniwave) were stripped from all 44 reviews + the data pipeline; the site now lists only official streaming services.
- **Infinite-scroll update log.** The homepage update log no longer drops old entries at 10 — it scrolls back through every change since detailed logging began (v1.6.1, 2026-05-10).

**Behind the scenes (admin / data):**

- **Shared `franchise-fetch.js` module.** The v1.7.2 multi-fetch + BFS traversal was extracted from `script.js`'s IIFE into a classic-script-safe module (`window.franchiseFetch` + `module.exports`) consumed by the homepage modal, the admin watched-set picker, and the backfill CLI — one implementation, three consumers.
- **Two new Excel columns** — `WatchedAniListIds` (what was watched) + `KnownAniListIds` (snapshot of the franchise tree at save time, for a future Mode 2 "new arc surfaced" diff); sync parses both into number arrays; the render pill checks set membership (falls back to the primary id when empty).
- **Admin form rewire** — the FRANCHISE INFO panel became a watched-set **checkbox tree** (multi-hop, FINISHED-only defaults, source ticked + disabled, Select-all/none/spine-only + a live count chip); the per-field `✨ AI` paste-back panels were removed; the Unofficial field was removed; a "Fill from AniList" button was added; the generated row + Mode 1 server now persist both new columns (plus a bonus fill of the long-empty `TitleEnglish/Romaji/Native` columns).
- **Chatbot drawer (`✨ ASK`)** — a slide-out admin assistant backed by a local `/api/chat` endpoint (Anthropic Haiku, one-shot, ephemeral prompt-cache structure), per-anime `sessionStorage` history, quick-start prompts, auto-clear on publish. Requires `ANTHROPIC_API_KEY` in `.env` (gitignored + firebase-ignored).
- **Backfill CLI** (`scripts/backfill-watched.js`) — interactive per-row watched-set populator (`--dry-run`, resume-safe, one Excel backup, sync regen) used to populate all 44 rows.
- Admin floating pill moved bottom-left (was colliding with the search bar); chat drawer raised above the sticky header so its buttons stay clickable.

**Implementation files:** new `franchise-fetch.js`, `scripts/strip-unofficial.js`, `scripts/backfill-watched.js`; `script.js` (extraction + watched-set pill map), `admin/new-anime.{html,js,css}` (checkbox tree + chatbot drawer + AI/Unofficial removal + Fill button), `scripts/mode1-server.js` (`/api/chat` + watched-set persistence), `scripts/sync-excel-to-js.js` (new columns + unofficial whitelist removal), `admin-fab.css` (bottom-left), `index.html` (shared-module script tag + infinite-scroll widget restore), `animeData.js` (regenerated). No new dependencies, no new fonts.

<!-- author: Code | date: 2026-06-03 -->
## v1.7.2 — MINOR (2026-06-03)

**The More Info panel overhaul — data architecture + UX redesign.** The franchise panel now walks a show's entire related-anime chain — every season, side story, movie, and unreleased announcement — instead of just its immediate neighbours, with per-season episodes, smarter ordering, an in-catalog cross-link, and a numbering toggle. Closes the multi-season architectural debt deferred since v1.6.10.

**Visitor-facing:**

- **Full franchise chain in the More Info panel.** "Click for More Info" now shows the complete spine — every prequel/sequel season in chronological order with a connecting line and a `CURRENTLY VIEWING` marker on the one you opened — followed by grouped sections for side stories, alternative versions, movies, and more. Long groups collapse behind a "Show all N entries" toggle.
- **Click-through to reviews on this site.** Any related anime Blake has also reviewed shows a `✓ Reviewed` pill and opens its review right here on the site instead of sending you to an external page. Everything else still opens its external info page in a new tab.
- **Episodes grouped by season + a numbering toggle.** The episode list now splits per season (each collapsible), with a `PER SEASON` / `CONTINUOUS` toggle — count each season from 1, or straight through the whole franchise. Your choice is remembered. Misleading absolute episode numbers carried over from streaming feeds are normalized so each season starts at 1.
- **`UPCOMING` label on unreleased entries.** Announced-but-unaired seasons and movies are tagged `UPCOMING` and sorted to the bottom, so they no longer jump ahead of the show you're actually looking at.
- **Faster repeat opens.** A franchise's panel is cached for 24 hours, so re-opening the same anime loads instantly.
- **Graceful "no episode list" message** when a show genuinely has no episode data, instead of a silently missing section.

**Behind the scenes:**

- **Multi-fetch data architecture.** A new batched parallel-fetch layer (groups of 3-4 with inter-batch delays + a rate-limit retry) replaces the single relation lookup, feeding a breadth-first franchise walk (cycle-safe, depth/size capped) that recurses the main season chain and collects side entries one hop out. This is the architecture deferred since v1.6.10 — the old nested-relations query returned 500s on relation-heavy shows like Demon Slayer.
- **Identical-list dedupe.** Some franchises (Re:Zero) return the same episode list on every entry from the streaming feed; byte-identical lists are now collapsed so a season's episodes aren't shown repeatedly.
- **Two-tier cache** — in-memory plus a version-keyed 24h `localStorage` layer that self-invalidates each ship (prefix-swept).
- **Partial-fail handling** — if some sub-fetches error, the panel renders what loaded plus a subtle retry, rather than failing whole.

**Implementation files:** `script.js` (multi-fetch + BFS traversal data layer, franchise render layer, episode aggregation + signature dedup + per-season/continuous renumber, numbering toggle, partial-fail/retry, modal wiring, undated-entry sort fix + `UPCOMING` kicker), `style.css` (spine connector line, grouped sections, in-catalog pill, episode header + segmented toggle, partial-fail notice, `UPCOMING` accent, badge-collision padding fix). No new dependencies, no new fonts. The ratified data layer stayed untouched through the later UX/ordering gates (render-layer fixes only).

<!-- author: Code | date: 2026-06-03 -->
## v1.7.1 — PATCH (2026-06-03)

**Polish bundle on top of v1.7.0's AniList enrichment — original-language titles, per-anime color, and a premium empty state.**

- **Japanese / romaji subtitle on every card + modal.** Each anime now shows its original title under the English one, wrapped in `「 」` brackets — the romanized reading (e.g. `「Sousou no Frieren」`) when it's meaningfully different from the English, or the **native Japanese** (e.g. `チェンソーマン`, `ワンパンマン`) when the romaji is basically the English title back. Latin readings render in Outfit Light Italic; Japanese renders in Noto Sans JP. Long titles wrap up to 3 lines. Shown on the homepage grid, View All grid, the Top 10 carousel, the Latest Anime Drop card, and inside the modal.
- **Per-anime color accent on the community-score badge.** The `ANILIST` badge now picks up each anime's own AniList cover color (One Punch Man's amber, Frieren's mint, Solo Leveling's blue, etc.) on its border, gradient, and kicker — with a readability guard that lifts very dark colors (Chainsaw Man's deep red) to a legible tone. Falls back to brand purple when an anime has no color.
- **Premium "no matches" empty state.** Searching/filtering with no results now shows a branded card (🔍 + `NO MATCHES 該当なし` + a `SUGGEST ONE →` button to the suggestion box) instead of a bare text line, centered in the grid.
- **Update-log version chips.** Each date in the homepage update log now carries the version(s) that shipped that day — stacked chips for 1-2 ships, an arrow range (e.g. `v1.6.2 → v1.6.6`) for busier days.
- **All 44 reviews now AniList-enriched.** The 4 titles that didn't auto-match in v1.7.0's backfill (My Stepmom's Daughter Is My Ex, Watari-kun's, An Archdemon's Dilemma, Hatsune Miku: Colorful Stage!) were backfilled by explicit ID.

**Behind the scenes:**

- New `--add-native` backfill mode + a `TitleNative` Excel column populated for all 44 (the native Japanese title), read + emitted by the sync. A repeatable `--match "<Title>" <id>` mode was also added for explicit-ID backfills.
- `pickSubtitle` resolver (in `card-render.js` + `script.js`) normalizes before comparing romaji vs. English so near-duplicates fall through to the native title; `.is-native` swaps the font to Noto Sans JP.
- Top 10 carousel glass portrait expanded to fit the new subtitle line; Latest Anime Drop card got the subtitle treatment + a title-block centering fix.

**Implementation files:** `script.js`, `card-render.js`, `style.css` (subtitle render + resolver + empty-state + badge color + spacing), `index.html` (widget chips + Outfit-italic/Klee font imports), `scripts/anilist-backfill.js` (`--add-native` + `--match` modes), `scripts/sync-excel-to-js.js` (`TitleNative`), `animeData.js` (regenerated with `TitleNative` on all 44).

<!-- author: Code | date: 2026-06-03 -->
## v1.7.0 — MINOR (2026-06-03)

**AniList enrichment for the legacy catalog: a community-score badge on every anime modal, precise ID-based franchise lookups, and a one-time backfill of the existing 44 reviews.** The ~44 reviews that pre-date Mode 1's AniList integration are now caught up to the same field-level data new anime get automatically.

**Visitor-facing:**

- **Community score badge on every anime modal.** Next to Blake's rating, each modal now shows the AniList community score as a twin badge — `RATING · 8.5` and `ANILIST · 8.1` side by side, same shape, gold vs purple accent. It's a quick read on where Blake's take lines up with the wider anime community. Hidden automatically for the few titles AniList has no score for. (AniList is named as data attribution on the badge kicker — not as a third-party brand interruption.)
- **More Info panel resolves precisely by ID.** The "Click for More Info" panel's franchise/relations chain now looks anime up by their exact AniList ID instead of a fuzzy popularity-sorted title search — so ambiguous titles resolve to the right show every time. This path was built back in v1.6.8 anticipating the backfill; populating the IDs activated it automatically (no new modal code).

**Behind the scenes (admin / data):**

- **One-time AniList backfill.** A new interactive CLI (`npm run backfill`) walked the canonical Excel row-by-row, queried AniList for each legacy title, let Blake confirm the right match in his terminal, and wrote six fields back — `AniListId`, `IdMal`, `AniListScore`, `AniListColor`, `TitleEnglish`, `TitleRomaji`. 40 of 44 matched; 4 were skipped (left blank, the site falls back to title search for those). Idempotent (re-runnable), `--dry-run` and `--auto` (exact-title auto-pick) modes, sequential rate-limit-friendly queries, a one-time Excel backup before the first write, and a markdown verification report written outside the deploy root.
- **`IdMal` + `TitleRomaji` are stored, not yet used.** MAL API calls and romaji subtitles on cards are deferred to later ships — this ship just banks the data.

**Implementation files:**

- `scripts/anilist-backfill.js` (new, ~290 lines) — the backfill CLI; reuses the shared backup helper + a dedicated AniList query (adds `idMal` / `episodes` / `coverImage.color`).
- `scripts/lib/excel-backup.js` (new) — `backupExcel()` + `checkExcelLock()` extracted from `scripts/mode1-server.js` so both the Mode 1 server and the backfill share one source of truth; mode1-server now imports them (behaviour unchanged).
- `scripts/sync-excel-to-js.js` (+8) — reads + emits the new `TitleEnglish` / `TitleRomaji` fields.
- `scripts/anilist-fetch.js` (+2) — exports `callAniList` for the backfill's query.
- `package.json` (+1) — `npm run backfill`.
- `script.js` (~+18) — the `RATING` / `ANILIST` twin badges in `.modal-meta` (reads the static `AniListScore`, no API call; hidden when null). The `Media(id:)` lookup path was already present.
- `style.css` (~+45) — twin `.rating-badge` / `.anilist-badge` (inline-flex kicker · divider · score, gold vs purple gradient, staggered fade-in, reduced-motion fallback, no hover — informational).

<!-- author: Code | date: 2026-06-02 -->
## v1.6.12 — PATCH (2026-06-02)

**Three admin Suggestions Queue fixes from Blake's v1.6.11 prod smoke, plus a docs-only note for a future feature.** All changes are admin-only (`/admin/suggestions`) — nothing visitor-facing changed.

- **Error card now clears on a successful load.** The "Couldn't load" error card could linger past a later successful fetch — Blake's screenshot showed a loaded queue, the empty-state card, and the error card all visible at once. `loadQueue()` now hides both the empty and error cards before each fetch, so a stale error from a prior failed attempt can't survive a success.
- **Delete confirmation is now a custom branded modal** instead of the browser-native `confirm()` dialog. Centered overlay with a `rgba(0,0,0,0.55)` + blur backdrop; a layered-gradient card matching the `.admin-shell` vocabulary (border-image hairline, glow, 18px radius); 🗑️ glyph + `DELETE SUGGESTION 削除` kicker + dynamic *"Delete suggestion '<title>'?"* body; Cancel (default focus) and Delete (`.danger` red) buttons. Click-backdrop and Escape both cancel, focus is trapped between the two buttons while open, and the 220ms fade+scale entrance is disabled under `prefers-reduced-motion`. Built as a reusable `confirmModal(title) → Promise<boolean>` so the existing delete logic stayed intact (`if (!await confirmModal(...)) return;`).
- **Mark Reviewed now moves the row to a separate `REVIEWED 承認済` section** below the new submissions, instead of dimming it in place. The queue is split into two stacked sections (`NEW 新着` / `REVIEWED 承認済`), each with its own header + live count; marking a row reviewed slides it (320ms cross-slide) out of NEW and into REVIEWED. Empty sections hide their header. The top `X NEW · Y REVIEWED` stats counter stays, and each section header now also shows its own count.

**Docs (no code):** a DM-style inbox between admin and visitors — so Blake can reply directly to whoever submitted a suggestion and tell them if he liked it — is now noted in `docs/NEXT.md` (v1.8.x, pairs with the planned notification/comment overhaul) and `ROADMAP.md` Big-vision ideas. Both flag the auth prerequisite: capturing a stable visitor identity at suggestion-submission time (schema change on `suggestions` docs).

**Implementation files:**

- `admin/suggestions.js` (+~95 lines) — 2-line stale-card clear at the top of `loadQueue()`; `confirmModal()` Promise helper (focus trap + backdrop/Escape cancel + double-rAF entrance); `moveToReviewed()` cross-slide helper; `renderQueue()` splits docs by `status === 'reviewed'` into two lists; `updateStats()` reworked to count both lists, drive per-section header counts, and toggle section visibility; click delegation moved to the `#suggestions-queue` wrapper.
- `admin/suggestions.html` (+~25 lines) — two `<section>` blocks (`#section-new` / `#section-reviewed`) replacing the single `<ul>`; `#confirm-modal` overlay placed outside `.admin-shell` (its `backdrop-filter` would otherwise become the containing block for the fixed overlay and clip it via `overflow:hidden`).
- `admin/suggestions.css` (+~190 lines) — section headers (kicker + count, fade-up entrance), 320ms cross-slide for the reviewed move, full modal styling, `[hidden]` symmetry on the new `display:flex` containers, and a `prefers-reduced-motion` pass over every new transition/animation. Dropped the old `.suggestion-row.reviewed { opacity: 0.5 }` dim — the section header now carries the "reviewed" meaning, so reviewed rows render at full opacity.
- `docs/NEXT.md` + `ROADMAP.md` — DM-inbox future-feature entries (docs-only).

<!-- author: Code | date: 2026-06-02 -->
## v1.6.11 — MINOR (2026-06-02)

**Visitors can now recommend an anime for Blake to review.** A new Suggestion Box page (`/suggest`) lets anyone — no sign-in required — type an anime title, pick the exact one they meant from a live search-as-you-type dropdown (covers + format pill + year), and send it to the admin queue. A banner CTA at the bottom of the homepage anime grid links visitors over: *"Missing something? — Tell Blake what to review next →"*. On the admin side, a new Suggestions Queue at `/admin/suggestions` shows submissions newest-first with the visitor's chosen cover + title + reason, and an "Add this anime" button hands the existing Mode 1 form the full search data so admin skips the typing + Fetch step entirely.

- **Public Suggestion Box page** — visitors type a title, see 5-8 live results stream in (~520ms staggered fade-up), pick one to confirm with a selected-anime card (cover + title + format pill + year + Change Selection button), optionally add a reason, hit Send Suggestion. Honeypot + 60-second sessionStorage rate-limit handle spam without sign-in or captcha. If the search comes back empty, visitors can still submit the title they typed — the queue handles both shapes.
- **Homepage banner CTA at the bottom of the anime grid** — premium banner-style card with layered purple gradient + backdrop blur + Bebas Neue *"Tell Blake what to review next"* headline + sliding arrow on hover. Mirrors the visual vocabulary of the rest of the site.
- **Admin Suggestions Queue** — accessible from the floating Admin pill's dropdown alongside `+ Add Anime`. Queue rows show the visitor's chosen cover thumbnail (50×70) + title + truncated reason + relative timestamp (`<1h ago` / `Xh ago` / `M/D/YY`) + format pill + year + status pill. Per-row buttons: **Add this anime** (hands off to Mode 1 with `?suggest=<title>&anilistId=<id>` — Mode 1 auto-fetches the full AniList payload, admin skips the typing step entirely), **Mark reviewed** (smooth 400ms dim with `reviewedAt` timestamp), **Delete** (smooth 320ms row-collapse before DOM removal). Live `X NEW · Y REVIEWED` stats counter above the list. Skeleton shimmer loaders while the queue fetches.
- **Premium UI throughout** — every interactive surface gets the brand's purple glow + 115° shimmer sweep + hover lift + scale + press feedback. Result rows on hover: cover scales + tilts + glows, title underlines from left, background brightens. Spinner rebuilt as a conic-gradient ring. The selected-anime cover gets a 9-second Ken Burns drift. Selection swap is choreographed: input fades+slides down (220ms), selected card slides+scales in from above (380ms cubic-bezier), reverse on Change Selection (260ms out, 320ms back in) — all via transition-coordinated double-rAF JS so animations replay reliably every toggle (the earlier named-keyframe approach didn't re-fire on subsequent picks).
- **Polished error state** — replaced the bare red paragraph with a layered red-tinted card containing a ⚠️ glyph, `COULDN'T LOAD 接続` kicker, body copy, and a Reload button matching the admin button vocabulary.
- **Reduced-motion respected everywhere** — every new keyframe + transition is wrapped in a `@media (prefers-reduced-motion: reduce)` fallback that disables animations, keeps `is-entering` / `is-leaving` state classes at their final visible state, and reverts hover transforms.

**Known limitations:**

- **Firestore rules deploy is global, not channel-scoped.** v1.6.11 extends the `suggestions` collection's `allow create` rule with 6 new optional fields. The deploy hits production immediately (no preview channel for rules); the change is a safe widening (only adds accepted shapes) but Code calls it out explicitly at the deploy gate.
- **Mode 1 server still requires Blake's localhost run for the "Add this anime" handoff to actually publish a review.** v1.6.11 closes the suggestion → admin queue → Mode 1 form prefill loop; the actual `npm run mode1` + `firebase deploy` happens in Blake's existing local flow.

**Implementation files:**

- New visitor surface: `suggest.html` (104 lines), `suggest.js` (434 lines), `suggest.css` (802 lines). Search-as-you-type uses a self-contained `SEARCH_QUERY` + `searchLite()` helper (lifted from `admin/new-anime.js` with `coverImage { medium }` added + AbortController for in-flight cancellation). Honeypot field + sessionStorage 60-second rate-limit. ARIA combobox + listbox + option roles wired throughout. Keyboard navigation (arrow up/down + Enter + Escape). Selection-aware submit payload extends with optional `anilistId` / `coverImage` / `format` / `year` / `englishTitle` / `romajiTitle`.
- New admin surface: `admin/suggestions.html` (71 lines), `admin/suggestions.js` (249 lines), `admin/suggestions.css` (532 lines). Mirrors `admin/new-anime.html`'s `admin-gate` / `admin-main hidden` auth pattern via `onAuthStateChanged` redirect-on-non-admin. Single-shot `getDocs` ordered by `submittedAt desc`. Event-delegated row buttons. Skeleton shimmer + live stats counter.
- `admin/new-anime.js` (+12 lines) — `?anilistId=` URL handler in the `onAuthStateChanged` callback auto-triggers the existing Fetch by ID button so the AniList payload is on-screen ready for review by the time admin lands on the form.
- `admin-fab.js` (+5 lines) — added one entry to the `ADMIN_MENU_ITEMS` array so the floating Admin pill's dropdown now shows `Suggestion Queue 提案` alongside `+ Add Anime`.
- `firestore.rules` (+30 lines) — extended `suggestions` collection's `allow create` with 6 new optional fields + per-field type/range checks. Existing collections (`users`, `comments`, `reviews`, `official`) preserved verbatim from the gate-1b Console export.
- `index.html` (+7 lines) — replaced the gate-1b inline CTA link with the new `<a class="suggest-cta-banner">` markup at the bottom of `#all-anime-view`.
- `style.css` (+~130 lines) — full banner CSS block + arrow shimmer; total `style.css` now serves the homepage banner alongside the existing v1.6.8 / v1.6.9 / v1.6.10 modal styles.
- `scripts/bump-version.js` (+50 lines) — 8 new TARGETS for `suggest.html` (4) + `admin/suggestions.html` (4). Target count now 22.

Total: **~2,400 net new lines** across 11 files (7 new files + 4 modifications). Plus `firestore.rules` global deploy.

Tier A — `suggest.html`, `suggest.js`, `suggest.css`, `admin/suggestions.html`, `admin/suggestions.js`, `admin/suggestions.css`, `index.html`, and the homepage CTA banner are all visitor-facing or admin-facing UI surfaces. `npm test` runs clean before commit (7/7 Playwright; the Suggestion Box's lazy-fetch path is not under test). Blake's local browser smoke verified the full visitor flow (type → debounced search → pick → confirmation card → submit → success morph), the admin queue end-to-end (skeleton → row render with cover + format + year + stats + status pills → Mark reviewed dim → Delete row-collapse), the Mode 1 handoff (`?anilistId=` auto-fetches into the form), the homepage banner hover + arrow slide + shimmer sweep, and the reduced-motion fallback across all surfaces.

**Roadmap cascade:** v1.7.0 (AniList backfill + MAL integration — populates `AniListId` / `IdMal` / `AniListScore` / `AniListColor` for the existing ~44 reviews via Mode 1's pipeline) is the next immediate ship. v1.7.1 (multi-fetch data architecture + multi-hop revival via `Promise.all` parallel fetches) closes the v1.6.10 architectural debt and unblocks multi-season franchise traversal + franchise-episode aggregation. v1.7.2 (in-site secondary modal built on v1.7.1's data layer) replaces v1.6.8's "open AniList in new tab" with an in-site detail view including watchlist + "Not Reviewed yet" treatment for ALSO LIKED cards. v1.7.x polish slots (Romaji subtitle on cards, AniList per-episode scores feasibility check) follow. v1.6.x polish queue continues to absorb ad-hoc bundles (More Info panel polish bundle, Widget version-chip per `<li>`).

<!-- author: Code | date: 2026-06-02 -->
## v1.6.10 — MINOR (2026-06-02)

**The More Info panel on every anime modal now reads a little cleaner: duplicate studio names dedupe, each franchise row carries a small format pill, and the STAFF cluster can show up to six roles when AniList's data falls outside the standard four-role whitelist.** Three small visible polishes, no new clusters and no new markup — the changes ride entirely on existing v1.6.8 / v1.6.9 styles. Click "Click for More Info" on any anime modal and the same three things land everywhere.

- **Per-row studio dedupe** — when AniList returns the same animation studio twice on a single relation row (Frieren S2's `MADHOUSE, MADHOUSE` is the canonical example), the modal now shows it once. The fix is a one-line `Array.from(new Set(...))` wrapper around the studio-name extraction, applied in both the public modal (`renderMoreInfoEntry`) and the admin form (`renderFranchisePanel`) so the admin-side FRANCHISE INFO panel stays visually consistent.
- **Format pill on each franchise row** — AniList's `format` field (`TV` / `MOVIE` / `OVA` / `ONA` / `SPECIAL`) renders as a small pill at the start of the row's meta line, in flow with the year / eps / studio text. Visitors can tell apart Mugen Train MOVIE from Mugen Train ARC TV at a glance — a stop-gap until v1.7.1's multi-hop traversal surfaces both seasons explicitly. The pill reuses the existing `.more-info-rec-format-badge` styling (introduced for recommendation cards in v1.6.9) with an inline `position: static` override so it doesn't stack on top of the row's score badge in the corner.
- **STAFF section bumped 4 → 6 roles** — when AniList doesn't list any of the four whitelist roles (Director, Series Composition, Music, Character Design), the fallback loop that walks `staff.edges` by relevance score now collects up to six entries instead of four. Anime with deeper credit lists (OVAs with named editors, animation-production specials) get a fuller STAFF cluster.

**Known limitations:**

- **Multi-hop franchise traversal and franchise-episode aggregation were both scoped for v1.6.10 but deferred to v1.7.1.** The original v1.6.10 plan chased relation chains two hops out (so Demon Slayer's modal would surface Entertainment District / Swordsmith Village / Hashira Training / Infinity Castle, and One-Punch Man would surface S3 + S3 Part 2) and aggregated per-season episode lists (closing v1.6.9's known limitation about wrong-season episodes for Re:Zero and other ongoing multi-season shows). Both required a nested-relations GraphQL shape that AniList returns 500 errors for on relation-heavy nodes (Demon Slayer's id is the canonical 500-prone case — its source-material pivot path exceeds AniList's per-query complexity budget). v1.7.1's redesign — N+1 parallel fetches in place of the single nested mega-query — will deliver both items. v1.6.10 ships small with the three polish wins above; the architectural debt is acknowledged and queued.

**Implementation files:**

- `script.js` (~+20 / ~-8) — `renderMoreInfoEntry`'s studio-split chain wrapped in `Array.from(new Set(...))`; the same renderer's meta-line construction extended to defensively extract `node.format` and prepend a `<span class="more-info-rec-format-badge" style="position: static;">` pill (the inline style overrides the class's `position: absolute` so the pill sits in the meta line, not in the top-right corner where `.more-info-score-badge` already lives); `renderStaffCredits`'s fallback loop bumped from `picked.length >= 4` to `>= 6`. No signature changes, no fetcher changes, no query changes.
- `admin/new-anime.js` (~+5 / ~-4) — admin parity for the studio dedupe: same `Array.from(new Set(...))` wrapper in `renderFranchisePanel`'s per-entry studio render, so the admin form's FRANCHISE INFO panel stays visually consistent with the public modal. Other admin paths (the studio-input prefill via `aggregateFranchise`'s studio-union Map) already deduped case-insensitively in v1.6.7 and are untouched.
- No new CSS — both changes reuse existing v1.6.8 / v1.6.9 classes (`.more-info-rec-format-badge` for the pill, the existing staff-row markup).
- No new HTML structure, no new event listeners.

Total: **~25 insertions / ~12 deletions** across 2 files (`script.js`, `admin/new-anime.js`) — plus the version-bump strings and the widget bullet in the gate-7/8 work.

Tier A — `script.js`, `admin/new-anime.js`, and the public anime modal + admin form are visitor-facing. `npm test` runs clean before commit (7/7 Playwright; the More Info panel's lazy-fetch path is not under test). Blake's local browser smoke verified Demon Slayer (single-hop relations correctly limited to Mugen Train Movie + Mugen Train Arc — Entertainment District / Swordsmith / Hashira / Infinity Castle absent, the deferred v1.7.1 scope), Frieren S2 (single Madhouse on the row, no duplicate), format pills visible on each TV / MOVIE / OVA / etc. relation, and the STAFF cluster showing 4-6 entries depending on which fallback path fires.

**Roadmap cascade:** v1.6.11 (Suggestion Box + admin viewer) is the next immediate ship — Cowork's Tier-B request queue is partly built and that's the cleanest next slot. v1.7.0 (AniList backfill — populates the `AniListId` column for every existing review so future modal fetches use the precise `Media(id:)` lookup instead of the popularity-sorted `Page(media:)` search) follows. v1.7.1 closes v1.6.10's architectural debt: N+1 parallel fetches replace the single nested mega-query, restoring multi-hop traversal AND enabling franchise-episode aggregation in a way that respects AniList's per-query complexity budget — the two deferred items from this ship land there. Other v1.7.x candidates (romaji subtitle, in-site secondary modal, watchlist hook on ALSO LIKED cards) keep their current slots.

<!-- author: Code | date: 2026-05-13 -->
## v1.6.9 — MINOR (2026-05-13)

**Visitors can now see per-episode names, related-anime recommendations, and staff credits inline on the More Info panel** — three new data clusters added below the franchise relations that v1.6.8 introduced. Click "Click for More Info" on any anime modal and the panel now lists the show's episodes, a handful of "if you liked this…" recommendations (each clickable to AniList), and the key production staff (director, series composition, music, character design).

- **Episodes section** — the source anime's episode list, pulled from AniList. The section header reads `EPISODES — {Anime Title}`. Long lists (more than 8 episodes) collapse under a "SHOW ALL N EPISODES" toggle (default closed). Episodes are sorted by episode number; entries without a recognizable number (OAD, specials) sort to the end. Title text only — no thumbnails, no links.
- **ALSO LIKED (recommendations) section** — AniList's top 5 community recommendations for the anime. Each card shows a cover thumbnail, the English title (romaji if there's no English title), and a small format pill (`TV` / `MOVIE` / `OVA` / etc.) in the corner. Cards are clickable — they open that anime's AniList page in a new tab, same as the franchise rows. Filtered to anime only (no manga recommendations); recommendations pointing at removed entries are skipped.
- **STAFF section** — four key roles: Director, Series Composition, Music, Character Design, shown as `Role — Name` (not clickable). If AniList doesn't list those exact roles for an anime, the panel falls back to the four most-relevant production roles instead.
- **Graceful when data is missing** — anime AniList has no episode data for simply don't show the EPISODES section (no broken state); same for recommendations and staff. The panel still renders everything it can.

**Known limitations:**

- **Episode lists for long-running / ongoing multi-season anime can be incomplete or show a later season's episodes.** AniList sources its episode list from current streaming-service feeds (Crunchyroll, etc.), not from a curated per-season list. For an ongoing franchise where a later season is currently airing, AniList may return that season's episodes — typically a partial, out-of-order slice — under the source anime's query. The panel sorts what it gets by episode number for readability but doesn't try to repair AniList's upstream data. Franchise-episode aggregation (fetching each season's episode list and merging) is queued as a future enhancement that would resolve this for multi-season shows.
- **Episode coverage isn't 100%** — anime without episode data on AniList simply omit the EPISODES section.

**Implementation files:**

- `script.js` (~+163 / ~-12) — both AniList queries (`MORE_INFO_QUERY_BY_SEARCH`, `MORE_INFO_QUERY_BY_ID`) extended in lockstep with `streamingEpisodes`, `recommendations`, and `staff` field blocks (`streamingEpisodes` is `title`-only — no thumbnails/URLs; `staff` is role + romanized name only — no portraits); `fetchRelationsFromAniList` now returns the extended `{ sourceId, edges, streamingEpisodes, recommendations, staff }` shape, with an explicit `!media` failure guard added so all four named failure paths (HTTP non-200, GraphQL errors, no Media match, network throw) return the full empty shape — graceful-degradation contract preserved; recommendations are filtered to non-null `mediaRecommendation` + anime formats at the fetcher; staff is kept raw at the fetcher with the role whitelist applied in the renderer (so the cache stores the full data); `fetchRelationsForModal`'s no-cache-key fallback updated to the new empty shape, cache passthrough otherwise unchanged; `renderMoreInfoPanel`'s success state extended to append three new renderers — `renderEpisodeList`, `renderRecommendations`, `renderStaffCredits` — after the existing relation list; the three renderers placed between `renderMoreInfoEntry` and `toYouTubeEmbedSrc` at the IIFE's 2-space outer indent; episode list collapsed via a CSS-only `<details>/<summary>` when over 8 entries; recommendation cards reuse v1.6.8's `.more-info-entry--clickable` + `data-anilist-id` pattern so the existing modal click-delegation handles them with zero new event-handler branches.
- `style.css` (~+79) — new "v1.6.9 — Richer modal data" section between v1.6.8's `.more-info-loading, .more-info-empty` and the COMMUNITY SHEET STYLES block. 8 new classes, brand-consistent with v1.6.8 (no new color tokens): `.more-info-section-header` (cluster divider — matches `.more-info-title` typography + a bottom border); `.more-info-episodes` / `.more-info-episode-row` (compact title-text rows on `rgba(15,5,28,.45)` 6px-radius backgrounds); `.more-info-episodes-details summary` (the collapsible toggle — `list-style: none` + `::-webkit-details-marker { display: none }` for cross-browser disclosure-marker hiding, `:hover` background change); `.more-info-recommendations` (section wrapper — cards reuse v1.6.8's `.more-info-entry` styles and the nested `.more-info-list` layout); `.more-info-rec-format-badge` (small `TV`/`MOVIE`/`OVA` pill in the rec card corner, mirrors `.more-info-score-badge`); `.more-info-staff` / `.more-info-staff-row` (`Role — Name` text rows, transparent background, no row separator).
- No `admin/new-anime.js` change — the new field blocks are public-modal-only; the admin form doesn't need them.
- No `openModal` markup change — the new clusters render via `renderMoreInfoPanel`'s string output into the existing `.more-info-content` div.

Total: **~242 insertions / ~12 deletions** across 2 files (`script.js`, `style.css`) — plus the version-bump strings and the docs cascade in the gate-8/9 work.

Tier A — `script.js`, `style.css`, and the public anime modal are visitor-facing. `npm test` runs clean before commit at gate 10 (7/7 Playwright; the More Info panel's lazy-fetch path is not under test). Blake's local browser smoke verified Demon Slayer (26-episode list collapsing cleanly, 5 ALSO LIKED cards, 4 STAFF roles), Re:Zero (recommendations + staff render; the episode list reflects AniList's current-feed slice — the known upstream limitation noted above), and a coverage-gap title (EPISODES section absent, no broken state).

**Roadmap cascade:** none — v1.6.9 lands in its planned slot. v1.6.10 (multi-hop franchise traversal + per-entry studio dedupe — closes v1.6.8's two known limitations) is the next immediate ship; two scope additions captured from v1.6.9's smoke feedback: a format badge on the franchise relation rows (visually differentiate Movie/TV/OVA entries), and franchise-episode aggregation as a polish item (the multi-hop traversal infrastructure makes per-season `streamingEpisodes` fetch-and-merge natural). v1.6.11 (Suggestion Box + admin viewer) and the v1.7.x candidates (romaji subtitle, in-site secondary modal — the latter's scope grows to include an "if it's not in the catalog yet" indicator + watchlist hook on the ALSO LIKED cards) remain on their current slots.

<!-- author: Code | date: 2026-05-13 -->
## v1.6.8 — MINOR (2026-05-13)

**Visitors can now click "Click for More Info" on any anime modal to see that show's full franchise — every season as a card, every card a click-through to AniList.** This is Part B of the franchise scope split that began in v1.6.7 (admin-form aggregation was Part A; this is the visitor-facing surface). A collapsible tab on the far-left edge of the anime modal expands into a panel listing the show's prequels, sequels, parents and the current entry itself — each with a cover thumbnail, relation badge, English + romaji title, year / episode count / animation studio, and AniList community score. Every row opens that season's AniList page in a new tab for the deep-dive data the review and community panels don't cover (episode lists, staff, characters, ratings).

- **Collapsible "Click for More Info" tab** on the far-left of the anime modal. Closed by default — clicking expands the panel and shifts the modal contents right; an X on the panel collapses it back. The panel re-opens collapsed for every new anime modal (no carry-over).
- **AniList relations rendered as cards** — one row per related anime (relation types PREQUEL / PARENT / MAIN / SEQUEL, filtered to `type:ANIME` so manga / light-novel adaptations don't pollute the list). Each card: cover thumbnail (AniList `coverImage.large`), relation badge, English title with a smaller romaji subtitle line, `year · N eps · studio(s)` meta line, and AniList `averageScore` as a small badge.
- **MAIN row is visually distinguished** — the current anime (your review's subject) gets a subtle purple border highlight so it's clear which entry you're reading about. It's also fully clickable like every other row.
- **Chronological sort** — entries ordered by season year, with a type-order tiebreaker (PREQUEL < PARENT < MAIN < SEQUEL) for same-year ties — same ordering logic as v1.6.7's admin-form franchise panel.
- **Every row is clickable** — opens `anilist.co/anime/{id}` in a new tab. Per Blake's design call, this includes MAIN: a visitor can deep-dive the current anime's verified AniList data (full episode list, staff credits, character list, community ratings) without leaving the review page.
- **Lazy fetch + session cache** — no AniList request fires until the visitor expands the panel. Once fetched, re-opening the panel for the same anime in the same session is instant (in-memory cache, cleared on page reload).
- **Popularity-sorted search** — the source anime is resolved against AniList via `Page(media:, sort: [POPULARITY_DESC, SCORE_DESC])` (mirroring the admin form's pattern), so an ambiguous short title like "Demon slayer" resolves to Kimetsu no Yaiba — the most-popular match — instead of an obscure same-named entry.
- **Graceful degradation** — AniList errors, rate-limits, or no-match all render a friendly "No franchise info available yet." state instead of breaking the modal. A standalone anime (no franchise relations) still shows its single clickable MAIN row.
- **Brand-consistent styling** — purple gradient, Montserrat header pattern, Japanese subtitle (`詳細情報`), 12px radius — the same visual vocabulary as v1.6.7's admin franchise panel and v1.6.5's live-preview panel.

**Known limitations (queued for v1.6.10):**

- **Multi-hop relations not yet traversed** — fetching One Punch Man Season 1 catches Season 2 (a SEQUEL) but not Season 3 (AniList stores S3 as a SEQUEL of S2, one hop further out). Same single-hop scope as v1.6.7's admin aggregation; multi-hop is queued for v1.6.10.
- **Per-entry studio dedupe** — entries like Frieren Season 2 show `MADHOUSE, MADHOUSE` because AniList double-credits the same studio. Cosmetic; the one-line fix is bundled into v1.6.10.

**Implementation files:**

The data shape (`relations.edges.node`) and the aggregation logic were already in place from v1.6.7's admin-form work — v1.6.8 reuses the same shape and renders it in a different surface (the public modal instead of the admin form's sidebar). Three files touched:

- `script.js` (+309) — `findInCatalog()` helper (carried over from the initial click-through design, now unused after the gate-5c switch to universal AniList click-through; left in place, reaped in a future polish gate); a new self-contained "More Info panel" block — `ANILIST_ENDPOINT_PUBLIC` constant, `MORE_INFO_QUERY_BY_SEARCH` (popularity-sorted `Page(media:)`) + `MORE_INFO_QUERY_BY_ID` (direct `Media(id:)`) GraphQL strings, `buildMainNode()` (synthesizes the MAIN row from local catalog data + the AniList-resolved source id), `fetchRelationsFromAniList()` (returns `{ sourceId, edges }`, no-throw graceful-empty contract), `fetchRelationsForModal()` (in-memory cache wrapper), `renderMoreInfoPanel()` (pure HTML-string renderer, four states), `renderMoreInfoEntry()` (per-row markup); `openModal()` gains the `.more-info-container` markup (collapsed tab + expanded panel + header + content slot) as the modal's first column, plus three event listeners (tab-click expand+fetch+render, X-close, card-click → `window.open` AniList in a new tab).
- `style.css` (+210 / -1) — new "v1.6.8 — More Info panel" section (~205 lines): `.more-info-container` (collapsed 140px / expanded 260px width transition), `.more-info-tab` (the far-left pill), `.more-info-panel` (slide-out, purple gradient), `.more-info-close` (mirrors the sheet close button), `.more-info-header` + reuse of the existing `.jp-mini`, entry-row classes (`.more-info-entry`, `--current`, `--clickable` + `:hover`, `.more-info-cover` + `--placeholder`, `.more-info-relation`, `.more-info-english`, `.more-info-romaji`, `.more-info-meta`, `.more-info-score-badge`), and `.more-info-loading` / `.more-info-empty` fallback states; the `.modal.duo .modal-content` grid changes from `1.6fr 1fr` to `auto 1.6fr 1fr` (the auto column is the More Info container); a one-line `.more-info-container { width: 100% !important; }` rule added inside the existing `@media (max-width: 1000px)` block so the new column stacks with the sheets on narrow viewports.
- `admin/new-anime.js` (+2) — `coverImage { large }` added to the `relations.edges.node` block in both `FULL_QUERY` and `FULL_QUERY_BY_ID` (parity), so the admin form's `relations` payload carries the cover URLs the public panel renders. Purely additive — no admin-form behavior change.

Total: **521 insertions / 1 deletion** across 3 files (vs the v1.6.7 commit).

Tier A — `script.js`, `style.css`, and the public anime modal are visitor-facing. `npm test` runs clean before commit at gate 10 (7/7 Playwright; the More Info panel's lazy-fetch path is not under test). Blake's local browser smoke verified the panel across Demon Slayer (multi-season franchise rows), Re:Zero, and a standalone title — collapsed tab → expand → AniList rows render with covers + badges + meta + scores → every row click-through to AniList in a new tab → X collapse. Three internal iteration passes (gate 4b re-indent for IIFE consistency; gate 5b query split fixing an AniList null-constraint 404; gate 5c popularity-sort fixing the "Demon slayer → Onigiri" misresolve plus the universal-click-through behavior change) folded into the final result.

**Roadmap cascade:** none — v1.6.8 lands in its planned slot. v1.6.9 (richer modal data — per-episode names + recommendations + staff credits) and v1.6.10 (multi-hop franchise traversal + per-entry studio dedupe — closes the two limitations noted above) remain on their current slots.

<!-- author: Code | date: 2026-05-12 -->
## v1.6.7 — MINOR (2026-05-12)

**The admin form now aggregates franchise data automatically when fetching multi-season anime.** Fetching One Punch Man pulls Season 1 + Season 2 + Road to Hero in one go and prefills the form with franchise totals (3 entries, 25 episodes, MADHOUSE / J.C.STAFF studio union) instead of just Season 1's data. A new FRANCHISE INFO panel surfaces the related entries (prequels, parents, sequels) in chronological order; an amber heads-up warning fires when the fetched entry has a PREQUEL, pointing toward the cleaner Season 1 fetch.

- **New FRANCHISE INFO panel** in Section 2 of the admin form. Populated automatically when AniList's `relations` field includes a franchise chain (relation types: PREQUEL / PARENT / MAIN / SEQUEL, filtered to `type:ANIME` so manga / light novel adaptations don't pollute the aggregate). Hidden for single-season entries. Brand-consistent styling (purple gradient, Montserrat header with `フランチャイズ` subtitle) mirrors the v1.6.5 live preview panel.
- **Seasons field now prefills from franchise season count** when aggregation finds multiple entries (e.g. `3 seasons` for OPM). Falls back to the existing single-entry format heuristic (`1 season` / `1 movie` / `1 ova` / etc.) when aggregation produces a single entry.
- **Studio field now unions all animation studios across franchise entries** when the count is >1 (e.g. `MADHOUSE, J.C.STAFF` for OPM where Season 1 was Madhouse and Season 2 was J.C.Staff). Falls back to the single-entry `pickAnimationStudios()` pick otherwise. Case-insensitive dedupe via Map keyed on lowercased name; original capitalization preserved through the existing `maybeCapitalize` helper (which intentionally doesn't transform all-caps studio names like `MADHOUSE`).
- **AniList summary line appends `franchise: N entries, X ep`** when aggregation finds multiple entries. Single-season fetches keep the old 3-part summary (`AniList ID · score · romaji title`) unchanged.
- **New amber `'warn'` status-kind** for hint-level messages — the PREQUEL heads-up reads *"Heads up: this entry has a PREQUEL on AniList — aggregation may miss earlier seasons. For the cleanest franchise data, fetch Season 1."*. Distinct visual treatment (`color: #ffb84d`) from the existing `'info'` (default neutral) and `'error'` (red) kinds. One-line surgical extension of `setStatus()` at the existing site.
- **Single-hop traversal scope.** Aggregation walks ONE hop of `media.relations.edges` from the fetched entry. **Known limitation:** late-chain seasons won't appear if AniList stores them under another season's SEQUEL relation. Canonical example: fetching OPM Season 1 catches PREQUEL Road to Hero and SEQUEL Season 2, but does NOT catch Season 3 (AniList stores it as a SEQUEL of Season 2). Acknowledged honestly here; multi-hop is queued for a future polish ship — see `docs/NEXT.md` v1.6.x polish backlog entry added in this ship's gate 9.

**Implementation files (Part A scope — admin form only):**

Part B ("More Information" panel on public anime modal) was split out to v1.6.8 at gate 0/1 per the lower-blast-radius recommendation — Part A and Part B share the same `relations` data shape but render in different surfaces, and shipping the admin-form aggregation first lets the next-anime-add immediately benefit while v1.6.8's public-modal panel work proceeds independently. v1.6.7 touches three admin-only files:

- `admin/new-anime.js` — `FULL_QUERY` and `FULL_QUERY_BY_ID` expanded with the `relations` block (+32 lines, parity for search-by-title and fetch-by-ID paths); new `aggregateFranchise()` helper with a `TYPE_ORDER` constant (`PREQUEL: 0, PARENT: 1, MAIN: 2, SEQUEL: 3`) used as the secondary sort key so same-year ties resolve in natural reading order (+56 lines including comment); `populateForm()` updated with 5 surgical edits (franchise computation up front, franchise-aware seasons logic, franchise-aware studio union, multi-part `anilist-summary`, PREQUEL warning + `renderFranchisePanel(franchise)` call before `updatePreview()`); new `renderFranchisePanel()` helper (~37 lines, pure-DOM, no async, reuses existing `$()`/`escapeHtml`/`maybeCapitalize`); one-line `setStatus()` extension for the new `'warn'` kind.
- `admin/new-anime.html` — new `#franchise-info-panel` block in Section 2 between the section head and the admin grid (+13 lines). IDs: `franchise-info-panel`, `franchise-season-count`, `franchise-total-ep`, `franchise-studios`, `franchise-entries` (each consumed by `renderFranchisePanel()`).
- `admin/new-anime.css` — new FRANCHISE INFO panel section at end of file (+90 lines): `.franchise-info-panel`, `.franchise-info-header` + `.jp-mini`, `.franchise-info-stats`, `.franchise-entries` row styling, plus the `.status-line.warn` amber variant.

Total: **269 insertions / 7 deletions** across 3 files. The 7 deletions are existing single-entry heuristic lines being replaced surgically by franchise-aware logic — no behavior loss, just decision-point swaps.

Tier A — admin form behavior change visible to admin user (UID-gated; visitor-facing path is unchanged in this ship). `npm test` runs clean before commit at gate 10 (7/7 Playwright; admin-form path not under test). Blake's local browser smoke verified Test 1 (OPM by ID 21087) end-to-end with all 5 visual criteria; Tests 2 (Frieren via search-as-you-type) and 3 (Charlotte single-season fallback) confirmed before ship.

**Roadmap cascade:** previously-queued v1.6.7 (the full panel-on-modal + aggregation bundle) split into Part A (this ship) + Part B (v1.6.8 — More Information panel on the public anime modal). Previously-queued v1.6.8 (Suggestion Box + admin viewer) shifts to v1.6.9.

<!-- author: Code | date: 2026-05-11 -->
## v1.6.6 — PATCH (2026-05-11)

**Hotfix: cover images now fill the anime card frame cleanly.** Switched `.card img` from `object-fit: contain` to `object-fit: cover` in `style.css:218` so AniList covers (and any source image not pixel-perfect 2:3) crop a few invisible edge pixels rather than letterboxing with visible dark bars inside the card frame.

- `style.css:218` — `object-fit: contain` → `object-fit: cover` on the `.card img` rule. Pure `+1 / -1` diff. Affects both homepage cards (via `card-render.js`'s output) AND the admin form's live preview slot (which inherits the rule via the shared `.card` class).

**Why it slipped through v1.6.5:** the rule was authored long before AniList sources came into use, and the project's 44 curated `assets/*.png` cover images happen to be ≈2:3 (most are 460×686, exactly the form copy's recommended ratio) — so `contain` and `cover` produced identical output in the live catalog. v1.6.5's live preview was the first feature to pipe an AniList CDN URL into a `.card` element, and AniList covers aren't always strictly 2:3 (the Gosick example Blake hit during v1.6.5 smoke is ~420×590, ratio 1:1.405 vs. 2:3's 1:1.5). Visible bars appeared. Queued in `docs/NEXT.md` v1.6.x as a polish ship; addressed here as a same-day hotfix since the AniList live-preview entry path was a v1.6.5 deliverable and visible-broken cards undermine the feature's value.

Tier A — `style.css` is visitor-facing (homepage cards). `npm test` ran clean (7/7 in 15.6s). Blake's local browser check confirmed: live preview card now shows the AniList cover filling the card frame, no empty bars.

<!-- author: Code | date: 2026-05-11 -->
## v1.6.5 — MINOR (2026-05-11)

**Live preview as you type ships for the admin form — type a title (search-as-you-type dropdown) or paste an AniList URL/ID, see the prefilled form AND a live preview card that mirrors the homepage card rendering 1:1, with the preview panel staying pinned as you scroll through edits.** The headline is the live preview, but the enabling refactor is the bigger structural shift: the card-render function moves out of `script.js`'s IIFE into a shared `card-render.js`, so both the homepage and the admin form draw cards from the same code — no fork, no drift, no copy-paste duplication. This is also the first ship driven by the multi-gate Code/Cowork workflow with rolling `docs/SHIP-PROMPT.md` + `docs/SHIP-OUTPUT.md` files; gate-level browser smoke tests caught two bugs pre-commit that would have shipped under the previous "test then ship" rhythm.

- `card-render.js` (NEW) — 92-line classic-script file containing the extracted `renderAnimeCardMarkup` and a local `slug()` helper. IIFE wrapper keeps everything local except one `window.renderAnimeCardMarkup = …` global attachment. Loaded by `index.html`, `account.html`, and `admin/new-anime.html` via `document.write` BEFORE any module so the function is reachable from module code. WHY-block comment in the file explains the byte-equivalence requirement (homepage must render identically post-refactor) and the slug duplication rationale (5-line cost beats touching `script.js`'s 6 other slug call sites).
- `script.js` — 44-line inline `renderAnimeCardMarkup` definition removed; `createCard` now calls `window.renderAnimeCardMarkup(...)` explicitly (explicit-form picked over implicit-global so a future local rename in `script.js` can't silently shadow). 5-line comment replaces the removed function explaining where it lives now.
- `admin/new-anime.js` — search-as-you-type wired on the title input (250ms debounce, AniList `Media(search:)` returns up to 8 results); arrow-key + Enter keyboard nav on the dropdown; click-outside dismisses; second entry path "Fetch by AniList ID or URL" parses bare numerics and `anilist.co/anime/<id>/…` URLs; `populateForm` now drives a live preview card that re-renders on title/genre/rating edits via a 120ms debounce; image-override toggling re-renders the preview in real time. Feature was originally spec'd in `docs/mode1-design.md` §7 ("Live preview as you type").
- `admin/new-anime.html` — Section 1 grows a sticky `<aside class="admin-card-preview-panel">` for the live preview; new `<input id="anilist-id-input">` + Fetch-by-ID button as a co-equal entry point per the `b+` design in `docs/NEXT.md`; Section 1 header renamed "Find the anime on AniList" → "Find the Anime" (the AniList qualifier was internal-jargon for the form's first-time admin user); `<script src="../card-render.js?v=${v}">` document.write injection before module loads.
- `admin/new-anime.css` — sticky preview panel (`position: sticky; top: 20px`), search-results dropdown (purple-tinted, brand-consistent), keyboard-highlight state, ID-input row layout, preview-slot frame.
- `style.css` — `html, body { overflow-x: hidden }` → `overflow-x: clip`. `clip` provides identical no-horizontal-scroll behavior as `hidden` but doesn't establish a containing block for `position: sticky` descendants. Browser support: Chrome 90+, Firefox 81+, Safari 16+ — all evergreen browsers as of 2026, no fallback needed. The classic CSS sticky-breaker that almost every codebase trips into once; commented in-place so a future "cleanup" can't revert it without seeing the why.
- `admin/new-anime.js` (gate 5c title-case fix) — `populateForm` overwrites the title input with AniList's canonical title (English → romaji → preserve-typed-value precedence) so saved data matches the show's official spelling. Caught at gate 5c smoke: typing `gosick` (lowercase) loaded `GOSICK` from AniList correctly, but the form kept the user's lowercase input — would have entered the catalog as `gosick`. Same expression pattern as the dropdown's `renderSearchResults` so display + save logic agree.
- `firebase.json` — `docs/SHIP-PROMPT.md` and `docs/SHIP-OUTPUT.md` added to the `ignore` array (rolling Cowork prompt + Code output files used during multi-gate ships should never deploy). Same `.gitignore` ↔ `firebase.json` mirroring discipline that fixed the v1.3.5 PERSONAL.md leak and v1.3.9 AUDIT_*.md leak.
- `scripts/bump-version.js` — header docstring + new TARGETS `NOTE:` comment clarify that TARGETS manages 14 STATIC version strings (CSS `<link>` cache-busts + the `APP_VERSION` script tag + the changelog widget span fallback). All JS file cache-busts (`script.js`, `firebase.js`, `admin-fab.js`, `account.js`, `new-anime.js`, `card-render.js`) use runtime template-literal interpolation (`${v}`) in `document.write` and are intentionally NOT in TARGETS — adding them would replace the `${v}` template with a concrete version on the first bump, corrupting the dynamic-versioning pattern. Documented as a deliberate deviation from Cowork's gate 5b spec which had assumed TARGETS should grow to 17.
- `index.html` widget content — one bullet stamped `05/11/2026` per the visitor-first widget skill: "Improved the tools used to add new anime to the catalog." Single bullet because all four pieces (refactor, search-as-you-type / ID-import / live preview, sticky fix, title-case fix) collapse to the same visitor-side delta (zero — admin form is UID-gated); multiple bullets all saying "improved" would dilute the per-change granularity rule. Bullet prepended to the existing `05/11/2026` section's `<ul>`; total visible widget now at the 10-bullet cap.

**Multi-gate browser smoke tests caught two plan-level misses pre-commit.** Gate 1's extraction plan assumed `script.js` was loaded in the admin-form context — it wasn't, because `admin/new-anime.html` only loads `firebase.js` + `new-anime.js` modules, not `script.js`. So `window.renderAnimeCardMarkup = …` assigned but the function was never defined in the admin-form's window. Gate 5b's interactive smoke surfaced this immediately (`typeof window.renderAnimeCardMarkup === 'undefined'` in the admin form console); the card-render.js extraction (above) is the proper fix. Gate 5c surfaced the second: the gosick title-case bug detailed in its own bullet above. Both bugs lived in working-tree code, not yet committed; both were caught by paused-for-review interactive verification BEFORE the commit existed — exactly the "test the pipeline at the commit you're shipping" discipline codified in the v1.6.2 DECISIONS lesson, now applied at the gate level rather than only at the ship level.

Tier A — `card-render.js`, `script.js`, both HTMLs, both CSS files, the admin form JS, and the widget content are all visitor-facing (homepage path) and admin-facing (admin form path). `npm test` ran clean at gate 5b (Playwright 7/7 in 14.3s) and again at gate 5c (7/7 in 15.5s). Live preview, search-as-you-type, ID-import, sticky panel, label rename, and title-case fix all verified in browser at `http://127.0.0.1:8888/admin/new-anime` before any code committed.

**Visitor-side reality:** nothing visible changes for site visitors. v1.6.5's work is admin tooling — the new-anime form is UID-gated, the homepage card rendering is byte-equivalent to v1.6.4 (`card-render.js` extraction was specifically gated on visual byte-equivalence), and the only visitor-touchable change is the one widget bullet ("Improved the tools used to add new anime to the catalog.") in the changelog box. The widget bullet's voice is honest: no version reference, no internal terms, no overclaim.

Roadmap cascade: v1.6.6 (More Information panel) and v1.6.7 (Suggestion Box) stay on their current slots — v1.6.5 lands on schedule and unblocks both successors.

<!-- author: Code | date: 2026-05-11 -->
## v1.6.4 — MINOR (2026-05-11)

**Update log widget upgrade — first feature ship under the new visitor-first widget skill.** The homepage update log gains shipped-on dates on every change, date-grouped sections (replacing the old flat list), capacity raised from 5 to 10 most-recent entries, and internal scroll containment so the widget no longer pushes the rest of the homepage down when content accumulates. The widget skill is updated in the same ship to codify the new rules.

- `index.html` — widget content area restructured from a flat `<ul class="changelog-list">` into nested `<div class="changelog-content">` → `<div class="version-section">` blocks, each with an `MM/DD/YYYY` `<div class="version-header">` above its bullets. Existing five production bullets retroactively distributed under their ship-date headers (`05/10/2026` for the four v1.6.0 entries; `05/11/2026` for the v1.6.3 backfill).
- `style.css` — added `.changelog-content` (max-height 300px + overflow-y auto + custom purple-gradient scrollbar matching the project palette), `.version-section`, `.version-header` (muted soft-white at 55% opacity, ~0.78rem Montserrat). No upstream changes to existing widget rules.
- `docs/SKILLS/widget-update-skill.md` — six surgical edits: cap raised 5 → 10, new "date header" rule item, granularity callout added to the curation table, multi-piece-ship example added to Good vs Bad, structural HTML example refreshed to match the actual widget (the old example referenced classes that didn't exist), backfill-consolidation section removed entirely, "Why this skill exists" trade-off paragraph updated for the new cap. Voice guidelines section unchanged.
- `index.html` widget content (per the new per-change rule) — four bullets stamped `05/11/2026`: "Added shipped-on dates to the update log," "Grouped the update log so changes appear by date," "Made the update log show 10 entries instead of 5," "Made the update log scroll inside its panel."
- `ROADMAP.md`, `docs/NEXT.md`, `docs/AI-PRIMER.md` — cascade for the deferred live-preview ship: live preview + ID-import → v1.6.5, More Information panel → v1.6.6, Suggestion Box → v1.6.7, TBD upgrades → v1.6.8+.

**AniList recovery note:** AniList's `Media(search:)` endpoint recovered partway through this session after ~36 hours down (verified against six titles including Vinland Saga, Naruto, Frieren). v1.6.5 (live preview + ID-import per the `b+` design) is unblocked once this widget upgrade ships.

Tier A — `index.html`, `style.css`, and the widget bullets are all visitor-facing. `npm test` ran clean (Playwright 7/7).

<!-- author: Code | date: 2026-05-11 -->
## v1.6.3 — PATCH (2026-05-11)

**Polish bundle + first widget update under the new visitor-first skill.** Originally scheduled for the live-preview-as-you-type Mode 1 feature, but that's deferred to v1.6.4 — AniList's `Media(search:)` endpoint has been returning `Not Found` for 30+ hours and the live-preview UX literally requires it. Shipped instead: small overdue items.

- `scripts/mode1-server.js` — `/api/health` reads `APP_VERSION` dynamically via the existing `readCurrentVersion()` helper instead of hardcoding (was stuck at `"1.6.1"` after v1.6.2 bumped past it). Drift class closed.
- `docs/SKILLS/release-skill.md` — new Step 4.5 ("Update the widget bullets") between the CHANGELOG step and the ROADMAP step, referencing `widget-update-skill.md`.
- `docs/SKILLS/hotfix-skill.md` — new decision #6 ("Widget bullets are required even for hotfixes"), names v1.6.1 as the precedent for the gap that v1.6.3 backfills.
- `docs/AI-PRIMER.md` — "For deeper context" section now lists all three skill files so new sessions find the procedure docs from the primer.
- `index.html` — homepage widget bullets updated under the new skill. One combined backfill bullet ("Made some behind-the-scenes improvements to how the site is built. Nothing visible changes.") covers v1.6.1 + v1.6.2 + v1.6.3 — all three tooling ships that didn't curate bullets at ship time. Per the skill's first-time-visitor rule, bullet doesn't reference any version. (Note: `account.html` not edited — the widget lives only in `index.html`, contrary to what the original `widget-update-skill.md` claimed; see next bullet.)
- `docs/SKILLS/widget-update-skill.md` — corrected a factual error in the "Where the bullets live" section: only `index.html` hosts the widget, not both files as the initial version of the skill claimed. Caught at gate 6 prep while reading the actual file structure — literally the verification discipline the v1.6.2 DECISIONS entry advocates, applied to the very skill being introduced.

Roadmap cascade: live preview as you type → v1.6.4 (with ID-import as first-class entry point — AniList outage exposed that ID-import is durable infrastructure, not a workaround), More Information panel → v1.6.5, Suggestion Box → v1.6.6.

Tier A — widget bullet in `index.html` is visitor-facing. `npm test` ran clean (gate 6).

<!-- author: Code | date: 2026-05-11 -->
## v1.6.2 — PATCH (2026-05-11)

**Prevention follow-up to Bug 10.** Mode 1 server now smoke-checks `runCmd` at startup — runs `npm --version` and `git --version` through the same code path the pipeline uses, before `app.listen()`. If either spawn throws (e.g., `spawn EINVAL`), the server exits with an error message that names Bug 10 by name, points at the WHY comment above `runCmd`, and (for `EINVAL` specifically) suggests the most likely regression cause.

- `scripts/mode1-server.js` — new `smokeCheckSpawn()` (~20 lines) placed near the existing pre-flight helpers; called via `.then()` before the `app.listen()` block.
- `docs/DECISIONS.md` — new entry "When you touch a pipeline's plumbing, re-run the pipeline at the commit you're shipping (lessons from Bug 10)" capturing the meta-lesson: pre-ship testing on prior-state code doesn't validate the post-edit code. The spawn config was the surface bug; the verification discipline is the structural fix.
- `docs/NEXT.md` — added "Playwright test for Mode 1 server using `?skipPush=1`" under Polish + tech debt (queued behind v1.6.3 live preview).

Tier B — Mode 1 server is tooling, not deployed to production. Tests not required per `CLAUDE.md` rule #7 (tooling exception). Manual verification before ship: ran the synthetic Mode 1 pipeline against AniList ID 21507 (Mob Psycho 100, fetched by ID since AniList search has been flaky) with `?skipPush=1` — smoke check ran cleanly at startup, all 9 pipeline steps completed green, no public footprint (synthetic ship rolled back).

Roadmap cascade: previously-queued v1.6.2 (live preview as you type) → v1.6.3, v1.6.3 (More Information panel) → v1.6.4, v1.6.4 (Suggestion Box) → v1.6.5.

<!-- author: Code | date: 2026-05-10 -->
## v1.6.1 — PATCH (2026-05-10)

**Hotfix: Mode 1 local server crashed at `npm test` on Windows + Node ≥20.12.2 with `spawn EINVAL`.** Reverted v1.6.0's `shell: false` + `.cmd`-extension change in `runCmd` back to `shell: true` for npm/npx/firebase.

- `scripts/mode1-server.js:60-72` — `runCmd` reverted to original spawn pattern; added a 17-line WHY comment naming Bug 10 and explaining DEP0190 doesn't apply (every `args[]` in this file is a static string literal — no user input flows into npm/firebase/npx).

This slipped through because v1.6.0's pre-ship Playwright suite ran via the `Bash` tool, not via the Mode 1 server pipeline — `runCmd` was never exercised. Caught immediately during the post-deploy "Mob Psycho 100" sanity test, before any user-visible damage. (The Bug 9 image-registration fix was confirmed working in the same test run.)

Tests not required per `CLAUDE.md` rule #7 (tooling exception — Mode 1 server isn't deployed to production). `npm test` was run anyway as a sanity check that the test pipeline itself isn't broken: 7/7 passed in 11.4s.

Bundled in this commit: `docs/SKILLS/hotfix-skill.md` (this skill, used to ship the hotfix it documents); `docs/NEXT.md` (persistent backlog file added by Cowork); `docs/AI-PRIMER.md` updated to current state; ROADMAP cascade — what was queued as v1.6.1 (live preview), v1.6.2 (More Information panel), v1.6.3 (Suggestion Box) shifts to v1.6.2 / v1.6.3 / v1.6.4 respectively.

<!-- author: Code | date: 2026-05-10 -->
## v1.6.0 — MINOR (2026-05-10)

**Phase B begins: Mode 1 baseline + local "one-click ship" server.** Adding a new anime drops from "edit JS by hand, copy to Excel manually, hope you got the format right, run sync, run tests, bump version, commit, push, deploy" down to **type a title, write a review, click Submit & Ship.** The local Node server orchestrates the whole pipeline in ~30 seconds with a real-time progress stream.

**Two ship modes (auto-detected by the form):**

- **Local mode** — `npm run mode1` starts an Express server on `http://localhost:8888`. Form detects the server, button reads "Submit & Ship", clicking it runs the full 9-step pipeline (Excel backup + append → image download → sync → widget update → version bump → CHANGELOG entry → tests → git commit + push → Firebase deploy) with SSE-streamed progress. Pauses for explicit confirmation before the production deploy.
- **Remote (deployed admin form, fallback)** — same form at `realanimereviews.com/admin/new-anime`, but no server reachable → button reads "Generate Excel Row" → outputs a tab-separated row + command sequence to run locally. Same data model, just two-step.

**New entry point:** floating "Admin" pill in the bottom-right corner of every page (visible ONLY when signed in as admin per UID match). Click → dropdown menu of admin tools → "+ Add Anime" navigates to the form. Designed to extend — future Mode 2 dashboards, audit views, etc. plug into the same `ADMIN_MENU_ITEMS` array.

**The form itself:**
- Type title → AniList GraphQL fetch (browser-side, CORS-friendly, no backend needed)
- Pre-fills genre, seasons, description (trimmed to ~600 chars), studio (with auto-capitalization for all-lowercase names), trailer (auto-normalized to `/embed/`), official streaming list, top 8 high-rank tags
- Image preview shows AniList default cover with dimensions and a "⚠ not 2:3" warning if aspect ratio is off; **Override** button reveals a filename input for Blake's manual file (per project rule #9 hybrid image curation)
- Watch is split into Official (green badge, AniList prefills) and Unofficial (orange badge, Blake fills) — combined + deduped on save
- Custom number stepper for Top 10 Rank (matches site purple gradient instead of browser default arrows)
- Inline AI suggestion panels next to Description and Tags — open Claude with a pre-filled prompt, paste response back, Use this populates the field. (Real one-click integration via Cloud Function planned in v1.6.x — see `docs/ai-integration-design.md`.)

**Mode 1 server safety baked in:**
- **Pre-flight checks** before any mutation: Excel lock file detection (friendly error if Excel is open), duplicate-title check against existing animeData.js
- **Excel backup** (`.bak.<timestamp>.xlsx`) before every write — recovery path for failed ships since git can't roll back Excel
- **Image overwrite refused** — server throws if `assets/<slug>.png` already exists (curated assets protected)
- **Slug-based image fallback in sync** — if the new entry has no prior animeData.js entry, sync looks for `assets/<slug>.png` (or .jpg/.webp) before falling back to placeholder. The Mode 1 download lands at exactly that path.
- **Override post-patch** — if Blake provided a custom filename, server patches animeData.js after sync to use it
- **Tests must pass** before commit — chain stops on `npm test` failure
- **Production deploy requires explicit UI confirmation** — server pauses with `awaitingDeploy: true`, form shows a "Yes, deploy now" button
- **Scoped git add** — only commits files this ship is supposed to touch (CHANGELOG, animeData.js, HTMLs, the new image), leaves unrelated WIP alone
- **`?skipPush=1` flag** for testing — runs everything except push and deploy, leaves zero public footprint
- **ANSI escape stripping** in log streams — server console output is readable in the form's collapsible "Show server output" details panel
- **No `shell: true` for git/node** — eliminates Node 22's DEP0190 deprecation warning AND the previous arg-mangling bug from cmd.exe quote handling

**Tooling extended:**
- `scripts/mode1-server.js` — the local Express server (~400 lines). One command: `npm run mode1`.
- `scripts/sync-excel-to-js.js` — added `slugify()` helper + slug-based image fallback (Bug 9 fix from the testing report).
- `scripts/bump-version.js` — extended from 7 to 14 version-string targets (added admin-fab.css cache-busts in index/account, plus 5 in admin/new-anime.html).
- `package.json` — added `express ^4.21.0` dev dependency, `mode1` npm script.

**New documentation:**
- `docs/mode1-design.md` — full architecture for the form + server, file layout, security model, upgrade arc through v1.6.x.
- `docs/ai-integration-design.md` — three-option plan for upgrading the inline AI panel from copy/paste to one-click (Cloud Function recommended).

**What's NOT in v1.6.0** (saved for v1.6.x):
- Live preview as you type (search-as-you-type AniList dropdown + live card preview)
- "More Information" panel on cards (left-side mirror of Community Tab)
- Suggestion box integration (public form + admin queue + handoff)
- Real one-click AI integration (replacing the current paste-back workaround)
- One-click full automation without the deploy confirmation gate

**Tested by Code** in a separate session via the `?skipPush=1` test path (Vinland Saga end-to-end). All 9 pipeline steps green; 8 bugs surfaced and fixed before this ship; clean rollback verified via Excel `.bak` restore + `git stash`. See test report from 2026-05-10 for details.

**Tests required and passed** (Tier A — production code change). Per project rule #7.

**Up next:** v1.6.1 polish — live preview as you type (search dropdown + live card preview). Then v1.6.2+ per the Phase B upgrade arc.

<!-- author: Code | date: 2026-05-09 -->
## v1.5.1 — PATCH (2026-05-09)

**Top 10 rank #1 corrected.** Excel had Farming Life in Another World listed as #1 (typo); should have been The Eminence in Shadow. Fixed in `Anime_Master_Table.xlsx`, propagated to `animeData.js` via the v1.5.0 sync pipeline. First real-world use of `npm run sync` for a content update — pipeline worked as designed.

<!-- author: Code | date: 2026-05-09 -->
## v1.5.0 — MINOR (2026-05-09)

**Phase A complete: Excel → animeData.js sync ships.** `Anime_Master_Table.xlsx` is now genuinely canonical for anime data per project rule #1. The hand-copy workflow that's been in place since launch is replaced by a single command: `npm run sync` reads Excel, transforms, validates, regenerates `animeData.js`. v1.5.0 is the foundation that makes Mode 1 (v1.6.0+) possible.

**New tooling:**
- `scripts/sync-excel-to-js.js` — Node script with `--dry-run`, `--validate`, and `--check` modes. Reads `.xlsx` via the `xlsx` Node library. Documented in `docs/SKILLS/release-skill.md` and `docs/schema-diff.md`.
- `xlsx@^0.18.5` added as a dev dependency. Run `npm install` once after pulling. The `npm audit` warning about `xlsx` is for malicious-user-input scenarios; not relevant when processing your own master file.
- `npm run sync`, `npm run sync:check`, `npm run bump`, `npm run anilist` shortcuts added to `package.json`.

**Excel structure: 12 existing columns + 5 new:**
- Existing: `Title, Rating, Seasons, Genre, Description, Review, Tags, Watch, Studio, Trailer, FORMAT:, EXAMPLE:`
- Added 2026-05-09: `Top10Rank, AniListId, IdMal, AniListScore, AniListColor` (last four empty until Mode 1 starts populating in v1.6.0)
- `FORMAT:` and `EXAMPLE:` are reference-only and ignored by the sync script

**Transformations the sync script applies:**
- `Tags`: Excel format `#action #fan service #OP MC` → JS array `["action", "fan-service", "op-mc"]`
- `Watch` → `Platforms`: comma-split with auto-detection of merged platform names (e.g., `Netflix hianime` → `["Netflix", "hianime"]`)
- `Trailer` URL normalization: `youtu.be/X?si=...`, `youtube.com/watch?v=X`, and bare `youtube.com/X` all auto-normalize to `https://www.youtube.com/embed/X`. Sync no longer fails on share URLs.

**Fuzzy title matching** preserves existing image filenames despite drift between hand-typed `animeData.js` and Excel: case-insensitive, curly apostrophes (`’`) normalized to straight (`'`), Unicode dashes (`−` `–` `—`) normalized to hyphen-minus (`-`), whitespace collapsed. 41 of 44 entries matched on first run; remaining 3 resolved via in-Excel typo fixes and one manual post-sync image patch.

**Validation rules** (sync FAILS on any of these):
- Title required, no duplicates
- Rating matches `X/10` or `X.Y/10`
- Trailer matches `https://www.youtube.com/embed/<id>` after normalization
- Genre, Description, Review, Tags, Watch all non-empty

**Image curation per project rule #9 (hybrid):**
- Existing entries: image filename preserved from current `animeData.js` via fuzzy title match
- Genuinely new entries: `placeholder.png` + warning logged. Mode 1 (v1.6.0) will auto-download covers from AniList.
- v1.5.0 ship: Apocalypse Bringer Mynoghra received a manual one-line image patch after sync (subtitle change made the fuzzy match miss; existing `apocalypse-bringer.png` re-linked)

**44 anime resynced.** `animeData.js` regenerated end-to-end. File diff: −860 bytes (script writes consistent JSON-style escaping vs prior hand-edits). All 7 Playwright tests pass against the new file. Web server log shows every cover image returning HTTP 200.

**Three Excel typos fixed by Blake during this ship:**
- Solo Leveling: `Shoen/Action` → `Shonen/Action`
- Frieren: Beyond Journey's End: `Fantasty/Drama` → `Fantasy/Drama`
- The Dangers in My Heart: `Romance/Slife of Life` → `Romance/Slice of Life`

Plus one DanDanDan → DanDaDan correction (the official transliteration of ダンダダン uses 2 n's, not 3).

**Top 10 list now editable in Excel** via the `Top10Rank` column (1-10 integer; empty = not in top 10). Position #8 currently empty by Blake's choice.

**Tests required and passed** (Tier A — production code change). Per project rule #7.

**What's next:** Phase B begins. v1.6.0 ships Mode 1 baseline (form-based new-anime creation with AniList prefill, admin UID gate). `docs/anilist-spike.md`, `docs/CODE-PROMPTS.md §1`, `docs/SKILLS/release-skill.md`, and `scripts/anilist-fetch.js` are all ready inputs.

<!-- author: Code | date: 2026-05-09 -->
## v1.4.3 — PATCH (2026-05-09)

**Tooling and docs infrastructure ship.** No production-facing code touched. Tests not required per docs-only/tooling exception in `CLAUDE.md` rule #7.

**Repository relocated.** Project moved from `C:\Users\Owner\Real Anime Reviews\` to `C:\Users\Owner\PROJECTS\Real Anime Reviews\` (next to other projects like CV Builder, PickleClipper). Same-drive Windows move, atomic. All 896 files preserved including `.git`, `Master List/`, `node_modules/`. Git remote URL updated separately during the move session from `ReaIGodzilla/real-anime-reviews.git` to `joewolters/real-anime-reviews.git` (consistent with the v1.4.2 owner-rename).

**New tooling:**
- `.gitattributes` — line-ending normalization (`* text=auto` plus per-extension overrides for `.sh`, `.json`, `.bat`, etc., and `binary` markers for images and Office docs). Permanently prevents the CRLF↔LF phantom-diff churn that surfaced earlier in this session — 9 files showed thousands of "changed" lines that were actually identical when whitespace was ignored.
- `scripts/bump-version.js` — Node script that updates the 7 version strings documented in `CLAUDE.md`'s "Version bump checklist" in one command. Modes: `node scripts/bump-version.js 1.5.0` to bump, `--dry-run` to preview, `--check` to verify all 7 strings agree (catches drift). Real-world test: this version bump (1.4.1 → 1.4.3) was the script's first live use.

**New documentation in `docs/`:**
- `anilist-spike.md` — full AniList GraphQL API reference with ready-to-paste queries, schema mapping to current `animeData.js`, and design recommendations for Phase A (v1.5.0) and Mode 1 (v1.6.0). Closes Phase A pre-work step 1.
- `AI-PRIMER.md` — 60-second orientation for any new AI session. Distills CLAUDE.md, ROADMAP.md, ARCHITECTURE.md, and DEPLOYMENT.md into the minimum context needed to start work without re-deriving everything.
- `CODE-PROMPTS.md` — 8 copy-paste prompts for common Code (CLI tool) tasks: add new anime, fix audit item, investigate bug, ship PATCH bundle, docs-only change, verify-only pass, preview deploy, audit-first cleanup. Each baked with show-don't-do, surgical-edits, version-bump-checklist discipline.
- `DECISIONS.md` — the WHY behind 18+ project decisions that aren't obvious from code (Excel-canonical, Mode 1/2 separation, image-curation rule, no-monetization, vanilla-no-framework, etc.). Future Blake and future AIs both forget the why fast; this preserves it.

**Project rule #9 updated — hybrid image curation.** SUPERSEDES the 2026-04-30 "always human" rule. New rule: Mode 1 fetches the AniList cover image and pre-populates it on the new-anime form as the default. Blake can either accept the AniList default with one click, or override by dropping a custom image into `assets/` and selecting it from the file dropdown. Mode 1 never silently changes images; the form always shows what's about to ship and Blake confirms before save. Mode 2 is NOT permitted to swap images on existing anime — image changes are always Blake-initiated. Mode 1 v1.6.0 spec in `ROADMAP.md` updated to match (image preview slot + Override button instead of always-required file selector). Full reasoning preserved in `DECISIONS.md`.

**Why these changes ship together as v1.4.3:** the move + tooling + docs + rule update were one continuous session (2026-05-09), all docs/tooling-only, no deployed-site code touched. Bundling them as one PATCH version mirrors the v1.4.1 docs-only-ship pattern. Version bump runs the new script through its first real use; CHANGELOG widget on the live site will display "v1.4.3" once a deploy happens (none required for this release per rule-7 exemption — next deploy will pick it up).

<!-- author: Code | date: 2026-05-09 -->
## v1.4.2 — PATCH (2026-05-09)

**Repository visibility changed from private to public; owning account renamed from `ReaIGodzilla` to `joewolters`.** No code changes — repo metadata only.

The repo is now public at https://github.com/joewolters/real-anime-reviews and is referenced as a portfolio link from Joe's CV (`Joe Wolters CV 2026 v3.pdf` in the parent `CV Builder` folder). GitHub auto-redirects the old `https://github.com/ReaIGodzilla/real-anime-reviews` URL to the new one (web + git access), but new references should use `joewolters` directly — old-name redirects are not guaranteed indefinitely, especially if the `ReaIGodzilla` handle is later reclaimed by another user.

**Pre-publication audit (passed all checks):**
- `.gitignore` correctly excludes `PERSONAL.md`, `.env`, `.env.*` (with `!.env.example` exception), and `AUDIT_*.md`. Confirmed against the file at this commit.
- `git log --all --full-history -- PERSONAL.md` returned empty — `PERSONAL.md` has never been committed in any branch's history.
- `git log --all -p` searched for `password|api_secret|admin_uid|service_account|private_key`. The only matches were UI code in `index.html`, `script.js`, and `account.js` for the auth modal (sign-in / password-reset form labels and Firebase SDK function names like `updatePassword`, `sendPasswordResetEmail`). No actual secrets in history.
- Firebase web API key in `firebase.js` is intentionally public per `docs/ARCHITECTURE.md` §"firebase.js (30 lines)" — Firebase web API keys identify the project, not authenticate access; security comes from Firestore rules.

**Note for future AI assistants and future-Blake:** as of 2026-05-09 this repo is **public**. Treat anything you commit as world-readable. The `.gitignore` ↔ `firebase.json` ignore-array mirror rule (codified in v1.3.9) and the project-rules in `CLAUDE.md` continue to apply, and matter even more now that anything that slips through is publicly fetchable from `realanimereviews.com/<filename>` until a corrective deploy purges it.

<!-- author: Code | date: 2026-04-30 -->
## v1.4.1 — PATCH (2026-04-30)

Documentation-only update. No code changes.

**`ROADMAP.md` rewritten in full.** Tonight's planning conversation produced enough corrections that a surgical edit would have left an inconsistent doc. The rewrite captures:
- Corrected version numbering after Phase C shipped as v1.4.0 — Phase A (Excel sync) is now v1.5.0, not v1.4.0.
- Mode 1 reframed as an upgrade arc across v1.6.0 → v1.6.3 instead of one bundled release: v1.6.0 baseline form, v1.6.1 live preview as you type, v1.6.2 "More Information" panel mirroring the Community Tab, v1.6.3 suggestion-box integration.
- Suggestion box folded into v1.6.3 (was originally a standalone v1.4.0 plan; that standalone is no longer scheduled).
- Project rules grew from 6 to 9: rule #7 (run tests before production-facing commits) and rule #8 (`.gitignore` ↔ `firebase.json` mirror) reference back to `CLAUDE.md`; rule #9 codifies image curation as a human-only step.
- Audit progress noted (~25 of 56 Step 3.5 findings closed). Remaining items grouped into suggested v1.4.x polish bundles (content/UX, image optimization, code modernization).
- Phase B-side split out — v1.7.0 backfill and v1.8.0 AniList tab on cards distinguished from Mode 1 capability work.
- "What's NOT on this roadmap" extended to make AniWave/streaming-scraper integration and AI image curation explicit non-goals.

**`README.md`** gains a "Design philosophy" section between About Me and Credits, documenting the *Call of the Night*-inspired visual identity (night sky, illuminated panels-as-apartment-windows, "would this fit in *Call of the Night*?" as the guiding design question).

No production-facing code touched. Tests not required per the docs-only exception in `CLAUDE.md` rule #7 (HTML version-string bumps for the version-bump checklist are mechanical metadata, not behavior changes).

<!-- author: Code | date: 2026-04-30 -->
## v1.4.0 — MINOR (2026-04-30)

**Phase C kickoff — verification scaffolding.** Playwright test infrastructure installed and the initial test suite in place. All future production-facing changes will run tests locally before shipping (per the new project rule below).

### Test infrastructure
- Installed `@playwright/test` (^1.59.1) as a dev dependency. Chromium browser binary installed in user-local cache (`~/AppData/Local/ms-playwright/`), not in `node_modules` — keeps the project tree at ~15 MB instead of ~165 MB.
- `playwright.config.js` runs tests against a local Python `http.server` on `127.0.0.1:8765` (the same pattern used during deploy verification). 0 retries in CI, 1 retry locally; screenshots on failure; single Chromium project.
- `npm test` is the canonical entry point.

### Initial test suite (7 tests in `tests/`)
- `homepage-loads.spec.js` — brand text, search input, View All button, Top 10 + Anime By Genre headings, no console errors.
- `search-works.spec.js` — typing "charlotte" and submitting filters the card grid; clearing and re-clicking View All restores the original count.
- `anime-modal-opens-and-closes.spec.js` — clicking a card opens the modal with title + rating; close button hides it.
- `modal-leak-check.spec.js` — 6 open/close cycles complete without console errors and the page stays responsive. Validates the v1.3.8 §1.2 fix (`activeOfficialUnsub` cleanup moved into `closeModal()`).
- `deep-link-first-load.spec.js` — `?open=charlotte` opens the modal on first load and the URL is cleaned. Validates the v1.3.8 §1.3 fix (deep-link handler hoisted out of `visibilitychange`).
- `account-page-loads.spec.js` — `/account.html` returns 200 with expected static structure (raw HTTP fetch via Playwright's `request` fixture — avoids race with `account.js`'s auth redirect).
- `404-page.spec.js` — non-existent paths return HTTP 404.

### Two new project rules codified in `CLAUDE.md`

**Rule A (Project rules §7) — Run tests before production-facing commits.** Before any commit that changes production-facing code (HTML, JS, CSS, `animeData.js`), Code runs `npm test` locally and reports results. Only after all tests pass does Code surface the change for review. Docs-only and tooling-config changes are exempt.

**Rule B (Operational gotchas) — `.gitignore` and `firebase.json` ignore arrays must mirror for sensitive files.** The two systems are independent — a file gitignored but not firebase-ignored will still be uploaded by `firebase deploy`. Precedents:
- v1.3.5 (commit `46b3291`) — `PERSONAL.md` would have leaked Firebase login email + admin UID + DNS values; fixed by adding `PERSONAL.md` and `UpdateLog/**` to `firebase.json` ignore.
- v1.3.9 (commit `6167da5`) — `AUDIT_2026-04-30.md` (full internal codebase critique) was actually exposed at production for the duration of v1.3.8; fixed by adding `AUDIT_*.md`.

### Notes
- This is Phase C of the original roadmap, reordered ahead of Phase A so subsequent code changes are protected by tests from day one rather than retrofitted later.
- New `firebase.json` ignore entries for tooling: `tests/**`, `playwright.config.js`, `package.json`, `package-lock.json`, `playwright-report/**`, `test-results/**`. None of this should ship to production.
- New `.gitignore` entries for ephemeral test artifacts: `playwright-report/`, `test-results/`, `.playwright/`. Test source files (`tests/`, `playwright.config.js`, `package.json`, `package-lock.json`) remain tracked.

<!-- author: Code | date: 2026-04-30 -->
## v1.3.9 — PATCH (2026-04-30)

Closed a deploy-config security gap. `AUDIT_2026-04-30.md` (the working audit doc from Step 3.5) was gitignored but **not** in `firebase.json`'s `ignore` array, so the v1.3.8 deploy uploaded it to Firebase Hosting. It was publicly fetchable at `realanimereviews.com/AUDIT_2026-04-30.md` between the v1.3.8 release and this fix.

- Added `AUDIT_*.md` to the `ignore` array in `firebase.json`.
- Redeploy purges the file from Hosting; verified `/AUDIT_2026-04-30.md` returns 404 after release.

**This is a recurring class of bug, not a one-off.** It's the same shape as v1.3.5 (commit `46b3291`), where `PERSONAL.md` was gitignored but not firebase-ignored and would have leaked the same way. The general rule: **any file added to `.gitignore` that lives in the deploy root also needs an entry in `firebase.json`'s `ignore` array** — the two ignore mechanisms are independent, and `firebase deploy` happily uploads gitignored files. To be codified as a `CLAUDE.md` rule next session so future Code instances catch the pattern before it ships.

<!-- author: Code | date: 2026-04-30 -->
## v1.3.8 — PATCH (2026-04-30)

Step 3.6 closing batch — bundled fixes from `AUDIT_2026-04-30.md`.

**Trailer:**
- *Call of the Night* trailer URL replaced (audit §1.5). The previous corrupted ID has been swapped for the original-series launch trailer.

**Content typos** (audit §6 — 14 corrections in `animeData.js`):
- Charlotte: physiological → psychological; quicky → quirky.
- Eminence in Shadow: Sonada → Sonata; devolved → developed.
- Call of the Night: seveal → several; "iv seems" → "I've seen".
- DanDaDan: consquences → consequences.
- *The Girl I Like Forget Her Glasses* → *Forgot* (matches existing image filename).
- My Stepmom's Daughter: continently → consistently.
- Magical Girl: passed → past (season 1).
- Gachiakuta: tangable → tangible; fanatastic → fantastic; philosphical → philosophical.

**Account page UI cleanup:**
- Removed the disabled Filter button on the account page (audit §1.10) — visible-disabled buttons confuse the UI; account page doesn't need filter controls.
- Hid the redundant "My Account" header button on the account page itself (audit §1.11) — the page already shows account context.

**Behavior fixes:**
- Fixed a memory leak in the anime modal (audit §1.2): the `activeOfficialUnsub` Firestore listener cleanup block was at module top-level after `closeModal()`, so it ran once on script load and never on close. Listener leaked on every modal open. Cleanup now runs inside `closeModal()` alongside the other live-listener teardowns.
- Fixed the `?open=<animeId>` deep link from the account page (audit §1.3): the handler was nested inside the `visibilitychange` event listener, so it only fired when the user backgrounded and refocused the tab. Hoisted into `init()` so it runs once on page load.

**Dead code removed:**
- `captureOpenState()` and its `openIds` Set in `script.js` (audit §1.13) — the captured state was never read.
- `signoutBtn` declaration and its listener in `account.js` (audit §1.14) — referenced an ID that doesn't exist on the account page.

<!-- author: Code | date: 2026-04-30 -->
## v1.3.7 — PATCH (2026-04-30)

Content and asset fixes from the Step 3.5 audit (see `AUDIT_2026-04-30.md`).

- **Duplicate stylesheet link removed** on `index.html` and `account.html` — both pages were loading `style.css` twice on every page (audit §1.1).
- **Status Assassin trailer URL fixed** in `animeData.js` — was missing `/embed/`, iframe was failing to load (audit §1.4).
- **Days with My Stepsister platforms cleaned up** — the title string had been pasted into the platforms array and was rendering as a fake platform chip (audit §1.6).
- **"About Me" text** on both `index.html` and `account.html` no longer mentions "or discord" — Instagram is the listed contact (audit §2.2).

The Call of the Night trailer (audit §1.5) is **deferred** — the corrupted YouTube ID can't be safely guessed; will be resolved in a separate PATCH once the right trailer is picked.

<!-- author: Code | date: 2026-04-30 -->
## v1.3.6 — PATCH (2026-04-30)

Rewrote ROADMAP.md to capture the two-mode end goal and added project-wide rules for any AI working on this codebase.

The end goal is now explicit:

- **Mode 1** — assisted review creation: human-initiated. Blake writes the review and rating; AI fills in metadata (description, genres, tags, streaming, trailer, thumbnail, seasons, episodes) and handles the version bump + commit + deploy
- **Mode 2** — autonomous site caretaker: AI-initiated, scheduled. Handles routine data maintenance, health monitoring, content quality watching, and reporting back to Blake. Capped at PATCH-tier changes

New rules added cover: Excel as the canonical anime data source; attribution markers (this very entry uses one) on every CHANGELOG entry and commit; strict Mode 1 vs Mode 2 separation; Mode 2 capped at PATCH-tier changes only; the `local → preview → production` deploy ladder is non-negotiable; and the homepage CHANGELOG widget must stay in sync with this file.

This commit also retroactively marks all prior CHANGELOG entries as `human (Blake)`. Going forward, any AI-authored entry will carry a `<!-- author: Code -->` marker.

<!-- author: human (Blake) | date: 2026-04-30 -->
## v1.3.5 — PATCH (2026-04-30)

Closed a deploy-config security gap. `firebase.json`'s `ignore` array didn't match `.gitignore`, so Firebase Hosting would have published `PERSONAL.md` (Firebase login email, admin UID, DNS values) at `realanimereviews.com/PERSONAL.md` on the next deploy.

- Added `PERSONAL.md` and `UpdateLog/**` to the ignore array in `firebase.json`
- Verified on a preview channel before production deploy: `/PERSONAL.md` returns 404 as expected

Commit: `46b3291`.

<!-- author: human (Blake) | date: 2026-04-30 -->
## v1.3.4 — PATCH (2026-04-30)

Cleaned up the changelog widget on the homepage so what visitors see actually matches the current version:

- Static fallback version tag now reads `v1.3.4` (was stuck at `v1.0.1`, even though `APP_VERSION` had moved on)
- Removed a duplicate "Anime by Genre" bullet
- Tightened the "Top 10 prev/next" and "Redesigned My Top 10" bullets
- Dropped the "Implemented" prefix from the bug-fixes bullet

Commit: `fe0dc4a`. This was a meta-fix — the changelog *display* itself was stale.

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.3.3 — PATCH

- Fixed Top 10 list

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.3.2 — PATCH

- Redid Top 10 list

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.3.1 — PATCH

- Added a new anime card

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.3.0 — MINOR

- Added an "Anime by Genre" shuffle control — refresh genre rails without reloading the page
- Added previous/next arrows for the Top 10 section so users can browse instantly
- Upgraded search bar styling to match the new button theme
- Redesigned the "My Top 10" section with cleaner visual hierarchy
- Various bug fixes and stability improvements across the site

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.2.0 — MINOR

- Added the Random anime button (dice icon) — opens a truly random anime in a modal
- Added a dice hover flip animation
- Upgraded header button styling (premium hover / glow / shimmer)
- Upgraded search bar styling to match the new button theme
- Fixed the shimmer "vertical line" artifact across buttons / search
- Smoothed the header hover background — no more harsh black line

<!-- author: human (Blake) | date: pre-2026-04-30 -->
## v1.0.1 — PATCH ("Content corrections only")

No new features — just polish.

- Misspellings and content corrections across reviews and descriptions
- Inaccurate platforms / tags / ratings updated
- Fixed studio names
- Fixed Instagram link
- Fixed website link + description
- Tiny CSS tweaks only (safe / minimal)

---

### Notes on this changelog

- Versions before `v1.0.1` shipped without formal changelog notes — they covered the initial site launch and pre-launch iteration when files were named more freely.
- **`v1.1.0`** ("Community Top 5 Favorites") was planned but never shipped under that number. See [ROADMAP.md](ROADMAP.md) for its current status (postponed → big-vision idea).
- Git commit hashes are only available from `v1.3.4` onward — the git repo was initialized after the prior versions had already deployed.