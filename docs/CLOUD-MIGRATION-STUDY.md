<!-- author: Code | date: 2026-08-09 -->
# GATE-0 DESIGN STUDY — Cloud Admin: moving the data master off Excel

> **Status: PLAN ONLY. Nothing built, nothing changed.** Blake asked (2026-08-09): *"I want to move my data to the cloud instead of excel sheets."* This is the gate-0 study the project's own convention requires before a build this size (NEXT.md:74 already calls for exactly this and notes it "retires/reworks project rule #1").

## ⚡ READ-FIRST — the one-breath version
- **The site keeps loading a static `animeData.js`. Firestore becomes where you AUTHOR, not what visitors read.** A "Publish" step regenerates `animeData.js` from the database and deploys it. This is the single most important decision in the study — it's why the migration is safe instead of a rewrite (see §3).
- **What you gain:** edit reviews from your phone, no laptop, no Excel, no `npm run mode1`. Real revision history with undo. And the Part 0 bug class (a stale master silently overwriting your reviews) becomes structurally impossible.
- **What it costs:** ~5 phases, each independently shippable and reversible. Phase 1+2 alone (DB + publish) already kills the Excel-overwrite risk.
- **Do this BEFORE Mode 2** — Mode 2 wants to run unattended in the cloud on a schedule, and it cannot safely reach an .xlsx that lives on your desktop outside the repo. See `MODE-2-STUDY.md` §1.

## 1. Why now — the Part 0 evidence
This isn't a preference, it's a post-mortem finding. On 2026-07-08 we recovered 4 reviews that had been silently reverted since **2026-05-09**: the v1.5.0 Excel→JS sync regenerated `animeData.js` from a master whose content lineage was stale, overwriting hand-authored review text. Nobody noticed for two months, because:
1. The Excel master lives **outside the git repo** (`../Master List/`), so it has **no version history** — only ad-hoc `.bak.<ts>.xlsx` copies.
2. The sync is a **blind full regeneration** — it has no concept of "this field got shorter, is that intended?"
3. There is **no audit trail** of who/what changed a cell, or when.

A cloud store with per-document revision history fixes all three by construction. **That is the core justification for this work.**

## 2. What exists today (verified, not assumed)
| Piece | Reality |
|---|---|
| Source of truth | `Master List/Anime_Master_Table.xlsx` — 44 rows, outside the repo, outside the deploy root, no git history |
| Generator | `scripts/sync-excel-to-js.js` — the **only** writer of `animeData.js` |
| Site data file | `animeData.js` — 62KB, `const animeData = [...]`, **classic script, synchronous, top-level lexical const** |
| Excel writers | 6 scripts: mode1-server, anilist-backfill, backfill-platforms, backfill-watched, strip-unofficial (+ the sync's image round-trip) |
| Readers | ~16 files across 4 realms (global const, `window.__ANIME_DATA__`, `window.animeData`, Node scripts, Playwright `page.evaluate`) |
| Tests coupled to the catalog | ~20 of 69 spec files |
| Already in Firestore | **Only member content + thin curation state** (`animeStatus/{slug}`, `curatorNotes/{slug}`). No review prose, no catalog |
| Authoring UI today | `npm run mode1` → a **localhost-only** Express server on 127.0.0.1:8888, driven from a `.bat` file on your PC |

**The thing to notice:** you already run a real cloud backend — Firestore, Auth, Storage, and **40 gen-2 Cloud Functions** including a scheduled one (`reapOrphanUploads`, every 24h). This migration doesn't add a new platform. It moves 44 rows onto infrastructure you already operate.

## 3. THE KEY DECISION — static publish, not live reads
Two ways to "move data to the cloud." They are not close.

| | **A. Live reads (site fetches Firestore)** | **B. Static publish (RECOMMENDED)** |
|---|---|---|
| Site boot | Async — **breaks** the synchronous `const animeData` contract, `validateData(animeData)` at init, and the "animeData.js not loaded" guard | Unchanged. `animeData.js` still ships as a static file |
| Tests | ~20 catalog-coupled specs need rework | Pass untouched |
| Cost | 44 doc reads **per visitor**, scales with traffic | **Zero** read cost for visitors |
| Speed | Extra round-trip before first paint | CDN-fast, same as today |
| Offline / CDN | Degrades | Unaffected |
| Risk | High — a boot-path rewrite on a live site with real members | Low — the site literally cannot tell the difference |

**Decision: B.** Firestore becomes the **authoring** store. A publish step regenerates `animeData.js` byte-for-byte the same way the sync does today, then deploys. This is the standard "headless CMS with static publish" shape, and it means the entire migration is invisible to visitors — which is exactly what you want on a live site.

> Rule of thumb worth keeping: **44 rows that change a few times a week do not belong in a per-request query.** They belong in a file on a CDN.

## 4. The data model
New collection `catalog/{animeId}` — one doc per anime, mirroring today's 21 emitted fields plus three the migration must add.

```
catalog/{animeId}
  # identity (immutable after creation)
  animeId      string   # stable doc id, NEVER changes  (e.g. "attack-on-titan")
  slug         string   # == today's slug(Title); the Firestore room key. Immutable.
  order        number    # explicit ordering — replaces "Excel row order"

  # Blake's voice — MODE 2 MAY NEVER WRITE THESE
  Title, Rating, Review, Description, Tags[], Top10Rank

  # catalog facts — safe for automated sync
  Genre, Seasons, Studio, Platforms[], Trailer, image
  AniListId, IdMal, AniListScore, AniListColor
  TitleEnglish, TitleRomaji, TitleNative
  WatchedAniListIds[], KnownAniListIds[]

  # provenance (new)
  updatedAt, updatedBy   # "blake" | "mode2" | "migration"
  publishedAt            # last time this row reached the live site

catalog/{animeId}/revisions/{revId}     # append-only history — the anti-Part-0 layer
  at, by, fields{ before, after }, note
```

**Three fields the migration must invent** (they don't exist in Excel today):
1. **`order`** — Excel row order is semantic: `animeData[animeData.length - 1]` is "the latest drop" (`script.js:3555`), pinned by `tests/foryou-surface.spec.js:121`. A database returns rows in whatever order you ask for, so ordering must become explicit data.
2. **`image`** — there is **no Excel Image column**; the filename round-trips through `animeData.js` itself (`sync-excel-to-js.js:160-180`). The migration seeds it from the current `animeData.js` and the DB owns it from then on.
3. **`slug`** — see the trap below.

### ⚠️ The one genuinely dangerous coupling: Title is a primary key
`slug(anime.Title)` is the Firestore room id for **comments and community reviews** (`script.js:4052-4078`), the card `animeId`, and the `?open=` deep-link id. Today, renaming an anime silently orphans its entire comment thread.

**Mitigation (do this in Phase 1, it's cheap):** store `slug` as an explicit immutable field, decoupled from `Title`. Renaming the title then becomes safe. There's already a precedent for retagging when a slug must move — the `migrateRequestThread` callable CF.

## 5. Phases — each one shippable and reversible
| Phase | What ships | Why it's safe | Value delivered |
|---|---|---|---|
| **0. Snapshot** | Tag a commit; hash-verified Excel backup; freeze the schema in this doc | Nothing changes | A known-good rollback point |
| **1. The store** | `catalog/{animeId}` + rules (public read, admin-only write) + a one-shot import script | **Nothing reads it yet.** Excel still canonical | Data is in the cloud, backed up, versioned |
| **2. Publish pipeline** | "Publish" action regenerates `animeData.js` from Firestore, reusing today's `renderJsFile` | **Verified by byte-equality** (see §6). Excel remains a parallel fallback | Excel is no longer load-bearing |
| **3. Cloud Admin UI** | Existing admin pages write Firestore instead of the localhost Express server | Additive; the local server keeps working until you retire it | **📱 Edit from your phone. The actual thing you asked for** |
| **4. Safety layer** | `revisions/` history + undo + the shrink tripwire | Pure addition | Part 0 can never silently repeat |
| **5. Retire Excel** | Excel becomes a *download/export*, not the source. Rewrite project rule #1 | Only after 1-4 are proven | One source of truth |

**You could stop after Phase 2** and already have the safety win. Phase 3 is where the daily-life improvement lands.

## 6. The verification that makes this trustworthy
The migration has one killer test, and it's the reason this can be done with confidence:

> **Import Excel → Firestore, then generate `animeData.js` from Firestore, and assert the output is byte-identical to the current committed `animeData.js`.**

If those bytes match, the database provably contains exactly today's catalog — no drift, no re-encoding, nothing lost. That single assertion covers all 21 fields across all 44 rows. It becomes a permanent CI test (`npm test`) so the generator can never regress.

Plus: full suite at floor (285/204/77/78/25) at every phase; the shrink tripwire from Part 0; and a preview-channel deploy before prod, per the ladder.

## 7. Cost
Firestore's free tier is 50k reads / 20k writes per day. This migration adds **44 documents** and, with static publish, **zero per-visitor reads**. Authoring writes are a handful per day.
**Expected additional cost: $0/month.** (It would NOT be $0 under option A at scale — another reason for B.)

## 8. Risks, honestly
| Risk | Severity | Mitigation |
|---|---|---|
| Boot-path breakage | **Was** the top risk | Eliminated by choosing static publish |
| Title/slug rename orphaning comments | High | Immutable `slug` field in Phase 1 |
| Losing array-order semantics | Medium | Explicit `order` field + the existing pinning test |
| Generator drift vs the old sync | Medium | Byte-equality test (§6) |
| A new data file missing from bump TARGETS | Medium — **has bitten 3×** | If any new versioned surface appears, add it to `bump-version.js` TARGETS in the same gate |
| A service-account key leaking to the public site | **Critical** | Prefer CF-side publishing (no local key). If any key file appears, it goes in `.gitignore` **and** `firebase.json` ignore in the same change (rule #5), verified by a 404 curl |
| Two sources of truth during Phases 1-2 | Medium | Time-boxed; Excel is read-only fallback, and the byte-equality test proves parity |

## 9. Open questions for Blake
1. **Phone-first?** Should Phase 3's admin UI be designed mobile-first (you'd be editing from your phone), or desktop-first with mobile as a bonus? *(Recommendation: mobile-first — it's the whole point, and it forces the responsive work Part A item 4 is already about.)*
2. **Keep an Excel export button?** *(Recommendation: yes — a "Download master .xlsx" keeps your comfort blanket without it being load-bearing.)*
3. **Publish = one click, or auto-publish on save?** *(Recommendation: explicit Publish. Saving a half-written review shouldn't reach the world.)*
