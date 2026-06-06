<!-- author: Cowork | date: 2026-06-06 -->
# Session Handoff — v1.8.4 "Discovery & Blend" LIVE · NEXT: v1.9.0 Community/Account (NO staged prompt — Blake info-dumps first)

> **Written at the close of the 2026-06-05/06 marathon session** (three ships: **v1.8.2** Structured Reviews → **v1.8.3** Website Identity → **v1.8.4** Discovery & Blend). This file is the session bridge — the ⚡ section is the new chat's startup script.

---

## Current production

**Live:** `realanimereviews.com` serving **v1.8.4** (commit `88b2976`, deployed 2026-06-06, **verified by curl** — `APP_VERSION="1.8.4"`, `/quotes.json` 200). HEAD == origin/main == `88b2976`. `npm test` floor **84**. `bump-version` targets **47**. Tests/gates honest: 25 → 84 over this session.

**What v1.8.4 added** (the 10-gate epic): the **For You** + **Discover** surfaces (live AniList search pinning Blake's 44 in gold, airing Top-10 + by-genre + popular, taste-engine rails led by his reviews with Editor's Notes); the **blended catalog** (NOT-REVIEWED stickers, tier-colored community scores + N/A, saves on every card via `al:<id>`, review-it-and-it-upgrades); **real nav** (Blake's Den · For You · Discover + sliding gold marker); the **composed homepage** (AIRING strip, Top10+Latest-Drop showcase pair, For-You teaser, folio line); the **constellation veil + animated pulse** (per-surface reveal over the kept city backdrop — Den darkest → Discover open, crossfade on glide); the **update log re-homed to the welcome door** with tier labels; **`quotes.json` + Admin ▸ Quotes** (drag/search/dupe-detection/length-hints + ✨ASK inside); the **More-Info deep-dive hint pill** (once-per-visitor). v1.8.3 (the day before): Den-door welcome (Blake's banner + quote bubbles, per-session), Blake's Den homepage + persistent header, scroll-reveal, chip filter redesign, live search, continue rail, SEO icon/JSON-LD.

---

## ⚡ For the next Cowork chat (startup script)

1. **Read order:** `AI-PRIMER.md` → this file end-to-end → `COWORK-STYLE.md` (**incl. §13 mode-recs + the 2026-06-06 session notes**) → `SHIP-OUTPUT.md` (the v1.8.4 prod-deploy report — the site IS live; curl if in doubt) → `SHIP-PROMPT.md` (**PARKED on purpose — no staged prompt**).
2. **DO NOT stage a Code prompt at open.** This chat starts differently: Blake's first move is a **big v1.9.0 Community/Account info-dump**. Your job: absorb it, ask clarifying questions (2-4 option multi-choice + your recommendation — he picks fast and sometimes writes back something better), make sure every banked seed below rides along, THEN draft the **v1.9.0 gate-0 design-study prompt** and show it to Blake for review BEFORE he pastes it to Code.
3. **Recommend a Code mode with every paste line** — High / Max / ULTRAMAX sized to the gate (COWORK-STYLE §13). Big design studies = ULTRAMAX (Code runs judge-panel + adversarial-review workflows on ULTRAMAX — they produced this session's "my jaw dropped" results).
4. **Blake's scale warning, verbatim:** "Community overhaul will probably be the biggest update yet… The amount of ideas I have and work it will take." Expect Code's design study to propose **multiple ships** — Blake split v1.8.3/v1.8.4 happily before.

## v1.9.0 seeds — ALL banked, none may be lost (cross-check NEXT.md)

- **Core scope:** comments overhaul (incl. per-season), community reviews overhaul, notifications system + UI (Cloud Function pruning), **DM inbox** (admin↔visitor suggestion replies — needs visitor identity on suggestion docs), account redesign, Cloud Functions (cascade deletes too), **privacy notice** (overdue).
- **Blake's adds:** **welcome-door catch-up buttons** (returning users see watchlist updates / new seasons of favorites, buttons-within-buttons deep-linking into the site); **account-page cover art** for watchlist/favorites rows; **"N people requested this"** chip (deferred from v1.8.4 — needs the CF count-only aggregate `suggestionCounts/{anilistId}`; full plan in NEXT.md).
- **NEAR-TERM riders** (can ride v1.9.0 or a small ship before it): **About-Me/Credits/Contact footer overhaul** (premium pass + scroll-reveal; restyle the container, **don't rewrite Blake's copy without asking**); **Mode-1 desktop launcher** (~30min, parked since 06-04).
- **Known deferred bug** (Blake: "cleanup after v2 maybe"): **multi-season watched-set vs the discovery sticker** — non-primary seasons show NOT REVIEWED on cards even when watched-set-ticked; the modal behind tells the truth. Full analysis in NEXT.md.
- **v1.8.4 banked knobs:** For-You title alternates · veil-pulse tuning + extending the pulse to account/suggest · showcase bottom-align knob · "Blake's Constellation" static-SVG polish.
- **Blake-side TODOs (remind gently):** Google Search Console → Request Indexing (the logo-in-search fix shipped v1.8.3; Google's clock); the browser-security-extension site rating (his "green checkmark" ask — a Cowork+Blake errand, submit the site for review when he wants).

## The ladder
**v1.8.4 ✅ LIVE** → **v1.9.0 Community/Account** (gate-0 design study; Blake: "asap") → v1.9.5 site-wide UI + search → v2.0.0 Mobile → v2.1+ Cloud Admin (retires Excel-canonical — own design phase). Floating: Smoothness round 2 (measured levers banked since v1.8.0).

## What this session learned (carry-forward — READ THESE)

1. **Mode recs are mandatory now** (Blake's ask): every paste line carries High/Max/ULTRAMAX. (`feedback_code_mode_recommendation`)
2. **"report" = digest (5-15 lines, tables) + EXACT numbered smoke steps that state the obvious** — which steps need `npm run mode1` on vs off, exactly what he should see, private-window instructions spelled out. He asked for this verbatim multiple times.
3. **Fold late Blake items into a staged-but-unconsumed SHIP-PROMPT** (Edit the file, retitle the gate) — he keeps adding between staging and pasting; this worked all session. If Code might already be running, log to NEXT.md instead and ride the next gate.
4. **Blake retracts** ("actually I take it back — update log is fine as is"). When he flags a redesign with uncertainty, give him room before staging; only lock what he's confirmed.
5. **Quote Blake verbatim in prompts** — Code treats his words as spec and it repeatedly nailed his intent (the veil, the pulse spec, the quotes bubbles took 4 iterations — precision of his words mattered each round).
6. **Honest-over-impressive is the house style**: Code refused to fabricate tier-label variety and rewrote inaccurate Editor's-Note copy; Blake explicitly values it. Never let a prompt pressure Code into overclaiming.
7. **Blake's Firefox Profiler is the perf arbiter** (headless can't measure paint). The veil/pulse/carousel precedents: compositor-only, visibility-gated, reduced-motion static, no backdrop-filter, no scroll-linked paint. The Den marquee vs Discover native-scroll = two intentional motion languages.
8. **Curl the live site = ground truth** for "is it deployed."
9. **Ideas → NEXT.md IMMEDIATELY with his words quoted.** He worries about idea loss between chats — show him the receipts table when he asks "is X saved?"
10. **Go-signal discipline held**: prod prompts staged only AFTER he says it in chat, his exact words + date written in. ("ship it" / "push it" / "ship it everything looks good" all counted — they were said in chat first.)
11. **Iterative smoke is his QA**: expect 3-6 fix items per look-gate, screenshots as spec. Sub-gates (3b/3c/3d…) are normal, not failure. Design gates that ended in "my jaw dropped" went through 2-4 rounds first.

## Rolling files (current state)

- **`docs/SHIP-PROMPT.md`** — **PARKED, intentionally empty of work** (a note pointing here). The next prompt is v1.9.0 gate 0, authored by the next Cowork AFTER Blake's info-dump + clarifying questions, reviewed by Blake before pasting.
- **`docs/SHIP-OUTPUT.md`** — the v1.8.4 production-deploy report (live verification table).
- **`docs/CODE-HANDOFF.md`** — refreshed by Code to v1.8.4-live state (function map, banked knobs, next = v1.9.0).
- **`docs/HANDOFF.md`** — this file, rewritten at session close.
- **`docs/COWORK-STYLE.md`** — §13 (mode recs) + the 2026-06-06 session-notes section. Still untracked by design.

## Process rules still apply
Rule #1 Excel canonical (untouched this ship — discovery surfaces are runtime-only) · #2 author markers · #5 deploy ladder · #7 `npm test` (84) before production-facing commits · #8 gitignore↔firebase mirror · no provider names visitor-facing · no native dialogs · `[hidden]` symmetry · artifact at SESSION END only · mobile testing deferred to v2.0 · never pre-assert the go-signal.
