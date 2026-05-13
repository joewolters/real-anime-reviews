<!-- author: Cowork | date: 2026-05-13 -->
# v1.6.8 — Gate 11 (stage + commit + push) — **FAST-TRACK**

> **Fast-track mode** — stage, commit, push. Stop and pause only on a stop condition.

Gate 10 verified ✓ (12 files clean, npm test 7/7, firebase.json mirror intact, no leak). Advancing to gate 11.

---

## Three operations

### 1. Stage all 12 changed files

```
git add -A
```

The 12 files from gate 10 (9 non-rolling + 3 rolling docs). Per the v1.6.7 gate-10b plan, the rolling docs (`docs/SHIP-PROMPT.md`, `docs/SHIP-OUTPUT.md`, `docs/HANDOFF.md`) roll into this commit even though they're firebase-ignored. They're git-tracked, so they belong in the v1.6.8 commit.

### 2. Commit

**Author identity (CLAUDE.md explicit convention — no ambiguity):**

- **Author name:** `Blake Wolters`
- **Author email:** `196413457+joewolters@users.noreply.github.com`
- **NO `Co-Authored-By: Claude` line.** NO `Co-Authored-By` lines of any kind. The project's commit convention is Blake-only authorship.

The standard tooling default of adding a `Co-Authored-By: Claude <noreply@anthropic.com>` line is OVERRIDDEN by CLAUDE.md for this repo. Strip it if the tooling tries to add it.

**Commit message shape:**

Subject line (≤70 chars, imperative voice, no version-tag suffix on the subject):

```
Ship v1.6.8: More Info panel on public anime modal (franchise scope split Part B+)
```

Body (sourced from CHANGELOG.md's v1.6.8 entry — the gate-6 work — condensed for commit-message length; full prose lives in CHANGELOG.md):

```
Visitor-facing surface of the v1.6.7 franchise scope split. A collapsible
"Click for More Info" tab on every anime modal expands into a panel
showing the show's full franchise — PREQUEL / MAIN / SEQUEL / PARENT
relations rendered as cards with cover thumbnails, English + romaji titles,
year / episode count / studio meta, and AniList community scores. Every
row clickable — opens that season's AniList page in a new tab.

Implementation:
- script.js (+309): findInCatalog helper; new More Info data/render block
  (ANILIST_ENDPOINT_PUBLIC, two GraphQL queries — popularity-sorted
  Page(media:) for by-search, Media(id:) for by-id; buildMainNode,
  fetchRelationsFromAniList ({sourceId, edges} shape), fetchRelationsForModal
  cache wrapper, renderMoreInfoPanel four-state renderer, renderMoreInfoEntry
  per-row markup); openModal markup additions + three event listeners
  (tab-click expand+fetch+render, X-close, card-click → window.open).
- style.css (+211 / -1): new "v1.6.8 — More Info panel" section (~205 lines);
  modal grid 1.6fr 1fr → auto 1.6fr 1fr; mobile stack rule; gate-5b/5c
  refinements (collapsed tab width 40→140px, panel/tab alpha bump,
  unavailable rule removed).
- admin/new-anime.js (+2): coverImage { large } added to relations.edges.node
  in both FULL_QUERY and FULL_QUERY_BY_ID (parity with the public query).
- Version bump 1.6.7 → 1.6.8 across 14 static strings in index.html,
  account.html, admin/new-anime.html.
- Docs: CHANGELOG, ROADMAP, NEXT.md cascade.

Three internal iteration passes folded in:
- gate 4b: re-indent the v1.6.8 block to match the IIFE wrapper's 2-space
  convention in script.js.
- gate 5b: fix HTTP 404 from AniList caused by passing both search and id
  as variables with one null; split into two queries each carrying a single
  variable.
- gate 5c: replace basic Media(search:) (which returned Onigiri for
  "Demon slayer") with popularity-sorted Page(media:); make every row
  clickable to AniList (including MAIN — per Blake's design call); drop
  the --unavailable greying.

Known limitations queued for v1.6.10:
- Multi-hop relations not yet traversed (One Punch Man S3 missing).
- Per-entry studio dedupe (MADHOUSE,MADHOUSE on Frieren S2).

Tier A. npm test 7/7. Blake browser smoke verified across Demon Slayer,
Re:Zero, OPM, and standalone titles.

See CHANGELOG.md for full visitor-facing summary.
```

(That's verbose for a commit body — Code can trim if it feels excessive. The CHANGELOG.md has the canonical version; commit message is supplementary. Aim for a body Blake will appreciate reading later but not bloat.)

### 3. Push to main

```
git push origin main
```

No force-push. No branch — `main` is the working branch per the project's flow.

---

## Stop conditions (pause if hit)

1. **`git add -A` would stage something unexpected** — if `git status` shows a file not in gate 10's list of 12, surface it before staging.
2. **The tooling tries to add `Co-Authored-By: Claude`** despite explicit instructions — surface the situation, strip the line, retry. If you can't strip it without manual intervention, pause.
3. **`git push` is rejected** — diverged from origin, push hook failure, auth issue — surface the rejection message, pause.
4. **`git status` after commit shows uncommitted changes** — should be clean post-commit. If anything remains, surface what + why.

---

## Apply + report (when no stop conditions hit)

Overwrite `docs/SHIP-OUTPUT.md` with:

1. **Confirmation of staged files** — `git status` short output BEFORE the commit (should show 12 files staged).
2. **Commit details** — the commit SHA, the author line as recorded by git (`git log -1 --pretty=fuller HEAD`), and confirmation that NO `Co-Authored-By` lines are present (`git log -1 --pretty=%B HEAD | grep -c 'Co-Authored-By'` should be 0).
3. **Push confirmation** — `git push` output showing the push succeeded to `origin/main`.
4. **Post-push status** — `git status` showing the working tree clean.
5. **One-liner reply**: "v1.6.8 gate 11 staged + committed + pushed (SHA: ABC1234, author: Blake Wolters, no Co-Authored-By, working tree clean). Awaiting gate 12 prompt."

---

## Constraints

- **Author identity is non-negotiable** — Blake Wolters, no co-author line.
- **Stage only the 12 expected files** — gate 10 audited the working tree; nothing else should appear.
- **No force-push.**
- **No branch creation** — direct to main.
- **Author marker on `docs/SHIP-OUTPUT.md`**: `<!-- author: Code | date: 2026-05-13 -->`.

---

## Next after gate 11

- **Gate 12** (preview deploy) — FAST-TRACK. Blake runs `firebase hosting:channel:deploy preview-v1-6-8` himself when ready (or Code can run it; check the project's convention). Reports the preview URL.
- **Gate 13** (preview smoke) — Blake verifies the preview URL in browser.
- **Gate 14** (production deploy) — FAST-TRACK after Blake's explicit "ship it" go-signal.
- **Gate 15** (prod verify) — Blake verifies realanimereviews.com in browser.
