// admin/admin-modals.js — the ONE branded confirm/notice modal for admin pages.
// <!-- author: Code | date: 2026-08-10 -->
// =============================================================================
// PATCH QUEUE item 2 — "unify the tripled brandSelect + adopt showNotice in
// admin". The brandSelect half landed already (one shared `brand-select.js`);
// this is the other half.
//
// reports.js and suggestions.js each carried their OWN confirmModal AND
// noticeModal — the reports.js copies are literally commented "parameterized
// clone of suggestions'". Two implementations of the same dialog drift: fix a
// focus-trap bug in one and the other keeps it. That is exactly the
// duplicate-implementation class that produced round 1's lantern HIGH.
//
// ONE signature now, the richer (reports) object shape. suggestions' two
// positional forms were rewritten at their call sites rather than supported
// here — a shim that accepts both shapes is just the duplication moved.
//
// Contract with the page: an overlay `#confirm-modal` containing `.confirm-card`,
// `.confirm-glyph`, `.confirm-kicker`, `.confirm-body`, and two buttons
// `[data-confirm="cancel"]` / `[data-confirm="ok"]`. Looked up BY CLASS inside
// the overlay, not by global id — reports.html ids its glyph/kicker and
// suggestions.html doesn't, and neither page should need markup surgery to
// share a dialog.
//
// No native dialogs anywhere on this site; these are the replacements.
// =============================================================================

const $overlay = () => document.getElementById('confirm-modal');

// Text goes in via textContent and the jp sublabel is a real element — no
// interpolation, so no escaping question to get wrong later.
function paintKicker(el, kicker, kickerJp) {
  if (!el) return;
  el.textContent = kicker || '';
  if (kickerJp) {
    const jp = document.createElement('span');
    jp.className = 'jp-mini';
    jp.textContent = kickerJp;
    el.appendChild(document.createTextNode(' '));
    el.appendChild(jp);
  }
}

function parts() {
  const overlay = $overlay();
  if (!overlay) return null;
  return {
    overlay,
    card: overlay.querySelector('.confirm-card'),
    glyph: overlay.querySelector('.confirm-glyph'),
    kicker: overlay.querySelector('.confirm-kicker'),
    body: overlay.querySelector('.confirm-body'),
    cancelBtn: overlay.querySelector('[data-confirm="cancel"]'),
    okBtn: overlay.querySelector('[data-confirm="ok"]'),
  };
}

function open(p) {
  p.overlay.hidden = false;
  // Double-rAF so the entrance transition replays reliably on every open — a
  // single rAF batches the hidden-removal and the class-add into one frame.
  requestAnimationFrame(() => requestAnimationFrame(() => p.card.classList.add('is-open')));
}

function shut(p, prevFocus, onClick, onKey) {
  p.overlay.removeEventListener('click', onClick);
  document.removeEventListener('keydown', onKey);
  p.card.classList.remove('is-open');
  p.overlay.hidden = true;
  // Always hand the overlay back intact — noticeModal hides Cancel, and the
  // next confirmModal on the same page needs it.
  if (p.cancelBtn) p.cancelBtn.hidden = false;
  if (prevFocus && prevFocus.focus) prevFocus.focus();
}

// confirmModal — resolves true on OK, false on Cancel / backdrop / Escape.
// Two-stop focus trap between the two buttons; Cancel takes focus first,
// because the safe option should be the one you hit by reflex.
export function confirmModal(opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    const p = parts();
    if (!p) { resolve(false); return; }   // no overlay on this page — never hang the caller
    if (p.glyph) p.glyph.textContent = o.glyph || '⚠️';
    paintKicker(p.kicker, o.kicker || 'CONFIRM', o.kickerJp || '確認');
    if (p.body) p.body.textContent = o.body || 'Are you sure?';
    if (p.okBtn) p.okBtn.textContent = o.okLabel || 'Confirm';
    if (p.cancelBtn) p.cancelBtn.textContent = o.cancelLabel || 'Cancel';

    const prevFocus = document.activeElement;
    open(p);
    if (p.cancelBtn) p.cancelBtn.focus();

    const close = (val) => { shut(p, prevFocus, onClick, onKey); resolve(val); };
    const onClick = (e) => {
      if (e.target === p.overlay) return close(false);          // backdrop = cancel
      const b = e.target.closest('[data-confirm]');
      if (b) close(b.dataset.confirm === 'ok');
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); return close(false); }
      if (e.key === 'Tab') {
        const active = document.activeElement;
        if (e.shiftKey && active === p.cancelBtn) { e.preventDefault(); p.okBtn.focus(); }
        else if (!e.shiftKey && active === p.okBtn) { e.preventDefault(); p.cancelBtn.focus(); }
      }
    };
    p.overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}

// noticeModal — the same overlay minus the choice: one exit, for things the
// admin needs to SEE rather than decide on. Tab is held on the single button
// so focus cannot wander behind the dialog.
export function noticeModal(opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    const p = parts();
    if (!p) { resolve(); return; }
    if (p.glyph) p.glyph.textContent = o.glyph || '⚠️';
    paintKicker(p.kicker, o.kicker || 'HEADS UP', o.kickerJp || '注意');
    if (p.body) p.body.textContent = o.body || '';
    if (p.okBtn) p.okBtn.textContent = o.okLabel || 'Okay';
    if (p.cancelBtn) p.cancelBtn.hidden = true;

    const prevFocus = document.activeElement;
    open(p);
    if (p.okBtn) p.okBtn.focus();

    const close = () => { shut(p, prevFocus, onClick, onKey); resolve(); };
    const onClick = (e) => {
      if (e.target === p.overlay) return close();
      if (e.target.closest('[data-confirm]')) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); return close(); }
      if (e.key === 'Tab') { e.preventDefault(); if (p.okBtn) p.okBtn.focus(); }
    };
    p.overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}
