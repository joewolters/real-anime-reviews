<!-- author: Code | date: 2026-07-04 -->
# THE MEGA-RUN — Report 9 (LAST CALL): **every bug dead, the final changes in, the site level EVERYWHERE. Ready for humans.** Your short smoke 3 below, then the one go.

**Design vision.** This gate made the site behave like one coherent thing instead of many grown parts: ONE composer that works like Discord everywhere you can type, ONE link system where every view you're looking at has a URL you can send and a Back button that retraces your actual steps, ONE quiet voice (your name now lives where identity matters — The Den, the Creator's marks — instead of wallpapering every tooltip), and one honest link preview wearing the welcome door's face. Under it: the parity matrix — every capability leveled or formally justified on every surface.

## PART A — your bugs (your numbering; every one verified with real pixels or live walks)
1. **Door quotes:** fixed at ALL widths — right-side bubbles were shrink-to-fitting into one-word towers (your Death Note screenshot); they anchor from the right now and keep their natural width. **On phones your seed is built exactly:** the quotes live in a top band, slide BEHIND the card (they can never cover the banner/text again), and dissolve slowly into a fade at the top edge. Screenshot-verified at 375/1440.
2. **Discover search glow:** the shimmer used to physically slide its box past the bar — it now travels INSIDE the bar (background animation, nothing can escape), with a reduced-motion still.
3. **Double ✕:** the browser's own native search-✕ was doubling our branded one — killed globally on every search field, site and admin. One clear per bar, pixel-verified.
4. **Tavern mobile:** at phone widths the header wraps into rows — kicker + ✕ up top, the title on its own line, New thread full-width below. No more overlap, measured at 375.
5. **THE COMPOSER — Discord-grade, everywhere.** One engine now powers every box: comments, replies, reviews, review EDITS, discussion boxes and their edits, Tavern threads + replies + post edits, **your DMs**, and the profile bio. Ctrl/⌘+B/I toggle live styling as you type — literal `**` never appears anywhere (the old marker engine is deleted from the codebase). ONE image button per surface (the duplicates died). The link button is gone — **pasted URLs just become links**, scheme-gated, everywhere text renders (including letters, which render bold/spoilers/links now too). Enter sends DMs, Shift+Enter for a new line. Inventory + caps in the Part C matrix below; walked live in the Letter Room with real keystrokes on both sides of a conversation.
6. **Tag commas:** the Excel sync was splitting your comma-separated hashtags wrong (`"action,"` `"worldbuilding,"`); the parser now handles both your styles, animeData regenerated from Excel (canonical, untouched), and the pill renderer strips-and-escapes as a second fence. One judgment call: `friendly,-rivalry` on Black Clover became the two tags "friendly" + "rivalry" — if you meant one hyphenated tag, it's a one-cell Excel edit.
7. **Card icons:** ♥ and bookmark sit side-by-side on badged cards now (measured: they always fit at every card size the site renders); the vertical stack rule is gone, pinned in the suite.
8. **Public profiles, your picks built:** ONE featured shelf leads (you pick it in the Studio — a new "Featured shelf" dropdown; unset = freshest leads) with the rest behind a small "view all shelves (N)". **Threads are gone from public pages** — reviews only, plus the pinned review. **Save someone's shelf:** ☆ on any public shelf → it appears in your Collections under "Other members' shelves" — read-only, purple, count-free, with "kept by <name>" linking to them; unsave anytime; if they take the shelf private you see the honest line "This shelf is no longer shared." **Shelf anime are clickable** — covers open the card or deep-dive, on the profile sheet AND in Collections. All rules-fenced (owner-only saved-shelves, self-pointers denied — 203 rules tests green) and walked live end-to-end.

## PART B — the final changes
1. **The de-Blake sweep (~50 strings, my case-by-case judgment).** Notable before → after:

| Where | Before | After |
|---|---|---|
| Card status pills | "Blake is watching" / "On Blake's list"… | "Watching now" / "On the watchlist"… (the GOLD is your mark) |
| Tavern shelf / verdict / review headers | BLAKE'S REVIEWS · BLAKE'S VERDICT · BLAKE'S REVIEW | THE CREATOR'S REVIEWS · THE VERDICT · THE CREATOR'S REVIEW |
| For You table + lens | BLAKE'S TABLE · "Blake's picks" | THE CREATOR'S TABLE · "Creator's picks" |
| Discover subs + suggest CTA | "Blake's reviewed light up gold" · "Tell Blake what to review next" | "reviewed here light up gold" · "Tell the Creator what to review next" |
| Letters | thread title "🏮 Blake", "Write to Blake…", "straight to Blake" | "🏮 The Creator" (still gold), "Write to the Creator…", "straight to the Creator" |
| Lantern + server pings | "From Blake" labels, server name "Blake" | "From the Creator" (old notification docs keep their stored name, honestly) |
| Catch-up | "✍ NEW FROM BLAKE", "Blake added N reviews" | "✍ NEW REVIEWS", "N new reviews since your last visit" |
| Errors/tooltips/aria | "Tell Blake if it keeps up", "asked Blake", "Agree with Blake's rating"… | all "the Creator" |

**KEPT (identity is the point):** The Den wordmark, the approved Den watching line, the CREATOR kicker, your update-log history (records stay true), your display name, and your new bio's own words. "DM Blake" era copy was already dead; the profile-sheet ✉ on YOUR sheet now reads **"Message the Creator"**.
2. **Link preview:** a fresh `assets/og-preview.jpg` (1200×630, 83KB) built in the welcome door's exact vocabulary — the banner collage melting into the purple night, the wordmark glowing, your tagline under it — wired on all four pages with proper width/height/alt, plus the new description: *"A late-night anime den — one person's honest takes, ranked, reviewed, and watched in full. Reviews, community threads, and letters, all under one roof."* The old preview.jpg stays for stale caches; scrapers re-fetch on the new URL. Pinned by a new spec; verify live with any Discord paste after cutover.
3. **Shareable links + honest Back — everywhere.** Every view writes its URL now: cards (`#anime=`), deep-dives (`#secondary=`), **characters/staff** (`#character=`/`#staff=` — brand new), the Tavern (`#tavern`), threads (`#forum/…`), profiles (`#profile=`), account tabs. Cold-opening any of them lands exactly there. **Back walks your real steps:** the proof of your exact scenario, live — opened a card → deep-dive → clicked through 4 characters → four Backs returned through each one → then deep-dive → card → home. Never dumped to the headers early, never thrown off the site. Esc/✕/scrim closes keep the history in step. 4 new e2e specs + the live walk pin it.
4. **The bio:** your new text, verbatim, both pages — only the spelling normalized.

## PART C — the parity matrix (full tables carry file:line evidence in the gate log)
**Compose surfaces × capabilities:** all 12 composer surfaces = the ONE engine ✓ live formatting ✓ spoilers ✓ autolink ✓; images = one affordance each (review cover slot is a feature, not a duplicate); caps client==rules everywhere (three gaps the audit caught — review-edit, new-thread, post-edit — now client-guarded). **Justified cells:** the suggest page stays a plain form; DMs keep their own sealed-image 📎 (the safety pipeline); discussion boxes stay image-less (your call, kept).
**Content types × nav:** every type shareable + cold-openable + Back-honest ✓ (account tabs share their URL but Back leaves the page — tabs are chrome, documented).
**Dialogs/selects:** **zero native dialogs on the whole visitor site now** — the last 43 alert()s became a branded purple toast, and the change-password flow's plaintext prompt() became a proper masked inline form. One justified cell: 4 old sort/reason dropdowns on the main page still use native popups (closed state is branded; converting them mid-finale wasn't worth the risk — first post-cutover polish, noted).
**[hidden] symmetry + reduced-motion:** audited across every new component; the audit caught 2 real twin gaps + 1 motion gap — all fixed and pinned (g36).

## THE PANEL (5 lenses, 19 agents, per-finding skeptics)
14 raw → **13 confirmed, 1 refuted → 11 FIXED, 2 accepted (LOW).** The record holds — it caught two real HIGHs in the new nav system: a cold-opened character page whose anime links were dead clicks (now they open the deep-dive for real), and a history race where clicking a shelf cover from a profile could strand the URL mid-rewind (all cascade closes now rewind once and open after the dust settles). Also caught: the bio editor silently erasing your saved bio on first keystroke (fixed — the panel's best catch), two sweep stragglers, code-span autolinking, dead "kept by" links, Forward-press edge cases. Accepted: two LOW residues, documented in the gate log.

## PART D — STRESS PASS 2
| Area | Evidence | Verdict |
|---|---|---|
| All five tracks | Playwright **278** · rules **203** · functions **77** · triggers **78** · e2e **25** — every floor up | **PASS** |
| The back-walk | e2e ×4 + the live 4-character chain, re-run AFTER the panel fixes | **PASS** |
| Composer live | real-keystroke DM walk (bold toggles, Enter sends, autolink both sides), re-run post-fixes | **PASS** |
| Profiles + shelves | the full A8 walk re-run post-fixes (12 checks incl. the cascade path) | **PASS** |
| Concurrency | simultaneous DMs + racing group adds re-proven OVER the new composer; the vote race (+2 exact) proven at the F pass on unchanged CF machinery | **PASS** |
| Part A bugs | pixel evidence per bug (door 375/1440, one-✕, tavern 375, icons row, tags clean) | **PASS** |
| Renames/copy | zero unsanctioned "Blake" strings; all suite pins updated and green | **PASS** |
| OG preview | 1200×630 asset serves, meta on 4 pages, g35 pin | **PASS** |

**Ready for humans: YES.**

## Green (the new floors)
Playwright **278** (+1 og pin, +3 parity pins, composer specs ported to the one engine) · rules **203** (+3 shelf/featured) · functions **77** · triggers **78** · e2e **25** (+4 back-walk). Seven adversarial panels across the run; every confirmed finding fixed or formally accepted.

## YOUR SHORT SMOKE 3 (~10 minutes — new things only; practice is running)
`http://127.0.0.1:8765/?emu=1` · you = `blake@practice.test` / `practice123`.
1. **The door on your phone-sized window:** quotes drift at the top, behind the card, fading out — and no more towers at any width.
2. **Type anywhere like Discord:** open any comment box or a DM — Ctrl+B, type, Ctrl+B. Paste a URL, post — it's a link. Letters render bold now too.
3. **Send a link of what you're looking at:** open any card → copy the URL from the address bar → paste in a new tab — it lands on that card. Open a character from a deep-dive → same thing (`#character=…`).
4. **The Back button:** click into a card → deep-dive → a few characters → press Back repeatedly — it retraces your steps home.
5. **Profiles:** open a member (mika has shelves seeded) — one featured shelf leads, "view all shelves" below, ☆ Save one → check your Collections' "Other members' shelves" → covers click through to the anime.
6. **The quiet:** wander the site — your name now only where it's YOURS (The Den, the watching line, CREATOR marks). Discover says "reviewed here light up gold".
7. **Post a link of the site anywhere** (Discord/iMessage after cutover) — the preview is the door now, not the stale skyline.

## THE CUTOVER — the click-by-click script (nothing runs until your word)
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
Every bug from your list is dead with pixel proof, the whole site now types like Discord and links like a real app — any view shareable, Back retracing your actual steps through four characters and home — your name is out of the wallpaper and kept where it's yours, the link preview wears the door, the parity matrix is level or justified on every cell, the panel's two HIGH catches in the new nav are fixed and re-walked, and all floors stand at 278/203/77/78/25 — so what remains is your ten-minute smoke 3 and your single word for the v2.0.0 cutover, where your one console command is written out click-by-click above.
