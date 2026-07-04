// admin/season-reviews.js — Admin panel for writing per-season reviews.
// <!-- author: Code | date: 2026-06-04 -->
// v1.7.4 (gate 3, Surface 1). Mirrors admin/suggestions.js's auth gate. Lists
// every catalog entry + its watched-but-not-primary AniListIds (accordion;
// AniList cover/title/format/year fetched lazily per group via window.franchiseFetch).
// Each row → a branded markdown editor (textarea + live preview). Save/Delete hit
// the local mode1 server's /api/season-review CRUD (writes the .md + regens index.json).
import { auth } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// ---- Markdown preview — single source (window.renderMarkdown from markdown.js) --
function renderMarkdown(md) {
  if (!md || !md.trim()) return '<p class="sr-preview-empty">Nothing to preview yet.</p>';
  return (window.renderMarkdown ? window.renderMarkdown(md) : escapeHtml(md));
}

// ---- State -----------------------------------------------------------------
let reviewIndex = new Set();          // ids with a written review
let serverUp = false;                 // mode1 reachable?
let editorId = null;                  // id currently in the editor
let srEditor = null;                  // v1.8.2 — section-aware Review editor (window.RarSectionEditor)
let srFilter = 'all';                 // gate 31 — list filter (was the native #sr-filter's .value)

function getCatalog() {
  const list = (window.animeData && Array.isArray(window.animeData)) ? window.animeData : [];
  return list.map(a => ({
    title: a.Title || '',
    primary: Number(a.AniListId) || null,
    image: a.image || '',
    watched: (Array.isArray(a.WatchedAniListIds) ? a.WatchedAniListIds.map(Number) : []),
  }));
}
// All watched-but-not-primary ids across the catalog (the reviewable set).
function reviewableIds(catalog) {
  const ids = [];
  catalog.forEach(c => c.watched.forEach(id => { if (id && id !== c.primary) ids.push(id); }));
  return Array.from(new Set(ids));
}

// ---- Server probe ----------------------------------------------------------
async function probeServer() {
  try {
    const r = await fetch('/api/health', { cache: 'no-cache' });
    serverUp = r.ok;
  } catch (_) { serverUp = false; }
  const banner = $('sr-server-banner');
  if (banner) banner.hidden = serverUp;
}

async function loadIndex() {
  try {
    const r = await fetch('/season-reviews/index.json', { cache: 'no-cache' });
    const j = r.ok ? await r.json() : null;
    reviewIndex = new Set(((j && j.ids) || []).map(Number));
  } catch (_) { reviewIndex = new Set(); }
}

// ---- List render -----------------------------------------------------------
function renderStats(catalog) {
  const all = reviewableIds(catalog);
  const done = all.filter(id => reviewIndex.has(id)).length;
  $('sr-stats').textContent = `${done} of ${all.length} season reviews written`;
}

function statusPill(id) {
  return reviewIndex.has(Number(id))
    ? '<span class="sr-pill sr-pill--done">Reviewed</span>'
    : '<span class="sr-pill sr-pill--empty">Empty</span>';
}

function renderList(catalog) {
  const filter = srFilter;                 // all | reviewed | empty (gate 31 — brand-select state)
  const root = $('sr-list');
  root.innerHTML = '';
  catalog.forEach((c, idx) => {
    let watched = c.watched.filter(id => id && id !== c.primary);
    if (filter === 'reviewed') watched = watched.filter(id => reviewIndex.has(id));
    if (filter === 'empty') watched = watched.filter(id => !reviewIndex.has(id));
    if (!watched.length) return;
    const group = document.createElement('section');
    group.className = 'sr-group';
    group.innerHTML =
      '<button type="button" class="sr-group-head" aria-expanded="false">' +
        (c.image ? '<img class="sr-group-cover" src="../assets/' + escapeHtml(c.image) + '" alt="" loading="lazy">' : '<span class="sr-group-cover sr-group-cover--ph"></span>') +
        '<span class="sr-group-title">' + escapeHtml(c.title) + '</span>' +
        '<span class="sr-group-count">' + watched.length + ' season' + (watched.length === 1 ? '' : 's') + '</span>' +
        '<span class="sr-group-chevron" aria-hidden="true">▸</span>' +
      '</button>' +
      '<ul class="sr-rows" hidden>' +
        watched.map(id =>
          '<li class="sr-row" data-id="' + id + '">' +
            '<span class="sr-row-cover sr-row-cover--ph" data-cover></span>' +
            '<span class="sr-row-title" data-title>AniList #' + id + '</span>' +
            '<span class="sr-row-meta" data-meta></span>' +
            statusPill(id) +
            '<button type="button" class="sr-row-edit">' + (reviewIndex.has(id) ? 'Edit' : 'Write') + ' →</button>' +
          '</li>'
        ).join('') +
      '</ul>';
    root.appendChild(group);
  });
  if (!root.children.length) {
    root.innerHTML = '<p class="sr-empty">No entries match this filter.</p>';
  }
}

// Lazily enrich a group's rows with AniList cover/title/meta (batched).
async function enrichGroup(ul) {
  if (ul.dataset.enriched) return;
  ul.dataset.enriched = '1';
  const ids = Array.from(ul.querySelectorAll('.sr-row')).map(li => Number(li.dataset.id));
  if (!window.franchiseFetch || !ids.length) return;
  let results = [];
  try { results = await window.franchiseFetch.fetchBatch(ids); } catch (_) { return; }
  results.forEach((r, i) => {
    if (!r || !r.node) return;
    const li = ul.querySelector('.sr-row[data-id="' + ids[i] + '"]');
    if (!li) return;
    const n = r.node;
    const title = (n.title && (n.title.english || n.title.romaji)) || ('AniList #' + ids[i]);
    const cover = (n.coverImage && n.coverImage.large) || '';
    const meta = [n.format, n.seasonYear].filter(Boolean).join(' · ');
    const tEl = li.querySelector('[data-title]'); if (tEl) tEl.textContent = title;
    const mEl = li.querySelector('[data-meta]'); if (mEl) mEl.textContent = meta;
    const cEl = li.querySelector('[data-cover]');
    if (cEl && cover) { cEl.outerHTML = '<img class="sr-row-cover" src="' + escapeHtml(cover) + '" alt="" loading="lazy">'; }
  });
}

// ---- Editor ----------------------------------------------------------------
function openEditor(id, presetTitle) {
  editorId = Number(id);
  $('sr-editor-id').textContent = '#' + editorId;
  $('sr-editor-title').value = presetTitle || '';
  $('sr-editor-rating').value = '';
  if (srEditor) srEditor.load('');
  $('sr-editor-status').textContent = '';
  $('sr-editor-delete').hidden = true;
  updatePreview();
  $('sr-editor').hidden = false;
  // Load existing content (GET) — needs the local server.
  fetch('/api/season-review/' + editorId).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.exists) return;
    $('sr-editor-title').value = j.title || presetTitle || '';
    $('sr-editor-rating').value = j.rating || '';
    if (srEditor) srEditor.load(j.body || '');
    $('sr-editor-delete').hidden = false;
    updatePreview();
  }).catch(() => {});
  if (srEditor) srEditor.focus();
}
function closeEditor() { $('sr-editor').hidden = true; editorId = null; }
function reviewMarkdown() { return srEditor ? srEditor.value() : ''; }
function updatePreview() {
  $('sr-editor-preview').innerHTML = window.RarSectionEditor
    ? window.RarSectionEditor.previewHtml(reviewMarkdown())
    : renderMarkdown(reviewMarkdown());
}

async function saveReview() {
  if (!editorId) return;
  const body = reviewMarkdown().trim();
  if (!body) { $('sr-editor-status').textContent = 'Write something first.'; return; }
  if (!serverUp) { $('sr-editor-status').textContent = 'Saving needs Mode 1 — double-click MODE 1 on the desktop, then try again.'; return; }
  $('sr-editor-save').disabled = true;
  $('sr-editor-status').textContent = 'Saving…';
  try {
    const r = await fetch('/api/season-review/' + editorId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: $('sr-editor-title').value.trim(), rating: $('sr-editor-rating').value.trim(), body }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    reviewIndex.add(editorId);
    $('sr-editor-status').textContent = 'Saved ✓';
    await refresh();
    setTimeout(closeEditor, 600);
  } catch (err) {
    $('sr-editor-status').textContent = 'Save failed: ' + err.message;
  } finally { $('sr-editor-save').disabled = false; }
}

async function deleteReview() {
  if (!editorId || !serverUp) return;
  $('sr-editor-status').textContent = 'Deleting…';
  try {
    await fetch('/api/season-review/' + editorId, { method: 'DELETE' });
    reviewIndex.delete(editorId);
    await refresh();
    closeEditor();
  } catch (err) { $('sr-editor-status').textContent = 'Delete failed: ' + err.message; }
}

// ---- Wire-up ---------------------------------------------------------------
let _catalog = [];
async function refresh() {
  await loadIndex();
  renderStats(_catalog);
  renderList(_catalog);
}

function init() {
  _catalog = getCatalog();

  $('sr-list').addEventListener('click', (e) => {
    const head = e.target.closest('.sr-group-head');
    if (head) {
      const ul = head.nextElementSibling;
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!open));
      ul.hidden = open;
      if (!open) enrichGroup(ul);
      return;
    }
    const edit = e.target.closest('.sr-row-edit');
    if (edit) {
      const li = edit.closest('.sr-row');
      const titleEl = li.querySelector('[data-title]');
      openEditor(Number(li.dataset.id), (titleEl && titleEl.textContent.indexOf('AniList #') === -1) ? titleEl.textContent : '');
    }
  });

  // gate 31 — branded filter dropdown (no native <select> in admin). Same
  // RarBrandSelect the editors use (brand-select.js, classic script); if the
  // script tag ever goes missing, fall back to a native select wired the same
  // way so the filter never dies with it.
  const filterHost = $('sr-filter-host');
  const FILTER_OPTS = [
    { value: 'all', label: 'All seasons' },
    { value: 'empty', label: 'Empty only' },
    { value: 'reviewed', label: 'Reviewed only' },
  ];
  const onFilterChange = (v) => { srFilter = v; renderList(_catalog); };
  if (window.RarBrandSelect) {
    window.RarBrandSelect({ host: filterHost, label: 'Show', options: FILTER_OPTS, value: srFilter, onChange: onFilterChange });
  } else {
    const sel = document.createElement('select');
    sel.className = 'sr-filter';
    FILTER_OPTS.forEach((o) => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; sel.appendChild(op); });
    sel.addEventListener('change', () => onFilterChange(sel.value));
    filterHost.appendChild(sel);
  }
  if (window.RarSectionEditor) srEditor = window.RarSectionEditor.mount($('sr-editor-mount'), { onChange: updatePreview });
  $('sr-editor-save').addEventListener('click', saveReview);
  $('sr-editor-delete').addEventListener('click', deleteReview);
  $('sr-editor-cancel').addEventListener('click', closeEditor);
  $('sr-editor').addEventListener('click', (e) => { if (e.target === $('sr-editor')) closeEditor(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('sr-editor').hidden) closeEditor(); });

  Promise.all([probeServer(), loadIndex()]).then(() => {
    renderStats(_catalog);
    renderList(_catalog);
    // Deep-link: /admin/season-reviews.html?id=NNN (e.g. the secondary modal's
    // "✎ Edit review" link) opens that editor + auto-fills the AniList title.
    try {
      const qid = new URLSearchParams(location.search).get('id');
      if (qid && /^\d+$/.test(qid)) openDeepLinkEditor(Number(qid));
    } catch (_) {}
  });
}

// Open the editor for a deep-linked id and prefill its title from AniList
// (cached → instant if warm). Doesn't block opening; saved-review title (from the
// GET inside openEditor) wins if one exists; AniList only fills an empty field.
function openDeepLinkEditor(id) {
  openEditor(id, '');
  const ff = window.franchiseFetch;
  if (!ff || !ff.fetchMediaDetail) return;
  ff.fetchMediaDetail(id).then(d => {
    if (editorId !== id) return;                       // editor moved on
    const t = d && d.title ? (d.title.english || d.title.romaji || '') : '';
    if (t && !$('sr-editor-title').value.trim()) $('sr-editor-title').value = t;
    else if (!t && !$('sr-editor-title').value.trim()) $('sr-editor-status').textContent = 'Couldn’t auto-fill the title — type it in.';
  }).catch(() => {
    if (editorId === id && !$('sr-editor-title').value.trim()) $('sr-editor-status').textContent = 'Couldn’t auto-fill the title — type it in.';
  });
}

// ---- Auth gate -------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== ADMIN_UID) {
    location.href = '../index.html';
    return;
  }
  $('admin-gate').hidden = true;
  $('admin-main').hidden = false;
  init();
});
