<!-- author: Code | date: 2026-06-04 -->
<!-- AUDIENCE: This file is FOR CODE (another Claude Code instance picking up work). -->
<!-- NOT for Cowork — Cowork reads docs/HANDOFF.md + docs/SHIP-OUTPUT.md and writes docs/SHIP-PROMPT.md. -->

# Code → Code Handoff

> Quick-onboarding doc so a fresh Code session picks up immediately without re-deriving the workflow. **Read order:** this file FIRST → `docs/SHIP-PROMPT.md` (the current gate, if Cowork staged one) → `docs/SHIP-OUTPUT.md` (what the previous Code last did). `CLAUDE.md` auto-loads (permanent rules). Then recon the REAL file state and continue.

---

## ⚠️ READ THIS FIRST — the project is in a SUBFOLDER
**The harness CWD is the repo PARENT (`C:\Users\Owner\PROJECTS\Real Anime Reviews\`). The actual project — `.git`, `CLAUDE.md`, all app files, `docs/` — lives in `Current Version/`.** Every relative path in the gate prompts (`docs/SHIP-PROMPT.md`, `script.js`, etc.) resolves **inside `Current Version/`**. Prefix everything with `Current Version/` (or use absolute paths). Don't burn your first turn `Read`-ing `docs/CODE-HANDOFF.md` from CWD and getting "file does not exist." `Master List/` (the canonical Excel) is a SIBLING of `Current Version/`, OUTSIDE the deploy root — backups/reports written there never deploy. Run all `firebase`/`npm`/`git` from inside `Current Version/` (use `cd "C:/Users/Owner/PROJECTS/Real Anime Reviews/Current Version" && ...`).

---

## Right now (snapshot — 2026-06-04, end of the v1.7.4 session)

**v1.7.4 — Modal Architecture Overhaul — is LIVE in production** (commit `7364500`, deployed 2026-06-04 ~14:2x UTC, `APP_VERSION="1.7.4"` on realanimereviews.com). The whole ship ran this session across the full 12-gate model (1/1b/1c → 2/2b → 3/3b/3c/3d → 4 docs → 5 audits → 6 commit → 7 preview → 8 prod). Live-verified: version flipped 1.7.3→1.7.4, `markdown.js` 200, `season-reviews/index.json` empty `{count:0,ids:[]}`, `WatchedAniListIds` count 44 (no regression), `.env` + the 3 rolling docs all 404.

**Status: v1.7.4 is shipped; only Blake's browser prod-verify remains to formally close it** (Cowork may stage a gate-11 "close" or jump straight to **v1.7.5 Gate 0**). **If you're the next Code:** read `docs/SHIP-PROMPT.md` — if it's a v1.7.4 hotfix (Blake found something in his verify), do that; if it's v1.7.5 Gate 0, that's the next feature.

**Uncommitted at session end (will commit at the v1.7.4 close):** `docs/CODE-HANDOFF.md` (this file, refreshed) + `docs/SHIP-OUTPUT.md` (rewritten every response). The CODE deliverables are committed; these two rolling docs ride along in the next docs commit. (Nothing code-wise is uncommitted — the live code == commit `7364500`.)

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

## What's next — v1.7.5 (the queued ship)

**Watchlist + favorites extensions + per-episode + char/staff polish.** Scope (from ROADMAP/NEXT):
- **Render the reserved watchlist/favorites buttons** in the secondary modal header — v1.7.4 ALREADY reserved the slot (the `.secondary-header-actions` row is `flex-wrap`, slot order edit→request→[future]→close). No layout reshuffle needed.
- **Extend the watchlist/favorites schema for non-catalog AniListId entries.** Today it's **catalog-slug-keyed** (`users/{uid}/watchlist/{animeSlug}`); a secondary-modal season/movie isn't in the catalog, so it needs a discriminator (`{type:'anilist', aniListId}`) or a parallel sub-collection. The account-page tabs (`account.html`) must then render both shapes.
- **Per-episode click-for-more-info** (deferred from v1.7.4).
- **Char/staff polish** — e.g. AniList `__underscore-bold__` in bios isn't rendered (the shared `markdown.js` only does `**bold**`; adding `__` affects all 5 consumers — low risk, your call).

**My creative wants for whoever picks this up:** the secondary modal is a premium surface now — the watchlist/favorites buttons should match the Request pill's vocabulary (blurred brand-purple pill, the reserved slot). Consider whether "Add to watchlist" on a non-catalog season is genuinely useful vs. confusing (a visitor saving a season they can't get a review for) — maybe gate it or pair it with the per-season-review surface. The community tab is NOT on the secondary modal (that's the big v1.8.5 Community + Account overhaul) — don't scope-creep into it. Live-test any new AniList queries against the 101922 canary first.

---

## What a fresh Code session does first
1. **Read `CLAUDE.md`** (auto-loads).
2. **Read `docs/CODE-HANDOFF.md`** (this file).
3. **Read `docs/SHIP-PROMPT.md`** — the current gate (if Cowork staged one). Follow ITS gate number.
4. **Read `docs/SHIP-OUTPUT.md`** — what just happened (currently: v1.7.4 Gate 8 prod deploy DONE — LIVE, awaiting Blake's browser verify).
5. **Recon the REAL file state** before trusting any "already built/done" claim — including the gate's own numbers. PROPOSE-FIRST → propose; APPLY → execute + report. Surface phantoms loudly. Rewrite SHIP-OUTPUT every response.

## One-liner state summary (paste-ready)
**v1.7.4 (Modal Architecture Overhaul) is LIVE in prod** (`7364500`, deployed 2026-06-04 ~14:2x UTC, APP_VERSION 1.7.4) — the entire ship ran this session across the 12-gate model (1/1b/1c always-visible 3-col layout → 2/2b LARGE secondary "deep dive" modal w/ history-back + Request button → 3/3b/3c/3d per-season markdown reviews + routing split + clickable character/staff tertiary layer + shared `markdown.js` + brand-purple links → 4 docs → 5 audits → 6 commit → 7 preview → 8 prod), **awaiting only Blake's browser prod-verify to formally close** (then v1.7.5 is next); the project lives in `Current Version/` (CWD is the parent — prefix paths), workflow is the 12-gate model with the SHIP-PROMPT/SHIP-OUTPUT/HANDOFF rolling trio (SHIP-OUTPUT rewritten every response, follow the STAGED gate number which Cowork sometimes renumbers), commits authored Blake via per-commit `--author=` with ZERO trailers and the 7 Cowork docs restore-staged out, prod only on explicit "ship it"; headline new architecture is the shared `markdown.js` (5 consumers, single-source — don't re-duplicate), the 3-layer modal system (primary mounted → secondary `#secondary-layer` z6000 → tertiary `#tertiary-layer` z7000), per-season reviews (`season-reviews/<id>.md` static-deployed + empty `index.json` + `/api/season-review` LOCAL CRUD + `/admin/season-reviews` editor needing `npm run mode1`), the routing split (`primarySlugForAniListId`+`isWatchedAniListId`; WatchedAniListIds is NOW POPULATED — the old "empty" note is dead), and `bump-version` at 33 targets; the traps that recurred are phantom-drift + gate-prompt arithmetic/assumption errors (the `/suggest` "already accepts params" was FALSE, the gate-1 `~1380` max-width didn't fit the locked 380/630/394 columns — re-derive the gate's numbers yourself) and the sync-excel parse-vs-serialize split; use live AniList node queries against the 101922 canary for ground-truth recon and the Grep TOOL (not bash) for smart-quotes; **v1.7.5 is next** = render the reserved watchlist/favorites buttons + non-catalog-AniListId schema + per-episode info + char/staff polish.
