<!-- author: Cowork | date: 2026-06-04 -->
# v1.8.1 — Final fix + compressed sweep (docs cascade + audits + commit + preview — FAST-TRACK)

Blake's 4b smoke: all passed. One cosmetic nit, then the sweep. Version → **1.8.1**.

## 0. Fix-platforms "excluded" line (cosmetic, APPLY first)

`excluded(regional/defunct): Bilibili TV` reads like debug output. Make it premium — e.g. a small amber-tinted note row or kicker-style label ("NOT CARRIED · regional/defunct — Bilibili TV") matching the panel's vocabulary. Your visual call, just not raw parenthetical text.

## Gate: docs cascade
1. **CHANGELOG.md** v1.8.1 MINOR entry — the Admin Edit Page ship: edit page (list + form + tiered Save/Ship + SSE publish chain), inline ✎ on the modal, watched-set tree, live preview overlay (both modals), diff confirm, Revert, branded stepper, scroll-lock fix (4 admin pages), ✨ASK on edit, Fix-from-AniList per-row, origin-aware nav, Mode-1 Playwright spec, `platform-map.js` extraction, new-anime hint.
2. **Widget bullets** — visitor-first. NOTE: this ship is ~entirely admin-facing. Visitors got: nothing user-visible except the ✎ (admin-only) — so either ONE modest bullet ("Behind-the-scenes admin tooling so reviews can be fixed and updated faster") or fold it into the next visitor ship's section — follow `widget-update-skill.md`'s visitor-first judgment, don't pad.
3. `node scripts/bump-version.js 1.8.1` + `--check` (40 expected).
4. **NEXT.md + ROADMAP.md** — v1.8.1 marked shipped (scope as actually built, incl. the G2b/G4 deferrals that landed and the new-anime convergence flag); ladder next = **v1.8.2 structured review template**.

## Gate: audits
`npm test` (12) · `.gitignore` ↔ `firebase.json` mirror (new files: `admin/edit.*`, `admin/chat-drawer.js`, `admin/modal-scroll-lock.js`, `scripts/lib/platform-map.js`, `tests/mode1-server.spec.js` — no secrets, deploy-safe; verify) · `git diff` review · smart-quote sweep (Grep tool) · `firestore.rules` untouched check.

## Gate: commit + push
Blake-authored, zero trailers, 7 Cowork excludes out, rolling docs ride in.

## Gate: preview deploy
Channel deploy. Post-deploy: `APP_VERSION 1.8.1`, `/admin/edit.html` 200 on-channel, leak checks 404 (the 5 standard).

## Report shape
Standard sweep report + the excluded-line restyle description. Then Blake's preview smoke → "ship it" → prod.
