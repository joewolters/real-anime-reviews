<!-- author: Cowork | date: 2026-06-05 -->
# v1.8.4 — Gate 1 (AniList data layer — APPLY)

Gate-0 design study approved. Blake's picks, all locked:

- **Labels:** For You / Discover (+ your JP kicker accents). He understands what each surface does.
- **Home:** "Heart first" — Den masthead leads, the Airing-Now strip fills the hole below it.
- **Background:** **Direction 2 — "Constellation hush"** (NOT 1). One clarification from Blake, confirmed: **the Call of the Night city backdrop STAYS** — the constellation layer is a translucent veil OVER it (dense/dark in the Den, the city gradually revealing as the stars thin toward Discover). Per-surface contextual reveal, crossfade on glide, as you proposed.
- **All defaults taken:** airing cache 12h · "Popular right now" copy · 3-way filter (All / Reviewed / Not yet) · pitches IN: "Blake reviewed this" pin, newly-reviewed shimmer, "N people requested" count, background-as-wayfinding.
- **Your gate order stands:** G1 data → G2 cards+filter → G3 Discover → G4 For You → G5 nav+home → G6 background → G7 polish (G8 quotes-admin only if the ship stays light) → sweep. One ship; take your time on testing.

## Apply now (G1 scope, per your gate-0 plan)

1. `franchise-fetch.js` — the 3 flat queries (SEARCH / TRENDING / AIRING with optional genre), additive, exported on `window` + `module.exports`.
2. Caches — clone the L2 pattern: `rar:trending:` 24h · `rar:airing:` **12h** · search short/session with AbortController.
3. Canary tests against 101922 (search "demon slayer" → 101922; trending/airing no-500) + a Node harness + Playwright spec.
4. No UI this gate.

Report: Δ per file, canary results, cache key shapes, anything that diverged. Then Blake says continue and G2 starts.
