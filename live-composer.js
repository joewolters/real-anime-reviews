// live-composer.js — the LIVE-IN-BOX user composer (classic script → window.RarLive).
// <!-- author: Code | date: 2026-06-09 -->
// v1.10.0 mega-batch Part B. Blake: "get rid of the preview window entirely …
// and have the review update live in their typing box." The USER composers
// (comment · comment-reply · Tavern thread · Tavern reply · review · the
// review-discussion box) become true rich editors: bold/italic/code/links/
// spoilers/[img:N] chips render live AS YOU TYPE, in the input. Admin/anime
// composers are untouched (they never used this layer).
//
// ARCHITECTURE — the contenteditable div is a VIEW; the original TEXTAREA stays
// in the DOM (hidden) as the MODEL + submit source:
//   • every editor change serializes to markdown -> textarea.value + a real
//     'input' event — so every existing counter / enable-disable / cap check /
//     post handler keeps working with ZERO changes;
//   • external writes to the textarea (the post-success `value=''` + dispatch
//     pattern, drafts) re-render the editor — same event, loop-guarded;
//   • readOnly/disabled mirror via the attribute MutationObserver (the same
//     trick the old toolbar used), so auth/lock states keep working.
//
// XSS POSTURE (the review lens hits this hard — design for it):
//   • The editor NEVER innerHTML's user content. All nodes are built with
//     createElement/textContent. Paste is TEXT/PLAIN ONLY (HTML clipboards are
//     flattened to text, then live-formatted by the same completion engine).
//   • What gets STORED is the serialized markdown (a whitelist DOM walk that
//     emits text + markers only) — and every downstream render of that text is
//     markdown.js, which escapes FIRST. So even a hostile DOM node smuggled
//     into the editor (extension, devtools) degrades to literal text the
//     moment it serializes; it cannot reach another user as markup.
//   • The serializer drops every element it doesn't know and every attribute
//     except a validated https?:// link href.
(function (root) {
  'use strict';

  const ZWS = '​'; // caret-escape hatch after atom/format nodes; stripped on serialize

  // ---------- the inline completion patterns (typed markers -> live nodes) ----------
  // Order matters: spoiler before italic (|| vs *), bold before italic.
  const PATTERNS = [
    { rx: /\|\|([^|\n]+)\|\|/, make: (m) => spoilerPill(m[1]) },
    { rx: /\[img:([1-4])\]/, make: (m) => imgChip(m[1]) },
    { rx: /\*\*([^*\n]+)\*\*/, make: (m) => wrapEl('strong', m[1]) },
    { rx: /__([^_\n]+)__/, make: (m) => wrapEl('strong', m[1]) },
    { rx: /(^|[^*])\*([^*\n]+)\*(?!\*)/, make: (m) => wrapEl('em', m[2]), lead: 1 },
    { rx: /`([^`\n]+)`/, make: (m) => wrapEl('code', m[1]) },
    { rx: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/, make: (m) => linkEl(m[1], m[2]) },
  ];

  function wrapEl(tag, text) {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
  }
  function spoilerPill(text) {
    const el = document.createElement('span');
    el.className = 'rar-live-spoiler';
    el.textContent = text;
    return el;
  }
  function imgChip(n) {
    const el = document.createElement('span');
    el.className = 'rar-live-img';
    el.setAttribute('data-img-token', String(n));
    el.contentEditable = 'false';            // an atom: deletes as one unit
    el.textContent = '🖼 image ' + n;
    return el;
  }
  function linkEl(text, href) {
    const el = document.createElement('a');
    el.textContent = text;
    // href is regex-constrained to https?:// already; clicks are disabled in
    // the editor via CSS pointer-events (it's an input, not a page).
    el.setAttribute('href', href);
    el.setAttribute('rel', 'noopener noreferrer');
    return el;
  }

  // Transform ONE text node in place: replace the FIRST completed marker with
  // its live node. Returns the inserted element (caret goes after it) or null.
  function transformTextNode(node) {
    if (!node || node.nodeType !== 3) return null;
    const text = node.data;
    for (const p of PATTERNS) {
      const m = p.rx.exec(text);
      if (!m) continue;
      const lead = p.lead ? m[1] : '';
      const start = m.index + lead.length;
      const after = node.splitText(start);
      after.data = after.data.slice(m[0].length - lead.length);
      const el = p.make(m);
      after.parentNode.insertBefore(el, after);
      // a ZWS landing pad so the caret can sit AFTER the new node and typing
      // continues as plain text (the classic escape-the-bold trick)
      if (!after.data.length) after.data = ZWS;
      return el;
    }
    return null;
  }

  // Render one model LINE into a line <div> (used for full re-renders + paste).
  function renderLine(lineText) {
    const div = document.createElement('div');
    div.className = 'rar-live-line';
    if (lineText === '') { div.appendChild(document.createElement('br')); return div; }
    div.appendChild(document.createTextNode(lineText));
    // run the completion engine to a fixed point (text -> rich nodes)
    let guard = 0;
    let changed = true;
    while (changed && guard++ < 64) {
      changed = false;
      const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
      let t;
      while ((t = walker.nextNode())) {
        // never transform inside an already-rich node except spoilers (whose
        // inner text may carry bold etc. — markdown.js does the same)
        const host = t.parentNode;
        const hostTag = host && host.tagName;
        if (hostTag === 'A' || hostTag === 'CODE') continue;
        if (transformTextNode(t)) { changed = true; break; }
      }
    }
    classifyLine(div);
    return div;
  }

  // Block-mode line classing (review): "## " headers + "- " list lines get a
  // styled treatment with the markers left visible-but-dimmed (Obsidian-lite —
  // honest, lossless, zero caret drama).
  function classifyLine(div) {
    const t = div.textContent.replace(ZWS, '');
    div.classList.remove('is-h1', 'is-h2', 'is-h3', 'is-li');
    const h = /^(#{1,3})\s/.exec(t);
    if (h) div.classList.add('is-h' + h[1].length);
    else if (/^[-*]\s/.test(t)) div.classList.add('is-li');
  }

  // ---------- serialize: editor DOM -> markdown (the WHITELIST walk) ----------
  function serializeNode(n) {
    if (n.nodeType === 3) return n.data.split(ZWS).join('');
    if (n.nodeType !== 1) return '';
    const tag = n.tagName;
    if (tag === 'BR') return '\n';
    const inner = serializeInline(n);
    if (tag === 'B' || tag === 'STRONG') return inner ? '**' + inner + '**' : '';
    if (tag === 'I' || tag === 'EM') return inner ? '*' + inner + '*' : '';
    if (tag === 'CODE') return inner ? '`' + inner + '`' : '';
    if (tag === 'A') {
      const href = n.getAttribute('href') || '';
      return (inner && /^https?:\/\/[^\s)]+$/.test(href)) ? '[' + inner + '](' + href + ')' : inner;
    }
    if (n.classList && n.classList.contains('rar-live-spoiler')) return inner ? '||' + inner + '||' : '';
    if (n.classList && n.classList.contains('rar-live-img')) {
      const tok = n.getAttribute('data-img-token');
      return /^[1-4]$/.test(tok || '') ? '[img:' + tok + ']' : '';
    }
    return inner;   // unknown element -> its text only (the whitelist fence)
  }
  function serializeInline(node) {
    let out = '';
    node.childNodes.forEach((n) => { out += serializeNode(n); });
    return out;
  }
  function serialize(editor) {
    // top-level children are USUALLY line <div>s, but a paste/typing into an
    // empty editor leaves bare text + inline elements at the root — those
    // buffer into the current line WITH their markers (a top-level <strong>
    // must serialize as **…**, not lose its markup; the paste spec pins this).
    const lines = [];
    let buf = null;   // null = no open inline run
    const flush = () => { if (buf !== null) { lines.push(buf); buf = null; } };
    editor.childNodes.forEach((n) => {
      const isEl = n.nodeType === 1;
      if (isEl && (n.tagName === 'DIV' || n.tagName === 'P')) {
        flush();
        lines.push(serializeInline(n));
        return;
      }
      if (isEl && n.tagName === 'BR') { flush(); if (buf === null) lines.push(''); return; }
      buf = (buf === null ? '' : buf) + serializeNode(n);
    });
    flush();
    return lines.join('\n').replace(/\n$/, '');
  }

  // place the caret immediately after a node (with the ZWS pad if present)
  function caretAfter(node) {
    const sel = root.getSelection && root.getSelection();
    if (!sel) return;
    const r = document.createRange();
    const next = node.nextSibling;
    if (next && next.nodeType === 3) r.setStart(next, Math.min(1, next.data.length));
    else { r.setStartAfter(node); }
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function caretToEnd(editor) {
    const sel = root.getSelection && root.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');

  // ---------- mount ----------
  // RarLive.mount(textarea, opts):
  //   opts.mode    'inline' | 'block'   (block = the review body: header/list lines)
  //   opts.submit  'enter' | 'mod'
  //   opts.onSubmit()
  //   opts.onImage()        -> shows the 📷 toolbar button (the picker's insert flow)
  //   opts.placeholder      -> shown when empty (falls back to the textarea's)
  // Returns { editorEl, toolbar, insertText(t), rerender(), focus() } or null.
  function mount(textarea, opts) {
    if (!textarea || textarea.dataset.rarLive === '1') return null;
    opts = opts || {};
    const parent = textarea.parentNode;
    if (!parent || !('contentEditable' in document.documentElement)) return null;
    textarea.dataset.rarLive = '1';

    const MOD = IS_MAC ? '⌘' : 'Ctrl';
    const submitMode = opts.submit === 'mod' ? 'mod' : 'enter';
    const onSubmit = typeof opts.onSubmit === 'function' ? opts.onSubmit : function () {};

    // toolbar — B / I / 👁 only (LAST CALL A5, Blake's calls): the 🔗 button is
    // DEAD ("there shouldn't be a button for links — people should just copy
    // paste"; bare URLs now auto-link at render), and the toolbar 📷 is DEAD
    // (it doubled the picker strip's "Add an image" — ONE image affordance).
    const toolbar = document.createElement('div');
    toolbar.className = 'composer-toolbar rar-live-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Formatting');
    toolbar.innerHTML =
      '<button type="button" class="ct-btn" data-md="bold" title="Bold (' + MOD + '+B)"><strong>B</strong></button>' +
      '<button type="button" class="ct-btn" data-md="italic" title="Italic (' + MOD + '+I)"><em>I</em></button>' +
      '<button type="button" class="ct-btn" data-md="spoiler" title="Spoiler — hidden until clicked">👁</button>';

    const editor = document.createElement('div');
    editor.className = 'rar-live' + (opts.mode === 'block' ? ' rar-live--block' : '');
    editor.contentEditable = 'true';
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('data-placeholder', opts.placeholder || textarea.getAttribute('placeholder') || '');
    if (textarea.getAttribute('aria-label')) editor.setAttribute('aria-label', textarea.getAttribute('aria-label'));

    parent.insertBefore(toolbar, textarea);
    parent.insertBefore(editor, textarea);
    textarea.classList.add('rar-live-model');   // display:none (the hidden model)

    let syncing = false; // editor -> model in flight (loop guard)

    function syncModel() {
      syncing = true;
      textarea.value = serialize(editor);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      syncing = false;
    }
    function rerender() {
      editor.textContent = '';
      const model = textarea.value || '';
      model.split('\n').forEach((line) => editor.appendChild(renderLine(line)));
      if (!model) editor.innerHTML = '';   // truly empty -> placeholder shows
    }

    // typing: transform completed markers around the caret, then sync
    editor.addEventListener('input', () => {
      const sel = root.getSelection && root.getSelection();
      const anchor = sel && sel.anchorNode;
      if (anchor && anchor.nodeType === 3 && editor.contains(anchor)) {
        const host = anchor.parentNode && anchor.parentNode.tagName;
        if (host !== 'A' && host !== 'CODE') {
          const el = transformTextNode(anchor);
          if (el) caretAfter(el);
        }
        // block-mode line classing follows the caret's line
        let line = anchor;
        while (line && line.parentNode !== editor) line = line.parentNode;
        if (line && line.nodeType === 1) classifyLine(line);
      }
      syncModel();
    });

    // PASTE: text/plain ONLY (the XSS fence) — flattened, then live-formatted.
    editor.addEventListener('paste', (e) => {
      const files = Array.from((e.clipboardData && e.clipboardData.files) || []);
      if (files.length) return;            // the picker's listener owns image paste
      e.preventDefault();
      const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      if (!text) return;
      insertTextAtCaret(text);
    });
    editor.addEventListener('drop', (e) => {
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      if (files.length) return;            // the picker's listener owns image drops
      e.preventDefault();
      const text = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '';
      if (text) insertTextAtCaret(text);
    });

    function insertTextAtCaret(text) {
      const sel = root.getSelection && root.getSelection();
      if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) { appendText(text); return; }
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const lines = String(text).split('\n');
      let lastNode = null;
      lines.forEach((ln, i) => {
        if (i > 0) { const br = document.createElement('br'); r.insertNode(br); r.setStartAfter(br); lastNode = br; }
        if (ln) {
          const frag = renderLine(ln);
          // unwrap the line div — we're inserting INTO a line
          const nodes = Array.from(frag.childNodes).filter((n) => n.tagName !== 'BR' || ln === '');
          nodes.forEach((n) => { r.insertNode(n); r.setStartAfter(n); lastNode = n; });
        }
      });
      if (lastNode) { r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
      syncModel();
    }
    function appendText(text) {
      const div = renderLine(text);
      editor.appendChild(div);
      caretToEnd(editor);
      syncModel();
    }

    // toolbar actions
    function applyAction(kind) {
      if (editor.contentEditable !== 'true') return;
      editor.focus();
      if (kind === 'bold') document.execCommand('bold');
      else if (kind === 'italic') document.execCommand('italic');
      // (the 'link' action died with its button — LAST CALL A5; bare pasted
      // URLs auto-link at render, and hand-typed [text](url) still completes)
      else if (kind === 'spoiler') {
        const sel = root.getSelection && root.getSelection();
        const selected = sel && sel.rangeCount ? sel.toString() : '';
        if (selected && editor.contains(sel.anchorNode)) {
          const pill = spoilerPill(selected);
          const r = sel.getRangeAt(0);
          r.deleteContents(); r.insertNode(pill); caretAfter(pill);
        } else insertTextAtCaret('||spoiler||');
      }
      syncModel();
    }
    toolbar.addEventListener('click', (e) => {
      const b = e.target.closest('.ct-btn');
      if (!b) return;
      e.preventDefault();
      applyAction(b.dataset.md);
    });

    editor.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = (e.key || '').toLowerCase();
      if (mod && k === 'b') { e.preventDefault(); applyAction('bold'); return; }
      if (mod && k === 'i') { e.preventDefault(); applyAction('italic'); return; }
      if (e.key === 'Enter') {
        if (submitMode === 'mod') { if (mod) { e.preventDefault(); onSubmit(); } }
        else if (!e.shiftKey && !mod) { e.preventDefault(); onSubmit(); }
      }
    });

    // external model writes (the post-success clear, drafts) re-render the view
    textarea.addEventListener('input', () => { if (!syncing) rerender(); });

    // readOnly/disabled mirror (auth + thread locks flip the textarea's attrs)
    function refreshEnabled() {
      const off = textarea.readOnly || textarea.disabled;
      editor.contentEditable = off ? 'false' : 'true';
      editor.classList.toggle('is-off', off);
      toolbar.hidden = off;
      editor.setAttribute('data-placeholder', off
        ? (textarea.getAttribute('placeholder') || '')
        : (opts.placeholder || textarea.getAttribute('placeholder') || ''));
    }
    try {
      const mo = new MutationObserver(() => {
        // composers also swap the PLACEHOLDER on lock — mirror it live
        refreshEnabled();
      });
      mo.observe(textarea, { attributes: true, attributeFilter: ['readonly', 'disabled', 'placeholder'] });
    } catch (_) {}
    refreshEnabled();
    rerender();

    return {
      editorEl: editor,
      toolbar: toolbar,
      insertText: insertTextAtCaret,
      rerender: rerender,
      focus: () => editor.focus(),
    };
  }

  root.RarLive = { mount: mount, _serialize: serialize, _renderLine: renderLine };
})(typeof window !== 'undefined' ? window : this);
