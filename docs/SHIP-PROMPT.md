<!-- author: Cowork | date: 2026-06-02 -->
# v1.6.11 — Gate 7 (commit + push — FAST-TRACK)

Gate 6 audits clean (npm test 7/7, mirror correct, git diff sane). Blake decided to EXCLUDE the 7 Cowork-managed workflow docs from the v1.6.11 commit — they stay in the working tree as unstaged changes. Only v1.6.11's feature work + bump-version fix get committed.

## Files to EXCLUDE from this commit (7 total)

Stage everything via `git add -A`, then unstage these 7:

- `docs/COWORK-STYLE.md` (new untracked)
- `docs/AI-PRIMER.md`
- `docs/CODE-PROMPTS.md`
- `docs/SKILLS/README.md`
- `docs/SKILLS/hotfix-skill.md`
- `docs/SKILLS/release-skill.md`
- `docs/SKILLS/widget-update-skill.md`

Use:
```
git add -A
git restore --staged docs/COWORK-STYLE.md docs/AI-PRIMER.md docs/CODE-PROMPTS.md docs/SKILLS/README.md docs/SKILLS/hotfix-skill.md docs/SKILLS/release-skill.md docs/SKILLS/widget-update-skill.md
```

(`COWORK-STYLE.md` is untracked, so `git restore --staged` un-adds it; the other 6 are modified-tracked, so it unstages the modifications. All 7 stay in the working tree unchanged.)

## What SHOULD end up staged (~21 paths)

13 modified files (CHANGELOG.md, ROADMAP.md, account.html, admin-fab.js, admin/new-anime.html, admin/new-anime.js, docs/HANDOFF.md, docs/NEXT.md, docs/SHIP-OUTPUT.md, docs/SHIP-PROMPT.md, firebase.json, index.html, scripts/bump-version.js, style.css) + 8 new files (firestore.rules, firestore.indexes.json, suggest.html, suggest.js, suggest.css, admin/suggestions.html, admin/suggestions.js, admin/suggestions.css).

Confirm via `git status` after the restore that those 7 excludes show under "Changes not staged for commit" (the 6 modified) + "Untracked files" (COWORK-STYLE.md).

## Author marker

```
Blake Wolters <196413457+joewolters@users.noreply.github.com>
```

**NO `Co-Authored-By: Claude` line. NO `Co-Authored-By: Cowork` line. NO `🤖 Generated with Claude Code` line.**

## Commit message — focused on shipped feature work

```
v1.6.11 — Suggestion Box (visitor /suggest + admin queue)

Visitor recommendations: new /suggest page with search-as-you-type
dropdown (covers + format + year), selection confirmation card,
premium UI throughout. Homepage banner CTA at the bottom of the anime
grid links visitors over. Spam defense via honeypot + 60s sessionStorage
rate-limit.

Admin: new Suggestions Queue at /admin/suggestions accessible from the
floating Admin pill alongside + Add Anime. Per-row Add this anime hands
the existing Mode 1 form the full search payload so admin skips the
typing + Fetch step. Mark reviewed + Delete with smooth dim/collapse
animations. Live stats counter. Skeleton loaders. Polished error state.

Firestore rules extended for the new optional suggestion fields
(deploys globally at this commit — safe widening, admin read still
locked to ADMIN_UID).

bump-version.js: 4 missed static script cache-busters added (22 → 26
targets). All targets agree on v1.6.11.
```

Refine for tone but keep concise — single subject line + paragraphed body.

## Push

```
git push origin main
```

## Verify before stopping

- `git log -1 --format="%an %ae"` → `Blake Wolters 196413457+joewolters@users.noreply.github.com` (no Claude/Cowork in trailer of `git log -1 --format="%B"`)
- `git status` post-push → working tree shows the 7 excluded files still as modifications/untracked (not committed, not lost)
- Capture HEAD commit SHA for the report

## Report shape

Lean. Commit SHA, file count + line totals actually committed (should be ~21 paths, NOT 28), the final commit message body, post-push `git status` confirming the 7 excludes remain in the working tree, push confirmation. One-liner reply. Flag if anything came through differently than expected.
