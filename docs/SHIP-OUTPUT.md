<!-- author: Code | date: 2026-06-05 -->
# v1.8.4 — Gate 0 (Discovery & Blend — DESIGN STUDY, PROPOSE-FIRST · nothing applied)

> **Proposal only — no code applied.** v1.8.3 is live. This is the "go all out" design study for Discovery & Blend: the full IA, the three surfaces, the background visual-identity layer (2 directions + my pick), the data flow + freshness mechanics, brainstorm pitches, and a proposed one-ship gate order. Blake reads, clarifies, and picks; the apply-prompt follows. **Open questions are at the bottom — please answer those and the visual-direction pick before G1.**

---

## 1. Recon — the seams are already in place (file:line)
- **Home mount points** — `index.html:186-187`: two hidden comments at the top of `#home-view` (`Currently-Airing "Top 10" hero` + `"For You" rail`). They render nothing today; this ship fills them.
- **Header tools** — `index.html:77-90`: `#view-all-btn` / `#random-btn` / `#filter-btn` (`.inline-header-btn`) in `.toolbar`, plus search + My Account in `.nav-links`. This is where For You / Discover entries glide in (Direction C, in-page).
- **AniList layer** — `franchise-fetch.js`: `MEDIA_DETAIL_QUERY` + `fetchMediaDetail(id)` (flat, 429/Retry-After single-retry, `window.franchiseFetch` + `module.exports`). 3 new flat queries slot in here additively.
- **L2 cache** — `script.js:631-667`: `rar:anime:vX.Y.Z:{id}`, **24h TTL**, APP_VERSION-keyed, once-per-session prefix sweep, L1-Map → L2-localStorage → network. The exact pattern to clone for the new query caches.
- **NOT-REVIEWED is free** — `openSecondaryModal(aniListId, source, moreInfo)` (`script.js:4994`) already renders **"NOT REVIEWED YET"** + a **"Request this anime"** pill (`5318-5326`) for any non-watched id. A discovery card just calls `openSecondaryModal(id)`.
- **Card `reviewed` scaffold shipped** — `card-render.js:62`: `renderAnimeCardMarkup(anime, {reviewed=true})` → `is-reviewed` / `is-not-reviewed`. Discovery passes `reviewed:false`.
- **Discover search pattern** — `suggest.js:30/113/122/126`: 350ms debounce + AbortController + abort-in-flight. Reuse verbatim.
- **For-You signals** — `favoritesSet` / `watchlistSet` (`script.js:161-162`, slugs) + `rar:continue` (recent) + `animeData[].Genre/Tags` for taste.
- **Background today** — `body::before` = the city image (`assets/call-of-the-night-bg.jpg`, z-1); `body::after` is FREE (the v1.8.3 den-tint was removed at G5b — that mechanism is the seed of the real background concept below).

---

## 2. The blend — the one idea everything serves
A stranger must, in one glance, get **"this is one person's reviews"** (premium, curated, the heart) vs **"…and here's the wider world"** (live, secondary, a neighbor — never a firehose). Three levers enforce it everywhere:
1. **Hierarchy of place:** the **front door is always Blake's Den.** The wider world is reached by stepping sideways (For You / Discover), never shoved on top of his curation.
2. **The card tells you instantly:** Blake's cards carry his gold rating + provenance; outside cards carry a **"NOT REVIEWED" corner sticker** (no provider name) and the community score only. Same shell, opposite read.
3. **The room gets lighter as you leave the den:** the background layer (§4) is **darkest/coziest in the Den and opens up in Discover** — so you *feel* where you are. That's the visual spine of the whole ship.

---

## 3. Information architecture + the three surfaces

### Navigation (Direction C — in-page glides, no reloads)
The header grows two siblings to "Home," all swapping the main content area like `#view-all-btn` does today (`showHome`/`showAll` pattern → add `showForYou`/`showDiscover`):

`[ Blake's Den ] · [ For You ] · [ Discover ]` … then the tools `View All · Random · Filter · Search · My Account`.

- The three surface tabs are the **primary IA**; View All / Random / Filter stay as tools.
- **Label proposal (open Q):** keep them plain-English (**For You** / **Discover**) for instant legibility, with the bilingual accent the site already uses — **For You 君へ** / **Discover 発見** — as a small kicker, matching `BLAKE'S DEN 隠れ家`. (Alt: "The Den / For You / The Wider World." My pick: For You / Discover — it's the streaming vocabulary strangers already know.)
- Signed-out: **For You** still shows (becomes "Trending right now"); **Discover** is fully public.

### Surface A — Blake's Den (the front door, ~unchanged)
His 44 + the Den masthead + Top 10 + Latest Drop + Continue rail + Anime By Genre. **This ship fills the v1.8.3 "hole" here** — see §3-home below. No AniList content leads this surface; the heart stays first.

### Surface B — For You
- **Signed in:** rails built from the user's taste — "Because you saved {genre}" / "More like {a favorite}" — drawn from trending/airing filtered to the **top genres+tags of their saved catalog entries** (favorites weighted over watchlist over recent). Every card is an outside card (NOT-REVIEWED sticker) UNLESS it matches one of Blake's 44 (then it's a real reviewed card, pinned with a "Blake reviewed this" chip — the blend, per card).
- **Signed out:** one honest fallback — **"Trending right now"** (Trending query), same outside-card treatment. No fake personalization.

### Surface C — Discover
- **Live search** (350ms debounce + AbortController) that **pins Blake's 44 matches first** (a glowing "Reviewed by Blake" chip), then outside results below a thin "From the wider world" divider.
- **Clickable "Currently Airing — Top 10"** (the hero, also surfaced on home).
- **Airing by genre** (a genre chooser → `status:RELEASING` filtered).
- **Community top picks** (Trending) — labeled source-lessly (see open Q on copy).
- Every non-Blake card → `openSecondaryModal(id)` (free NOT-REVIEWED + Request).

### The home layout (filling the v1.8.3 hole) — 3 options, my pick first
**Pick — "Heart first, world below":** the home leads with the **Den masthead** (establishes "this person" immediately), then a **slim Currently-Airing hero strip** fills the sparse top-right area *below* the masthead (clearly kickered "AIRING NOW · the wider world," outside-card stickers), then the **Top 10 + Latest Drop**, then a compact **For-You rail** (signed-in) / trending taster (signed-out), then Continue + By Genre. The wider world fills the hole but never outranks the Den.
- **Alt 1 — "Airing hero at the very top":** the airing strip is the first thing (most "alive"), Den second. Rejected as default: it inverts the heart-first hierarchy Blake's whole identity rests on.
- **Alt 2 — "Right-rail world":** keep the Den centered; the airing/For-You content lives in a persistent right rail (fills the literal empty gutter). Rejected: reintroduces the gutter-collision problems v1.8.3 just escaped, and is mobile-hostile (mobile is v2.0 but still).

---

## 4. The background concept — the sole visual-identity layer (Blake killed characters for this)
A designed **black/opaque layer over the city backdrop** with **gradual reveal**, later **per-surface variants**. This is the visual spine that makes the door → Den → Discover one journey. **The reveal is CONTEXTUAL, not scroll-linked** (scroll-linked paint is the Gecko trap — Blake's Profiler is the arbiter). Mechanism: a `body::after` overlay (the freed-up v1.8.3 slot) whose density/art is driven by a `data-surface` attribute on `<body>`, **crossfading ~450ms on each in-page glide** (reduced-motion → instant swap). The Den is darkest/coziest; each step toward Discover lifts the veil and reveals more city.

### Direction 1 — "Lifting the veil" (my pick)
A near-opaque deep-purple-black layer with **fine etched line-work + a few faint cracks** (the welcome-door texture, extended site-wide). Per surface, the layer's **opacity + the line-work density step down**: Den ~0.92 (cracks tight, city barely there) → For You ~0.78 → Discover ~0.6 (open, city visibly behind, lines dissolved). It reads as *the den opening onto the night city as you go outward* — a literal visual of the blend. Cheap: one fixed gradient + one masked SVG line layer, opacity-crossfaded on glide.

### Direction 2 — "Constellation hush"
Same black base, but the texture is a **sparse star/constellation field** (purple pinpricks + the faintest connecting lines) that **thins outward**: dense, close, cozy in the Den → wide, open, fewer stars in Discover. More "in space" (ties to the welcome quotes' "page is in space" note). Slightly more decorative, marginally more paint.

### Direction 3 — "Aperture"
A vignette that **opens** per surface — tight cozy vignette on the Den (you're tucked in), wide-open on Discover (the world's in view). Simplest/cheapest, but the least distinctive (vignettes are common); I'd fold its "focus" idea into Direction 1 rather than ship it alone.

**My pick: Direction 1.** It encodes the blend the most literally, reuses the door's existing line-work language (door → site continuity), and is the most performance-safe (static per surface, crossfade on glide only). Optional later enhancement (own gate, Gecko-profiled): a *very* subtle within-surface scroll thinning via a throttled passive listener writing one CSS var — proposed but gated behind Blake's Profiler, droppable.

---

## 5. Data flow + budget
**3 new flat queries in `franchise-fetch.js`** (additive, complexity-safe — flat lists, no nested relations):
- `SEARCH_QUERY` — `Page(media: search:$q, type:ANIME, sort:SEARCH_MATCH){ id title coverImage{large} averageScore genres seasonYear format }` → Discover search.
- `TRENDING_QUERY` — `sort:TRENDING_DESC, type:ANIME` → For-You signed-out + community top picks.
- `AIRING_QUERY` — `status:RELEASING, sort:TRENDING_DESC` (+ optional `genre:$g`) → airing hero + airing-by-genre.

**Canary discipline:** before trusting each, run it live against the **101922 (Demon Slayer)** path — SEARCH for "demon slayer" must return 101922; TRENDING/AIRING must not 500. (Flat queries are inherently safe vs the nested-complexity trap, but the canary stays the gate.)

**Caching (clone `script.js:631-667`):**
- `rar:trending:vX:` — 24h.
- `rar:airing:vX:` — **6–12h** (airing churns faster; open Q).
- `rar:search:` — short/session (queries vary; AbortController handles in-flight).

**Budget / when it fires:** the home does **NOT** call AniList on first paint (the Den is local). Airing/Trending fetch **lazily** the first time For You or Discover (or the home airing-strip) is opened, then served from L2 for 6–24h. Discover search is debounced+aborted. For-You candidates are computed locally from saved entries' genres/tags, then one trending/airing call filtered to them. Net: ~2 background calls per session for a browsing user, cached thereafter.

---

## 6. "Feels fresh per log-on" — deterministic, not random
A **per-session seed** in `sessionStorage` (`rar:freshseed`, generated once per log-on) drives a **deterministic shuffle** of the candidate pools:
- Fetch a **deep pool** (trending top ~50, airing top ~50), then surface a **seeded window/order** of it. Within a session it's **stable** (no reshuffle on re-render — same lesson as the search relevance order), but a new session = a new seed = a new face.
- The **personalized featured** pick + the For-You rail ordering also key off the seed (+ the taste signals). So the site feels alive each visit without being chaotic mid-session. (Reduced-motion unaffected — this is data ordering, not motion.)

---

## 7. Brainstorm pitches (3–5, cheap to cut — like the continue rail was)
1. **"Blake reviewed this" pin in Discover/For-You** — when an outside result is one of his 44, it surfaces FIRST with a glowing chip + his gold rating, so the blend is legible per-card (not just per-surface). *(Strongly recommend — it's the blend made tangible; near-free given the catalog match already exists.)*
2. **"In your lane, airing now"** — an airing rail filtered to genres that overlap Blake's catalog, framed as "the wider world, in the styles you already trust here." Bridges his taste to live data.
3. **The upgrade moment** — when Blake reviews a previously-NOT-REVIEWED title (AniList-id match), make its first post-review appearance a tiny "newly reviewed" shimmer so returning users notice the world→den promotion. (Locked scope; this just gives it a beat.)
4. **"Request" telemetry loop** — the Request-this-anime pill already exists; surface a subtle "N people requested this" on hot NOT-REVIEWED cards (community demand → Blake's queue). Ties Discover back to his workflow.
5. **Background as wayfinding** — the §4 reveal doubles as a "you are here" cue (dark = the Den, light = the world); add a one-word surface label that fades with it. Zero extra cost, pure coherence.

---

## 8. Proposed gate order (ONE big ship; Blake okayed taking time on testing)
| Gate | Scope | Δ estimate |
|---|---|---|
| **G0** | This design study (propose-first) | — |
| **G1** | **AniList data layer** — 3 flat queries + 3 caches (clone L2) + canary tests + a Node harness; no UI | ~+200 `franchise-fetch.js`/`script.js`, +1 test spec |
| **G2** | **Card shell + outside cards** — `reviewed:false` rendering, NOT-REVIEWED sticker (no provider name), `openSecondaryModal` wiring, the **Reviewed/Not-reviewed filter** | ~+120 css/js, +1 spec |
| **G3** | **Discover surface** — live search (pin his 44) + airing Top-10 + airing-by-genre + community top picks + the freshness seed | ~+300 js/css, +2 specs |
| **G4** | **For You surface** — taste-candidate engine (saved genres/tags) + signed-out Trending + personalized featured | ~+220 js/css, +1 spec |
| **G5** | **Header nav + home hole-fill** — For You/Discover in-page glides (Direction C) + the airing hero/For-You rail placement (the §3 home layout) | ~+180 js/css, +1 spec |
| **G6** | **Background visual-identity layer** — Direction 1 contextual reveal per surface (crossfade on glide), Gecko-profiled; reduced-motion instant | ~+120 css, +tiny js |
| **G7** | **Brainstorm trio + polish + smoke loops** | ~+120 |
| **(G8, optional)** | **Quotes-admin page** (manage `WELCOME_QUOTES` + ✨ASK drawer) — nice-to-have; **trails to a future ship if this gets heavy** (Blake's call) | season-reviews-panel-sized |
| **Sweep** | docs cascade + bump + audits + commit + preview → prod | — |

Rationale for the order: **data first** (G1) so everything downstream is real, not mocked; **the card shell + filter** (G2) before the surfaces so both surfaces share one verified shell; **Discover before For You** (G3→G4) because Discover is fully public/testable and For You builds on the same pools + adds the taste layer; **nav + home** (G5) once both surfaces exist to glide between; **the background** (G6) last among features so it can unify the finished journey; quotes-admin trails.

---

## 9. Open questions for Blake (please answer before G1)
1. **Header labels:** **For You / Discover** (+ JP kicker) as proposed, or themed ("The Den / For You / The Wider World")?
2. **Home layout:** my **"heart first, world below"** pick, or do you want the **airing hero at the very top** (more alive, but world-before-Blake)?
3. **Background direction:** **1 "Lifting the veil"** (my pick), 2 "Constellation hush", or 3 "Aperture"? And: is the **per-surface contextual reveal** the right read of "gradual reveal," or did you mean **scroll-driven** within a page (I can do a cheap version but it's the Gecko-sensitive one — I'd gate it behind your Profiler)?
4. **Airing cache TTL:** 6h, 12h, or 24h? (Fresher vs fewer calls.)
5. **"Community top picks" copy:** no provider name allowed — okay to label it **"Popular right now"** / **"What the world's watching"**? Pick a voice.
6. **Reviewed/Not-reviewed filter** as a **toggle** ("Blake's reviews only") or a **3-way segment** (All / Reviewed / Not yet)?
7. **Scope check on the upgrade moment + Request telemetry** (pitches 3–4): in for v1.8.4, or bank for later?

## One-liner reply
v1.8.4 **Gate 0 design study DELIVERED — proposal only, nothing applied** (propose-first; you clarify + pick, then I build): the recon confirms every seam is already in place (the 2 hidden home mount-points `index.html:186-187`, the header tools, the `franchise-fetch.js` query layer + the 24h L2 cache pattern `script.js:631-667`, the FREE NOT-REVIEWED secondary modal `openSecondaryModal` `script.js:4994`, the shipped `reviewed:false` card scaffold, and the `/suggest` debounce+AbortController); the design centers the **blend** with three levers — **heart-first place** (the Den is always the front door, For You/Discover are sideways steps via Direction-C in-page glides), **per-card legibility** (Blake's gold-rated cards vs outside cards with a no-provider-name NOT-REVIEWED sticker + a "Blake reviewed this" pin when his 44 match), and **a background that opens as you leave the den**; the **background concept** (which now replaces characters entirely) is a `body::after` black/line-work layer that **lifts per surface** (Den darkest → Discover most open) crossfading on glide (NOT scroll-linked = Gecko-safe), proposed in **2 directions + my pick "Lifting the veil"**; **data** is 3 new flat AniList queries (search/trending/airing) each **101922-canary-tested**, lazily fetched (home stays local) onto cloned 24h/6-12h L2 caches, with **"fresh per log-on"** done as a **per-session seed** driving a deterministic shuffle of deep candidate pools (stable mid-session, new face each login); plus 5 brainstorm pitches (the "Blake reviewed this" pin is the standout) and a **proposed one-ship gate order** G1 data → G2 card-shell+filter → G3 Discover → G4 For You → G5 nav+home-hole-fill → G6 background → G7 brainstorm+polish (quotes-admin trails as optional G8) → sweep; **7 open questions** at the bottom (header labels, home layout, background direction + reveal mechanic, airing TTL, community-picks copy, filter shape, the two scope-check pitches) — answer those + pick the visual direction and I'll start G1. Nothing builds until you do.
