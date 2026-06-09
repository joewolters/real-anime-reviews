<!-- author: Cowork | date: 2026-06-09 -->
# v1.10.0 — MEGA-BATCH: image/UX fixes + LIVE-IN-BOX composer rebuild + Profiles (15-16) + Account redo + Message-Blake DM (17-18)

> Blake chose ONE thorough mega-batch ("finish this stuff + prepare the next gates, thorough — fable 5 to work through"). Build it ALL, checkpoint-commit at each gate boundary, **5-agent adversarial review** (the composer rebuild is a contenteditable XSS surface — review it hard), then a SECTIONED smoke. Everything STAGED — no deploy. Take the time you need.

## ⭐ THE UX MANDATE (Blake, 2026-06-09 — the spine of this batch)
*"im tired of this site looking like a social media site in training. I want code to SHOW me what it can do to make a smooth UI/UX experience. Everything should be clean and the essentials."* → This is a **show-what-you-can-do** mandate. Every surface you touch this batch should read **clean, professional, intentional — not "in training."** Essentials only, no clutter. Full creative latitude on the polish. Protect-the-heart holds throughout (purple community, count-free, gold only on Blake's surfaces).

## GitHub: keep pushing publicly (Blake's call, 2026-06-09)
Blake confirmed the **public repo is fine** ("taking it back, public github is fine"). **Push each checkpoint commit to the public repo** as before — no secrets in the tree, no CI/auto-deploy, staged rules deny all writes, so public WIP is acceptable to him. Just keep the work backed up off-machine.

## PART A — image/UX fixes (Blake's smoke)
1. **Inline reply image not rendering.** *"Mikas reply doesn't have any image visible to me. It just looks like a period."* → the `[img:N]` token in a reply/comment isn't resolving to the image (renders as stray punctuation). Fix inline-image rendering on the reply + comment surfaces (verify the seed token matches a real imageRef; fix the resolver path).
2. **Thumbnail visible on card but not in thread.** *"the seasonal binge does have a purple card thumbnail. However I can't see it when clicking into the thread."* → if a thread has a chosen thumbnail, it should also appear in the thread VIEW (header/body), not just the list card. Make card ↔ thread-view image presentation consistent.
3. **Topic tag over the image.** *"The tags 'General' and so forth should be on top of the image to keep a clean look across threads both with and without thumbnails."* → the topic pill sits consistently in the same place (overlaying the thumbnail when present) so thread cards look uniform with OR without a thumbnail.
4. **Community-review thumbnail slot.** *"community reviews can't seem to add an image as a thumbnail option either. There should be a dedicated space to upload a thumbnail specifically."* → the review composer gets a **dedicated thumbnail upload slot** (distinct from inline body images), shown on the review card/header.

## PART B — the LIVE-IN-BOX composer rebuild (Blake confirmed: true rich editor)
*"Maybe get rid of the preview window entirely across the entire website for USERS (NOT MY ADMIN WINDOWS FOR ANIME STUFF) and have the review update live in their typing box."*
- **Rebuild the USER composers** (comment · reply · Tavern thread · Tavern reply · community review) as **true live in-box rich editors**: bold/italic/links/images/spoilers render **live as you type, IN the input** — NO separate PREVIEW panel. The B/I/🔗/👁/📷 toolbar acts on the live content.
- ⚠️ **Admin/anime composers stay EXACTLY as they are** (the new-anime form, section-editor, edit page — Blake's admin windows are explicitly excluded).
- **Technical:** a `contenteditable` editor is the path. ⚠️ **contenteditable is an XSS minefield** — sanitize on input (paste especially: strip all but the allowed inline formatting), store as the SAME markdown/`[img:N]` model the renderer already uses (so nothing downstream changes), and round-trip losslessly. The `[img:N]` images render as actual thumbnails inline in the editor; spoilers render as live pills. Keep Ctrl/⌘+B/I, Ctrl/⌘+Enter to post, paste-an-image, the 4000/2000 caps, and XSS safety. Reduced-motion safe.
- **The clean bar:** the composer should look like a polished modern editor (think a clean Discord/Notion-class input), not a textarea + a panel. Essentials only.

## PART C — Gates 15-16: FULL public profile pages (Blake's upgrade — full pages, not mini-card)
- **`profiles/{uid}` dual-write + reads** (gate 15): account writes `profiles/{uid}`; author-name reads across the site go **profiles-first with a `users` fallback** (the fallback makes the migration safe — names never break).
- **Full routed profile page** (gate 16): every author name across the site links to their profile — **avatar, display name, member-since, bio**, and **their public activity** (their threads / comments / reviews). Clean, premium, branded (the UX mandate applies hard here — this is a brand-new public surface).
- **Privacy:** public profile + **private saves** (watchlist/favorites stay private). No opt-out machinery this pass (matches the live rules).
- **Heart invariants (bake as specs):** a community profile carries **NO gold token + NO count node** (no karma/post-count leaderboard); **Blake's name → his Den** (his identity IS the site); **banned → a "suspended" tombstone**, **deleted → a graceful "former member"** (no dead clicks). Bio renders escape-first via `markdown.js`.

## PART D — Gates 17-18: account redo + the Message-Blake DM (makes the Inbox real)
- **Account redesign** (gate 17): `account.html` full premium pass (the UX mandate), the tabs evolved, and the **watchlist/favorites cover-art fix** (some rows render art-less — root-cause it in a real browser; the `al:<id>` routing + `#open=`/`#secondary=` split stay intact).
- **The Inbox tab + Message-Blake DM** (gate 18, admin-floor only — **peer DMs stay BANKED**): a 5th **Inbox** tab; a visitor can **message Blake**; Blake replies from an admin drawer; the suggestion-reply channel folds in. Uses the live `conversations`/`messages` schema (CF-written creates, admin-floor only — Blake is always a party, zero stranger-to-stranger surface). DM unread surfaces in the Lantern as `type:'dm'` (**purple, never gold**). The locked "People" folder shows "peer DMs coming."

## Verify + checkpoints
- Checkpoint-commit at each gate boundary (after Part A+B, after Part C, after Part D) — Blake-authored, zero trailers, excludes held out, **pushed** (repo now private). `git add` any new public assets.
- ALL tracks green at each stage + new specs (inline-image render, the contenteditable round-trip + paste-sanitization XSS, profile heart invariants + name fallback, the DM admin-floor rules, cover-art heal).
- **5-agent adversarial review** — lenses: **contenteditable/paste XSS** (the big one), profile privacy + the name-fallback, DM admin-floor enforcement (no peer leak), image rendering, and the heart across all new surfaces.
- Walk everything yourself in practice (Storage emulator up). Then Blake's SECTIONED smoke (A / B / C / D — state which sign-ins + what he should see per section).

## Report (lean per section): the 3 checkpoint hashes · Part A-D per-item · the contenteditable approach + how paste is sanitized · the profile privacy/heart model · the DM admin-floor model · adversarial findings+fixes · test counts · Blake's SECTIONED smoke. NO deploy.
