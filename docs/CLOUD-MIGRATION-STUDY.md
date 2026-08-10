<!-- author: Code | date: 2026-08-09 -->
# GATE-0 DESIGN STUDY — Cloud Admin: moving the data master off Excel

> **Status: PHASE 0 COMPLETE · PHASE 1 BUILT AND PROVEN (not imported to prod).** Blake asked (2026-08-09): *"I want to move my data to the cloud instead of excel sheets"* and then *"start cloud phase 0 and 1."* See §11 for what actually ran.

## ✅ 11. PHASE 0 + 1 — EXECUTION RECORD (2026-08-09)
**Artifacts:** `Master List/_migration_2026-08-09/` (sibling of the repo — outside git and outside the deploy root, so nothing can leak).

### Phase 0 — the snapshot (`scripts/catalog-snapshot.js`)
| Backup | Result |
|---|---|
| Excel master, byte-copied + hash-verified | 294,688 bytes · sha256 `1b04633608e7e3a8…` ✓ re-hashed after copy |
| `animeData.js` as shipped | 63,778 bytes · sha256 `79dd3213546f19ce…` |
| Plain-JSON export of all rows × fields | 44 entries |
| **Fidelity baseline** (per-review char count + SHA) | 44 reviews · **22,406 review chars** · 21 distinct fields |
| git HEAD at snapshot | `f03bc3ff` |

**⚠️ The cross-check earned its keep immediately.** Excel reported 22,431 review chars vs animeData's 22,406 — a 25-char divergence. Diagnosed to completion: **25 reviews carry a single trailing space in Excel that the sync trims. Zero content differences.** Recorded here so it is never re-investigated. *Design consequence:* the catalog store seeds from `animeData.js` (the trimmed, shipping truth), which is also why the byte-equality gate below is honest.

### Phase 1 — the store, built and PROVEN (`catalog-export.js` → `catalog-verify.js`)
44 Firestore-shaped documents built offline, then the acceptance gate run. **All ten gates green:**

| Gate | Result |
|---|---|
| `order` dense 0..43, reproduces the live sequence | PASS — "latest drop" preserved |
| **BYTE-EQUALITY: generated body === live body** | **PASS — exact byte match** |
| Whole-file reconstruction | PASS — 63,778 == 63,778 bytes |
| Every field on every row round-trips | PASS — 21 fields × 44 rows |
| No field went non-empty → empty | PASS — none |
| Per-review char count + SHA vs baseline | PASS — 44 reviews, 22,406 chars |
| Total review text unchanged | PASS |
| `animeId` unique / `slug` non-empty | PASS — 44 ids |

**What this proves:** the cloud representation contains *exactly* today's catalog — every field, every character, every review. Nothing is lost, and that is now a machine-checked fact rather than a promise.

### Also shipped this phase
- **`scripts/lib/catalog-model.js`** — ONE definition of the slug, the document shape and the renderer, shared by the exporter, the verifier and the test, so they cannot drift. *(The live `sync-excel-to-js.js` keeps its own renderer copy — deliberately untouched; the byte gate pins them together and Phase 2 retires the duplicate.)*
- **`tests/catalog-migration.spec.js`** — 6 permanent tests, including the byte-equality round-trip and a guard asserting the catalog slug still equals `card-render.js`'s live comment-room key. **Floor 285 → 291.** Full suite green.
- **`firestore.rules`** — a staged `catalog/{animeId}` block (public read, admin-only write, immutable identity) plus append-only `revisions/` and an admin-only `draft/` for the phone↔desktop hand-off. **Written, NOT deployed.**
- **`scripts/catalog-import.js`** — dry-run by default, emulator by default; refuses `--prod` without `--blake-said-go`; re-runs the verification gate before touching anything; refuses to run against a non-empty collection; reads every doc back and re-proves field equality.

## ✅ 12. PHASE 2 — THE PUBLISH PIPELINE (2026-08-09)
Blake: *"start phase 2."* **Excel is no longer load-bearing.** The database can now produce the site's data file, proven end-to-end through a real Firestore.

### What shipped
1. **One renderer, shared** — `sync-excel-to-js.js` no longer carries its own copy of the animeData.js formatter; both the Excel path and the cloud Publish path emit through `lib/catalog-model.js` `renderBody()`. That makes "Excel and the database produce identical output" a structural fact rather than a coincidence. **Verified on the shipping pipeline itself:** a real `npm run sync` after the refactor produced **0 non-timestamp changed lines**.
2. **`scripts/catalog-publish.js`** — regenerates `animeData.js` from the catalog store. Sources: `--from=json` (offline), `--from=emulator`, `--from=prod` (refused without `--blake-said-go`). Dry-run by default; backs up the previous `animeData.js` to `Master List/_publish-backups/` before any write.
3. **🚨 THE SHRINK TRIPWIRE, pulled forward from Phase 4** — it guards the publish step, so it belongs on it. Refuses to publish when total review text shrinks >2%, or any single review shrinks >25% / >150 chars, or a title vanishes. `--force` overrides, loudly.

### The proof that matters
**Replayed the actual May 2026 regression against it.** Feeding the tripwire a catalog where Rascal's review is the 209-char stub that really shipped:
```
⛔ PUBLISH REFUSED — review text would be lost:
  ✗ total review text shrank 501 chars (2.24%) — limit 2%
  ✗ "Rascal Does Not Dream of Bunny Girl Senpai" review shrank 710 → 209 (−501 chars, 70.6%)
```
**The event that cost Blake four reviews for two months would now be stopped before it reached the site.** It also does **not** false-alarm on an ordinary copy-edit — a guard that cries wolf gets switched off, which is worse than no guard.

### Full round-trip through a real Firestore (emulator, `emulators:exec`)
`import → read back → publish from the database`:
- Wrote 44 documents to `catalog/`
- **Read-back verified — every field of every document matches the source exactly**
- Published from Firestore → **body identical to what is live**; tripwire clean (22,406 → 22,406 chars)
- Emulator shut down cleanly; `animeData.js` untouched (dry run)

### Notes
- **Line endings:** git's autocrlf checks `animeData.js` out as CRLF while every generator writes LF, so a *raw* comparison reports a phantom ~1-byte-per-line difference. All comparators normalise and say so explicitly. Data is unaffected; `git status` stays clean.
- **Tests: floor 291 → 296** (5 new: tripwire pass/refuse-May-regression/refuse-missing-title/no-false-alarm, plus a guard that fails if anyone reintroduces a second renderer). Full suite green.

## ◐ 13. PHASE 5 — RETIRE EXCEL (2026-08-09: the export is BUILT; the switch is NOT thrown)
Phase 5 is three things. **One is done, two are correctly blocked** — Excel is still the live master until the prod import runs, so flipping the rule now would make the docs lie.

| | Status |
|---|---|
| **1. Excel becomes a download** | ✅ **Done.** `scripts/catalog-to-xlsx.js` (`npm run catalog:xlsx`) rebuilds a real .xlsx from the catalog in the master's own column order. Verified: 44 rows, review text `22406 → 22406` chars, only the reference-only `FORMAT:`/`EXAMPLE:` columns dropped. Sources: json / emulator / prod (prod refused without `--blake-said-go`). |
| **2. Publish replaces sync** | ⛔ **Blocked on the prod import.** `npm run sync` must stay the live path until the catalog exists in production. |
| **3. Rewrite project rule #1** | ⛔ **Blocked on 2.** Drafted below, deliberately not applied. |

### The rule #1 rewrite, drafted (apply only after the prod import + a clean publish)
> **1. The catalog is canonical.** `catalog/{animeId}` in Firestore is the source of truth for anime data. `animeData.js` is generated from it by `npm run catalog:publish` — never hand-edited. Excel is an **export** (`npm run catalog:xlsx`), not an input; the old `Master List/Anime_Master_Table.xlsx` is archived, not deleted. Every write keeps an append-only revision, and publish refuses to ship a material shrink in review text.

Also to change in the same gate: `CLAUDE.md` rule #1 + its READ-FIRST line, `ROADMAP.md` project rules, and the `sync-excel-to-js.js` header (point it at the archive).

### 🔴 What is deliberately NOT done (awaiting Blake's word)
1. **No documents written to production Firestore.** The import is built, guarded, and dry-run tested only.
2. **`firestore.rules` NOT deployed** — a rules deploy touches live member data and follows the full runbook order.
3. Nothing pushed, nothing deployed.

**Rollback for everything above:** delete `Master List/_migration_2026-08-09/` and revert the commit. No production state was touched.

---

> Original study follows. Blake asked (2026-08-09): *"I want to move my data to the cloud instead of excel sheets."* This is the gate-0 study the project's own convention requires before a build this size (NEXT.md:74 already calls for exactly this and notes it "retires/reworks project rule #1").

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

## 9. DECISIONS — LOCKED by Blake 2026-08-09
1. **Phone and desktop are BOTH first-class, and work carries between them.** Blake: *"phone and desktop should be asynchronous."* Interpreted as: neither device is "the" version; a draft started on the phone is resumable at the desk. **Implication — drafts are server-side, not device-local:** every edit autosaves to `catalog/{animeId}/draft` (separate from the published fields), with a "last edited on <device> at <time>" line and last-write-wins + a conflict notice if two devices diverge. This is a real Phase 3 requirement, not a nicety. *(If Blake meant something else by "asynchronous," this is the assumption to correct.)*
2. **Keep a "Download master .xlsx" export.** ✅ Confirmed.
3. **Explicit Publish button** — never auto-publish on save. ✅ Confirmed.

## 10. 🔒 THE NO-LOSS GUARANTEE
> Blake, 2026-08-09: *"its really important that nothing is lost with the cloud move."*

He has already lost review text once (Part 0). This section is the answer, and it is the acceptance criterion for the whole migration: **no phase may proceed unless the check below passes.**

### The nine-part protocol
1. **Three independent backups before anything moves** — (a) hash-verified copy of `Anime_Master_Table.xlsx`, (b) a git tag on the exact commit, (c) a plain-JSON export of all 44 rows × 21 fields. Stored outside the working folder. Recorded hashes go in this doc.
2. **The migration is ADDITIVE-ONLY.** Phase 1 writes to a *new* collection. It modifies nothing, deletes nothing, and does not touch Excel or `animeData.js`. Rollback = delete the collection. There is no destructive step until Phase 5, and by then five verifications have passed.
3. **The byte-equality gate.** Generate `animeData.js` *from Firestore* and require it to be **byte-identical** to the committed file. One byte off = migration halts. This single check covers all 21 fields × 44 rows at once.
4. **Field-level completeness audit.** For every row, assert each of the 21 fields is present and equal. Explicitly flag any field that is non-empty in Excel but empty/null in the DB — that's the classic silent-loss shape a byte check on a *regenerated* file could theoretically mask.
5. **Character-fidelity check — the encoding trap, generalized.** This project has been bitten twice: openpyxl re-encoded every multi-line cell (`\r\r\n`→`\r\r\r\n`), and the Edit tool has silently converted straight quotes to curly. So the audit asserts, per review: exact character count, exact SHA of the text, **no line-ending mutation, no smart-quote conversion, no whitespace normalization.** Reviews are the crown jewels and get their own per-review hash table, recorded before and after.
6. **Dual-run period.** For an agreed window (suggest 2-4 weeks), generate from **both** Excel and Firestore on a schedule and diff them. Any divergence raises an alarm. Excel remains a live, working fallback the entire time.
7. **The shrink tripwire** (from Part 0's prevention item) — refuse to publish if total review text shrinks >2%, or any single review shrinks >25% / >150 chars, without an explicit force. This is the alarm that was missing in May.
8. **Nothing is ever deleted.** At Phase 5 Excel is *archived*, not removed. And once `revisions/` exists (Phase 4), even a bad edit is one click from being restored — a guarantee Excel never provided.
9. **Per-phase rollback, written down before the phase starts.** Each phase states its undo. Phases 1-2 are pure additions; Phase 3 keeps the local server working alongside; Phase 4 is additive; only Phase 5 changes the rule, and only on Blake's word.

### What "nothing is lost" concretely means here
| Asset | How it's protected |
|---|---|
| 44 review texts (the crown jewels) | Per-review SHA + char count, before/after; byte-equality; shrink tripwire; 3 backups |
| The other 20 fields × 44 rows | Field-level completeness audit + byte-equality |
| Images | Untouched — files stay in `assets/`; only the *filename* moves into the DB |
| Comments / community reviews / member data | **Not touched by this migration at all** — they already live in Firestore under `slug` keys, and the immutable-`slug` decision (§4) is precisely what keeps them attached |
| Season reviews (`season-reviews/*.md`) | Out of scope for Phases 1-2; migrated later with the same protocol |
| Excel itself | Archived, never deleted |

**Bluntly: the risk of losing data by staying on Excel is currently higher than the risk of moving.** Excel has no history and no alarms — that's what let May's loss run for two months. The migration ends with strictly more safety than it starts with.
