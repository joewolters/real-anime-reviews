// nav-drawer.js (ES module) — mega-run milestone D: THE NAV DRAWER.
// <!-- author: Code | date: 2026-07-02 -->
// One implementation for every page that carries the full header (index +
// account — the consent.js "one module" precedent). ≤1200px the CSS turns
// `.toolbar#main-toolbar` into a left off-canvas drawer (style.css milestone-D
// block); this module owns the toggle/scrim/Esc/focus/scroll-lock choreography.
// House disciplines carried in:
//  - the hub-drawer open/close shape (hidden → double-rAF → class; re-entrant
//    close no-ops; +300ms hidden), script.js:6504-6531
//  - the conditional scroll-lock RELEASE (never wipe a lock some other open
//    layer still needs), script.js:11254 precedent
//  - the layered-Esc bail (a higher overlay owns Esc), script.js:6493-6498
//  - reduced-motion: CSS silences the slide; JS skips the timing dance too.

export function initNavDrawer() {
  const toggle = document.getElementById('nav-drawer-toggle');
  const toolbar = document.getElementById('main-toolbar');
  const scrim = document.getElementById('nav-drawer-scrim');
  if (!toggle || !toolbar || !scrim) return;

  const mq = window.matchMedia('(max-width: 1200px)');
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFocus = null;
  let closeTimer = null;   // TRUE-panel (HIGH, fixed): a reopen inside the
  // 300ms close window used to let the STALE timer hide the scrim and wipe
  // the lock under the freshly-reopened drawer. One tracked timer, always
  // cleared on open and on a newer close.

  const isOpen = () => document.body.classList.contains('nav-open');

  // a higher layer that owns the screen — the drawer neither opens under one
  // (TRUE-panel: Enter on the focus-restored toggle reopened it INVISIBLY
  // beneath the Tavern hub) nor steals its Esc.
  const HIGHER_LAYERS = '.hub-newthread-overlay, .rar-report-overlay, .rar-consent-overlay, .secondary-layer.active, .modal.active, .hub-layer.active, .lantern-layer.active, .profile-layer:not([hidden])';

  function otherLockedLayerOpen() {
    // the script.js:11254 release check — a drawer close must never free a
    // scroll lock that a modal/sheet/hub/lantern layer still owns.
    return document.querySelector('.secondary-layer.active, .modal.active, .profile-layer:not([hidden]), .hub-layer.active, .lantern-layer.active, #catchup-sheet:not([hidden])')
      || document.body.classList.contains('modal-open');
  }

  function open() {
    if (!mq.matches || isOpen()) return;
    if (document.querySelector(HIGHER_LAYERS)) return;   // never open under an overlay
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    lastFocus = document.activeElement;
    scrim.hidden = false;
    const go = () => {
      document.body.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      // modal semantics while open — the scrim + trap + Esc make it modal in
      // behavior; say so to assistive tech (TRUE-panel LOW).
      toolbar.setAttribute('role', 'dialog');
      toolbar.setAttribute('aria-modal', 'true');
      toolbar.setAttribute('aria-label', 'Site navigation');
      document.documentElement.style.overflow = 'hidden';
      // land focus on the first place button (the drawer is a nav, but it
      // overlays content — focus must enter it; welcome-door precedent).
      try { toolbar.querySelector('.place-btn, button, a')?.focus({ preventScroll: true }); } catch (_) {}
    };
    if (reduced()) go();
    else requestAnimationFrame(() => requestAnimationFrame(go));
    document.addEventListener('keydown', onKeydown, true);
  }

  function close(opts) {
    if (!isOpen()) return;   // re-entrant close no-ops (hub precedent)
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    toolbar.removeAttribute('role');
    toolbar.removeAttribute('aria-modal');
    toolbar.removeAttribute('aria-label');
    document.removeEventListener('keydown', onKeydown, true);
    const done = () => {
      closeTimer = null;
      scrim.hidden = true;
      if (!otherLockedLayerOpen()) document.documentElement.style.overflow = '';
    };
    if (closeTimer) clearTimeout(closeTimer);
    if (reduced() || (opts && opts.instant)) { closeTimer = null; done(); }
    else closeTimer = setTimeout(done, 300);
    // restore focus unless the closing action moved it on purpose (a place
    // click paints a new surface; the toggle is the stable home).
    try { (lastFocus && document.contains(lastFocus) ? lastFocus : toggle).focus({ preventScroll: true }); } catch (_) {}
    lastFocus = null;
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      // a higher overlay owns Esc (hub precedent) — the drawer sits under
      // modals/hub/lantern layers even though it out-z-indexes the header.
      if (document.querySelector(HIGHER_LAYERS)) return;
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    // FULL manual cycling within the DRAWER's controls only (TRUE-panel HIGH:
    // the old first/last trap let a forward-Tab from the toggle fall through
    // to the scrim-covered logo link — an invisible stop whose Enter
    // navigated). The toggle leaves the cycle while open; close restores it.
    const focusables = Array.from(
      toolbar.querySelectorAll('button, a, input, select, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.getClientRects().length > 0);
    if (!focusables.length) return;
    e.preventDefault();
    const idx = focusables.indexOf(document.activeElement);
    const next = e.shiftKey
      ? (idx <= 0 ? focusables[focusables.length - 1] : focusables[idx - 1])
      : (idx === -1 || idx === focusables.length - 1 ? focusables[0] : focusables[idx + 1]);
    try { next.focus({ preventScroll: true }); } catch (_) {}
  }

  toggle.addEventListener('click', () => { if (isOpen()) close(); else open(); });
  scrim.addEventListener('click', () => close());

  // any button chosen inside the drawer closes it — a place switches the
  // surface, a tool opens its own panel (the filter panel lives OUTSIDE the
  // transformed toolbar precisely so it survives this close). CAPTURE phase:
  // the filter button stopPropagation()s on bubble (its shield against the
  // panel's outside-click closer), which would strand the drawer open UNDER
  // the freshly-opened panel (z 2100 vs 1100 — caught by the D3 sweep).
  toolbar.addEventListener('click', (e) => {
    if (!isOpen()) return;
    if (e.target.closest('button, a')) close();
  }, true);

  // crossing back to desktop closes instantly (no stray lock, no stale state)
  const onMq = () => { if (!mq.matches) close({ instant: true }); };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMq);
  else if (typeof mq.addListener === 'function') mq.addListener(onMq);   // legacy fallback (veil-pulse precedent)
}
