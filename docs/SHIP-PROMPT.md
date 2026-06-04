<!-- author: Cowork | date: 2026-06-04 -->
# v1.7.4 — Gate 6 (commit + push — FAST-TRACK)

Audits all green (gate 5). Standard commit + push.

## Steps

1. **Restore-stage the 7 Cowork doc excludes** per convention:
   - `docs/AI-PRIMER.md`
   - `docs/CODE-PROMPTS.md`
   - `docs/COWORK-STYLE.md` (untracked — stays untracked)
   - `docs/SKILLS/README.md`
   - `docs/SKILLS/hotfix-skill.md`
   - `docs/SKILLS/release-skill.md`
   - `docs/SKILLS/widget-update-skill.md`

2. **Stage everything else** — code (`script.js`, `style.css`, `markdown.js` (new), `franchise-fetch.js`, `suggest.js`, `admin-fab.js`, `admin/new-anime.{html,js,css}`, `admin/season-reviews.{html,js,css}` (new), `season-reviews/index.json` (new), `scripts/mode1-server.js`, `scripts/sync-excel-to-js.js`, `scripts/lib/season-review-index.js` (new), `scripts/bump-version.js`), version-bumped HTML files (`index.html`, `account.html`, `admin/new-anime.html`, `admin/suggestions.html`, `suggest.html`, `admin/season-reviews.html`), CHANGELOG / ROADMAP / NEXT, the rolling trio (`HANDOFF.md` / `SHIP-PROMPT.md` / `SHIP-OUTPUT.md`).

3. **Confirm staging** — `git diff --cached --name-only` should show the expected v1.7.4 set; none of the 7 Cowork excludes should appear.

4. **Commit** with:
   - Subject: `v1.7.4: Modal Architecture Overhaul -- always-visible More Info + Secondary Modal + Per-Season Reviews + Clickable Characters/Staff`
   - Body: 4-5 visitor-facing bullets covering the headline scope (always-visible franchise panel, LARGE in-site secondary modal, per-season reviews, clickable characters + staff, markdown formatting in reviews) + 1-2 admin/architecture lines (shared markdown.js, routing split, `/api/season-review` endpoint)
   - Author: `Blake Wolters <196413457+joewolters@users.noreply.github.com>` via per-commit `--author=`
   - **NO `Co-Authored-By: Claude` / `Co-Authored-By: Cowork` / `🤖 Generated with Claude Code` trailers.** Per `COWORK-STYLE.md` § 9
   - ASCII-safe (em-dashes → `--`)

5. **Post-commit grep** for forbidden trailers: `git log -1 --format=%B | grep -i -E "co-authored-by|generated with"` → must return nothing.

6. **Push** to `main`.

## Constraints

- If staging surfaces an unexpected file outside the gate 5 diff scope, stop and flag
- If post-commit grep finds a trailer, amend the commit (don't push a bad commit)
- Don't tag the commit

## Report shape

- Confirm the 7 restore-staged files
- Final commit hash + subject
- Post-commit grep result (zero trailers)
- Push confirmation (branch + remote ref)
- Optional: refresh `docs/CODE-HANDOFF.md` for the next session (your call — it was flagged at gate 5 as session-close housekeeping)

After gate 6, Cowork stages gate 7 (preview deploy).
