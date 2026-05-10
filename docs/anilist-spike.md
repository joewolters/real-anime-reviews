<!-- author: Code | date: 2026-05-09 -->
# AniList API Spike — Reference for Phase A / Mode 1

> **Status:** Read-only research, no code or site changes. Output of Phase A pre-work task.
>
> **Why this exists:** Phase A (v1.5.0 Excel sync) and Phase B (v1.6.0 Mode 1) both need a single source of truth for what AniList actually returns. This doc is that source. Every Excel column and every Mode 1 form field can map back to a documented AniList capability listed here.
>
> **How to verify any field below:** open <https://anilist.co/graphiql> in Chrome, paste one of the queries from the bottom of this doc, hit play. Compare the response to what's claimed here. AniList's schema is stable but the live result is the ground truth.

---

## 1 · The endpoint and how it works

- **URL:** `https://graphql.anilist.co`
- **Protocol:** GraphQL over HTTPS POST
- **Auth:** None required for read-only queries (the operations Mode 1 needs)
- **Rate limit:** 90 requests/minute per IP (more than enough for this project)
- **Cost:** Free
- **No API key needed** for reads

GraphQL means: instead of a fixed `/api/anime/123` endpoint that returns a fixed shape, you send a *query* describing exactly which fields you want, and AniList returns just those fields. This is a strength for Mode 1 — we ask for only what we display, response is small, no waste.

---

## 2 · The fields AniList offers (the `Media` object)

Every anime on AniList is a `Media` record. Querying by title gives back this object. Below are the fields most relevant to Real Anime Reviews, organized by what they unlock.

### 2.1 · Identity and titles

| AniList field | Type | Example for *Charlotte* | Notes |
|---|---|---|---|
| `id` | Int | `20997` | AniList's stable internal ID. Worth saving in Excel as a primary key. |
| `idMal` | Int | `28999` | MyAnimeList ID — useful for cross-referencing. |
| `title.romaji` | String | `"Charlotte"` | Romanized Japanese title — usually the canonical search term. |
| `title.english` | String | `"Charlotte"` | English release title (sometimes null). |
| `title.native` | String | `"シャーロット"` | Original Japanese. |
| `title.userPreferred` | String | `"Charlotte"` | Whatever the user has configured (defaults to romaji). |

**For this project:** match on `title.romaji` first, fall back to `title.english`. Save `id` in Excel for stable lookups across renames.

### 2.2 · Description and core metadata

| AniList field | Type | Example | Notes |
|---|---|---|---|
| `description(asHtml: false)` | String | "A group of high school students…" | Pass `asHtml: false` for plain text; default returns HTML with `<br>` tags. |
| `episodes` | Int | `13` | Episode count. May be null for ongoing shows. |
| `duration` | Int | `24` | Average episode duration in minutes. |
| `seasonYear` | Int | `2015` | Year of the first season. |
| `season` | Enum | `SUMMER` | WINTER \| SPRING \| SUMMER \| FALL. |
| `format` | Enum | `TV` | TV \| MOVIE \| OVA \| ONA \| SPECIAL \| MUSIC \| TV_SHORT. |
| `status` | Enum | `FINISHED` | FINISHED \| RELEASING \| NOT_YET_RELEASED \| CANCELLED \| HIATUS. |
| `countryOfOrigin` | Code | `JP` | ISO country code. |
| `isAdult` | Boolean | `false` | Worth checking — Mode 1 should probably refuse to add adult content. |

**For this project:** `description`, `episodes`, `seasonYear`, `status`, `format` are direct matches for fields Blake currently writes by hand. `isAdult` is a useful safety gate.

### 2.3 · Genres, tags, studios

| AniList field | Type | Example | Notes |
|---|---|---|---|
| `genres` | [String] | `["Drama", "Supernatural"]` | A small fixed AniList vocabulary (~20 genres). Maps cleanly to your existing Genre field. |
| `tags { name, rank, isMediaSpoiler }` | [Tag] | `[{name: "School", rank: 95, isMediaSpoiler: false}]` | A larger vocabulary (~600 tags), ranked 0-100 for relevance. Includes spoiler flag. |
| `studios { nodes { name, isAnimationStudio } }` | [Studio] | `[{name: "P.A. Works", isAnimationStudio: true}]` | Multiple studios per anime; filter by `isAnimationStudio: true` to get just animation studios. |

**For this project:**
- **Genres** — AniList returns multiple, your current schema is a single string like `"Thriller / Supernatural"`. Decide: pick top 2, join with `/`? Or change schema to array?
- **Tags** — AniList tags are richer than your current hand-rolled tags (`["existential-questions","drama"]`). Decide: replace, merge, or keep separate?
- **Studios** — currently one string (`"P.A. Works"`). AniList may return multiple. Filter to `isAnimationStudio` and pick first, or change schema to array.

### 2.4 · Trailer

| AniList field | Type | Example | Notes |
|---|---|---|---|
| `trailer.id` | String | `"kU5tGma7LaU"` | YouTube/Dailymotion video ID. |
| `trailer.site` | String | `"youtube"` | "youtube" or "dailymotion". |
| `trailer.thumbnail` | String | URL | Thumbnail image URL. |

**For this project:** your current `Trailer` field is a YouTube embed URL like `"https://www.youtube.com/embed/kU5tGma7LaU"`. AniList gives you the ID + site separately. Mode 1 needs to construct the embed URL: `https://www.youtube.com/embed/${trailer.id}` when `trailer.site === "youtube"`. Trivial conversion. Per CLAUDE.md project rule on `/embed/` format, the assembled URL needs that exact path segment.

### 2.5 · Streaming where-to-watch (`externalLinks`)

| AniList field | Type | Example | Notes |
|---|---|---|---|
| `externalLinks { site, url, type, language }` | [Link] | `[{site: "Crunchyroll", url: "...", type: "STREAMING", language: "English"}]` | All external links AniList knows about. Filter by `type: STREAMING` for where-to-watch. |

**For this project:**
- Replaces your current hand-maintained `Platforms: ["Crunchyroll", "Netflix", ...]` array.
- AniList covers official platforms (Crunchyroll, Netflix, Hulu, Funimation, HiDive, Amazon, Disney+, etc.).
- AniList does NOT cover unofficial sites (hianime, 9anime, aniwave) — those are explicitly NOT on the roadmap per project rule, so this is a feature, not a gap.
- Decision for Mode 1: surface all `STREAMING` type links, optionally filter to `language: "English"` for the US audience.

### 2.6 · Cover art and banner

| AniList field | Type | Example | Notes |
|---|---|---|---|
| `coverImage.large` | URL | `https://s4.anilist.co/file/...` | Standard cover, ~230x335. |
| `coverImage.extraLarge` | URL | `https://s4.anilist.co/file/...` | Higher res, ~460x670. |
| `coverImage.color` | Hex | `"#7335a1"` | Dominant color extracted from cover (useful for theming). |
| `bannerImage` | URL | `https://s4.anilist.co/file/...` | Wide hero image, ~1900x400 (often null). |

**For this project:** your `image:` field is a local filename like `"charlotte.png"` because the deployed site serves images from `assets/` (relative paths keep the site self-contained). Per the updated project rule #9 (hybrid image curation, 2026-05-09), Mode 1 fetches `coverImage.extraLarge` from AniList, downloads it into `assets/` as `<slug-of-title>.png`, and uses that local filename — UNLESS Blake overrides with his own image during the new-anime form. **Recommendation:** also save `coverImage.color` in Excel for theming opportunities later (could power per-card glow effects, "Call of the Night" aesthetic).

### 2.7 · Scores (the multi-source rating data)

| AniList field | Type | Example | Notes |
|---|---|---|---|
| `averageScore` | Int (0-100) | `74` | Weighted user score from AniList users. Null if not enough votes. |
| `meanScore` | Int (0-100) | `75` | Unweighted mean. |
| `popularity` | Int | `89412` | Number of users with this in any list. |
| `favourites` | Int | `2114` | Number of users who favorited it. |
| `rankings { type, rank, year, season }` | [Ranking] | `[{type: "POPULAR", rank: 250, year: 2015}]` | Various leaderboards (POPULAR, RATED, etc., possibly scoped to year/season). |

**For this project:** your current `Rating: "9/10"` is Blake's personal score. AniList scores are different data — community averages. **Both belong on the page** per the v1.6.2 "More Information" panel and v1.8.0 "AniList tab on cards" plans. AniList score is `0-100`; convert to `/10` by dividing by 10 for display consistency.

**MyAnimeList scores:** AniList does NOT directly expose MAL scores in the GraphQL API. The roadmap's v1.7.2 "MyAnimeList score per episode" feature would need a separate MAL API integration (Jikan is the unofficial REST API for MAL — separate spike when v1.7.2 lands).

### 2.8 · Related anime (sequels, prequels, side stories)

| AniList field | Type | Example | Notes |
|---|---|---|---|
| `relations { edges { relationType, node { id, title { romaji } } } }` | [Edge] | `[{relationType: "SEQUEL", node: {id: 12345, title: {romaji: "..."}}}]` | All related media. `relationType` is one of: SEQUEL, PREQUEL, ALTERNATIVE, SIDE_STORY, SUMMARY, SPIN_OFF, ADAPTATION, SOURCE, CHARACTER, OTHER. |

**For this project:** powers the v1.7.2 "More Information" panel (prequels/sequels with links to those entries if they exist on the site). Mode 1 would query relations on every fetch and write them to Excel; the UI can then check `if (animeData has node.id) then link else show as not-on-site`.

### 2.9 · Per-episode data

| AniList field | Type | Notes |
|---|---|---|
| `streamingEpisodes { title, thumbnail, url, site }` | [Episode] | Individual episode info — title, thumbnail, where to watch this episode. |
| `episodes` | Int | (already covered above — total count) |

**For this project:** powers v1.7.2's "Per-episode names and counts" panel content. Note: AniList does NOT expose per-episode user scores in this API (would need MAL/Jikan).

### 2.10 · Other potentially useful fields

| AniList field | Notes |
|---|---|
| `synonyms` | Alternative titles. Useful for fuzzy search matching. |
| `source` | What the anime was adapted from (MANGA, NOVEL, ORIGINAL, GAME, VISUAL_NOVEL, etc.). |
| `hashtag` | Official Twitter hashtag (rarely useful). |
| `nextAiringEpisode { airingAt, episode }` | For RELEASING anime — when the next episode drops. **Useful for the "auto-update for new seasons / episodes" big-vision idea.** |
| `airingSchedule { nodes { episode, airingAt } }` | Full airing schedule. |
| `siteUrl` | The AniList page for this anime — useful as a "View on AniList" link. |
| `updatedAt` | Unix timestamp of last AniList update. **Useful for Mode 2 — only re-sync entries where `updatedAt > lastSyncTime`.** |

---

## 3 · Fields that map cleanly to current `animeData.js`

| `animeData.js` field | AniList equivalent | Notes |
|---|---|---|
| `Title` | `title.romaji` | Direct match. |
| `Description` | `description(asHtml: false)` | AniList descriptions are typically longer/more detailed. |
| `Seasons` | (compute from `relations` filtered to SEQUEL/PREQUEL chain) | Your "1 season", "2 seasons" string isn't a single AniList field — needs to be derived by walking the relations graph. |
| `Studio` | `studios.nodes[0].name` (filtered to animation studios) | Pick first or join multiple. |
| `Trailer` | `https://www.youtube.com/embed/${trailer.id}` (when `trailer.site === "youtube"`) | Construct on save. |
| `Platforms` | `externalLinks` filtered to `type: STREAMING` | Replaces hand-maintained list. |
| `Genre` | `genres[0]` + `/` + `genres[1]` (or first 2 joined) | Schema-shape mismatch — see §2.3 decision. |
| `Tags` | `tags` (filter `rank > 60`, exclude `isMediaSpoiler: true`) | Richer than current. See §2.3 decision. |
| `image` | `coverImage.extraLarge` (downloaded into `assets/` as `<slug>.png`) | Per updated rule #9, AniList default + manual override. Mode 1 downloads the URL into `assets/` and uses the local filename; Blake can override with his own file. |

## 4 · New capabilities AniList unlocks (not in current schema)

These are fields AniList provides that you don't currently store. Each is a candidate for a new Excel column:

- `aniListId` — stable cross-source primary key. **Strongly recommended** to save.
- `idMal` — MAL ID for future cross-source data.
- `title.english`, `title.native` — alternate titles for search-bar matching tuning (audit polish item).
- `episodes`, `duration`, `format`, `status` — currently inferred from `Seasons` string only.
- `seasonYear`, `season` — for "What aired in Spring 2024?" filtering down the road.
- `coverImage.color` — dominant color for theming. Powers visual experiments without manual color picking.
- `averageScore`, `meanScore`, `popularity`, `favourites` — community signals. Powers the v1.6.2 More Information panel and v1.9.0 AniList tab.
- `relations` — the prequel/sequel/related graph. Powers v1.7.2.
- `streamingEpisodes` — per-episode names/thumbs/links. Powers the v1.7.2 deeper panel.
- `nextAiringEpisode`, `updatedAt` — Mode 2 health-watching infrastructure.

## 5 · Schema-design decisions Phase A needs to make

Before writing the v1.5.0 sync script, decide:

1. **Genre as string vs array.** Current: `"Thriller / Supernatural"` (string with `/` separator). AniList: array. **Recommended:** keep string for backward compatibility with existing card rendering, but also store array internally for filtering.

2. **Tags: replace, merge, or both.** Current Blake-curated tags are short, opinionated, project-flavored (`"aura-farming"`). AniList tags are systematic and dense. **Recommended:** keep both. Have an Excel column `Tags` (Blake's) and `AniListTags` (auto-fetched, rank-filtered).

3. **Studio as string vs array.** Current: `"P.A. Works"`. AniList: multiple studios. **Recommended:** array internally, comma-joined string for display.

4. **Platforms: trust AniList vs keep manual.** Current includes `hianime`/`9anime`/`aniwave` (unofficial — explicitly NOT on roadmap per project rule). AniList only has official. **Recommended:** keep your current manual `Platforms` field as authoritative; let Mode 1 *prefill* from AniList's `externalLinks`, but Blake can edit before save. Excel keeps whatever Blake decides.

5. **Trailer: store as YouTube ID or full embed URL.** Current: full embed URL. AniList: ID + site. **Recommended:** store full embed URL in `animeData.js` (no rendering changes needed) but ALSO save the raw ID + site in Excel so Mode 2 can re-derive if needed.

6. **AniList ID storage.** Currently no stable cross-source ID. **Recommended:** add `AniListId` column to Excel. Becomes the primary key for Mode 2's "re-sync this anime" lookups.

---

## 6 · Ready-to-run queries (paste into <https://anilist.co/graphiql>)

### 6.1 · Full data dump for one anime (Charlotte)

```graphql
query {
  Media(search: "Charlotte", type: ANIME) {
    id
    idMal
    title { romaji english native userPreferred }
    description(asHtml: false)
    episodes
    duration
    seasonYear
    season
    format
    status
    countryOfOrigin
    isAdult
    genres
    tags { name rank isMediaSpoiler }
    studios { nodes { name isAnimationStudio } }
    coverImage { large extraLarge color }
    bannerImage
    averageScore
    meanScore
    popularity
    favourites
    trailer { id site thumbnail }
    externalLinks { site url type language }
    relations {
      edges {
        relationType
        node { id title { romaji } format }
      }
    }
    nextAiringEpisode { episode airingAt }
    siteUrl
    updatedAt
  }
}
```

### 6.2 · Lightweight "fetch-on-typing" query (for Mode 1 live-preview)

```graphql
query ($search: String!) {
  Page(perPage: 8) {
    media(search: $search, type: ANIME) {
      id
      title { romaji english }
      coverImage { medium }
      seasonYear
      format
      averageScore
    }
  }
}
```

Variables panel:
```json
{ "search": "char" }
```

Use this to power the v1.6.1 dropdown of matching anime as Blake types.

### 6.3 · Just the "what's the streaming where-to-watch" slice

```graphql
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    title { romaji }
    externalLinks(language: "English") { site url type }
  }
}
```

Variables:
```json
{ "id": 20997 }
```

---

## 7 · Verification steps for whoever picks this up next

1. Open <https://anilist.co/graphiql>.
2. Paste query 6.1, hit play.
3. Confirm Charlotte returns: `id: 20997`, `coverImage.color` non-null (currently `#f1c9a1`), `genres` includes "Drama" and "Supernatural", `studios.nodes` includes "P.A.WORKS" *(note AniList omits the space — your `animeData.js` writes it as "P.A. Works" — small whitespace mismatch worth flagging in the schema-diff doc)*.
4. Try queries 6.2 and 6.3 to confirm they work.
5. If anything in §2 doesn't match what AniList actually returns today, update this doc — the schema is authoritative as of this spike (2026-05-09), but APIs evolve.

---

## 8 · Summary recommendations for Phase A (v1.5.0)

- **Add 4 new columns to Excel:** `AniListId`, `IdMal`, `AniListScore`, `AniListColor`. These cost nothing to populate and unlock everything in §4.
- **Keep current `animeData.js` schema unchanged for now.** v1.5.0 is just Excel → JS sync; don't redesign card rendering yet. Save the schema rework for v1.6.0 when Mode 1 is doing the writes anyway.
- **Two-source-of-truth pattern for Tags and Platforms.** Blake's curated values are authoritative; AniList values are auxiliary. Document both columns in Excel. Mode 1's UI prefills from AniList but Blake's edits win.
- **Image curation is hybrid** (project rule #9, updated 2026-05-09). Mode 1 downloads `coverImage.extraLarge` into `assets/` as `<slug-of-title>.png` by default; Blake can override with a custom file at form-fill time. The deployed site always serves local files (relative paths from `assets/`), never AniList CDN URLs directly.

This doc is the foundation. v1.5.0 (Excel sync) and v1.6.0 (Mode 1 baseline) both pull from here.
