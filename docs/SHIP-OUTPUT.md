<!-- author: Code | date: 2026-06-06 -->
# v1.8.4 — Gate 8b (final fix round ×3 — APPLIED ✓, the SWEEP is immediately next)

> All three close-out items landed + verified. **Quotes admin** got click-and-drag reorder (the ⋮⋮ grip, keeping ▲▼), a live-narrow **search**, and three quote-library extras I added under your latitude (duplicate detection, a door-length hint, an unsaved-row trace). The **deep-dive hint** is now a glowing **pill**. The **update-log widget** is redesigned: each dated update is its own bullet-group set off by a **tier-colored left rail**, and every marker carries an honest **tier label** derived token-first from the CHANGELOG semver — which works out to 7 "Minor Update" + 1 "Big Update" (the v1.7.4→v1.8.2 overhaul period); I did **not** fabricate variety the history doesn't have. **npm test 84/84 green, Chromium-probed, bump-version 47. No commit — the sweep is next.**

---

## 1. Quotes admin — drag + search + the latitude extras ✓
**Click-and-drag reorder** (`admin/quotes.{js,css,html}`): a ⋮⋮ grip per row using native HTML5 DnD on the section-editor's proven pattern — `draggable` is armed **only** between a grip `mousedown` and the next drag-end (and disarmed on a non-drag `mouseup`), so the textarea/source stay text-selectable the rest of the time; the dragged row dims (`.q-dragging`), reorder is live `insertBefore`, and `dragend` calls `markDirty()`. The **▲▼ buttons stay** (touch + keyboard fallback). No parallel model — the DOM is the source of truth, so `readRows()` picks up the new order at Save unchanged.

**Live search** (`#q-search`): visibility-only (`.q-hidden`, never removes rows) so a filtered Save **never loses hidden quotes**; a "No quotes match your search" note shows when a term hits nothing; and **reorder (▲▼ + drag) is blocked while filtered** (hidden neighbors would corrupt adjacency) — both the grip/▲▼ go `pointer-events:none` and the JS guards early-return. Adding a quote clears the search so the new row is never hidden.

**The three extras I added (your "more functionality" invite):**
- **Duplicate detection** — `#q-stats` now reads `N quotes · K duplicates` and the offending rows tint amber when two normalize to the same quote text (case/trailing-punct-insensitive). This is the characteristic error of an ID-less flat library — the door would surface the same line twice. The dupe pass is *separate* from the `N`-count (which still counts all rows for the `.q-empty` toggle + the Save confirmation).
- **Door-length hint** — a small per-row counter that stays muted, then turns amber past ~90 chars ("long for the door"), measuring the *saved* form. These quotes literally drift up a fixed-width door bubble, so "will it wrap?" is a real question you can't eyeball in the admin.
- **Unsaved-row trace** — an edited / reordered / dragged / added row gets a subtle purple bar (an **inset box-shadow**, no layout shift) so you can see *which* rows changed since the last Save; cleared on a successful Save.

All three are class-only and decorative — `readRows()` ignores them, so none touch what's persisted. ⚠️ The admin page is auth-gated (only you can reach it), so it's not in the deterministic suite — **please smoke the drag/search/extras**; I verified `node --check` clean, the recon+critic vetted the integration, and the `#q-search` input is confirmed in the served HTML.

## 2. The deep-dive hint → pill ✓
`script.js` + `style.css`: the `その先へ` hint now sits in a purple chip (`.mi-hint-pill`) with a soft glow so it catches the eye on its one showing. Unchanged: non-clickable, fades on first row-hover, once-per-visitor, reduced-motion-safe.

## 3. The update-log widget redesign ✓ (Chromium-probed)
The widget is **100% hand-authored static HTML** (no JS render path), so this is an `index.html` restructure + a `style.css` addition — the gate6-veil re-home spec and the `#changelog-version` setter are untouched. Each `.version-section` now wraps its head in a `.vs-head` grid (`[chips] TIER LABEL` on row 1, date on row 2 — the tier sits in its own grid cell, **not** as a 2nd `.version-chips` child, dodging the chip-stagger trap) and carries a `data-tier` driving a **tier-colored left rail**. The rail + the next group's marker *is* the per-update divider (Blake req #1) — no `<hr>`, no JS. The `.version-chip` / `.version-chip-range` / `.vc-arrow` vocabulary is untouched. Door-aware (`.welcome-changelog` tightens the rail + label for the 22vh cap) and reduced-motion-safe (a `@media` block — placed **after** the `.version-chip` rule so equal-specificity source order wins — kills the only animation, the inherited `version-chip-in`).

**The tier-label mapping (honest, token-first — fixes the design-critic's blocker):**
- Read the **canonical CHANGELOG H2 semver token** first (`## vX.Y.Z — PATCH|MINOR|MAJOR`), *then* refine within-band:
  - **PATCH** → "Hotfix" if the bold lead opens with `Hotfix:`, else "Patch".
  - **MINOR** → "Big Update" if it's a flagged overhaul (the word *Overhaul* in the lead **or** a ROADMAP `★`), else "Minor Update".
  - **MAJOR** → "Major Update" (wired with a gold rail; **dead until v1.9.0/v2.0.0** — no major has ever shipped).
  - **Folded/range sections** take the **max tier** in the range.
- **Result for the live widget:** `06/04 v1.7.4→v1.8.2` folds the v1.7.4 *Modal Architecture Overhaul* + v1.8.0 *Smoothness Overhaul* → **Big Update**; the other 7 dated groups → **Minor Update**. (The design's draft table mislabeled v1.6.7 "Patch" — it's **MINOR**, a real feature ship; deriving token-first gives "Minor Update". I deliberately did **not** manufacture hotfix/patch variety, because that would over/under-claim — the honest truth is this project is mostly minor feature ships with one big overhaul period.)
- ⚠️ **Cowork flag:** `docs/SKILLS/widget-update-skill.md` (a Cowork-managed exclude — I don't edit it) should gain the new `.vs-head` + `data-tier`/`.vs-tier` authoring template + this tier rule, so future ships author the new shape. The `★` "big" signal lives only in ROADMAP, not CHANGELOG — note that in the skill, or port `★` into the CHANGELOG H2.

---

## Δ per file
- **`admin/quotes.js`** — rewritten with the grip-drag block (+ disarm-on-mouseup), `applyFilter` (visibility-only + no-matches + block-reorder-while-filtered), `updateStats` dupe pass + per-row `refreshLen`, `touch()`/clear-on-save, `normQuote` (#1).
- **`admin/quotes.css`** — `.q-grip` / `.q-row.q-dragging` / `.q-hidden` / `.is-filtered` disable, `.q-row-foot` + `.q-len`/`.q-len--over`, `.q-dupe`, `.q-row--touched` (inset shadow), `.q-search`, `.q-no-matches` (#1). **`admin/quotes.html`** — the `#q-search` input in the toolbar (#1).
- **`script.js`** — the hint markup wrapped in `.mi-hint-pill` (#2). **`style.css`** — `.mi-hint-pill` (#2); the `.vs-head` grid + `.vs-tier` + the `data-tier` rail + door overrides + the correctly-placed reduced-motion block (#3).
- **`index.html`** — all 8 `.version-section` heads wrapped in `.vs-head` with `data-tier` + a tier label (#3).
- *(No version-string, bump-target, firebase.json, or test-file change this gate — `npm test` stays 84.)*

## Verification (all green)
- `node --check` clean on `quotes.js` + `script.js`; CSS braces balanced (`style.css` 1371/1371, `quotes.css` 106/106); **no smart-quotes** in the new `index.html`/`quotes` attributes (Grep tool).
- **`id="changelog-version"` is still a singleton** (load-bearing per script.js:38 + the CLAUDE.md fallback rule); 8 `data-tier` + 8 `.vs-tier` present.
- **`npm test` 84/84 green, 0 skipped** (the gate6-veil re-home + welcome specs exercise the redesigned widget; nothing regressed).
- **Chromium probe PASS** — the door shows the re-homed log with 8 tier labels (`Minor ×7 + Big ×1`), the Big group's bright-lilac rail, the 2px rail applied, `changelog-version`=`v1.8.3` (×1), 0 console errors; and `#q-search` is in the served quotes HTML.
- **`bump-version --check` → "all 47 strings agree on 1.8.3"** (unchanged — the bump is a sweep step). HEAD still `d318334`.

## Blake's quick smoke
1. **Quotes admin** (sign in → Admin ▸ Quotes; run `npm run mode1` to Save): **drag** a quote by the ⋮⋮ grip to reorder (▲▼ still work); **search** to filter (reorder greys out while filtered; a "no matches" note appears); type a duplicate of an existing quote → the count shows `· 1 duplicate` and both rows tint amber; type a very long quote → the corner counter turns amber; edit/drag a row → it gets a purple unsaved bar that clears on Save. (Text selection inside the quote/source fields still works normally.)
2. **Deep-dive hint** (if you haven't already triggered it this browser): open an anime → the More-Info hint now reads as a glowing purple **pill**.
3. **Update log** (the welcome door, first visit of a session): each dated update now has a **colored left rail** + a **tier label** — one **Big Update** (the 06/04 overhaul period), the rest **Minor Update**; the version chips + `→` range chips are unchanged.

## Sweep-readiness
**Targets still 47, all on 1.8.3** (no bump yet — sweep step). HEAD `d318334`; v1.8.4 is BUILD-COMPLETE (G1→G8b) and **entirely uncommitted** — modified `index.html · script.js · style.css` (+ the rest of the ship) and untracked `admin/quotes.{html,css,js} · scripts/lib/quotes-store.js · quotes.json · tests/quotes.spec.js`. `npm test` floor **84**. **Next: THE SWEEP** (docs cascade — incl. flagging `widget-update-skill.md` for Cowork — → bump ×47 → audits → ONE Blake-authored zero-trailer commit, 7 Cowork excludes restore-staged out → preview → prod on your explicit "ship it").

## One-liner reply
v1.8.4 **Gate 8b (final fix round) is APPLIED, 84/84 green, Chromium-probed** — the **Quotes admin** gained **click-and-drag reorder** (a ⋮⋮ grip on the section-editor's proven native-DnD pattern, `draggable` armed only between grip-mousedown and drag-end so the fields stay text-selectable, ▲▼ kept) and a **live search** (visibility-only so a filtered Save never drops hidden quotes, a "no matches" note, reorder blocked while filtered), plus three quote-library extras I added under your latitude — **duplicate detection** (`N quotes · K duplicates` + amber-tinted twins), a **door-length hint** (amber past ~90 chars, since the quotes drift up a fixed-width bubble), and an **unsaved-row trace** (a purple inset bar, no layout shift, cleared on Save) — all class-only so `readRows()` still saves the full list; the **deep-dive hint is now a glowing purple pill**; and the **update-log widget is redesigned** into per-update bullet-groups set off by a **tier-colored left rail** with an honest **tier label** per marker derived **token-first** from the CHANGELOG semver (PATCH→Hotfix/Patch, MINOR→Big-if-overhaul-else-Minor, MAJOR→Major, max-tier across folded ranges), which works out to **1 Big Update** (the v1.7.4→v1.8.2 overhaul period) + **7 Minor Update** — I deliberately did not fabricate hotfix/patch variety the history lacks, and I fixed the design draft's v1.6.7→"Patch" misread (it's MINOR, a feature ship); the redesign keeps the version-chip/range-chip vocabulary, the `#changelog-version` singleton, and the gate6-veil re-home selector untouched, fits the door's 22vh cap, and is reduced-motion-safe (the reduced-motion block placed after `.version-chip` so it wins the cascade); **bump-version stays 47 on 1.8.3** (the bump is a sweep step) and nothing's committed — ⚠️ `docs/SKILLS/widget-update-skill.md` (a Cowork-managed exclude) should get the new `.vs-head`+tier authoring template; **the SWEEP is immediately next** (docs cascade + bump ×47 + audits + ONE Blake-authored zero-trailer commit + preview → prod on your explicit "ship it").
