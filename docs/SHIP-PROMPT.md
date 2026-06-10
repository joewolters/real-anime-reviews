<!-- author: Cowork | date: 2026-06-09 -->
# v1.10.0 — Account overhaul (round 4) + Personal Collections + per-season comments to the LEFT. APPLY, practice verify, NO deploy.

> Blake's verdict: still needs "another overhaul… look good and feel natural." Two items are RECURRING (he's reported them 2-3× and they keep coming back reported-fixed-but-still-broken). **Mode ULTRAMAX, full latitude.** 5-agent adversarial review. Checkpoint + push. STAGED — no deploy.

## 🔴 RECURRING #1 — DIM HEADINGS (Blake's items 1 + 8 — THIS HAS FAILED 3×; fix it for REAL)
*"Again the Your constellation looks dimmed. This is the same issue we were having with the tavern text… Every single heading from profile to account has a dimmed title. We need to fix that… I thought I gave code that instruction last time."*
- The section headers — **"YOUR CONSTELLATION", "WATCHLIST", "FAVORITES", "INBOX", "ACCOUNT"**, all of them — render **DIM GRAY, not bright white** (confirmed in his screenshots). Prior rounds claimed this fixed; it is NOT.
- ⚠️ **Diagnose the REAL cause in an actual browser** — screenshot the heading, read its **computed color + opacity** (it's likely a muted kicker color, a low opacity, or low-contrast gradient text being applied to these `.panel-head`/kicker elements). Do NOT spot-fix one and assume the rest.
- Fix EVERY account/profile section heading to **full-bright white** (matching the site's brightest body text).
- ⚠️ **PROVE IT with a real-pixel screenshot** in the report — a claim of "fixed" without the pixel proof is not acceptable this round (the pattern is claim-fixed-while-still-dim). Give its subtext a **pill / glow treatment so it pops** (item 8).

## 🔴 RECURRING #2 — WHITE-OUTLINE DROPDOWNS (Blake's item 5 — also reported before)
*"The mini drop down menu in accounts still have that weird white outline. I specifically said to change it to match the rest of the site. This applies over all of the account page."*
- The **native `<select>`** dropdowns (sort: Recently added / A→Z / By year on Watchlist/Favorites, etc.) still show the **OS-default white outline + native styling**.
- → **Replace EVERY native `<select>` on the account page with the branded custom dropdown** (the Tavern's branded dropdown pattern — purple, the site's focus ring). Audit the whole account; no native select anywhere. Prove it.

## THE OVERHAUL — Blake's other items (his words)
1. **Subtext copy:** "YOUR CONSTELLATION" subtext → **"Customize your profile, bio, send messages and more from here!"** (or a tighter Blake-voiced version).
2. **Avatar/background cropper (item 2):** *"After a user clicks a picture they should be able to resize or move the circle around that shows what their profile will look like. Like a modern social media app."* → a **crop/reposition tool** after picking an avatar (and background) — drag to move, pinch/scroll to resize the frame, live preview of the circle. Modern-social-app feel.
3. **Richer customization (item 3):** *"More tint access with glows and more customization, gradients etc. Little user menu with good and complete UI."* → expand accents beyond 6 solid dots: **gradients, glows, more colors**, in a **complete little customization menu** (clean, branded).
4. **Hover-to-change pickers (item 4):** *"Choosing the background should be done from the background preview. Like you hover over it and a little opaque option appears to 'change background' like a professional site. Same thing with the avatar picker. It should be on hover."* → background + avatar are changed by **hovering the preview → an opaque 'Change background' / 'Change avatar' overlay appears** (pro-site pattern), not a separate button row.
5. **Watchlist/Favorites cover art (item 6):** *"Watchlist and favorites should load the preview png."* → the rows load the **cover image** (they're text-only now in list view).
6. **NEW — Personal Collections (item 7):** *"I want them to also be able to make their own bookmarks and organize their catalog. Make new collections. Could be another dropdown menu in collections. Call it personal collections. They can make it public or private."* → a **"Personal Collections"** item in the Collections nav group: a user creates named collections, adds anime to them, organizes, and sets each **public or private**. (Small data model: `users/{uid}/collections/{id}` `{name, public, items[]}`; public ones viewable on their profile. Branded CRUD UI.)
7. **Per-season comments → the LEFT of the secondary modal (item 9):** *"It should appear to the LEFT of the secondary modal… a small area to the LEFT that works kinda like community reviews or just comments. Comments for now but with pictures."* → **move the season room from the center column to a small LEFT-side area** of the secondary modal (still below/near Blake's review, H5 order intact). Comments + images (the systems exist).
8. **Overall (item 10):** another natural-feeling, complete pass — "look good and feel natural." Code decides the completeness touches. Heart-safe (gold = Blake; Appreciate the one count).

## Verify
ALL tracks green + new specs (the heading brightness as a computed-style spec, the native-select-gone spec, the cropper, personal collections CRUD + public/private rules, the left-side season room + H5 order, cover art on collections). **5-agent adversarial review** — lenses: the new collections rules (public/private leak), the cropper (no upload bypass), heart, XSS on collection names, perf. **Real-pixel screenshots for the two recurring items.** Walk it yourself. Then Blake's numbered smoke.

## Report (lean): the design vision (1 para) · **the two recurring fixes WITH real-pixel proof** (computed color before/after; native-select-gone) · the cropper + richer accents + hover pickers · personal collections · cover art · the left-side season room · adversarial findings · checkpoint hash · test counts · Blake's numbered smoke. NO deploy.
