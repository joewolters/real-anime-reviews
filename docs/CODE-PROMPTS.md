<!-- author: Code | date: 2026-05-09 -->
# Code Prompts Cheatsheet

> **What this is:** copy-paste prompts for common Code (the CLI tool) tasks on this project. Each prompt bakes in the project rules (show-don't-do, surgical edits, version-bump checklist, etc.) so you don't have to re-state the discipline every session.
>
> **How to use:** find the task that matches what you want to do, copy the whole prompt, paste into Code, replace the `<ALL_CAPS_PLACEHOLDERS>` with your actual values, hit send.
>
> **When NONE of these fit:** that's a sign the task is novel enough to benefit from a planning conversation first. Open a chat with Claude (not Code), describe what you want, ask for a custom prompt, then bring that prompt to Code.

---

## 1 · Add a new anime to the site

> Use when: you've watched something, written notes, picked a poster image, and want it live on the site.

```
I want to add a new anime to the site. Details:

- Title: <EXACT_TITLE>
- Rating: <like "9/10">
- My review (1 paragraph): <my_actual_review>
- Top10Rank (only if it's a Top 10 entry): <number_1_to_10>
- Image: <"use AniList default"  OR  "I've dropped <FILENAME>.png into Current Version/assets/">

For everything else (genre, seasons, studio, platforms, tags, trailer, description) — fetch from AniList.

Plan in detail before writing any code:
1. Run scripts/anilist-fetch.js for "<EXACT_TITLE>" and show me what AniList returned
2. Show me the proposed new entry as it'll appear in animeData.js, including which fields came from AniList vs my input
3. If I said "use AniList default" for image: download the AniList cover URL into assets/ as <slug-of-title>.png and reference that filename
4. If I provided my own filename: use mine, ignore AniList's image URL
5. Show me where you'll insert the entry (end of the array unless I'm replacing the Featured Drop)
6. Show me the version bump plan (this is a PATCH — pick the right number)
7. Show me the planned CHANGELOG entry with the proper <!-- author: Code | date: --> marker
8. Pause for my approval before writing ANY file
9. After approval: update animeData.js, run scripts/bump-version.js, update CHANGELOG.md, run npm test
10. Pause again with the diff before staging/committing
11. Don't deploy to production without explicit go-signal — preview channel only first

Also: I have NOT yet added this to the Excel master (Anime_Master_Table.xlsx). Remind me to do that as a todo at the end.
```

---

## 2 · Fix a specific audit item

> Use when: you want to close one finding from `AUDIT_2026-04-30.md`. One fix, one commit, one PATCH.

```
I want to fix audit item §<X.Y> from AUDIT_2026-04-30.md. Plan:

1. Read the audit description for §<X.Y> and confirm what needs to change
2. Read the relevant source file(s) to confirm the current state matches the audit description
3. Show me the proposed fix as a diff before writing
4. Pause for my approval
5. After approval: apply the fix, run npm test
6. Show me the test results
7. Show me the planned CHANGELOG entry with <!-- author: Code | date: --> marker, version bumped as PATCH
8. Pause for approval before commit
9. After commit: deploy to a preview channel ONLY, give me the URL to verify before any prod deploy

If npm test fails, surface the failure — do NOT auto-fix. We'll decide together whether the test or the code is wrong.
```

---

## 3 · Investigate a bug (read-only, no fix yet)

> Use when: something looks wrong on the site and you want to understand it before fixing.

```
Read-only investigation. DO NOT change anything. Symptom:

<DESCRIBE_WHAT_YOU_SEE>

Steps:
1. Reproduce mentally from the symptom — which file/component is most likely involved?
2. Read the relevant source files (script.js sections, account.js, the right HTML, etc.)
3. Form a hypothesis about the root cause
4. Verify the hypothesis by reading more code OR by checking the live site console (chrome dev tools network/console)
5. Write a 1-paragraph summary: what's broken, where it lives in the code, why it's happening, what a fix would look like (without applying the fix)

Output: just the summary. No code changes, no commits. After I read it I'll decide whether to fix it now or add it to a future PATCH bundle.
```

---

## 4 · Ship a PATCH bundle (3-5 small audit items)

> Use when: there's downtime between bigger phases and you want to close out 3-5 small audit findings as one PATCH.

```
Bundle PATCH. Items to include:
- §<X.Y> — <one_line_description>
- §<X.Y> — <one_line_description>
- §<X.Y> — <one_line_description>

Plan:
1. For each item, read the audit and the relevant source — confirm scope
2. Show me a per-item diff plan BEFORE any writes (5 minutes of planning saves 30 minutes of unwinding)
3. Pause for approval on the whole plan
4. After approval: apply all fixes, run npm test ONCE at the end
5. If tests pass: bump version (PATCH), write a single CHANGELOG entry covering all <N> items, mark with <!-- author: Code | date: --> 
6. Pause with the diff for staging
7. After commit: preview deploy, give me the URL
8. Don't deploy to prod without my go-signal

If any single fix gets messy, STOP that one specifically and ship the rest — don't bundle a half-broken fix.
```

---

## 5 · Update docs only (no code touched)

> Use when: tweaking README/CHANGELOG/ROADMAP/CLAUDE.md without touching production code.

```
Docs-only change. Project rule #7 exempts this from npm test.

Goal: <DESCRIBE_THE_DOCS_CHANGE>

Plan:
1. Read the file(s) being changed
2. Show me the proposed diff before writing
3. Pause for approval
4. Write the change
5. Show me the resulting diff with `git diff <file>` to verify
6. Bump version is OPTIONAL for docs-only changes — only bump if the change should be visible to site visitors (e.g., changelog widget) or marks a meaningful documentation milestone
7. Stage + commit with a clear message starting with "Docs:" so it's obvious in git log
8. NO deploy needed (docs-only doesn't change the deployed site)

Mark the CHANGELOG entry (if added) with <!-- author: Code | date: --> as always.
```

---

## 6 · Verify everything still works

> Use when: you want a sanity check that nothing is broken — useful after a long session or before a deploy.

```
Verify-only pass. No code changes.

1. From Current Version/, run `npm test` and report the result
2. Run `node scripts/bump-version.js --check` and confirm all 7 version strings agree
3. Run `git status` and report whether the working tree is clean
4. Open the live site (https://realanimereviews.com) — load the homepage, click one anime card to confirm the modal opens, close it
5. Check the console for errors during that flow

Output: a short pass/fail report. If anything fails, describe the failure but don't fix it — I'll decide.
```

---

## 7 · Set up a clean preview channel deploy

> Use when: you've committed changes and want to verify them on a preview URL before deciding to ship to prod.

```
Preview channel deploy. The commit is already made (verify with git log).

Plan:
1. From Current Version/, run `firebase use` and confirm the project is "real-anime-reviews"
2. Run `firebase login:list` and confirm the active account matches the one in PERSONAL.md
3. Run `firebase hosting:channel:deploy <CHANNEL_NAME>` (e.g., "preview-<short-description>")
4. Print the preview URL the command returns
5. PAUSE — wait for me to open the preview URL and confirm it looks right
6. After my go-signal: run `firebase deploy --only hosting` for production
7. Verify production: open https://realanimereviews.com in incognito + hard refresh, confirm the change is visible

If step 1, 2, or 3 fails, report the error. Don't try alternative auth methods or commands without asking.
```

---

## 8 · Audit-first cleanup ("clean up the site")

> Use when: you want a categorized report of what's wrong with the site, BEFORE deciding what to fix.

```
Step 3.5-style audit. Read-only. DO NOT change anything.

Read through index.html, account.html, 404.html, script.js, account.js, firebase.js, animeData.js, style.css, mobile.css, plus the live site at https://realanimereviews.com.

Produce a report organized by category and severity. Categories:
1. Functional bugs (things that don't work right)
2. Visual/UX issues (mobile layout, alignment, broken images)
3. Performance (file sizes, slow loads, unoptimized assets)
4. Accessibility (alt text, keyboard nav, screen readers)
5. Code quality (unused functions, naming, redundant logic)

For each item: severity (HIGH/MEDIUM/LOW), file + line if applicable, brief description, suggested fix.

DO NOT fix anything. Output the report as a markdown document at AUDIT_<YYYY-MM-DD>.md.

After I read the report I'll decide what to fix in scoped batches. Never bundle audit fixes into one giant commit — each fix is its own diff with its own commit message.
```

---

## When to ask Claude (chat) instead of Code (CLI)

Code is a precision tool — best for executing well-defined work. Use a Claude chat session instead when:
- You don't yet know what you want to build (planning, design, brainstorm)
- You want to discuss tradeoffs before committing to a direction
- You want a custom prompt for Code that doesn't match a template here
- You're tired and want a friendly "what's next?" conversation
- You want to investigate something across multiple sessions of context

The pattern: **Claude chat = think; Code = execute.** Don't fight Code with vague prompts — bring vagueness to chat, bring clarity to Code.
