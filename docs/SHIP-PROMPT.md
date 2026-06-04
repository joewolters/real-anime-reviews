<!-- author: Cowork | date: 2026-06-04 -->
# v1.7.4 — Gate 1 (build core: MODAL LAYOUT RESTRUCTURE — APPLY)

Blake approved all 5 gate-0 decisions. Apply gate 1 (layout restructure only — secondary modal is gate 2, per-season is gate 3). No re-propose round. This gate is foundational — gate 2 builds on the new layout.

## Scope this gate (layout only)

### 1.1 — Remove the "Click for More Info" tab

- Drop the tab markup (the collapsible affordance that today expands the More Info panel)
- Drop the tab-click handlers + the slide animation between collapsed/expanded states
- The `<div class="more-info-container">` becomes always-visible (no more collapsed state)
- Drop any `is-open` / `expanded` class machinery for the panel

### 1.2 — Always-render More Info on modal open

- Call `runMoreInfo` immediately when `openModal` fires (not on tab-click)
- Loading state renders immediately if the franchise traversal is mid-fetch (existing v1.7.2 loading skeleton stays)
- Cache hit = instant render (existing v1.7.2 cache path)

### 1.3 — Fixed-px column layout

Per Blake's locked baseline (collapsed/uncollapsed widths — what's visible today before clicking the tab):

- **Main review modal (`sheet--left`):** fixed at **630px**
- **Community Tab (`sheet--right`):** fixed at **394px**
- **More Info panel:** fixed at **380px** (Code's proposal — slightly wider than today's 260px-expanded state to give the franchise tree room)
- **`.modal.duo` max-width:** bump from `1200px` → **~1380px** (accommodates the wider More Info)
- Grid: `grid-template-columns: 380px 630px 394px` (or equivalent flex)
- `gap` stays at 18px

### 1.4 — Responsive behavior

- Below **1100px viewport** → stack to single column (extends today's `@max-width:1000px` stack)
- Single-column order at narrow widths: Main Review → More Info → Community Tab (or your call — propose if you have a stronger order). Desktop-first per Blake's v2-defer, but don't catastrophically break narrow.
- All existing `prefers-reduced-motion` fallbacks preserved

### 1.5 — Cleanup

- Remove now-dead CSS rules for the tab + collapsed state (`.more-info-container.is-collapsed`, `.more-info-tab`, etc. — whatever exists)
- Remove now-dead JS (tab click handler + slide animation)
- Keep all the rest of the More Info rendering machinery intact (franchise tree, episode list, "✓ REVIEWED" pills, etc.)

## What's NOT this gate

- **Secondary modal** = gate 2 (with the LARGE visual treatment per Blake's refinement — accommodating pictures + rich content layout)
- **Per-season review feature** = gate 3 (with BOTH triggers — inline button + dedicated admin panel)
- **Watchlist extension** = v1.7.5 (deferred)
- **Per-episode info** = v1.7.5 (deferred)

## Constraints (standing)

- No new visitor-facing fonts/deps; no version bump (gate 5)
- Premium UI floor — the always-visible More Info should feel intentional, not exposed
- `prefers-reduced-motion` fallback on any new transitions
- `[hidden]` symmetry on any element whose visibility you flip
- Admin UI exempt from no-AniList-in-copy

## Self-verification before declaring done

- `node --check script.js` → OK
- Open `index.html` mentally + trace: modal opens → More Info renders immediately on the LEFT with franchise tree → main review center stays 630px → community tab right stays 394px → no shrink-on-tab-click behavior remaining
- Verify no orphaned references to the removed tab (grep `more-info-tab` / `is-collapsed` / similar) → 0 hits expected
- Confirm visitor sees IDENTICAL primary modal + community widths to today's collapsed-tab state (the un-shrunk state)
- Mobile.css: confirm narrow stack works at common widths (375 / 414 / 768 / 1000 / 1100 / 1280)
- `franchise-fetch.js` untouched (gate 2 adds the sibling query, not this gate)

## Report shape

- Per scope item (1.1-1.5): file + line refs touched, Δ js/css/html
- Confirm modal widths match Blake's locked baseline (630 main / 394 community)
- Confirm stack-below-1100px works
- Flag any phantom-drift or unexpected side effects from removing the tab machinery

After gate 1 lands, Blake smokes the layout change at gate 1b. Then Cowork stages gate 2 (secondary modal architecture with the LARGE visual treatment per Blake's refinement).
