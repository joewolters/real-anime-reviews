<!-- author: Code | date: 2026-05-09 -->
# Skill: Release a new version

> **Purpose:** ship a new version of Real Anime Reviews from working tree to live site, following every project rule, in the right order, without skipping steps.
>
> **Tier of this skill:** any. Works for PATCH, MINOR, and MAJOR.
>
> **Who should follow this:** Code (the CLI tool), Cowork sessions, future Mode 1 implementations, any AI assistant doing release work on this project. Blake himself can also follow it manually if no AI is available.

---

## Inputs required from Blake

Before invoking this skill, gather:

1. **The change set** — what's actually shipping (one or more file edits, already applied to the working tree).
2. **The new version** — `X.Y.Z` format. Choose tier:
   - **PATCH** (`Z` increments) — bug fixes, content updates, audit items, tooling, docs
   - **MINOR** (`Y` increments, `Z` resets to 0) — new user-facing features, no breaking changes
   - **MAJOR** (`X` increments, others reset to 0) — milestone or structural shift
3. **The CHANGELOG narrative** — one paragraph describing what changed and why. The user-facing story.
4. **Tier classification:**
   - **Tier A — production-facing** (HTML/JS/CSS/animeData.js touched). Tests required.
   - **Tier B — docs/tooling only** (no production-facing code). Tests exempt per `CLAUDE.md` rule #7.
   - **Tier C — metadata only** (repo settings, no files changed). Tests exempt; CHANGELOG entry is required, version bump is optional.

If any input is missing or unclear, ASK Blake before proceeding. Do not infer.

---

## The procedure

### Step 1 — Verify clean preconditions

```
git status
git log --oneline -3
node scripts/bump-version.js --check
```

Confirm:
- Working tree shows ONLY the intended change set (no surprise modifications).
- `--check` reports all 7 version strings agree at the *current* version (not the target).
- The HEAD commit message and date make sense for the next release.

If any of these are unexpected, STOP and surface the discrepancy. Do not proceed.

### Step 2 — Run tests (Tier A only)

For Tier A (production-facing) changes:

```
npm test
```

All tests must pass. If any fail, surface the failure to Blake — do NOT auto-fix. Decide together whether the test is wrong, the code is wrong, or the change set needs revision.

For Tier B and C, skip this step (per `CLAUDE.md` rule #7 docs-only/tooling exception).

### Step 3 — Bump the version

```
node scripts/bump-version.js X.Y.Z --dry-run
```

Show the dry-run output to Blake. Confirm the changes match the intent.

After approval:

```
node scripts/bump-version.js X.Y.Z
node scripts/bump-version.js --check
```

`--check` should now report all 7 strings agree at the new version.

### Step 4 — Write the CHANGELOG entry

Open `CHANGELOG.md`. Insert a new entry at the top (right after the `---` separator, before the previous newest entry). Format:

```markdown
<!-- author: Code | date: YYYY-MM-DD -->
## vX.Y.Z — [PATCH|MINOR|MAJOR] (YYYY-MM-DD)

[One-paragraph narrative — what shipped, why it matters.]

[Optional: bulleted list of specific changes for larger releases.]
```

The HTML comment marker is REQUIRED per project rule #2. Author values: `Code`, `Mode 1`, `Mode 2`, `human (Blake)`.

For Tier B and C releases, also note in the entry: "Tests not required per docs-only/tooling exception in `CLAUDE.md` rule #7."

### Step 4.5 — Update the widget bullets

Per project rule #6 ("every code-and-data change updates the website's CHANGELOG widget") and `docs/SKILLS/widget-update-skill.md`, every release — including Tier B tooling and Tier C metadata ships — curates the homepage widget bullets in `index.html` (the widget lives there only, despite what the bump-version script's coverage of both `index.html` and `account.html` might suggest).

The skill carries the full curation rules. Quick summary: write for a first-time visitor (no version numbers, no internal terms, no "we"); use generic phrasing for tooling ships ("Made some behind-the-scenes improvements..."); cap the visible list at 5 (oldest drops). Confirm bullets pass the first-time-visitor test before saving.

Mode 1 server's pipeline (step 5 of 9) handles widget curation automatically for new-anime ships — exempt from this manual step. Every other ship type goes through the skill.

### Step 5 — Update ROADMAP "Current state"

Open `ROADMAP.md`. Find the "Current state" section. Update:

- The "Live at vX.Y.Z" line to the new version.
- Add a one-line bullet to the recent ships list (mirroring the v1.4.1/v1.4.2/v1.4.3 entries).

Keep the rest of "Current state" intact.

### Step 6 — Diff review

```
git diff
git diff --stat
```

Show Blake the full diff. Pause for explicit approval before staging.

### Step 7 — Commit

After approval:

```
git add -A
git commit -m "Bump to vX.Y.Z — [short description matching CHANGELOG narrative]"
```

Conventional message format: `Bump to vX.Y.Z — [what changed]`. The `Bump to` prefix matches existing repo history (see `git log --oneline`).

### Step 8 — Push to GitHub

```
git push
```

If push fails (auth, network), surface the error. Do NOT retry with alternative auth methods. Ask Blake.

### Step 9 — Preview deploy (Tier A and B only)

For Tier A (production code) and Tier B (when CSS/HTML/JS strings change in a way visitors would see):

```
firebase use            # confirm project is "real-anime-reviews"
firebase login:list     # confirm account matches PERSONAL.md
firebase hosting:channel:deploy preview-vX-Y-Z
```

Print the preview URL. PAUSE — wait for Blake to verify the preview looks right.

For Tier C (metadata only) and Tier B docs-only releases that don't change anything visitor-facing: SKIP this step. There's nothing for visitors to preview.

### Step 10 — Production deploy

ONLY after explicit Blake approval:

```
firebase deploy --only hosting
```

NEVER auto-deploy to production without an explicit go-signal in chat.

### Step 11 — Verify production

After production deploy:

1. Open `https://realanimereviews.com` in incognito mode (bypasses cache).
2. Hard refresh (`Ctrl+Shift+R` on Windows, `Cmd+Shift+R` on Mac).
3. Confirm the visible version on the changelog widget matches `vX.Y.Z`.
4. Click one anime card to confirm the modal opens.
5. Check browser console — should be no new errors (the existing duplicate Firebase init is documented audit §1.7, not new).

If anything looks wrong, surface to Blake immediately. Don't attempt to "fix it forward" without his go-signal.

### Step 12 — Done

Report success to Blake with:
- The new version number
- The commit hash
- The preview URL (if used) and the production URL
- Any follow-up todos identified during the release (e.g., "remind me to add this anime to the Excel master")

---

## When this skill should NOT run

- Working tree is dirty with uncommitted changes that aren't part of the intended ship. Stop and reconcile first.
- Tests are failing (Tier A). Fix the failure before releasing.
- The version-bump script's `--check` reports drift before bump. Investigate why the strings diverged before adding more drift.
- Blake hasn't approved any meaningful step (deploy preview, deploy prod). Per "show, don't do."
- A previous release isn't fully resolved (e.g., v1.4.2 was committed but never deployed and we want to ship v1.4.3 over it). Reconcile the lineage first.

---

## Common errors and what they mean

| Error | Likely cause | Fix |
|---|---|---|
| `bump-version.js: pattern not found in <file>` | Someone hand-edited a version string into a non-matching format | Read the file, fix the format manually, re-run script |
| `npm test` fails with new errors | Recent change broke a test, or a test was wrong | Surface to Blake, don't auto-fix |
| `firebase deploy` says "no project active" | Wrong CWD or `.firebaserc` missing | `cd` into `Current Version/` and confirm `firebase use` |
| `git push` says "Permission denied" or "401" | GitHub auth expired | Ask Blake to re-authenticate; do NOT try alternative methods |
| `--check` shows mismatched versions after bump | Edit failed silently on one file | Re-run the bump; if persists, investigate file permissions |

---

## Example invocation (Blake-friendly)

> "Follow `docs/SKILLS/release-skill.md` to ship version 1.5.0. The change set is the new `scripts/sync-excel-to-js.js` and one new anime entry in `animeData.js`. This is Tier A (production code). CHANGELOG narrative: 'Phase A ships — Excel master is now canonical for anime data; sync script propagates Excel edits to deployed JS.'"

---

## Why this skill exists in this exact shape

The release flow has historically been a 7-step manual checklist in `CLAUDE.md`'s "Version bump checklist" section, plus various ad-hoc reminders about CHANGELOG markers, tests, deploy ladders, and approval gates. Without consolidation, every release session re-derived the steps and occasionally missed one (the v1.3.4 widget bug was missing one of the 7 version strings — exact category this skill prevents).

When Mode 1 ships in v1.6.0, its implementation should literally execute the steps in this skill. This file is the spec; Mode 1 is the automation.
