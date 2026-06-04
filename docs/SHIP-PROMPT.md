<!-- author: Cowork | date: 2026-06-04 -->
# v1.7.6 — Gate 1 (build: all 5 nags — APPLY)

Blake approved gate 0. Locked decisions:

1. **Routing:** your recommendation — primary ids upgrade to the main modal in the `#secondary=` hash handler (~10 lines, mirrors `renderRecommendations`); watched-not-primary saves STAY on the secondary (per-season review is right there).
2. **Staff roles:** add BOTH `Series Director` (after Director) + `Sound Director` (after Music). Cap stays 6.
3. **Favicon:** Blake made art — **`assets/favicon.png`** (1254×1254 RGB PNG, ~1.6MB: white "R" on brand-purple smoke, rounded square). Use it as the SOURCE. Do NOT serve the 1.6MB original as the icon:
   - Generate downscaled rasters (your call on the exact set — typical: 32×32 + 180×180 apple-touch-icon + a ~512 for manifest-grade; `favicon.ico` if cheap)
   - `<link>` tags in the heads of `index.html`, `account.html`, `suggest.html`, `404.html`, the 3 admin pages
   - Verify the new files deploy (not gitignored/firebase-ignored) and the original source stays in `assets/`
   - Visual check: the R should stay legible at 16-32px — if the smoke texture muddies it when downscaled, flag it with a rendered sample for Blake rather than shipping mud

## Also apply (from gate 0, no changes)

4. **Title/format-pill overlap** — the CSS `padding-right` reservation on the ALSO LIKED card titles (confirm the exact title class as you noted).
5. **Season-header polish** — CSS on the existing `.more-info-season > summary`. Include a screenshot-able description in the report; Blake eyeballs at smoke.

## Constraints

Standing set. No render-path/animation/blur changes (v1.8.0 confound guard). `bump-version` stays 33.

## Report shape

Per item: what changed, Δ per file, the favicon size set you chose + legibility verdict, verification (`node --check`, CSS balance, `npm test` 8). Plain-language smoke list for Blake's gate 2 (what to click + what the tab should show). Then docs cascade (incl. the ROADMAP.md stale-section restructure you noted) + audits + commit + preview as the usual compressed sweep.
