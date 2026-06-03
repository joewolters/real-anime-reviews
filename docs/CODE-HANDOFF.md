<!-- author: Code | date: 2026-06-03 -->
<!-- AUDIENCE: This file is FOR CODE (another Claude Code instance picking up work). -->
<!-- NOT for Cowork — Cowork reads docs/HANDOFF.md + docs/SHIP-OUTPUT.md and writes docs/SHIP-PROMPT.md. -->

# Code → Code Handoff

> Quick-onboarding doc so a fresh Code session can pick up immediately without re-deriving the workflow. Read this first, then `docs/SHIP-PROMPT.md` (the current gate's instructions), then `docs/SHIP-OUTPUT.md` (the previous Code's last report).

---

## Right now (snapshot — 2026-06-03)

**v1.7.1 is LIVE in production** (commit `e78f7d6`, deployed 2026-06-03 13:55:37, `APP_VERSION="1.7.1"` on realanimereviews.com). v1.7.1 = AniList enrichment polish bundle (Japanese/romaji subtitles + native fallback, per-anime AniListColor badge accent, premium NO-MATCHES empty-state, widget version chips, all-44 backfill, `--add-native`/`TitleNative`).

**Shipped this session, in order:** v1.6.12 (admin queue fixes) → v1.7.0 (AniList backfill + community-score twin badge) → v1.7.1 (polish bundle). All three live.

<!-- author: Cowork | date: 2026-06-03 -->
**In flight (per `docs/HANDOFF.md`):** **v1.7.2 — the de facto More Info panel overhaul** (~6-8h; data architecture + UX redesign bundled per Blake's "Option 3" call). Gate 1 (data layer: parallel-fetch, BFS multi-hop traversal, localStorage L2 cache) + Gate 2 (UI: spine chain + grouped sections + "✓ Reviewed" pill + partial-fail notice + per-season collapsible episodes) DONE. Gate 3 in flight — iterating on 5 gate 4 smoke bugs (Re:Zero same-episodes-across-seasons, Re:Zero starts at Ep 51, Eminence missing episodes, seasons-open-by-default flip, score-badge-collides-with-title) + the episode counter toggle (PER SEASON / CONTINUOUS). After v1.7.2: **v1.7.3 — Watched-set feature** (new `WatchedAniListIds` Excel column + admin multi-select reusing v1.7.2's `traverseFranchise` + Mode 1 auto-fill + ~20-min backfill across 44 reviews; ~4-6h), then **v1.7.4 — in-site secondary modal** (pushed back from v1.7.3 by the watched-set slot-in; benefits from v1.7.3's multi-season pill correctness), then **v1.8.0 — AniList tab on cards** (at-a-glance verified-source data).

**Live URL:** https://realanimereviews.com (aliased to https://real-anime-reviews.web.app).

---

## The rolling-docs trio (how Code ↔ Cowork ↔ Blake talk)

| File | Author | Purpose |
|---|---|---|
| `docs/SHIP-PROMPT.md` | Cowork writes, Code reads | The current gate's instructions. Cowork overwrites per gate. |
| `docs/SHIP-OUTPUT.md` | Code writes, Cowork reads | Code's report. Cowork digests it to Blake. **Code OVERWRITES it EVERY response** (see below) — no append. |
| `docs/HANDOFF.md` | Cowork writes | Cowork's persistent state. **Code reads but never writes** this one. |

All firebase-ignored (`docs/SHIP-*.md`, `docs/HANDOFF.md`, `docs/CODE-HANDOFF.md`, `docs/COWORK-STYLE.md`) — committed to git for history, never deployed to the public CDN.

**`docs/SHIP-OUTPUT.md` is rewritten EVERY response, not just per gate.** Blake's standing instruction (2026-06-03): *"make sure to replace docs/SHIP-OUTPUT.md every time you issue a response so cowork can read it and then report to me."* Even a recon-only or answer-only turn → write the report there. Blake reads via Cowork, not chat.

This file (`docs/CODE-HANDOFF.md`) is **Code-to-Code only** — not in the rolling trio, doesn't need per-gate updates.

---

## The 12-gate ship structure

```
0  Recon + propose plan                          [Code → Blake]   PROPOSE-FIRST
1  Build core feature                            [Code → Blake]   PROPOSE-FIRST
2  Build supporting features                     [Code → Blake]   PROPOSE-FIRST
3  Reserved for iteration / fixes                [Code → Blake]   PROPOSE-FIRST
4  Local browser smoke                           [Blake]          —
5  Docs cascade (bump + CHANGELOG + widget + NEXT + ROADMAP)  [Code]  FAST-TRACK
6  Audits (npm test 7/7 + mirror + git diff)     [Code]           FAST-TRACK
7  Commit + push                                 [Code]           FAST-TRACK
8  Preview deploy (hosting:channel + rules)      [Code]           FAST-TRACK
9  Preview smoke                                 [Blake]          —
10 Production deploy                              [Code, on "ship it"]  FAST-TRACK
11 Production verify                              [Blake]          —
```

**Gates often get compressed** — Cowork writes prompts like "Gates 5+6+7+8" (one sweep) or "Gates 1b apply". Follow the prompt's actual scope.

**Sub-gates `1b`/`1c`/`1d`…`1h`** are iteration loops. This session's v1.7.1 went 1 → 1b → 1c → … → 1h (eight build iterations on the romaji subtitle alone) before gate 5. Each sub-gate is its own propose-or-apply. Don't expect a clean 0→11; expect lots of `Xb`/`Xc` polish loops driven by Blake's smoke.

**PROPOSE-FIRST gates** (0-3 + sub-gates whose header says "propose"): write the full proposal to `SHIP-OUTPUT.md`, do NOT apply, wait for the next Cowork apply-prompt. **APPLY / FAST-TRACK gates** (the `-apply` sub-gates + 5-8, 10): execute directly, report after. **Blake-owned** (4, 9, 11): browser smoke, Code waits.

---

## ⚠️ The single most important lesson this session: gate-numbering drift / PHANTOM FEATURES

Cowork prompts sometimes **reference work attributed to a "gate" that never actually ran in your session**, and credit features that DO NOT EXIST in the code. Real examples this session:
- Gate 1d referenced a "gate 1c `-webkit-line-clamp`" that was never written.
- Gate 1e's Item 3 claimed `--add-native` / `pickSubtitle` / `TitleNative` were "built at gate 1c" — a grep proved **0 hits anywhere**. Cowork even apologized and had gate 1f build them for real.

**Rule: ALWAYS recon the actual file state before "fixing" or "iterating on" something the prompt says already exists.** Never trust "Code already built X at gate Y." `grep`/`Read` first. If the prompt's premise is false, **surface it loudly in the report** (flag the phantom, do NOT silently build the unspecced thing) and let Blake/Cowork decide. Blake values this — it caught a feature he'd otherwise have run a no-op command for.

---

## Code's mannerisms (the patterns that work)

### Gate report shape (in `docs/SHIP-OUTPUT.md`)
1. Author marker `<!-- author: Code | date: YYYY-MM-DD -->`
2. Title: `# vX.Y.Z — Gate N (description — STATUS ✓, TIER)`
3. Blockquote one-paragraph summary
4. Numbered/sectioned body: files written + line counts, decisions baked in, verification (all green), stop-condition audit, state-for-next-gate
5. **A `## One-liner reply` at the bottom** — one long semicolon-separated sentence. Cowork uses it verbatim as Blake's digest line.

### Chat replies stay terse
After writing the full report to the doc, the chat reply is ~2-6 bullets/sentences. Don't duplicate the doc. Blake reads via Cowork.

### Verify every gate, report it green
Standard verify battery: `node --check <each touched .js>`, `node scripts/bump-version.js --check` (expects "all 26 strings agree on vX.Y.Z"), `npm test` (Playwright, expect **7 passed**), targeted greps confirming new selectors/IDs landed + old ones gone, smart-quote check. Production-facing changes (HTML/JS/CSS/animeData.js) require `npm test` before commit (CLAUDE.md rule #7).

### Surface anomalies, don't silently fix
Anything outside the gate's explicit scope (adjacent CSS bug, a leak, a phantom feature, a pre-existing issue) → **flag in the report, don't fix unilaterally**. Hard precedents: v1.6.10 gate 2 (an "obvious" scope add broke prod AniList queries → full revert); the firebase.json leak this session (see Gotchas).

### Flag drift from the proposal
If the apply ends up larger than the estimate, say so with the reason. Blake/Cowork track scope-creep signals.

---

## Commit discipline (CRITICAL)

### Author — per-commit `--author=` flag ONLY (never `git config`)
```bash
git commit --author="Blake Wolters <196413457+joewolters@users.noreply.github.com>" -m "$(cat <<'EOF'
v1.x.y -- Subject line, ASCII-safe (em-dash -> --, arrow -> ->)

Body paragraph(s).
EOF
)"
```
`196413457` is Blake's stable GitHub user ID (renamed `ReaIGodzilla` → `joewolters` in v1.4.2).

### ZERO forbidden trailers
No `Co-Authored-By:` / `🤖` / `Claude Code` / `Generated with`. Use the single-quoted heredoc so the harness can't inject them. Verify after EVERY commit:
```bash
git log -1 --format="%an %ae"          # Blake Wolters 196413457+joewolters@users.noreply.github.com
git log -1 --format="%B" | grep -ciE "co-authored-by|🤖|claude code|generated with"   # 0
```

### The 7 Cowork-managed excludes (held out of EVERY Code commit)
```
docs/COWORK-STYLE.md  docs/AI-PRIMER.md  docs/CODE-PROMPTS.md
docs/SKILLS/README.md  docs/SKILLS/hotfix-skill.md
docs/SKILLS/release-skill.md  docs/SKILLS/widget-update-skill.md
```
Pattern:
```bash
git add -A
git restore --staged docs/COWORK-STYLE.md docs/AI-PRIMER.md docs/CODE-PROMPTS.md docs/SKILLS/README.md docs/SKILLS/hotfix-skill.md docs/SKILLS/release-skill.md docs/SKILLS/widget-update-skill.md
git diff --cached --name-only   # confirm the 7 are NOT listed
```
`docs/SHIP-OUTPUT.md`, `docs/SHIP-PROMPT.md`, `docs/HANDOFF.md`, `docs/CODE-HANDOFF.md` ARE committed (firebase-ignored, kept for history). Blake hasn't ratified the 7 for commit yet — they stay as working-tree modifications/untracked.

### Prod deploy needs an EXPLICIT go-signal
Gate 10 = `firebase deploy --only hosting`. **Never auto-deploy to prod without Blake's "ship it."** This session's v1.7.1 gate-10 prompt literally said *"Awaiting his explicit ship it before this gate fires"* — I confirmed the go-signal before deploying. If a gate-10 prompt's go-signal isn't unambiguous in the prompt text, confirm. CLAUDE.md's #1 rule.

---

## Project gotchas (the ones you'll actually hit)

**Build / tooling:**
1. **`bump-version.js` has 26 TARGETS.** Adding a new HTML file with `?v=X` cache-busters means adding TARGETS or they go stale. `--check` must say "all 26 strings agree."
2. **`.gitignore` ↔ `firebase.json` mirror.** Sensitive files in BOTH. **This session's leak:** `docs/CODE-HANDOFF.md` + `docs/COWORK-STYLE.md` were committed/in-tree but NOT firebase-ignored → would have deployed to the public CDN. Fixed by adding them to `firebase.json` ignore (verified 404 post-deploy). NOTE: `scripts/` is NOT firebase-ignored, so `scripts/*.js` DO deploy publicly — pre-existing, contains no secrets, flagged-not-fixed. Write backfill `.bak` files + reports to `Master List/` (OUTSIDE the deploy root) so they never deploy.
3. **CRLF warnings on `git add` are benign** (Windows LF→CRLF). Ignore them.

**CSS (the romaji/badge saga taught these):**
4. **`[hidden]` loses to author `display:`.** UA `[hidden]{display:none}` (0,1,0) ties any class-based `display:flex` (0,1,0) and loses on cascade order → `element.hidden=true` is a visual no-op. ALWAYS add `.thing[hidden]{display:none}` when a hidden-toggled element sets a non-none display. (v1.6.12 root cause.)
5. **`.card .info span { color: gold }` catches inner spans.** The rating-span style + the Top-10 `.spotlight-stack .card .info span` gold-pill rule tint ANY `<span>` inside `.card .info`. When adding sub-text inside a card, use a different element (we used `<i class="rb">` for romaji brackets) or override with high specificity / `!important`.
6. **`-webkit-line-clamp` needs LITERAL inline content.** Brackets as `::before`/`::after` pseudo-elements don't participate in line-clamping. To wrap multi-line with decorative brackets, make them real inline `<i>` glyphs.
7. **`color-mix()` needs a plain fallback line FIRST.** `background: <plain>; background: <color-mix...>;` so older browsers keep the plain value (used for the per-anime AniListColor badge accent).
8. **`.admin-shell` (backdrop-filter) is a containing block for `position:fixed`.** A fixed overlay inside it gets clipped by its `overflow:hidden`. Place modals OUTSIDE such ancestors. (v1.6.12 confirm-modal.)

**Verification:**
9. **bash `grep -c "[""]"` over CJK/multibyte text gives FALSE smart-quote counts** (byte-vs-char). Use the **ripgrep-backed Grep tool** for authoritative smart-quote checks, not bash grep.
10. **`replace_all` only hits exact-indent matches.** A `native` field add this session hit the 6-space query but missed the 4-space one — always re-grep to confirm the expected hit count after a `replace_all`.
11. **Can't `node --check` by running a CLI that auto-runs `main()`** — `anilist-backfill.js` calls `main()` on load, so `require()` would execute it. Use `node --check` (syntax only) + `--help` to confirm flags; never run the backfill yourself (Blake runs it).

**AniList:**
12. **Query complexity budget** — nested-relations mega-queries 500 on relation-heavy Media (Demon Slayer). Use Demon Slayer's id as the canary. v1.7.2's whole design is N+1 per-relation fetches to dodge this.

---

## Key files + scripts (current architecture)

- **Excel is canonical** — `../Master List/Anime_Master_Table.xlsx`, sheet `Anime_Master_Table_claude_final`, 44 rows. Columns now include `AniListId, IdMal, AniListScore, AniListColor, TitleEnglish, TitleRomaji, TitleNative` (all populated). `Master List/` is OUTSIDE the `Current Version/` deploy root.
- **`scripts/sync-excel-to-js.js`** — Excel → `animeData.js`. Reads/emits the optional AniList fields conditionally. Run via `npm run sync`.
- **`scripts/anilist-backfill.js`** — the catch-up CLI (`npm run backfill`). Modes: default interactive, `--dry-run`, `--auto` (exact-title auto-pick), `--match "<Title>" <id>` (explicit-id, repeatable), `--add-native` (populate `TitleNative` by id, idempotent). Backs up Excel once, regenerates animeData.js via sync, writes a markdown report to `Master List/`. **Code builds it; Blake runs it at a smoke gate.** Reuses `scripts/lib/excel-backup.js` (`backupExcel`/`checkExcelLock`, also used by `scripts/mode1-server.js`) and `callAniList` exported from `scripts/anilist-fetch.js`.
- **`card-render.js`** — `window.renderAnimeCardMarkup` (homepage cards + admin preview). Classic script, framework-free. Has its own `slug()` + `pickSubtitle()` (duplicated in `script.js` — keep in sync).
- **`script.js`** — the homepage + modal monolith (~4900 lines). Modal builder is `openModal()` (~line 3640); `buildFeaturedDrop()` (~1480) renders the Latest Drop card (its OWN render path, NOT card-render.js); helpers like `escapeHtml`/`slug`/`readableAccent`/`pickSubtitle` are top-level in the IIFE; the search empty-state is in `rerenderAll()`.
- **`pickSubtitle(anime)`** — picks the subtitle: romaji when `norm(rom) !== norm(eng)` (normalize = lowercase + strip non-alphanumerics), else native Japanese (`TitleNative`), else null. `kind:'native'` adds `.is-native` → swaps font to Noto Sans JP. Lives in BOTH card-render.js + script.js.

---

## Blake's working style

- Self-described "very basic" coder. **Never assume he knows terms / structure / commands unless explained this session.** When guiding him, be surgical: which file, which line, what to type.
- "Show, don't do" for meaningful changes (plan → diff → approval → verify → commit). But within an approved gate's apply, just execute + report — the gate IS the approval.
- Direct feedback; he'll say when something's wrong. **Quote his exact words in the report** when surfacing a bug for the next iteration (e.g. *"Couldn't Load still shows up"*).
- Energy fluctuates; late-session reviews go fast. "What's next?" can be a fatigue signal.
- He runs the terminal commands you build (backfill, occasionally smoke). He does NOT open Excel — Code handles ALL Excel writes programmatically (hard requirement from v1.7.1 gate 1).

---

## What a fresh Code session does first
1. **Read `CLAUDE.md`** — permanent operating rules.
2. **Read `docs/HANDOFF.md`** — Cowork's high-level state (may be stale; trust SHIP-OUTPUT more).
3. **Read `docs/CODE-HANDOFF.md`** (this file) — mannerisms + gotchas.
4. **Read `docs/SHIP-PROMPT.md`** — the current gate.
5. **Read `docs/SHIP-OUTPUT.md`** — what just happened.
6. **Continue from the current gate.** PROPOSE-FIRST → propose; APPLY/FAST-TRACK → execute + report. Gates 4/9/11 are Blake's — wait. And **recon the real file state before trusting any "already built" claim** in the prompt.

---

## One-liner state summary (paste-ready)
v1.7.1 (AniList enrichment polish bundle) is live in prod as of 2026-06-03 13:55:37 via commit `e78f7d6` (after v1.6.12 + v1.7.0 earlier in the session); next queued ship is v1.7.2 multi-fetch data architecture + multi-hop revival (then v1.7.3 secondary modal, v1.8.0 AniList tab); the workflow is the 12-gate model (PROPOSE-FIRST builds 0-3 + `Xb/Xc/...` iteration sub-gates, FAST-TRACK cascade/audit/commit/deploy 5-8 & 10, Blake-owned smoke 4/9/11), with `docs/SHIP-PROMPT.md` (Cowork→Code) / `docs/SHIP-OUTPUT.md` (Code→Cowork, rewritten EVERY response) / `docs/HANDOFF.md` (Cowork-owned) as the rolling trio; biggest trap is gate-numbering drift where prompts credit phantom features that don't exist — always grep/Read the real file state before iterating and surface phantoms loudly; commits are authored Blake Wolters via per-commit `--author=` (never `git config`) with ZERO forbidden trailers (post-commit grep) and the 7 Cowork docs (`COWORK-STYLE`, `AI-PRIMER`, `CODE-PROMPTS`, `SKILLS/{README,hotfix-skill,release-skill,widget-update-skill}`) restored-staged out of every commit; prod deploy only on Blake's explicit "ship it"; key gotchas this session were the `[hidden]` cascade, the `.card .info span{color:gold}` span-tinting, `-webkit-line-clamp` needing literal inline brackets, `color-mix` plain-fallback-first, the bash-grep byte-vs-char smart-quote false positive (use the Grep tool), and the firebase.json leak (CODE-HANDOFF + COWORK-STYLE now ignored); Excel is canonical with 7 AniList columns populated, the backfill CLI (`npm run backfill` with `--dry-run`/`--auto`/`--match`/`--add-native`) is Code-built-Blake-run, and `pickSubtitle` (normalize-then-compare, native fallback) is duplicated in card-render.js + script.js.
