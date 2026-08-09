<!-- author: Code | date: 2026-08-09 -->
# GATE-0 DESIGN STUDY — Mode 2, the autonomous site caretaker (+ its own page)

> **Status: PLAN ONLY. Nothing built.** Blake asked (2026-08-09) for the Mode 2 plan "including its own page." Mode 2 is described across ROADMAP/DECISIONS/AI-PRIMER but has **never had a design study, a data model, or a page** — this is that study. Everything below marked **[SPEC]** is quoted existing intent; everything marked **[NEW]** is a decision this study proposes and you approve or change.

## ⚡ READ-FIRST — the one-breath version
- **What Mode 2 is [SPEC]:** an unattended caretaker that wakes on a schedule (weekly), refreshes catalog facts from AniList, watches site health, and **sends you a report of everything it did and everything it merely noticed**. It is capped at PATCH-tier changes; anything bigger escalates to you.
- **The trust model [SPEC]:** *"Trust is earned through good reporting, not gated approvals"* (ROADMAP.md:58). The report **is** the product, not a side effect.
- **Build it AFTER the cloud migration.** Mode 2 must run unattended in the cloud; it cannot reach an .xlsx sitting on your desktop outside the repo. §1 explains why this is a hard blocker, not a preference.
- **The single most important design decision [NEW]:** Mode 2 is a **deterministic script with an LLM only in the report-writing step** — not an AI agent turned loose on your data. It physically cannot rewrite your prose (§4).
- **Its page [NEW]:** `/admin/mode2` — last run, pending proposals with Accept/Reject, full change history with undo, health status, escalations. Spec in §6.

## 1. The blocker nobody has reconciled — and how this study resolves it
The docs contain a real contradiction, and it must be settled before a line of code:

- Mode 2's responsibilities include **"keeps the Excel master in sync with every change it makes"** (ROADMAP.md:56), and its stated safety guarantee is **"Blake can always open Excel and see ground truth, including data Mode 2 changed while he wasn't watching"** (ROADMAP.md:66).
- But Cloud Admin is ordered **immediately before** Mode 2 and **"retires/reworks project rule #1 (Excel canonical)"** (NEXT.md:74, HANDOFF.md:26).

You cannot have both. **[NEW] Resolution: the cloud store replaces Excel as ground truth, and the `revisions/` audit trail replaces "open Excel and look" — with something strictly better.**

| The old guarantee | What replaces it |
|---|---|
| Open Excel, see the current values | Open `/admin/mode2`, see current values **plus what changed, when, why, and by whom** |
| Trust the file wasn't tampered with | Append-only revision history per field |
| No undo | **One-click undo** per change |

This is not a downgrade — it's the guarantee Excel was *trying* to provide, done properly. Excel could only ever show you the *current* state; it could never tell you what Mode 2 changed. (Part 0 is the proof: Excel showed a "ground truth" that had been silently wrong for two months.)

**Consequence:** Mode 2 is **Phase D — after** the cloud migration. Its scheduled runner becomes a Cloud Function, which is infrastructure you already operate (`reapOrphanUploads` is an existing `onSchedule` CF).

## 2. Mode 1 vs Mode 2 — the line the docs insist on [SPEC]
Rule #3 says these are separate AI systems and *"if a piece of code or doc is unclear which mode it serves, that's a smell"* (DECISIONS.md:123).

| | **Mode 1** (exists today) | **Mode 2** (this study) |
|---|---|---|
| Initiator | Human — you start it | **Scheduled, self-starting** |
| Trust gate | Manual approval before prod | **No per-change approval; reports instead** |
| Scope ceiling | Whole new anime entries | **PATCH-tier only; bigger escalates** |
| Autonomy | Low autonomy, high precision | High autonomy, **low per-change risk** |
| Images | Its territory | **Hard-blocked** (rule #9) |
| Where it runs | localhost Express, 127.0.0.1:8888 | **Cloud Function on a schedule** |

## 3. What Mode 2 does — the five jobs [SPEC]
1. **Data maintenance** — pull fresh AniList data, apply safe updates (season/episode counts, related anime, streaming links).
2. **Health monitoring** — uptime, console errors, broken links, missing assets.
3. **Content-quality watching** — stale info, things rendering wrong, drift.
4. **Sync the master** — *(reinterpreted per §1: write to the cloud store with an audit record)*.
5. **Report to you** — everything it changed **and** everything it noticed but didn't touch.

## 4. THE SAFETY SPINE — how Mode 2 is prevented from becoming Part 0 again
This is the section to read twice. Part 0 happened because an automated process overwrote your prose and nothing stopped it. Mode 2 is a *scheduled* automated process that writes data — i.e. exactly that hazard, on a timer. Four hard fences:

### Fence 1 — A field allowlist, enforced in security rules [NEW]
Not a convention. A rule. Mode 2 writes with its own service identity, and `firestore.rules` permits it to touch **only** these fields:

| ✅ Mode 2 MAY write | 🚫 Mode 2 may NEVER write |
|---|---|
| `Seasons`, `Platforms`, `Trailer` | **`Review`** — your prose |
| `AniListScore`, `AniListColor` | **`Rating`** — your verdict *(incl. AoT's deliberate 15/10)* |
| `TitleEnglish`, `TitleRomaji`, `TitleNative` | **`Description`**, **`Tags`**, **`Top10Rank`** |
| `KnownAniListIds` *(on accept — see Fence 4)* | **`Title`**, **`slug`**, **`image`** (rule #9), `order` |

The right-hand column is your voice and your identity. A rules-level denial means a bug in Mode 2 cannot reach them even if it tries. **This is the Part 0 lesson encoded as infrastructure.**

### Fence 2 — Deterministic engine, LLM only for prose [NEW]
Mode 2 is **not** an LLM agent with write access. It's a normal script: fetch AniList → diff against the store → apply allowlisted changes → write revisions. An LLM is used for exactly one thing: turning the diff into a readable weekly summary. **The model never decides what to write to your catalog**, so it cannot hallucinate a value into your data. (Cheap, too — one small summarization call per week.)

### Fence 3 — A change budget, then escalate [NEW]
Per run: **max 10 rows touched, max 3 fields per row, and no single field may change by more than 60% of its length.** Exceed any of those and Mode 2 makes **zero** writes, files an escalation, and reports. This directly answers the open question the docs never resolved ("is a 40-row refresh one PATCH?"). Answer: **no** — that's an escalation.

### Fence 4 — Propose, don't apply, for anything judgement-shaped [NEW]
Two-tier output. **Auto-apply:** objective facts (episode count, a new streaming platform, an AniList score). **Propose only:** anything interpretive — a "new arc surfaced," a better cover image (rule #9 forbids applying), a suspected stale description. Proposals land on the Mode 2 page for one-click Accept/Reject.

This also fixes a live bug in the existing spec: `KnownAniListIds` is currently **write-once** (excluded from Mode 1's edit allowlist, `mode1-server.js:188`). Without a re-baseline step, a "new arc surfaced" alert would re-fire **forever** on the same arc. **[NEW] Fix: accepting a proposal advances the snapshot; rejecting marks it dismissed so it stays quiet.**

## 5. The trust ladder — how it earns autonomy [SPEC + NEW thresholds]
Each rung runs for a stated period before the next unlocks. The docs demanded a ladder but never defined the rungs; these are proposed.

| Rung | Capability | Unlocks after |
|---|---|---|
| **1. Observer** | **Read-only.** Detects and reports; writes nothing | 4 clean weekly reports you agree with |
| **2. Facts** | Auto-applies the allowlisted AniList facts | 4 weeks, zero bad writes |
| **3. Health** | Broken-link + missing-asset fixes | 4 weeks at rung 2 |
| **4. Cruise** | Full PATCH-tier remit within the fences | Your call, no deadline |

**Start at rung 1 and stay there as long as you like.** A read-only Mode 2 that emails you "here's what drifted this week" is already most of the value, at zero risk.

## 6. 📄 ITS OWN PAGE — `/admin/mode2` [NEW]
You asked for the page specifically. Here's the spec, built to match the existing admin vocabulary exactly (the recon pinned these).

### Layout
```
┌─ MODE 2 · CARETAKER ─────────────────────── [Run now] ─┐
│  ● Healthy   Last run: Sun 2:00am   Next: Sun 2:00am   │
│  Rung 1 · Observer          Catalog: 44   Watched: 44  │
├────────────────────────────────────────────────────────┤
│  📺 NEW SEASONS (2)                                     │
│   • Frieren — S2 finished airing 12 Aug (12 eps)        │
│       ✍️ Season review due      [Write it] [Not yet]    │
│       📝 Main review says "1 season"                    │
│                                 [Update] [Still fine]   │
│   • Solo Leveling — S3 airing now (ep 4/12)             │
│       👁 FYI — review due when it finishes  [Dismiss]   │
├────────────────────────────────────────────────────────┤
│  ⚠ NEEDS YOU (2)                                        │
│   • Chainsaw Man — cover art changed on AniList         │
│              (images are yours — flag only) [Dismiss]   │
│   • Hell's Paradise — Hulu link 404s        [Details]   │
├────────────────────────────────────────────────────────┤
│  ✓ APPLIED THIS RUN (2)                                 │
│   • Solo Leveling · AniListScore 82 → 84       [Undo]   │
│   • Kaiju No. 8 · +Platform "Netflix"          [Undo]   │
├────────────────────────────────────────────────────────┤
│  👁 NOTICED, NO ACTION (4)                    [expand]  │
├────────────────────────────────────────────────────────┤
│  HISTORY  — every run, every field, before → after      │
│            filter by anime · by field · by date         │
└────────────────────────────────────────────────────────┘
```

### The four sections, and why each exists
1. **Needs you** — proposals + escalations. The only section that ever demands attention.
2. **Applied** — what it changed on its own, each with **Undo** (one click restores from `revisions/`). This is the trust-builder.
3. **Noticed** — the "everything it merely noticed" the spec insists on. Collapsed by default so it never nags.
4. **History** — the permanent audit trail. This is the thing Excel could never give you.

### Build requirements (from the recon — a new admin page must do all of these)
- **Gate:** the standard `onAuthStateChanged` + `ADMIN_UID` check with a hidden `<main>` shield; prefer the `curation.js` variant with the `rendered` latch.
- **Register in nav:** add to `ADMIN_MENU_ITEMS` in `admin-fab.js` (root-absolute href) — it's the only navigation between admin pages.
- **Add to `bump-version.js` LATE_TARGETS** in the same gate — otherwise the page's `?v=` strings go stale. **This trap has bitten 3×.**
- **Zero native controls:** `RarBrandSelect` for selects, `showNotice` for toasts, `friendlyError` for errors, the branded `confirmModal` for confirms. No `alert`/`confirm`/`<select>`.
- **Brand law:** **gold is yours alone** — Mode 2's chrome is community purple. Count-free.
- **`[hidden]` twin** for every new `display:flex/grid` component (that trap has 5 scalps).
- **Responsive to 360px** + `prefers-reduced-motion` + visible focus.
- Ship Playwright pins in the shape of `tests/g33-finale.spec.js:55-101`.

## 7. Where it runs [NEW]
**Cloud Scheduler → a gen-2 Cloud Function**, `us-central1`, matching your existing stack. Precedent: `reapOrphanUploads` is already an `onSchedule('every 24 hours')` CF.

Rejected: **GitHub Actions** (ROADMAP hedged "or equivalent"). It would need Firebase deploy credentials in CI *and* access to an .xlsx that isn't in the repo. The CF has admin credentials natively and sits next to the data. Simpler and safer.

**Report delivery [NEW]:** the page is the record; a **Lantern ping** tells you a run finished (you already have the notification system). No email infrastructure needed.

## 8. DECISIONS — LOCKED by Blake 2026-08-09
1. **Cadence: weekly, Sunday 2:00am.** ✅
2. **Scope: the 44-row catalog only.** The community side keeps its existing `reapOrphanUploads` + reports queue. ✅
3. **Dead streaming links: always ask, never auto-remove.** ✅
4. **Mode 2 stages; Blake publishes.** No autonomous deploys — the "nothing ships without my word" rule stays intact even at rung 4. ✅

## 9. 📺 SEASON WATCH — "a new season dropped, and your review is now out of date"
> Blake, 2026-08-09: *"Mode 2 also needs to update me on if a new season is released that I need to update my review for the whole anime or seasonal reviews."*

This is the feature Mode 2 exists for, from Blake's point of view — and it's a sharper ask than the docs' vague "new arc surfaced" diff, because he wants to know **which kind of writing the new season demands of him.**

### How detection works (substrate that already exists)
`KnownAniListIds` is a per-anime snapshot of the whole franchise tree, populated on all 44 rows. Each week Mode 2 re-fetches the tree and diffs it. **Anything in the tree that isn't in the snapshot is a new entry** — a season, a movie, an OVA. AniList's `nextAiringEpisode` and status fields then say whether it is *upcoming*, *airing now*, or *finished airing*.

### The two jobs a new season creates — and Mode 2 must say which
This is the part Blake specifically asked for. Every season alert names its required action:

| Signal | What it means | The ask |
|---|---|---|
| New entry, **not yet aired** | Announced only | 👁 FYI only. No action. Quiet until it airs |
| New entry, **currently airing** | It's happening now | 📌 "Worth watching — a season review will be due" |
| New entry, **finished airing**, no `season-reviews/<id>.md` | The natural moment to write | ✍️ **"Write a season review"** → deep-links straight to the season-review editor for that AniList id |
| New entry finished **AND** the main `Review`/`Seasons` text is now stale | Your whole-anime verdict predates it | 📝 **"Update the main review"** → deep-links to the review editor |
| Both of the above | Common case for a big franchise | Shows **both** actions, tracked separately so you can do one and not the other |

**How "the main review is stale" is judged (conservatively):** the `Seasons` field's stated count no longer matches the tree, or the review text explicitly references a season count that has been superseded. If Mode 2 isn't confident, it says *"may need updating"* rather than asserting it. It never edits the review to "fix" this — that's Fence 1.

### ⚠️ The subtlety that matters: `Seasons` becomes propose-only when a season lands
`Seasons` is normally on Mode 2's may-edit list (§4). But if it silently changed *"2 seasons"* → *"3 seasons"* the moment S3 aired, the site would claim coverage Blake hasn't written — his review only covers two. **[NEW] Special rule: once a new season is detected for an anime, `Seasons` is downgraded to propose-only for that anime until Blake resolves the alert.** Accepting the season-review or main-review action is what releases it.

### Closing the loop
- Accepting an alert **advances `KnownAniListIds`** so it never re-fires (this is the write-once bug from §4/Fence 4).
- Dismissing marks it handled-but-unwritten; it stays quiet but remains visible in History, so a deferred season isn't lost.
- Season reviews live at `season-reviews/<aniListId>.md` — a system that exists but currently has **zero** files. This feature is what would actually put it to use.

## 9. Dependencies before a single line is written
- [ ] Cloud migration Phases 1-4 (`CLOUD-MIGRATION-STUDY.md`) — the store, publish, and **revisions/**
- [x] Playwright suite — ROADMAP.md:412 names it a Mode 2 prerequisite; it exists (285 green)
- [x] `AniListId` on every row — the re-sync primary key; 44/44 populated
- [x] `KnownAniListIds` snapshot — 44/44 populated
- [ ] A persisted `lastSyncTime` — for AniList's `updatedAt` incremental re-sync; **does not exist yet**
- [ ] A general dry-run convention for data-modifying scripts (ROADMAP.md:421 flags it as Mode-2 relevant)
