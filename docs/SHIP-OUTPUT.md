<!-- author: Code | date: 2026-06-04 -->
# v1.7.4 — Gate 0 (recon + propose: Modal Architecture Overhaul — PROPOSE-FIRST, PROPOSAL ✓)

> Full recon done (modal-build path, More Info wiring, franchise query, layout CSS, sync/admin/server, watchlist schema). Nothing applied. Below: per-scope recon + proposal + Δ + creative alternatives + pushback, then answers to the 7 open questions + gate split. **3 stop-conditions surfaced** (new detail query, the "exact width" baseline ambiguity, the always-visible width vs viewport tension).

## Recon — what exists today
- **`openModal` (`script.js:4067`)** → `modal.classList.add('duo')`, then `modalContent.innerHTML = [more-info-container][sheet--left (main review)][sheet--right (community)]`.
- **Layout (`style.css:2799`):** `.modal.duo .modal-content { grid-template-columns: auto 1.6fr 1fr; gap:18px }`, `.modal.duo { max-width:1200px; width:96% }`. More Info container **140px collapsed → 260px expanded** (tab slides out, panel `translateX(-100%)→0`). Stacks to 1-col at `@max-width:1000px`.
- **Click delegation (`script.js:4287`):** ep-toggle / partial-fail retry / catalog-row → `openModal(internal)` / **non-catalog `data-anilist-id` → `window.open('anilist.co/anime/{id}')` at `:4314`** — this is the exact hook the secondary modal replaces.
- **`franchise-fetch.js` `MORE_INFO_QUERY_NODE`** returns id/title/format/episodes/seasonYear/type/status/studios/averageScore/coverImage/streamingEpisodes/relations — **NO `description`, `genres`, `characters`, `bannerImage`, `tags`**. The secondary modal needs those.
- **Watchlist already exists** (per prompt recon, confirmed): `users/{uid}/watchlist/{animeId}` (firestore.rules), account tab + per-card watch button (`script.js:264`), catalog-slug-keyed.

---

## Scope 1 — Secondary modal architecture
**Integration:** replace `window.open(anilist.co)` (`script.js:4314`) with `openSecondaryModal(aniListId)`.
**⚠️ STOP-CONDITION (needs ratification):** the secondary modal needs richer data (`description`/`genres`/`characters`/`bannerImage`) the **load-bearing** `MORE_INFO_QUERY_NODE` doesn't return. I will **NOT** extend that query (it drives the live homepage traversal). Instead: a **new sibling `MEDIA_DETAIL_QUERY` + `fetchMediaDetail(id)`** in `franchise-fetch.js` — additive, the existing traversal untouched. Requesting OK to add the sibling.
**Proposal:** `#secondary-modal` overlay at higher z-index than the primary; top-left `← Back to <show title>` (Decision 2); replace-content on related-click within it (Decision 3); per-anime cache `rar:anime:v{APP_VERSION}:{id}` 24h, version-prefix sweep + try/catch (Decision 4, v1.7.2 conventions). Primary stays MOUNTED underneath (the secondary is a layer, not a rebuild) → primary scroll/tab state preserved for free; Back just hides the layer.
**3 visual treatments (creative latitude):**
- **(A) Same frame, "gone deeper": slide-in-from-right over a dimmed+blurred primary, accent-shifted header (warmer kicker), Back arrow top-left.** *Why: cohesive world, primary contextually visible behind — premium + oriented.* ← **RECOMMEND**
- (B) Nested smaller card centered, primary blurred behind. *Why: "focus pop," but breaks layout continuity.*
- (C) Full-bleed drill-down drawer from the right covering the primary. *Why: immersive, but reads like a page change, not a layer.*
**Δ:** `script.js` ~+150, `style.css` ~+120, `franchise-fetch.js` ~+30.

## Scope 2 — Always-visible More Info (layout restructure)
Remove the tab (Decision 6); render the panel on modal open (call `runMoreInfo` immediately; drop the collapsed state machinery).
**⚠️ STOP-CONDITION + OPEN-Q (width):** "Main + Community keep EXACTLY current widths" is ambiguous — the `fr` columns currently **reflow**: Main/Community are ≈630/394px when More Info is collapsed (140), ≈556/348px when expanded (260). An always-visible wider More Info (~380px) **with Main/Community pinned exact** forces the modal to ~**1380px**, which exceeds 96% of a 1280px viewport.
**Proposal:** fix Main/Community at their current **default-open** px (≈630/394) + More Info fixed at 380px, bump `.modal.duo` max-width to ~1380px, **stack to single-column below ~1100px** (extends the existing @1000px stack — desktop-first per Blake's v2-defer). **Need Blake's call:** is the "exact" baseline the collapsed-open widths (630/394) or expanded (556/348)?
**Δ:** `script.js` ~−15, `style.css` ~+40.

## Scope 3 — Per-season review (storage + sync + render + admin)
**Storage (refining Cowork's markdown lean):** `season-reviews/<aniListId>.md` (frontmatter: title/aniListId/date; body: prose) — diffable, version-controlled, prose-appropriate. **Plus a sync-emitted index** (`season-reviews/index.json`, or a field in `animeData.js`) listing which AniListIds have reviews — required so the ALSO-LIKED "Reviewed / Not-reviewed" pill resolves at render time **without** probing every file. **Render:** lazy-fetch the `.md` by id when the secondary modal opens (404 = no review).
**Renderer:** **hand-rolled minimal markdown** (bold/italic/headers/paragraphs/links, ~40 lines) — **no new visitor dep** (avoids `marked`, honors the no-perf-dep constraint).
**Admin trigger — RECOMMEND (a):** inline **"Edit season review →"** in the secondary modal (admin-gated) → new Mode 1 `/api/season-review` endpoint writes the `.md` locally (same local-server pattern as the chatbot). *Why: most contextual — edit the season you're viewing.* Editor = textarea + live preview pane (same renderer); no rich-text toolbar.
**Render fallback:** review present → show as primary content; absent → "No specific review for this season yet" + AniList description as body.
**Alternative storage:** sync pre-renders all `.md` → a `season-reviews.js` bundle (build-time md lib = build-only dep, dep-free at runtime; one fetch but bundle grows with review count). I lean lazy-per-file.
**Δ:** new `season-reviews/` dir, `sync-excel-to-js.js` ~+30, `script.js` ~+70 (render + fetch + parser), `admin/new-anime.*` + `mode1-server.js` ~+90.

## Scope 4 — Currently-Viewing indicator update
On secondary open for a franchise id, move the More Info `CURRENTLY VIEWING` highlight to that row; Back restores it to the source. **200ms fade** transition (matches the panel's premium feel; reduced-motion → instant). Δ ~+20 js / +10 css.

## Scope 5 — "Not Reviewed yet" treatment (Decision 5c — both)
Amber dot/kicker on ALSO-LIKED cards pre-click (driven by the season-review index) + a header indicator in the secondary modal when viewing a non-catalog entry. Visually distinct from the green `✓ REVIEWED` pill (which v1.7.3 made multi-season-aware). Δ ~+15 js / +15 css.

## Forward-compat for v1.7.5 (flag, NOT this ship)
- Reserve a header/footer **slot for a future "Add to watchlist" button** in the secondary modal so v1.7.5 needs no layout re-shuffle.
- The watchlist schema is **catalog-slug-keyed**; non-catalog AniListId entries will need a discriminator (`{type:'anilist', aniListId}`) or a parallel sub-collection. **v1.7.5 plan hint.**

## Answers to the 7 open questions
1. **Storage:** markdown files + sync-emitted index + lazy fetch (recommend); bundle alternative noted.
2. **Admin trigger:** (a) inline "Edit season review" in the secondary modal → local `/api/season-review`.
3. **Editor:** textarea + live preview (no toolbar).
4. **Responsive:** fixed-px columns at ~1380px max-width, stack <1100px — pending the "exact baseline" call.
5. **Secondary visual:** treatment (A) slide-in over dimmed primary (recommend) + 2 alternatives above.
6. **Back-restore state:** primary stays mounted under the layer → scroll/tab state preserved automatically; Back hides the layer.
7. **CURRENTLY VIEWING transition:** 200ms fade.

## Pushback on locks
None blocking — the 8 locks are coherent. Two items need Blake's input rather than pushback: the **"exact width" baseline** (Q4) and ratification for the **additive sibling detail query** in `franchise-fetch.js` (low-risk, doesn't touch the existing traversal).

## Gate split (endorse Cowork's 3)
- **Gate 1** — layout restructure (always-visible More Info, remove tab, fixed-px columns + responsive). Foundation.
- **Gate 2** — secondary modal (overlay/Back/replace-content/Currently-Viewing/cache + the new `MEDIA_DETAIL_QUERY`).
- **Gate 3** — per-season reviews (markdown storage + sync index + lazy render + hand-rolled parser + admin editor + Mode 1 endpoint).
- **Estimate:** ~12-18h.

## Decisions for Blake
1. **"Exact width" baseline** — collapsed-open widths (≈630/394) or expanded (≈556/348)? (drives the layout)
2. **Secondary visual** — approve treatment (A), or pick B/C?
3. **Per-season storage** — markdown-files+index+lazy (recommend) vs the pre-rendered bundle?
4. **Admin trigger** — inline secondary-modal button (recommend) vs standalone route/CLI?
5. **OK to add the sibling `MEDIA_DETAIL_QUERY`** to `franchise-fetch.js` (additive, the live traversal untouched)?

## One-liner reply
v1.7.4 Gate 0 recon+proposal written (propose-only) — mapped the modal architecture (`openModal` builds a `duo` grid `[More Info | 1.6fr main | 1fr community]`, More Info collapses 140→260 via a tab, and non-catalog `data-anilist-id` rows currently `window.open(anilist.co)` at script.js:4314 = the secondary-modal hook); proposed a layered `#secondary-modal` (slide-in over a dimmed primary — recommend treatment A of 3, primary stays mounted so Back preserves scroll/tab state, per-anime 24h cache) fed by a **new additive sibling `MEDIA_DETAIL_QUERY`** in franchise-fetch.js (surfaced as a stop-condition — won't touch the load-bearing traversal query, needs ratification); always-visible More Info by removing the tab + fixing Main/Community at their current px and bumping the modal to ~1380px with a <1100px stack (surfaced the width-vs-viewport tension + the "exact baseline" ambiguity as the key open question); per-season reviews as `season-reviews/<id>.md` + a sync-emitted index + lazy fetch + a hand-rolled ~40-line markdown renderer (no visitor dep), authored via an inline admin "Edit season review" button → a local Mode 1 `/api/season-review` endpoint, rendered as the secondary modal's primary content with an AniList-description fallback; plus the CURRENTLY-VIEWING highlight moving on stack-nav (200ms fade), the amber "Not Reviewed yet" pill distinct from the green ✓ REVIEWED, and a reserved watchlist-button slot + schema hint for v1.7.5 (don't build now); endorsed the 3-gate split (~12-18h); 5 decisions queued for Blake (exact-width baseline, secondary visual A/B/C, storage shape, admin trigger, and OK on the sibling query).
