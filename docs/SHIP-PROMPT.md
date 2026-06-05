<!-- author: Cowork | date: 2026-06-05 -->
# v1.8.3 — Compressed sweep (+2 small welcome fixes — FAST-TRACK, STOP before prod)

G5d passed. Two last Blake items ride this sweep as item 0, then the full cascade. **Do NOT deploy to production — that waits for Blake's explicit "ship it" in chat. He has not said it.**

## 0. Two welcome fixes (Blake, final smoke)
- **(a) Homepage flash before the door.** "Theres a split second where the homepage is seen before the intro page." The double-rAF defer paints home first. Fix so a first-visit-of-session viewer sees the door surface immediately (e.g., a synchronous inline sessionStorage check in `<head>` that sets a gate class pre-paint), with the non-negotiable guard: **no-JS visitors must never be left behind a curtain** (and reduced-motion still instant). Your craft; say what you built.
- **(b) First quote delay.** Let the door sit quiet for **3-5s** before the first bubble fades in (subsequent cadence unchanged).

## The cascade
1. **CHANGELOG.md** — v1.8.3 MINOR. Visitor-facing is the story this ship: the Den-door welcome (banner + quotes, per-session), the restructured homepage (Blake's Den, persistent header), scroll-reveal, redesigned filter (chips/live-narrow/Saved/memory/dedup), live search + sparse centering, card footer accents + row alignment, continue rail, modal provenance line, alcove/tint removals as polish notes, SEO icon/structured-data. Admin: the edit-pill row. Author marker per convention.
2. **Widget** — visitor-first per the skill; this ship is rich in real visitor bullets (door, filter, search, continue rail). No data-provider names. Range chip extends to v1.8.3.
3. **`bump-version 1.8.3`** — expect **40**, `--check` all agree.
4. **ROADMAP.md** — v1.8.3 ✅ shipped (scoped as built incl. the G3-G5d pivots), "Live at v1.8.3", next pointer → **v1.8.4 Discovery & Blend**. NEXT.md already carries Cowork's v1.8.3/v1.8.4 update — verify it reads consistent post-ship and mark v1.8.3 shipped there too.
5. **Audits** — `npm test` (25 floor; +0 expected from item 0 unless you adjust a welcome spec — report), gitignore↔firebase mirror, smart-quote sweep, full `git diff` review (watch for stray junk; `tests/welcomed.js` + `assets/rar_banner.{webp,png}` + Cowork's NEXT.md edit all ride).
6. **Commit + push** — Blake author, zero trailers, 7 Cowork excludes restored out, rolling docs ride in.
7. **Preview deploy** — verify on the channel: APP_VERSION 1.8.3, `assets/rar_banner.webp` 200, `icon-192.png` 200, leak checks 404 (SHIP docs, CODE-HANDOFF, tests/, .env).

Report: the sweep table + preview URL + Blake's preview smoke steps. Then stop and wait — no prod.
