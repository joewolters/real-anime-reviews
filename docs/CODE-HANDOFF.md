<!-- author: Code | date: 2026-06-05 -->
<!-- AUDIENCE: This file is FOR CODE (another Claude Code instance picking up work). -->
<!-- NOT for Cowork — Cowork reads docs/HANDOFF.md + docs/SHIP-OUTPUT.md and writes docs/SHIP-PROMPT.md. -->
<!-- STATE: mid-v1.8.3, end of GATE 2 (uncommitted). v1.8.2 LIVE (e6fa47f). Read the "YOU ARE HERE" snapshot below FIRST, then docs/SHIP-PROMPT.md (already staged to v1.8.3 G3). -->
<!-- Mannerisms + workflow + commit discipline + traps are all below and current — read them; they're how this project runs. -->

⚠️ **Read the "⚠️ YOU ARE HERE" snapshot (next heading) FIRST** — it has the exact current state (mid-v1.8.3, G2 done + uncommitted, G3 staged). The mannerisms / 12-gate workflow / commit discipline / traps that bite hardest are all further down and still accurate — they ARE how we work, read them before you touch code.

# Code → Code Handoff

> Quick-onboarding doc so a fresh Code session picks up immediately without re-deriving the workflow. **Read order:** this file FIRST → `docs/SHIP-PROMPT.md` (the current gate, if Cowork staged one) → `docs/SHIP-OUTPUT.md` (what the previous Code last did). `CLAUDE.md` auto-loads (permanent rules). Then recon the REAL file state and continue.

---

## ⚠️ READ THIS FIRST — the project is in a SUBFOLDER
**The harness CWD is the repo PARENT (`C:\Users\Owner\PROJECTS\Real Anime Reviews\`). The actual project — `.git`, `CLAUDE.md`, all app files, `docs/` — lives in `Current Version/`.** Every relative path in the gate prompts (`docs/SHIP-PROMPT.md`, `script.js`, etc.) resolves **inside `Current Version/`**. Prefix everything with `Current Version/` (or use absolute paths). Don't burn your first turn `Read`-ing `docs/CODE-HANDOFF.md` from CWD and getting "file does not exist." `Master List/` (the canonical Excel) is a SIBLING of `Current Version/`, OUTSIDE the deploy root — backups/reports written there never deploy. Run all `firebase`/`npm`/`git` from inside `Current Version/` (use `cd "C:/Users/Owner/PROJECTS/Real Anime Reviews/Current Version" && ...`).

---

## ⚠️ YOU ARE HERE (snapshot — 2026-06-05, MID-v1.8.3, end of GATE 2)

**v1.8.2 is the last SHIPPED version — LIVE in prod** (`e6fa47f`, `APP_VERSION="1.8.2"`). **v1.8.3 (Website Identity & Finalization) is IN PROGRESS — built through Gate 2, 100% UNCOMMITTED.** HEAD is still `857a546` (the v1.8.2 docs commit); `APP_VERSION` is still `1.8.2` (the v1.8.3 bump happens in its sweep, gates away).

**⚠️ THERE IS AN UNCOMMITTED v1.8.3 G2 WORKING TREE — don't `git checkout`/`reset` it.** Modified (feature): **`index.html`** (home-view restructure) + **`style.css`** (header backdrop + Blake's Den). Plus the rolling docs. All green (`npm test` **14 passed**) but NOT committed — v1.8.3 commits in its compressed sweep after G5.

**FIRST STEPS for you (the next Code):**
1. `docs/SHIP-PROMPT.md` — **already updated by Cowork to the v1.8.3 GATE 3 prompt; ready to read + follow.** (Welcome "Den door" splash + scroll-reveal.)
2. `docs/SHIP-OUTPUT.md` — what I just did (v1.8.3 **G2**: home restructure + header shell, with **2 flags awaiting Blake's smoke** — see below).
3. `git status` to confirm you see the uncommitted index.html + style.css before touching anything.

### v1.8.3 plan + where the gates are
**The ship is split:** **v1.8.3 = Identity & polish (LOCAL/CSS, NO AniList)**; **v1.8.4 = Discovery & blend (its own gate-0, seeds banked below).** Blake's locked gate-0/1 picks: **Direction C** (slim persistent header + rail-hub home) · **welcome Mock 1 "Den door"** · **G4/G5 separate** · **characters POSTPONED to v1.8.4** (v1.8.3 keeps scroll-reveal of lines/elements only, NO character art) · brainstorm **#1/#2/#4 IN** (Continue-where-you-left-off rail · static late-night den tint · "Blake watched N seasons" provenance on reviewed cards).
- **Gate ladder:** G0 recon+propose ✓ · G1 nav/IA + welcome-mocks propose ✓ · **G2 home restructure + header shell ✓ (APPLIED, uncommitted) ← you just inherited this** · **G3 welcome + scroll-reveal (STAGED, next)** · G4 cards-footer-accent + `reviewed`-flag scaffold + filter overhaul (studio dedup etc.) · G5 brainstorm trio · sweep.

### What G2 actually built (so you understand the current DOM)
`index.html` `#home-view` order is now: **[2 hidden HTML-comment mount points for v1.8.4** — Currently-Airing hero + For-You rail, render NOTHING, no dead UI] → **`#changelog-drop`** (Update Log — UNTOUCHED, still the left-gutter `.side-widget` float) → **`<section class="blakes-den">`** { `.den-header` ("BLAKE'S DEN 隠れ家" kicker + sub) → `.den-top10` (the Top 10 carousel, all IDs intact) → **`#featured-drop.in-den`** (the Latest-Drop card, RELOCATED out of the old right-gutter float into the Den; IDs `#featured-drop`/`#featured-drop-card` preserved so `buildFeaturedDrop` still works) } → **Anime By Genre** (unchanged). `style.css`: `header::before` is now a **persistent** backdrop (was `:hover`-only), + the `.blakes-den` / `.den-*` / `.featured-drop.in-den` rules (the Den is centered + transparent — no full-width panel — so it never collides with the left-gutter Update Log float).

### ⚠️ TWO open flags from G2 — Blake judges at his next smoke; fold his answers into G3
1. **The right gutter is now EMPTY** (featured moved into the Den; the Update Log stays floating top-left per Blake's "stays in current position"). Asymmetric on wide screens — **by design** (v1.8.4's hero/For-You rail fill that top space). If Blake instead wants the Update Log centered (retiring the gutter layout), that's a quick change.
2. **The header backdrop is now always-on** (was transparent-until-hover). Pro-site look; one-line revert if he prefers the old hover-only.

### v1.8.4 seeds (banked — carry into the v1.8.4 gate-0)
- Discover variants: **currently airing · currently airing BY GENRE · top picks by community**; surfaces should **feel fresh per log-on**.
- **⚠️ NEW (banked v1.8.3 gate 4b — Blake's background concept, think about during v1.8.4 design):** a designed **black/opaque layer** (gradients, line-work, purple-themed) OVER the existing city backdrop (`assets/call-of-the-night-bg.jpg`), where the backdrop **gradually reveals** as context changes (his Latest-Drop "alcove" from G3b is the seed of this — extend the reveal-toward-the-edges idea site-wide); LATER, **distinct purple-themed backgrounds per page**. He wants this **paired with the postponed character art** (also v1.8.4). No build in v1.8.3 — design-phase input for v1.8.4. (Note: v1.8.3 G5 shipped a *static* per-load den-tint `body::after` — the v1.8.4 concept is the richer, context-reactive evolution of that.)
- **⚠️ NEW (banked v1.8.3 gate 5 — Blake): a "Quotes admin page"** to manage the welcome-door quotes from a UI instead of the `WELCOME_QUOTES` array in `script.js` (currently the easy-to-edit array near `initWelcome`). He ALSO wants his **chatbot (the ✨ASK drawer, `admin/chat-drawer.js` → `window.RarChatDrawer`) available inside that admin page**. His words: "Build an admin page for that. I want my chatbot in there as well." Pattern to follow: the existing `admin/season-reviews.{html,js,css}` panel (auth-gated via `ADMIN_UID`, classic-script bridges) is the closest template; quotes could persist to a small JSON the homepage fetches (like `season-reviews/index.json`) so the door reads them at runtime. No build in v1.8.3.
- **Architecture (locked at gate 0):** three ADJACENT surfaces — **Blake's Reviews** (his 44, the front door) / **For You** (his picks + AniList near the user's taste, signed-out→Trending) / **Discover** (live search + clickable "Top 10 currently airing", every card NOT-REVIEWED-stickered). ONE card shell + a `reviewed` flag separates them. **The NOT-REVIEWED modal is FREE: the v1.7.4 secondary modal already renders any AniList id as "NOT REVIEWED YET" + "Request this anime" — a discovery card just calls `openSecondaryModal(id)`.** Reviewing a title (AniList-id match, unchanged admin workflow) auto-upgrades it to a primary catalog card. Data: **3 NEW flat AniList queries** (`search:` / `sort:TRENDING_DESC` / `status:RELEASING`) on the existing 24h `localStorage` L2 cache — **test each against the 101922 Demon-Slayer canary first** (the v1.6.10 500s precedent). For-You candidates = top genres/tags of the user's saved CATALOG entries (mapped through `animeData`); Discover search reuses `/suggest`'s 350ms-debounce + AbortController, pinning his 44 matches first.

---

## (history) v1.8.2 SHIPPED + LIVE

**v1.8.2 (Structured review template) is LIVE in prod** (commit `e6fa47f`, `APP_VERSION="1.8.2"`, realanimereviews.com; deployed 2026-06-04).

### What v1.8.2 shipped (Structured review template — all live, in `e6fa47f`)
Reviews can be written in labelled `##` sections (Intro/Animation/Story/Characters/Design/Music/Feel/Extra Thoughts/Overall). **The storage format is ONE markdown string** — `##` headings — unchanged; everything is a render/edit layer on top.
- **`markdown.js`** gained: anchorable heading ids (`<hN id="rsec-…" class="md-h">`, strict `[a-z0-9-]` slug, dedupe `-2`), **`extractSections(md)`** (level-2 only, ids match the renderer), **`REVIEW_TEMPLATE`** (the 9), and **`parseReviewSections`/`compileReviewSections`** — the lossless round-trip core: split on `^## ` ONLY, everything else (intro prose, `###`, lists, bold, content-on-a-heading-line) carried **opaque verbatim**, so `render(compile(parse(x)))===render(x)`.
- **Visitor reading (`script.js` + `style.css`):** a sticky **"Kicker Rail"** of jump-pills above any sectioned review — `buildReviewNav` + `wireReviewNav` (IntersectionObserver scroll-spy, click→`scrollIntoView` on the **nearest scrollable ancestor** — no single hardcodable modal scroll root; `.md-h { scroll-margin-top }` clears the sticky rail), **gold Overall** (rating-badge nod), JP labels, on BOTH `.modal-review` (main) and `.secondary-review-body` (secondary). Renders nothing for the 44 legacy prose reviews. ⚠️ The rail is **`flex-wrap:wrap`** (a hidden-scrollbar `overflow-x` left later pills unreachable on desktop — don't revert to nowrap).
- **Admin editing — shared `admin/section-editor.{js,css}`** (`window.RarSectionEditor.mount(el,{onChange})→{load,value,focus}` + `previewHtml`): an **Intro block + per-section blocks** (title `<select>` of the 9 w/ JP + Custom, body textarea w/ per-section B/I/🔗 toolbar + **Ctrl/⌘+B/I**, ✕ delete, **drag-and-drop** via the `⋮⋮` grip + ▲/▼), footer "Add section" (present-disabled) / "Add all 9" / "Add custom". Mounted on ALL 3 editors (edit page `#f-review-editor`, season-reviews `#sr-editor-mount`, new-anime `#review-editor`) behind the same `.load()/.value()` the old textarea had. **The edit-page change-diff** captures `reviewEditor.value()` at load (`loadedReviewMd`) so normalization never shows phantom "Review changed".
- **The G3 pivot (important):** the original plan was an "Insert template button in a raw `##` box" — Blake's smoke proved raw `##` is a foot-gun (he typed on a heading line), so it became the **dedicated section fields** above. Storage unchanged.
- **Also restored/fixed:** the **frosted modal backdrops** are BACK (see the updated perf note below), and the **secondary header** action row is one non-wrapping flex bar (`buildHeaderBar`) — fixed the wrap/clip/orphan.
- Tests: `tests/review-template.spec.js` + `tests/review-sections.spec.js` → **npm test = 14**. `bump-version` = **40** (section-editor.{js,css} load versionless).

### What v1.8.2 STILL needs
- **Nothing — shipped + live.** Next ship is **v1.8.3 (Website Identity & Finalization)** — see ROADMAP/NEXT (its gate 0 is a Cowork+Code identity brainstorm). Carry-forwards (both optional, in NEXT backlog): the **new-anime ASK-drawer convergence** onto `admin/chat-drawer.js`, and a **dead `.md-toolbar`/`.md-btn` CSS prune** in `admin/new-anime.css` (unused after the editor swap).
- **Post-prod cleanup done this session:** Blake's section-editor smoke had saved placeholder `##` sections into the **Re:ZERO (row 18)** AND **Eminence in Shadow (row 21)** Review cells in `Master List/Anime_Master_Table.xlsx`. I verified, backed up the xlsx, stripped ONLY the placeholder sections (real prose byte-intact), re-synced → `animeData.js` came out content-identical to the shipped clean version (proof). Excel is clean now.

### ⚠️ v1.8.0 perf lessons (still apply — READ before ANY future perf work)
- **⚠️ UPDATED v1.8.2: the modal backdrop frost is BACK.** `.secondary-backdrop` (`blur(7px)`) + `.tertiary-backdrop` (`blur(6px)`) use a live `backdrop-filter` again — **Blake's explicit call** (round-1's static dim "felt the same", so he chose the frost depth and accepts the Paint cost). The MECHANISM lesson still holds (**a live full-viewport `backdrop-filter` re-resolves on EVERY repaint + can't be cached** = the Firefox Paint cost, Blake's Profiler ~49%→41%, 98% Graphics) — but **do NOT re-remove the frost without Blake**; the tradeoff was decided in his favor. If you reduce Paint elsewhere, leave these two backdrops alone.
- **Headless Playwright CANNOT measure GPU paint/backdrop cost** (bench proved dim ≈ backdrop ≈ filter-static; the drawer repaint dominates). Use the *mechanism* + Blake's **headed Firefox Profiler**, never headless FPS, for compositor work.
- **"Smoothness round 2"** is the measured backlog (ROADMAP/NEXT): render-on-navigate caching, **Firebase SDK defer (~600KB eager, the biggest universal win)**, image right-sizing (`extraLarge`→`large`, `script.js:5027`), perf guard, esbuild-minify-last. Real, not speculative.
- ⚠️ **`convert` on this box is the Windows NTFS tool, NOT ImageMagick** (no magick/sharp/jimp). Resize images via PowerShell `System.Drawing` (HighQualityBicubic) — how the v1.7.6 favicons were made.

**Older still-current architecture (v1.7.4-v1.7.6):** the 3-layer modal (primary mounted → `#secondary-layer` → `#tertiary-layer`); non-catalog Watchlist/Favorite saves via the **`al:<aniListId>` discriminator** (no rules change; homepage `watchlistSet`/`favoritesSet` give pill state free); per-episode expand + WHERE TO WATCH off `externalLinks` type STREAMING; `markdown.js` `__bold__`; the routing split (`primarySlugForAniListId`/`isWatchedAniListId`, IIFE-scoped — account.js can't reach them, so the `#secondary=` hash handler upgrades primary-id saves to the main modal); `scripts/backfill-platforms.js` corrects the `Watch` column from AniList.

**Uncommitted rolling docs (next docs commit):** `docs/CODE-HANDOFF.md` (this file) + `docs/SHIP-OUTPUT.md`.

**Live URL:** https://realanimereviews.com (aliased to https://real-anime-reviews.web.app).

---

## What v1.7.4 shipped (so you know what exists now)

1. **Always-visible 3-column modal** (More Info | Main 630px | Community 394px). The "Click for More Info" tab is GONE — More Info renders on `openModal`. Columns are proportional fr: `grid-template-columns: minmax(0,380fr) minmax(0,630fr) minmax(0,394fr)`, `.modal.duo` max-width **1472px** (= 380+630+394 + 2·18 gap + 32 padding, border-box), exact 380/630/394 at the cap, shrink below, **single-column stack <900px** (one natural scroll — gate-1c made the stacked modal scroll as a unit + dropped per-panel height caps to kill a bleed-through).
2. **LARGE secondary "deep dive" modal** — `#secondary-layer` (built lazily, appended to `<body>`, z-index **6000**), replaces the old `window.open(anilist.co)`. Banner/cover/synopsis/genres/tags/character-grid/staff/trailer/links + a "more like this" carousel. **History-back** (`secondaryHistory` array; rec-click → `pushSecondary`, Back/Esc/backdrop → `secondaryBack` pop, × → `closeSecondaryModal` all). The primary modal stays MOUNTED underneath (Back preserves its scroll/tab state). "📝 Request this anime" pill (non-watched) → `/suggest?title=&anilistId=` (suggest.js now reads those params — it didn't before).
3. **Tertiary character/staff layer** — `#tertiary-layer` (z-index **7000**). Click a character/staff card → bio (markdown-rendered, links clickable) + JP voice-actors + appearances (char) / credits (staff). Cross-nav swaps content; Back/Esc/backdrop/× return to the secondary. `onSecondaryKeydown` bails when the tertiary is open so Esc closes only the top layer.
4. **Per-season reviews** — `season-reviews/<aniListId>.md` (markdown body + `---` frontmatter title/aniListId/date/rating). A gold "BLAKE'S REVIEW" section renders above the synopsis in the secondary. **Static-deployed** (prod has no server — visitors fetch the `.md` + `index.json` directly). `season-reviews/index.json` is currently EMPTY (Blake writes the first real one via the admin panel). Writing is local-only: `/admin/season-reviews` panel (live-preview markdown editor) → `/api/season-review` GET/PUT/DELETE on `mode1-server.js` (needs `npm run mode1`). An inline admin "✎ Edit review" deep-link in the secondary header → the admin panel (auto-fills the AniList title). Cache is **session-memory** (not 24h) so edits show on reload.
5. **Routing split** — `catalogSlugForAniListId` was split into `primarySlugForAniListId(id)` (slug only for an entry's PRIMARY AniListId → main franchise modal) + `isWatchedAniListId(id)` (any watched id → green ✓ pill). **Primary id → main modal; watched-but-not-primary + the "currently viewing" source row → secondary modal w/ review section; non-catalog → secondary synopsis-only.**
6. **Markdown everywhere via a shared renderer** — extracted to a NEW classic script **`markdown.js`** (`window.renderMarkdown`, XSS-safe, ~40 lines). **Single source of truth** — 5 consumers: main modal Review + Description, per-season review, char/staff bios, admin new-anime preview, admin season-review editor preview. Admin new-anime form got a Review **live-preview pane + B/I/🔗 toolbar**. Markdown-link styling is brand-purple across all 5 surfaces.

---

## The rolling-docs trio (Code ↔ Cowork ↔ Blake)

| File | Author | Purpose |
|---|---|---|
| `docs/SHIP-PROMPT.md` | Cowork writes, Code reads | The current gate's instructions. Overwritten per gate. |
| `docs/SHIP-OUTPUT.md` | Code writes, Cowork reads | Code's report. Cowork digests it to Blake. **Rewrite EVERY response** (rule is ON by default). |
| `docs/HANDOFF.md` | Cowork writes | Cowork's persistent state. **Code reads, never writes.** |
| `docs/CODE-HANDOFF.md` | Code writes (this file) | Code-to-Code only. Refresh it at session close (after prod) / between ships. |

Each SHIP-OUTPUT ends with a `## One-liner reply` (one long semicolon-joined sentence) Cowork pastes verbatim to Blake. **Firebase-ignored docs (committed to git, never deployed):** `docs/SHIP-*.md`, `docs/HANDOFF.md`, `docs/CODE-HANDOFF.md`, `docs/COWORK-STYLE.md` — verified 404 on prod every deploy.

---

## The 12-gate ship structure

```
0  Recon + propose plan                  [Code → Blake]  PROPOSE-FIRST (write proposal, do NOT apply)
1  Build core feature                    [Code]          APPLY (after Blake approves direction)
2  Build supporting features             [Code]          APPLY
3  Iteration / fixes                     [Code]          often 3b/3c/3d… loops from Blake's smoke
4  Docs cascade (CHANGELOG+widget+bump+ROADMAP+NEXT)     [Code]  FAST-TRACK
5  Audits (npm test + gitignore/firebase mirror + diff + smart-quote)  [Code]  FAST-TRACK
6  Commit + push                         [Code]          FAST-TRACK
7  Preview channel deploy                [Code]          FAST-TRACK
8  Production deploy                      [Code, on "ship it"]  FAST-TRACK
(9/10/11 numbering drifts — Blake's smoke/verify gates interleave. Follow the STAGED file's number, not the model's.)
```

PROPOSE-FIRST (gate 0, sometimes 3/3c) → write the proposal to SHIP-OUTPUT, do NOT apply, wait for the apply-prompt. APPLY/FAST-TRACK → execute + report. Blake-owned gates (his smoke/verify) → wait. Big ships run many `Xa/Xb/Xc` sub-gates — v1.7.4 went 1 → 1b → 1c → 2 → 2b → 3 → 3b → 3c → 3d → 4 → 5 → 6 → 7 → 8. **Cowork sometimes renumbers** (the gate that did prod was labeled "Gate 8" not "Gate 10"). **Follow the staged `SHIP-PROMPT.md`'s own number — it's the source of truth — not the model's idealized numbering.**

---

## ⚠️ The traps that bite HARDEST (verify the real state, always)

### 1. Phantom "done"/"already accepts" claims AND gate-prompt arithmetic errors
Cowork prompts sometimes assert something is "done"/"populated"/"already works" when it isn't, OR contain math/assumptions that don't hold. **Grep/Read/compute the REAL state before trusting any claim — including the gate's own numbers.** Real examples THIS ship:
- The gate-2b prompt said *"the existing /suggest page already accepts `?title=&anilistId=` params."* I grepped `suggest.js` → **zero URL-param reading.** The v1.6.11 prefill loop is the ADMIN handoff, not the public page. The Request button would've hit a dead form → I added the missing prefill to suggest.js.
- The gate-1 prompt's columns `380+630+394 + gap` summed to **1440px** but it specified `max-width:1380px` → the community sheet would clip ~92px. Corrected the derived max-width to **1472px** (the columns were Blake's lock; the `~1380` estimate was wrong).
- The handoff I inherited said *"WatchedAniListIds empty until backfill"* → I grepped `animeData.js` → **all 44 rows populated.** The routing split is live, not inert.
**Surface phantoms loudly in the report; never silently build/trust the unverified thing. Re-derive the gate's numbers yourself.**

### 2. `sync-excel-to-js.js` = SEPARATE parse + serialize — edit BOTH
- **Parse** in `rowToAnime()` reads an Excel column → sets `anime.Field`.
- **Serialize** is a HAND-ROLLED emitter (`renderJsFile`, ~`:440-464`) that pushes ONLY explicitly-listed fields into `animeData.js` (`if (a.Field != null) lines.push(...)`). NOT `JSON.stringify` — unknown fields silently dropped.
**Any new animeData field = edit BOTH halves.** Use `renderArray()` for arrays. (v1.7.3 the serialize half was forgotten → watched data was missing from animeData; caught at audit.)

---

## Code's mannerisms (the patterns that work here)

### Report shape (`docs/SHIP-OUTPUT.md`, rewritten every response)
1. `<!-- author: Code | date: YYYY-MM-DD -->`
2. `# vX.Y.Z — Gate N (description — STATUS ✓, TIER)`
3. One-paragraph blockquote summary.
4. Per-item body: files + line refs + Δ counts, decisions baked in, verification (green), ⚠️ flags, design alternatives when creative latitude was granted, state-for-next-gate.
5. `## Phantom-drift audit` (what you verified vs assumed).
6. `## One-liner reply` at the bottom (one long semicolon-joined sentence, verbatim-for-Blake).

### Recon before trusting; verify before "done"
`node --check <each touched .js>`; `node scripts/bump-version.js --check` ("all **33** strings agree on vX.Y.Z" — was 26 pre-v1.7.4); `npm test` (**7 passed**) before any production-facing commit; CSS brace-balance via `node -e "...match(/{/g)...match(/}/g)..."`; targeted greps confirming new selectors landed + old ones gone; the **Grep TOOL** (not bash) for smart-quote checks.

### Live AniList recon is a power tool — query, don't guess
When data behavior/shape/query-complexity is unclear, hit AniList directly with a throwaway node script: `node -e "const ff=require('./franchise-fetch.js'); (async()=>{ console.log(await ff.fetchMediaDetail(101922)); })()"`. **Test new queries against the Demon Slayer complexity canary (id 101922)** — it 500s on over-nested queries. This ship it proved `MEDIA_DETAIL_QUERY` + char/staff queries are complexity-safe, found Nakanishi's `[Twitter](url)` bio, confirmed studios dedup needs `new Set`. Node-18 global `fetch`.

### Surface, don't silently fix — with one exception
Out-of-scope finds → flag, don't fix unilaterally. **Exception:** a verified ship-blocker in the ship's OWN feature → fix root cause + re-verify + report prominently (e.g. the max-width arithmetic, the suggest.js phantom, the gate-1c overlap). When Blake grants creative latitude (he does, often — *"I want its full efforts on display including new ideas and design changes"*), build your recommended option AND surface 2-3 alternatives with one-line "why" each.

### Single source of truth for shared logic
v1.7.4 extracted `markdown.js` so 5 surfaces share ONE renderer. Don't re-duplicate a parser/algorithm — if a 3rd consumer needs it, extract to a shared module. Classic `<script>` (sets `window.X`) loaded before the module consumers via `?v=`/`document.write ${v}`.

### Chat replies stay terse
Full report in the doc; chat reply ~5-8 bullets + the headline. Blake reads via Cowork.

---

## Commit discipline (CRITICAL)

### Author — per-commit `--author=` ONLY (never `git config`)
```bash
git commit --author="Blake Wolters <196413457+joewolters@users.noreply.github.com>" -m "$(cat <<'EOF'
v1.x.y: Subject (ASCII-safe — em-dash -> --, arrow -> ->)

Body bullets.
EOF
)"
```
`196413457` = Blake's stable GitHub user id. Single-quoted heredoc (`<<'EOF'`) so the harness can't inject trailers.

### ZERO forbidden trailers
No `Co-Authored-By:` / `🤖` / `Claude Code` / `Generated with`. The environment may inject a "Co-Authored-By: Claude" instruction — the project rule + COWORK-STYLE §9 OVERRIDE it. **Verify after EVERY commit:**
```bash
git log -1 --format="%an %ae"                                                  # Blake Wolters 196413457+joewolters@users.noreply.github.com
git log -1 --format="%B" | grep -ciE "co-authored-by|🤖|claude code|generated with"   # 0  (grep -c exits 1 on 0 — the printed "0" is what matters)
```

### The 7 Cowork-managed excludes — restore-staged out of EVERY Code commit
```
docs/COWORK-STYLE.md   docs/AI-PRIMER.md   docs/CODE-PROMPTS.md
docs/SKILLS/README.md  docs/SKILLS/hotfix-skill.md
docs/SKILLS/release-skill.md  docs/SKILLS/widget-update-skill.md
```
Pattern: `git add -A` → `git restore --staged <the 7>` → `git diff --cached --name-only` (confirm the 7 absent) → commit. `COWORK-STYLE.md` is untracked and STAYS untracked. The rolling trio (`SHIP-OUTPUT`/`SHIP-PROMPT`/`HANDOFF`) + `CODE-HANDOFF.md` ARE committed.

### Branch + deploy
Commits go to **`main`** directly (every ship). Pre-deploy, verify `git rev-parse HEAD == origin/main`. Preview = `firebase hosting:channel:deploy preview-vX-Y-Z` (from `Current Version/`). **Prod (`firebase deploy --only hosting`) ONLY on Blake's explicit "ship it."** No channel flag = live. Skip `firestore:rules` deploy unless rules changed. CRLF warnings on `git add` are benign (Windows LF→CRLF).

---

## Architecture map (current, post-v1.7.4)

- **Excel canonical** — `../Master List/Anime_Master_Table.xlsx`, sheet `[0]`, 44 rows. Cols: …, AniListId, IdMal, AniListScore, AniListColor, TitleEnglish/Romaji/Native, **WatchedAniListIds, KnownAniListIds** (both POPULATED across all 44 rows). Blake does NOT open Excel — Code handles ALL Excel writes programmatically (hard rule).
- **`scripts/sync-excel-to-js.js`** — Excel → `animeData.js` (`npm run sync`). **Parse + serialize halves (trap 2).** v1.7.4 added a season-review-index emit (calls `scripts/lib/season-review-index.js`).
- **`markdown.js`** (NEW v1.7.4, project root, classic script) — shared `window.renderMarkdown` (+ `module.exports` for node tests). XSS-safe (escapes ALL input first, then a whitelist subset: `#`/`##`/`###`→h4/h5/h6, `-`/`*` lists, `**bold**`, `*italic*`, `` `code` ``, `[text](http link)`). **5 consumers — single source.** Does NOT do `__underscore-bold__` (AniList uses it in bios — flagged for v1.7.5).
- **`franchise-fetch.js`** (load-bearing shared module, `window.franchiseFetch` + `module.exports`) — `MORE_INFO_QUERY_NODE` + `traverseFranchise` (BFS spine, 30-node/10-hop caps, 429 retry) **untouched/load-bearing**. v1.7.4 ADDED (additive): `MEDIA_DETAIL_QUERY`/`fetchMediaDetail`, `CHARACTER_DETAIL_QUERY`/`fetchCharacterDetail`, `STAFF_DETAIL_QUERY`/`fetchStaffDetail`. Node-18 global `fetch`. Caches live in script.js, NOT here.
- **`script.js`** — homepage + modal monolith (~5500 lines, ES `type=module`). `openModal()` builds the duo grid; `renderMoreInfoPanel`/`renderFranchiseEntry` (the routing split lives here); the secondary modal (`openSecondaryModal`/`loadSecondary`/`secondaryBack`/`renderSecondaryModal`, `secondaryHistory`); the tertiary layer (`openTertiary`/`renderTertiary`, `makeDetailCache` factory → `rar:character:`/`rar:staff:`); per-anime detail cache (`fetchAnimeDetailCached`, `rar:anime:` 24h); season-review fetch/index (`getSeasonReviewIndex`/`fetchSeasonReview`, session cache). `window.renderMarkdown` used at 3 main-modal call sites + the secondary review. The `window.open(anilist.co)` hook is GONE (→ `openSecondaryModal`).
- **`admin/season-reviews.{html,js,css}`** (NEW v1.7.4) — admin panel; auth-gated via hardcoded `ADMIN_UID` (same client-side gate as suggestions.js/new-anime.js — Firestore rules are the real security; this is the accepted carve-out to the "no UIDs in committed files" rule). `admin-fab.js` sets `window.__rarIsAdmin` so the homepage "✎ Edit review" link is admin-gated WITHOUT duplicating the UID into the main bundle. Loads `animeData.js`/`franchise-fetch.js`/`markdown.js` as classic scripts (bridged to window).
- **`scripts/mode1-server.js`** — local Express (`npm run mode1`, :8888). `/api/submit` + `/api/deploy` + `/api/chat` (Haiku, needs `ANTHROPIC_API_KEY` in `Current Version/.env`, gitignored + firebase-ignored) + **`/api/season-review/:id` GET/PUT/DELETE** (NEW v1.7.4; integer-validated id, rebuilds index.json on write). Local-only — prod has no server.
- **`scripts/bump-version.js` = 33 TARGETS** (was 26; +7 for `admin/season-reviews.html`). New versioned HTML page = add targets there. `markdown.js` loads via runtime `${v}` so it needs NO target.
- **`scripts/lib/season-review-index.js`** (NEW) — shared index builder (scan `season-reviews/*.md` → parse frontmatter → write `index.json`). Called by sync AND mode1 PUT/DELETE.
- **`season-reviews/`** (NEW) — `<id>.md` files (none yet) + `index.json` (empty). Static-deployed (NOT firebase-ignored). The gate-3 demo `112151.md` was removed at gate 4.

---

## Project gotchas

1. **`bump-version.js` = 33 TARGETS.** `--check` must say "all 33 agree." New versioned HTML page → add targets. Runtime `document.write ${v}` scripts need NO target.
2. **`.gitignore` ↔ `firebase.json` mirror.** New sensitive/ignored file in deploy root → BOTH. `.env` covered by `.env*` (git) + `**/.*` (firebase). `scripts/*.js`, `markdown.js`, `season-reviews/`, `admin/*` all DEPLOY (no secrets). Verify 404 on docs/.env post-deploy.
3. **Smart-quote check: Grep TOOL, not bash.** `bash grep -lE "[“”]"` FALSE-flags multibyte files (byte-vs-char). The Grep tool is correct. Curly quotes in HTML *attributes*/JS *delimiters* break things; in text/comments/normalization-regexes they're fine. `node --check` catches a curly-as-delimiter.
4. **Excel cleanup ≠ find/replace.** Watch column has space-merged platforms + suffix variants. Use `splitMergedPlatforms` + `startsWith`.
5. **CRLF warnings on `git add` are benign** (Windows LF→CRLF). Ignore.
6. **`[hidden]` loses to author `display:`** — add `.thing[hidden]{display:none}` when a hidden-toggled element sets non-none display (e.g. `.secondary-layer[hidden]{display:none}` beats `display:flex`). `prefers-reduced-motion` fallback on EVERY animation. No native `confirm`/`alert`/`prompt` — branded modals only.
7. **AniList `streamingEpisodes` unreliable per-entry** (Re:Zero returns same list every season). Render layer dedupes + renumbers.
8. **Query-complexity budget** — nested relations-within-relations 500 on Demon Slayer (id 101922, the canary). Multi-fetch is N+1 per-node to dodge it. Test new queries against 101922 before trusting.
9. **Update-log widget: no 10-cap** (removed v1.7.3 — infinite scroll). Don't re-introduce. Single chip per fresh ship date; range chip (`vA→vB`) for 3+ ships/date. Date format `MM/DD/YYYY` always.

---

## Blake's working style

- Self-described "very basic" coder. **Never assume he knows terms/structure/commands unless explained this session.** Surgical guidance: which file, which line, what to type. He runs the terminal commands you build (backfills, `npm run mode1`, occasionally smoke); he does NOT open Excel.
- **Loves premium / clean / unique UI and explicitly invites Code's creative latitude** — *"if code has design choices it thinks looks good it can impliment them. I love what its done."* When granted latitude, surface 2-3 alternatives + recommend one, then BUILD the recommended one. He gives free rein on admin-form polish.
- Direct feedback via screenshots of the running site — use them as ground truth. Quote his exact words in the report when surfacing a bug for the next iteration.
- Energy fluctuates; late-session reviews go fast. "What's next?" can be a fatigue signal. Build in extra verification when the session's been long.

---

## What's next — v1.8.3 (Website Identity & Finalization) — IN PROGRESS (gate 1, propose-first)

**v1.8.2 is SHIPPED + LIVE (`e6fa47f`).** v1.8.3 is the identity ship, split from a bigger plan: **v1.8.3 = Identity & polish (local/CSS, no AniList)**, **v1.8.4 = Discovery & blend (its own gate-0)**. Blake's locked gate-0/gate-1 picks (so far): two ships; signed-out For-You = Trending; welcome once-per-browser re-openable; Discover search pins his 44 first; the Currently-Airing hero debuts in **v1.8.4**; **characters POSTPONED to v1.8.4** (v1.8.3 keeps scroll-reveal of lines/elements only); brainstorm #1/#2/#4 IN (continue-rail · static den tint · "watched N seasons" provenance). Nav direction (A/B/C) + welcome mock (1/2) + gate split awaiting his gate-1 pick — proposal in `docs/SHIP-OUTPUT.md`. **Architecture pick (gate 0):** three adjacent surfaces (Blake's Reviews / For You / Discover), ONE card shell + a `reviewed` flag, NOT-REVIEWED cards reuse the EXISTING v1.7.4 secondary modal (it already renders any AniList id as "NOT REVIEWED YET" + Request pill — the big scope-saver). Proposed v1.8.3 gate split: G2 home+header / G3 welcome+reveal / G4 cards+filter / G5 brainstorm-trio → sweep.

### ⚠️ v1.8.4 seeds (banked — Blake, gate 1) — carry into the v1.8.4 gate-0
- **Discover variants:** currently airing · currently airing **BY GENRE** · **top picks by community**.
- The Discover / For-You surfaces should **feel fresh per log-on** (re-shuffle candidates each session).
- Recommended v1.8.4 data flow (from gate-0): 3 NEW flat AniList queries (search / trending / `status:RELEASING`) on the existing 24h `localStorage` L2 cache, **tested against the 101922 canary first**; For-You candidates = top genres/tags of the user's saved catalog entries; signed-out = Trending; Discover search reuses the `/suggest` debounce+AbortController pattern, pinning his 44 matches first.

- **One carry-forward (optional):** the **new-anime ASK-drawer convergence** — migrate new-anime's inline chat drawer onto the shared `admin/chat-drawer.js` (`window.RarChatDrawer`). Low-risk cleanup; not blocking. (Also: dead `.md-toolbar`/`.md-btn` CSS prune in `new-anime.css`.)

**v1.8.x ladder after this:** v1.8.3 Identity · v1.8.4 Discovery & Blend · **Smoothness round 2** (below) · v1.9.0 Community/Account · v1.9.5 UI · v2.0 mobile.

**Smoothness round 2 (v1.8.x candidate — MEASURED, not speculative; logged in ROADMAP/NEXT).** Blake closed v1.8.0 at "felt marginal" after the blur removal. The bigger UNIVERSAL levers, with evidence:
1. **Render-on-navigate caching** — the secondary/More-Info modals rebuild `innerHTML` on every Back/open (`script.js:4790/4810/4376`), re-parsing DOM + re-decoding every image. Cache the built node tree / lazy-decode.
2. **Firebase SDK defer** — ~600KB of `firebase-firestore`+`firebase-auth` loads **eagerly on every page before sign-in** (measured). The **biggest universal first-load win**.
3. **Image right-sizing** — secondary cover/banner decode `coverImage.extraLarge` (~1000px) into ~150px slots (`script.js:5027-5028`) → use `large`.
4. **Perf-regression guard** — Playwright bundle-size ceiling + frame-budget assertion.
5. **esbuild minify LAST** — `script.js` 242KB→~100KB; wire into BOTH `firebase deploy` (predeploy hook) AND `mode1-server.js`'s one-click deploy; readable source stays in git + sourcemaps; ship standalone after the rest so it can't destabilize Mode 1.
**⚠️ Perf-work lessons from v1.8.0 (don't relearn the hard way):** headless Playwright can't measure GPU paint/backdrop cost (proven) — use Blake's headed Firefox Profiler; a live full-viewport `backdrop-filter` can't be cached (re-resolves per repaint) so don't reintroduce one; the modal hovers already composite (no `filter`).

**Already-logged backlog (in NEXT.md / ROADMAP locked ladder, leave them):**
- **Per-episode "full course"** — v1.7.5 shipped a THIN per-episode expand (AniList exposes only `title/thumbnail/url/site` — no summary/score/airdate, confirmed live on 101922). The richer revisit = Blake-authored per-episode notes (season-review storage pattern) and/or TVDB, **plus** extending the expand to the More Info panel's episode rows (deferred because those are renumbered LABEL rows fed by the load-bearing 30-node franchise BFS `MORE_INFO_QUERY_NODE` — needs a complexity-canary test + a renumber→single-episode mapping rethink).
- **Structured review template** — fixed scannable sections (Intro/Animation/Story/…); lean toward `## Heading` markdown through the shared `markdown.js` + an admin "Insert template" button + sticky jump-pills + collapsible `<details>`.

**Standing notes for whoever picks up v1.8.1:** the secondary modal + WHERE TO WATCH + per-episode expand are premium surfaces now — match the established pill vocabulary (`.secondary-platform` / `.secondary-ep-link`, brand-purple, **equal weight, no platform privileged** — gate-3c rule). The community tab is NOT on the secondary modal (that's the **v1.9.0** Community + Account overhaul) — don't scope-creep. Live-test any new AniList queries against the 101922 canary first. The platforms backfill is repeatable: `node scripts/backfill-platforms.js --dry-run` to preview, `... ` (no flag) to write+sync — manual overrides + the US allowlist live at the top of the CLI.

---

## What a fresh Code session does first
1. **Read `CLAUDE.md`** (auto-loads).
2. **Read `docs/CODE-HANDOFF.md`** (this file).
3. **Read `docs/SHIP-PROMPT.md`** — the current gate (if Cowork staged one). Follow ITS gate number.
4. **Read `docs/SHIP-OUTPUT.md`** — what just happened (currently: v1.8.2 production deploy DONE — LIVE at `e6fa47f`, APP_VERSION 1.8.2; Re:ZERO/Eminence Excel smoke-data cleaned).
5. **Recon the REAL file state** before trusting any "already built/done" claim — including the gate's own numbers. PROPOSE-FIRST → propose; APPLY → execute + report. Surface phantoms loudly. Rewrite SHIP-OUTPUT every response.

## One-liner state summary (paste-ready)
**v1.8.2 (Structured review template) is LIVE in prod** (`e6fa47f`, deployed 2026-06-04, APP_VERSION 1.8.2; on v1.8.1 `d60c437` / v1.8.0 `38a4baf`) — reviews can be written in labelled `##` sections (Intro/Animation/Story/Characters/Design/Music/Feel/Extra Thoughts/Overall); **storage is ONE markdown string, unchanged**: `markdown.js` gained anchorable heading ids (`rsec-…`/`.md-h`) + `extractSections` + `REVIEW_TEMPLATE` + lossless `parseReviewSections`/`compileReviewSections` (split on `^## ` only, everything else opaque verbatim, `render(compile(parse(x)))===render(x)`); visitor side is a sticky **Kicker Rail** of jump-pills (scroll-spy, gold Overall, JP labels) on `.modal-review` + `.secondary-review-body` (`buildReviewNav`/`wireReviewNav`, scrolls the **nearest scrollable ancestor**, rail is **`flex-wrap:wrap`** — don't revert to nowrap); admin side is the shared **`admin/section-editor.{js,css}`** (`window.RarSectionEditor` — Intro block + per-section blocks with a 9-section title picker + Custom, per-section B/I/🔗 + Ctrl/⌘ shortcuts, delete, **drag-and-drop** + ▲/▼, "Add all 9"/present-disabled picker) on ALL 3 editors behind the `.load()/.value()` contract; the G3 "Insert template button" **pivoted** to these dedicated fields after Blake's raw-`##` foot-gun; also **restored the frosted backdrops** (`.secondary-/.tertiary-backdrop` blur — Blake's call, accepts the Paint cost — DON'T re-remove) and rebuilt the **secondary header** into one non-wrapping bar; `tests/review-template.spec.js` + `tests/review-sections.spec.js` → **npm test 14**; `bump-version` **40** (section-editor.{js,css} versionless); **live-verified** (/ 200 + APP_VERSION 1.8.2, section-editor.{js,css} 200, leak checks 404, Re:ZERO junk-free). **Post-prod:** Blake's editor smoke had saved placeholder `##` sections into the **Re:ZERO + Eminence** Excel Review cells — verified, backed up, stripped (real prose byte-intact), re-synced to match the shipped clean `animeData.js`; **Excel is clean** (next syncer: no junk). The project lives in `Current Version/` (CWD is the parent — prefix paths); workflow is the 12-gate model with the SHIP-PROMPT/SHIP-OUTPUT/HANDOFF rolling trio (SHIP-OUTPUT rewritten every response, follow the STAGED gate number which Cowork sometimes renumbers), commits authored Blake via per-commit `--author=` with ZERO trailers and the 7 Cowork docs restore-staged out, prod only on explicit "ship it"; durable architecture: the shared **`markdown.js`** (now also the section parse/compile + extractSections — single-source, don't re-duplicate), the 3-layer modal system (primary mounted → secondary `#secondary-layer` z6000 → tertiary `#tertiary-layer` z7000), per-season reviews (`season-reviews/<id>.md` static-deployed + `/api/season-review` LOCAL CRUD + `/admin/season-reviews` editor needing `npm run mode1`), the routing split (`primarySlugForAniListId`+`isWatchedAniListId`), the v1.8.1 edit page + tiered Save/Ship, and the shared admin modules (`franchise-fetch.js` + `platform-map.js` + `chat-drawer.js` + `modal-scroll-lock.js` + `section-editor.js`); recurring traps are phantom-drift + gate-prompt arithmetic/assumption errors (re-derive the gate's numbers yourself) and the **`sync-excel-to-js.js` parse-vs-serialize split** (any new animeData field = edit BOTH halves); **⚠️ ALWAYS `git diff`-review before a sweep commit** — this ship Blake's editor smoke had written test junk into 2 Excel Review cells → `animeData.js`, caught at the diff and excluded; use live AniList node queries against the **101922 canary** + the **Grep TOOL** (not bash) for smart-quotes; **NEXT = v1.8.3 Website Identity & Finalization** (scroll-reveal, first-visit welcome, characters on the page, card touch-ups — gate 0 is a Cowork+Code identity brainstorm), then Smoothness round 2 (Firebase-defer ~600KB / render-on-navigate / image right-size / minify-last / perf guard), v1.9.0 community, v1.9.5 UI, v2.0 mobile. Optional carry-forwards (NEXT backlog): new-anime ASK-drawer convergence onto `chat-drawer.js`; dead `.md-toolbar`/`.md-btn` CSS prune in `new-anime.css`. ⚠️ Perf: the modal backdrop frost is BACK by Blake's choice (don't re-remove); headless can't measure GPU backdrop cost — use the headed Firefox Profiler.
