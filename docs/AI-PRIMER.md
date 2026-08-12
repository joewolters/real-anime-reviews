<!-- author: Cowork | date: 2026-06-02 -->
# AI Session-Start Primer

> **Read this first if you're an AI starting a new session on this project.** This is a 60-second orientation. The full docs are richer; this is the minimum viable context to start work without re-deriving everything.
>
> **In-flight work?** Always read `docs/HANDOFF.md` immediately after this — that's the live state of whatever ship is mid-flight (which gate, what's applied, what's left, working-tree state). HANDOFF is the project's session-bridge doc; this primer is the orientation behind it.

---

## 1 · Who you're working with

**Blake Wolters** (USF student, GitHub: `joewolters`). Self-described "very basic" coder. Builds personal projects step-by-step with AI guidance. Strong creative instincts and good product sense. Can copy/paste, test, follow exact instructions — but needs explicit, surgical guidance: which file, which line, what to replace, what the change does. **Do not assume he knows coding terms, project structure, terminal commands, or debugging steps unless they've been explained earlier.** Curses casually, sense of humor, appreciates when you match energy without forcing it. Energy fluctuates over long sessions — watch for fatigue.

## 2 · The collaboration pattern (non-negotiable)

**Show, don't do.** For every meaningful change: (1) show the plan, (2) show the diff before saving, (3) pause for explicit approval, (4) verify after writing, (5) only then stage/commit. Surgical edits over rewrites. Honest "I'm not sure" over fabricated content. Verify-before-destructive (one cheap diff/check before any delete, even when reasoning says it's safe). Never auto-deploy to production without an explicit go-signal. Never force-push or rewrite git history.

## 3 · What this site is

**Real Anime Reviews** (<https://realanimereviews.com>) — a fan-made anime review site Blake built. Live, public GitHub repo, custom domain. Vanilla HTML/CSS/JS (no framework). Firebase for auth + Firestore + Hosting. Anime database hand-maintained in `Anime_Master_Table.xlsx` and copy-pasted into `animeData.js` (sync script is a planned v1.5.0 feature). Site has user accounts, comments, community reviews, voting, favorites, watchlists.

**North star:** *"A real working site for strangers looking for anime recommendations from an actual normal person."*

## 4 · Where the project is right now

<!-- author: Cowork | date: 2026-07-02 -->
> **⚠️ THIS SECTION IS A HISTORICAL SNAPSHOT (June 2026 era).** Current truth: **v1.10.1 LIVE** (the full Community Hub — Tavern forum, profiles + frames, rooms everywhere, DM Blake, the Lantern, images, moderation/ban spine); **v1.10.2R staged**; the MEGA-RUN (DMs/groups/mobile/everything — NEXT.md superseding directive) is next. **`docs/HANDOFF.md` + `docs/CODE-HANDOFF.md` are the live state — read those, not the bullets below.**

<!-- author: Cowork | date: 2026-06-03 -->
- **Live at v1.7.1** (commit `e78f7d6`, shipped 2026-06-03). The v1.6.x → v1.7.x arc has been all-in on AniList integration: v1.6.8 added a collapsible More Info panel on every modal; v1.6.9 added inline episode / recommendation / staff clusters; v1.6.10/11/12 closed out polish + Suggestion Box + admin viewer; v1.7.0 backfilled AniList IDs across all 44 reviews and shipped the gold-RATING / purple-ANILIST twin badge; v1.7.1 shipped a polish bundle (romaji+native subtitles in `「 」` brackets, per-anime AniListColor accents, premium NO-MATCHES empty-state, widget version chips). Multi-hop franchise traversal + franchise-episode aggregation were carved out of v1.6.10 (AniList complexity-budget 500s) and rolled into v1.7.2 as the load-bearing architecture below.
- **In flight:** v1.7.2 — **the de facto More Info panel overhaul.** Multi-fetch data architecture (`Promise.all`-batched parallel AniList fetches), multi-hop franchise traversal (BFS w/ seen-set + caps), franchise-episode aggregation, UX overhaul of the panel (spine chain w/ `--current` highlight + connector line + grouped sections by relationType + "✓ Reviewed" in-catalog pill that opens Blake's modal), partial-fail notice + retry, 24h localStorage L2 cache keyed by `APP_VERSION`, episode counter toggle (PER SEASON / CONTINUOUS). See `docs/HANDOFF.md` for the live gate state. v1.7.3 = Watched-set feature (new column + admin multi-select + Mode 1 auto-fill); v1.7.4 = in-site secondary modal (pushed back from v1.7.3 by the watched-set slot-in).
- **What Mode 1 is** (already shipped, use it): admin "+ Add Anime" floating button bottom-right of every page (visible only to admin UID); opens an admin form at `/admin/new-anime` with AniList prefill; if `npm run mode1` is running locally, the form auto-detects the server and "Submit & Ship" runs the full 9-step pipeline (Excel backup + append → image download → sync → widget update → version bump → CHANGELOG entry → tests → git commit + push → Firebase deploy) with SSE-streamed progress, paused for explicit confirmation before the production deploy.
- **The Cowork–Code split** (effective v1.6.8+): for big multi-gate ships, **Cowork** sits beside Blake (the manager) writing lean SHIP-PROMPT.md files for each gate; **Code** (the CLI tool) applies them and writes SHIP-OUTPUT.md back. The 12-gate workflow (recon → 3 build gates → local smoke → docs cascade → audits → commit → preview deploy → preview smoke → prod deploy → prod verify) is documented in `docs/HANDOFF.md` § "Gate structure". Solo-Code ships (no Cowork in the loop) still use `release-skill.md` / `hotfix-skill.md` end-to-end.
- **Full backlog:** see `docs/NEXT.md` for everything queued (v1.7.2 in flight, v1.7.3 watched-set, v1.7.4 secondary modal, v1.8.0 AniList tab on cards, etc.). `ROADMAP.md` for the phased arc.
- **Mode 2 (long-term):** autonomous site caretaker, weekly schedule. Phase D — not started yet. Mode 1 needs to be in active use first to inform Mode 2's design.
- **Long-term end goal:** two AI modes — Mode 1 (Blake-initiated, shipped) and Mode 2 (AI-initiated, future). See `ROADMAP.md` for the full arc.

## 5 · Project rules — apply to every change

1. **Excel is canonical** for anime data. Any change to anime data also updates `Anime_Master_Table.xlsx`.
2. **Mark your changes** in CHANGELOG with `<!-- author: Code | date: YYYY-MM-DD -->` on the line above the entry.
3. **Mode 1 and Mode 2 are separate AI systems.** Don't conflate them in code or docs.
4. **Mode 2 is constrained to PATCH-tier changes** when it exists. MINOR/MAJOR escalates to Blake.
5. **Slow-and-safe over fast-and-broken.** Every meaningful change ladders local → preview → production.
6. **Every code-and-data change updates the website's CHANGELOG widget.** Internal `CHANGELOG.md` and the runtime widget stay in sync.
7. **Run tests before production-facing commits** (`npm test` — Playwright). Docs-only and tooling-config changes are exempt.
8. **`.gitignore` and `firebase.json` ignore arrays must mirror** for sensitive files. Adding a file to one always means adding it to the other.
9. **Image curation is hybrid: AniList default + manual override.** Mode 1 pre-populates the new-anime form with the AniList cover image. Blake can accept it (one click) or override by dropping a custom file into `assets/`. Mode 2 is NOT permitted to change images on existing anime.

## 6 · Where things live (file map)

```
PROJECTS/Real Anime Reviews/
├── Current Version/      ← THE PROJECT. Run all commands from here.
│   ├── index.html, account.html, 404.html       ← public site
│   ├── admin/new-anime.{html,css,js}             ← Mode 1 form (admin-only)
│   ├── admin-fab.{js,css}                        ← floating "Admin" pill (every page)
│   ├── script.js (~4000 lines), account.js, firebase.js, animeData.js (auto-generated)
│   ├── style.css, mobile.css, assets/
│   ├── scripts/
│   │   ├── mode1-server.js                       ← `npm run mode1` (one-click ship)
│   │   ├── sync-excel-to-js.js                   ← `npm run sync` (Excel → JS)
│   │   ├── bump-version.js                       ← bumps 18 version strings (see § 8)
│   │   └── anilist-fetch.js                      ← AniList CLI for ad-hoc queries
│   ├── tests/ (Playwright), docs/, README.md, CHANGELOG.md, ROADMAP.md, CLAUDE.md
│   └── PERSONAL.md (gitignored — never commit; Firebase login, admin UID)
└── Master List/
    ├── Anime_Master_Table.xlsx                   ← CANONICAL anime data
    └── Anime_Master_Table.bak.*.xlsx             ← Mode 1 server auto-backups
```

`README.md` for project overview. `CHANGELOG.md` for what shipped (newest first). `ROADMAP.md` for what's coming + project rules in full. `docs/ARCHITECTURE.md` for Firestore schema + script.js section map. `docs/DEPLOYMENT.md` for the local → preview → production deploy ladder. `docs/mode1-design.md` for the Mode 1 form + server architecture. `docs/ai-integration-design.md` for the planned one-click AI integration (v1.6.x). `docs/SKILLS/release-skill.md` for the full release workflow any AI can follow.

## 7 · The well-known gotchas (don't re-discover these)

- **PowerShell `Get-Content` defaults to ANSI**, not UTF-8. UTF-8 multi-byte chars (em dashes, arrows) display as garbled mojibake. Always use `Get-Content -Encoding UTF8 <file>` for verification reads, or `[System.IO.File]::ReadAllBytes(<file>)` for byte-level inspection.
- **The `Edit` tool can silently convert ASCII `"` to curly `"` `"` in HTML.** Curly quotes break HTML attributes (e.g., `class="curly"` won't match CSS selectors). Curly quotes inside text content are fine. Always `git diff` after every HTML edit.
- **PowerShell here-strings (`@'...'@`) eat trailing newlines.** Causes blank-line bugs in CHANGELOG.md (happened twice already, v1.3.5 and v1.3.6). Verify section boundaries with byte-level inspection if writing multi-section files.
- **`.gitignore` ≠ `firebase.json` ignore.** Two precedent leaks (PERSONAL.md in v1.3.5, AUDIT_2026-04-30.md in v1.3.9) happened because a file was gitignored but firebase-deployed. Always update both arrays together.
- **Read tool can normalize curly quotes to straight on display.** Confirm with byte-level inspection if quote characters matter to the task.
- **Line-ending churn.** A `.gitattributes` file (added 2026-05-09) auto-normalizes; if you see it again, that file got removed.

## 8 · Version bumping (now scripted)

Don't hand-edit version strings. Use `node scripts/bump-version.js X.Y.Z` from `Current Version/`. The script updates all **18 targets** as of v1.6.11 — `window.APP_VERSION` in `index.html` / `account.html` / `admin/new-anime.html` / `suggest.html`, the corresponding `style.css?v=` / `mobile.css?v=` / `admin-fab.css?v=` / `admin/new-anime.css?v=` / `suggest.css?v=` cache-busters, and the `<span id="changelog-version">` static fallback in the widget. Run `node scripts/bump-version.js --check` to verify all 18 strings agree before committing. The static fallback (`changelog-version` span) and `APP_VERSION` MUST agree, or the bug from v1.3.4 commit `fe0dc4a` will recur. When adding a new HTML page that loads versioned CSS, also extend the bump script's TARGETS table — every new ship that introduces a page is also a ship that grows the target count (precedent: v1.6.11 added 4 `suggest.html` targets, 14 → 18).

## 9 · Things you must NEVER do

- Put credentials, UIDs, or personal email addresses in any committed file. Reference `PERSONAL.md` by filename only.
- Auto-deploy to production without explicit go-signal.
- Force-push or rewrite git history on `main`.
- Do "code cleanup" without an audit-first framing.
- Rewrite files Blake hasn't asked to be rewritten. Surgical edits remain the default.
- Modify `firebase.json`'s `ignore` array without confirming the security implications.
- Bypass `npm test` on production-facing commits (project rule #7).

## 10 · When in doubt

Ask. Blake is collaborative, not directive. He'd rather answer a clarifying question than have you charge ahead and get it wrong. He explicitly rewards "I'm 90% sure but not certain" framing. If a session is long, he may be tired — gentle redirect to "let's stop and rest" is better than pushing through with degraded approval reviews.

## 11 · For deeper context

- **`docs/HANDOFF.md`** — live state of whatever ship is currently mid-flight. **Read this immediately after the primer.** Updated at every session pause OR ship close. Includes the locked 12-gate Cowork-Code ship structure.
- **`docs/SHIP-PROMPT.md` / `docs/SHIP-OUTPUT.md`** — rolling files for the current gate. Cowork writes PROMPT; Code writes OUTPUT. Overwrite per gate. All three (HANDOFF + SHIP-*) are firebase-ignored and roll into the gate-7 commit.
- `ROADMAP.md` — full phased plan, the 9 project rules, every big-vision idea, Phase D (Mode 2) build order
- `docs/NEXT.md` — current backlog (v1.7 plan, v1.6.x polish queue, deferred items)
- `CLAUDE.md` — Code-specific operational rules, version-bump checklist, gotchas in full detail
- `docs/ARCHITECTURE.md` — Firestore data model, script.js section map, file structure
- `docs/DEPLOYMENT.md` — local server, preview channels, production deploys
- `docs/anilist-spike.md` — what AniList offers, ready-to-run queries, schema-design decisions
- `docs/CODE-PROMPTS.md` — copy-paste prompts that match Blake's collaboration style
- `docs/DECISIONS.md` — the WHY behind project choices that aren't obvious from code
- `docs/SKILLS/release-skill.md` — full release procedure (Code-solo or as the operational backbone of the Cowork-Code 12-gate ship)
- `docs/SKILLS/hotfix-skill.md` — abbreviated procedure for small urgent PATCH fixes
- `docs/SKILLS/widget-update-skill.md` — visitor-first rules for the homepage CHANGELOG widget bullets (runs as a sub-step of the two skills above)
- `CHANGELOG.md` — what shipped when, with author markers
