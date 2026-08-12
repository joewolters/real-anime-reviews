<!-- author: Code | date: 2026-05-11 -->
<!-- author: Cowork | date: 2026-06-03 — v1.7.3: removed the 10-bullet cap rule. Widget container already scrolls (max-height: 300px); show every ship since accurate logging began (v1.6.1, 2026-05-10). -->
# Skill: Update the website's CHANGELOG widget on every ship

> **Purpose:** ensure visitors to realanimereviews.com see the changelog widget update on every ship — not just feature ships. This is the operational arm of project rule #6 ("Every code-and-data change updates the website's CHANGELOG widget").
>
> **Who should follow this:** Code, Mode 1, Mode 2, Cowork — every AI system that ships a version. Blake himself if shipping manually.
>
> **When this skill runs:** as a sub-step of both `release-skill.md` (after the CHANGELOG entry, before the diff review) and `hotfix-skill.md` (same place). Mode 1's pipeline already handles widget updates for new-anime ships at step 5 of 9 — that path is exempt because the bullet is curated automatically from the new entry.

---

## The rule

Every ship updates two things on the website's homepage CHANGELOG widget:

1. **The version line** — `<span id="changelog-version">vX.Y.Z</span>` in `index.html` and `account.html`. Bumped automatically by `scripts/bump-version.js` (it's one of 18 targets as of v1.6.11 — was 14 in v1.6.4 era; grew when `suggest.html` was added). No manual action required as long as the bump script runs.

2. **The bullet list** — a list of bullets grouped under MM/DD/YYYY date headers (one section per ship date). **No cap** as of v1.7.3 — every ship since accurate logging began (v1.6.1, 2026-05-10) stays in the widget. The container scrolls (`max-height: 300px`) so the list can grow indefinitely without pushing the homepage down. This requires curation per ship per the decision tree below. **Curation never gets skipped — even for tooling/hotfix ships.** If there's nothing user-facing to say, the bullet is generic ("Behind-the-scenes improvements") but it still exists.

3. **The date header** — every ship's bullets land under an `MM/DD/YYYY` date header inside `<div class="version-section">`. Today's bullets prepend to today's section if one already exists; otherwise create a new section above the previous most-recent one. The widget body is internally scrollable (`max-height: 300px`); long ship histories don't push the rest of the homepage down.

<!-- author: Cowork | date: 2026-06-06 — v1.8.4 G8b: the tier-label authoring shape (Blake's update-log redesign) -->
<!-- author: Code | date: 2026-06-11 — gate 20.6 (Blake item 7): "Big Update" renamed "Major Update" on Blake's word; the gold semver-MAJOR tier takes "Milestone Update" so the two labels can't collide -->
4. **The tier label + rail (v1.8.4+ widget shape).** Every `.version-section` now carries `data-tier="hotfix|patch|minor|big|major"` (drives the tier-colored left rail) and its head is a `.vs-head` grid: row 1 = the `.version-chips` cell + a `.vs-tier` label cell (the tier label is its OWN grid cell — never a second child inside `.version-chips`, that breaks the chip stagger), row 2 = the date. **Tier derivation is token-first and honest:** read the CHANGELOG H2 semver token (`## vX.Y.Z — PATCH|MINOR|MAJOR`), then refine within band — PATCH → "Hotfix" if the bold lead opens with `Hotfix:`, else "Patch"; MINOR → "Major Update" if the lead says *Overhaul* (or the ROADMAP row carries `★` — that signal lives in ROADMAP, not CHANGELOG), else "Minor Update" (label renamed from "Big Update" at gate 20.6 on Blake's word; the `data-tier="big"` attribute is unchanged — it keys the purple rail); MAJOR → "Milestone Update" (gold rail; unused until a real MAJOR ships). Folded/range sections take the **max tier** in the range. **Never fabricate tier variety the history doesn't have.**

---

## Bullet curation by ship type

**Granularity rule:** one bullet per change made in the ship. A multi-piece ship (e.g. fix + skill update + new doc + widget refactor) gets multiple bullets — one per piece, all stamped with the same date and grouped under the same date header. **No consolidation across ships:** each ship's bullets are written for that ship's date section. **No backfill consolidation either:** if a past ship reached production without bullets, that's a bug to surface in this ship's CHANGELOG, not a pattern to perpetuate by lumping the missed ships together.

| Ship type | Tier | What to do |
|---|---|---|
| User-facing feature | A | One bullet per visitor-visible change. Multi-piece features get multiple bullets, one per piece. |
| Content update (new anime, typo fix, image swap) | A | One bullet per meaningful change. |
| Hotfix to user-visible code | A | One bullet per fix. "Fixed a bug where..." / "Improved..." |
| Tooling / docs / infrastructure | B | One generic bullet per change. Do **not** expose internal terms (Mode 1, smoke check, spawn EINVAL, Tier B, etc.) and do **not** name the version in the bullet. Phrasing like "Made some behind-the-scenes improvements" works for changes visitors won't notice. |
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

**Good multi-piece ship** (per-change granularity — one ship, multiple bullets, all stamped with the same date):
- "Added shipped-on dates to the update log."
- "Made the update log show 10 entries instead of 5."
- "Reorganized the update log so changes group by date."

*(Three bullets, all under the same `MM/DD/YYYY` section header. Each stands alone for a first-time visitor; none names the version.)*

---

## Where the bullets live in code

`Current Version/index.html` — search for `id="changelog-version"` or the existing `<div class="version-section">` blocks inside the widget. Note: `account.html` does NOT host the widget despite earlier versions of this skill saying it did; only `index.html` needs bullet curation. The bump-version script bumps the `APP_VERSION` and stylesheet cache-busts in both files, but the widget itself is index-only.

Actual widget structure (v1.6.4 onward):

```html
<div class="changelog-box">
  <div class="changelog-title">
    <span class="changelog-tag" id="changelog-version">vX.Y.Z</span>
    Minor Update
  </div>
  <div class="changelog-content">
    <div class="version-section">
      <div class="version-chips"><span class="version-chip">vX.Y.Z</span></div>
      <div class="version-header">MM/DD/YYYY</div>
      <ul class="changelog-list">
        <li>Newest bullet here</li>
      </ul>
    </div>
    <div class="version-section">
      <div class="version-chips"><span class="version-chip version-chip-range">vA.B.C<span class="vc-arrow" aria-hidden="true">→</span>vX.Y.Z</span></div>
      <div class="version-header">MM/DD/YYYY</div>
      <ul class="changelog-list">
        <li>Bullets from a previous ship date</li>
      </ul>
    </div>
  </div>
</div>
```

When adding a new bullet:

1. **Check today's date header.** If a `.version-section` for today's `MM/DD/YYYY` already exists at the top, prepend the new `<li>` to its `<ul>`. Multi-piece ships add multiple `<li>` elements under the same date header.
2. **Otherwise, create a new section** above the previous most-recent one — a new `<div class="version-section">` with today's date header and the new bullet(s) inside.
3. **No cap on bullet count** (v1.7.3+). Never drop sections. The `.changelog-content` container scrolls (`max-height: 300px`) — every ship since v1.6.1 (2026-05-10) stays visible. Adding a new section above the previous most-recent never displaces older ones.
4. **Date format is always `MM/DD/YYYY` with the year shown** — even for current-year ships. No `May 11`, `5/11`, or `2026-05-11` shorthand. The format is canonical so the widget doesn't drift.
5. **Version chips above each date header** (v1.7.1+). Every `.version-section` carries a `<div class="version-chips">` *above* its `.version-header` listing which version(s) shipped that date (from CHANGELOG.md):
   - **1-2 ships on a date** → one `<span class="version-chip">` per version, stacked newest-first (the `.version-chips` flex column handles layout).
   - **3+ ships on a date** → a single range chip: `<span class="version-chip version-chip-range">v<earliest><span class="vc-arrow" aria-hidden="true">→</span>v<latest></span>` (one line, NOT stacked).
   - When you add today's bullet under a new/existing section, set/update that section's chip accordingly. The chip reflects ship **versions**, the header reflects the ship **date**.

---

## Why this skill exists

Project rule #6 says the widget stays in sync with `CHANGELOG.md`. In practice, hotfix and tooling ships have historically updated only the version number, leaving bullets static. Blake's intent (codified 2026-05-11) is for visitors to see the widget *change* on every ship — even tooling ones — as a sign of life. This skill operationalizes that intent.

The trade-off was previously: a rolling 5-bullet widget meant tooling-ship bullets pushed out previous user-facing bullets. Mitigation was the "generic phrasing for tooling ships" rule. As of v1.6.4 the cap was raised to 10 with date-grouped sections and an internally scrollable widget body. **As of v1.7.3 (2026-06-03) the cap is removed entirely** — the container already scrolls, so visitors can scroll back through every ship since accurate logging began (v1.6.1). The "generic phrasing for tooling" rule still applies — it keeps the widget readable for first-time visitors regardless of list length.
