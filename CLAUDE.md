# CLAUDE.md — instructions for Claude Code working on this project

This file is read automatically at the start of every Code session. Keep it short and operational. For project background, architecture, or roadmap, read the relevant docs (`README.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`).

## ⚡ READ-FIRST (this file AUTO-LOADS — it's the permanent rules; you don't need to re-read it)
Highest-stakes rules, always binding: **(1)** Excel is canonical + mark every change with an author comment; **(2)** never auto-deploy to prod without Blake's explicit go-signal; **(3)** never force-push / rewrite git history; **(4)** run `npm test` before production-facing commits; **(5)** the `.gitignore` ↔ `firebase.json` ignore-array MIRROR — a gitignored-but-not-firebase-ignored file leaks to the public site; **(6) CONTEXT DISCIPLINE:** the Code-facing docs use a `## ⚡ READ-FIRST` / `⛔ DEEP REFERENCE` overlay — read ONLY the READ-FIRST blocks of `CODE-HANDOFF`/`NEXT`/`ROADMAP` + `SHIP-PROMPT`/`SHIP-OUTPUT` in full; NEVER read a doc top-to-bottom (that's the context leak the overlay exists to stop). **When you change project state, UPDATE that doc's `## ⚡ READ-FIRST` line in the SAME change (don't let it drift); put new detail in the `⛔ DEEP REFERENCE` zone, not the priority block. Carry this rule + the live state into your handoff message so the next session inherits it.** The `### Jump-to` below finds a specific rule fast. (No "deep reference" cutoff here — it all auto-loads and it's all must-know.)

### Jump-to (sections)
- **Who Code is working with** — Blake's working style + the commit-author string.
- **Collaboration pattern (non-negotiable)** — show-don't-do, surgical edits, no auto-deploy.
- **Project rules** — the 7 binding rules (Excel-canonical, mark-changes, modes, test-before-commit…).
- **Operational gotchas** — PowerShell ANSI/here-string traps, the Edit-curly-quote-in-attributes trap, the gitignore↔firebase mirror.
- **File structure** — where things live (the project is in `Current Version/`).
- **Things Code must NEVER do** — credentials, auto-deploy, force-push, blind cleanup, firebase-ignore changes.
- **Version bump checklist** — the strings that move on a version bump.
- **Energy / fatigue patterns + When in doubt** — Blake's session-energy cues; ask before assuming.

---

## Who Code is working with

Blake Wolters. Self-described "very basic" coder. Builds personal projects step-by-step with AI guidance. Can copy/paste, test, follow exact instructions — but needs explicit, surgical guidance: which file, which line, what to replace, what the change does. Does not assume he knows coding terms, project structure, or terminal commands unless they've been explained in this session.

GitHub username: `joewolters` (renamed from `ReaIGodzilla` in v1.4.2 on 2026-05-09 — see CHANGELOG for context). Repo URL: `https://github.com/joewolters/real-anime-reviews`.

Commits authored as `Blake Wolters <196413457+joewolters@users.noreply.github.com>`. The numeric `196413457` is Blake's stable GitHub user ID (does not change on rename); the username portion was updated when the account was renamed. Don't change this without asking.

---

## Collaboration pattern (non-negotiable)

**Show, don't do.** For every meaningful change:

1. Show the plan in detail
2. Show the diff before saving
3. Pause for explicit approval
4. Verify after writing (`git diff`, byte-level inspection if it matters)
5. Only then stage / commit

Surgical edits over rewrites. Honest "I'm not sure" over fabricated content. Verify-before-destructive (one cheap diff/check before any delete, even when reasoning says it's safe).

Never auto-deploy to production without an explicit go-signal from Blake.

Never force-push or rewrite git history. The "fix it forward" discipline is documented in `docs/DEPLOYMENT.md` and Blake has bought into it.

---

## Project rules (from `ROADMAP.md` § Project rules)

These apply to every change Code makes:

1. **Excel is canonical.** `Anime_Master_Table.xlsx` (in `Master List/`) is the source of truth for anime data. Any change to anime data also updates Excel.

2. **Mark your changes.** Every CHANGELOG entry — and any meaningful documentation update — gets an HTML comment marker on the line above:
   ```
   <!-- author: Code | date: YYYY-MM-DD -->
   ```
   Author values: `Code`, `Mode 1`, `Mode 2`, `human (Blake)`.

3. **Mode 1 and Mode 2 are separate AI systems** (not yet built — see ROADMAP). Don't conflate them in code or docs.

4. **Mode 2 is constrained to PATCH-tier changes** when it exists.

5. **Slow-and-safe over fast-and-broken.** Every meaningful change ladders local → preview → production. See `docs/DEPLOYMENT.md`.

6. **Every code-and-data change updates the website's CHANGELOG widget.** Internal CHANGELOG.md and the runtime widget stay in sync.

7. **Run tests before production-facing commits.** Before any commit that changes production-facing code (HTML, JS, CSS, `animeData.js`), Code runs `npm test` (Playwright) locally and reports results. Only after all tests pass does Code surface the change for human review.

   Exceptions (no test required):
   - Docs-only changes (README/CHANGELOG/ROADMAP/ARCHITECTURE/DEPLOYMENT/CLAUDE.md edits with no code touched)
   - Internal tooling files (`firebase.json` deploy-config, `.gitignore`, `package.json` metadata)
   - The `CLAUDE.md` file itself

   When tests fail, surface the failure — do not auto-fix. Decide with Blake whether the test is wrong or the code is wrong.

---

## Operational gotchas (learned the hard way)

### PowerShell `Get-Content` defaults to ANSI

PowerShell 5.1's `Get-Content` defaults to ANSI/Windows-1252 display, which makes UTF-8 multi-byte chars (em dashes, arrows, emoji) look like garbled mojibake (`â€"` for `—`). The file on disk is fine; the *display* is wrong.

**Always use one of:**
- `Get-Content -Encoding UTF8 <file>` for verification reads
- `[System.IO.File]::ReadAllBytes(<file>)` + UTF8 decode for byte-level inspection

### The `Edit` tool can silently convert ASCII `"` to curly `"` `"` in HTML

Curly quotes inside HTML *attributes* break CSS class matching and parsers. Curly quotes inside *text content* are usually fine and may even be the file's existing convention.

**Always:** `git diff` after every HTML edit, grep for stray smart quotes in attributes, write via PowerShell here-string `@'...'@` or codepoint construction (`[char]0x201C` / `0x201D`) when byte fidelity matters.

### PowerShell here-strings eat trailing newlines

The `'@` close of a here-string does NOT include the newline that visually appears before it. This has caused TWO blank-line bugs in CHANGELOG.md (v1.3.5 and v1.3.6) where the new entry's body ran directly into the next entry's marker without a blank line between them.

**Always:** after writing a multi-section file, verify the section boundaries with byte-level inspection (e.g. `[System.IO.File]::ReadAllBytes(...)` and check for `0D 0A 0D 0A` between blocks). Fix with a surgical insert if needed.

### The `Read` tool normalizes display

Some terminal Read tools display curly quotes as straight, hiding the actual file content. Always confirm with byte-level inspection if quote characters matter.

### `.gitignore` and `firebase.json` ignore arrays must mirror for sensitive files

Any file added to `.gitignore` in `Current Version/` must also have a matching entry in `firebase.json`'s `ignore` array (or be already covered by an existing pattern like `**/.*` for dotfiles).

The two systems are independent — `.gitignore` only affects git, `firebase.json` only affects Firebase Hosting deploys. **A file gitignored but not firebase-ignored will be uploaded to the public site.**

Precedents (both are the same shape of bug):
- v1.3.5 (commit `46b3291`) — `PERSONAL.md` would have leaked Firebase login email + admin UID + DNS values; fixed by adding `PERSONAL.md` and `UpdateLog/**` to `firebase.json` ignore.
- v1.3.9 (commit `6167da5`) — `AUDIT_2026-04-30.md` (full internal codebase critique) was uploaded to production by the v1.3.8 deploy; fixed by adding `AUDIT_*.md`.

When creating any new gitignored file in the deploy root, also update `firebase.json` in the same change. Verify post-deploy with a curl check returning 404.

---

## File structure (high-level)

```
Real Anime Reviews/
├── .claude/                 ← Code's local settings (auto-managed)
├── Current Version/         ← THE PROJECT (this is the working dir)
│   ├── CLAUDE.md            ← this file
│   ├── README.md, CHANGELOG.md, ROADMAP.md
│   ├── docs/                ← ARCHITECTURE.md, DEPLOYMENT.md
│   ├── PERSONAL.md          ← gitignored, never commit
│   ├── index.html, account.html, 404.html
│   ├── script.js, account.js, firebase.js, animeData.js
│   ├── style.css, mobile.css
│   ├── firebase.json, .firebaserc
│   └── assets/, UpdateLog/
└── Master List/             ← Anime_Master_Table.xlsx (canonical anime data)
```

Always run `firebase` commands from inside `Current Version/` (it needs `firebase.json` in CWD).

---

## Things Code must NEVER do

- Put credentials, UIDs, or personal email addresses in any committed file. Always reference `PERSONAL.md` by filename only.
- Auto-deploy to production without explicit go-signal.
- Force-push or rewrite git history on `main`.
- Do "code cleanup" without an audit-first framing (Step 3.5 in ROADMAP).
- Rewrite files Blake hasn't asked to be rewritten. Surgical edits remain the default.
- Modify `firebase.json`'s `ignore` array without confirming the security implications. (`PERSONAL.md` and `UpdateLog/**` were added in commit `46b3291` to close a leak window — keep them ignored.)

---

## Version bump checklist

When shipping a new version, every one of these strings updates:

- `index.html` line 8: `window.APP_VERSION="X.Y.Z"`
- `index.html` lines ~24-26: `style.css?v=X.Y.Z` (×2) and `mobile.css?v=X.Y.Z`
- `index.html` line ~169: changelog widget static fallback `<span ...>vX.Y.Z</span>`
- `account.html` line 7: `window.APP_VERSION="X.Y.Z"`
- `account.html` lines ~23-25: `style.css?v=X.Y.Z` (×2) and `mobile.css?v=X.Y.Z`
- `CHANGELOG.md`: new entry at top with `<!-- author: ... -->` marker
- `ROADMAP.md` "Current state" section: `running vX.Y.Z`

The static fallback (line 169) and `APP_VERSION` MUST agree, or the static-vs-runtime mismatch bug from commit `fe0dc4a` will recur.

---

## Energy / fatigue patterns

Blake's energy fluctuates over long sessions. Watch for:

- "What's next?" or "Wait, what were we doing?" — usually a fatigue signal, not a real planning question. Gentle redirect to either "let's stop and rest" or "let me explain it from scratch concisely."
- Step numbers fade fast. Don't rely on "Step 4" as a shared reference — restate the content.
- Late-session approval reviews get faster. Build in extra verification automatically when the session has been long.

---

## When in doubt

Ask before assuming. Blake is collaborative, not directive. He'd rather answer a clarifying question than have Code charge ahead and get it wrong.
