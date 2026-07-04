// admin/modal-scroll-lock.js — lock page scroll while any admin overlay is open.
// <!-- author: Code | date: 2026-06-04 -->
// v1.8.1 (gate 4b) — Blake's smoke: the page scrolled behind the edit-page modals.
// The main site locks scroll in script.js's updateScrollLock(); the admin pages are
// separate documents with no script.js, so this tiny shared helper does the same:
// it watches the known overlay/drawer elements and, while any is visible, sets
// `documentElement.overflow:hidden` (+ an `admin-modal-open` class for optional CSS).
// Purely additive — observes visibility attributes, never changes page logic.
(function () {
  // Full-screen overlays + the side drawer, across every admin page. A selector that
  // matches nothing on a given page is simply a no-op there.
  var SELECTORS = [
    '.edit-modal',            // edit: save/ship confirm + ship progress
    '.edit-preview-overlay',  // edit: live-preview iframe overlay
    '#chat-drawer',           // shared ✨ ASK drawer (edit + new-anime + studio)
    '.sr-editor-overlay',     // season-reviews: editor overlay
    '.confirm-overlay',       // suggestions: confirm modal (+ any reuse)
    '#studio-editor'          // studio: the notes editor sheet (Milestone F panel
                              // fix — closing the ✨ drawer must not unlock the
                              // page while the editor still covers it)
  ];

  function isVisible(el) {
    if (!el || el.hasAttribute('hidden')) return false;
    // The drawer is present-but-offscreen until it gets the `open` class.
    if (el.id === 'chat-drawer') return el.classList.contains('open');
    // Defensive: respect an inline display:none too.
    if (el.style && el.style.display === 'none') return false;
    return true;
  }

  function apply() {
    var els = document.querySelectorAll(SELECTORS.join(','));
    var open = false;
    for (var i = 0; i < els.length; i++) { if (isVisible(els[i])) { open = true; break; } }
    document.documentElement.style.overflow = open ? 'hidden' : '';
    document.documentElement.classList.toggle('admin-modal-open', open);
  }

  function start() {
    var els = document.querySelectorAll(SELECTORS.join(','));
    if (els.length) {
      var obs = new MutationObserver(apply);
      for (var i = 0; i < els.length; i++) {
        obs.observe(els[i], { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
      }
    }
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
