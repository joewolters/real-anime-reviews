<!-- author: Cowork | date: 2026-06-03 -->
# v1.7.0 — Gates 6 + 7 + 8 (audits + commit + preview deploy — FAST-TRACK)

Compressed single-sweep audit + commit + preview deploy. No firestore:rules redeploy (schema unchanged since v1.6.11 gate 8).

## Sub-step 1 — Audits (gate 6)

- `npm test` — must report **7/7 passing** before commit. If anything fails, STOP and report; do not commit.
- `firebase.json` ↔ `.gitignore` mirror audit — confirm sensitive entries (PERSONAL.md, AUDIT_*, etc.) in both; deploy-but-don't-commit / commit-but-don't-deploy asymmetric entries are intentional per project rule #8.
- `git diff --stat HEAD` — confirm changes map to v1.7.0 scope: backfill CLI + shared backup lib + sync extension + twin badge CSS/JS + docs cascade + Excel data (animeData.js).

## Sub-step 2 — Commit (gate 7)

- `git add -A`, then `git restore --staged` the 7 Cowork-managed doc excludes (same as v1.6.11 / v1.6.12):
  ```
  docs/COWORK-STYLE.md docs/AI-PRIMER.md docs/CODE-PROMPTS.md
  docs/SKILLS/README.md docs/SKILLS/hotfix-skill.md
  docs/SKILLS/release-skill.md docs/SKILLS/widget-update-skill.md
  ```
  All 7 stay as unstaged modifications + untracked. Blake hasn't ratified them yet.

- Author marker: `Blake Wolters <196413457+joewolters@users.noreply.github.com>` (NO Co-Authored-By / 🤖 / Claude Code / Generated with trailers).

- Commit message:

```
v1.7.0 — AniList enrichment + community-score twin badge

One-time backfill populated AniListId/IdMal/AniListScore/AniListColor/
TitleEnglish/TitleRomaji on the existing 44 reviews (40 matched, 4
skipped) via the new `npm run backfill` CLI. Idempotent, supports
--dry-run and --auto exact-match. Backup hook reused from Mode 1
(extracted to a shared lib/excel-backup.js).

Every anime modal now shows the AniList community score next to Blake's
rating as a twin badge -- RATING (gold) and ANILIST (purple), same
kicker/divider/score structure, hidden when no score is present. The
More Info panel relations chain now resolves by precise Media(id:)
lookup (the v1.6.8 path activates automatically with the backfilled IDs).

bump-version.js: 26 strings swept to v1.7.0.
```

- `git push origin main` — clean fast-forward expected.

## Sub-step 3 — Preview deploy (gate 8)

```
firebase hosting:channel:deploy preview-v1-7-0
```

Capture the channel URL. No `firestore:rules` redeploy this gate.

## Verify before stopping

- `npm test` 7/7
- `git log -1 --format="%an %ae"` shows Blake's canonical author
- `git log -1 --format="%B" | grep -ciE "co-authored-by|🤖|claude code|generated with"` returns 0
- `git status` post-push shows the 7 excludes still in working tree
- Channel URL printed and captured

## Report shape

Lean. New commit SHA, push confirmation, 7-excludes preserved confirmation, preview URL prominently. One-liner reply. Flag if anything came through differently.
