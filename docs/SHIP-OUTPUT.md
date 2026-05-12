<!-- author: Code | date: 2026-05-12 -->
# v1.6.7 — Gate 10 verification (gate 9c applied + full diff + npm test)

> Gate 9b apply content archived in git history. Overwritten per rolling-output convention.

---

## 🛑 CRITICAL ANOMALY — `docs/HANDOFF.md` not firebase-ignored

**Surfacing this at the top so Cowork sees it first.** The full gate 10 verification is below, but this needs a decision before gate 11 `git add -A`.

### The finding

`git status` shows `docs/HANDOFF.md` as **untracked**:

```
?? docs/HANDOFF.md
```

This file was created by Cowork at the start of the v1.6.7 session as a mid-chat handoff doc (Cowork author marker, dated 2026-05-12). Its content describes the session-transfer state. It's been carried in the working tree across all gates but hasn't been touched by any v1.6.7 work.

`grep` of `firebase.json`'s ignore array shows:

```json
"ignore": [
  "firebase.json",
  "**/.*",
  "**/node_modules/**",
  "PERSONAL.md",
  "UpdateLog/**",
  "AUDIT_*.md",
  "docs/SHIP-*.md",
  "tests/**",
  "playwright.config.js",
  "package.json",
  "package-lock.json",
  "playwright-report/**",
  "test-results/**"
]
```

**HANDOFF.md is NOT covered by any ignore pattern.** The closest pattern is `docs/SHIP-*.md` which only matches files starting with "SHIP-".

### Why this matters

If I run `git add -A` at gate 11 without fixing, HANDOFF.md gets committed AND deploys to production at gate 14. Same project-rule-#8 violation precedent class as:

- **PERSONAL.md** in v1.3.5 — would have leaked Firebase login email + admin UID + DNS values
- **AUDIT_*.md** in v1.3.9 — full internal codebase critique uploaded to production
- **Both fixed by adding to firebase.json ignore**

HANDOFF.md content includes (from a quick header check): session-state, Cowork's chat-transition notes, "Blake has NOT yet sent any message to Code in this transition," and exact-state pauses-in-progress. It's internal process state — meaningful to AI sessions across chat boundaries, but **not visitor-facing**.

### Proposed fix — Option A (recommended)

Same pattern as `docs/SHIP-*.md` gate-2 fix from v1.6.5. Two surgical edits:

1. **Add `docs/HANDOFF.md` to `firebase.json` `ignore` array** (insert alongside `docs/SHIP-*.md`):
   ```diff
        "docs/SHIP-*.md",
   +    "docs/HANDOFF.md",
        "tests/**",
   ```

2. **Include HANDOFF.md in the v1.6.7 commit** via `git add -A` at gate 11 (firebase-ignored, so the deploy ladder is closed; git-tracked so the audit trail is preserved across future sessions).

Alternatives considered:
- **Option B — generalize pattern to `docs/{SHIP,HANDOFF}-*.md` or `docs/HANDOFF*.md` separately**: same effect but slightly more flexible for future variants. No strong reason to over-engineer; Option A is the minimum viable fix.
- **Option C — `.gitignore` HANDOFF.md so it stays untracked**: loses cross-session audit trail; future AIs in new chats wouldn't have access to it in the repo. Counter to its purpose.

**Recommend Option A.** Surgical, mirrors existing pattern, closes the leak window before any commit.

### What I need from Cowork

Before proceeding to gate 11:

1. **Approve Option A** → I apply the 1-line `firebase.json` ignore addition as part of gate 10's anomaly resolution, then proceed to gate 11.
2. **OR approve an alternative** (B / C / something else).

This needs to happen **before** `git add -A` at gate 11 — otherwise HANDOFF.md gets committed without the firebase-ignore safety, and we'd have to retroactively add the ignore in a follow-up commit (which adds churn and a momentary security window).

---

## Gate 9c apply confirmation

Both swaps applied cleanly:

```diff
- Future Mode 1 upgrades land here, scoped based on what Blake learns from using v1.6.0 through v1.6.7.
+ Future Mode 1 upgrades land here, scoped based on what Blake learns from using v1.6.0 through v1.6.9.
```

```diff
- - **Suggestion box + admin viewer.** Folded into v1.6.7 with Mode 1 integration.
+ - **Suggestion box + admin viewer.** Folded into v1.6.9 with Mode 1 integration.
```

### Post-9c verification — `grep -n "v1\.6\.7" ROADMAP.md`

3 matches, all historical/current:

```
74:**Live at v1.6.7** ... shipped (v1.6.7):                       ← current chain
93:- v1.6.7 (2026-05-12) — Admin form franchise aggregation ...   ← per-ship bullet
95:**Up next:** v1.6.8 ... v1.6.7 shipped Part A ...               ← Up next paragraph (historical)
```

Lines 187 + 317 are clean. ✅

---

## Working tree shape — `git status --short`

```
 M CHANGELOG.md
 M ROADMAP.md
 M account.html
 M admin/new-anime.css
 M admin/new-anime.html
 M admin/new-anime.js
 M docs/NEXT.md
 M docs/SHIP-OUTPUT.md
 M docs/SHIP-PROMPT.md
 M index.html
?? docs/HANDOFF.md
```

**10 modified — all 10 expected per SHIP-PROMPT.md.** No surprise modified files; no missing expected files.

**1 untracked: `docs/HANDOFF.md`** — flagged in the critical anomaly section above.

---

## Full diff stat — `git diff --stat`

```
 CHANGELOG.md         |  26 ++++
 ROADMAP.md           |  21 +--
 account.html         |   8 +-
 admin/new-anime.css  |  90 +++++++++++++
 admin/new-anime.html |  23 +++-
 admin/new-anime.js   | 173 ++++++++++++++++++++++++-
 docs/NEXT.md         |  17 +--
 docs/SHIP-OUTPUT.md  | 351 ++++++++++++---------------------------------------
 docs/SHIP-PROMPT.md  | 152 ++++++++++++++--------
 index.html           |  17 ++-
 10 files changed, 516 insertions(+), 362 deletions(-)
```

Largest deltas are the two rolling SHIP-*.md files (intra-session churn — overwritten multiple times across 10 gates). Meaningful code/docs delta: ~165 insertions (admin/new-anime.js 173 + admin/new-anime.css 90 + admin/new-anime.html 23 + CHANGELOG 26 + ROADMAP/NEXT/index/account small deltas).

---

## Per-file diff details

### `CHANGELOG.md` (+26 lines)

The v1.6.7 entry I applied at gate 6b. Prepended above the v1.6.6 entry, with the author marker comment. Includes the headline paragraph, 6 bullet specifics, implementation files paragraph, Tier A footer, roadmap cascade note. Diff captured at gate 9b; unchanged at gate 9c. No surprises — content matches what Cowork approved at gate 6.

### `ROADMAP.md` (+21 / -10)

11 distinct hunks (Edits E, F, per-ship bullet, Anomalies 1-5, TBD-bump, gate 9c-1, gate 9c-2):

- Line 74 — "Live at v1.6.6" → "Live at v1.6.7" + chain extension (Edit E)
- Line 92 → 93 region — new v1.6.7 per-ship bullet inserted
- Line 95 — Up next paragraph fully rewritten (Edit F)
- Lines 137-138 — `(v1.6.6)` → `(v1.6.8)` and `(v1.6.7)` → `(v1.6.9)` in "Explicitly NOT in v1.6.0" list (Anomalies 1, 2)
- Line 156 — section header `### v1.6.6` → `### v1.6.8` (Anomaly 3)
- Line 171 — section header `### v1.6.7` → `### v1.6.9` (Anomaly 4)
- Line 184 — `### v1.6.8+` → `### v1.6.10+` (Cowork addition)
- Line 187 — `v1.6.0 through v1.6.7` → `v1.6.0 through v1.6.9` (gate 9c-1)
- Line 200 — `v1.6.6 "More Information"` → `v1.6.8 "More Information"` (Anomaly 5)
- Line 317 — `Folded into v1.6.7` → `Folded into v1.6.9` (gate 9c-2)

All version-renames + content additions. No structural damage. No whitespace drift on adjacent lines.

### `docs/NEXT.md` (+17 / -16)

5 hunks (author marker + Edits A-D):

- Line 1 — author marker date `2026-05-10` → `2026-05-12`
- Line 12 — v1.6.7 entry prepended above v1.6.6 (Edit A)
- Lines 21-29 — "Immediate next ship — v1.6.5" section replaced with "v1.6.8 (More Information panel...)" (Edit B)
- Line 37 deleted, line 38 renumbered `v1.6.8` → `v1.6.9` (Edit C)
- Multi-hop polish row inserted after v1.6.x Clickable live preview row (Edit D)

Net symmetric — content swap, not pure addition. Surgical.

### `index.html` (+12 / -5)

Gates 5/7b/8b cumulative:

- Line 8: `APP_VERSION 1.6.6 → 1.6.7` (gate 8b)
- Lines 24-26: 3 CSS cache-busts (gate 8b)
- Line 169: `<span ...>v1.6.6</span>` → `v1.6.7` (gate 8b)
- Lines 174-180: new `05/12/2026` section prepended with the v1.6.7 widget bullet (gate 7b)
- Line ~196 (was 191 pre-edit): `<li>Fixed genre typos...</li>` deleted (gate 7b cap-drop)

Five hunks. All gate-attributable.

### `account.html` (+4 / -4)

Pure version bump (gate 8b only):

- Line 7: `APP_VERSION 1.6.6 → 1.6.7`
- Lines 23-25: 3 CSS cache-busts

No structural changes. Matches the expected TARGETS distribution (4 strings for account.html).

### `admin/new-anime.html` (+18 / -5)

Gates 5/8b cumulative:

- Line 7: `APP_VERSION 1.6.6 → 1.6.7` (gate 8b)
- Lines 11-14: 4 CSS cache-busts (gate 8b)
- Lines 91-102 (post-edit): new `#franchise-info-panel` HTML block in Section 2 with all 5 expected IDs (gate 5)

The FRANCHISE INFO panel insertion + version-string flips. All gate-attributable.

### `admin/new-anime.css` (+90 / -0)

Pure addition — gate 5's FRANCHISE INFO panel CSS block + the `.status-line.warn` amber variant at the bottom of the file. Full ~90 lines, no existing rules touched. Diff truncated above; available in full via `git diff admin/new-anime.css`.

### `admin/new-anime.js` (+173 / -7)

Cumulative gates 2 + 3 + 5:

- Lines 37-58 + 96-117: two identical `relations` blocks in FULL_QUERY + FULL_QUERY_BY_ID (gate 2)
- Line 157: setStatus 'warn' extension (gate 5)
- Lines 253-308: `aggregateFranchise()` helper (gate 3, with TYPE_ORDER tiebreaker)
- Lines 311-349: `renderFranchisePanel()` helper (gate 5)
- Lines 352-447 (inside populateForm): 5 surgical edits (gate 5) — franchise computation up front, seasons-aware logic, studio union, multi-part summary, PREQUEL warning + render call

The 7 deletions are existing single-entry heuristic lines replaced by franchise-aware logic. No behavior loss.

---

## `npm test` — 7/7 GREEN ✅

```
$ cd "Current Version" && npm test
Running 7 tests using 1 worker
  7 passed (14.3s)
```

Full pass in 14.3s — baseline range (matches v1.6.5 gate 5b's 14.3s, v1.6.6 gate 9's 17.8s). No flakes, no slow tests. Tier A test pass requirement satisfied.

---

## Summary of all anomalies

| # | Severity | Anomaly | Resolution |
|---|---|---|---|
| 1 | 🛑 BLOCKER | `docs/HANDOFF.md` untracked + not firebase-ignored | **Cowork decision needed.** Recommend Option A: add to firebase.json ignore + include in commit. |
| 2 | ℹ INFO | 4× LF→CRLF warnings on rolling docs (CHANGELOG, NEXT, SHIP-OUTPUT, SHIP-PROMPT) | Same as every prior gate — `.gitattributes` normalizes on next checkout, not a blocker |
| 3 | ℹ INFO | Two rolling SHIP-*.md files have ~500-line net deletions in diff | Intra-session overwrite churn; firebase-ignored; not a blocker |

Only Anomaly 1 is a real gate-blocker.

---

## State at end of gate 10

**Working tree** (pre-anomaly-1 fix):

```
10 modified + 1 untracked (HANDOFF.md)
+516 insertions / -362 deletions across the 10 modified
npm test: 7/7 green in 14.3s
```

---

## Awaiting Cowork

**Single critical decision:**

1. **Approve Option A for the HANDOFF.md anomaly?** Add `docs/HANDOFF.md` to `firebase.json` ignore, include in commit. Single 1-line `firebase.json` edit; no other files touched. After that fix lands, gate 11 (`git add -A`) is safe to proceed.

OR provide alternative direction (Option B / C / defer).

**Default if "approved, proceed" with no specifics:** apply Option A as a gate 10b sub-step, then surface for gate 11.

gate 10 verification in docs/SHIP-OUTPUT.md, awaiting approval to stage + commit. **Anomaly 1 (HANDOFF.md firebase-ignore) needs explicit Cowork direction before gate 11 can proceed safely.**
