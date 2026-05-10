<!-- author: Code | date: 2026-05-09 -->
# Schema Diff — Excel ↔ animeData.js ↔ AniList

> **Status:** PARTIAL. The animeData.js side is fully documented from source. The pre-Excel notes side is documented from `Master List/All anime reviews .txt`. The Excel side is **pending** — the Cowork sandbox couldn't open `Anime_Master_Table.xlsx` in this session due to a FUSE mount restriction. Section 3 below has a specific question for Blake to fill the gap.
>
> **Why this doc exists:** Phase A pre-work step 2. Before writing the v1.5.0 Excel → animeData.js sync script, we need to know exactly what columns Excel has, what fields animeData.js has, and where they disagree. This doc surfaces those disagreements so the sync script doesn't have to guess.
>
> **Companion docs:** `docs/anilist-spike.md` (what AniList offers, for the AniList side of the eventual three-way merge in Mode 1).

---

## 1 · `animeData.js` — fully documented (read from source 2026-05-09)

Each entry in the `animeData` array is a flat object with these 12 fields:

| Field | Type | Required? | Example | Notes |
|---|---|---|---|---|
| `Title` | string | yes | `"Charlotte"` | Capitalized field name. The display title. |
| `Genre` | string | yes | `"Thriller / Supernatural"` | Single string with `" / "` joining 1-2 genre tokens. NOT an array. |
| `Rating` | string | yes | `"9/10"`, `"8.5/10"`, `"15/10"` | Always with `/10` suffix. Decimals OK. Joke values like `"15/10"` exist (Attack on Titan). |
| `image` | string | yes | `"charlotte.png"` | Filename within `assets/`. **Lowercase field name** (the only one). PNG format throughout the dataset. |
| `Seasons` | string | yes | `"1 season"`, `"2 seasons"`, `"1 season, 1 movie"`, `"5 seasons, 3 movies"` | Free-form English. Parser would need to handle multiple patterns. Sometimes `"171 episodes"` for very long shows (Black Clover). |
| `Description` | string | yes | `"A group of high school students with..."` | 1-2 sentence factual blurb. Written by Blake. |
| `Review` | string | yes | `"I originally clicked on this anime..."` | Paragraph-length personal review. Written by Blake. |
| `Tags` | array of strings | yes | `["existential-questions", "drama", "supernatural"]` | Kebab-case strings. Curated by Blake; project-flavored vocabulary like `"aura-farming"`, `"op-mc"`. |
| `Studio` | string | yes | `"P.A. Works"`, `"MAPPA"` | Single string. Most anime have one studio. |
| `Platforms` | array of strings | yes | `["Crunchyroll", "Netflix", "hianime", "9anime", "aniwave"]` | Includes both official platforms AND unofficial sites (hianime/9anime/aniwave). Blake-curated. |
| `Trailer` | string | yes | `"https://www.youtube.com/embed/kU5tGma7LaU"` | Full YouTube embed URL. The `/embed/` path segment is required for the iframe to work. |
| `Top10Rank` | number | optional | `1`, `8` | Only present for the ~10 anime in Blake's curated Top 10 list. Integer 1-10. |

**Total entries:** 186 occurrences of `Title:|Trailer:|Studio:` patterns suggest ~46-47 anime currently in the file (3-4 fields per anime ÷ 186 ≈ 47).

**Schema observations:**
- Field naming is *almost* PascalCase except `image` is lowercase. Inconsistency worth flagging.
- `Genre` and `Tags` use different shapes (string vs array) for what's conceptually similar data.
- `Rating` is a string not a number, so sorting/filtering requires parsing.
- No stable cross-source ID (AniList ID, MAL ID) — each entry is identified only by `Title`.

---

## 2 · Pre-Excel notes (`All anime reviews .txt`) — documented

The original notes file has a simpler shape — predates both Excel and animeData.js. Structure:

```
Category: (e.g., "Shonen/Action:", "Romance/Slice of Life:")
Title - Rating/10 (Seasons) [optional age gate like (18+) or (16+)]
    • One-line description
    • Paragraph review
```

Notable differences from `animeData.js`:
- `(18+)` / `(16+)` age gates are recorded in the .txt but DROPPED from `animeData.js`. Worth deciding if this should be a new field.
- Categories are headers (organizational structure), not per-anime fields. The `animeData.js` `Genre` field is a per-anime denormalization.
- No Studio, Platforms, Trailer, Image, Tags, or Top10Rank. The .txt was Blake's first pass; the richer fields were added later.

The .txt isn't canonical and isn't part of the deploy pipeline — it's historical context. **Decision recommendation:** treat `All anime reviews .txt` as archival only; don't try to sync from it.

---

## 3 · `Anime_Master_Table.xlsx` — PENDING (need Blake input)

**Blocked:** the Cowork sandbox can't open `.xlsx` files from `Master List/` in this session — the FUSE mount accepts the directory listing but rejects file open with `FileNotFoundError`. Possibly a timing issue (mount lag after the recent project move), possibly a permission setting on the Master List folder.

**Question for Blake (one of these would unblock):**

1. **Open the Excel file in Excel and tell me the column headers** (just the row 1 cell values) — that's the minimum information I need to design the sync script. Format: comma-separated list, e.g. `Title, Genre, Rating, Episodes, ...`
2. **Save a copy as CSV** at `Master List/Anime_Master_Table.csv` — text files in that folder ARE readable from this environment (verified with the .txt). I can then read columns + a few sample rows directly.
3. **Take a screenshot of the first 3 rows** and paste it in chat. I can read that.

Whichever is easiest. Once I have the column structure, I can finish this doc and then build the sync script with confidence.

**Best-guess Excel structure (based on `animeData.js` shape):** at minimum the same 12 fields. Probably also has additional bookkeeping columns Blake added for tracking — could include things like watch date, streaming service watched on, recommendation flags, source platform (Crunchyroll/Netflix/etc), or audience rating. *This guess is unverified — don't use it for code.*

---

## 4 · The eventual three-way merge for Mode 1

Once Phase A (Excel sync) ships and Mode 1 is being built, every anime entry has THREE potential sources for each field:

| Source | Authority | Updated when |
|---|---|---|
| **Excel master** | Canonical per project rule #1 | Blake edits in Excel; Mode 1 writes after save; Mode 2 writes during weekly sync |
| **AniList** | Authoritative for objective facts (genres, episodes, AniList score, trailer, cover URL) | Whenever Mode 1 fetches |
| **`animeData.js`** | Output target; should never be edited directly | Generated from Excel by `scripts/sync-excel-to-js.js` |

**Per-field authority matrix:**

| Field | Source of truth | Notes |
|---|---|---|
| `Title` | Excel | Blake's exact wording (matches the displayed name on the site) |
| `Rating` | Excel | Blake's personal score |
| `Review` | Excel | Blake's personal review |
| `Description` | Excel (Blake-written) OR AniList (auto-fetched) — Blake decides per-anime | New field decision: do we keep Blake's hand-written 1-sentence version, or use AniList's longer version? See decision needed in §6. |
| `Genre` | Excel (Blake's curated 1-2 genre split with `/`) | NOT auto-fetched from AniList because AniList returns 5+ genres and Blake's curation is the personal voice. |
| `Tags` | Excel (Blake's kebab-case vocabulary) + AniList rank-filtered (auxiliary) | Two columns in Excel: `Tags` (Blake) and `AniListTags` (auto). |
| `Studio` | AniList (filtered to animation studios) | Excel can override if Blake disagrees with AniList. |
| `Seasons` | Excel (free-form English Blake writes) | NOT auto-fetched — Blake's phrasing is descriptive ("1 season, 1 movie") which AniList doesn't directly express. |
| `Platforms` | Excel (Blake's curated list, can include unofficial sites) | Mode 1 prefills from AniList's `externalLinks` (STREAMING type) but Blake's edits win. |
| `Trailer` | AniList (constructed `/embed/` URL) | Excel can override if Blake prefers a different trailer. |
| `image` | AniList (downloaded into `assets/` per hybrid rule #9) OR Blake's manual override | Per updated rule #9 (2026-05-09 hybrid). |
| `Top10Rank` | Excel | Blake's curation only. |
| **NEW: `AniListId`** | AniList | Stable cross-source ID; primary key for re-fetches. |
| **NEW: `IdMal`** | AniList | MyAnimeList ID; useful for future MAL/Jikan integration. |
| **NEW: `AniListScore`** | AniList | 0-100 community average; powers v1.6.2 / v1.8.0 features. |
| **NEW: `AniListColor`** | AniList | Dominant color hex; powers theming experiments. |

---

## 5 · Decisions Phase A (v1.5.0) needs to make

Before writing `scripts/sync-excel-to-js.js`:

1. **Field naming convention** — Excel column names probably use spaces (e.g. `Anime Title`); JS field names are PascalCase (`Title`). Define the mapping table explicitly. Don't try to auto-translate. *(Pending Excel inspection.)*

2. **`image` field — lowercase or PascalCase?** Currently `animeData.js` uses lowercase `image` (the only lowercase field). Either change the JS field name to `Image` to match the rest, or keep the inconsistency for backward-compat. **Recommendation:** keep lowercase — changing it would require touching every render call in `script.js` (~4000 lines) and risk regressions. Document the inconsistency in CLAUDE.md as known.

3. **What to do with `(18+)` / `(16+)` age gates** that exist in `.txt` but not in `animeData.js`? Three options:
   - (a) Add an `AgeRating` field everywhere; populate from Blake's notes; surface in UI.
   - (b) Add an `IsAdult` boolean (matches AniList field name); simpler.
   - (c) Skip — Blake's audience is mostly adults; not gating content gains anything.
   - **Recommendation:** (b) — adds a useful field, matches AniList naming, doesn't require UI changes initially.

4. **Validation rules for the sync script:**
   - Trailer URL must contain `/embed/`
   - Rating must match `^\d+(\.\d+)?/10$`
   - No duplicate Titles in the whole file
   - All required fields non-empty
   - Image filename references a file that exists in `assets/`
   - **Recommendation:** ALL of the above. Sync should fail loudly on validation errors, not silently produce a broken `animeData.js`.

5. **Sync direction:** Excel → animeData.js, one-way for v1.5.0 (per ROADMAP). Two-way (Mode 1 writing back to Excel) lands when Mode 1 ships in v1.6.0.

6. **Order preservation:** `animeData[animeData.length - 1]` is the "Latest Anime Drop" on the homepage (per `ARCHITECTURE.md`). The sync script must preserve insertion order — sorting alphabetically would change which anime is featured. **Recommendation:** Excel column called `Order` (integer, monotonic); sync script sorts by it. Default to a "added timestamp" column if the Order column doesn't exist yet.

---

## 6 · Open question for Blake

Before I can finish this doc and start the sync script:

**Send me the column headers from row 1 of `Anime_Master_Table.xlsx`** (just the cell values, comma-separated).

Easiest: open the file in Excel, look at row 1, type out the headers in chat. Takes 30 seconds.

Once I have those, I can:
- Finish §3 of this doc with the actual Excel structure
- Build the explicit field mapping table for the sync script
- Confirm whether the new fields proposed in §4 are already there or genuinely new
- Then start `scripts/sync-excel-to-js.js`
