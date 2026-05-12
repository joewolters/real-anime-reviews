<!-- author: Cowork | date: 2026-05-11 -->
# v1.6.5 — Gate 10 (`git add -A`)

> **Rolling prompt file.** Overwritten per gate. Latest active prompt lives here.

---

## Status — gate 9 approved end-to-end

- Full diff captured, npm test 7/7 (30.2s), `--check` re-confirms 14 strings at 1.6.5
- **Two surprise findings resolved as interpretation (i) — ride-along.** Both originate from Cowork's mid-ship doc edits (NEXT.md expansions + ROADMAP v1.9.0 section) written when Blake surfaced observations during v1.6.5 smoke. They're tightly coupled to v1.6.5 (reference it by name in attribution quotes), so bundling into the v1.6.5 commit is the natural grouping.
- **Final commit scope: 12 modified + 3 untracked (= 15 files via `git add -A`).**
- No anomalies; Code's judgment to hold back the three large already-reviewed admin diffs (admin/new-anime.css, admin/new-anime.js, admin/new-anime.html) was correct — those have been tracked through every prior gate.

---

## Gate 10 — `git add -A`

Single mechanical command. No file edits, no proposals to review — just stage everything for commit.

### Process

1. **Run `git add -A`** from `Current Version/`.
2. **Run `git status --short`** to verify all 15 files (12 modified + 3 newly-added) are now in the staging area (the lines should now have an `M` or `A` in the leftmost column instead of the ` M` or `??` from gate 9).
3. **Write a brief confirmation to `docs/SHIP-OUTPUT.md`** (overwriting gate 9 content):
   - `git status --short` post-add output
   - Count check: 15 files in staging (M for the 12 modified + A for `card-render.js` + `docs/SHIP-OUTPUT.md` + `docs/SHIP-PROMPT.md`)
   - One-sentence confirmation that nothing else snuck into staging
4. **One-liner reply in chat:** "gate 10 staged, ready for gate 11 (git commit + push)."

**Note:** The git commit doesn't happen in gate 10 — only the `add`. The commit happens at gate 11 along with the push, paired as one explicit pause because the commit message is the durable artifact and the push is the public reveal. Gate 11's SHIP-PROMPT will spec the commit message.

---

## Gate 11 — `git commit` + `git push`

**Commit message** (spec'd here so gate 11's SHIP-PROMPT doesn't have to repeat it):

```
Bump to v1.6.5 — Live preview as you type for the admin form
```

Standard format matching prior bumps. Single-line title; no body. Body lives in CHANGELOG.md (which is in the commit).

After commit, **`git push`** to `origin main`. The repo is `joewolters/real-anime-reviews`.

Capture both outputs (the commit hash from `git commit`, the push refspec from `git push`) and write to SHIP-OUTPUT.md.

---

## Gates 12 through 14

- **Gate 12 — Preview deploy.** `firebase hosting:channel:deploy preview-v1-6-5` from `Current Version/`. Capture the preview URL. **Blake manually inspects in browser at the preview URL:**
  - Admin form's live preview working end-to-end (gosick test — title canonicalizes to GOSICK, preview card renders)
  - Homepage cards render identically to current production
  - Japanese "プレビュー" text in admin form renders correctly
  - New widget bullet ("Improved the tools used to add new anime to the catalog.") appears in the changelog widget on the homepage preview
  - Sticky preview panel works on the preview URL admin form (overflow-x: clip)
  - Blake reports pass/fail in chat to Cowork; Cowork relays approval/revision to Code.
- **Gate 13** — pause before production `firebase deploy --only hosting`. Cowork approves explicitly after Blake's preview pass. No automatic chain from gate 12 to 13 — Blake's visual verification IS the gate.
- **Gate 14** — production verification per release-skill.md Step 11, PLUS:
  - `curl https://realanimereviews.com/docs/SHIP-PROMPT.md` → must return 404 (firebase ignore working — gate 2's fix)
  - `curl https://realanimereviews.com/docs/SHIP-OUTPUT.md` → must return 404 (same)
  - Smoke-check the production admin form (one quick gosick test on prod) — confirms the whole pipeline matches preview

---

## Discipline reminder

Show-then-apply for non-rolling files. Gate 10 is mechanical (one command), but if anything unexpected surfaces — staging count off, files in staging that aren't from gates 0–9, `git status` reports anything other than the expected M/A pattern — STOP and surface in SHIP-OUTPUT.md before proceeding to gate 11.

---

## Reminder

Code outputs to `docs/SHIP-OUTPUT.md` per gate (overwrite). Cowork prompts in this file (overwrite). Chat one-liners between gates. **Show-then-apply for non-rolling-file edits — strict.**
