<!-- author: Code | date: 2026-06-03 -->
# v1.7.1 — Gate 1h (3-line romaji wrap + Top 10 portrait expand — DONE ✓, APPLY)

> Pure CSS. Romaji line-clamp 2 → 3 (covers grid cards + Latest Drop via the shared selector); Top 10 glass portrait bumped +24px to fit the 3rd line. `npm test` 7/7, no bump, no JS touched.

---

## Item 1 — Card romaji 3-line wrap
The romaji rule is a single shared selector (`.card .title-romaji, .featured-card .title-romaji`, merged at gate 1g), so one change covers **both** grid cards and the Latest Anime Drop card:
```css
-webkit-line-clamp: 3;   /* was 2 */
```
`line-clamp` is a max, so short romaji (1-2 lines) is unaffected; only the long titles (Angel Next Door, Failure Frame, Project Sekai, Apocalypse Bringer Mynoghra) now use the 3rd line instead of truncating at 2. Modal romaji untouched (it has no clamp — plenty of vertical space).

## Item 2 — Top 10 glass portrait (exact values)
```css
.spotlight-stack         { height: 630px; }                      /* was 606px  (+24) */
.spotlight-stack::before { height: clamp(632px, 68vw, 672px); }  /* was clamp(608px, 66vw, 648px)  (+24 / +2vw) */
```
+24px (~one text line at the romaji's ~0.82em·1.25) so the 3-line case fits comfortably. Same trade-off as gate 1f: subtitle-less cards just get a touch more glass margin (cards center in the frame).

## Item 3 — Other variants
- **Grid cards** auto-size to content, so a 3rd romaji line grows the card height naturally; grid reflow unaffected (the clamp just allows more height, doesn't force it).
- **Latest Drop** (`.featured-card`) also auto-sizes its flex-column container — the extra line grows it; no fixed height to bump there.
- **Modal** — no clamp, no change.

## Verify
- `grep -webkit-line-clamp: 3` → **1 hit** (the romaji rule)
- `grep -webkit-line-clamp: 2` → 2 hits, **both non-romaji** (a "compact rows (2 lines max)" block at :3328 and `.activity-desc` at :3983) — so **0 in romaji context** ✓
- Portrait heights: `.spotlight-stack` 630px + `::before` `clamp(632px, 68vw, 672px)` present
- `bump-version.js --check` → all 26 agree on **v1.7.0** (no bump)
- `npm test` → **7 passed (11.6s)**
- No JS touched (pure CSS) → no `node --check` needed

## Note on "confirm 3-line wrap"
The CSS now *permits* up to 3 lines (`-webkit-line-clamp: 3`) and the portrait was sized for the 3-line height — but whether Angel Next Door / Failure Frame actually render on the 3rd line vs. still fitting in 2 is a render-time/viewport judgment that's Blake's smoke to confirm. The mechanism is in place; nothing caps them at 2 anymore.

## One-liner reply
v1.7.1 gate-1h done (APPLY, pure CSS): bumped the card romaji `-webkit-line-clamp` from 2 → 3 on the shared `.card .title-romaji, .featured-card .title-romaji` rule so the longest romaji titles (Angel Next Door, Failure Frame, Project Sekai, Apocalypse Bringer Mynoghra) get a 3rd line instead of truncating — covers both grid cards and the Latest Drop card in one change, and short titles are unaffected since clamp is a max; expanded the Top 10 glass portrait by +24px to fit it — `.spotlight-stack` 606px → **630px** and `::before` `clamp(608px,66vw,648px)` → **`clamp(632px,68vw,672px)`** (same center-in-frame trade-off as gate 1f); grid + Latest-Drop containers auto-size so they grow naturally, modal has no clamp so it's untouched; verified — `line-clamp: 3` present (1), the only remaining `line-clamp: 2` are non-romaji (`.activity-desc` + a compact-rows block), 26 strings still agree on v1.7.0, `npm test` 7/7, no JS touched; the 3-line mechanism is in place — actual render on the 3rd line is Blake's smoke to confirm; if clean, v1.7.1 build is DONE → gate 5 docs cascade.
