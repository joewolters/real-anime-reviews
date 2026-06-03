<!-- author: Code | date: 2026-06-02 -->
# v1.6.12 — Gate 0 (recon + 4-item propose — PROPOSED, PROPOSE-FIRST)

> Recon complete on all 4 SHIP-PROMPT items. Item 1 (error card) bug confirmed exactly as Blake described — `renderQueue()` success path never clears `#suggestions-error`; 2-line fix. Item 2 (branded modal) is net-new — no overlay modal exists in `admin/` yet; promise-based `confirmModal()` with a clean one-line call-site swap. Item 3 (reviewed section) — two stacked sections + DOM-move; `loadQueue`/`renderQueue` and `.reviewed` styling have NOT drifted from the gate-3d shape. Item 4 (DM inbox) — docs-only homes proposed in NEXT.md (v1.8.x slot) + ROADMAP.md (Big-vision ideas). **Nothing applied** — awaiting Blake's answers to the 5 open questions + go-signal.

A note before the items: the memory `[[feedback-no-native-dialogs]]` referenced in the SHIP-PROMPT isn't on disk yet (`memory/MEMORY.md` doesn't exist). Not blocking — Item 2 implements exactly that guidance — but flagging that the memory file wasn't actually saved.

---

## Item 1 — Error card hides on successful load

### Recon findings
Confirmed the bug exactly as Blake described. The structure matches the gate-3d-apply shape:

- `loadQueue()` (suggestions.js:223) does **not** hide `#suggestions-error` before fetching. It only touches the error card inside its `catch` branch.
- `renderQueue()` (suggestions.js:131) on the **success** path hides `#suggestions-empty` (line 139) and toggles `#queue-stats` — but **never touches `#suggestions-error`**. So a stale error card from a prior failed attempt survives a later successful load. That's the "all three cards visible at once" screenshot.
- The catch branch (lines 230–233) already hides empty + stats and shows error — that half is correct.

### Proposed fix
Add 2 lines at the very start of `loadQueue()`, before the `try`/fetch:

```js
async function loadQueue() {
  $('suggestions-empty').hidden = true;   // clear any stale empty card
  $('suggestions-error').hidden = true;   // clear any stale error card  <- the actual fix
  try {
    const q = query(...);
    ...
```

`renderSkeleton()` already runs once in the auth callback (line 246), not per-load, so a reload-retry won't reshow skeletons — acceptable, and out of scope. The 2-line hide is the minimal correct fix.

### Line-count delta
**+2 lines** in `suggestions.js`. No CSS/HTML.

---

## Item 2 — Custom branded delete-confirmation modal

### Recon findings
- **No reusable overlay modal exists anywhere in `admin/`.** The "confirm" hits in `new-anime.js` are inline `#deploy-confirm-row` rows, not overlays. This is a net-new component.
- The `.danger` red-gradient button style already exists at suggestions.css:301 and can be reused directly.
- The delete call site is suggestions.js:189: `if (!confirm(...)) return;` — a clean single-line swap point.
- Brand vocabulary to mirror: `.admin-shell` layered gradient + border-image hairline + glow (suggestions.css:17–32), 18px radius, kicker pattern (`COULDN'T LOAD 接続`, etc.).

### Proposed implementation
**HTML** (`suggestions.html`) — one static overlay block before the closing `</main>`, `hidden` by default:

```html
<div id="confirm-modal" class="confirm-overlay" hidden>
  <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <div class="confirm-glyph" aria-hidden="true">🗑️</div>
    <div class="confirm-kicker">DELETE SUGGESTION <span class="jp-mini">削除</span></div>
    <p class="confirm-body" id="confirm-title"><!-- filled dynamically --></p>
    <div class="confirm-actions">
      <button type="button" class="secondary" data-confirm="cancel">Cancel</button>
      <button type="button" class="danger" data-confirm="ok">Delete</button>
    </div>
  </div>
</div>
```

**JS** (`suggestions.js`) — promise-based helper, plus a one-line call-site swap:

```js
function confirmModal(title) {
  return new Promise((resolve) => {
    const overlay = $('confirm-modal');
    $('confirm-title').textContent = `Delete suggestion "${title}"?`;
    overlay.hidden = false;
    const cancelBtn = overlay.querySelector('[data-confirm="cancel"]');
    cancelBtn.focus();                       // default focus on safe option

    const close = (val) => {
      overlay.hidden = true;
      overlay.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onClick = (e) => {
      if (e.target === overlay) return close(false);          // backdrop = cancel
      const b = e.target.closest('[data-confirm]');
      if (b) close(b.dataset.confirm === 'ok');
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Tab') { /* focus trap between the two buttons */ }
    };
    overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}
```

Call site change (line 189):
```js
if (!await confirmModal(title)) return;   // was: if (!confirm(`Delete suggestion: "${title}"?`)) return;
```
The handler is already `async`, so `await` works with no other change. Delete logic below it stays intact.

**CSS** (`suggestions.css`) — `.confirm-overlay` (fixed, `rgba(0,0,0,0.55)` + `backdrop-filter: blur(8px)`, flex-center, 220ms fade), `.confirm-card` (reuse `.admin-shell` gradient/border-image/glow/18px radius, 220ms `opacity 0→1` + `scale .96→1`), glyph/kicker/body/actions. Buttons reuse existing `.actions button` / `.danger` / `.secondary`. One `@media (prefers-reduced-motion: reduce)` block zeroing the transitions/animations.

### Line-count delta
~**+11** HTML, ~**+30** JS, ~**+55** CSS. ≈ **+96 total**.

---

## Item 3 — Reviewed rows move to a separate section

### Recon findings
- Currently a single `<ul id="suggestions-list">` (suggestions.html:50).
- `.suggestion-row.reviewed` is `opacity: 0.5` (hover 0.75) at suggestions.css:121–126 — the in-place dim Blake wants replaced.
- Five spots reference the single list and need updating: `renderSkeleton()` (62), `updateStats()` (68), `renderQueue()` (132–141), the reviewed-click handler (165–186), and the delete cleanup (198–201).
- `updateStats()` (suggestions.js:67) already computes `newCount`/`reviewedCount` by scanning `.reviewed` — that logic ports cleanly to a two-list model (count `.children` of each).

### Proposed implementation — vertical stacked sections
**HTML** — replace the single `<ul>` with two labelled sections:

```html
<section id="section-new" class="queue-section">
  <div class="section-header"><span class="section-kicker">NEW <span class="jp-mini">新着</span></span></div>
  <ul id="suggestions-list-new" class="suggestions-list"></ul>
</section>
<section id="section-reviewed" class="queue-section" hidden>
  <div class="section-header"><span class="section-kicker">REVIEWED <span class="jp-mini">承認済</span></span></div>
  <ul id="suggestions-list-reviewed" class="suggestions-list"></ul>
</section>
```

**JS**:
- `renderQueue()` splits `snaps.docs` into new vs `status === 'reviewed'`, renders each into its list, and shows/hides each `<section>` based on whether it has rows.
- Reviewed-click handler: after the `updateDoc` succeeds, **move the `<li>` DOM node** from `#suggestions-list-new` to `#suggestions-list-reviewed` (a ~320ms slide transition), then reveal `#section-reviewed` if it was hidden and re-hide `#section-new` if it emptied.
- `renderSkeleton()` targets `#suggestions-list-new` only.
- `updateStats()` reads `.children.length` of each list instead of scanning `.reviewed`.
- Delete cleanup: empty-card check becomes "both lists empty."

### Line-count delta
~**+10** HTML, ~**+35** JS (split/move logic), ~**+30** CSS (section headers reusing kicker pattern + slide transition). ≈ **+75 total**. The old `.reviewed { opacity }` rule is repurposed per open-question #3.

### Stop-condition check
`loadQueue`/`renderQueue` match the gate-3d-apply shape — no structural drift. `.suggestion-row.reviewed` styling has **not** drifted (still the simple opacity rule). No surprises.

---

## Item 4 — Document DM-style inbox feature (docs-only)

### Recon findings — proposed homes
- **NEXT.md:** No literal "v1.8.x" header exists, but NEXT.md:50 is the `v1.8.0 — AniList tab` line — the v1.8.x neighborhood. **Recommend** inserting the DM-inbox entry as a new `v1.8.x` bullet immediately after line 50, since it explicitly "pairs with the planned notification/comment overhaul" and is admin+visitor UI work in that era. (Alternative: the "Big-vision ideas" block at lines 92–99 — but that loses the version anchor, so I prefer the v1.8.x slot.)
- **ROADMAP.md:** Phase C is shipped (verification scaffolding). The closest existing home is **Big-vision ideas → "Admin mode UI"** (ROADMAP.md:322), which already covers admin moderation surfaces. **Recommend** a one-line bullet appended to the Big-vision ideas section right after Admin mode UI.

### Proposed text
**NEXT.md** (new bullet after line 50):
> **v1.8.x — Suggestion DM Inbox.** Admin can respond directly to whoever submitted a suggestion + tell them if Blake liked it. Pairs with the planned notification/comment overhaul. Visitor side gets an Inbox UI; admin side gets a per-suggestion reply thread. **Auth prerequisite:** visitors need a stable identity (email or anon Firebase Auth UID) captured at suggestion-submission time — requires a schema change on `suggestions` docs. Estimated v1.8.x or later.

**ROADMAP.md** (one-liner in Big-vision ideas):
> **Suggestion DM inbox.** Admin replies directly to suggestion submitters (DM-style), gated on capturing a stable submitter identity. Pairs with the notification/comment overhaul.

Both lines get the `<!-- author: Code | date: 2026-06-02 -->` marker per project rule #2.

### Line-count delta
~**+2** NEXT.md, ~**+2** ROADMAP.md. Docs-only — no test required (project rule #7 exception).

---

## Answers to the 5 open questions for Blake

| # | Question | Recommendation | Why |
|---|----------|----------------|-----|
| 1 | Delete glyph: ⚠️ or 🗑️? | **🗑️** | The error card already owns ⚠️ (suggestions.html:59). Using 🗑️ keeps the delete-confirm visually distinct from the error state and literally names the action. |
| 2 | Kicker text | **Keep `DELETE SUGGESTION 削除`** | 削除 = "deletion" — accurate, and matches the existing kicker pattern (`QUEUE EMPTY 空`, `COULDN'T LOAD 接続`). |
| 3 | Reviewed-section opacity | **Full opacity** (drop the 0.5 dim) | Once rows live under their own "REVIEWED 承認済" header, the header carries the meaning. A half-faded section just hurts readability. Repurpose the old `.reviewed` rule rather than delete it. |
| 4 | Move animation | **320ms slide** | Matches the existing motion vocabulary — the delete-collapse already uses `max-height 320ms` (suggestions.css:98). Reduced-motion = instant move. |
| 5 | Stats counter location | **Keep at top**, add a small count to each section header | The top `X NEW · Y REVIEWED` is the glanceable summary; per-section counts in the headers add local clarity without removing the existing widget. Lowest-risk, both worlds. |

---

## Total estimated footprint (if all approved)
- **JS:** ~+67 lines (`suggestions.js`)
- **HTML:** ~+21 lines (`suggestions.html`)
- **CSS:** ~+85 lines (`suggestions.css`)
- **Docs:** ~+4 lines (NEXT.md + ROADMAP.md)
- Plus version-bump strings (1.6.11 → 1.6.12) across `suggestions.html`, the two main HTML files, CHANGELOG, ROADMAP per the version-bump checklist.

---

## Stop-condition audit

| Stop condition (from SHIP-PROMPT) | Status |
|---|---|
| If `loadQueue()` / `renderQueue()` are structured very differently than the gate-3d-apply shape, surface the current state | ✓ **No drift.** `loadQueue()` (suggestions.js:223) and `renderQueue()` (131) match the gate-3d-apply shape — catch-branch hides empty+stats+shows error; success path hides empty but is missing the error-hide. Exactly the documented bug, nothing more. |
| If `.suggestion-row.reviewed` styling has drifted, surface the current rules | ✓ **No drift.** Still the simple `opacity: 0.5` (hover `0.75`) at suggestions.css:121–126. No additional reviewed-state rules have crept in. |
| If `docs/NEXT.md` or `ROADMAP.md` don't have an obvious home for the DM feature, propose where it should land | 🟡 **No literal "v1.8.x" header exists** in NEXT.md — proposed landing after the `v1.8.0 — AniList tab` bullet (line 50) as a new v1.8.x entry; ROADMAP home proposed in Big-vision ideas after "Admin mode UI" (line 322). Surfaced + recommended, not silently placed. |
| Anomalies outside gate scope | ✓ One flagged: the memory `[[feedback-no-native-dialogs]]` cited in the prompt isn't actually on disk (`memory/MEMORY.md` missing). Not blocking. No code anomalies found; nothing fixed unilaterally. |

No stop conditions block the proposal. This is a clean gate-0 propose.

---

## One-liner reply

Gate 0 recon done on all 4 v1.6.12 items, full proposal written to `docs/SHIP-OUTPUT.md`, nothing applied (PROPOSE-FIRST); **Item 1** error-card bug confirmed exactly as Blake's screenshot showed — `renderQueue()` success path (suggestions.js:131) never clears `#suggestions-error`, fix is +2 lines at the top of `loadQueue()`; **Item 2** branded delete modal is net-new (no overlay modal exists in `admin/` — the only "confirm" in new-anime.js is an inline deploy row), proposed as a promise-based `confirmModal(title)` reusing the existing `.admin-shell` gradient + `.danger` button, with a clean one-line swap of the `confirm()` call at suggestions.js:189 (~+96 lines HTML/JS/CSS); **Item 3** reviewed-row split proposed as two stacked `<section>`s (`#suggestions-list-new` + `#suggestions-list-reviewed`) with a 320ms DOM-move on Mark Reviewed (~+75 lines), and confirmed `loadQueue`/`renderQueue` + `.reviewed` styling have NOT drifted; **Item 4** DM-inbox documented (docs-only) with proposed homes in NEXT.md (new v1.8.x bullet after the AniList-tab line) + ROADMAP.md (Big-vision ideas near "Admin mode UI"); all 5 open questions answered with recommendations (🗑️ glyph to stay distinct from the ⚠️ error card; keep `DELETE SUGGESTION 削除` kicker; full opacity in the reviewed section since the header carries the meaning; 320ms slide to match the existing `max-height 320ms` motion vocabulary; keep the top stats counter + add per-section counts); no stop conditions hit; awaiting Blake's 5 answers + go before a gate-1-apply prompt.
