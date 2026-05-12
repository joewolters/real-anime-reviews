<!-- author: Cowork | date: 2026-05-12 -->
# v1.6.7 — Gate 11 (git add -A + pause for staged-state review)

> **Rolling prompt file.** Overwritten per gate. Latest active prompt lives here.

---

## Status — gates 2 + 3 + 5 + 6/6b + 7/7b + 8/8b + 9/9b + 9c + 10/10b applied ✅

- **Gate 10 verification:** Full diff reviewed, npm test 7/7 green in 14.3s. Tier A test pass requirement satisfied.
- **Gate 10b applied:** Option A for the HANDOFF.md leak. `docs/HANDOFF.md` added to `firebase.json` ignore array next to `docs/SHIP-*.md`. Single +1/-0 edit. Leak window closed.
- **Working tree:** 11 modified + 1 untracked (HANDOFF.md, which will be picked up by gate 11's `git add -A` and committed but firebase-ignored on deploy).

---

## Gate 11 — `git add -A` + pause

This gate stages everything for commit. **No commit yet** — that's gate 12, separate go-signal.

### Process

1. **Run:**

   ```bash
   git add -A
   ```

2. **Capture the staged state:**

   ```bash
   git status --short
   git diff --cached --stat
   ```

   The expected result: 12 staged files (the 11 modified + the 1 untracked HANDOFF.md now picked up). Working tree should be clean post-add (no remaining modified/untracked entries).

3. **Sanity-check the staged set against gate 10's modified list:**
   - `CHANGELOG.md`
   - `ROADMAP.md`
   - `account.html`
   - `admin/new-anime.css`
   - `admin/new-anime.html`
   - `admin/new-anime.js`
   - `docs/HANDOFF.md` ← previously untracked, now staged
   - `docs/NEXT.md`
   - `docs/SHIP-OUTPUT.md`
   - `docs/SHIP-PROMPT.md`
   - `firebase.json` ← added at gate 10b
   - `index.html`

   That's 12 files. If anything is missing or extra, surface as anomaly.

4. **Verify no embarrassments are staged.** Quick sanity scan:
   - No `.env` files
   - No `PERSONAL.md`
   - No `AUDIT_*.md`
   - No `node_modules/` or `.firebase/` debris
   - No `playwright-report/` or `test-results/` directories
   - No `*.log` files or `.DS_Store`

   These should all be either gitignored or absent, but worth a quick `git diff --cached --name-only | grep -E '(PERSONAL|AUDIT|\.env|node_modules|playwright-report|test-results|\.log$|DS_Store)'` to confirm zero hits.

### Output to `docs/SHIP-OUTPUT.md`

Overwrite gate 10 content with:

1. **`git status --short` after staging** — should show clean working tree.
2. **`git diff --cached --stat`** — should show all 12 files staged.
3. **Embarrassment grep result** — should be zero matches.
4. **Anomalies / risks** — anything unexpected in the staged set.
5. **One-liner reply in chat:** "gate 11 staged (12 files), awaiting approval to commit at gate 12."

**No `git commit`, no `git push`, no deploy.** Gate 11 ends here. Commit happens at gate 12 after Cowork approval AND with the gate 12 commit message draft reviewed.

---

## Gate 12 preview — commit message draft

Cowork will provide the gate 12 commit message draft in the next SHIP-PROMPT.md update. For Code's awareness, the message will follow the project convention (Code: re-check `docs/SKILLS/release-skill.md` if uncertain on the exact format — it's typically a subject line + paragraph body + footer with file count).

Don't draft or apply the commit at gate 11 — gate 11 is staging only.

---

## Process for gate 12 → gate 15

1. **Gate 12** — `git commit` + `git push`. Separate explicit go-signal from Cowork. Commit message reviewed in advance.
2. **Gate 13** — Preview deploy + Blake browser verification on the preview URL (re-run OPM fetch on preview, confirm aggregation works there).
3. **Gate 14** — Production deploy (separate explicit go-signal — gate 13 ≠ gate 14 discipline).
4. **Gate 15** — Production verification.

---

## Discipline reminders

- **Gate 11 stages only.** No commit, no push, no deploy.
- **Gate 12 needs a separate go-signal** AND Cowork-reviewed commit message draft.
- **Gate 13 ≠ Gate 14.** Preview deploy is its own pause.

---

## Reminder

Code outputs to `docs/SHIP-OUTPUT.md` per gate (overwrite). Cowork prompts in this file (overwrite). Chat one-liners between gates.
