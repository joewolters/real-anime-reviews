// composer-toolbar.js — shared visitor composer enhancer (classic script → window.RarComposer).
// <!-- author: Code | date: 2026-06-08 -->
// v1.9.1 "go all out" composer redesign. Turns a plain comment / reply / thread /
// review textarea into a premium brand composer:
//   • a B / I / 🔗 formatting toolbar (the v1.8.x purple-cosmos vocabulary)
//   • Ctrl/⌘+B and Ctrl/⌘+I shortcuts
//   • a LIVE styled preview that renders the SAME markdown the post will use — so
//     "the style is different" is unmistakable while you type
//   • a submit keybinding: Enter posts short composers (Shift+Enter = newline); the
//     long-form review composer posts on Ctrl/⌘+Enter (Enter = newline) so a
//     multi-paragraph review is never truncated
//   • a discoverable hint line spelling the bindings out
// XSS posture is inherited verbatim from markdown.js: the preview ONLY ever uses
// window.renderMarkdown / window.renderMarkdownInline, both of which HTML-escape the
// input BEFORE applying markdown, so no raw HTML can ever survive into the preview.
(function (root) {
  'use strict';

  const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
  const MOD = IS_MAC ? '⌘' : 'Ctrl';

  // markdown.js's exact escape, replicated locally so the inline preview's
  // "did formatting actually change anything?" check is precise (same entity set).
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Wrap the textarea selection (B / I / link). Lifted from admin/section-editor.js
  // (8 lines, zero deps) so the visitor composer shares the same wrap behavior without
  // reaching into the admin-only module.
  function wrap(ta, before, after, placeholder) {
    const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
    const sel = val.slice(s, e) || placeholder;
    ta.value = val.slice(0, s) + before + sel + after + val.slice(e);
    const ns = s + before.length;
    ta.setSelectionRange(ns, ns + sel.length);
    ta.focus();
  }

  function fireInput(ta) {
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const TOOLBAR_HTML =
    '<div class="composer-toolbar" role="toolbar" aria-label="Formatting">' +
      '<button type="button" class="ct-btn" data-md="bold" title="Bold (' + MOD + '+B)"><strong>B</strong></button>' +
      '<button type="button" class="ct-btn" data-md="italic" title="Italic (' + MOD + '+I)"><em>I</em></button>' +
      '<button type="button" class="ct-btn" data-md="link" title="Link">🔗</button>' +
      '<button type="button" class="ct-btn" data-md="spoiler" title="Spoiler — hidden until clicked">👁</button>' +
    '</div>';

  // enhance(textarea, opts)
  //   opts.inline   — true for comments/replies/threads (renderMarkdownInline, no headers),
  //                   false for the review composer (full renderMarkdown w/ headers + lists).
  //   opts.submit   — 'enter' → Enter posts, Shift+Enter = newline (short composers)
  //                 — 'mod'   → Ctrl/⌘+Enter posts, Enter = newline (the long review composer)
  //   opts.onSubmit — invoked when the submit binding fires (routes to the existing post path).
  // Returns { updatePreview, toolbar, preview } or null if it couldn't attach.
  function enhance(textarea, opts) {
    if (!textarea || textarea.dataset.rarComposer === '1') return null;
    opts = opts || {};
    const inline = !!opts.inline;
    const submitMode = opts.submit === 'mod' ? 'mod' : 'enter';
    const onSubmit = typeof opts.onSubmit === 'function' ? opts.onSubmit : function () {};
    const parent = textarea.parentNode;
    if (!parent) return null;
    textarea.dataset.rarComposer = '1';

    const render = inline
      ? (root.renderMarkdownInline || esc)
      : (root.renderMarkdown || esc);

    // toolbar (above the textarea)
    const holder = document.createElement('div');
    holder.innerHTML = TOOLBAR_HTML;
    const toolbar = holder.firstElementChild;
    parent.insertBefore(toolbar, textarea);

    // live styled preview (below the textarea)
    const preview = document.createElement('div');
    preview.className = 'composer-preview' + (inline ? ' is-inline' : '');
    preview.hidden = true;
    preview.setAttribute('aria-live', 'off');
    parent.insertBefore(preview, textarea.nextSibling);

    // v1.9.1b — ONLY the long-form review composer keeps a hint (Ctrl/⌘+Enter is
    // non-obvious); comments/replies/threads drop it entirely (Enter-to-post is
    // intuitive there and the line just read as clutter). Premium styled keycaps.
    let hintEl = null;
    if (submitMode === 'mod') {
      hintEl = document.createElement('p');
      hintEl.className = 'composer-keyhint';
      hintEl.innerHTML =
        '<span class="ck-keys"><kbd class="ck-kbd">' + MOD + '</kbd><span class="ck-plus">+</span><kbd class="ck-kbd">Enter</kbd></span>' +
        '<span class="ck-label">to publish</span>';
      parent.insertBefore(hintEl, preview.nextSibling);
    }

    const blocked = () => textarea.readOnly || textarea.disabled;

    function applyWrap(kind) {
      if (blocked()) return;
      if (kind === 'bold') wrap(textarea, '**', '**', 'bold text');
      else if (kind === 'italic') wrap(textarea, '*', '*', 'italic text');
      else if (kind === 'link') wrap(textarea, '[', '](https://)', 'link text');
      else if (kind === 'spoiler') wrap(textarea, '||', '||', 'spoiler');   // gate 11
      fireInput(textarea);
    }

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.ct-btn');
      if (!btn) return;
      e.preventDefault();
      applyWrap(btn.dataset.md);
    });

    textarea.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = (e.key || '').toLowerCase();
      if (mod && k === 'b') { e.preventDefault(); applyWrap('bold'); return; }
      if (mod && k === 'i') { e.preventDefault(); applyWrap('italic'); return; }
      if (e.key === 'Enter') {
        if (submitMode === 'mod') {
          if (mod) { e.preventDefault(); onSubmit(); }          // Ctrl/⌘+Enter posts; plain Enter = newline
        } else if (!e.shiftKey && !mod) {
          e.preventDefault(); onSubmit();                        // Enter posts; Shift+Enter = newline
        }
      }
    });

    function updatePreview() {
      // Never preview a read-only composer (signed out / locked) — keep it blank + hidden.
      if (textarea.readOnly || textarea.disabled) { preview.hidden = true; preview.innerHTML = ''; return; }
      const text = textarea.value;
      const html = render(text);
      // Reviews (block): show whenever there's prose. Comments (inline): only surface
      // the preview once markdown actually changes something, so plain one-liners stay clean.
      const show = inline
        ? (text.trim().length > 0 && html !== esc(text))
        : (text.trim().length > 0);
      if (show) { preview.innerHTML = html; preview.hidden = false; }
      else { preview.hidden = true; preview.innerHTML = ''; }
    }
    textarea.addEventListener('input', updatePreview);

    // v1.9.1b — hide the toolbar (+ preview + hint) whenever the composer is read-only:
    // signed out, a locked thread, or a review already posted — so only the textarea +
    // the existing "Sign in"/locked affordance shows. Driven off the `readonly` attribute
    // the composers already toggle on auth change, so it's fully self-contained (no
    // wiring into their sync functions).
    function refreshEnabled() {
      const off = textarea.readOnly || textarea.disabled;
      toolbar.hidden = off;
      if (hintEl) hintEl.hidden = off;
      updatePreview();   // now also hides the preview when read-only
    }
    try {
      const mo = new MutationObserver(refreshEnabled);
      mo.observe(textarea, { attributes: true, attributeFilter: ['readonly', 'disabled'] });
    } catch (_) {}
    refreshEnabled();

    return { updatePreview: updatePreview, refreshEnabled: refreshEnabled, toolbar: toolbar, preview: preview };
  }

  root.RarComposer = { enhance: enhance, wrap: wrap };
})(typeof window !== 'undefined' ? window : this);
