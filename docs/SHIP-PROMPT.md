<!-- author: Cowork | date: 2026-06-03 -->
# v1.7.3 — Gate 7 (commit + push — FAST-TRACK)

Audits all green (with the sync-serializer fix that caught a ship-blocker). Standard commit + push.

## Steps

1. **Restore-stage the 7 Cowork doc excludes** per convention:
   - `docs/AI-PRIMER.md`
   - `docs/CODE-PROMPTS.md`
   - `docs/COWORK-STYLE.md` (untracked — stays untracked)
   - `docs/SKILLS/README.md`
   - `docs/SKILLS/hotfix-skill.md`
   - `docs/SKILLS/release-skill.md`
   - `docs/SKILLS/widget-update-skill.md` (Cowork edited at gate 4 to remove the 10-cap rule — stays uncommitted per the convention)

2. **Stage everything else** — code (`script.js`, `style.css`, `index.html`, `admin/new-anime.{html,js,css}`, `admin-fab.css`, the new `franchise-fetch.js`, version-bumped HTML files), Excel + animeData (`animeData.js` with the watched-set data now actually serialized), scripts (`mode1-server.js`, `sync-excel-to-js.js`, new `strip-unofficial.js`, new `backfill-watched.js`), CHANGELOG / ROADMAP / NEXT, the rolling trio (`HANDOFF.md` / `SHIP-PROMPT.md` / `SHIP-OUTPUT.md`), `CODE-HANDOFF.md`. Confirm with `git diff --cached --name-only` before commit.

3. **Commit** with:
   - Subject: `v1.7.3: Admin Form Completion + Watched Set + Chatbot Drawer`
   - Body: 3-4 visitor-facing bullets covering the headline scope (watched-set multi-season ✓ REVIEWED pills, official-only platforms, infinite-scroll update log) + 1-2 admin/architecture lines
   - Author: `Blake Wolters <196413457+joewolters@users.noreply.github.com>` via per-commit `--author=`
   - **NO `Co-Authored-By: Claude` / `Co-Authored-By: Cowork` / `🤖 Generated with Claude Code` trailers.** Per `COWORK-STYLE.md` § 9.

4. **Post-commit grep** for forbidden trailers: `git log -1 --format=%B | grep -i -E "co-authored-by|generated with"` → must return nothing.

5. **Push** to `main`.

## Constraints

- If staging surfaces an unexpected file outside the gate 6 diff scope, stop and flag
- If post-commit grep finds a trailer, amend the commit (don't push a bad commit)
- Don't tag the commit

## Report shape

- Confirm the 7 restore-staged files
- Final commit hash + subject
- Post-commit grep result (zero trailers)
- Push confirmation (branch + remote ref)

After gate 7, Cowork stages gate 8 (preview deploy).
