<!-- author: Cowork | date: 2026-06-03 -->
# v1.7.2 — Gate 7 (widget bullet 2 + commit + push — FAST-TRACK)

Blake's "b is fine but also keep pushing through" greenlit fixing pre-existing AniList bullets categorically. Apply the second bullet, then run the standard commit + push.

## Pre-step — second widget bullet tidy

`index.html:198` (the 05/13 v1.6.8 bullet) → reword `"...each linking to its full AniList page."` → `"...each linking to its full info page."` (per your gate 6 recommendation). One-line edit, no test impact.

After the edit, re-run the smart-quote check on `index.html` only and confirm `<li>` count is still 10 (no accidental structural change).

## Commit + push

1. **Restore-stage the 7 Cowork doc excludes** per the established convention:
   - `docs/AI-PRIMER.md`
   - `docs/CODE-PROMPTS.md`
   - `docs/COWORK-STYLE.md` (untracked — stays untracked)
   - `docs/SKILLS/README.md`
   - `docs/SKILLS/hotfix-skill.md`
   - `docs/SKILLS/release-skill.md`
   - `docs/SKILLS/widget-update-skill.md`

2. **Stage everything else** — code (`script.js`, `style.css`, `index.html`, version-bumped HTML files), CHANGELOG, ROADMAP, NEXT, the rolling trio (`HANDOFF.md` / `SHIP-PROMPT.md` / `SHIP-OUTPUT.md`), `CODE-HANDOFF.md`. Confirm with `git diff --cached --name-only` before commit.

3. **Commit** with:
   - Subject: `v1.7.2: More Info panel overhaul — multi-fetch architecture, multi-hop traversal, UX redesign`
   - Body: brief summary of the visitor-facing scope (3-4 bullets max — match prior ship-commit style)
   - Author: `Blake Wolters <196413457+joewolters@users.noreply.github.com>` (use `--author=` per memory `feedback_no_anilist_in_visitor_ui` adjacent — the Blake commit-author convention)
   - **NO `Co-Authored-By: Claude` / `Co-Authored-By: Cowork` / `🤖 Generated with Claude Code` trailers.** Per `COWORK-STYLE.md` § 9 — this has bitten before.

4. **Post-commit grep** to confirm zero forbidden trailers: `git log -1 --format=%B | grep -i -E "co-authored-by|generated with"` → must return nothing.

5. **Push** to `main`.

## Constraints

- If staging surfaces an unexpected file outside the gate 6 diff scope, **stop and flag**.
- If the post-commit grep finds a trailer, amend the commit (don't push the bad commit).
- Don't tag the commit (tags are out of the gate-7 spec here).

## Report shape

- Confirm bullet tidy + smart-quote/`<li>`=10 verify
- The 7 restore-staged files
- Final commit hash + subject
- Post-commit grep result (zero trailers)
- Push confirmation (branch + remote ref)

After gate 7, Cowork stages gate 8 (preview deploy).
