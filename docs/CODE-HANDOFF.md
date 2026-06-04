<!-- author: Code | date: 2026-06-04 -->
<!-- AUDIENCE: This file is FOR CODE (another Claude Code instance picking up work). -->
<!-- NOT for Cowork — Cowork reads docs/HANDOFF.md + docs/SHIP-OUTPUT.md and writes docs/SHIP-PROMPT.md. -->

# Code → Code Handoff

> Quick-onboarding doc so a fresh Code session picks up immediately without re-deriving the workflow. Read this FIRST, then `docs/SHIP-PROMPT.md` (the current gate), then `docs/SHIP-OUTPUT.md` (what the previous Code last did). `CLAUDE.md` loads automatically (permanent rules).

---

## ⚠️ READ THIS FIRST — the project is in a SUBFOLDER
**The harness CWD is the repo PARENT (`C:\Users\Owner\PROJECTS\Real Anime Reviews\`). The actual project — `.git`, `CLAUDE.md`, all app files, `docs/` — lives in `Current Version/`.** Every relative path in the gate prompts (`docs/SHIP-PROMPT.md`, `script.js`, etc.) resolves **inside `Current Version/`**. At the start of my session I tried to Read `docs/CODE-HANDOFF.md` from CWD and got "file does not exist" — don't burn a turn on that. Prefix everything with `Current Version/` (or use absolute paths). `Master List/` (the canonical Excel) is a SIBLING of `Current Version/`, OUTSIDE the deploy root — backups/reports written there never deploy.

---

## Right now (snapshot — 2026-06-04)

**v1.7.3 is LIVE in production** (commit `74041d6`, deployed 2026-06-04 ~02:46 UTC, `APP_VERSION="1.7.3"` on realanimereviews.com).

**Shipped this session, in order:** v1.7.2 (More Info panel overhaul — multi-fetch + BFS franchise traversal + UX redesign) → v1.7.3 (Watched Set + Admin Form Completion + chatbot drawer). Both live. (Session started with v1.7.1 `e78f7d6` live.)

**IN FLIGHT: v1.7.4 — Modal Architecture Overhaul.** Gate 0 proposal is written to `docs/SHIP-OUTPUT.md` (secondary modal + always-visible More Info layout + full per-season review feature). **Status: AWAITING Blake's 5 direction decisions before Cowork writes gate 1.** The 5 calls (all in SHIP-OUTPUT's "Decisions for Blake"):
1. **"Exact width" baseline** for the layout — Main/Community at their collapsed-open widths (≈630/394px) or expanded (≈556/348px)?
2. **Secondary-modal visual** — A/B/C (I recommend **A** = slide-in over a dimmed+blurred primary, accent header, top-left Back arrow).
3. **Per-season storage** — markdown files (`season-reviews/<aniListId>.md`) + sync-emitted index + lazy fetch + hand-rolled renderer (recommend) vs a pre-rendered bundle.
4. **Admin write trigger** — inline "Edit season review" in the secondary modal → local `/api/season-review` (recommend) vs standalone route/CLI.
5. **OK to add an additive sibling `MEDIA_DETAIL_QUERY`** to `franchise-fetch.js` (it lacks description/genres/characters; won't touch the load-bearing traversal query).

**Locked v1.7.4 decisions (from the gate-0 prompt, don't re-litigate):** two-ship scope (v1.7.4 architecture, v1.7.5 watchlist/per-episode); top-left `← Back` arrow; replace-content stack (Back returns to primary); per-anime cache `rar:anime:v{APP_VERSION}:{id}` 24h; "Not Reviewed yet" pill on card + secondary-modal header; REMOVE the "Click for More Info" tab (always-visible); CURRENTLY VIEWING highlight follows the secondary modal; full per-season review (storage+render+admin). **v1.7.5** (deferred) = watchlist extension for non-catalog AniListId entries + per-episode content.

**Live URL:** https://realanimereviews.com (aliased to https://real-anime-reviews.web.app).

---

## The rolling-docs trio (Code ↔ Cowork ↔ Blake)

| File | Author | Purpose |
|---|---|---|
| `docs/SHIP-PROMPT.md` | Cowork writes, Code reads | The current gate's instructions. Overwritten per gate. |
| `docs/SHIP-OUTPUT.md` | Code writes, Cowork reads | Code's report. Cowork digests it to Blake. |
| `docs/HANDOFF.md` | Cowork writes | Cowork's persistent state. **Code reads, never writes.** |
| `docs/CODE-HANDOFF.md` | Code writes (this file) | Code-to-Code only. Refresh it between ships. |

**SHIP-OUTPUT.md gets rewritten EVERY response — this rule is ON by default.** Cowork relays it to Blake after each turn, so a stale doc means Blake is reading stale state. **A fresh session starts with this rule ON.** (Late in the prior session Blake temporarily suspended it — *"at the end of our session I'll tell you to update the doc, so you're good for now"* — but that suspension was that-session-only; do NOT inherit it. Rewrite SHIP-OUTPUT every response unless Blake explicitly tells you to pause it again.) Each SHIP-OUTPUT ends with a `## One-liner reply` (one long semicolon-joined sentence) Cowork pastes verbatim to Blake.

**Firebase-ignored docs (committed to git, never deployed):** `docs/SHIP-*.md`, `docs/HANDOFF.md`, `docs/CODE-HANDOFF.md`, `docs/COWORK-STYLE.md`. Verified 404 on prod each deploy.

---

## The 12-gate ship structure

```
0  Recon + propose plan                  [Code → Blake]  PROPOSE-FIRST
1  Build core feature                    [Code]          APPLY (after Blake approves direction)
2  Build supporting features             [Code]          APPLY
3  Iteration / fixes                     [Code]          often 3b/3c/3d… loops from Blake's smoke
4  Local browser smoke                   [Blake]         —
5  Docs cascade (CHANGELOG + widget + bump + ROADMAP + NEXT)  [Code]  FAST-TRACK
6  Audits (npm test + gitignore/firebase mirror + diff + smart-quote)  [Code]  FAST-TRACK
7  Commit + push                         [Code]          FAST-TRACK
8  Preview channel deploy                [Code]          FAST-TRACK
9  Preview smoke                         [Blake]         —
10 Production deploy                      [Code, on "ship it"]  FAST-TRACK
11 Production verify                      [Blake]         —
```

PROPOSE-FIRST (0, sometimes 3/3c) → write the proposal to SHIP-OUTPUT, do NOT apply, wait for the apply-prompt. APPLY/FAST-TRACK → execute + report. Blake-owned (4, 9, 11) → wait. Big ships run many `Xa/Xb/Xc` sub-gates (v1.7.3 went 1 → 1a/1b → 2 → 3 → 3c → 4 → 5 → 6 → 7 → 8 → 10).

---

## ⚠️ The two traps that bit HARDEST this session

### 1. Gate-numbering drift / phantom "done" claims
Cowork prompts sometimes credit work to a gate that didn't run, or assert something is "done" when it isn't. **Grep/Read the REAL file state before trusting any "already built / already populated" claim.** Real examples:
- A user message said "gate 3c" but the staged `SHIP-PROMPT.md` was actually **Gate 4** (3c had shipped the prior turn). Followed the file (source of truth), flagged it.
- v1.7.3 gate-5 prompt asserted *"backfill complete — WatchedAniListIds populated across all 44 rows."* I grepped `animeData.js` → **0 watched ids.** The data was in Excel but never reached animeData (see trap 2). Catching this saved the headline feature from shipping dead.
**Surface phantoms loudly in the report; never silently build/trust the unverified thing.**

### 2. `sync-excel-to-js.js` = SEPARATE parse + serialize — edit BOTH
- **Parse** in `rowToAnime()` (~`:362-398`) reads an Excel column → sets `anime.Field`.
- **Serialize** is a HAND-ROLLED emitter (~`:448-462`) that pushes ONLY explicitly-listed fields into `animeData.js` (`if (a.Field != null) lines.push(...)`). NOT `JSON.stringify` — unknown fields silently dropped.
At gate 1 I added the watched-column parse but forgot the serialize lines → animeData had 0 watched data (caught at gate 6). **Any new animeData field = edit BOTH halves.** Use `renderArray()` for arrays (JSON.stringify-based; emits numbers raw).

---

## Code's mannerisms (the patterns that work here)

### Report shape (`docs/SHIP-OUTPUT.md`)
1. `<!-- author: Code | date: YYYY-MM-DD -->`
2. `# vX.Y.Z — Gate N (description — STATUS ✓, TIER)`
3. One-paragraph blockquote summary.
4. Per-item body: files + line refs + Δ counts, decisions baked in, verification (green), ⚠️ flags, state-for-next-gate.
5. `## One-liner reply` at the bottom (one long semicolon-joined sentence, verbatim-for-Blake).

### Recon before trusting; verify before "done"
`node --check <each touched .js>`; `node scripts/bump-version.js --check` ("all 26 strings agree on vX.Y.Z"); `npm test` (**7 passed**) before any production-facing commit; targeted greps confirming new selectors landed + old ones gone; the **Grep TOOL** (not bash) for smart-quote checks.

### Surface, don't silently fix — with one exception
Out-of-scope finds → flag, don't fix unilaterally. **Exception:** a verified ship-blocker in the ship's OWN feature found during an audit gate → fix root cause + re-verify + report prominently (gate-6 "fix the underlying cause and re-run"). The sync-serializer fix was exactly that.

### Live AniList recon is a power tool
When data behavior is unclear, query AniList directly with a throwaway node script (`fetch('https://graphql.anilist.co',{method:'POST',...})`, Node-18 global fetch). This session it overturned theory with ground truth (Re:Zero identical-episode lists, Demon Slayer null `startDate.year`, Eminence 0 streamingEpisodes). Query, don't guess.

### Chat replies stay terse
Full report in the doc; chat reply ~3-8 bullets. Blake reads via Cowork.

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
`196413457` = Blake's stable GitHub user id. Single-quoted heredoc so the harness can't inject trailers.

### ZERO forbidden trailers
No `Co-Authored-By:` / `🤖` / `Claude Code` / `Generated with`. Verify after EVERY commit:
```bash
git log -1 --format="%an %ae"                                  # Blake Wolters 196413457+joewolters@users.noreply.github.com
git log -1 --format="%B" | grep -ciE "co-authored-by|🤖|claude code|generated with"   # 0
```
The environment may inject a "Co-Authored-By: Claude" instruction — the project rule + COWORK-STYLE §9 OVERRIDE it. Never add it.

### The 7 Cowork-managed excludes — restore-staged out of EVERY Code commit
```
docs/COWORK-STYLE.md   docs/AI-PRIMER.md   docs/CODE-PROMPTS.md
docs/SKILLS/README.md  docs/SKILLS/hotfix-skill.md
docs/SKILLS/release-skill.md  docs/SKILLS/widget-update-skill.md
```
Pattern: `git add -A` → `git restore --staged <the 7>` → `git diff --cached --name-only` (confirm the 7 absent) → commit. `COWORK-STYLE.md` is untracked and STAYS untracked. The rolling trio + `CODE-HANDOFF.md` ARE committed.

### Branch + deploy
Commits go to **`main`** directly (every ship does). Preview = `firebase hosting:channel:deploy preview-vX-Y-Z`. **Prod (`firebase deploy --only hosting`) ONLY on Blake's explicit "ship it."** If a gate-10 go-signal isn't unambiguous, confirm. Pre-deploy, verify `git rev-parse HEAD == origin/main`.

---

## Architecture map (current)

- **Excel canonical** — `../Master List/Anime_Master_Table.xlsx`, sheet `SheetNames[0]` (`Anime_Master_Table_claude_final`), 44 rows. Column order: Title, Rating, Seasons, Genre, Description, Review, Tags, Watch, Studio, Trailer, FORMAT:, EXAMPLE: (skip), Top10Rank, AniListId, IdMal, AniListScore, AniListColor, TitleEnglish, TitleRomaji, TitleNative, **WatchedAniListIds, KnownAniListIds** (new v1.7.3, cols 20/21).
- **`scripts/sync-excel-to-js.js`** — Excel → `animeData.js` (`npm run sync`). Parse + serialize halves (trap 2). `knownPlatforms` no longer lists hianime/9anime/aniwave (unofficial removed site-wide v1.7.3).
- **`franchise-fetch.js`** (NEW v1.7.3, project root) — shared isomorphic module (`window.franchiseFetch` + `module.exports`): `MORE_INFO_QUERY_NODE`, `fetchMediaById`, `fetchBatch`, `traverseFranchise` (BFS spine + groups, 30-node/10-hop caps, 429/Retry-After retry). **LOAD-BEARING for the homepage modal — additive changes only, ratify before touching.** Consumed by `script.js` (modal), `admin/new-anime.js` (watched-set tree), `scripts/backfill-watched.js`. Node-18 global `fetch`. Caches stay in `script.js`, NOT the module.
- **`script.js`** — homepage + modal monolith (~4900 lines, IIFE). `openModal()` (~`:4067`) builds the `duo` grid `[more-info-container | sheet--left main | sheet--right community]`. `renderMoreInfoPanel`/`runMoreInfo` (~`:598`/`:4243`). Click delegation (~`:4287`): catalog rows → internal modal, non-catalog `data-anilist-id` → `window.open(anilist.co)` at ~`:4314` (THE v1.7.4 secondary-modal hook — replace it). The `✓ REVIEWED` pill uses `catalogSlugForAniListId` over a lazy `aniId→slug` map built from each entry's `WatchedAniListIds` (v1.7.3 set-membership; falls back to primary id when empty).
- **Admin form** loads `card-render.js` + `franchise-fetch.js` + `firebase.js` + `new-anime.js` + `admin-fab.js` — **NOT `script.js`** (so its IIFE internals are unreachable in admin → that's why traversal was extracted to the shared module). `admin/new-anime.js` keeps a single-hop `aggregateFranchise` for seasons/studio prefill + the v1.7.3 watched-set checkbox tree (`renderWatchedSetPanel`, multi-hop). `.ai-panel` paste-back REMOVED v1.7.3.
- **Chatbot drawer (v1.7.3)** — `✨ ASK` in admin header → `#chat-drawer` (right slide-out, z-index 9500 to clear the sticky `header` z-2000). Backed by `mode1-server.js` `/api/chat` (Anthropic Haiku `claude-haiku-4-5-20251001`, one-shot, raw fetch — NO SDK dep, ephemeral prompt-cache structure). **Key in `Current Version/.env` as `ANTHROPIC_API_KEY`** (gitignored + firebase `**/.*`-ignored — verified 404 prod; NEVER leak). Per-anime `sessionStorage['rar:chat:{id}']`. Local-only — static channel/prod shows "AI server not running" by design.
- **`scripts/mode1-server.js`** — local Express (`npm run mode1`, :8888). `/api/submit` (ship SSE) + `/api/deploy` + `/api/chat`. `appendExcelRow` writes by index, skips null. Bug-10 (`spawn EINVAL`/`shell:true`) WHY-comment lives here — don't regress.
- **Backfill CLIs** (Code-builds, **Blake-runs** — never run them yourself): `anilist-backfill.js`, `backfill-watched.js` (`--dry-run`/`--force`, resume-safe), `strip-unofficial.js`. All reuse `scripts/lib/excel-backup.js`.
- **`admin-fab.css`** — Admin pill moved bottom-LEFT in v1.7.3 (was colliding with the search bar; chat drawer owns the right edge).

---

## Project gotchas

1. **`bump-version.js` = 26 TARGETS.** `--check` must say "all 26 agree." Widget static fallback (`#changelog-version`) is one. New versioned HTML page = add targets.
2. **`.gitignore` ↔ `firebase.json` mirror.** New sensitive/ignored file in deploy root → BOTH. `.env` covered by firebase `**/.*`. `scripts/*.js` DO deploy (no secrets there). Verify 404 post-deploy.
3. **Smart-quote check: Grep TOOL, not bash.** `bash grep -lE "[“”]"` FALSE-flags every multibyte file (byte-vs-char) — it listed all 8 touched files this session; the Grep tool correctly reported 0. Curly quotes in HTML *attributes* break things; in text/comments usually fine.
4. **Excel cleanup ≠ find/replace.** Watch column has space-merged platforms ("Netflix hianime") + suffix variants ("aniwave (VPN)"). Use `splitMergedPlatforms` + `startsWith` matching.
5. **CRLF warnings on `git add` are benign** (Windows LF→CRLF). Ignore.
6. **`[hidden]` loses to author `display:`** — add `.thing[hidden]{display:none}` when a hidden-toggled element sets non-none display. `prefers-reduced-motion` fallback on every animation. No native `confirm`/`alert`/`prompt` — branded modals only.
7. **AniList `streamingEpisodes` unreliable per-entry** — Re:Zero returns the same list on every season; titles use absolute numbering ("Episode 51"). Render layer dedupes identical lists + renumbers. AniList `StreamingEpisode` has NO numeric index field.
8. **Query-complexity budget** — nested relations-within-relations 500s on Demon Slayer (id 101922, the canary). Multi-fetch is N+1 per-node to dodge it. Don't nest.
9. **Update-log widget: no more 10-cap** (removed v1.7.3 — infinite scroll, sections back to v1.6.1). The cap rule was stripped from `widget-update-skill.md` (a Cowork exclude). Don't re-introduce it.

---

## Blake's working style

- Self-described "very basic" coder. **Never assume he knows terms/structure/commands unless explained this session.** Surgical guidance: which file, which line, what to type.
- **Loves premium / clean / unique UI and explicitly invites Code's creative latitude** — *"I want its full efforts on display including new ideas and design changes."* When granted latitude, surface 2-3 alternatives with one-line "why" + recommend one. He gives Code free rein on admin-form polish ("touch ups and small upgrades to fit the feel").
- Direct feedback; quote his exact words in the report when surfacing a bug for the next iteration.
- He runs the terminal commands you build (backfills, occasionally smoke). He does NOT open Excel — Code handles ALL Excel writes programmatically (hard rule since v1.7.1).
- Shares screenshots of the running site — use them as ground truth for UI state.
- Energy fluctuates; late-session reviews go fast. "What's next?" can be a fatigue signal.

---

## What a fresh Code session does first
1. **Read `CLAUDE.md`** (auto-loads).
2. **Read `docs/CODE-HANDOFF.md`** (this file).
3. **Read `docs/SHIP-PROMPT.md`** — the current gate.
4. **Read `docs/SHIP-OUTPUT.md`** — what just happened (currently: v1.7.4 Gate 0 proposal awaiting Blake's 5 decisions).
5. **Continue from the current gate.** Recon the REAL file state before trusting any "already built/done" claim. PROPOSE-FIRST → propose; APPLY → execute + report. Gates 4/9/11 are Blake's.

## One-liner state summary (paste-ready)
v1.7.3 (Watched Set + Admin Form Completion + chatbot drawer) is LIVE in prod (`74041d6`, 2026-06-04, APP_VERSION 1.7.3) after shipping v1.7.2 (More Info panel overhaul) earlier this session; **v1.7.4 (Modal Architecture Overhaul — secondary modal + always-visible More Info + per-season reviews) is at Gate 0 with the proposal in `docs/SHIP-OUTPUT.md` AWAITING Blake's 5 direction decisions** before Cowork writes gate 1; the project lives in `Current Version/` (CWD is the parent — prefix paths), the workflow is the 12-gate model with the SHIP-PROMPT/SHIP-OUTPUT/HANDOFF rolling trio (SHIP-OUTPUT normally rewritten every response unless Blake suspends it — he did, late this session), commits are authored Blake via per-commit `--author=` with zero trailers and the 7 Cowork docs restore-staged out, prod only on explicit "ship it"; the two traps that bit this session are gate-numbering/phantom-"done" drift (grep the real state — caught the watched data missing from animeData) and the sync-excel parse-vs-serialize split (a new animeData field needs BOTH halves); key new architecture is the load-bearing shared `franchise-fetch.js`, the watched-set columns + set-membership ✓ REVIEWED pill, and the local-only chatbot `/api/chat` needing `ANTHROPIC_API_KEY` in `.env`; use live AniList node queries for ground-truth recon and the Grep TOOL (not bash) for smart-quote checks.
