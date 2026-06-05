<!-- author: Code | date: 2026-06-04 -->
# v1.8.2 — Gate 3c (6 smoke fixes + admin audit — APPLY ✓, uncommitted)

> **All six fixes applied + the audit done; green (`npm test` 14, plus an in-browser check of every new behavior).** The two bugs root-caused: (4a) the pill rail couldn't reach later pills because it was a hidden-scrollbar horizontal overflow with no desktop horizontal wheel → switched to **wrap** (every pill reachable, no scroll); (6) season-reviews showed no toolbar because **only section bodies had one, not the Intro** → the Intro block now gets the shared B/I/🔗 toolbar on all surfaces. Plus: drag-and-drop reorder, Ctrl/⌘+B/I, a bigger/premium edit-page Review area, a softened pill rail, and a polished form footer. Verified in a real browser: intro toolbar present, Ctrl+B bolds, ▲▼ reorders, the rail computes `flex-wrap:wrap`.

---

## Fixes

**1. Edit-page Review area — bigger + premium (`edit.css`).** The "Review" label is now a **kicker** (uppercase, brand-purple, letter-spacing) instead of a plain word; the block gets a top hairline + spacing. The editor/preview split widened (`gap 18px`, `align-items:start`) and the **preview is much larger** — `min-height:380px; max-height:72vh`, sticky at the top of the column with a premium gradient surface (was a small 320px box). Section bodies got a `min-height:90px`. Mobile (<760px) drops the sticky + caps the preview height.

**2. Drag-and-drop reorder (`section-editor.js` + `.css`).** The `⋮⋮` grip is now real: grabbing it sets the section `draggable`, `dragstart/dragover/dragend` reorder via a midpoint `dragAfter()` helper (the dragged card dims to `.se-dragging`), and `▲/▼` still work. No transition/animation on the move (instant DOM reorder — no jank), grip shows `grab`/`grabbing` cursors.

**3. Form footer polish (`edit.css`).** `.edit-status` is now a brand pill (only when non-empty, via `:not(:empty)`); the Save/Ship helper line is a framed note (`rgba(40,18,70,.3)` panel + purple border, bold accents) instead of bare grey text.

**4. Main-modal pill rail (`style.css`).**
- **(4a) functional — root cause:** `.review-nav` was `flex-wrap:nowrap; overflow-x:auto` with the scrollbar **hidden** (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`). With all 9 pills wider than the column, DESIGN-onward overflowed into a scroll region that had **no visible scrollbar and no horizontal mouse wheel on desktop** → unreachable. **Fix:** `flex-wrap:wrap` (removed the overflow + hidden-scrollbar rules) → pills wrap onto extra rows, **all 9 always reachable**, no scrolling needed.
- **(4b) design:** softened the "abrupt solid black box" — the near-opaque `rgba(18,5,34,.94)` + hard bottom border became a **translucent gradient + blur "chip tray"** with a rounded border (`border-radius:12px`), so it reads as a soft frosted tray over the review, not a black bar.

**5. Keyboard shortcuts (`section-editor.js`).** `Ctrl/⌘ + B` and `Ctrl/⌘ + I` inside any Intro or section body wrap the selection (same as the buttons). Scoped to the editor's textareas only (the handler bails unless `e.target.closest('.se-intro, .se-section-body')`), so it never hijacks outside.

**6. Season-reviews B/I/🔗 missing — root cause + fix (`section-editor.js`).** The toolbar was only emitted inside `sectionBlockHtml` (section bodies). A review with **zero sections** (his season-reviews screenshot, and every legacy review) shows only the Intro → no toolbar anywhere. **Fix:** the Intro block now renders the **same shared `TOOLBAR`**, and the button handler was generalized to target the nearest textarea (`closest('.se-intro-wrap, .se-section').querySelector('textarea')`) so it works for both. This fixes season-reviews **and** gives the Intro formatting buttons on all three surfaces.

## 7. Admin audit (swap-touched paths)
**Fixed/verified working:**
- **new-anime:** `initReviewMarkdown()` still runs (mounts the editor); the reset loop no longer references the removed `#review-input` (it would have thrown) and clears via `reviewEditor.load('')`; "Review is empty" validation + the submit payload read `reviewValue()`. **Confirmed zero dead `#review-input` / `review-md-toolbar` / `.md-btn` refs.**
- **change-diff with a reorder-only edit:** reordering changes `value()` → it correctly registers as a real change (the diff shows it); an untouched review still says "No changes to save" (baseline captured from the editor at load).
- **Revert mid-edit:** re-loads the saved review into the editor and resets the diff baseline.
- **✨ASK drawer:** unaffected (fixed right panel; its `getSession` reads `currentAnime`); coexists with the editor.
- **season-reviews zero-section save:** `value()` returns the Intro text; empty intro + no sections → "" → "Write something first." (unchanged guard).

**Flagged (judgment calls, not fixed):**
- `new-anime.css` still has the old `.md-toolbar` / `.md-btn` rules — now **dead** (that markup was removed) but harmless; the `.md-preview` rules are still used by the preview pane. Left as-is to avoid churn on shipped CSS; can prune in a later cleanup.

## Verification
| Check | Result |
|---|---|
| `node --check` section-editor.js · new-anime.js · edit.js · season-reviews.js · markdown.js | **all OK** |
| `edit.css` · `section-editor.css` · `style.css` brace balance | **223/223 · 38/38 · 1032/1032** |
| in-browser behaviors (throwaway): intro toolbar · Ctrl+B · ▲▼ reorder · rail `flex-wrap` | **true · bolds · reorders · `wrap`** |
| `npm test` (Playwright) | **14 passed** |
| `bump-version --check` · smart-quotes (Grep tool) | **40** · **none new** |

## Blake's re-smoke (editor authors offline; saving needs `npm run mode1`)
1. **Edit page Review (no server):** open a review → the **Review** header is a purple kicker; the editor + preview are **much taller**, preview sticks as you scroll. The footer "No changes…" / Save-vs-Ship note now look styled (pill + framed note).
2. **Drag reorder (no server):** add a few sections → **drag the `⋮⋮` grip** up/down to reorder (the card dims while dragging); `▲/▼` still work too.
3. **Keyboard (no server):** in any Intro or section body, select text → **Ctrl/⌘+B** bolds, **Ctrl/⌘+I** italicizes.
4. **Intro toolbar / season-reviews (no server to see it; `mode1` to save):** open **Admin → Season Reviews** → any season → the **Intro box now has B / I / 🔗** (it was missing). Same on the edit page + new-anime Intro.
5. **Pill rail (needs a saved sectioned review, `mode1`):** add **all 9** sections, save, open the anime's **main modal** → the rail now **wraps to show all 9** (DESIGN/MUSIC/FEEL/EXTRA THOUGHTS/OVERALL reachable), and the tray looks **soft** (frosted), not a black box. Clicking any pill still scrolls; gold Overall.
6. **Audit spot-checks:** new-anime **Reset** clears the Review editor; an **untouched** edit → "No changes to save"; **Revert** restores; the **✨ASK** drawer still opens beside the editor.

## Phantom-drift audit
- **4a root cause re-derived:** it wasn't "too many pills for the width" alone — it was the **hidden scrollbar + no horizontal wheel** turning the overflow into a dead zone. Verified by switching to wrap (the in-browser check reads `flex-wrap:wrap`).
- **6 root cause re-derived:** confirmed the toolbar lived only in `sectionBlockHtml`, so a zero-section editor (the screenshot) had none — gave the Intro the shared toolbar rather than guessing season-reviews "lost" it.
- **Audit, not assumption:** actually grepped for dead `#review-input`/`review-md-toolbar`/`.md-btn` refs (none) and confirmed `initReviewMarkdown()` is still invoked, rather than assuming the swap was clean.

## State for the sweep
- Uncommitted (G3c build). Touched this gate: `markdown.js` (G3b), `admin/section-editor.{js,css}`, `admin/edit.css`, `style.css` — plus the G1/G2/G3b tree. The v1.8.2 sweep bundles it all (CHANGELOG MINOR — visitor-readable structured reviews + admin authoring; widget; `bump 1.8.2`; ROADMAP/NEXT; audits; commit; preview; prod). `firestore.rules` untouched; new admin assets deploy-safe.

## One-liner reply
v1.8.2 **Gate 3c (6 smoke fixes + admin audit) DONE — applied, green (npm test 14 + an in-browser behavior check), uncommitted**: root-caused the two bugs — **(4a)** the pill rail's later pills were unreachable because it was a `nowrap; overflow-x:auto` row with the **scrollbar hidden** and no desktop horizontal wheel → switched to **`flex-wrap:wrap`** so all 9 wrap into view (verified `getComputedStyle.flexWrap==='wrap'`), and **(6)** season-reviews/legacy showed no toolbar because only **section bodies** had one, not the **Intro** → the Intro block now renders the shared B/I/🔗 toolbar on all three surfaces (handler generalized to the nearest textarea); plus **drag-and-drop** reorder via the `⋮⋮` grip (keeping ▲/▼, dragged card dims, no jank), **Ctrl/⌘+B/I** scoped to the editor textareas, a **bigger + premium** edit-page Review area (kicker label, taller sticky preview, framed Save/Ship note + status pill), and a **softened** pill rail (translucent frosted "chip tray", not an abrupt black box); the **admin audit** verified the swap-touched paths (new-anime reset/validation/mount with **zero dead `#review-input` refs**, reorder-only diffs register correctly, Revert + ASK drawer + zero-section season save all fine) and flagged only harmless dead `.md-toolbar` CSS in new-anime.css; `npm test` **14**, CSS balanced (223/38/1032), **bump 40**, no smart-quotes; **re-smoke:** most is testable **offline** (kicker/taller preview, drag, Ctrl+B/I, the Intro toolbar), the **wrapped/softened rail** needs a saved 9-section review (`npm run mode1`); next is the **v1.8.2 sweep**.
