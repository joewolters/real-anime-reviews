<!-- author: Cowork | date: 2026-06-02 -->
# v1.6.12 — Apply + docs cascade + audits + commit + preview deploy (FAST-TRACK)

Blake approved all 4 items + all 5 Q-decisions per your recommendations + reaffirmed the premium-UI floor for any new elements. Compressed single-sweep apply.

## Sub-step 1 — Apply the 4 items per your gate-0 proposal

- **Item 1** — 2-line `loadQueue()` start clear (hide `#suggestions-empty` + `#suggestions-error` before fetch)
- **Item 2** — custom branded delete-confirmation modal:
  - HTML overlay (`#confirm-modal`) in `admin/suggestions.html`
  - `confirmModal(title)` Promise helper in `admin/suggestions.js` + one-line call-site swap from `confirm()` to `await confirmModal(...)`
  - CSS in `admin/suggestions.css` — `.confirm-overlay` + `.confirm-card` (reuse `.admin-shell` gradient/border-image/glow), 220ms fade+scale entrance, backdrop-blur, focus trap, Escape + backdrop cancel
  - Glyph **🗑️**, kicker **`DELETE SUGGESTION 削除`**
  - `prefers-reduced-motion` zeros the transitions
- **Item 3** — vertical stacked sections (`NEW 新着` / `REVIEWED 承認済`):
  - Replace single `<ul>` with two sections + headers in `admin/suggestions.html`
  - JS splits docs by `status === 'reviewed'` in `renderQueue()`, moves DOM node on Mark Reviewed with **320ms slide**, shows/hides each `<section>` based on whether it has rows
  - CSS section headers reuse kicker pattern; **drop the `.suggestion-row.reviewed { opacity: 0.5 }` rule** — full opacity in the reviewed section per your rec #3 (header carries the meaning)
  - Stats: keep the top `X NEW · Y REVIEWED` widget AND add small section-header counts
- **Item 4** — DM Inbox docs:
  - NEXT.md: new bullet after line 50 (v1.8.x neighborhood)
  - ROADMAP.md: one-liner in Big-vision ideas after "Admin mode UI"
  - Both with `<!-- author: Code | date: 2026-06-02 -->` markers

## Sub-step 2 — Premium UI floor (standing rule)

Every new element (confirm modal, section headers, slide animation) ships at full brand parity per the rest of the site:
- Layered gradient surfaces, glowing focus/hover, Bebas Neue / Montserrat / Outfit / Noto Sans JP typography
- `prefers-reduced-motion` fallback on every transition + animation
- Hover states on every interactive element
- If you see a technique that would elevate further (e.g. an entrance flourish on the section headers when they first appear, a small ✓ flash when delete completes) — bring it in with a one-line "why."

## Sub-step 3 — Version bump 1.6.11 → 1.6.12

```
node scripts/bump-version.js 1.6.12
node scripts/bump-version.js --check    # expect: OK: all 26 strings agree on v1.6.12
```

## Sub-step 4 — CHANGELOG entry

Prepend a new v1.6.12 entry above v1.6.11 in `CHANGELOG.md`, with the `<!-- author: Code | date: 2026-06-02 -->` marker. Suggested body (refine voice as you go):

```
## v1.6.12 — PATCH (2026-06-02)

Three admin Suggestions Queue improvements:
- Error card now clears on successful load (was lingering past prior failed
  attempts, showing alongside the loaded queue).
- Delete confirmation is now a custom branded modal (centered overlay, layered
  gradient, glyph + kicker + body, focus trap, Escape/backdrop cancel) instead
  of the browser-native confirm() dialog.
- Mark Reviewed moves the row to a separate `REVIEWED 承認済` section below the
  new submissions (was an in-place opacity dim).

Docs: DM-style inbox between admin and visitors added to NEXT.md (v1.8.x)
and ROADMAP.md Big-vision ideas. Notes the auth prereq for capturing
visitor identity at suggestion-submission time.
```

## Sub-step 5 — Widget bullet (admin-only patch — minimal)

This patch is admin-only — no visitor-facing change. **Skip the widget bullet** this ship; the widget is visitor-facing and an admin-fix bullet would be low-value noise. If you disagree (per `docs/SKILLS/widget-update-skill.md` interpretation), surface a one-line alternative and Blake can decide.

## Sub-step 6 — Audits (gate-6 mini)

- `npm test` — must report 7/7 passing before commit
- If a test fails, STOP and report — don't commit

## Sub-step 7 — Commit + push

- `git add -A` then `git restore --staged` the same 7 gate-7 excludes (`docs/COWORK-STYLE.md`, `docs/AI-PRIMER.md`, `docs/CODE-PROMPTS.md`, `docs/SKILLS/README.md`, `docs/SKILLS/hotfix-skill.md`, `docs/SKILLS/release-skill.md`, `docs/SKILLS/widget-update-skill.md`)
- Author marker: `Blake Wolters <196413457+joewolters@users.noreply.github.com>` (NO Co-Authored-By / 🤖 / Claude Code / Generated with trailers)
- Commit message — match the CHANGELOG entry shape but slightly more terse:

```
v1.6.12 — Admin queue: error fix + branded delete modal + reviewed split

Error card now clears on successful load. Delete uses a custom branded
modal instead of confirm(). Mark Reviewed moves the row to a separate
REVIEWED 承認済 section.

Docs: DM-style admin↔visitor inbox added to NEXT.md (v1.8.x) and
ROADMAP.md Big-vision ideas.

bump-version.js: 26 targets all swept to 1.6.12.
```

- `git push origin main`

## Sub-step 8 — Preview deploy

```
firebase hosting:channel:deploy preview-v1-6-12
```

No firestore:rules redeploy this gate — schema unchanged.

## Verify before stopping

- `node --check admin/suggestions.js` clean
- `bump-version.js --check` says "all 26 strings agree on v1.6.12"
- `npm test` 7/7
- Commit author Blake Wolters with 0 forbidden trailers (grep)
- Push clean fast-forward
- Preview channel created + URL printed

## Report shape

For each sub-step: brief status. New commit SHA. Preview URL prominently. One-liner reply. Flag anything unexpected.
