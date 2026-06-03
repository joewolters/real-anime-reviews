<!-- author: Code | date: 2026-06-02 -->
# v1.6.12 — Iteration Gate (recon + propose — PROPOSED, PROPOSE-FIRST)

> Recon done on both iteration items. **Item 1's root cause found and it's a real refactor-miss:** the `loadQueue()` `catch` branch still clears `$('suggestions-list')` — an element ID that no longer exists after the gate-0 section split (it became `suggestions-list-new` / `suggestions-list-reviewed`). That line throws a `TypeError` inside the catch, so the whole error path is broken. The 2-line success-path clear DID land and works. Item 2 (horizontal columns) is a CSS-Grid + per-column-placeholder + fade-animation redesign. **Nothing applied** — awaiting Blake's 5 answers + go.

---

## Item 1 + Item 3 (shared root cause) — COULDN'T LOAD logic under the section split

### Recon findings

**The 2-line `loadQueue()` clear is intact and runs every load** (suggestions.js:339–340) — hides `#suggestions-empty` + `#suggestions-error` before each fetch. That part is fine.

**`renderQueue()` success paths never touch `#suggestions-error`** (suggestions.js:152–178). They rely entirely on the loadQueue top-of-function clear. Not belt-and-suspenders — exactly the gap the prompt names.

**The actual defect — the `catch` branch references a dead element ID** (suggestions.js:345–351):

```js
} catch (err) {
  console.error('loadQueue failed', err);
  $('suggestions-list').innerHTML = '';   // <-- #suggestions-list NO LONGER EXISTS
  $('suggestions-empty').hidden = true;   //     (renamed to -new / -reviewed in gate-0)
  $('queue-stats').hidden = true;
  $('suggestions-error').hidden = false;
}
```

`$('suggestions-list')` returns `null` now, so `null.innerHTML = ''` **throws a `TypeError` on the first line of the catch** — lines after it never run. This is the gate-0 section-split not being fully propagated into the error path (the Item 3 sanity check, confirmed).

### Honest note on reproducing Blake's exact screenshot
By static analysis of the *currently deployed* file, I can't make "COULDN'T LOAD on a clean success" happen — on success `renderQueue` runs and the error card was already hidden at fetch start; on a genuine failure the catch now throws on the dead ID and shows *nothing* (stuck skeletons), which is the opposite failure. So the most likely real-world trigger for Blake's screenshot is either (a) a transient Firestore failure interacting with this broken catch, or (b) a cached older bundle. **Either way the fix below makes every path correct**, so I'm not going to chase the exact pixels — I'm fixing the two definite defects.

### Proposed fix (the minimum robust guard, not a symptom-patch)

**1. Fix the `catch` branch to the two-section model** (~+5 lines):
```js
} catch (err) {
  console.error('loadQueue failed', err);
  $('suggestions-list-new').innerHTML = '';        // clear skeleton rows
  $('suggestions-list-reviewed').innerHTML = '';
  $('section-new').hidden = true;
  $('section-reviewed').hidden = true;
  $('suggestions-empty').hidden = true;
  $('queue-stats').hidden = true;
  $('suggestions-error').hidden = false;           // now actually reached
}
```

**2. Belt-and-suspenders in `renderQueue()`** (~+2 lines) — explicitly hide the error card on every success branch (both the empty-result branch and the has-docs branch):
```js
function renderQueue(snaps) {
  ...
  $('suggestions-error').hidden = true;   // success path → never show error, period
  if (snaps.empty || snaps.size === 0) { ... show empty card ... return; }
  $('suggestions-empty').hidden = true;
  ... render ...
}
```

Net: the error card shows **only** when `getDocs` genuinely rejects, and a success can never coexist with the empty or error card.

### Line-count delta
~**+7 lines** in `admin/suggestions.js`. Within the prompt's +5–10 estimate.

---

## Item 2 — Reviewed section as a side-by-side horizontal column

### Recon findings
- `#suggestions-queue` is currently `display: flex; flex-direction: column; gap: 22px` (suggestions.css:87–91) — vertical stack. Needs to become a 2-col grid.
- Each `<section>` already has its own header + count (`#count-new` / `#count-reviewed`) from gate-0 — reusable as-is.
- **The blocker for symmetric columns:** `updateStats()` (suggestions.js:103–104) and `renderQueue()` (suggestions.js:159–160) currently **hide a section when its count is 0** (`section.hidden = count === 0`). For always-visible symmetric columns with placeholders, that hide logic must be replaced with placeholder-toggling.
- Current move animation is a horizontal `translateX` slide (`.leaving`/`.entering`, suggestions.css ~121–130) — won't read right for column-to-column movement.

### Proposed implementation

**HTML** (~+2 lines) — add an inline empty-state placeholder inside each section, after its `<ul>`:
```html
<section id="section-new" class="queue-section">
  <div class="section-header">…</div>
  <ul id="suggestions-list-new" class="suggestions-list"></ul>
  <p class="column-empty" id="empty-new" hidden>Nothing yet</p>
</section>
<section id="section-reviewed" class="queue-section">
  …
  <p class="column-empty" id="empty-reviewed" hidden>Nothing reviewed yet</p>
</section>
```
(Sections lose their default `hidden` — both columns stay visible once the queue loads.)

**CSS** (~+35 lines):
```css
#suggestions-queue {
  display: grid;
  grid-template-columns: 1fr 1fr;   /* 50/50 — Q1 */
  gap: 24px;
  align-items: start;
}
@media (max-width: 768px) {          /* Q2 — stack on tablet/phone */
  #suggestions-queue { grid-template-columns: 1fr; gap: 22px; }
}
.column-empty {                       /* muted inline placeholder, brand-parity */
  margin: 4px 0 0;
  padding: 22px 16px;
  text-align: center;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.40);
  border: 1px dashed rgba(187,134,252,0.18);
  border-radius: 10px;
}
/* Mark-Reviewed move — fade+scale out, fade+scale in (Q4) */
.suggestion-row.leaving,
.suggestion-row.entering {
  transition: transform 200ms ease, opacity 200ms ease;
}
.suggestion-row.leaving  { opacity: 0; transform: scale(0.96); }   /* 200ms out */
.suggestion-row.entering { opacity: 0; transform: scale(0.96); }   /* 240ms in  */
```
Plus a `prefers-reduced-motion` update (instant move, no scale) replacing the old translateX reduced-motion rule.

**JS** (~+12 lines):
- `updateStats()` — drop `section.hidden = count === 0`; instead toggle the per-column placeholder: `$('empty-new').hidden = newCount > 0;` / `$('empty-reviewed').hidden = reviewedCount > 0;`. Keep the counts + top widget exactly as-is.
- `renderQueue()` — success path shows BOTH sections (`hidden = false`) and lets `updateStats()` drive placeholders. The whole-queue-empty branch keeps the existing big `#suggestions-empty` card (hide both columns) — see recommendation below.
- `renderSkeleton()` — skeleton in the NEW column; reviewed column shows its placeholder (or stays blank) until load.
- `moveToReviewed()` — timing tweak only (200ms out → append → 240ms in); the double-rAF + setTimeout-fallback structure stays.

**Whole-queue-empty recommendation:** keep the big branded `QUEUE EMPTY` card for a genuinely empty queue (0 docs total, hide both columns), and use the inline `Nothing yet` / `Nothing reviewed yet` placeholders only when the queue has *some* activity but one column is empty. That preserves the nice first-run empty state while keeping the columns symmetric during use. *Alternative if you'd rather:* always show both columns with placeholders and retire the big card — simpler mental model, but loses the branded first-run card. I recommend the former.

### Accessibility (stop-condition check)
Grid columns don't reorder the DOM — source order stays `section-new` then `section-reviewed`, so keyboard tab order goes **down the NEW column, then down the REVIEWED column**. That matches the visual left-to-right reading order; no `order:` shuffling that would desync visual vs. focus order. **No a11y regression** — flagging as checked-OK, not a blocker.

### Line-count delta
~**+35** CSS, ~**+12** JS, ~**+2** HTML. Within the prompt's estimate.

---

## Answers to the 5 open questions

| # | Question | Recommendation | Why |
|---|----------|----------------|-----|
| 1 | Column proportions | **50/50 (`1fr 1fr`)** | Matches Blake's "two columns" mental model; symmetric, simplest. NEW-biased (`1.2fr 1fr`) is possible but adds asymmetry for little gain. |
| 2 | Mobile stack breakpoint | **768px** | Two row-columns get cramped below ~720px; 768 stacks before that. The existing 640px row-reflow rule stays underneath. |
| 3 | Placeholder copy | **`Nothing yet` (NEW) / `Nothing reviewed yet` (REVIEWED)** | Exactly the prompt's rec — short, column-appropriate, visitor-flow friendly. |
| 4 | Mark Reviewed animation | **Fade+scale out → fade+scale in** | Works regardless of differing column heights; premium feel; no positioning math. Horizontal slide across columns needs FLIP measurement — not worth the complexity. |
| 5 | Header counts | **Inline `NEW 新着 · 3`** | Already implemented inline in gate-0; compact, reads as one unit. Keep it. |

---

## Stop-condition audit

| Stop condition (from prompt) | Status |
|---|---|
| `renderQueue()` structured differently than the gate-0 report described | ✓ Matches the gate-0 shape (two-list split + `updateStats` section-toggle). The defect is in the **`catch` branch**, not `renderQueue`. Surfaced above. |
| The `loadQueue()` 2-line clear didn't land | ✓ It **did** land (suggestions.js:339–340) and runs every load. The lingering-error bug is the dead-ID `catch`, not a missing clear. Surfaced. |
| Side-by-side columns create a11y issues with keyboard nav / focus order | ✓ Checked — DOM order unchanged, tab order = NEW column then REVIEWED column, matches visual order. No regression. Flagged for Blake's awareness, not a blocker. |

No blockers. Clean propose.

---

## One-liner reply

v1.6.12 iteration recon done, full proposal in `docs/SHIP-OUTPUT.md`, nothing applied (PROPOSE-FIRST); **Item 1 root cause found** — the `loadQueue()` `catch` branch still clears `$('suggestions-list')`, an ID that no longer exists after the gate-0 section split, so that line throws a `TypeError` and breaks the whole error path (the 2-line success-path clear itself landed and works fine); fix is to repoint the catch at `suggestions-list-new`/`-reviewed` + hide both sections + show error, PLUS belt-and-suspenders `$('suggestions-error').hidden = true` on every `renderQueue()` success branch (~+7 lines), which makes a success-state coexisting with the empty/error card impossible; honestly noted I can't reproduce "COULDN'T LOAD on a clean success" from the deployed file by static analysis (current code more likely fails the other way — stuck skeletons on a real failure — pointing at a transient Firestore error or a cached bundle), but the fix makes every path correct so I'm not chasing the exact pixels; **Item 2** reworks `#suggestions-queue` to a `1fr 1fr` CSS grid stacking at 768px, with per-column inline placeholders (`Nothing yet` / `Nothing reviewed yet`) replacing the gate-0 hide-empty-section logic so the columns stay symmetric, and the Mark-Reviewed move switches from a horizontal slide to a fade+scale out→in (works across unequal column heights) — ~+35 CSS / +12 JS / +2 HTML; a11y checked (grid keeps DOM order, tab order = NEW then REVIEWED, no regression); all 5 open questions answered with recommendations (50/50 columns, 768px stack, `Nothing yet`/`Nothing reviewed yet`, fade+scale animation, inline counts); no version bump (still v1.6.12); awaiting Blake's answers + go before a compressed apply+commit+preview sweep.
