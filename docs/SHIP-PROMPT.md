<!-- author: Cowork | date: 2026-06-04 -->
# v1.7.5 — Gates 4-7 compressed sweep (docs cascade + audits + commit + preview — FAST-TRACK)

Blake approved the full build (gates 1-3e). Run the established compressed sweep. Version → **1.7.5**.

## Gate 4 — docs cascade
1. CHANGELOG.md entry (author marker), covering: secondary-modal Watchlist/Favorite saves + non-catalog schema (`al:` discriminator), account-page rendering + `#secondary=` route + green ✓, per-episode expand + multi-platform watch links, sign-in-modal-on-save + the z-index fix, `__bold__` markdown, platforms backfill (41 rows) + `backfill-platforms.js` CLI, WHERE TO WATCH section.
2. Widget bullets per `widget-update-skill.md` — visitor-first, **no data-provider service names in bullets** (platform names as destinations OK).
3. `node scripts/bump-version.js 1.7.5` then `--check` (expect 33 agree).
4. ROADMAP.md + NEXT.md — mark v1.7.5 scope shipped; the per-episode "full course" + structured-review-template entries already exist, leave them.

## Gate 5 — audits
`npm test` (8) · `.gitignore` ↔ `firebase.json` mirror · `git diff` review · smart-quote sweep with the Grep TOOL (not bash).

## Gate 6 — commit + push
Blake-authored (`Blake Wolters <196413457+joewolters@users.noreply.github.com>`), **no co-author/AI trailers**. Keep the 7 standing Cowork doc excludes out; rolling SHIP-*/HANDOFF docs ride in as usual.

## Gate 7 — preview deploy
Preview channel deploy. **No firestore:rules deploy** — option (a) needed no rule change (re-confirm rules untouched in the diff first). Post-deploy: channel serves `APP_VERSION 1.7.5`, leak checks (`.env` + docs) 404 on the channel.

## Report shape
Standard sweep report: per-gate results, widget bullets as written, bump check, test count, commit hash, preview URL + post-deploy checks. Then Blake's gate-8 preview smoke → his "ship it" → gate 9 prod.
