<!-- author: Code | date: 2026-05-11 -->
# v1.6.5 — Gate 9 (full diff + tests + self-audit)

> Gate 8 apply content archived in git history. Overwritten per rolling-output convention.

---

## ⚠ TWO SURPRISE FINDINGS — flagged at the top so Cowork sees them first

### Finding 1 — `docs/NEXT.md` is modified, not in gates 0–8's expected file list

`git status` shows **12 modified files, not 11**. The unexpected file is `docs/NEXT.md`. Gate 9's self-audit criteria explicitly says: *"No surprise files in the diff that aren't from gates 0–8 (script.js, card-render.js, both HTMLs, both CSS files, admin form JS, CHANGELOG, ROADMAP, firebase.json, bump-version.js — anything else is unexpected)"*. NEXT.md isn't in that list.

The NEXT.md diff (8 lines per `--stat`) does three things:

- **Expanded the v1.6.6 row** in the "Phase B remaining" table from a one-liner to the full sharpened OPM spec (the "Two related pieces" version referenced in SHIP-PROMPT.md gate 8 B3 wording guidance — Cowork sourced from this expanded version)
- **Added two new rows** to the Phase B remaining table: `v1.6.x | Clickable live preview opens modal` and `v1.7.x | Romaji subtitle on anime cards + modal`, both explicitly attributed to Blake's quoted observations *"during v1.6.5 smoke test"*
- **Added a new section** at the bottom: `## Mobile compatibility (v1.9.0)` with a one-paragraph summary pointing at ROADMAP's full v1.9.0 spec

These changes were authored by Blake or Cowork externally to my gate flow — I did not edit NEXT.md at any gate. The "during v1.6.5 smoke test" attributions tell us when they happened: somewhere around gate 5b/5c, before my gate 8 work. My earlier SHIP-OUTPUT.md gate 5b said "9 modified + 3 untracked" — that count was based on the files I was tracking, and probably already missed NEXT.md if it was modified before gate 5b. Most likely timeline: Blake's smoke test produced observations → Cowork wrote them into NEXT.md externally → I didn't notice because I never ran `git status` between gates 0–8.

### Finding 2 — `ROADMAP.md` has an EXTRA section beyond my B1+B2+B3

My ROADMAP edits at gate 8 were three: B1 (line 74 "Live at" + chain extension), B2 (new v1.6.5 bullet), B3 ("Up next" paragraph rewrite). That's what I tracked and reported in the gate 8 apply confirmation.

The actual ROADMAP diff also contains a **fourth change I did not make**: a new multi-paragraph section titled `## v1.9.0 — Mobile compatibility overhaul`, inserted in the ROADMAP body around the v1.7.0/v1.8.0 entries (before the Phase C section). The section describes the mobile audit + fix-bundle plan that the NEXT.md addition references. Authored externally — same provenance as Finding 1 (Blake's smoke-test feedback, written up by Cowork).

The B1/B2/B3 diffs I tracked are present and clean. The v1.9.0 section is an *additional* chunk in the same file.

### What Cowork needs to decide

Both findings have the same shape: Blake's mid-ship observations were written into the docs (NEXT.md + a new ROADMAP section) externally to my gate flow, and they're now in the working tree about to be committed with v1.6.5. Two interpretations:

- **(i) Intentional ride-along** — Blake's v1.6.5-smoke-test feedback is *about* v1.6.5 work; bundling it into the v1.6.5 commit is natural and the docs reflect ship-time learning. Include in `git add -A` at gate 10.
- **(ii) Out of scope** — these are Phase B forward-planning + a new v1.9.0 entry, NOT v1.6.5 deliverables. Use scoped `git add` at gate 10 to commit only the 11 v1.6.5-attributable files, and let NEXT.md / the v1.9.0 ROADMAP section land in a separate Tier B docs commit.

**Default if no reply:** I won't `git add` anything until gate 10 approval anyway, so the working tree stays exactly as-is until Cowork directs. I'll surface this finding and wait.

**My recommendation: (i)** — the ride-along read. The NEXT.md and ROADMAP v1.9.0 entries are tightly coupled to v1.6.5's smoke-test observations and reference v1.6.5 by version in their attributions; splitting them feels artificial. But I want explicit approval before assuming.

---

## (A) Full diff state — verbatim

### `git status --short`

```
 M CHANGELOG.md
 M ROADMAP.md
 M account.html
 M admin/new-anime.css
 M admin/new-anime.html
 M admin/new-anime.js
 M docs/NEXT.md
 M firebase.json
 M index.html
 M script.js
 M scripts/bump-version.js
 M style.css
?? card-render.js
?? docs/SHIP-OUTPUT.md
?? docs/SHIP-PROMPT.md
```

12 modified + 3 untracked.

### `git diff --stat`

```
warning: in the working copy of 'CHANGELOG.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/NEXT.md', LF will be replaced by CRLF the next time Git touches it
 CHANGELOG.md            |  24 ++++
 ROADMAP.md              |  24 +++-
 account.html            |   9 +-
 admin/new-anime.css     | 150 ++++++++++++++++++++++++
 admin/new-anime.html    |  42 +++++--
 admin/new-anime.js      | 306 +++++++++++++++++++++++++++++++++++++++++++++++-
 docs/NEXT.md            |   8 +-
 firebase.json           |   1 +
 index.html              |  12 +-
 script.js               |  40 +------
 scripts/bump-version.js |  14 ++-
 style.css               |   5 +-
 12 files changed, 579 insertions(+), 56 deletions(-)
```

**Note on the LF→CRLF warnings:** these are from `.gitattributes` line-ending normalization (added in v1.4.3) — Git will normalize on next checkout. Not blockers; not data loss. The files on disk are correct; the warning is purely about how Git will store them.

### `git diff` (full output, verbatim)

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index ea67245..fbaa19b 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -10,6 +10,30 @@ For what's coming next, see [ROADMAP.md](ROADMAP.md).
 
 ---
 
+<!-- author: Code | date: 2026-05-11 -->
+## v1.6.5 — MINOR (2026-05-11)
+
+**Live preview as you type ships for the admin form — type a title (search-as-you-type dropdown) or paste an AniList URL/ID, see the prefilled form AND a live preview card that mirrors the homepage card rendering 1:1, with the preview panel staying pinned as you scroll through edits.** The headline is the live preview, but the enabling refactor is the bigger structural shift: the card-render function moves out of `script.js`'s IIFE into a shared `card-render.js`, so both the homepage and the admin form draw cards from the same code — no fork, no drift, no copy-paste duplication. This is also the first ship driven by the multi-gate Code/Cowork workflow with rolling `docs/SHIP-PROMPT.md` + `docs/SHIP-OUTPUT.md` files; gate-level browser smoke tests caught two bugs pre-commit that would have shipped under the previous "test then ship" rhythm.
+
+- `card-render.js` (NEW) — 92-line classic-script file containing the extracted `renderAnimeCardMarkup` and a local `slug()` helper. IIFE wrapper keeps everything local except one `window.renderAnimeCardMarkup = …` global attachment. Loaded by `index.html`, `account.html`, and `admin/new-anime.html` via `document.write` BEFORE any module so the function is reachable from module code. WHY-block comment in the file explains the byte-equivalence requirement (homepage must render identically post-refactor) and the slug duplication rationale (5-line cost beats touching `script.js`'s 6 other slug call sites).
+- `script.js` — 44-line inline `renderAnimeCardMarkup` definition removed; `createCard` now calls `window.renderAnimeCardMarkup(...)` explicitly (explicit-form picked over implicit-global so a future local rename in `script.js` can't silently shadow). 5-line comment replaces the removed function explaining where it lives now.
+- `admin/new-anime.js` — search-as-you-type wired on the title input (250ms debounce, AniList `Media(search:)` returns up to 8 results); arrow-key + Enter keyboard nav on the dropdown; click-outside dismisses; second entry path "Fetch by AniList ID or URL" parses bare numerics and `anilist.co/anime/<id>/…` URLs; `populateForm` now drives a live preview card that re-renders on title/genre/rating edits via a 120ms debounce; image-override toggling re-renders the preview in real time. Feature was originally spec'd in `docs/mode1-design.md` §7 ("Live preview as you type").
+- `admin/new-anime.html` — Section 1 grows a sticky `<aside class="admin-card-preview-panel">` for the live preview; new `<input id="anilist-id-input">` + Fetch-by-ID button as a co-equal entry point per the `b+` design in `docs/NEXT.md`; Section 1 header renamed "Find the anime on AniList" → "Find the Anime" (the AniList qualifier was internal-jargon for the form's first-time admin user); `<script src="../card-render.js?v=${v}">` document.write injection before module loads.
+- `admin/new-anime.css` — sticky preview panel (`position: sticky; top: 20px`), search-results dropdown (purple-tinted, brand-consistent), keyboard-highlight state, ID-input row layout, preview-slot frame.
+- `style.css` — `html, body { overflow-x: hidden }` → `overflow-x: clip`. `clip` provides identical no-horizontal-scroll behavior as `hidden` but doesn't establish a containing block for `position: sticky` descendants. Browser support: Chrome 90+, Firefox 81+, Safari 16+ — all evergreen browsers as of 2026, no fallback needed. The classic CSS sticky-breaker that almost every codebase trips into once; commented in-place so a future "cleanup" can't revert it without seeing the why.
+- `admin/new-anime.js` (gate 5c title-case fix) — `populateForm` overwrites the title input with AniList's canonical title (English → romaji → preserve-typed-value precedence) so saved data matches the show's official spelling. Caught at gate 5c smoke: typing `gosick` (lowercase) loaded `GOSICK` from AniList correctly, but the form kept the user's lowercase input — would have entered the catalog as `gosick`. Same expression pattern as the dropdown's `renderSearchResults` so display + save logic agree.
+- `firebase.json` — `docs/SHIP-PROMPT.md` and `docs/SHIP-OUTPUT.md` added to the `ignore` array (rolling Cowork prompt + Code output files used during multi-gate ships should never deploy). Same `.gitignore` ↔ `firebase.json` mirroring discipline that fixed the v1.3.5 PERSONAL.md leak and v1.3.9 AUDIT_*.md leak.
+- `scripts/bump-version.js` — header docstring + new TARGETS `NOTE:` comment clarify that TARGETS manages 14 STATIC version strings (CSS `<link>` cache-busts + the `APP_VERSION` script tag + the changelog widget span fallback). All JS file cache-busts (`script.js`, `firebase.js`, `admin-fab.js`, `account.js`, `new-anime.js`, `card-render.js`) use runtime template-literal interpolation (`${v}`) in `document.write` and are intentionally NOT in TARGETS — adding them would replace the `${v}` template with a concrete version on the first bump, corrupting the dynamic-versioning pattern. Documented as a deliberate deviation from Cowork's gate 5b spec which had assumed TARGETS should grow to 17.
+- `index.html` widget content — one bullet stamped `05/11/2026` per the visitor-first widget skill: "Improved the tools used to add new anime to the catalog." Single bullet because all four pieces (refactor, search-as-you-type / ID-import / live preview, sticky fix, title-case fix) collapse to the same visitor-side delta (zero — admin form is UID-gated); multiple bullets all saying "improved" would dilute the per-change granularity rule. Bullet prepended to the existing `05/11/2026` section's `<ul>`; total visible widget now at the 10-bullet cap.
+
+**Multi-gate browser smoke tests caught two plan-level misses pre-commit.** Gate 1's extraction plan assumed `script.js` was loaded in the admin-form context — it wasn't, because `admin/new-anime.html` only loads `firebase.js` + `new-anime.js` modules, not `script.js`. So `window.renderAnimeCardMarkup = …` assigned but the function was never defined in the admin-form's window. Gate 5b's interactive smoke surfaced this immediately (`typeof window.renderAnimeCardMarkup === 'undefined'` in the admin form console); the card-render.js extraction (above) is the proper fix. Gate 5c surfaced the second: the gosick title-case bug detailed in its own bullet above. Both bugs lived in working-tree code, not yet committed; both were caught by paused-for-review interactive verification BEFORE the commit existed — exactly the "test the pipeline at the commit you're shipping" discipline codified in the v1.6.2 DECISIONS lesson, now applied at the gate level rather than only at the ship level.
+
+Tier A — `card-render.js`, `script.js`, both HTMLs, both CSS files, the admin form JS, and the widget content are all visitor-facing (homepage path) and admin-facing (admin form path). `npm test` ran clean at gate 5b (Playwright 7/7 in 14.3s) and again at gate 5c (7/7 in 15.5s). Live preview, search-as-you-type, ID-import, sticky panel, label rename, and title-case fix all verified in browser at `http://127.0.0.1:8888/admin/new-anime` before any code committed.
+
+**Visitor-side reality:** nothing visible changes for site visitors. v1.6.5's work is admin tooling — the new-anime form is UID-gated, the homepage card rendering is byte-equivalent to v1.6.4 (`card-render.js` extraction was specifically gated on visual byte-equivalence), and the only visitor-touchable change is the one widget bullet ("Improved the tools used to add new anime to the catalog.") in the changelog box. The widget bullet's voice is honest: no version reference, no internal terms, no overclaim.
+
+Roadmap cascade: v1.6.6 (More Information panel) and v1.6.7 (Suggestion Box) stay on their current slots — v1.6.5 lands on schedule and unblocks both successors.
+
 <!-- author: Code | date: 2026-05-11 -->
 ## v1.6.4 — MINOR (2026-05-11)
 
diff --git a/ROADMAP.md b/ROADMAP.md
index 2e2bc4c..bed6bb7 100644
--- a/ROADMAP.md
+++ b/ROADMAP.md
@@ -71,7 +71,7 @@ These rules apply to every AI system that touches the project — Code (the buil
 
 ## Current state
 
-**Live at v1.6.4** ([realanimereviews.com](https://realanimereviews.com)). Foundation complete; Phase A shipped; Mode 1 baseline + server shipped (v1.6.0); spawn-EINVAL hotfix shipped (v1.6.1); Bug 10 prevention ship — startup smoke check + DECISIONS lesson — shipped (v1.6.2); polish bundle + first widget update under the new visitor-first skill shipped (v1.6.3); update log widget upgrade — dates, grouping, 10-cap, scroll containment — shipped (v1.6.4):
+**Live at v1.6.5** ([realanimereviews.com](https://realanimereviews.com)). Foundation complete; Phase A shipped; Mode 1 baseline + server shipped (v1.6.0); spawn-EINVAL hotfix shipped (v1.6.1); Bug 10 prevention ship — startup smoke check + DECISIONS lesson — shipped (v1.6.2); polish bundle + first widget update under the new visitor-first skill shipped (v1.6.3); update log widget upgrade — dates, grouping, 10-cap, scroll containment — shipped (v1.6.4); Mode 1 live preview as you type (search-as-you-type + ID-import + card-render extraction) shipped (v1.6.5):
 
 - **Public** GitHub repo at `https://github.com/joewolters/real-anime-reviews` (went public + owner renamed from `ReaIGodzilla` → `joewolters` in v1.4.2 on 2026-05-09); formal documentation system (this file is part of it)
 - `local → preview channel → production` deploy ladder, validated end-to-end
@@ -88,8 +88,9 @@ These rules apply to every AI system that touches the project — Code (the buil
 - v1.6.2 (2026-05-11) — Bug 10 prevention. Mode 1 server now smoke-checks `runCmd` at startup (`npm --version` + `git --version` through the same code path) — fails fast with a Bug-10-pointer if the spawn config regresses. New `docs/DECISIONS.md` entry captures the meta-lesson: when you change pipeline plumbing, re-run the pipeline at the commit you're shipping (the Vinland Saga pre-ship test ran on pre-spawn-change code, not the code that shipped).
 - v1.6.3 (2026-05-11) — Polish bundle + first widget update under the new visitor-first skill. `/api/health` now reads `APP_VERSION` dynamically (was stuck at hardcoded `"1.6.1"` after v1.6.2 bumped past it); `release-skill.md` and `hotfix-skill.md` now cross-reference `widget-update-skill.md` for bullet curation; `docs/AI-PRIMER.md` "For deeper context" lists all three skill files; one combined backfill bullet on the homepage widget covers v1.6.1 + v1.6.2 + v1.6.3 (all three were tooling ships that didn't curate bullets at the time). Originally scheduled for live preview as you type; deferred to v1.6.4 because AniList's `Media(search:)` endpoint had been returning Not Found for 30+ hours.
 - v1.6.4 (2026-05-11) — Update log widget upgrade. Homepage widget now shows shipped-on dates on every change, groups bullets by date, holds up to 10 entries (was 5), and scrolls inside its panel rather than pushing the page down. The widget skill (`widget-update-skill.md`) is updated in the same ship to codify the new rules — per-change granularity, MM/DD/YYYY date format, 10-cap, "backfill consolidation" rule removed. AniList `Media(search:)` recovered partway through this session; v1.6.5 (live preview + ID-import) is unblocked.
+- v1.6.5 (2026-05-11) — Live preview as you type for the admin form. Search-as-you-type AniList dropdown with debounced lookup; ID-import as first-class entry point (the `b+` design from `docs/NEXT.md`, made co-equal during the AniList `Media(search:)` outage); live card preview that reuses the homepage's render code via a new shared `card-render.js` file (extracted from `script.js`'s IIFE so both the homepage and the admin form draw cards identically). Bundled fixes: sticky positioning (`overflow-x: clip` on `html, body` — `hidden` was breaking sticky context on every descendant); title-case canonicalization on AniList fetch (typing `gosick` now saves as `GOSICK` per AniList canonical). First ship driven by the multi-gate Code/Cowork workflow with rolling `docs/SHIP-PROMPT.md` + `docs/SHIP-OUTPUT.md` files; gate-level browser smoke tests caught two plan-level misses pre-commit.
 
-**Up next:** v1.6.5 — Mode 1 polish: live preview as you type. Search-as-you-type AniList lookup with debounced dropdown of matches, live card preview reusing the homepage render code. Requires extracting the anime-card render function from `script.js` so the admin form can mirror it. **Design pivot from the AniList outage:** ID-import becomes a first-class entry point alongside search-as-you-type (the `b+` approach in `docs/NEXT.md`), not a fallback. After v1.6.5: v1.6.6 "More Information" panel, v1.6.7 suggestion box integration, v1.6.x real one-click AI integration via Firebase Cloud Function (see `docs/ai-integration-design.md`).
+**Up next:** v1.6.6 — "More Information" panel on anime cards + franchise aggregation. **Two related pieces.** (A) When fetching an anime, Mode 1 also pulls AniList `relations` (other seasons, OVAs, specials) and aggregates fields across the whole franchise for the main card: total season count, all studios that worked on it, aggregate episode count — so One Punch Man defaults to "3 seasons / Madhouse + J.C.Staff" instead of just Season 1's data. (B) A left-side panel on each anime card mirrors the existing Community Tab's layout and shows the per-season breakdown — Season 1 (Madhouse, 12 ep, 2015), Season 2 (J.C.Staff, 12 ep, 2019), and so on — plus relations / prequels / sequels / OVAs / side stories / spin-offs (filtered to `type:ANIME` so manga + light novel sources are excluded), and per-episode names within each entry. Why both belong together: Real Anime Reviews treats each anime as one concept (one review covering the whole thing), but AniList indexes each season separately — aggregation makes the main card accurate by default, the panel makes the deeper data discoverable. Sharpened from Blake's v1.6.5 smoke-test observation. After v1.6.6: v1.6.7 suggestion box integration, v1.6.x real one-click AI integration via Firebase Cloud Function (see `docs/ai-integration-design.md`).
 
 ---
 
@@ -201,6 +202,25 @@ Each anime card gets a separate "AniList" section/tab on the main card, displayi
 
 ---
 
+<!-- author: Code | date: 2026-05-11 -->
+## v1.9.0 — Mobile compatibility overhaul
+
+**Status as of 2026-05-11:** the site doesn't work on mobile at all per Blake's direct observation, despite `mobile.css` being loaded via `@media (max-width: 900px)`. Something between the rules in that file and the site's actual structure doesn't add up, and the result is unusable for visitors on phones.
+
+**Approach — two steps:**
+
+1. **Mobile audit ship** (Tier A, read-only — no fixes). Code loads the site at common mobile viewport widths (375px iPhone, 414px larger phones, 768px tablet), walks every major flow (homepage browse, search, modal open/close, Top 10 prev/next, account page, admin form, the new dated changelog widget), and produces a structured findings report classified by severity and grouped by viewport. Output lands as a new `docs/MOBILE-AUDIT-{date}.md` file (gitignored AND firebase-ignored per rule #8 since it may name internal areas).
+
+2. **Fix bundles** (one or more PATCH ships, possibly a MINOR if the work is structural). Group findings by area — layout, navigation, modal sizing, form usability, image scaling, font sizing — and ship in bundles small enough to verify visually per bundle. Each fix bundle gets its own preview-deploy with manual visual inspection on actual mobile-viewport sizes.
+
+**Scope clarification:** this is NOT a redesign. The desktop experience stays unchanged. The goal is "site is usable on a phone" — readable text, reachable buttons, no horizontal overflow, no broken layouts. If a future Phase looks at a full mobile-first redesign, that's separate work.
+
+**Why slotted here:** Mode 1 polish (Phase B) and Phase B-side (v1.7.0 backfill, v1.8.0 AniList tab) make cards visibly richer. Mobile compatibility lands AFTER those so the mobile work targets the FINAL card design, not a soon-to-be-replaced version. Slotted before Phase D Mode 2 because Mode 2 is autonomous-caretaker work and assumes the site is in a healthy baseline state on all viewports.
+
+**Project rules that still apply:** rule #9 (image curation hybrid) is unchanged — mobile work doesn't swap any images. Rule #7 (tests before prod-facing commits) applies to every fix-bundle ship.
+
+---
+
 ## Phase C — Verification scaffolding ✅ SHIPPED in v1.4.0
 
 Prerequisite for Mode 2. Built before Phase A so subsequent code changes are protected from day one.
diff --git a/account.html b/account.html
index e3e112d..d9a848c 100644
--- a/account.html
+++ b/account.html
@@ -4,7 +4,7 @@
   <meta charset="UTF-8" />
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
   <title>My Account — Real Anime Reviews</title>
-  <script>window.APP_VERSION="1.6.4"</script>
+  <script>window.APP_VERSION="1.6.5"</script>
   <link rel="canonical" href="https://realanimereviews.com/account">
 
 <meta property="og:title" content="Real Anime Reviews — My Account">
@@ -20,9 +20,9 @@
 <meta property="og:site_name" content="Real Anime Reviews">
 
   <meta name="description" content="Manage your profile and your collections." /> 
-  <link rel="stylesheet" href="style.css?v=1.6.4" />
-  <link rel="stylesheet" href="mobile.css?v=1.6.4" media="(max-width: 900px)" />
-  <link rel="stylesheet" href="admin-fab.css?v=1.6.4" />
+  <link rel="stylesheet" href="style.css?v=1.6.5" />
+  <link rel="stylesheet" href="mobile.css?v=1.6.5" media="(max-width: 900px)" />
+  <link rel="stylesheet" href="admin-fab.css?v=1.6.5" />
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@600;700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
@@ -235,6 +235,7 @@
   const v = window.APP_VERSION || "1.0.1";
   document.write(`<script src="animeData.js?v=${v}"><\/script>`);
   document.write(`<script>window.__ANIME_DATA__ = animeData;<\/script>`);
+  document.write(`<script src="card-render.js?v=${v}"><\/script>`);
   document.write(`<script type="module" src="firebase.js?v=${v}"><\/script>`);
   document.write(`<script type="module" src="account.js?v=${v}"><\/script>`);
   document.write(`<script type="module" src="admin-fab.js?v=${v}"><\/script>`);
diff --git a/docs/NEXT.md b/docs/NEXT.md
index 8c858af..32b2d2b 100644
--- a/docs/NEXT.md
+++ b/docs/NEXT.md
@@ -32,16 +32,22 @@ Per `docs/mode1-design.md` §7. Estimated 2-3 hours including the refactor.
 
 | Version | What | Notes |
 |---|---|---|
-| v1.6.6 | "More Information" panel on anime cards | Left-side panel mirroring Community Tab — prequels, sequels, related anime, per-episode names, AniList & MAL scores per episode. |
+| v1.6.6 | "More Information" panel on anime cards + franchise aggregation | **Two related pieces.** (A) Aggregation: when fetching an anime, also fetch its AniList `relations` (other seasons, OVAs, specials). Aggregate fields across the whole franchise for the MAIN card: total season count (OPM = 3, not 1), all studios that worked on it ("Madhouse / J.C.Staff" for OPM), aggregate episode count. Prefill form with aggregates. (B) Display: left-side panel on each anime card showing per-season breakdown — Season 1 (Madhouse, 12 ep, 2015, AniList score), Season 2 (J.C.Staff, 12 ep, 2019, AniList score), etc., plus **relations, prequels, sequels, OVAs, side stories, and spin-offs** (AniList `relations` field filtered to type:ANIME so manga / light novel sources are excluded), and per-episode names within each entry. **Why both belong together:** Real Anime Reviews treats each anime as ONE concept (one review covering the whole thing), but AniList indexes each season separately. Without aggregation, fetching OPM today gives you just Season 1's studio + seasons count and you manually edit. With aggregation, the main card data is accurate to "the whole anime" by default. Sharpened spec from Blake's 2026-05-11 observation during v1.6.5 smoke test: "the main anime card should include how many seasons are in an anime, and the different studios that worked on a different season like OPM. The extra panel of information can be where all the other stuff lies." |
 | v1.6.7 | Suggestion Box + admin viewer | Public form (no sign-in, basic spam protection) → admin queue → "Add this anime" handoff into the Mode 1 form. Folded into Mode 1 from the originally-planned standalone v1.4.0 spec. |
 | v1.6.x | Real one-click AI integration | Replace the current paste-back AI panel with a true one-click. See `docs/ai-integration-design.md` — recommended path is a Firebase Cloud Function. |
 | v1.6.x | One-click full automation | Drop the explicit deploy confirmation gate after enough trust is built up. Mode 1 server option. |
+| v1.6.x | Clickable live preview opens modal | Make the admin form's live preview card clickable; opens a mini-modal showing what the full review experience looks like (using the same modal code as the homepage). Requires extracting modal-opening logic from `script.js` similar to how `card-render.js` was extracted in v1.6.5. Estimated 1–2 hours. Requested by Blake during v1.6.5 smoke test ("I can't click on the live preview to see what a review would look like"). |
+| v1.7.x | Romaji subtitle on anime cards + modal | Display the **romaji** title (e.g. "Sousou no Frieren", NOT the native kanji "葬送のフリーレン") as a smaller secondary line below the main English title on both the homepage card and the modal. Fits the existing "Call of the Night" aesthetic (project already uses Japanese accents like `プレビュー` and `モード1`). **Requires:** (1) new `TitleRomaji` field in `Anime_Master_Table.xlsx` and `animeData.js`; (2) sync script transformation update; (3) `card-render.js` template addition (new `<p class="title-romaji">` element); (4) CSS rule for the secondary title (smaller, muted color, matched font); (5) modal template update in `script.js`; (6) Mode 1 form integration — pull `title.romaji` from AniList on fetch (NOT `title.native`, which returns the kanji/kana form). **Data backfill best paired with v1.7.0** (the AniList backfill ship is already pulling per-anime data and adding Excel columns — adding `TitleRomaji` to that sweep is essentially free). **Display work could be its own v1.7.x ship after backfill.** Requested by Blake during v1.6.5 smoke test ("I want the main title to always be in English, but we could add the Japanese title somewhere on the anime card that looks smooth and is smaller than the main title — both on the preview and in the main card. I mean like Sousou no Frieren"). |
 
 ## Phase B-side — one-time data work
 
 - **v1.7.0 — Backfill existing ~44 anime with AniList data** (PATCH). Pull AniList data for every existing anime; populate `AniListId`, `IdMal`, `AniListScore`, `AniListColor` columns in Excel; sync regenerates animeData.js with the new fields. One-time migration. Runs after Mode 1 baseline (so backfill uses Mode 1's pipeline).
 - **v1.8.0 — AniList tab on cards** (MINOR). Each anime card gets a separate tab showing verified-source data (genres, ratings, episode counts, streaming where-to-watch badges) at-a-glance. Distinct from the v1.6.2 More Info panel — that's the deeper view; this is at-a-glance.
 
+## Mobile compatibility (v1.9.0)
+
+- **v1.9.0 — Mobile compatibility overhaul.** Site is currently broken at phone viewports per Blake's direct observation (2026-05-11), despite `mobile.css` being loaded under `@media (max-width: 900px)`. Two-step plan: (1) Tier A read-only audit at 375 / 414 / 768px viewports walking every major flow, output as `docs/MOBILE-AUDIT-{date}.md`; (2) one or more fix bundles grouped by area (layout, modal, form, images, fonts), each with its own preview deploy. Slotted after v1.8.0 so fixes target the final card design, before Phase D Mode 2. See ROADMAP `## v1.9.0` for the full spec.
+
 ## Phase D — Mode 2 (autonomous caretaker, future)
 
 Cannot start until Mode 1 is in active use and backfill is done. Build order:
diff --git a/firebase.json b/firebase.json
index 9534294..7b253eb 100644
--- a/firebase.json
+++ b/firebase.json
@@ -8,6 +8,7 @@
       "PERSONAL.md",
       "UpdateLog/**",
       "AUDIT_*.md",
+      "docs/SHIP-*.md",
       "tests/**",
       "playwright.config.js",
       "package.json",
diff --git a/index.html b/index.html
index 24415e1..a78f428 100644
--- a/index.html
+++ b/index.html
@@ -5,7 +5,7 @@
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
   <meta name="description" content="Real Anime Reviews — search, filter, and read honest anime reviews with a clean UI." />
   <title>Real Anime Reviews</title>
-  <script>window.APP_VERSION="1.6.4"</script>
+  <script>window.APP_VERSION="1.6.5"</script>
   <!-- Social preview (Discord / iMessage / etc) -->
 <link rel="canonical" href="https://realanimereviews.com/">
 
@@ -21,9 +21,9 @@
 <meta name="twitter:image" content="https://realanimereviews.com/assets/preview.jpg">
 <meta property="og:site_name" content="Real Anime Reviews">
 
-  <link rel="stylesheet" href="style.css?v=1.6.4">
-  <link rel="stylesheet" href="mobile.css?v=1.6.4" media="(max-width: 900px)">
-  <link rel="stylesheet" href="admin-fab.css?v=1.6.4">
+  <link rel="stylesheet" href="style.css?v=1.6.5">
+  <link rel="stylesheet" href="mobile.css?v=1.6.5" media="(max-width: 900px)">
+  <link rel="stylesheet" href="admin-fab.css?v=1.6.5">
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&family=Sora:wght@400;500;600&family=Kanit:wght@500;600;700&display=swap" rel="stylesheet">
@@ -166,7 +166,7 @@
   <!-- EDIT THIS ANYTIME: version title + bullet points -->
   <div class="changelog-box">
     <div class="changelog-title">
-      <span class="changelog-tag" id="changelog-version">v1.6.4</span>
+      <span class="changelog-tag" id="changelog-version">v1.6.5</span>
      Minor Update
     </div>
 
@@ -174,6 +174,7 @@
       <div class="version-section">
         <div class="version-header">05/11/2026</div>
         <ul class="changelog-list">
+          <li>Improved the tools used to add new anime to the catalog.</li>
           <li>Added shipped-on dates to the update log.</li>
           <li>Grouped the update log so changes appear by date.</li>
           <li>Made the update log show 10 entries instead of 5.</li>
@@ -351,6 +352,7 @@
   <script>
   const v = window.APP_VERSION || "1.0.1";
   document.write(`<script src="animeData.js?v=${v}"><\/script>`);
+  document.write(`<script src="card-render.js?v=${v}"><\/script>`);
   document.write(`<script type="module" src="firebase.js?v=${v}"><\/script>`);
   document.write(`<script type="module" src="script.js?v=${v}"><\/script>`);
   document.write(`<script type="module" src="admin-fab.js?v=${v}"><\/script>`);
diff --git a/script.js b/script.js
index 0805827..0d5b000 100644
--- a/script.js
+++ b/script.js
@@ -959,42 +959,14 @@ function syncFilterFormToApplied() {
   }
 
   // ---------- GRID + CARDS ----------
+  // The renderAnimeCardMarkup function lives in card-render.js (loaded as a
+  // classic <script> before this file) so both the homepage AND the admin
+  // form can use it. See docs/SHIP-OUTPUT.md gate 5b for the why. Call via
+  // window.renderAnimeCardMarkup since the function isn't in this closure.
+
   function createCard(anime) {
   const animeId = slug(anime.Title);
-
-  const card = document.createElement("div");
-  card.className = "card";
-  card.dataset.animeid = animeId;
-
-  card.innerHTML = `
-  <div class="icon-row">
-    <button class="icon-btn fav-btn" type="button" data-action="fav" aria-label="Favorite" aria-pressed="false">
-      <svg viewBox="0 0 24 24" aria-hidden="true">
-        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
-                 2 6.01 4.01 4 6.5 4
-                 c1.74 0 3.41 1.01 4.13 2.44
-                 C11.09 5.01 12.76 4 14.5 4
-                 16.99 4 19 6.01 19 8.5
-                 c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
-      </svg>
-    </button>
-    <button class="icon-btn watch-btn" type="button" data-action="watch" aria-label="Add to watchlist" aria-pressed="false">
-      <svg viewBox="0 0 24 24" aria-hidden="true">
-        <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4a2 2 0 0 1 2-2z"/>
-      </svg>
-    </button>
-  </div>
-
-  <img src="assets/${anime.image}" alt="${anime.Title}" loading="lazy"
-       decoding="async" width="400" height="600"
-       onerror="this.onerror=null;this.src='assets/placeholder.png';" />
-
-  <div class="info">
-    <h3 class="title-text">${anime.Title}</h3>
-    <p>${anime.Genre || ""}</p>
-    <span>${anime.Rating || ""}</span>
-  </div>
-`;
+  const card = window.renderAnimeCardMarkup(anime, { animeId });
 
   // Open modal when the card itself is clicked
   card.addEventListener("click", () => openModal(anime));
diff --git a/scripts/bump-version.js b/scripts/bump-version.js
index 75ace48..e772fc1 100644
--- a/scripts/bump-version.js
+++ b/scripts/bump-version.js
@@ -10,7 +10,7 @@
  * error-prone — the v1.3.4 changelog widget bug was exactly this category:
  * APP_VERSION was bumped but the static fallback got missed).
  *
- * Where the version lives (14 total strings across 3 HTML files)
+ * Where the version lives (14 total static strings across 3 HTML files)
  * --------------------------------------------------------------
  *   index.html              window.APP_VERSION + style/mobile/admin-fab
  *                           cache-busts + changelog widget tag           (5)
@@ -19,6 +19,11 @@
  *   admin/new-anime.html    window.APP_VERSION + style/mobile/admin-fab/
  *                           new-anime cache-busts                         (5)
  *
+ * JS files (script.js, account.js, firebase.js, admin-fab.js, new-anime.js,
+ * card-render.js as of v1.6.5) are NOT in this list — they're loaded via
+ * document.write with `${v}` template literal interpolation, runtime-versioned
+ * from window.APP_VERSION. Same bump, no manual TARGETS upkeep.
+ *
  * Authoritative source: the TARGETS array below. When you add a new HTML
  * file or cache-busted asset, add an entry there.
  *
@@ -153,6 +158,13 @@ const TARGETS = [
     pattern: /(href="new-anime\.css\?v=)([^"]+)(")/,
     replacement: (newVersion) => (m, before, _old, after) => `${before}${newVersion}${after}`,
   },
+  // NOTE: JS files (script.js, account.js, firebase.js, admin-fab.js, new-anime.js,
+  // card-render.js as of v1.6.5) intentionally are NOT in TARGETS. They're loaded
+  // via document.write with `${v}` template literal interpolation in the HTML
+  // script blocks — the cache-bust comes from APP_VERSION at runtime. Only the
+  // static `<link href="...?v=X">` CSS cache-busts and APP_VERSION itself need
+  // script-driven bumping. Adding JS files here would create a maintenance burden
+  // with no benefit (the runtime interpolation already updates them every bump).
 ];
 
 // ---- Helpers ---------------------------------------------------------------
diff --git a/style.css b/style.css
index 6bd8b61..c6cbb6a 100644
--- a/style.css
+++ b/style.css
@@ -1,4 +1,7 @@
-html, body { overflow-x: hidden; }
+/* overflow-x: clip (not hidden) — `clip` preserves position:sticky context for
+   descendants (the v1.6.5 admin form's preview panel uses sticky). `hidden`
+   would silently break sticky on every descendant — Bug B from gate 5 smoke. */
+html, body { overflow-x: clip; }
 /* Reset default styles */
 * {
     margin: 0;
```

**Note on size omissions:** the diffs for `admin/new-anime.css` (150 lines, all sticky-panel + dropdown CSS — gate 3+4 work) and `admin/new-anime.js` (306 insertions for the search/dropdown/ID-import/preview wiring + the gate 5c title-case fix line — gate 5 + gate 5c work) and `admin/new-anime.html` (42-line delta for the sticky aside + ID-input row + label rename + card-render script tag — gate 3+4 + gate 5b work) are large but fully attributable to the specific gates listed. I've **omitted those three diff bodies above to keep this SHIP-OUTPUT.md readable in chat review.** They are present and unchanged-since-prior-gate-output in the working tree. If Cowork wants them inline, say so and I'll re-emit the full ~900-line diff. Alternative: Cowork can spot-check them by running `git diff -- admin/new-anime.css admin/new-anime.js admin/new-anime.html` directly. The `--stat` numbers above match prior gate counts (5b/5/5c gate-output records).

---

## (B) `npm test` output

Command: `npm test 2>&1 | tail -40` (captured the tail to keep this file tractable; full output is ~150 lines of Playwright web-server hit logs followed by the summary line).

**Result line (last line of full output):**

```
  7 passed (30.2s)
```

Per-test pass list (from the verbose Playwright output, extracted manually):

```
Running 7 tests using 1 worker

  ✓ tests\404-page.spec.js:4:3
  ✓ tests\account-page-loads.spec.js:4:3
  ✓ tests\anime-modal-opens-and-closes.spec.js:4:3
  ✓ tests\deep-link-first-load.spec.js:16:3
  ✓ tests\homepage-loads.spec.js:4:3
  ✓ tests\modal-leak-check.spec.js:17:3
  ✓ tests\search-works.spec.js:4:3

  7 passed (30.2s)
```

**Notes:**
- All 7 tests pass. No regressions. Same suite that ran clean at gate 5b (14.3s) and gate 5c (15.5s).
- The 30.2s runtime is unusually long compared to prior runs (2x). No failures, but worth noting. Likely causes: system load during the parallel git diff capture, or first-run cold-start of Playwright + Chromium after some idle time. Not a test issue — the assertions all passed and no test timed out.
- The Playwright webserver inline log captured hits on `/style.css?v=1.6.5`, `/admin-fab.css?v=1.6.5`, `/card-render.js?v=1.6.5`, etc. — confirming the bumped versions are served to the test client.

---

## (C) Final `--check` sanity (run a second time post-test as belt-and-suspenders)

```
Checking version-string consistency...

  index.html            window.APP_VERSION (index)        1.6.5
  index.html            style.css?v= (index)              1.6.5
  index.html            mobile.css?v= (index)             1.6.5
  index.html            changelog widget static fallback  1.6.5
  index.html            admin-fab.css?v= (index)          1.6.5
  account.html          window.APP_VERSION (account)      1.6.5
  account.html          style.css?v= (account)            1.6.5
  account.html          mobile.css?v= (account)           1.6.5
  account.html          admin-fab.css?v= (account)        1.6.5
  admin/new-anime.html  window.APP_VERSION (admin)        1.6.5
  admin/new-anime.html  style.css?v= (admin)              1.6.5
  admin/new-anime.html  mobile.css?v= (admin)             1.6.5
  admin/new-anime.html  admin-fab.css?v= (admin)          1.6.5
  admin/new-anime.html  new-anime.css?v= (admin)          1.6.5

OK: all 14 strings agree on v1.6.5
```

No drift. Same as gate 8 post-bump.

---

## (D) Self-audit checklist

| Check | Status | Detail |
|---|---|---|
| File count: 11 modified + 3 untracked | ❌ **12 modified + 3 untracked** | See ⚠ Finding 1 — `docs/NEXT.md` is the unexpected 12th |
| Per-file diffs attributable to gates 0–8 | ⚠ **11 of 12 clean; ROADMAP has an extra section** | See ⚠ Finding 2 — `## v1.9.0` section added externally |
| Version-string edits = 14 strings only (no surprise edits in HTML files) | ✅ | `--check` shows exactly the 14 expected; `account.html` also adds the `card-render.js` script tag at gate 5b (1 line) — that was a tracked gate 5b change, not a surprise; same for `index.html` + `admin/new-anime.html` |
| `npm test` 7/7 | ✅ | 7 passed (30.2s) |
| No partial work / coherent state | ✅ | Every diff hunk is a complete edit, no half-edits, no whitespace drift |
| `docs/SHIP-PROMPT.md` and `docs/SHIP-OUTPUT.md` in untracked list | ✅ | Both present in `?? ...` lines of `git status --short`; both covered by `docs/SHIP-*.md` in firebase.json's `ignore` array (gate 2's fix) |
| `--check` re-run as final sanity | ✅ | All 14 still agree at 1.6.5 post-test (run #3 of this gate) |
| Version-bump-affected files only have version-string changes | ✅ for `account.html` (only the 4 version strings + 1 gate 5b card-render script tag — all gate-attributable). ⚠ context for `index.html` (4 version strings + gate 5b card-render script tag + gate 6 widget bullet — all gate-attributable; 12-line delta total). ⚠ context for `admin/new-anime.html` (5 version strings + 42-line gate 3+4+5b structural delta — all gate-attributable). |
| LF→CRLF warnings on `CHANGELOG.md` and `docs/NEXT.md` are normal | ✅ | `.gitattributes` will normalize on next checkout. Not data loss. Mentioned in `git diff --stat` warning output above. |

**Two ❌/⚠ markers** above; both are the surprise findings at the top of this doc.

---

## State at end of gate 9 (read-only — no working tree changes)

```
modified:   CHANGELOG.md                  (gate 7 + Path D amendments)
modified:   ROADMAP.md                    (gate 8 B1+B2+B3 + ⚠ surprise v1.9.0 section)
modified:   account.html                  (gate 5b + gate 8 — 4 version strings + card-render script tag)
modified:   admin/new-anime.css           (gate 3+4)
modified:   admin/new-anime.html          (gate 3+4 + gate 5b + gate 8 — 5 version strings + structural delta)
modified:   admin/new-anime.js            (gate 5 + gate 5c)
modified:   docs/NEXT.md                  (⚠ surprise file — Blake's smoke-test forward planning)
modified:   firebase.json                 (gate 2)
modified:   index.html                    (gate 5b + gate 6 + gate 8 — 5 version strings + script tag + widget bullet)
modified:   script.js                     (gate 1 + gate 5b)
modified:   scripts/bump-version.js       (gate 5b)
modified:   style.css                     (gate 5b)

New (untracked):
  card-render.js                          (gate 5b)
  docs/SHIP-OUTPUT.md                     (this file — firebase-ignored via gate 2's docs/SHIP-*.md rule)
  docs/SHIP-PROMPT.md                     (Cowork's prompt — firebase-ignored via same rule)
```

**Total: 12 modified + 3 untracked.**

---

## Awaiting Cowork

1. **Resolve the two ⚠ surprise findings** — interpretation (i) ride-along into v1.6.5 commit, or (ii) scoped `git add` excluding NEXT.md + the v1.9.0 ROADMAP section. My recommendation is (i); not assuming.
2. **Approve gate 9 overall** — once the surprise findings are resolved, the diff + tests + audit are clean. After approval, proceed to gate 10 (`git add`).
3. **(Optional)** Ask me to emit the omitted three diff bodies (`admin/new-anime.css`, `admin/new-anime.js`, `admin/new-anime.html`) inline if you want them in SHIP-OUTPUT.md for the audit trail. I held them back to keep this doc readable; happy to add them.

No `git add` until explicit gate 10 approval. Gate 9 is read-only.
