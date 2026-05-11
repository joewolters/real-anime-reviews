<!-- author: Code | date: 2026-05-09 -->
# AI Session-Start Primer

> **Read this first if you're an AI starting a new session on this project.** This is a 60-second orientation. The full docs are richer; this is the minimum viable context to start work without re-deriving everything.

---

## 1 · Who you're working with

**Blake Wolters** (USF student, GitHub: `joewolters`). Self-described "very basic" coder. Builds personal projects step-by-step with AI guidance. Strong creative instincts and good product sense. Can copy/paste, test, follow exact instructions — but needs explicit, surgical guidance: which file, which line, what to replace, what the change does. **Do not assume he knows coding terms, project structure, terminal commands, or debugging steps unless they've been explained earlier.** Curses casually, sense of humor, appreciates when you match energy without forcing it. Energy fluctuates over long sessions — watch for fatigue.

## 2 · The collaboration pattern (non-negotiable)

**Show, don't do.** For every meaningful change: (1) show the plan, (2) show the diff before saving, (3) pause for explicit approval, (4) verify after writing, (5) only then stage/commit. Surgical edits over rewrites. Honest "I'm not sure" over fabricated content. Verify-before-destructive (one cheap diff/check before any delete, even when reasoning says it's safe). Never auto-deploy to production without an explicit go-signal. Never force-push or rewrite git history.

## 3 · What this site is

**Real Anime Reviews** (<https://realanimereviews.com>) — a fan-made anime review site Blake built. Live, public GitHub repo, custom domain. Vanilla HTML/CSS/JS (no framework). Firebase for auth + Firestore + Hosting. Anime database hand-maintained in `Anime_Master_Table.xlsx` and copy-pasted into `animeData.js` (sync script is a planned v1.5.0 feature). Site has user accounts, comments, community reviews, voting, favorites, watchlists.

**North star:** *"A real working site for strangers looking for anime recommendations from an actual normal person."*

## 4 · Where the project is right now

- **Live at v1.6.2** (Mode 1 baseline + local "one-click ship" server shipped 2026-05-10 as v1.6.0; v1.6.1 was a same-day hotfix for Bug 10 — `spawn EINVAL` on Windows + Node ≥20.12.2 broke the local pipeline; v1.6.2 is the next-day prevention ship — startup smoke check + `docs/DECISIONS.md` lesson on testing pipeline plumbing at the commit you're shipping). Phase A (Excel sync, v1.5.0) and Phase B baseline both done.
- **What Mode 1 is** (already shipped, use it): admin "+ Add Anime" floating button bottom-right of every page (visible only to admin UID); opens an admin form at `/admin/new-anime` with AniList prefill; if `npm run mode1` is running locally, the form auto-detects the server and "Submit & Ship" runs the full 9-step pipeline (Excel backup + append → image download → sync → widget update → version bump → CHANGELOG entry → tests → git commit + push → Firebase deploy) with SSE-streamed progress, paused for explicit confirmation before the production deploy.
- **Up next:** v1.6.3 — Mode 1 polish (live preview as you type: search-as-you-type AniList dropdown + live card preview). Requires extracting the homepage card-render function from `script.js`.
- **Full backlog:** see `docs/NEXT.md` for everything queued (Phase B remaining, Phase D Mode 2 stages, audit polish bundles, polish + tech debt, big-vision ideas, deferred items).
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
│   │   ├── bump-version.js                       ← bumps 14 version strings
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

Don't hand-edit version strings. Use `node scripts/bump-version.js 1.5.0` from `Current Version/`. The script updates all 7 places (`window.APP_VERSION` in two HTML files, three `style.css?v=` / `mobile.css?v=` cache-busters, the changelog widget static fallback). Run `node scripts/bump-version.js --check` to verify all 7 strings agree before committing. The static fallback (`changelog-version` span) and `APP_VERSION` MUST agree, or the bug from v1.3.4 commit `fe0dc4a` will recur.

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

- `ROADMAP.md` — full phased plan, the 9 project rules, every big-vision idea, Phase D (Mode 2) build order
- `CLAUDE.md` — Code-specific operational rules, version-bump checklist, gotchas in full detail
- `docs/ARCHITECTURE.md` — Firestore data model, script.js section map, file structure
- `docs/DEPLOYMENT.md` — local server, preview channels, production deploys
- `docs/anilist-spike.md` — what AniList offers, ready-to-run queries, schema-design decisions for v1.5.0/v1.6.0
- `docs/CODE-PROMPTS.md` — copy-paste prompts that match Blake's collaboration style
- `docs/DECISIONS.md` — the WHY behind project choices that aren't obvious from code
- `CHANGELOG.md` — what shipped when, with author markers
