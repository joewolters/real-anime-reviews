<!-- author: Code | date: 2026-06-04 -->
# v1.7.6 — Gate 0 (recon + propose: quick nags ship — PROPOSE-FIRST ✓)

> Reconned all 5 nag items with file:line evidence. All 5 fit the PATCH scope — **none are render-path-heavy, so none need to move to v1.8.0** (item 1 is ~10 lines of routing wiring; 2 & 4 are CSS-only; 3 is a 1-line array; 5 is a new asset + `<link>` tags). Key recon win: `renderRecommendations` **already implements** the primary→main-modal / watched→secondary routing split (script.js:1181), so the account fix just mirrors it in the `#secondary=` hash handler — and I traced the actual collision source (the "currently viewing source row" opens the secondary for a **primary** id, so saving there creates an `al:<primaryId>` save). Nothing applied. 2 open questions for Blake (the watched-not-primary routing call + the favicon asset).

---

## Item 1 — Account saved-entry routing fix

### Recon (verified)
- `account.js:560` routes **every** anilist save to `index.html#secondary=<aniListId>`.
- The `#secondary=` hash handler (`script.js` router) calls `openSecondaryModal(id, null, null)` unconditionally.
- `primarySlugForAniListId(id)` (`script.js:778`) + `isWatchedAniListId(id)` (`:784`) live **inside the script.js IIFE** — **NOT reachable from `account.js`** (separate module; account loads `animeData.js`/`card-render.js`/`franchise-fetch.js` but not these helpers). So the routing decision must live in the hash handler, not account.js.
- **The collision source (traced, not assumed):** the secondary modal only opens for non-primary ids *except* the **"currently viewing source row"** — clicking the source row in the More Info panel opens the secondary for the **source = primary** id. Saving from there writes `al:<primaryId>`. On the account page that row routes `#secondary=<primaryId>` → secondary modal, when Blake expects the **main franchise modal with his review**. That's exactly his gate-8 flag.
- **Precedent:** `renderRecommendations` (`script.js:1178-1184`) already does the correct three-way split — `primarySlugForAniListId` → main modal (catalog-slug); watched-not-primary → secondary; non-watched → secondary. The fix is to make the account route obey the same table.

### Proposed fix
In the `#secondary=<aniListId>` hash handler, **before** `openSecondaryModal`:
```js
const slug = (typeof primarySlugForAniListId === 'function') ? primarySlugForAniListId(aniListId) : null;
if (slug) {
  const entry = list.find(a => makeId(a.Title) === slug);  // reuse the existing #open= resolver
  if (entry) { showAll(); openModal(entry); /* normalize hash */ return; }
}
openSecondaryModal(aniListId, null, null);   // watched-not-primary + non-catalog (unchanged)
```
account.js stays as-is (keeps passing `#secondary=<id>`; the handler upgrades primary ids to the main modal). Mirrors v1.7.4 routing exactly.
- **Δ:** `script.js` ~+10 (hash handler). `account.js` 0.

### ⚠️ Open question for Blake (the gate flagged this — "confirm the routing table")
**Watched-not-primary ids** (e.g. you saved Demon Slayer S2, which is reviewed via the franchise but isn't the primary slug): per the v1.7.4 site-wide split these open the **secondary modal**, which DOES show the gold "BLAKE'S REVIEW" per-season section. **My recommendation: keep them on the secondary** (consistent with the rest of the site + the review is right there). The fix above only redirects **primary** ids to the main modal. Confirm — or, if Blake wants *any* reviewed-franchise save to open the main modal, that's a different table (`isWatchedAniListId` → main modal) and I'd need a way to resolve a watched-not-primary id back to its franchise's primary slug (a new reverse map).

## Item 2 — Title / format-pill overlap (ALSO LIKED, Mononoke)

### Recon (verified)
- `.more-info-rec-format-badge` (`style.css:3087`) is `position: absolute; top:6px; right:6px`.
- The spine + group rows override it inline with `position: static` (`script.js:855`, `:1112`) so it flows inline — **but `renderRecommendations` (`:1177`) uses it WITHOUT the override**, so in ALSO LIKED cards the badge is absolute top-right and a short title wraps **under** it. A wide `MOVIE` badge (Mononoke) overlaps more than a `TV` badge → Blake's flag.

### Proposed fix
CSS-only — reserve horizontal space in the ALSO LIKED card title so it never wraps into the badge zone: add `padding-right` (≈ badge width + gap) to the rec card's title element when an absolute badge is present (scope it to the rec/`.more-info-entry` title, not the spine rows which are already static). Confirm the exact title class at gate 1 (`.more-info-rec-title` per the `:1108` comment, vs the entry-title). No JS, no render-path change.
- **Δ:** `style.css` ~+2.

## Item 3 — Staff role whitelist expansion

### Recon (verified)
- `renderStaffCredits` WHITELIST (`script.js:1215`) = `['Director', 'Series Composition', 'Music', 'Character Design']` (the **4-role** More Info panel list). The relevance-ranked fallback fills to 6 (v1.6.10). (The *secondary* modal's `pickKeyStaff` at `:4876` already has 6 — this item is only the panel's 4.)

### Proposed fix
Add `'Sound Director'` and/or `'Series Director'` to the array (order = display priority — I'd slot `Series Director` after `Director`, `Sound Director` after `Music`). Pure data change; the fallback still tops up to 6.
- **Δ:** `script.js` +1 (array). **Open: 1 or 2 roles?** I lean both (still capped at 6, fallback absorbs it).

## Item 4 — Season-header styling (More Info panel)

### Recon (verified)
- The season header is the `<summary>` of `.more-info-season` (`script.js:1020`); it already has a **dedicated** rule (`.more-info-season > summary` at `style.css:3163` — padding-left + a ▶ caret that rotates on `[open]`, reduced-motion-guarded at `:3212`). It does NOT reuse `.more-info-relation`.
- So the "deferred cosmetic" is just **visual polish on the existing dedicated class**, not a reuse-vs-dedicated decision (the dedicated class already exists — minor phantom in the gate framing).

### Proposed fix
Enhance `.more-info-season > summary` (kicker-style label / subtle accent bar / weight) to make the season headers read as distinct section dividers. CSS-only on the existing class; no new structure.
- **Δ:** `style.css` ~+4-6. (Recommend Blake eyeballs a screenshot at gate 1 — "distinct" is subjective.)

## Item 5 — Favicon + Apple touch icons

### Recon (verified)
- **No favicon at all** — `index.html` has zero `icon`/`apple-touch-icon`/`manifest` links (grep empty). Browsers show the default globe.
- Brand assets present: `assets/preview.jpg` (wide social OG image, not icon-suitable) + `assets/instagram-icon.png` (the IG glyph, not the site brand). **No logo / square mark exists.**

### Proposed approach
- **Default I can ship without new art:** hand-author a **`favicon.svg`** — a brand monogram ("RAR" or a stylized "R") on the Call-of-the-Night brand-purple, vector (no image lib needed), crisp at every size. Modern browsers use it directly. Add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` to `index.html` + `account.html` + `suggest.html` + the admin pages' heads.
- **Raster fallbacks** (apple-touch-icon 180×180 PNG, `favicon.ico` for legacy) need a real raster — either Blake supplies/approves a PNG, or I generate from the SVG with a one-off tool at gate 1.
- **New deploy-root files** → no secret, they DEPLOY; verify they're NOT gitignored (they shouldn't be). No `firebase.json` change needed.

### ⚠️ Open question for Blake (the gate flagged this)
Favicon art: **(a)** I author the SVG monogram now (brand-purple "R/RAR"), raster fallbacks generated from it; **(b)** you supply a custom icon/mascot; or **(c)** ship the SVG monogram now as a placeholder and swap for the **v1.8.3 identity art** (the "anime characters visible on the page" work) when it lands. I lean **(c)** — a clean monogram now (no globe), real character art later.

## Anything that should move to v1.8.0?
**Nothing.** All 5 are wiring/CSS/data/asset — explicitly NOT render-path or animation/blur changes, so they won't confound the v1.8.0 perf before/after (per the constraint). Item 1 is the only JS-logic touch and it's pure routing.

## Note for the docs cascade (gate 4)
Per the gate: ROADMAP.md's **stale per-version sections** (old v1.8.0 "AniList tab on cards", v1.8.5, the old v1.9.0 mobile) need restructuring to the locked ladder (v1.7.6 → v1.8.0 Smoothness → v1.8.1 admin edit → v1.8.2 review template → v1.8.3 Identity & Finalization → v1.9.0 community → v1.9.5 UI → v2.0 mobile). I'll fold that into this ship's docs cascade.

## Estimated total
**Small — ~2-3h, likely 1 build gate + a short favicon sub-gate** (pending Blake's asset call). Item 1 ~10 lines, items 2/3/4 a handful of CSS/array lines, item 5 the SVG + head tags. `bump-version` stays 33 (no new versioned page).

## Open questions for Blake (summary)
1. **Routing (item 1):** keep watched-not-primary saves on the secondary modal (my rec, mirrors v1.7.4) — or route *every* reviewed-franchise save to the main modal (bigger change, needs a reverse id→primary-slug map)?
2. **Favicon (item 5):** SVG monogram now / your custom art / monogram-now-swap-at-v1.8.3 (my lean: the last)?
3. **Staff (item 3):** add both Sound Director + Series Director, or just one?

## Phantom-drift audit
Verified, not assumed: the routing helpers are IIFE-scoped (read their defs — account.js genuinely can't call them); the collision is the source-row path (traced the secondary-open call sites, not guessed); `renderRecommendations` already does the split (read `:1178-1184`); the rec badge lacks the `position:static` override that the spine rows have (compared `:855`/`:1112` vs `:1177`); the season header already has a dedicated class (read `style.css:3163` — corrected the gate's "reuse vs dedicated" framing); zero favicon links exist (grep). One gate-framing phantom flagged (item 4's dedicated class already exists).

## One-liner reply
v1.7.6 **Gate 0 (quick-nags recon + propose) DONE — propose-only, nothing applied**: all 5 nags fit the PATCH scope and **none are render-path-heavy** (so none move to v1.8.0) — (1) the account routing fix belongs in the `#secondary=` hash handler not account.js (the routing helpers `primarySlugForAniListId`/`isWatchedAniListId` are IIFE-scoped and unreachable from the account module), it mirrors the split `renderRecommendations` already uses, and I traced the real collision to the "currently viewing source row" opening the secondary for a **primary** id (so its `al:` save then mis-routes) — ~10 lines, with an **open question**: keep watched-not-primary saves on the secondary (my rec, matches v1.7.4 + shows the per-season review) or send every reviewed-franchise save to the main modal (bigger, needs a new reverse map); (2) the ALSO LIKED title/`MOVIE`-pill overlap is because `renderRecommendations` (`:1177`) uses `.more-info-rec-format-badge` WITHOUT the `position:static` override the spine rows have, so the absolute badge overlaps short titles — CSS-only `padding-right` fix; (3) staff whitelist is the 4-role `renderStaffCredits` list (`:1215`) — add Sound Director/Series Director (1-line); (4) the season header already has a dedicated `.more-info-season > summary` class (`style.css:3163` — gate's "reuse vs dedicated" is moot), so it's pure CSS polish; (5) there's **no favicon at all** and no square brand mark (only a wide `preview.jpg` + the IG glyph), so I propose a hand-authored SVG monogram on the brand-purple now with raster fallbacks, leaning toward shipping it as a placeholder and swapping for the v1.8.3 identity art later; total ~2-3h / 1 build gate + a short favicon sub-gate, `bump-version` stays 33, and I'll restructure ROADMAP's stale version sections to the locked ladder at this ship's docs cascade — 3 open questions for Blake (routing table, favicon asset, 1-or-2 staff roles), then approve → gate 1 applies.
