<!-- author: Cowork | date: 2026-05-11 -->
# v1.6.6 — Gate 10 (`git add -A`)

> **Rolling prompt file.** Overwritten per gate. Latest active prompt lives here.

---

## Status — gate 9 approved end-to-end

- Full diff reviewed: 9 modified files (7 v1.6.6-attributable + 2 rolling SHIP-*.md). Cowork's "~6 modified" estimate undercounted; Code's 9 is the right number.
- `npm test` 7/7 in 17.8s — baseline range, no regressions
- `--check` 14/14 strings at 1.6.6 — no drift
- No surprise files. Every diff hunk attributable to gate 2/5/6/7/8.
- All gate 7/8 wording landed exactly as proposed (widget bullet prepended, Mynoghra dropped, v1.6.5 gap closed via Option β, cover-image v1.6.x row deleted, version cascades preserve surrounding text).

---

## Gate 10 — `git add -A`

Mechanical single command. No file edits, no proposals to review — stage everything for commit.

### Process

1. **Run `git add -A`** from `Current Version/`.
2. **Run `git status --short`** to verify all 9 files are now in the staging area (the leftmost column should now show `M` for each file, not ` M` from gate 9).
3. **Write brief confirmation to `docs/SHIP-OUTPUT.md`** (overwriting gate 9 content):
   - `git status --short` post-add output verbatim
   - Count check: 9 files staged (all M, no A — no untracked files in v1.6.6)
   - One-sentence confirmation that nothing else snuck into staging
4. **One-liner reply in chat:** "gate 10 staged, ready for gate 11 (commit + push)"

**Note:** the git commit doesn't happen in gate 10 — only the `add`. Gate 11 handles commit + push together. Gate 11's commit message is pre-specified below.

---

## Gate 11 — `git commit` + `git push` (after Cowork's gate 10 approval)

**Commit message:**

```
Bump to v1.6.6 — Hotfix: cover image now fills card frame
```

Single-line title matching the v1.6.1 hotfix's commit cadence. No body — narrative lives in CHANGELOG.md.

After commit, **`git push`** to `origin/main`. Repo: `joewolters/real-anime-reviews`.

Capture both the commit hash (from `git commit`) and the push refspec (from `git push`) to SHIP-OUTPUT.md.

---

## Gate 12 — Preview channel deploy (after Cowork's gate 11 approval)

**`firebase hosting:channel:deploy preview-v1-6-6`** from `Current Version/`. Capture the preview URL.

**Blake then manually inspects in browser at the preview URL:**

1. **Homepage cards** — visit `<preview-url>/`. Spot-check 2–3 anime cards. Cover image should fill the card frame cleanly. No dark/empty bars top, bottom, or sides.
2. **Admin form preview** — visit `<preview-url>/admin/new-anime`. Sign in as admin. Type `gosick` → click **Fetch**. Live preview card on the right should show the cover filling the card frame cleanly. Try 2-3 more anime (`frieren`, `csm`, anything) — each preview should fill cleanly.
3. **Optional comparison** — open production (`https://realanimereviews.com`) in another tab. Compare homepage cards on preview vs prod. Visible improvement on preview (cards filling cleanly), no regression on the visual style (cards still look like cards, not stretched/cropped weirdly).

**Blake reports pass/fail to Cowork.** Code does NOT proceed to gate 13 (production deploy) automatically. **Gate 12 ≠ gate 13** — explicit go-signal at each.

---

## Gate 13 — Production deploy (separate explicit go-signal from Cowork)

ONLY after Blake's preview pass + Cowork's explicit approval:

```
firebase deploy --only hosting
```

Capture deploy output to SHIP-OUTPUT.md.

---

## Gate 14 — Production verification

Per release-skill.md Step 11, plus the curl checks for hygiene:

- **`curl https://realanimereviews.com/`** → HTTP 200 with `v1.6.6` in APP_VERSION + changelog widget static fallback
- **`curl https://realanimereviews.com/style.css?v=1.6.6`** → HTTP 200, grep for `object-fit: cover` on the `.card img` rule — confirms the fix is on production
- **`curl https://realanimereviews.com/docs/SHIP-PROMPT.md`** → HTTP 404 (firebase ignore working)
- **`curl https://realanimereviews.com/docs/SHIP-OUTPUT.md`** → HTTP 404 (same)
- **Browser check on production:** Blake visits `https://realanimereviews.com/admin/new-anime`, gosick test, confirms preview card fills cleanly. Plus a quick spot-check of homepage cards.

---

## Discipline reminder (still in effect)

Show-then-apply for non-rolling files. Gate 10 is mechanical (one command) — but per the v1.6.5 gate-12-skip lesson, gate 11 (push) does NOT chain into gate 12 (preview), and gate 12 does NOT chain into gate 13 (production). Each pause is real and requires explicit Cowork approval. "Push" doesn't mean "push to production" — it means `git push` only.

---

## Reminder

Code outputs to `docs/SHIP-OUTPUT.md` per gate (overwrite). Cowork prompts in this file (overwrite). Chat one-liners between gates. **Show-then-apply for non-rolling-file edits — strict. Gate 11 ≠ gate 12 ≠ gate 13.**
