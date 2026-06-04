<!-- author: Code | date: 2026-06-04 -->
# v1.7.5 — Gate 3e (secondary-modal WHERE TO WATCH section — APPLY ✓)

> Added a **WHERE TO WATCH** section to the secondary modal — every official streaming platform for the viewed anime (`detail.externalLinks` type `STREAMING`, deduped by site, **alphabetical, equal-weight pills** per the 3c parity rule), each linking to the platform's series page. Placed it **at the top of the side column** (first thing in the sidebar — actionable, high-value). To avoid in-modal duplication I also **dropped STREAMING from the existing LINKS section** (LINKS now keeps AniList + Official Site + YouTube). Empty state: section **omitted** when there are no streaming links (premium-clean; LINKS still carries AniList). Verified green: `node --check` OK, CSS 1001/1001, live-canary render correct (101922 → Crunchyroll, Hulu, Netflix), **`npm test` 8 passed**. Likely the last build item — see the flag at the end. Not committed/deployed.

---

## What I built + where + why

### `renderSecondaryPlatforms(externalLinks)` (`script.js`, before `renderSecondaryModal`)
- Filters `externalLinks` to `type === 'STREAMING'`, dedupes by lowercased `site`, sorts **A→Z**, renders one `.secondary-platform` pill per platform (`↗ {site}`) linking to the series page. **Returns `''` when no streaming links** → the section is omitted entirely.
- Reuses the exact dedupe/sort discipline from the gate-3b/3c episode pills, so the two surfaces stay consistent.
- **Δ** `script.js` +22.

### Placement — top of the side column
- Body assembly side column is now `whereToWatchHtml + charsHtml + staffHtml + linksHtml`. WHERE TO WATCH leads because it's the most actionable thing a visitor deciding whether to watch wants, and it's concise (a pill row) so it doesn't push the character grid far down. (Considered the main column after synopsis, but the side column gives it standalone prominence without competing with the review/synopsis reading flow.)
- **Δ** `script.js` +2 (var + slot).

### LINKS de-duplication (small adjacent polish)
- The existing LINKS section was a grab-bag (AniList + Official Site + streaming, capped at 6). With streaming now in its own section, LINKS would have shown the same platforms twice. Changed the LINKS filter to **skip `type === 'STREAMING'`** and keep `Official Site` + `YouTube` (info/social) alongside AniList. Clean separation, no in-modal dupe.
- **Δ** `script.js` ~+3/−3. *(In scope as the natural consequence of adding the section; flagged here so it's not a silent behavior change.)*

### CSS — equal-weight pills (`style.css`)
- `.secondary-platform-list` (flex-wrap) + `.secondary-platform` pill: brand-purple, blurred-glass vocabulary consistent with the modal, hover-lift, **one uniform style for every platform** (gate-3c parity — no privileged platform). Reduced-motion guard on the hover transform. **Δ** `style.css` +33.

## Consistency notes (per the gate)
- The **main modal** Platforms row renders Excel-sourced plain-text pills (the gate-3d backfill data); the **secondary** WHERE TO WATCH is **AniList-sourced** and may differ for non-catalog entries — expected, no reconciliation this ship (the gate confirmed this).
- `[hidden]` symmetry: the section isn't toggleable (it's static markup, present-or-omitted), so no `[hidden]` rule needed. No data-provider names in copy — platform names appear only as link destinations.

## Verification (green)
| Check | Result |
|---|---|
| `node --check script.js` | **SCRIPT_OK** |
| CSS brace balance | **1001 / 1001 BALANCED** |
| Live canary `renderSecondaryPlatforms` (101922) | **Crunchyroll, Hulu, Netflix** (STREAMING-only, deduped, A→Z; socials/official-site excluded) |
| `npm test` (Playwright) | **8 passed (13.7s)** |

## Flag before the docs cascade
- **Build scope for v1.7.5 looks complete** across gates 1–3e: secondary-modal save pills + non-catalog schema (1), account rendering + `#secondary=` route (2), per-episode expand + `__bold__` + green ✓ catalog rows (3), sign-in-modal-on-save + multi-platform episode links + the z-index fix (3b), equal-weight pills + platforms backfill DRY-RUN (3c), backfill LIVE write (3d), and this WHERE TO WATCH section (3e).
- **One thing to confirm at the docs cascade:** `bump-version.js` should stay **33 targets** — nothing this ship added a new versioned HTML page (the WHERE TO WATCH section, save pills, account changes all live in existing pages; `backfill-platforms.js` is a CLI). I'll re-verify `--check` says "33 agree" at gate 4.
- No other loose ends; the per-episode "full course" + structured-review-template are already logged in NEXT.md for later.

## Phantom-drift audit
Verified, not assumed: the existing LINKS section already mixed streaming in (read it before deciding to dedupe, didn't assume); `externalLinks` STREAMING filter output is correct (live 101922 render, not guessed); section omits cleanly when empty (early `return ''`); pills are equal-weight (one class, alphabetical — re-checked against the 3c rule); tests ran (8 passed).

## One-liner reply
v1.7.5 **Gate 3e (secondary-modal WHERE TO WATCH section) DONE — APPLY, verified, not committed/deployed**: added a dedicated WHERE TO WATCH section to the secondary "deep dive" modal showing every official streaming platform for the viewed anime (from `detail.externalLinks` type STREAMING, deduped by site, **alphabetical equal-weight brand-purple pills** per the gate-3c parity rule, each linking to the platform's series page), placed at the **top of the side column** for actionable prominence; to avoid showing the same platforms twice I also **dropped STREAMING from the existing LINKS section** (now AniList + Official Site + YouTube only) and **omit the WHERE TO WATCH section entirely when there are no streaming links** (premium-clean, your latitude); verified green — `node --check`, CSS 1001/1001, a live 101922 canary render (Crunchyroll, Hulu, Netflix — socials/official-site correctly excluded), and **`npm test` 8 passed**; this should be the **last build item** for v1.7.5 (gates 1–3e all done), so next is your gate-4 browser look + the **docs cascade** (CHANGELOG + update-log widget + `bump-version` → 1.7.5, which should stay 33 targets since no new versioned page was added + ROADMAP/NEXT).
