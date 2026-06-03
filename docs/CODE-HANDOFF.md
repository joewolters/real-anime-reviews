<!-- author: Code | date: 2026-06-02 -->
<!-- AUDIENCE: This file is FOR CODE (another Claude Code instance picking up work). -->
<!-- NOT for Cowork — Cowork reads docs/HANDOFF.md and writes docs/SHIP-PROMPT.md. -->

# Code → Code Handoff

> Quick-onboarding doc so a fresh Code session can pick up where the previous Code left off without re-deriving the workflow from scratch. Read this first, then `docs/SHIP-PROMPT.md` for the current gate prompt, then `docs/SHIP-OUTPUT.md` for the previous Code's last report.

---

## Right now (snapshot)

**v1.6.11 just hit production at gate 10** (commit `5a5ab9b`, deployed 2026-06-02 21:06:50). Awaiting **gate 11 — Blake's production verify**. Blake's task, not Code's.

**Current ship in flight:** v1.6.11 (Suggestion Box + admin viewer). 11 of 12 gates done. After gate 11 clean: ship complete, next ship is v1.7.0 (AniList backfill + MAL integration).

**Live URL:** https://realanimereviews.com (aliased to https://real-anime-reviews.web.app).

---

## The trio of rolling docs

| File | Author | Purpose |
|---|---|---|
| `docs/SHIP-PROMPT.md` | Cowork writes, Code reads | The current gate's instructions. Cowork overwrites it per gate. |
| `docs/SHIP-OUTPUT.md` | Code writes, Cowork reads | Code's report after each gate. Cowork digests + summarizes to Blake. **Code overwrites it per gate** (no append). |
| `docs/HANDOFF.md` | Cowork writes | Cowork's persistent session state — the "where are we" doc Cowork updates between sessions. **Code reads but doesn't write** this one. |

All three are `firebase.json`-ignored via `docs/SHIP-*.md` glob + explicit `docs/HANDOFF.md` entry. They get committed (committed into git for history traceability) but never deployed to the public CDN.

This file (`docs/CODE-HANDOFF.md`) is **Code-to-Code only** — not in the rolling trio. Doesn't need updating per gate.

---

## The 12-gate ship structure (effective v1.6.11+)

```
0  Recon + propose plan                          [Code → Blake approves]  PROPOSE-FIRST
1  Build core feature                            [Code → Blake approves]  PROPOSE-FIRST
2  Build supporting features                     [Code → Blake approves]  PROPOSE-FIRST
3  Reserved for iteration / fixes                [Code → Blake approves]  PROPOSE-FIRST
4  Local browser smoke                           [Blake]                  —
5  Docs cascade (CHANGELOG + widget + bump + NEXT + ROADMAP)  [Code]      FAST-TRACK
6  Audits (npm test 7/7 + mirror + git diff)     [Code]                   FAST-TRACK
7  Commit + push                                 [Code]                   FAST-TRACK
8  Preview deploy (hosting:channel + rules)      [Code]                   FAST-TRACK
9  Preview smoke                                 [Blake]                  —
10 Production deploy (hosting + rules if dirty)  [Code, on "ship it"]     FAST-TRACK
11 Production verify                             [Blake]                  —
```

**Sub-gates `1b` / `2b` / `3b` / `3c` / `3d`...** reserved for iteration. Used freely when Blake's smoke surfaces a bug or design tweak. Pattern: `gate 3` → `gate 3b apply` → smoke → `gate 3c propose` → `gate 3c apply` → repeat until clean.

**Non-mergeable boundaries** — gates 6/7/8/9/10/11 are separate pauses, not a single sweep. If audits fail at gate 6, nothing has been committed yet → fix code, retry audit. Never half-state.

---

## PROPOSE-FIRST vs FAST-TRACK — the tier difference

- **PROPOSE-FIRST gates** (0, 1, 2, 3 + sub-gates): write the full proposal to `docs/SHIP-OUTPUT.md`, do NOT apply, wait for Blake's explicit approval via the next Cowork prompt. Cowork writes a `gate-Xb-apply` prompt after Blake approves; THAT prompt is when Code applies.

- **FAST-TRACK gates** (5, 6, 7, 8, 10): execute the prompt's spec directly, no proposal step. Report in `docs/SHIP-OUTPUT.md` after applying. Trust Code's accumulated discipline.

- **Blake-owned gates** (4, 9, 11): browser-only, Blake handles. Code waits.

---

## Code's mannerisms (the patterns that work)

### Every gate report has the same shape

In `docs/SHIP-OUTPUT.md`:

1. Author marker `<!-- author: Code | date: YYYY-MM-DD -->` on top
2. Title: `# vX.Y.Z — Gate N (description — STATUS, TIER)`
3. Blockquote summary one paragraph
4. Numbered sections: files written + line counts, decisions baked-in checklist, verification, stop-condition audit, state-for-next-gate, one-liner reply at the bottom
5. **One-liner reply at the end** — a long single-sentence summary, semicolon-separated. Cowork uses it as the digest line for Blake.

### Chat replies stay terse

After writing the full report to `docs/SHIP-OUTPUT.md`, the chat reply to Blake is 2-4 sentences max. Blake reads via Cowork, not chat. Don't duplicate the doc in chat — Blake corrected an earlier Code for doing exactly that ("you need to write all of this in a DOC for cowork to read through and then cowork reports to ME").

### Stop-condition audit in every gate report

Every gate prompt lists "Stop conditions" — Code's report has a `## Stop-condition audit` section enumerating each one with ✓ / 🟡 / ❌ status. This is where Code defends against silent scope creep.

### Surface anomalies, don't silently fix

If recon finds something outside the gate's explicit scope (e.g. a CSS bug in adjacent code, a pre-existing TARGETS gap), **flag it in the report, don't fix it unilaterally**. Let Cowork decide whether to scope a `gate Xb` for it. v1.6.10 gate 2 was a hard lesson — Code's "obvious" scope addition broke prod-class AniList queries, required a full revert.

### Drift-from-proposal notes

When the actual apply ends up with more lines than the proposal estimated, **flag it explicitly** with the reason (e.g. "comment block expanded for clarity", "fuller reduced-motion coverage", "Cowork additions added more CSS than estimated"). Don't hide it. Blake / Cowork care about scope creep signals.

---

## Commit discipline (CRITICAL — easy to get wrong)

### Author marker

```
Blake Wolters <196413457+joewolters@users.noreply.github.com>
```

Set via `git commit --author="Blake Wolters <196413457+joewolters@users.noreply.github.com>"`.

**NEVER** modify `git config user.name` / `user.email`. Per-commit `--author=` flag only.

The numeric `196413457` is Blake's stable GitHub user ID (doesn't change on rename — the username portion was updated when the account renamed from `ReaIGodzilla` → `joewolters` in v1.4.2).

### Forbidden trailers (ZERO of these)

- `Co-Authored-By: Claude ...`
- `Co-Authored-By: Cowork ...`
- `🤖 Generated with Claude Code`
- `Generated with ...`

**Don't add these. Don't let the harness auto-add them.** Use a heredoc for the commit message so you control every byte:

```bash
git commit --author="Blake Wolters <196413457+joewolters@users.noreply.github.com>" -m "$(cat <<'EOF'
Subject line ≤70 chars

Body paragraph(s), ASCII-safe (em-dashes → --, arrows → ->).
EOF
)"
```

Verify after every commit:
```bash
git log -1 --format="%an %ae"
# Should be: Blake Wolters 196413457+joewolters@users.noreply.github.com

git log -1 --format="%B" | grep -ciE "co-authored-by|🤖|claude code|generated with"
# Should be: 0
```

### Excludes — Cowork-managed workflow docs stay uncommitted

These 7 files have been intentionally **excluded** from v1.6.11 commits per Blake's gate-7 decision. They remain in the working tree as unstaged modifications:

- `docs/COWORK-STYLE.md` (untracked)
- `docs/AI-PRIMER.md` (modified)
- `docs/CODE-PROMPTS.md` (modified)
- `docs/SKILLS/README.md` (modified)
- `docs/SKILLS/hotfix-skill.md` (modified)
- `docs/SKILLS/release-skill.md` (modified)
- `docs/SKILLS/widget-update-skill.md` (modified)

**If Code stages `git add -A` and commits, it'll sweep these in. To exclude:**

```bash
git add -A
git restore --staged docs/COWORK-STYLE.md docs/AI-PRIMER.md docs/CODE-PROMPTS.md docs/SKILLS/README.md docs/SKILLS/hotfix-skill.md docs/SKILLS/release-skill.md docs/SKILLS/widget-update-skill.md
```

Or stage explicit files instead of `-A`. Confirm via `git status` that these 7 appear under "Changes not staged" / "Untracked" before committing.

---

## Project-specific gotchas

Read `CLAUDE.md` for the full list. The high-value ones a fresh Code session will hit:

1. **PowerShell `Get-Content` defaults to ANSI display** — UTF-8 multi-byte chars (em-dashes, arrows, emoji) look like mojibake on screen. File is fine on disk. Use the `Read` tool (not Bash + Get-Content) when byte fidelity matters.
2. **Edit tool can silently convert ASCII `"` to curly `"` `"` in HTML attributes** — breaks CSS class matching. After every HTML edit, grep for stray smart quotes in attributes.
3. **`.gitignore` ↔ `firebase.json` mirror discipline** — sensitive files (`PERSONAL.md`, `AUDIT_*.md`, `.env`) must be in BOTH. Build/tooling artifacts can be `firebase.json`-ignore-only (committed to repo but don't deploy). Rule #8 in `CLAUDE.md`.
4. **`bump-version.js` has TARGETS for cache-busters** — when adding a new HTML file with `<script src="...?v=X">` or `<link href="...?v=X">`, register those URLs as TARGETS so version bumps sweep them. Otherwise they go stale on future ships. Gate 5b of v1.6.11 was a one-gate fix for this exact bug.
5. **AniList query complexity has a budget** — nested-relations mega-queries fail on relation-heavy Media (Demon Slayer-class). v1.6.10 gate 2 got reverted for this. Use Demon Slayer's id as the canary when testing new AniList query shapes.

---

## Blake's working style

- Self-described "very basic" coder. **Never assume he knows terms / project structure / terminal commands unless they've been explained in the session.** Step-by-step guidance: which file, which line, what to replace, what the change does.
- "Show, don't do" — every meaningful change: show plan, show diff, pause for approval, verify after writing, only then stage/commit. (Non-negotiable; see `CLAUDE.md`.)
- Surgical edits over rewrites. Honest "I'm not sure" over fabricated content. Verify-before-destructive (one cheap diff/check before any delete).
- Energy fluctuates over long sessions. "What's next?" / "Wait, what were we doing?" is usually a fatigue signal, not a real planning question.
- Direct feedback. If something looks wrong, he says so — quote his words in the report when surfacing the bug for the next iteration.

---

## The rolling-docs trio + the 7 excludes — what's where right now

```
docs/SHIP-PROMPT.md     ← gate-10 prompt (last gate to fire); the next Cowork prompt
                          will be either gate 11 (Blake's verify, no Code action)
                          or gate 10b (if prod has an issue Blake surfaces)
docs/SHIP-OUTPUT.md     ← Code's gate-10 report (production deploy clean,
                          v1.6.11 live at 21:06:50)
docs/HANDOFF.md         ← Cowork-managed. Currently shows v1.6.10 shipped /
                          v1.6.11 gate 1b done — STALE. Cowork will refresh
                          when the v1.6.11 ship closes.
docs/CODE-HANDOFF.md    ← THIS FILE. Code-to-Code only.
```

The 7 Cowork-managed excludes (see Commit discipline § above) all sit in the working tree right now. New Code shouldn't touch them.

---

## What a fresh Code session should do first

1. **Read `CLAUDE.md`** — the project's permanent operating rules.
2. **Read `docs/HANDOFF.md`** — Cowork's high-level state.
3. **Read `docs/CODE-HANDOFF.md`** (this file) — Code-to-Code mannerisms.
4. **Read `docs/SHIP-PROMPT.md`** — the current gate's instructions.
5. **Read `docs/SHIP-OUTPUT.md`** — previous Code's last report (for context on what just happened).
6. **Continue from the current gate.** If the prompt says PROPOSE-FIRST, propose. If FAST-TRACK, execute + report.

If the prompt header says `gate 11` or `gate 4` or `gate 9`, those are Blake's — Code waits. The next Code-action prompt will be either an iteration sub-gate (e.g. `3h`, `10b`) or the next ship's `gate 0`.

---

## A few hard-won patterns from v1.6.11

- **Visitor-facing copy NEVER mentions third-party brand names** when the gate prompt says so (gate 3e-apply §22 set this for the Suggestion Box). Class names + DOM IDs + console logs are fine — only what visitors SEE. Always run a `grep -i "anilist" suggest.html suggest.css suggest.js` audit after CSS/HTML edits.

- **`hidden` attribute is overridden by author CSS `display: <non-none>`** (gate 3g root cause). When you set `display: flex` / `block` / etc. on a class, ALSO add `.classname[hidden] { display: none; }` for symmetry. The browser's UA `[hidden] { display: none }` and author `.classname { display: flex }` have the same specificity → author wins on cascade order → `element.hidden = true` becomes a no-op visually.

- **CSS `animation: ...` doesn't reliably replay on `hidden` toggle** (gate 3f root cause). Use `transition: ...` properties + `is-entering` / `is-leaving` state classes + `transitionend`-coordinated JS using the double-rAF pattern (`requestAnimationFrame(() => requestAnimationFrame(() => removeStateClass))`). Single rAF batches both into the same frame and the transition skips.

- **AbortController on in-flight fetches** when doing debounced search-as-you-type. Without it, fast typists see out-of-order results overwrite newer ones if network resolves out of order.

- **The `:has(#status.success)` selector** is a clean way to drive CSS state changes from JS-set classes (gate 3e success-morph). When `suggest.js` is off-limits (gate constraint), `:has()` keeps the morph pure CSS.

---

## Cadence reminder

Don't sleep / poll / proactively check on long-running tasks. The harness re-invokes when work finishes. If you must wait for an external state change (CI run, deploy), use a Bash `run_in_background` so the harness notifies on completion.

When running multiple independent commands (lint + test + grep), batch them into a single Bash with `&&` or run multiple Bash tool calls in parallel — don't sequence what doesn't need sequencing.

---

## One-liner state summary (paste-ready for context)

v1.6.11 (Suggestion Box + admin viewer) is live in prod as of 2026-06-02 21:06:50 via commit `5a5ab9b`; awaiting Blake's gate-11 production verify; the 12-gate ship structure (PROPOSE-FIRST for build gates 0-3, FAST-TRACK for cascade/audit/commit/deploy gates 5-10, Blake-owned smoke gates 4/9/11) is the working pattern; rolling-docs trio (`docs/SHIP-PROMPT.md` Cowork-writes-Code-reads, `docs/SHIP-OUTPUT.md` Code-writes-Cowork-reads, `docs/HANDOFF.md` Cowork-owned) is where the per-gate handoff happens; 7 Cowork-managed workflow docs stay excluded from every commit Code makes via `git add -A` + `git restore --staged ...`; commit author always Blake Wolters with the canonical email via per-commit `--author=` flag (NEVER `git config`), ZERO forbidden trailers (`Co-Authored-By` / `🤖` / `Claude Code` / `Generated with`), enforced via post-commit grep; next ship after gate 11 closes will be v1.7.0 (AniList backfill + MAL integration, ~3 hours, foundation for v1.7.1's multi-fetch architecture that unblocks the v1.6.10-deferred multi-hop + episode aggregation).
