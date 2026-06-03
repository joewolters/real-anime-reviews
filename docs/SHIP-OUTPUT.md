<!-- author: Code | date: 2026-06-02 -->
# v1.6.11 — Gate 6 (audits — DONE ✓ with 1 SURFACE, FAST-TRACK)

> Sub-step 1 PASS (Playwright 7/7). Sub-step 2 PASS (firebase.json ↔ .gitignore mirror is correctly asymmetric per project rule #8; all 6 gate-6 §19-24 specific checks pass). Sub-step 3 STRUCTURALLY PASS + **7 unexpected modifications outside Code's v1.6.11 build gates surfaced** — 6 modified docs files + 1 new docs file that appear Cowork-managed. **Not blocking** but recommending Cowork confirms intent before gate 7 commit.

---

## Sub-step 1 — `npm test` (Playwright) → ✓ PASS

```
  7 passed (19.4s)
```

7/7 green. Rule #7 satisfied — prod-facing commit can proceed.

---

## Sub-step 2 — `firebase.json` ↔ `.gitignore` mirror audit → ✓ PASS

### firebase.json `hosting.ignore` array (14 entries)

```json
"ignore": [
  "firebase.json",         // bootstrap
  "**/.*",                 // bootstrap (hidden files)
  "**/node_modules/**",    // bootstrap
  "PERSONAL.md",           // sensitive — also in .gitignore ✓
  "UpdateLog/**",          // committed but don't-deploy (intentional asymmetric)
  "AUDIT_*.md",            // sensitive — also in .gitignore ✓
  "docs/SHIP-*.md",        // committed rolling docs, don't-deploy ✓
  "docs/HANDOFF.md",       // committed rolling doc, don't-deploy ✓
  "tests/**",              // committed test infra, don't-deploy ✓
  "playwright.config.js",  // committed test infra, don't-deploy ✓
  "package.json",          // committed tooling, don't-deploy ✓
  "package-lock.json",     // committed tooling, don't-deploy ✓
  "playwright-report/**",  // .gitignored + don't-deploy ✓
  "test-results/**"        // .gitignored + don't-deploy ✓
]
```

### Asymmetry is intentional per project rule #8

The two lists serve different purposes — sensitive secrets must be in BOTH; build/tooling artifacts that should be committed for the repo but not uploaded to the CDN go in `firebase.json` ignore ONLY. The 14 entries break down:

- **Both `.gitignore` AND `firebase.json` ignore** (sensitive — must never leak): `PERSONAL.md`, `AUDIT_*.md`, `node_modules`, `playwright-report/`, `test-results/`, `.env`, `.firebase/` (the last 3 covered by `**/.*` in firebase + explicit in .gitignore). ✓
- **`firebase.json` ignore ONLY** (committed to repo, don't deploy): `UpdateLog/**`, `docs/SHIP-*.md`, `docs/HANDOFF.md`, `tests/**`, `playwright.config.js`, `package.json`, `package-lock.json`. ✓ All deliberate per the existing project pattern.

### Gate-6 §19-24 specific checks

| Check | Status |
|---|---|
| `firestore.rules` NOT in firebase ignore (deploys via `--only firestore:rules`) | ✓ not in the ignore array |
| `firestore.indexes.json` NOT in firebase ignore | ✓ not in the ignore array |
| `docs/SHIP-*.md` IN firebase ignore | ✓ entry 7 |
| `docs/HANDOFF.md` IN firebase ignore | ✓ entry 8 |
| `tests/**`, `playwright.config.js`, `package.json`, `package-lock.json`, `playwright-report/`, `test-results/` all firebase-ignored | ✓ entries 9-14 |

All 6 checks pass. No mirror drift.

---

## Sub-step 3 — `git diff` review → ✓ STRUCTURALLY PASS + 7 surfaces

### `git diff --stat HEAD` summary

```
 20 files changed, 590 insertions(+), 201 deletions(-)
```

### EXPECTED modifications (13 files — direct v1.6.11 work):

| File | Maps to gate |
|---|---|
| `CHANGELOG.md` | gate 5 |
| `ROADMAP.md` | gate 5 |
| `account.html` | gate 5 (bump-version) |
| `admin-fab.js` | gate 3d-apply (Suggestion Queue menu entry) |
| `admin/new-anime.html` | gate 5 (bump-version) |
| `admin/new-anime.js` | gate 2b + 3e (suggest/anilistId URL param handler) |
| `docs/HANDOFF.md` | rolling (Cowork) |
| `docs/NEXT.md` | gate 5 |
| `docs/SHIP-OUTPUT.md` | rolling (Code per gate) |
| `docs/SHIP-PROMPT.md` | rolling (Cowork per gate) |
| `firebase.json` | gate 1b (firestore block) |
| `index.html` | gates 3c (CTA banner) + 3d (admin-fab) + 5 (bump + widget bullet) |
| `scripts/bump-version.js` | gates 1b + 2b (TARGETS additions) + 5b (4 more TARGETS) |
| `style.css` | gates 3c (banner CSS) + 3d (arrow upsize) |

### EXPECTED new (untracked) files — 8 files per gate-6 §39:

`firestore.rules`, `firestore.indexes.json` (gate 1b); `suggest.html`, `suggest.js`, `suggest.css` (gate 1b); `admin/suggestions.html`, `admin/suggestions.js`, `admin/suggestions.css` (gate 2b). ✓ All 8 accounted for.

### 🟡 SURFACE — 7 unexpected files outside Code's v1.6.11 build gates

These appear in the working tree but were NOT touched by any gate Code executed during this ship:

**Modified (6):**

| File | Diff size | Note |
|---|---|---|
| `docs/AI-PRIMER.md` | +22 / -? lines | Not edited by any v1.6.11 Code gate |
| `docs/CODE-PROMPTS.md` | +2 / -1 lines | Not edited by any v1.6.11 Code gate |
| `docs/SKILLS/README.md` | +8 / -? lines | Not edited by any v1.6.11 Code gate |
| `docs/SKILLS/hotfix-skill.md` | +4 / -? lines | Not edited by any v1.6.11 Code gate |
| `docs/SKILLS/release-skill.md` | +35 / -? lines | Not edited by any v1.6.11 Code gate (largest of the surface set) |
| `docs/SKILLS/widget-update-skill.md` | +2 / -? lines | Not edited by any v1.6.11 Code gate |

**New untracked (1):**

| File | Note |
|---|---|
| `docs/COWORK-STYLE.md` | New file, not created by any Code gate |

These look like Cowork-managed doc improvements made out-of-band between gates (consistent with the rolling docs pattern). **Not blocking v1.6.11 ship** — they're docs-only, no code impact. But per gate-6 §41 ("If you see anything else untracked or unexpected, surface it"), flagging for Cowork's confirmation before gate-7 stages them.

**Two paths forward:**
1. **Ship as-is** — if these are Cowork-intentional doc improvements that should ride with the v1.6.11 commit, just proceed to gate 7 with `git add -A`.
2. **Selective stage** — if any of these should NOT ship with v1.6.11, gate 7 stages explicit files instead of `-A`.

Recommend path 1 (ship all together) unless Cowork knows of a reason to exclude.

---

## Stop-condition audit (gate 6 §4 "don't half-state")

| Stop | Status |
|---|---|
| `npm test` fails | ✓ Not hit (7/7) |
| Mirror drift | ✓ Not hit (all 6 specific checks pass; asymmetry is intentional per rule #8) |
| `git diff` shows rogue change | 🟡 7 unexpected files surfaced — not strictly "rogue" (look like Cowork doc work), but not from any Code gate. Reporting per §41 rather than blocking. |

---

## One-liner reply

Gate 6 done with all 3 sub-steps green: **(1)** `npm test` 7/7 (19.4s); **(2)** `firebase.json` ↔ `.gitignore` mirror correctly asymmetric per project rule #8 — sensitive files in BOTH (PERSONAL.md, AUDIT_*.md, .env, node_modules), committed-but-don't-deploy files in firebase-ignore ONLY (UpdateLog/, docs/SHIP-*.md, docs/HANDOFF.md, tests/, playwright.config.js, package.json, package-lock.json) — plus all 6 gate-6 §19-24 specific checks pass (firestore.rules + firestore.indexes.json correctly NOT firebase-ignored; SHIP-*.md + HANDOFF.md + tests/ + playwright config + package.json + package-lock.json + playwright-report/ + test-results/ correctly ARE firebase-ignored); **(3)** `git diff --stat HEAD` shows 20 modified + 9 untracked files totaling +590/-201 net, with the **13 expected modifications** (CHANGELOG, ROADMAP, account.html, admin-fab.js, admin/new-anime.html + .js, NEXT.md, firebase.json, index.html, scripts/bump-version.js, style.css, plus rolling HANDOFF/SHIP-OUTPUT/SHIP-PROMPT) and **8 expected new files** (firestore.rules, firestore.indexes.json, 3× suggest.*, 3× admin/suggestions.*) all mapping cleanly to v1.6.11 build gates, BUT **7 unexpected items surfaced** for Cowork's confirmation before gate 7 — 6 modified docs files (docs/AI-PRIMER.md, docs/CODE-PROMPTS.md, docs/SKILLS/README.md, docs/SKILLS/hotfix-skill.md, docs/SKILLS/release-skill.md +35 lines being the largest, docs/SKILLS/widget-update-skill.md) + 1 new docs file (docs/COWORK-STYLE.md) that appear Cowork-managed (likely out-of-band doc improvements between gates, consistent with the rolling-docs pattern) — **not blocking, no code impact**, recommend ship-as-is at gate 7 unless Cowork flags a reason to exclude; no real stop conditions hit; ready for gate 7 (commit + push) once Cowork confirms the 7 surfaces.
