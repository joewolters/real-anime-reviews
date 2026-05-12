<!-- author: Cowork | date: 2026-05-12 -->
# Session Handoff — pick up here in the new chat

> **Purpose:** snapshot of exactly where the work is paused so a fresh chat can continue without losing the thread. Overwrite this file whenever a session ends mid-ship.

---

## TL;DR for the new chat

We are **mid-ship on v1.6.7** (franchise aggregation in the admin form). Code has applied gates 2 + 3 and proposed gate 4. **No code has been written for gate 4 yet — Cowork still needs to review the gate 4 proposal in `docs/SHIP-OUTPUT.md` and tell Code to apply.**

Blake has NOT yet sent any message to Code in this transition. He paused to transfer chats. The next action when he is ready is for the new chat to review gate 4 and tell him what to paste to Code.

---

## Exact state (as of 2026-05-12)

### Ship in progress
- **v1.6.7** — Tier A MINOR — admin form franchise aggregation (Part A only; Part B = More Information panel on the public modal is now v1.6.8)
- Plan: 15 gates total, currently between gate 4 (propose) and gate 5 (apply)

### What's been applied to code
- **Gate 2 applied** ✅ — `relations` block added to BOTH `FULL_QUERY` and `FULL_QUERY_BY_ID` in `admin/new-anime.js` (+32 lines, purely additive GraphQL).
- **Gate 3 applied** ✅ — `aggregateFranchise()` helper landed in `admin/new-anime.js` between `fetchAniListById()` and `populateForm()` (+56 lines including comments). Code went with **Option A — TYPE_ORDER tiebreaker** (PREQUEL < PARENT < MAIN < SEQUEL) so same-year ties resolve in natural reading order.

### What's proposed but NOT applied
- **Gate 4 propose** — `docs/SHIP-OUTPUT.md` contains 4 propose pieces awaiting Cowork review:
  - **4a** — five edits to `populateForm()` in `admin/new-anime.js` (~30 lines): franchise computation up front, seasons field uses `franchise.seasonCount`, studio field unions across entries, anilist-summary appends franchise info, PREQUEL warning + `renderFranchisePanel()` call before existing `updatePreview()`.
  - **4b** — FRANCHISE INFO panel HTML in `admin/new-anime.html` (~12 lines): inserted in Section 2 between the section head and the admin grid; hidden by default.
  - **4c** — CSS for the panel in `admin/new-anime.css` (~55 lines): purple gradient + Montserrat header + entries list styling, mirrors `.admin-card-preview-panel`. Also adds a `.status-line.warn` amber variant for the PREQUEL warning.
  - **4d** — `renderFranchisePanel(franchise)` function in `admin/new-anime.js` (~30 lines): pure DOM, no AniList calls, hidden when `seasonCount <= 1`.
- **Total proposed apply size:** ~140 lines across 3 files.

### Cowork decisions Code is waiting for
1. Approve 4a populateForm 5-edit pattern as proposed?
2. **'warn' status kind decision:** add `.status-line.warn` CSS + extend `setStatus()` to handle `'warn'` (recommended — distinct amber color), OR reuse existing `'info'` kind (simpler, less distinct visually)?
3. Approve 4b HTML placement (Section 2, between head and grid)?
4. Approve 4c CSS (~55 lines, brand-consistent)?
5. Approve 4d `renderFranchisePanel()` as proposed?

**Default fallback if Cowork just says "approved, proceed":** Code will apply all 4 pieces verbatim including the `'warn'` setStatus update.

### Open anomalies Code flagged in gate 4 (worth eyeballing)
1. **`setStatus('warn')` is a new kind** — Code wants to update line 116 from `(kind === 'error' ? 'error' : '')` to `(kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : '')`. One-line surgical change tied to the 4c CSS rule.
2. **OPM Season 3 won't show via single-hop** — fetching S1 catches S2 (SEQUEL) but not S3 (which is under S2's SEQUEL). PREQUEL warning will also fire on OPM S1 because Road to Hero OVA is tagged PREQUEL on AniList even though it's a side OVA, not a structural Season 0. Honest behavior; Blake can judge per-fetch.
3. **Panel placement pushes form fields down ~150-200px** when shown. Should be fine but worth checking during gate 5 smoke.

---

## Recommended next move for the new chat

1. **Read `docs/SHIP-OUTPUT.md`** end to end to see the full gate 4 proposal.
2. **Make a call on the 'warn' kind** (recommend going with it — Code's instinct is right).
3. **Update `docs/SHIP-PROMPT.md`** to the gate 5 prompt (apply gate 4 + smoke test).
4. **Tell Blake what to paste to Code.** Short one-liner reply, same rhythm as previous gates.
5. After Code applies, gate 5 = Blake's local browser smoke test on:
   - **OPM** (id 21087) — should show 3 entries (Road to Hero PREQUEL + S1 MAIN + S2 SEQUEL), studios "Madhouse / J.C.Staff", PREQUEL warning fires
   - **Frieren** — should show franchise data if AniList has prequel/sequel relations indexed
   - **Charlotte** (or any single-season) — panel should stay hidden, no warning, form falls back to existing single-entry behavior

---

## Gates remaining after gate 5 (Code's plan, locked in at gate 0/1)

| Gate | Action |
|---|---|
| **Gate 6** | CHANGELOG entry propose (Tier A MINOR; release-skill format) |
| **Gate 7** | Widget bullet propose. Cowork's preferred wording: *"Made the tools that add new anime smarter about multi-season franchises."* Validate against `docs/SKILLS/widget-update-skill.md` rules at proposal time |
| **Gate 8** | Version bump 1.6.6 → 1.6.7 (dry-run + propose + apply via `node scripts/bump-version.js`) |
| **Gate 9** | ROADMAP + NEXT.md cascade — see scope-additions note in current `SHIP-PROMPT.md` |
| **Gate 10** | Full diff + `npm test` re-run (Tier A test pass mandatory) |
| **Gate 11** | `git add -A` (pause for review) |
| **Gate 12** | `git commit` + `git push` (separate explicit go-signal — gate 13 ≠ gate 14 discipline) |
| **Gate 13** | Preview deploy + Blake browser verification on preview URL |
| **Gate 14** | Production deploy (separate explicit go-signal) |
| **Gate 15** | Production verification (curl + browser confirming v1.6.7 live + aggregation working) |

---

## Key context the new chat must internalize

### Blake
- Basic coder. Learns best from clear, slow, step-by-step instructions. **Tell him exactly what to copy/paste and where.** Don't assume he knows project structure, terminal commands, or debugging steps without it being re-explained.
- Has been running 7 ship cycles today already. Tired but discipline holding.
- His preference: send one short message at a time to Code; Cowork holds the strategy.

### The Cowork ↔ Code split (HARD rule)
- **Cowork = me** (the chat agent). I plan, review, prompt, and write to `docs/SHIP-PROMPT.md`.
- **Code = the build-tool agent** that actually edits files. Code reads `docs/SHIP-PROMPT.md` and writes to `docs/SHIP-OUTPUT.md`.
- Blake is the courier — he copies my one-liner reply and pastes it to Code, and copies Code's one-liner back.
- **Show-then-apply for ALL non-rolling-file edits.** Multi-piece ship = multiple propose passes. Each piece proposes in SHIP-OUTPUT.md, gets approved, THEN applies. Code applying without approval is a discipline violation.

### The rolling-file pattern (saves context)
- `docs/SHIP-PROMPT.md` — Cowork's active prompt to Code. **Overwrite per gate.**
- `docs/SHIP-OUTPUT.md` — Code's latest output. **Overwrite per gate.**
- Short messages in chat stay inline. Long content goes to these files.
- See memory file `prompt_file_pattern.md` for the cross-session reminder.

### Discipline reminders (have been internalized but worth keeping fresh)
- **Gate 13 ≠ Gate 14.** Preview deploy is its own pause. Production deploy needs a separate explicit go-signal. Lesson from v1.6.5 (we chained preview straight to prod — worked but breached the rule).
- **Test pass required at gate 10** for Tier A ships. `npm test` before commit.
- **Rule #1 (Excel canonical)** — no new Excel columns needed for Part A; aggregates flow into existing Studio/Seasons fields.
- **Rule #2 (author markers)** — required on CHANGELOG and any meaningful doc edits (`<!-- author: Code | date: YYYY-MM-DD -->` or `<!-- author: Cowork | date: YYYY-MM-DD -->`).

### Scope decisions locked from gate 0/1
- **SPLIT approved.** v1.6.7 = Part A (admin form aggregation). v1.6.8 = Part B (More Info panel on public modal). v1.6.9 = Suggestion Box (cascaded from earlier v1.6.8 slot).
- **P2 single-hop strategy.** Multi-hop deferred as a v1.6.x polish if real-use shows partial-aggregation frustration.
- **Filter set.** SEQUEL + PREQUEL + PARENT + `type:ANIME` only. SIDE_STORY / ALTERNATIVE / SUMMARY / OTHER / ADAPTATION excluded.
- **ADDED scope:** visible FRANCHISE INFO panel in the admin form (the gate 4 proposal — already in flight).
- **DEFERRED scope:** Romaji subtitle on anime cards — paired with v1.7.0 backfill so all 44 anime light up at once.

### Recent ships (last 7, all 2026-05-11)
v1.6.0 → v1.6.1 (Bug 10 hotfix) → v1.6.2 (smoke-check) → v1.6.3 (polish + widget skill) → v1.6.4 (widget upgrade) → v1.6.5 (live preview + ID-import) → v1.6.6 (cover-image hotfix). Currently shipping v1.6.7.

---

## Files to read first in the new chat (priority order)

1. **`docs/SHIP-OUTPUT.md`** — the gate 4 proposal awaiting review. This is the most critical context.
2. **`docs/SHIP-PROMPT.md`** — current active Cowork prompt (gate 3 content; will need update for gate 5).
3. **`admin/new-anime.js`** — verify gates 2 + 3 actually applied. The `aggregateFranchise()` function should be visible between `fetchAniListById()` and `populateForm()`.
4. **`docs/NEXT.md`** — backlog, current "Immediate next ship" still shows v1.6.5 (stale; gate 9 cascade will fix). v1.6.7 row sharpened with OPM example.
5. **`ROADMAP.md`** — strategic plan + project rules.

---

## What I would have done next if not transferring

Drafted gate 4 approval message for Blake to send. Going to recommend the 'warn' status kind path (anomaly 1 — Code's recommended option) and approve all 4 pieces verbatim. Likely message:

> Gate 4 approved on all 4 pieces (4a + 4b + 4c + 4d) — go with the 'warn' status kind path (add the `.status-line.warn` CSS + extend setStatus). Apply gate 4 at gate 5 + surface for Blake's local browser smoke (OPM id 21087, Frieren, Charlotte). One-liner back when applied.

The new chat can use that draft as-is or amend after re-reading the proposal.
