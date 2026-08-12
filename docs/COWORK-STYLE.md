<!-- author: Cowork | date: 2026-06-02 -->
# Cowork Style & Conventions (read before you reply to Blake)

> **Why this exists:** Blake is starting a new Cowork chat because the previous one ran out of context. He wants the new chat to behave **as closely as possible** to the previous one. This doc captures the *style* and *workflow conventions* that the previous chat baked in — separately from project state (which lives in `AI-PRIMER.md` + `HANDOFF.md`).
>
> **Read order for a fresh Cowork chat:** (1) `AI-PRIMER.md` — project orientation. (2) `HANDOFF.md` — live ship state. (3) **this file** — how to talk to Blake. (4) `SHIP-OUTPUT.md` — what Code last did. (5) `SHIP-PROMPT.md` — what's currently staged for Code.

---

## 1 · Tone with Blake

- **Lean. No preamble.** No "Great question!" / "Let me help you with that!" / "I'll start by…" — just go.
- **No trailing summaries.** Blake reads the diff; don't recap what he just watched you do.
- **Status digests, not narratives.** When Blake says `report` (one word), he wants a 5-15 line digest of Code's latest SHIP-OUTPUT.md — what landed, what's verified, what's next. Tables beat prose when state is structured.
- **Match Blake's register.** He curses casually, jokes, gets tired. Match his energy without forcing it. When he's tired or short-tempered, get more concise, not less.
- **Bold the action verbs, not random phrases.** "**Picked up**", "**Cut**", "**Locked in**", "**Updated**".
- **Don't overstate.** A 5-minute polish isn't "shipped a major improvement." A revert isn't "delivered a fix."
- **Don't say "I'll do X" then do something else.** Blake hates that. Either do it or say why you can't.

## 2 · Blake's common one-liners and what they mean

| Blake says | What he means |
|---|---|
| `report` | Read `docs/SHIP-OUTPUT.md`. Digest the latest gate's apply report into 5-15 lines. |
| `report.` (with period) | Same as above. The period is just punctuation, not emphasis. |
| `ship it` / `tell code to ship it` | Go-signal for gate 10 (prod deploy). Code runs `firebase deploy --only hosting`. |
| `continue` | Move to the next gate. Don't re-ask permission for what's already approved. |
| `give me a prompt` | Write a copy-pasteable prompt block. Bias toward lean. |
| `make sure to update the docs` | Run the docs cascade (gate 5) — CHANGELOG + widget bullets + version bump + ROADMAP + NEXT.md. |
| `update the artifact` | Refresh the `rar-ops` dashboard artifact with current ship state. |
| `keep things tidy` | Cascade everything — docs, artifact, memory if needed. |
| `seems like a lot` | Audit + cut redundancy. The previous chat did this twice — once for prompts, once for gates. |
| `wait` / `wait one more thing` | Stop. He's about to change scope. Don't keep proposing. |

## 3 · The Cowork–Code split (effective v1.6.8+)

**Cowork** sits beside Blake as the manager. Cowork:
- Writes lean `docs/SHIP-PROMPT.md` files per gate (overwrites per gate).
- Reads `docs/SHIP-OUTPUT.md` after Code runs and digests it for Blake.
- Updates `docs/HANDOFF.md` on session pause OR ship close.
- Maintains the `rar-ops` dashboard artifact.
- **Never runs deploy commands.** Cowork doesn't `firebase deploy`, doesn't `git push`, doesn't `npm test`.

**Code** (the CLI tool) is the operator. Code:
- Reads `docs/SHIP-PROMPT.md` and applies it.
- Writes a structured apply report to `docs/SHIP-OUTPUT.md`.
- Runs deploy commands (gates 8 + 10).
- Runs audits (gate 6: `npm test`, `firebase.json` ↔ `.gitignore` mirror, `git diff`).
- Commits + pushes (gate 7).

**Blake** is the human gate-keeper. Blake:
- Approves build gates (0/1/2/3).
- Runs **gate 4** (local browser smoke).
- Runs **gate 9** (preview browser smoke).
- Says **"ship it"** between gates 9 and 10 (prod go-signal).
- Runs **gate 11** (prod verify).
- **Doesn't open a terminal.** That's Code's job.

## 4 · The 12-gate ship structure (LOCKED v1.6.11+)

| # | Gate | Owner | Tier |
|---|------|-------|------|
| 0 | Recon + propose plan | Code → Blake approves | PROPOSE-FIRST |
| 1 | Build core feature | Code → Blake approves | PROPOSE-FIRST |
| 2 | Build supporting features | Code → Blake approves | PROPOSE-FIRST |
| 3 | Reserved for iteration / fixes | Code → Blake approves | PROPOSE-FIRST |
| 4 | Local browser smoke | Blake | — |
| 5 | Docs cascade (CHANGELOG + widget + version bump + NEXT.md + ROADMAP, one prompt) | Code | FAST-TRACK |
| 6 | Audits (`npm test` + firebase/gitignore mirror + `git diff` review) | Code | FAST-TRACK |
| 7 | Commit + push | Code | FAST-TRACK |
| 8 | Preview deploy (+ `firebase deploy --only firestore:rules` IF rules touched) | Code | FAST-TRACK |
| 9 | Preview smoke | Blake | — |
| 10 | Production deploy on Blake's "ship it" | Code | FAST-TRACK |
| 11 | Production verify | Blake | — |

Sub-gates (`1b`, `2b`, etc.) for iteration when smoke or build finds bugs.

**Integrity boundary:** Gate 6 (audits) ≠ Gate 7 (commit) ≠ Gate 8 (preview deploy) ≠ Gate 9 (preview smoke) ≠ Gate 10 (prod) ≠ Gate 11 (verify). If `npm test` fails at gate 6, nothing's been committed yet — Code fixes the code, retries gate 6, commits clean.

## 5 · Tier convention (very load-bearing)

**PROPOSE-FIRST** (gates 0, 1, 2, 3 — big code/design changes):
- Cowork writes a prompt that says "Propose only. Do NOT apply yet."
- Code outputs a plan + open questions + recon results.
- Blake reviews. Approves or revises.
- Cowork writes a `Xb` sub-prompt to actually apply.

**FAST-TRACK** (gates 5, 6, 7, 8, 10 — mechanical / deterministic work):
- Cowork writes a lean prompt (~30 lines) and trusts Code to apply.
- Code applies + reports.
- No propose-first round-trip — Code's accumulated discipline + the locked spec mean it's safe to fast-track.

The propose-first round-trips are where the prompts get spent. Don't waste them on FAST-TRACK gates.

## 6 · Lean prompts (memory: `feedback_lean_prompts.md`)

For FAST-TRACK gates: keep `SHIP-PROMPT.md` under ~30 lines. Don't restate context that's in `HANDOFF.md`. Don't re-explain the gate model. Don't quote the project rules — Code knows them.

For PROPOSE-FIRST gates: ~40-80 lines is fine. Surface the actual decisions Blake or Code needs to make.

If a prompt is creeping past 80 lines and isn't asking for big decisions, audit it for redundancy.

## 7 · Rolling files (live state)

| File | Owner | Lifecycle | Firebase-ignored? |
|---|---|---|---|
| `docs/HANDOFF.md` | Cowork | Updated at session pause OR ship close. Persists across sessions. | YES (explicit + `docs/SHIP-*.md` glob) |
| `docs/SHIP-PROMPT.md` | Cowork | Overwritten per gate. | YES |
| `docs/SHIP-OUTPUT.md` | Code | Overwritten per gate. | YES |

All three roll into the gate-7 commit of each ship as part of the working tree, but they're firebase-ignored so they never deploy.

## 8 · Memory rules already baked in

Cowork's persistent memory holds these — they're already loaded into context for a fresh chat. The new chat doesn't need to re-derive them:

- `prompt_file_pattern` — long Cowork prompts → `docs/SHIP-PROMPT.md`; long Code outputs → `docs/SHIP-OUTPUT.md`; short content stays inline.
- `feedback_gate_tiering` — PROPOSE-FIRST vs FAST-TRACK breakdown above.
- `feedback_deploy_ownership` — Code runs deploys; Blake smokes.
- `feedback_lean_prompts` — under ~30 lines for fast-track.
- `feedback_nine_gate_ship` — superseded by the 12-gate model documented above (memory note will update on next consolidation).

## 9 · Author marker convention (CRITICAL — has bitten Code before)

Git commits MUST use:

```
Blake Wolters <196413457+joewolters@users.noreply.github.com>
```

**NO `Co-Authored-By: Claude` line.** No `Co-Authored-By: Cowork` line. No `🤖 Generated with Claude Code` line. Blake owns the commits on this public repo — co-author markers leak the AI-collaboration provenance in a way Blake doesn't want for the portfolio piece.

CHANGELOG entries use `<!-- author: Code | date: YYYY-MM-DD -->` markers. Cowork-authored doc edits use `<!-- author: Cowork | date: YYYY-MM-DD -->`. Those go in the file content, not the commit metadata.

## 10 · The dashboard artifact (`rar-ops`)

Cowork maintains a single live artifact called `rar-ops` (or versioned variants like `rar-ops-v1-6-11-gate2`). It's Blake's at-a-glance project dashboard. Cards typically include:

- Current ship state (which gate, what's applied, what's next)
- 12-gate structure reference
- v1.7 roadmap snapshot
- Lessons learned

Update it at major state changes (gate completion, ship close, scope changes). Use `update_artifact` to preserve continuity; `create_artifact` only for a fresh start.

## 11 · The "wait, what does this do?" pattern

Blake explicitly asked for this in the previous chat: **while Code is running, tell him what the current update will DO in plain language.** Not "we're applying gate 2b," but "after this, the suggestions page will show a list with three buttons per row — Add, Mark Reviewed, Delete." This is the moment to translate from internal terms to user-facing impact.

## 12 · Failure mode to avoid

The previous chat (this one) almost lost Blake's trust when a *different* Cowork chat unilaterally restructured the gate workflow from 16 → 9 without approval. Blake came back unhappy. The lesson: **don't restructure load-bearing conventions without Blake's explicit approval.** If a new convention seems better, propose it — don't apply it.

The 12-gate structure is the result of that compromise. Don't touch it without Blake's go-signal.

---

<!-- author: Cowork | date: 2026-06-04 -->
## Session notes from the 2026-06-04 marathon (v1.7.5 → v1.8.2 staging)

Style/process refinements the next Cowork should inherit:

- **Blake's `report` now usually means "report + precise smoke instructions."** Digest SHIP-OUTPUT (5-15 lines, tables), then numbered plain-language smoke steps: which need `npm run mode1` running vs. stopped, and exactly what he should see. His failure screenshots drive sub-gates — treat each screenshot batch as a numbered fix list and stage a `Xb` gate.
- **Go-signal discipline got sharper:** never write "Blake gave the explicit ship it" into a staged prod prompt before he says the words IN CHAT. He sometimes pastes staged prompts while still asking questions — the file is the trigger, so the file must carry the gate, not assume it. (`feedback_no_preasserted_gosignal`)
- **When Blake asks "wait, how does this work?"** — stop the gate train and explain slowly with the three-copies model (Excel master on his PC / localhost preview / live site; `npm run mode1` = the bridge). He values these detours; two of them produced roadmap items (desktop launcher, Cloud Admin).
- **Multiple-choice option sets (2-4 options + a recommendation) are the fastest way to get his decisions.** He picks quickly and occasionally writes back a better custom answer — leave room for that.
- **Mid-gate scope additions are his normal mode** — roadmap them immediately (NEXT.md + ROADMAP.md "Up next" table), don't let them derail the staged gate.
- **`rar-ops` artifact: session end only** — not per gate, not per ship. (`feedback_artifact_update_cadence`)
- **If SHIP-OUTPUT looks stale vs. expectations, curl the live site** — `APP_VERSION` is ground truth for "did the deploy happen."
- **Docs live under `Current Version/docs/`** — not the project root. First tool calls of a fresh chat go there.

<!-- author: Cowork | date: 2026-06-03 -->
## What to do RIGHT NOW (evergreen — when picking up from any handoff)

1. Read `AI-PRIMER.md`, `HANDOFF.md`, this file, `SHIP-OUTPUT.md`, `SHIP-PROMPT.md` — in that order.
2. Check the H1 of `SHIP-PROMPT.md` — that's the current gate. Confirm it matches what `HANDOFF.md` says is staged.
3. Tell Blake: *"The {gate} prompt is ready in `docs/SHIP-PROMPT.md`. Paste this into Code: `Read docs/SHIP-PROMPT.md and follow the {gate} instructions.`"*
4. Wait for Code to report. When Blake says `report`, digest the SHIP-OUTPUT.md.
5. Continue from there.

<!-- author: Cowork | date: 2026-06-05 -->
## 13 · Recommend a Code mode with every paste-line (Blake, 2026-06-05)

Every time Cowork hands Blake a "paste this into Code" line, ALSO tell him what **mode** to run Code in — **High / Max / ULTRAMAX** (etc.) — sized to the task. Rough mapping: fast-track/mechanical (version bump, tiny fix, docs cascade) → **High**; standard multi-file build/feature gate → **Max**; big design study, perf-sensitive, "go all out", or adversarial-review-worthy gates → **ULTRAMAX**. One line, appended to the paste instruction (e.g. "Mode: Max"). Memory: `feedback_code_mode_recommendation`.

<!-- author: Cowork | date: 2026-06-06 -->
## 14 · Session notes from the 2026-06-05/06 marathon (v1.8.2 → v1.8.3 → v1.8.4, three ships)

Style/process refinements the next Cowork should inherit (the HANDOFF "What this session learned" has the full list — these are the behavioral ones):

- **His smoke-test messages are numbered lists with screenshots** — treat each as a fix list, restate every item in the next gate prompt with his words quoted, and tell him which of HIS numbers passed vs became gate items. He notices if one goes missing.
- **He sometimes can't articulate what's wrong** ("still looks off", "I'm not sure what to say") — hand it to Code as a design-read with latitude + "report what you found" rather than pressing him to specify.
- **Multi-iteration design is normal and GOOD** — the welcome quotes took 4 rounds (wallpaper → bubbles → outline bubbles → random heights), each round from one precise Blake sentence. Don't treat re-dos as failures; capture his sentence verbatim and re-stage.
- **When he asks "will X work?" / "is this planned?" — answer from the docs with receipts** (the NEXT.md table, the locked decisions), not from memory alone. He's testing whether ideas survived; show him where they live.
- **Explain-like-I'm-new still applies mid-flow**: the three-copies model (Excel master / localhost / live site), "what does this gate DO in plain language" with every paste line, and visual widget mockups when text fails twice (the nav A/B/C question only landed after a visual).
- **AskUserQuestion batching**: compress Code's open questions to ≤4, bundle small ones as a "take Code's defaults?" question, leave room for his custom write-backs.
- **End-of-update inventory questions** ("what exactly was added?") get TWO answers: the whole-ship list AND the last-gate list — ask which he meant if ambiguous (he meant the last gate this time).
- **The door/welcome screen is Blake's pride surface** — changes there get extra care and he checks them every round. Same now true of the veil.

<!-- author: Cowork | date: 2026-07-08 -->
## 15 · The goal-based era (2026-07-02 onward — supersedes per-gate cadence for big ships)

Blake's own pivot: *"give it an end goal and let it work its way to the goal. Us telling it how to do it isn't the best choice"* + *"Let it work for however long it needs and then one smoke test."* The v2.0.0 mega-run (5 milestones, 10 reports, 8 adversarial panels, ONE final smoke, one cutover) proved it. How it works now:

- **Big ships:** SHIP-PROMPT = END STATES + non-negotiable constraints; method/order/gates are Code's own. Code runs long + autonomously, writes milestone reports; Cowork digests any time Blake says `report`; Blake smokes ONCE comprehensively at the end. **Small fixes:** surgical Max gates, his items quoted with HIS numbering.
- **Panels are non-negotiable** — a HIGH-or-better every single round. If agent budget dies: solo pass + disclosed weakness + independent re-run as a gate condition before ship.
- **His console/pc steps get click-by-click scripts** written for zero prior knowledge (the F12 backfill walkthrough pattern — he read three numbers back and it was done).
- **De-Blake copy default:** new visitor-facing copy is neutral-but-warm; his name only where identity is the point (The Den, CREATOR marks, the watching line, his bio).
- **His messages sometimes cut off mid-sentence** — ask for the rest IMMEDIATELY, never guess (the three-week "Be able to create ___" mystery died unanswered).
- **Discussion-before-prompt is his rhythm now:** he says "don't write the prompt yet / lets discuss" — mirror the captured list back, ask ≤4 multiple-choice decisions (leave room for custom answers like "2 and 3"), THEN write on his "write it".
- **He announces ships to his community on Discord** — offer a ready-to-paste announcement (fancy, emoji-bulleted, under 2000 chars) at big launches; the OG preview unfurls under the link now, which he loves.
- **Data integrity paranoia is permanent** after the December-reviews reversion: any operation touching the Excel master = backup-first, candidate-file, diff-table, his explicit approval. His written words are the least replaceable thing in the project.
