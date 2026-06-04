<!-- author: Code | date: 2026-06-04 -->
# v1.8.1 — Gate 4b (7 smoke fixes from Blake's screenshots — APPLY ✓)

> **All 7 G4-smoke items applied + verified green, still uncommitted.** (1) **Scroll-lock** behind every admin overlay via a new shared `admin/modal-scroll-lock.js` (loaded on all 4 admin pages — fixes the page-scrolls-behind-the-modal bug Blake hit, and the same latent bug on season-reviews/suggestions). (2) **Diff is readable now** — the confirm modal is **wider** and long fields show **full, scrollable** before/after text (no 90-char teaser). (3) **Top-10 rank** gets a **branded ▲/▼ stepper** (native spinners hidden, identical in every browser). (4) **Origin-aware Cancel/back** — opened via the site's ✎ → returns to that anime's modal (`index.html#anime=<slug>`); opened from the edit list → returns to the list (behavior table below). (5) **Revert** button → branded "Discard your unsaved edits?" → resets every field incl. the watched tree to the saved values. (6) **"🔧 Fix from AniList" no longer silent** — root cause was the offline no-op (Blake's screenshot showed the read-only banner = server down) landing its message at the far-away status line; it now opens the panel with an **inline** offline/error message, and works end-to-end server-up (live-verified last gate). (7) **new-anime hint** added (Blake's G3 answer): a small brand-toned line on the LIVE PREVIEW card — ship first, then the real modal preview is on Edit. Verified: `node --check` all touched JS, CSS **edit 212/212 · new-anime 223/223**, bump **40**, `npm test` **12 passed**, no stray smart-quotes, all new IDs present.

---

## 1. Scroll-lock behind admin modals (bug)
- **Root cause:** the main site locks scroll in `script.js`'s `updateScrollLock()`, but the **admin pages are separate documents that don't load `script.js`** — so nothing locked the page behind their overlays. Blake saw the background move behind "Save these changes?".
- **Fix:** new **`admin/modal-scroll-lock.js`** (shared, additive) — a `MutationObserver` watches the known overlay/drawer elements (`.edit-modal`, `.edit-preview-overlay`, `#chat-drawer`, `.sr-editor-overlay`, `.confirm-overlay`) and, while any is visible, sets `documentElement.overflow:hidden` (+ an `admin-modal-open` class). Restores on close. It **observes visibility attributes only — never touches page logic.** Loaded on **edit, new-anime, season-reviews, suggestions** (the latter two had the same latent bug — "while you're there").
- **Δ** `admin/modal-scroll-lock.js` +52 (new); +1 `<script>` on each of the 4 admin HTML pages (no `?v=` on the 3 classic loads → bump stays 40; new-anime uses its runtime `${v}`).

## 2. Diff table readable (was: too small)
- **`edit.html`** — the save + ship confirm cards get **`edit-modal-card--wide`** (`min(760px,95vw)`, body scrolls at 88vh). **`edit.js`** — `renderDiff` **no longer truncates** (was 90 chars). **`edit.css`** — `.edit-diff-before/.edit-diff-after` are now `white-space:pre-wrap; max-height:168px; overflow-y:auto` so a long Review/Description shows in **full inside a scrollable cell**, rows top-align. Blake can read the whole change.
- **Δ** `edit.html` +2 classes; `edit.js` −1 trunc fn; `edit.css` ~ +6 lines.

## 3. Top-10 rank → branded stepper (was: native white/gray spinner)
- Native number spinners aren't reliably styleable across engines, so they're **hidden** (`appearance:textfield` + `::-webkit-*-spin-button{appearance:none}`) and replaced with stacked **▲/▼** brand-purple buttons inside the field. `stepTop10(±1)` clamps to **1–10**, and a first press from blank picks an end (▲→1, ▼→10). `tabindex="-1"` keeps tabbing on the input; the field stays directly typeable.
- **Δ** `edit.html` stepper markup (~6 lines); `edit.js` `stepTop10` + 2 wires; `edit.css` stepper block (~16 lines) + reduced-motion entry.

## 4. Origin-aware Cancel / back (was: always returned to the list)
- The site's ✎ now passes **`&from=modal`** (`script.js`); the edit page reads it into `formOrigin`. `returnToOrigin()` drives Cancel, the back-link, and Esc; the back-link **label** reflects origin. A list click forces `formOrigin='list'` (guards a stale `from` if a deep-link slug was invalid).
- **Behavior table:**

  | Entered via | Back-link label | Cancel / back-link / Esc | After Save |
  |---|---|---|---|
  | **Edit list** (open `edit.html`, click a row) | `← All reviews` | returns to the **list** | stays on the form |
  | **Site modal ✎** (`edit.html?slug=X&from=modal`) | `← Back to site` | navigates to **`index.html#anime=X`** (the real modal, now showing saved data) | stays on the form |

  Rationale: Save deliberately **keeps you on the form** (you may save→ship, or save→preview) — the origin only decides where *leaving* goes. Revert (item 5) covers "undo my edits" without leaving.
- **Δ** `script.js` +`&from=modal`; `edit.js` `formOrigin` + `updateBackLink` + `returnToOrigin` + rewires (~20 lines).

## 5. Revert changes (new affordance)
- A **Revert** ghost button (left of Cancel) → branded **`#edit-revert-confirm`** ("Discard your unsaved edits? … resets every field including the watched-set tree … can't be undone") → `revertForm()` re-applies `setFieldValues(currentAnime)` and resets `watchedChecked` to a **snapshot** taken when the form loaded (`initialWatchedChecked`, captured in `loadWatchedTree` — **no franchise refetch**). Status: "Reverted to saved values."
- **Decision:** placed near Save/Cancel (the actions cluster) per "your call"; snapshot-reset (not refetch) keeps it instant and identical to what loaded.
- **Δ** `edit.html` revert button + confirm modal (~12 lines); `edit.js` `setFieldValues` extraction + revert flow + snapshot (~22 lines).

## 6. "🔧 Fix from AniList" feedback (bug)
- **Root cause:** when the server was **offline** (Blake's screenshot shows the read-only banner), the handler set a message on the **bottom status line** — far from the button — so it read as "nothing happened." (Server-up it already worked; the endpoint was live-verified last gate: Demon Slayer 101922 → Crunchyroll/Hulu/Netflix.)
- **Fix:** the panel now **always opens with visible feedback right under the button** — `showFixMsg()` shows an inline offline ("start `npm run mode1`…"), no-AniList-id, or error message (result rows + Apply hidden); the success path hides the message and shows current → proposed + Apply. **No silent state.**
- **Δ** `edit.html` panel restructure (msg + result wrapper, Apply hidden by default); `edit.js` `showFixMsg` + reworked `fixPlatforms`; `edit.css` msg/result rules.

## 7. new-anime preview hint (Blake's G3 answer)
- **`new-anime.html`** — a small line under the LIVE PREVIEW card: *"👁 Want the real modal preview? Ship it first — then open it from **Edit a Review → Preview live**."* Brand-toned (`.card-preview-note` in `new-anime.css`), centered, not naggy. Resolves the G3 open question.
- **Δ** `new-anime.html` +1 line; `new-anime.css` +10 lines.

## Verification
| Check | Result |
|---|---|
| `node --check` edit.js · modal-scroll-lock.js · script.js | **all OK** |
| `edit.css` / `new-anime.css` brace balance | **212/212** · **223/223** |
| `bump-version --check` | **all 40 agree** (scroll-lock loads without a versioned target) |
| smart-quotes in touched files (Grep tool) | **none new** (3 pre-existing in untouched `script.js` *comments*) |
| new IDs referenced by edit.js present in edit.html | **all 9 present** |
| scroll-lock loaded on all 4 admin pages | **edit · new-anime · season-reviews · suggestions** |
| `npm test` (Playwright) | **12 passed (13.9s)** — no regression from the `script.js` ✎ change |

## Blake's re-smoke (needs `npm run mode1` for Save/Ship/Fix)
1. **Scroll-lock:** open a review → **Save** (or Ship/Revert/Preview/✨ASK) → the page **behind the modal no longer scrolls**. Same on new-anime / season-reviews / suggestions modals.
2. **Diff:** edit the Review (long text) → **Save** → the confirm is **wide** and the changed Review shows **in full** (scroll the cell if huge).
3. **Top-10:** the rank field has **▲/▼** purple buttons; click them (1–10), looks the same in every browser; you can still type.
4. **Origin return:** open a review **from the site's ✎** → **Cancel** (or "← Back to site") returns you to **that anime's modal on the site**. Open one **from the edit list** → **Cancel** ("← All reviews") returns to the **list**.
5. **Revert:** change some fields + tick/untick watched entries → **Revert** → confirm → everything snaps back to the saved values.
6. **Fix platforms:** with the **server off**, click **🔧 Fix from AniList** → it now **says** the server isn't running (right under the button), not nothing. With the **server on**, it shows Current → Proposed → **Apply**.
7. **new-anime:** the LIVE PREVIEW card shows the small "ship first, then Preview from Edit" line.

## Phantom-drift audit
- **Item 1 root cause re-derived:** confirmed `updateScrollLock` lives in `script.js` (not loaded on admin pages) — so the fix had to be an admin-side helper, not a reuse; built that. Verified season-reviews (`.sr-editor-overlay`) and suggestions (`.confirm-overlay`) toggle via the **`hidden` attribute** (grepped) so the observer's `attributeFilter` catches them.
- **Item 6 root cause re-derived:** confirmed the old `fixPlatforms` *did* set a message — on the bottom status line — so "does nothing" was really "feedback was off-screen"; verified the server-up path already worked (endpoint hit last gate) rather than assuming the request was broken.
- **No Ship-chain changes** (constraint honored) — `mode1-server.js` untouched this gate; all work is client + the new shared helper + the `script.js` ✎ link + new-anime copy.
- **bump stays 40** — the scroll-lock script loads without a versioned `?v=` target on the 3 classic pages and via runtime `${v}` on new-anime (no bump target needed), so no new target string.

## State for the sweep (next gate)
- **Still uncommitted; HEAD `38a4baf` / APP_VERSION 1.8.0.** New files across G4+G4b to add: `admin/edit.{html,js,css}`, `admin/chat-drawer.js`, `admin/modal-scroll-lock.js`, `scripts/lib/platform-map.js`, `tests/mode1-server.spec.js`. Touched: `mode1-server.js`, `backfill-platforms.js`, `script.js`, `admin/new-anime.{html,css}`, `admin/season-reviews.html`, `admin/suggestions.html`, `style.css`, `admin/season-reviews.js`, `scripts/bump-version.js`, `animeData.js`, `season-reviews/index.json`.
- **Sweep audit note:** the new `admin/`/`scripts/lib/`/`tests/` files carry **no secrets** (deploy-safe); verify the gitignore↔firebase mirror as usual. No `firestore.rules` change.
- **G3 open question is now CLOSED** (item 7 shipped the hint) — nothing left pending Blake before the sweep.

## One-liner reply
v1.8.1 **Gate 4b (7 smoke fixes) DONE — all applied + verified, still uncommitted**: (1) fixed the **page-scrolls-behind-the-modal** bug with a new shared **`admin/modal-scroll-lock.js`** (the admin pages don't load `script.js`'s `updateScrollLock`, so a `MutationObserver` watches the overlays and locks `documentElement.overflow` while any is open — loaded on **all 4** admin pages, fixing the same latent bug on season-reviews/suggestions); (2) made the **diff readable** — wider confirm modal + **full, scrollable** before/after cells (dropped the 90-char truncation); (3) replaced the **Top-10 native spinner** with a **branded ▲/▼ stepper** (hidden native spinners, clamps 1–10, identical cross-browser, field still typeable); (4) **origin-aware Cancel/back** — the site's ✎ now passes `&from=modal` so Cancel/back/Esc return to **`index.html#anime=<slug>`** (that anime's real modal) while a list-opened form returns to the **list** (label flips "← Back to site" vs "← All reviews"; Save deliberately keeps you on the form — table in the report); (5) a **Revert** button → branded "Discard your unsaved edits?" → resets every field **incl. the watched tree** to the saved values via an in-memory snapshot (no refetch); (6) **"🔧 Fix from AniList" is no longer silent** — root cause was the offline no-op dropping its message at the far-away status line, so it now opens the panel with an **inline** offline/error message (and works end-to-end server-up — endpoint live-verified last gate: Demon Slayer 101922 → Crunchyroll/Hulu/Netflix); (7) added Blake's G3-answer **new-anime hint** ("ship first, then Preview live from Edit") on the LIVE PREVIEW card; verified green (`node --check` all touched JS, CSS **212/212 + 223/223**, **bump 40**, **`npm test` 12 passed**, no new smart-quotes, all new IDs present, scroll-lock confirmed on all 4 admin pages) with **no Ship-chain changes** and the **G3 open question now closed** — next is the compressed sweep (CHANGELOG v1.8.1 MINOR + widget + `bump 1.8.1`→40 + ROADMAP/NEXT shipped → audits → Blake-authored commit with the 7 Cowork excludes out → preview → smoke → prod).
