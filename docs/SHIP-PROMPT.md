<!-- author: Cowork | date: 2026-06-08 -->
# v1.9.1 — SHIP IT (hosting-only deploy) — Blake's go-signal GIVEN

> **Blake's go-signal, verbatim, in chat 2026-06-08:** *"its fixed. push it"* (after confirming the review-deep-link halo works on both pages — the last open item). Every v1.9.1 item has passed his smoke.

This is a **hosting-only** deploy — all changes are client-side (composer redesign, season label, deep-link halo, My-review chip, signed-out hide). NO rules, NO functions, NO schema touched. Blake doesn't open a terminal — you run every command.

## Steps (in order)
1. **Pre-flight:** `npm test` green (104 floor). `git status` clean except the v1.9.1 working tree + the rolling docs.
2. **Version:** `node scripts/bump-version.js 1.9.1` → `--check` confirms all targets agree.
3. **Changelog — BOTH artifacts (the cutover-miss prevention):**
   - `CHANGELOG.md` entry, dated 06/08/2026.
   - the homepage update-log **widget `version-section` bullets** per `docs/SKILLS/widget-update-skill.md` — visitor-voiced, Blake's tone, NO provider names, tier label appropriate (minor/polish). Cover what visitors get: the rebuilt **comment/review composer** (formatting toolbar, live preview, keyboard shortcuts), the **"my review" filter**, and the **season label fix**. Do NOT let the bumped chip stand in for the bullets.
4. **Commit:** Blake-authored (`Blake Wolters <196413457+joewolters@users.noreply.github.com>`), zero trailers, the 7 Cowork excludes restored out. Push.
5. **Deploy:** `firebase deploy --only hosting`.
6. **Verify live (report as a table):** `realanimereviews.com` `APP_VERSION === "1.9.1"` · homepage + account 200 · the homepage update-log widget's newest entry reads **v1.9.1** with the real bullets (NOT v1.9.0/v1.8.4) · a quick composer check (the toolbar renders on the live site).

⚠️ If `npm test` or the version `--check` fails, STOP and report — do not deploy a red build. Blake's "push it" covers a clean hosting deploy.

## Report (lean): commit hash · bump confirmation · deploy result · the live-verification table · confirm the widget shows v1.9.1 bullets this time. Then Cowork updates HANDOFF + the artifact.
