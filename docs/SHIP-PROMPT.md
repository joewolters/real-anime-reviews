<!-- author: Cowork | date: 2026-06-04 -->
# v1.8.2 — Compressed sweep (docs cascade → audits → commit → preview — FAST-TRACK, STOP before prod)

G3c re-smoke passed clean. Bundle G1+G2+G3b+G3c and run the sweep. **Do NOT deploy to production — that waits for Blake's explicit "ship it" in chat. He has not said it.**

1. **CHANGELOG.md** — v1.8.2 MINOR. Visitor-facing is real this time: structured scannable reviews (section pill rail + scroll-spy, gold Overall, JP labels), the restored frosted backdrops, the fixed secondary header row. Then the admin side: section-aware editor across all three surfaces (drag reorder, shortcuts, premium edit-page polish). Author marker per convention.
2. **Widget** — visitor-first per the skill. No data-provider names. The pill-rail/scannable-sections feature is a genuine visitor bullet; frost + header row likely fold in. Your judgment.
3. **`bump-version 1.8.2`** — expect **40**, then `--check` all agree.
4. **NEXT.md + ROADMAP.md** — v1.8.2 ✅ shipped (scoped as actually built incl. the editor pivot + G3c fixes), next pointer → v1.8.3 Website Identity & Finalization. Carry the flagged dead `.md-toolbar` CSS cleanup as a small backlog line.
5. **Audits** — `npm test` (14), gitignore↔firebase mirror, smart-quote sweep, `git diff` review.
6. **Commit + push** — Blake author, zero trailers, 7 Cowork excludes out, rolling docs ride in.
7. **Preview deploy** — verify on the channel: APP_VERSION 1.8.2, new assets 200 (`admin/section-editor.{js,css}`), leak checks 404.

Report: the usual sweep table + the preview URL + Blake's preview smoke steps. Then stop and wait.
