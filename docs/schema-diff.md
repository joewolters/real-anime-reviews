<!-- author: Code | date: 2026-05-09 -->
# Schema Diff — Excel ↔ animeData.js ↔ AniList

> **Status:** COMPLETE (2026-05-09). All three sources documented. Excel side resolved by Blake exporting a CSV copy after the Cowork sandbox couldn't open `.xlsx` directly. Schema-diff is now ready to inform `scripts/sync-excel-to-js.js` design (v1.5.0).
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

## 3 · `Anime_Master_Table.xlsx` — documented (read from CSV export 2026-05-09)

Blake exported a CSV copy at `Master List/Anime_Master_Table_for_claude.csv` to bypass a Cowork sandbox restriction on reading `.xlsx` from `Master List/`. The column structure below is from row 1 of that CSV. The `.xlsx` itself remains canonical; the CSV is a one-time read aid for designing the sync script.

**Excel columns (in order):**

| # | Column | Real data? | Notes |
|---|---|---|---|
| 1 | `Title` | yes | Anime title — direct match to animeData.js `Title` |
| 2 | `Rating` | yes | Like `7/10`, `9/10` — direct match to animeData.js `Rating` |
| 3 | `Seasons` | yes | Like `2 seasons, specials`, `5 seasons`, `1 season` — direct match to `Seasons` |
| 4 | `Genre` | yes | Like `Shonen/Action` — direct match to `Genre` |
| 5 | `Description` | yes | 1-2 sentence factual blurb — direct match to `Description` |
| 6 | `Review` | yes | Paragraph review (some entries span multiple lines via quoted CSV) — direct match to `Review` |
| 7 | `Tags` | yes | **Format mismatch** — Excel uses `#action #animation #comedy` (hashtag-prefixed, space-separated string); animeData.js uses `["action", "animation", "comedy"]` (array of kebab-case strings, no `#`). Sync needs to strip `#`, lowercase, replace spaces with hyphens. |
| 8 | `Watch` | yes | **Name mismatch + format mismatch** — Excel calls this `Watch`, animeData.js calls it `Platforms`. Excel: comma-separated string. animeData.js: array. Sync needs to split-on-comma + trim + array. |
| 9 | `Studio` | yes | Sometimes multiple studios comma-joined (`Madhouse, J.C Staff`). animeData.js stores as single string. Decision needed (see §5). |
| 10 | `Trailer` | yes | **Format inconsistency** — most entries have correct `youtube.com/embed/` URL, but some have the `youtu.be/` share URL with `?si=` tracking params (e.g., Demon Slayer). Sync needs to normalize. |
| 11 | `FORMAT:` | NO | Reference column with format instructions (e.g., `https://www.youtube.com/embed/VIDEO_ID` as a template reminder). **Sync script must ignore this column.** |
| 12 | `EXAMPLE:` | NO | Reference column with example content. **Sync script must ignore this column.** |

**Total real data columns: 10.** Two extra reference columns to ignore.

**Fields in animeData.js but NOT in Excel:**

- `image` — Excel has no image column. animeData.js has `image: "charlotte.png"`. Per the updated rule #9 (hybrid image curation, 2026-05-09), Mode 1 derives this either from AniList's cover URL (downloaded into `assets/`) or from Blake's manual override.
- `Top10Rank` — Excel doesn't track Top 10. This is a separate Blake curation.

**Decision needed for Top10Rank:**

- (a) Add a `Top10Rank` column to Excel; sync writes it through; only the ~10 entries in the Top 10 have a value.
- (b) Keep Top 10 in a separate file (`Master List/top10.csv` or hardcoded in `script.js`).
- **Recommendation:** (a) — keeps the single-source-of-truth principle (Excel canonical), and Top 10 management becomes a column edit in Excel.

---

## 3.1 · Data quality observations (from CSV scan)

Worth flagging — these don't block the sync script but Blake might want to clean them up in Excel either before or after Phase A ships:

1. **Trailer URL format inconsistency.** Most entries use `https://www.youtube.com/embed/VIDEO_ID` (correct, ready for the iframe). But some entries use the share URL `https://youtu.be/VIDEO_ID?si=tracking`. Examples:
   - One Punch Man: correct `/embed/` format
   - Demon Slayer: `https://youtu.be/VQGCKyvzIM4?si=zrdbFJO6sgvV-uJL` (needs normalizing to `https://www.youtube.com/embed/VQGCKyvzIM4`)
   - **The sync script will normalize these automatically** — Blake doesn't have to fix them by hand. But the validation report will list each one for awareness.

2. **`Watch` column comma-spacing.** Some entries have missing commas between platforms — e.g., One Punch Man has `Amazon Video, Hulu, Netflix hianime, 9anime, aniwave,` (note "Netflix hianime" with no comma between). Sync script will surface these as warnings but auto-split on comma.

3. **Genre typo: Solo Leveling has `Shoen/Action`** (missing the 'n' in Shonen). Genre dropdown filtering on the site might miss this entry. Worth fixing in Excel.

4. **Trailing comma in `Watch`.** Most entries end with a trailing comma (`...aniwave,`). Harmless — split-and-filter will handle it.

5. **Studio with multiple values** (e.g., `Madhouse, J.C Staff` for One Punch Man). Currently animeData.js has only single-string studios. Decision needed in §5 about whether to keep as comma-joined string or split.

6. **Newlines inside Review cells.** Some Review entries have actual newlines mid-paragraph (visible in the raw CSV as multi-line quoted fields). Valid CSV, but sync script needs to use a proper CSV parser, not naive line-splitting.

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

## 6 · Resolved questions and next steps

**Resolved (2026-05-09):**
- ✅ Excel column structure documented from CSV export (see §3)
- ✅ Field mapping table built (see §4)
- ✅ Data quality issues catalogued (see §3.1)
- ✅ Decisions for sync script enumerated (see §5)

**Open decisions Blake needs to make before sync script code is written:**

1. **Top10Rank location** — add a column to Excel (recommended, see §3) or keep separate?
2. **Studio field** — when Excel has `Madhouse, J.C Staff`, should animeData.js store it as one string `"Madhouse, J.C Staff"` (current behavior) or split into an array? (Recommendation: keep as comma-joined string — minimal site change.)
3. **Description: who's authoritative — Excel (Blake-written) or AniList (auto-fetched)?** Decision needed before Mode 1 ships, but the sync script (v1.5.0) only reads from Excel so this can wait until v1.6.0.
4. **`AniListId`, `IdMal`, `AniListScore`, `AniListColor` columns** — add to Excel before v1.5.0 ships, or after Mode 1 starts populating them? (Recommendation: add now as empty columns; v1.5.0 sync ignores empty values; v1.6.0 starts populating.)

**Next concrete step (when Blake green-lights):**

Build `scripts/sync-excel-to-js.js` per the v1.5.0 spec in `ROADMAP.md`. The script will:
- Read `Master List/Anime_Master_Table.xlsx` directly (using `xlsx` Node library — adds one dev dependency)
- Apply the field mapping in §4
- Run validation rules from §5 (item 4)
- Normalize trailer URLs to `/embed/` format
- Strip `#` prefix and lowercase tags
- Skip the `FORMAT:` and `EXAMPLE:` reference columns
- Output a `--dry-run` mode that shows the diff before any write
- On real run, regenerate `Current Version/animeData.js` with the new entries

Estimated session: 1-2 hours of careful work + your review of the dry-run output.
