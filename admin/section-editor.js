// admin/section-editor.js — shared section-aware Review editor (classic script → window.RarSectionEditor).
// <!-- author: Code | date: 2026-06-04 -->
// v1.8.2 (gate 3b) — replaces the raw-`##` Review textarea on all three admin editors
// (edit page, season-reviews, new-anime) with dedicated, foot-gun-proof fields: an
// Intro block + per-section blocks (title picker of the 9 known sections w/ JP labels,
// or Custom; a body textarea w/ a B/I/link toolbar; delete + ▲/▼ reorder) + a footer
// ("Add section" picker w/ present-disabled, "Add all 9", "Add custom"). It speaks the
// same .load(md)/.value() contract the old textarea did, using markdown.js's pure
// parseReviewSections/compileReviewSections so the stored markdown round-trips losslessly.
(function () {
  'use strict';
  const KNOWN = [
    ['Intro', '序章'], ['Animation', '作画'], ['Story', '物語'], ['Characters', '登場人物'],
    ['Design', '設定'], ['Music', '音楽'], ['Feel', '雰囲気'], ['Extra Thoughts', '余談'], ['Overall', '総評'],
  ];
  const JP_BY_LABEL = {};
  KNOWN.forEach(function (k) { JP_BY_LABEL[k[0].toLowerCase()] = k[1]; });

  // Shared B / I / 🔗 toolbar (intro + every section body — Ctrl/⌘+B/I also work).
  const TOOLBAR =
    '<div class="se-toolbar" role="toolbar" aria-label="Formatting">' +
      '<button type="button" class="se-md-btn" data-md="bold" title="Bold (Ctrl/⌘+B)"><strong>B</strong></button>' +
      '<button type="button" class="se-md-btn" data-md="italic" title="Italic (Ctrl/⌘+I)"><em>I</em></button>' +
      '<button type="button" class="se-md-btn" data-md="link" title="Link">🔗</button>' +
    '</div>';

  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  const knownLabel = (title) => { const t = String(title || '').trim().toLowerCase(); const hit = KNOWN.find(function (k) { return k[0].toLowerCase() === t; }); return hit ? hit[0] : null; };

  // Static preview markup: the same kicker-rail pills (≥2 sections) + rendered body.
  function previewHtml(md) {
    const sections = (window.extractSections ? window.extractSections(md) : []);
    let pills = '';
    if (sections.length >= 2) {
      pills = '<nav class="review-nav" aria-hidden="true">' + sections.map(function (s) {
        const jp = JP_BY_LABEL[String(s.label).toLowerCase()];
        const overall = String(s.label).toLowerCase() === 'overall' ? ' review-pill--overall' : '';
        return '<span class="review-pill' + overall + '"><span class="review-pill-label">' + esc(s.label) + '</span>' +
          (jp ? '<span class="review-pill-jp">' + esc(jp) + '</span>' : '') + '</span>';
      }).join('') + '</nav>';
    }
    const body = (md && md.trim() && window.renderMarkdown) ? window.renderMarkdown(md) : '<p class="md-preview-empty">Formatted preview appears here as you type.</p>';
    return pills + body;
  }

  function titleOptionsHtml(selected) {
    const sel = knownLabel(selected);
    const opts = KNOWN.map(function (k) {
      return '<option value="' + esc(k[0]) + '"' + (sel === k[0] ? ' selected' : '') + '>' + esc(k[0]) + ' ' + esc(k[1]) + '</option>';
    }).join('');
    return opts + '<option value="__custom"' + (sel ? '' : ' selected') + '>Custom…</option>';
  }

  function sectionBlockHtml(title, body) {
    const isCustom = !knownLabel(title);
    return '<div class="se-section">' +
      '<div class="se-section-head">' +
        '<span class="se-grip" aria-hidden="true">⋮⋮</span>' +
        '<select class="se-section-select" aria-label="Section title">' + titleOptionsHtml(title) + '</select>' +
        '<input class="se-section-custom" type="text" placeholder="Section title" value="' + esc(isCustom ? (title || '') : '') + '"' + (isCustom ? '' : ' hidden') + '>' +
        '<span class="se-flex"></span>' +
        '<button type="button" class="se-icon-btn" data-se="up" title="Move up" aria-label="Move section up">▲</button>' +
        '<button type="button" class="se-icon-btn" data-se="down" title="Move down" aria-label="Move section down">▼</button>' +
        '<button type="button" class="se-icon-btn se-del" data-se="del" title="Remove section" aria-label="Remove section">✕</button>' +
      '</div>' +
      TOOLBAR +
      '<textarea class="se-section-body" rows="4" placeholder="Write this section…">' + esc(body || '') + '</textarea>' +
    '</div>';
  }

  function mount(container, opts) {
    opts = opts || {};
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    container.classList.add('section-editor');
    container.innerHTML =
      '<div class="se-intro-wrap">' +
        '<label class="se-label">Intro <span class="se-hint">optional — prose shown above the sections</span></label>' +
        TOOLBAR +
        '<textarea class="se-intro" rows="3" placeholder="Optional opening prose…"></textarea>' +
      '</div>' +
      '<div class="se-sections"></div>' +
      '<div class="se-add-row">' +
        '<div class="se-add-picker">' +
          '<button type="button" class="se-add-btn" data-se="toggle-picker">+ Add section</button>' +
          '<div class="se-add-menu" hidden></div>' +
        '</div>' +
        '<button type="button" class="se-add-all" data-se="add-all">Add all 9</button>' +
      '</div>';
    const introEl = container.querySelector('.se-intro');
    const sectionsEl = container.querySelector('.se-sections');
    const menuEl = container.querySelector('.se-add-menu');

    function currentTitlesLower() {
      const set = new Set();
      sectionsEl.querySelectorAll('.se-section').forEach(function (b) {
        const s = b.querySelector('.se-section-select');
        const t = s.value === '__custom' ? b.querySelector('.se-section-custom').value : s.value;
        if (t) set.add(String(t).trim().toLowerCase());
      });
      return set;
    }
    function renderMenu() {
      const present = currentTitlesLower();
      menuEl.innerHTML = KNOWN.map(function (k) {
        const dis = present.has(k[0].toLowerCase());
        return '<button type="button" class="se-menu-item" data-se="add" data-title="' + esc(k[0]) + '"' + (dis ? ' disabled' : '') + '>' +
          '<span class="se-menu-label">' + esc(k[0]) + '</span><span class="se-menu-jp">' + esc(k[1]) + '</span>' +
          (dis ? '<span class="se-menu-check" aria-hidden="true">✓</span>' : '') + '</button>';
      }).join('') + '<button type="button" class="se-menu-item se-menu-custom" data-se="add-custom">+ Custom section…</button>';
    }
    function closeMenu() { menuEl.hidden = true; }
    function emit() { onChange(); }

    function addSection(title, body, focusCustom) {
      sectionsEl.insertAdjacentHTML('beforeend', sectionBlockHtml(title, body));
      const block = sectionsEl.lastElementChild;
      brandifyTitleSelect(block);
      if (focusCustom) { const ci = block.querySelector('.se-section-custom'); if (ci) ci.focus(); }
      return block;
    }

    // gate 31 — Blake's no-native-selects rule reaches the editors: when
    // brand-select.js is on the page (window.RarBrandSelect), the title
    // <select> hides and a branded button+listbox drives it instead. The
    // native select STAYS in the DOM as the value store — currentTitlesLower()
    // / value() / the delegated change handler all keep reading it, so the
    // .load/.value contract is untouched. A page that forgot the script tag
    // simply keeps the native select (resilience over purity).
    function brandifyTitleSelect(block) {
      if (!window.RarBrandSelect) return;
      const sel = block.querySelector('.se-section-select');
      if (!sel || sel.hidden) return;
      const host = document.createElement('span');
      host.className = 'se-title-dd';
      sel.after(host);
      const opts = KNOWN.map(function (k) { return { value: k[0], label: k[0] + ' ' + k[1] }; });
      opts.push({ value: '__custom', label: 'Custom…' });
      window.RarBrandSelect({
        host: host, label: 'Section title', options: opts, value: sel.value,
        onChange: function (v) {
          sel.value = v;
          // Fire the same bubbling change the native select would have — the
          // container's delegated handler owns the custom-input toggle + emit.
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        },
      });
      sel.hidden = true;   // still the value store; just no longer the face
    }

    // Wrap the selection in a body textarea (B/I/link).
    function wrap(ta, before, after, placeholder) {
      const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
      const sel = val.slice(s, e) || placeholder;
      ta.value = val.slice(0, s) + before + sel + after + val.slice(e);
      const ns = s + before.length;
      ta.setSelectionRange(ns, ns + sel.length);
      ta.focus();
    }

    // ---- events (delegated) ----
    container.addEventListener('input', function (e) {
      if (e.target.closest('.se-intro, .se-section-body, .se-section-custom')) emit();
    });
    container.addEventListener('change', function (e) {
      const sel = e.target.closest('.se-section-select');
      if (sel) {
        const block = sel.closest('.se-section');
        const ci = block.querySelector('.se-section-custom');
        if (sel.value === '__custom') { ci.hidden = false; ci.focus(); }
        else { ci.hidden = true; ci.value = ''; }
        renderMenu(); emit();
      }
    });
    container.addEventListener('click', function (e) {
      const t = e.target.closest('[data-se], .se-md-btn');
      if (!t) { closeMenu(); return; }
      const kind = t.dataset.se;
      const md = t.dataset.md;
      if (md) {
        e.preventDefault();
        const host = t.closest('.se-intro-wrap, .se-section');
        const ta = host && host.querySelector('textarea');
        if (ta) {
          if (md === 'bold') wrap(ta, '**', '**', 'bold text');
          else if (md === 'italic') wrap(ta, '*', '*', 'italic text');
          else if (md === 'link') wrap(ta, '[', '](https://)', 'link text');
          emit();
        }
        return;
      }
      if (kind === 'toggle-picker') { renderMenu(); menuEl.hidden = !menuEl.hidden; return; }
      if (kind === 'add') { if (!t.disabled) { addSection(t.dataset.title, '', false); closeMenu(); renderMenu(); emit(); } return; }
      if (kind === 'add-custom') { addSection('', '', true); closeMenu(); renderMenu(); emit(); return; }
      if (kind === 'add-all') {
        const present = currentTitlesLower();
        KNOWN.forEach(function (k) { if (!present.has(k[0].toLowerCase())) addSection(k[0], '', false); });
        renderMenu(); emit(); return;
      }
      const block = t.closest('.se-section');
      if (!block) return;
      if (kind === 'del') { block.remove(); renderMenu(); emit(); return; }
      if (kind === 'up') { const prev = block.previousElementSibling; if (prev) block.parentNode.insertBefore(block, prev); emit(); return; }
      if (kind === 'down') { const next = block.nextElementSibling; if (next) block.parentNode.insertBefore(next, block); emit(); return; }
    });
    // Close the add-menu on outside click.
    document.addEventListener('click', function (e) { if (!menuEl.hidden && !e.target.closest('.se-add-picker')) menuEl.hidden = true; });

    // Ctrl/⌘ + B / I inside any intro/section body → bold/italic (scoped to the editor).
    container.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const ta = e.target.closest && e.target.closest('.se-intro, .se-section-body');
      if (!ta) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'b') { e.preventDefault(); wrap(ta, '**', '**', 'bold text'); emit(); }
      else if (k === 'i') { e.preventDefault(); wrap(ta, '*', '*', 'italic text'); emit(); }
    });

    // Drag-and-drop reorder via the ⋮⋮ grip (the ▲/▼ buttons still work too).
    let draggedEl = null;
    container.addEventListener('mousedown', function (e) {
      const grip = e.target.closest('.se-grip');
      if (grip) { const b = grip.closest('.se-section'); if (b) b.setAttribute('draggable', 'true'); }
    });
    container.addEventListener('dragstart', function (e) {
      const b = e.target.closest('.se-section');
      if (!b || b.getAttribute('draggable') !== 'true') { e.preventDefault(); return; }
      draggedEl = b; b.classList.add('se-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', ''); } catch (_) {}
    });
    container.addEventListener('dragend', function (e) {
      const b = e.target.closest('.se-section');
      if (b) { b.removeAttribute('draggable'); b.classList.remove('se-dragging'); }
      if (draggedEl) { draggedEl = null; emit(); }
    });
    sectionsEl.addEventListener('dragover', function (e) {
      if (!draggedEl) return;
      e.preventDefault();
      const after = dragAfter(sectionsEl, e.clientY);
      if (after == null) { if (sectionsEl.lastElementChild !== draggedEl) sectionsEl.appendChild(draggedEl); }
      else if (after !== draggedEl) { sectionsEl.insertBefore(draggedEl, after); }
    });
    function dragAfter(cont, y) {
      const els = Array.prototype.slice.call(cont.querySelectorAll('.se-section:not(.se-dragging)'));
      let best = { offset: -Infinity, el: null };
      els.forEach(function (el) {
        const box = el.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > best.offset) best = { offset: offset, el: el };
      });
      return best.el;
    }

    renderMenu();

    // ---- controller (the .load/.value contract) ----
    return {
      load: function (md) {
        const model = window.parseReviewSections ? window.parseReviewSections(md) : { intro: String(md || ''), sections: [] };
        introEl.value = model.intro || '';
        sectionsEl.innerHTML = '';
        (model.sections || []).forEach(function (s) { addSection(s.title, s.body, false); });
        renderMenu();
        emit();
      },
      value: function () {
        const sections = [];
        sectionsEl.querySelectorAll('.se-section').forEach(function (b) {
          const sel = b.querySelector('.se-section-select');
          const title = sel.value === '__custom' ? b.querySelector('.se-section-custom').value.trim() : sel.value;
          sections.push({ title: title, body: b.querySelector('.se-section-body').value });
        });
        return window.compileReviewSections
          ? window.compileReviewSections({ intro: introEl.value, sections: sections })
          : introEl.value;
      },
      focus: function () { introEl.focus(); },
    };
  }

  window.RarSectionEditor = { mount: mount, previewHtml: previewHtml };
})();
