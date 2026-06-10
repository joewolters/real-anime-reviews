<!-- author: Cowork | date: 2026-06-09 -->
# Session Handoff — v1.10.0 "Community Hub" MEGA-BUILD in flight (sandbox-staged, NOT deployed) · live = v1.9.1

> **Written at the close of the 2026-06-08/09 marathon** (shipped v1.9.0 Community foundation → v1.9.1 composer/fixes LIVE; then the entire v1.10.0 "Community Hub" mega-build staged in the practice sandbox, gate by gate, NOT deployed). This file is the session bridge — the ⚡ section is the new Cowork chat's startup script. **Read it end-to-end.**

---

## Current production
**Live:** `realanimereviews.com` serving **v1.9.1** (curl-verify `APP_VERSION="1.9.1"`). v1.9.0 (community foundation: comments + reviews overhaul + the Lantern notification center + all the server robots) and v1.9.1 (composer redesign + season label + deep-link halo + "my review" filter) are both LIVE.

**In flight (NOT live):** **v1.10.0 "Community Hub"** — a massive build that has been assembled gate-by-gate **entirely in the practice sandbox, STAGED, never deployed.** `APP_VERSION` stays **1.9.1** in production until the cutover. Everything below exists only in the working tree + pushed checkpoints on the public GitHub repo.

**Tests (last seen):** `npm test` ~**170** · `test:rules` **126** · `test:functions` **56** · `test:cf` **57** · e2e **10**.

---

## ⚡ For the next Cowork chat (startup script)
1. **Read order:** `AI-PRIMER.md` → this file end-to-end → `COWORK-STYLE.md` (tone + the §13 mode-recs + all the session notes) → `NEXT.md` (the v1.10.0 status + EVERY banked idea — read the v1.10.0 sections) → `SHIP-OUTPUT.md` (Code's latest report) → `SHIP-PROMPT.md` (the staged prompt). The full v1.10.0 architecture is in `docs/v1.10.0-DESIGN-STUDY.md` (the gate-0 study — open it if you need the data model / gate map / security).
2. **YOUR FIRST MOVE: a `report` is pending.** Code is ALREADY WORKING on the staged **account-overhaul-round-4** prompt (`SHIP-PROMPT.md`). When Blake says `report`, read `SHIP-OUTPUT.md` fresh and digest it (see the report style below). Do NOT stage anything new until he's smoked it.
3. **Recommend a Code mode with every paste line** (High/Max/ULTRAMAX). Almost everything in v1.10.0 is **ULTRAMAX** (the design + adversarial-review gates). Blake runs Code in **Fable 5 (1M context)** — mega-prompts are fine and welcome (he WANTS thorough).
4. **Curl the live site = ground truth** for "did it deploy." It will read 1.9.1 until the cutover.

## Where v1.10.0 stands — what's DONE vs LEFT
**DONE (staged, sandbox-verified, checkpoints pushed):** the moderation spine (ban + consent rules) · ban Cloud Functions · the "I agree" consent modal · the admin reports queue · the forum/DM deep-link router · **The Tavern** (the 4th nav place "Community"→"The Tavern": threads, Hot/New/Top, anime-tagged threads with Blake's gold verdict rail, the "Blake's Reviews" shelf, replies with nesting/thumbs/report, mod tray, the Rising rail with Blake's gold slot-1, spoiler tags) · the **image system** (locked Storage, upload pipeline, inline `[img:N]` placement, lightbox, dedupe, thumbnails, moderation, kill-switch, NCMEC runbook) · **full public profile pages** · the **account redo + Message-Blake inbox** (admin-floor DM; peer banked) · the **dream-profile platform** (bio/tags/accent/background-image-or-GIF/pinned-review/Appreciate-likes) · the **account settings platform** (Discord-style rail, per-section panels, in-account consent) · **per-season "This Season's Room"** on the secondary modal · the **live-in-box composer** (all user composers render formatting as you type, no preview panel).
**IN FLIGHT (Code working on it now):** **account overhaul round 4** — fixes the RECURRING dim headings (with pixel proof required) + the white-outline dropdowns, adds an avatar/background **cropper**, richer **accent/gradient** customization, **hover-to-change** pickers, watchlist/favorites **cover art**, **Personal Collections** (user-made public/private collections), and moves the **season room to the LEFT** of the secondary modal.
**LEFT after that:** **gate 20** = the **welcome-door catch-up buttons** + the **cherries** ("👁 N requested" chips · the gold-flip when Blake reviews a requested anime · "Surprise me" · the About-Me/Credits footer premium pass · the Mode-1 desktop launcher) + the imageRefs edit-strip sweeper · then **gate 21 = THE CUTOVER** (the irreversible prod deploy, order: indexes → hosting → firestore → storage → functions, on Blake's "ship it").

## 🌟 BANKED IDEAS — none may be lost (all in NEXT.md, cross-check)
- **Postponed to their OWN Discover ship (NOT v1.10.0):** "Random anime" mostly-unreviewed + a mini filter (truly random vs reviewed) · the **"Hidden Gems"** Discover category (high rating, low popularity). Both logged verbatim, both Discover-tab features.
- **FUTURE (post-v1.10.0):** richer **card-state labels** ("Blake Currently Watching" / "Blake's Watchlist") · **Blake's personal card/watchlist admin panel** (set per-anime status + private notes — a curator's control room, pairs with the card labels) · the **"anime information request"** affordance atop the secondary modal when data's sparse.
- **Banked for a LATER gate on Blake's explicit go:** **peer (user↔user) DMs** — Phase C, request-first, with block/report/rate-limit. The schema is peer-ready; the admin-floor "Message Blake" shipped in v1.10.0.
- **Minor riders:** the full "who liked" history (beyond the pruned window) · the lantern.js cache-bust + index/account Lantern DRY-unify · two pre-existing secondary-modal races (cutover-polish list) · the season-room AniList-fetch decoupling.

## The report style (Blake NEVER reads SHIP-OUTPUT himself — YOU are his reader)
`report` = read `SHIP-OUTPUT.md` fresh → a self-contained chat digest: **5-15 lines + tables** of what landed/verified, THEN **numbered smoke steps that state the obvious** (which sign-in, what to click, what he should see). EVERYTHING he needs goes in the chat message — never point him at a doc. Split into multiple messages rather than bury the smoke steps. (memory: `feedback_self_contained_reports`.)

## Smoke testing (how Blake verifies)
`npm run practice` (it launches the Storage emulator too now, in its own detached window) → open **`http://127.0.0.1:8765/?emu=1`**. ⚠️ **Data-dependent features (comments, votes, DMs, profiles, images, deep-links) ONLY work with the `?emu=1` server running** — a plain local open or prod shows nothing (Blake hit this once; it cost a false "test is lying" panic). **Seeded accounts** (all password `practice123`): admin `blake@practice.test`; members `prac-mika` / `prac-newbie` (fresh, no consent) / `prac-banned` / `prac-ren` / `prac-aki` / `prac-yuki` / `prac-sora` @practice.test. Each gate's report lists which account shows what.

## What this marathon learned (carry-forward — READ THESE)
1. **Batch to smoke MILESTONES, not gates** (Blake's call) — build several gates per Code run, pause only when there's something visual to smoke. Cuts the report/smoke churn that eats context.
2. **Mega-prompts are good** — Blake runs Fable 5 (1M context) and explicitly wants thorough, take-your-time ULTRAMAX runs.
3. **The STANDING UI DIRECTIVE** (put it in EVERY build prompt): every new interactive element ships at full brand parity BY DEFAULT — branded buttons (never raw `<button>`), hover states, purple-not-gold, **no plain/dim/small text, no native focus outlines, no native `<select>`**. Blake keeps catching unstyled small things — it's a verification item now. (memory: `feedback_ui_polish_default`.)
4. **PIXEL-PROOF recurring visual fixes** — the dim-heading + white-dropdown bugs were claimed-fixed-while-still-broken 3×. Demand Code screenshot the real computed style and prove the fix in pixels.
5. **Protect-the-heart, with ONE carve-out:** gold = Blake only; community is purple + count-free EXCEPT **profile "Appreciate" likes** (the sanctioned user-social count, never gold, can't like Blake). Blake's name → his Den everywhere.
6. **"my jaw dropped"** is the bar — Blake said it on the dream-profile account redesign. ULTRAMAX + Code's adversarial-review/design-panel workflows earn it.
7. **Quote Blake verbatim in prompts + bank ideas to NEXT.md immediately** with his words. He worries about idea loss between chats — show receipts when he asks "is X saved?"
8. **Cowork NEVER deploys.** The cutover runs ONLY on Blake's "ship it"/"push it" said IN CHAT — quote his exact words + date into the cutover prompt; never pre-assert it.
9. **Commit ≠ deploy ≠ push** — Blake got confused once; a git commit/push backs up CODE to GitHub, it does NOT change the live site. Only `firebase deploy` (the cutover) touches prod. Checkpoints push to the PUBLIC repo (his call — no secrets, rules deny all writes).
10. **Code self-requests modes** + writes its own `CODE-HANDOFF.md` for the next Code session. Blake switches Code sessions when context fills (Fable 5 1M lasts a while).

## Rolling files (current state)
- `docs/SHIP-PROMPT.md` — the staged account-round-4 prompt (Code is applying it now).
- `docs/SHIP-OUTPUT.md` — Code's latest report (round-3/season-rooms when this was written; will be round-4 when the pending `report` comes).
- `docs/v1.10.0-DESIGN-STUDY.md` — the full gate-0 architecture (data model, gate map, security, the heart specs).
- `docs/NEXT.md` — the backlog + EVERY banked idea (the v1.10.0 sections are the live ones).
- `docs/CODE-HANDOFF.md` — Code's own state doc (Code maintains it).
- `docs/HANDOFF.md` — this file.

## Process rules still apply
Excel canonical for the 44 (untouched — community data is Firestore/Storage-native) · author markers on doc edits · commits Blake-authored, ZERO co-author trailers · `npm test` floors before prod · gitignore↔firebase mirror (now extends to Storage) · no provider names visitor-facing · no native dialogs · `[hidden]` display-symmetry · Firefox-Profiler is the perf arbiter (compositor-cheap, reduced-motion) · the cutover close-out CHECKLIST (CHANGELOG.md + the homepage widget `version-section` bullets per `widget-update-skill.md` + ROADMAP + refresh SHIP-OUTPUT — the v1.9.0 cutover skipped the widget bullets; don't repeat it) · the rar-ops artifact updates at SESSION END only.

## Blake (who you're working with)
USF student, "very basic" coder — explain at FILE level, slow down with the three-copies model (Excel master / localhost / live site) when he asks "wait how does this work?". Concise + direct, match his energy, he curses casually + jokes. New-to-coding preferences: direct, specific, small steps, don't assume he knows terms. He has strong product + design instincts and reacts to RENDERED things (build-and-smoke, not propose-first, for design). He's been building this for months and it's his portfolio piece.
