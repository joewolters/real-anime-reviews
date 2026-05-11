<!-- author: Code | date: 2026-05-11 -->
# Skill: Update the website's CHANGELOG widget on every ship

> **Purpose:** ensure visitors to realanimereviews.com see the changelog widget update on every ship — not just feature ships. This is the operational arm of project rule #6 ("Every code-and-data change updates the website's CHANGELOG widget").
>
> **Who should follow this:** Code, Mode 1, Mode 2, Cowork — every AI system that ships a version. Blake himself if shipping manually.
>
> **When this skill runs:** as a sub-step of both `release-skill.md` (after the CHANGELOG entry, before the diff review) and `hotfix-skill.md` (same place). Mode 1's pipeline already handles widget updates for new-anime ships at step 5 of 9 — that path is exempt because the bullet is curated automatically from the new entry.

---

## The rule

Every ship updates two things on the website's homepage CHANGELOG widget:

1. **The version line** — `<span id="changelog-version">vX.Y.Z</span>` in `index.html` and `account.html`. Bumped automatically by `scripts/bump-version.js` (it's one of the 14 targets). No manual action required as long as the bump script runs.

2. **The bullet list** — typically a rolling list of ~5 most-recent bullets in the widget; oldest drops off when new ones are prepended. This requires curation per ship per the decision tree below. **Curation never gets skipped — even for tooling/hotfix ships.** If there's nothing user-facing to say, the bullet is generic ("Behind-the-scenes improvements") but it still exists.

---

## Bullet curation by ship type

| Ship type | Tier | What to do |
|---|---|---|
| User-facing feature | A | Curate 1–3 visitor-friendly bullets describing what visitors will see. |
| Content update (new anime, typo fix, image swap) | A | One bullet per meaningful change. |
| Hotfix to user-visible code | A | One bullet — "Fixed a bug where..." or "Improved..." |
| Tooling / docs / infrastructure | B | One generic bullet — e.g. "Behind-the-scenes improvements (v1.6.2)." Do **not** expose internal terms (Mode 1, smoke check, spawn EINVAL, Tier B, etc.). |
| Metadata only (repo visibility, owner rename) | C | Version line bumps via script; bullet curation skipped is acceptable. Note in the CHANGELOG entry that the widget bullets were intentionally not touched. |

---

## Voice guidelines for widget bullets

**The reader you're writing for: a first-time visitor.** Someone who just landed on the site, has never been here before, doesn't know Blake, doesn't know the project history, doesn't know what shipped last week. Each bullet has to make sense to that person on its own. If a bullet only makes sense to someone who already knows the site's internals, the bullet is wrong.

Concrete rules that follow from this:

- **Don't name past versions or past bugs.** "v1.6.0," "Bug 10," "last week's update," "the issue from yesterday" — all out. Each bullet stands on its own with no version history required.
- **Don't reference internal tooling or terms.** "Mode 1 server," "smoke check," "spawn EINVAL," "Tier B," "Phase D," "DEP0190," "AniList API," "sync script," "Excel master" — all internal to how the site is built. Translate or omit.
- **Don't say "we" or refer to the dev process.** "We added," "we fixed," "we shipped" — visitor doesn't know who "we" is. Use neutral past tense: "Added a search bar," "Fixed a bug."
- **Assume the visitor sees the site.** "The Top 10 list," "the search bar," "anime cards," "the homepage" — fine, they're looking at the site. But "the admin form," "the sync pipeline," "the deploy step" — not fine, those aren't visible.
- **Past tense.** "Added a search bar" not "Adds a search bar."
- **Specific over generic when you can.** "Made the homepage load faster" beats "Performance improvements."
- **Don't overstate.** A 5-minute polish ship doesn't need bullet drama.
- **Match the existing widget voice.** Look at the current bullets in `index.html` before writing new ones. Match their cadence and word choices.

## Good vs bad bullet examples

**Good** (a first-time visitor understands each one):
- "Added 3 new anime to the catalog."
- "Fixed a bug where the search bar wouldn't clear properly."
- "Made some behind-the-scenes improvements. Nothing visible changes."
- "Reorganized the Top 10 list."
- "Improved the page that loads when you type the wrong address."

**Bad** (require Blake-context to make sense):
- "Bug 10 prevention: smoke check + DECISIONS lesson." *(internal jargon AND version-history dependent)*
- "Mode 1 server now smoke-checks `runCmd` at startup." *(internal jargon)*
- "Improved performance." *(too generic — performance of what?)*
- "Bump to v1.6.2 — prevention follow-up." *(release-note voice, references prior version)*
- "Spawn EINVAL hotfix." *(complete jargon)*
- "Made the site's developer tools more reliable across v1.6.1 and v1.6.2." *(visitor doesn't know what v1.6.1 was)*

---

## Where the bullets live in code

`Current Version/index.html` — search for `id="changelog-version"` or the existing bullet `<li>` elements inside the widget. Note: `account.html` does NOT host the widget despite earlier versions of this skill saying it did; only `index.html` needs bullet curation. The bump-version script bumps the `APP_VERSION` and stylesheet cache-busts in both files, but the widget itself is index-only.

Typical widget structure:

```html
<div class="changelog-widget">
  <h3>Update Log <span id="changelog-version">v1.6.2</span></h3>
  <ul id="changelog-bullets">
    <li>Newest bullet here</li>
    <li>...</li>
    <li>Oldest visible bullet</li>
  </ul>
</div>
```

When adding a new bullet, **prepend** (new bullets go at the top). When the list exceeds 5 items, drop the oldest.

---

## Backfill for past ships missing widget bullets

If a ship reached production without curating widget bullets (e.g., v1.6.1 hotfix and v1.6.2 prevention both bumped the version number without curating bullets), backfill on the **next** widget update — don't ship a standalone "fix the widget" PATCH. The backfill should be a single combined generic bullet rather than one per missed version, to avoid burying user-relevant news. **Crucially, the backfill bullet still follows the first-time-visitor voice rule — don't reference the missed versions by name.**

Example backfill bullet covering multiple missed tooling ships: "Made some behind-the-scenes improvements to how the site is built. Nothing visible changes." (Visitor reads this and understands it without needing to know which versions are being backfilled.)

---

## Why this skill exists

Project rule #6 says the widget stays in sync with `CHANGELOG.md`. In practice, hotfix and tooling ships have historically updated only the version number, leaving bullets static. Blake's intent (codified 2026-05-11) is for visitors to see the widget *change* on every ship — even tooling ones — as a sign of life. This skill operationalizes that intent.

The trade-off: a rolling 5-bullet widget means tooling-ship bullets push out previous user-facing bullets. Mitigation is the "generic phrasing for tooling ships" rule above — so tooling bullets feel alive without burying the more interesting user-facing news under tooling noise.
