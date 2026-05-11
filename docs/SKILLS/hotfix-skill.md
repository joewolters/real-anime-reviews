<!-- author: Code | date: 2026-05-10 -->
# Skill: Ship a hotfix

> **Purpose:** ship a small, urgent bug fix to Real Anime Reviews quickly and safely. Companion to `release-skill.md`. Use this skill when the fix is small, blocking, and PATCH-tier.
>
> **Tier of this skill:** PATCH only. If a fix turns out to need more than a handful of lines or starts touching multiple subsystems, stop and switch to `release-skill.md` instead.
>
> **Who should follow this:** Code (the CLI tool), Cowork sessions, future Mode 1 implementations, Blake manually if no AI is available.

---

## When to use this skill instead of release-skill.md

Use **this** skill when ALL of the following are true:

- The fix is a clear bug (something works wrong, not "we'd like to improve X")
- The fix is small — a handful of lines, typically a revert or a one-pattern change
- The bug is currently affecting Blake or users (not a cosmetic concern that can wait)
- The change set touches at most 2-3 files
- The fix is PATCH-tier — no new user-facing capability is being introduced

Use **release-skill.md** for everything else.

---

## When Mode 1 itself is broken (manual fallback)

Normally hotfixes ship through `npm run mode1` like any other change. But Mode 1 may itself be the thing that's broken. Example: Bug 10 (v1.6.0) — `spawn EINVAL` on `npm test` made the Mode 1 server unable to ship anything. When that's true, ship manually using the pre-Mode-1 workflow:

```
# 1. Edit the affected file(s) — show the diff first, get Blake's approval

# 2. Run tests directly in the terminal — NOT through the server
npm test

# 3. Bump version (this works fine — bump-version.js is plain node, not affected)
node scripts/bump-version.js X.Y.Z --dry-run
node scripts/bump-version.js X.Y.Z
node scripts/bump-version.js --check

# 4. Edit CHANGELOG.md and ROADMAP.md "Current state" by hand
#    Per release-skill.md Steps 4 and 5 — same format, just done in the editor instead of the server.

# 5. Review the diff once everything is in place
git diff
git diff --stat

# 6. Commit, push, deploy manually — only after Blake's explicit approval
git add -A
git commit -m "Bump to vX.Y.Z — [short description matching CHANGELOG narrative]"
git push
firebase deploy --only hosting

# 7. Verify production per release-skill.md Step 11
```

This is exactly the workflow Real Anime Reviews used before Mode 1 existed. It's still a fine workflow — just slower and more clicks. Once Mode 1 is fixed by the hotfix, the next ship returns to `npm run mode1`.

---

## Hotfix-specific decisions

When using either path above, hotfix shape differs from a normal release in a few ways:

1. **CHANGELOG narrative is shorter.** One sentence to one paragraph. Hotfixes don't need the long story; they need the symptom, the fix, and a line about why it slipped through.

2. **Preview deploy can be skipped** if the change is mechanical — a revert, a single string fix, a one-line obvious correction with no rendering or logic surface. Hotfixes that touch logic, rendering, or anything visitor-visible still go to a preview channel first per project rule #5.

3. **Tier classification:**
   - A hotfix to production code (HTML / JS / CSS / `animeData.js`) is **Tier A** — tests required.
   - A hotfix to a script (like `scripts/mode1-server.js` or `scripts/bump-version.js`) that isn't deployed to production is **Tier B** — tests not required by project rule #7 since it's tooling. *But* if the hotfix is FOR the tooling itself, running `npm test` once is still good practice to confirm the fix didn't break the test pipeline as a side effect.

4. **Version number always increments Z (PATCH).** Never bump Y for a hotfix. If the fix is large enough to warrant a Y bump, it's not a hotfix — switch to `release-skill.md`.

5. **Author marker is still required** per project rule #2. `<!-- author: Code | date: YYYY-MM-DD -->` on the line above every CHANGELOG entry and meaningful doc change.

---

## Hotfix CHANGELOG format

```markdown
<!-- author: Code | date: YYYY-MM-DD -->
## vX.Y.Z — PATCH (YYYY-MM-DD)

**[One sentence: what broke and how this fixes it.]**

- [Specific change, file:line if useful]
- [Specific change, file:line if useful]

[Optional: short paragraph on why this slipped through — what testing caught it, what testing didn't, whether a new regression test is being added.]

[For Tier B: note "Tests not required per `CLAUDE.md` rule #7 (tooling exception). [Brief mention of any manual verification done.]"]
```

---

## What this skill does NOT cover

- **MINOR or MAJOR feature work** — use `release-skill.md`.
- **Multi-file refactors** — even if motivated by a bug, plan and ship as a normal release.
- **Anything touching the deploy ladder itself** — changes to `firebase.json` ignore arrays, `.gitignore`, the Mode 1 server's deploy step — should ship as a full release with extra scrutiny because those are precedent-setting and have caused leaks in the past (v1.3.5, v1.3.9).
- **Anything touching `assets/` images on existing anime** — image curation is hybrid per project rule #9 and image swaps are always Blake-initiated, never hotfix material.

---

## Example invocation (Blake-friendly)

> "Follow `docs/SKILLS/hotfix-skill.md` to ship v1.6.1. The bug is Mode 1's `spawn EINVAL` on Windows + Node 20.12.2+ (Bug 10). The fix is reverting `shell: false` → `shell: true` in `scripts/mode1-server.js`, with a code comment above the affected `runCmd` calls explaining why `shell: true` is intentional (DEP0190 doesn't apply — args are static, no injection vector). Tier B — Mode 1 server is tooling, not production code; but run `npm test` anyway to confirm. Skip preview (mechanical revert, no rendering changes). Include the working-tree files `docs/AI-PRIMER.md` and `docs/NEXT.md` in the same commit since they reflect v1.6.0 state. Show the diff before saving, pause for approval before commit, pause again before push, pause again before deploy."

---

## Why this skill exists in this exact shape

Hotfixes have a different rhythm than a planned release: faster turnaround, smaller scope, often discovered the same day the bug ships. Without a dedicated skill, a hotfix session re-derives the abbreviated version of `release-skill.md` from scratch — and inconsistencies slip in (version-bump skipped, CHANGELOG too long, deploy ladder shortened in unsafe ways).

This skill codifies the abbreviated shape so every hotfix lands the same way. It also documents the "Mode 1 is broken, ship manually" fallback — because Mode 1 will occasionally be the thing that's broken, and the workflow for that case shouldn't be improvised under pressure.

Mode 2 (when it ships) will not invoke this skill — Mode 2 is constrained to PATCH-tier changes per project rule #4, but those are scheduled maintenance ships, not reactive hotfixes. Reactive hotfixing is always a Code/Blake collaboration.
