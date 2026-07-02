// admin/quotes.js — Admin panel for the welcome-door quotes.
// <!-- author: Code | date: 2026-06-06 -->
// v1.8.4 (gate 8 + 8b). Mirrors admin/season-reviews.js's auth gate + server-probe pattern, but
// edits a FLAT list (no per-id files): each quote is { quote, source }. Edit inline, reorder by
// ▲▼ OR by dragging the ⋮⋮ grip, add/delete, live-search, then Save writes the WHOLE array to the
// local mode1 server's PUT /api/quotes, which persists the public /quotes.json the door fetches.
// THE DOM IS THE MODEL — readRows() re-derives the array at Save from live DOM order, so drag,
// ▲▼, and search-by-hide all "just work" with no parallel state. The ✨ ASK chat drawer is mounted.
import { auth } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const $ = (id) => document.getElementById(id);
const DOOR_LEN = 90;   // quotes longer than this wrap awkwardly in the door bubble — flag them

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// ---- State -----------------------------------------------------------------
let serverUp = false;
let chat = null;
let dirty = false;
let draggedRow = null;

// Normalize a quote for duplicate-detection (case + trailing-punctuation insensitive).
function normQuote(s) {
  return String(s || '').replace(/[\r\n]+/g, ' ').trim().toLowerCase().replace(/["'.!?…]+$/, '');
}
function isFiltered() { const s = $('q-search'); return !!(s && s.value.trim()); }
function rowQuote(li) { return li.querySelector('.q-quote').value.replace(/[\r\n]+/g, ' ').trim(); }
function touch(li) { if (li) li.classList.add('q-row--touched'); }   // mark a row changed-since-save

// ---- Server probe ----------------------------------------------------------
async function probeServer() {
  try {
    const r = await fetch('/api/health', { cache: 'no-cache' });
    serverUp = r.ok;
  } catch (_) { serverUp = false; }
  const banner = $('q-server-banner');
  if (banner) banner.hidden = serverUp;
}

// ---- Load ------------------------------------------------------------------
// Read the static /quotes.json — the canonical file the door reads (always works, even with
// mode1 down). Saving writes back through /api/quotes, which rewrites this same file.
async function loadQuotes() {
  try {
    const r = await fetch('/quotes.json', { cache: 'no-cache' });
    const j = r.ok ? await r.json() : null;
    const arr = Array.isArray(j) ? j : (j && Array.isArray(j.quotes) ? j.quotes : null);
    return (arr || [])
      .filter(q => q && typeof q.quote === 'string')
      .map(q => ({ quote: String(q.quote || ''), source: String(q.source || '') }));
  } catch (_) { return []; }
}

// ---- Render ----------------------------------------------------------------
function rowHtml(q) {
  return `<li class="q-row">
    <div class="q-row-handle">
      <span class="q-grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>
      <button type="button" class="q-move q-move-up" aria-label="Move quote up" title="Move up">▲</button>
      <button type="button" class="q-move q-move-down" aria-label="Move quote down" title="Move down">▼</button>
    </div>
    <div class="q-row-fields">
      <textarea class="q-quote" rows="2" placeholder="The quote…" aria-label="Quote">${escapeHtml(q.quote)}</textarea>
      <div class="q-row-foot">
        <input type="text" class="q-source" placeholder="Character — Show" aria-label="Source" value="${escapeHtml(q.source)}">
        <span class="q-len" aria-hidden="true"></span>
      </div>
    </div>
    <button type="button" class="q-del" aria-label="Delete quote" title="Delete">×</button>
  </li>`;
}

function renderList(quotes) {
  const root = $('q-list');
  root.innerHTML = quotes.length
    ? `<ul class="q-rows">${quotes.map(rowHtml).join('')}</ul><p class="q-no-matches" id="q-no-matches" hidden>No quotes match your search.</p>`
    : '<ul class="q-rows"></ul><p class="q-empty">No quotes yet — add one to get started.</p>';
  updateStats();
  applyFilter();
}

// Read the live DOM order/values back into a clean array (drops empty-quote rows). Reads ALL
// .q-row regardless of search visibility, so a filtered Save never loses hidden quotes.
function readRows() {
  return Array.from(document.querySelectorAll('#q-list .q-row')).map(li => ({
    quote: rowQuote(li),
    source: li.querySelector('.q-source').value.trim(),
  })).filter(q => q.quote);
}

// Per-row door-length hint: blank when empty, amber past the door-comfortable length.
function refreshLen(li) {
  const el = li.querySelector('.q-len');
  if (!el) return;
  const len = rowQuote(li).length;
  el.textContent = len ? String(len) : '';
  el.classList.toggle('q-len--over', len > DOOR_LEN);
}

// Count + duplicate scan + per-row length, in one pass. The "N quotes" count + the .q-empty
// toggle stay driven by ALL rows; duplicates are a SEPARATE pass over non-empty normalized text.
function updateStats() {
  const rows = Array.from(document.querySelectorAll('#q-list .q-row'));
  const counts = new Map();
  rows.forEach(li => { const k = normQuote(li.querySelector('.q-quote').value); if (k) counts.set(k, (counts.get(k) || 0) + 1); });
  let dupes = 0;
  rows.forEach(li => {
    const k = normQuote(li.querySelector('.q-quote').value);
    const isDupe = !!(k && counts.get(k) > 1);
    li.classList.toggle('q-dupe', isDupe);
    if (isDupe) dupes++;
    refreshLen(li);
  });
  const n = rows.length;
  $('q-stats').textContent = `${n} quote${n === 1 ? '' : 's'}` + (dupes ? ` · ${dupes} duplicate${dupes === 1 ? '' : 's'}` : '');
  const empty = document.querySelector('#q-list .q-empty');
  if (empty) empty.hidden = n > 0;
}

// Live-narrow search — VISIBILITY ONLY (never removes rows, so readRows still saves them all).
// Reorder (▲▼ + drag) is blocked while a filter is active (hidden neighbors corrupt adjacency).
function applyFilter() {
  const search = $('q-search');
  const term = search ? search.value.trim().toLowerCase() : '';
  const rows = Array.from(document.querySelectorAll('#q-list .q-row'));
  let visible = 0;
  rows.forEach(li => {
    const hay = (li.querySelector('.q-quote').value + ' ' + li.querySelector('.q-source').value).toLowerCase();
    const hide = !!term && !hay.includes(term);
    li.classList.toggle('q-hidden', hide);
    if (!hide) visible++;
  });
  const noMatch = $('q-no-matches');
  if (noMatch) noMatch.hidden = !(term && rows.length && visible === 0);
  $('q-list').classList.toggle('is-filtered', !!term);
}

function markDirty() {
  dirty = true;
  const s = $('q-status');
  if (s) s.textContent = 'Unsaved changes';
}

// ---- Save (whole-array replace) --------------------------------------------
async function saveQuotes() {
  if (!serverUp) { await probeServer(); }   // re-check: the initial probe may not have resolved before a fast click
  if (!serverUp) {
    $('q-status').textContent = 'Saving needs Mode 1 — double-click MODE 1 on the desktop, then try again.';
    return;
  }
  const quotes = readRows();
  $('q-save').disabled = true;
  $('q-status').textContent = 'Saving…';
  try {
    const r = await fetch('/api/quotes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotes }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json().catch(() => ({}));
    dirty = false;
    document.querySelectorAll('.q-row--touched').forEach(li => li.classList.remove('q-row--touched'));
    const n = (j && typeof j.count === 'number') ? j.count : quotes.length;
    $('q-status').textContent = `Saved ✓ (${n} quote${n === 1 ? '' : 's'})`;
  } catch (err) {
    $('q-status').textContent = 'Save failed: ' + err.message;
  } finally {
    $('q-save').disabled = false;
  }
}

// ---- Wire-up ---------------------------------------------------------------
function addRow() {
  const search = $('q-search');
  if (search && search.value) { search.value = ''; applyFilter(); }   // a hidden new row would be confusing
  let ul = document.querySelector('#q-list .q-rows');
  if (!ul) { renderList([]); ul = document.querySelector('#q-list .q-rows'); }
  ul.insertAdjacentHTML('beforeend', rowHtml({ quote: '', source: '' }));
  markDirty();
  updateStats();
  const rows = ul.querySelectorAll('.q-row');
  const last = rows[rows.length - 1];
  if (last) { touch(last); last.querySelector('.q-quote').focus(); }
}

// dragAfterRow: the first not-dragging sibling whose vertical midpoint is below the cursor.
function dragAfterRow(ul, y) {
  const els = Array.prototype.slice.call(ul.querySelectorAll('.q-row:not(.q-dragging)'));
  let best = { offset: -Infinity, el: null };
  els.forEach((el) => {
    const box = el.getBoundingClientRect();
    const off = y - box.top - box.height / 2;
    if (off < 0 && off > best.offset) best = { offset: off, el: el };
  });
  return best.el;
}

function init() {
  loadQuotes().then(renderList);

  $('q-add').addEventListener('click', addRow);
  $('q-save').addEventListener('click', saveQuotes);
  const searchEl = $('q-search');
  if (searchEl) searchEl.addEventListener('input', applyFilter);

  const qlist = $('q-list');

  qlist.addEventListener('click', (e) => {
    const del = e.target.closest('.q-del');
    if (del) { del.closest('.q-row').remove(); markDirty(); updateStats(); applyFilter(); return; }
    if (isFiltered()) return;   // reorder is meaningless while rows are hidden
    const up = e.target.closest('.q-move-up');
    if (up) { const li = up.closest('.q-row'); const prev = li.previousElementSibling; if (prev) { li.parentNode.insertBefore(li, prev); touch(li); markDirty(); } return; }
    const down = e.target.closest('.q-move-down');
    if (down) { const li = down.closest('.q-row'); const next = li.nextElementSibling; if (next) { li.parentNode.insertBefore(next, li); touch(li); markDirty(); } return; }
  });

  qlist.addEventListener('input', (e) => {
    const li = e.target.closest('.q-row');
    if (!li) return;
    if (e.target.closest('.q-quote')) { touch(li); updateStats(); markDirty(); }   // updateStats re-runs dupe + all length hints
    else if (e.target.closest('.q-source')) { touch(li); markDirty(); }
  });

  // ---- Drag reorder via the ⋮⋮ grip (native HTML5 DnD). draggable is armed ONLY between a grip
  // mousedown and the next drag end, so the textarea/input stay text-selectable the rest of the
  // time. Blocked while filtered (the grip is pointer-events:none then; this is belt-and-braces).
  qlist.addEventListener('mousedown', (e) => {
    const grip = e.target.closest('.q-grip');
    if (grip && !isFiltered()) { const li = grip.closest('.q-row'); if (li) li.setAttribute('draggable', 'true'); }
  });
  qlist.addEventListener('dragstart', (e) => {
    const li = e.target.closest('.q-row');
    if (!li || li.getAttribute('draggable') !== 'true') { e.preventDefault(); return; }
    draggedRow = li; li.classList.add('q-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', ''); } catch (_) {}
  });
  qlist.addEventListener('dragover', (e) => {
    if (!draggedRow) return;
    e.preventDefault();
    const ul = draggedRow.parentNode;
    const after = dragAfterRow(ul, e.clientY);
    if (after == null) { if (ul.lastElementChild !== draggedRow) ul.appendChild(draggedRow); }
    else if (after !== draggedRow) { ul.insertBefore(draggedRow, after); }
  });
  qlist.addEventListener('dragend', () => {
    if (draggedRow) { draggedRow.removeAttribute('draggable'); draggedRow.classList.remove('q-dragging'); touch(draggedRow); markDirty(); draggedRow = null; }
  });
  // Disarm draggable after a non-drag grip click so it can never hijack text selection.
  document.addEventListener('mouseup', () => {
    if (!draggedRow) document.querySelectorAll('#q-list .q-row[draggable]').forEach(li => li.removeAttribute('draggable'));
  });

  // ✨ ASK drawer — a brainstorm helper. Fixed session id ('quotes') keeps the summon enabled
  // and its own sessionStorage history (rar:chat:quotes), distinct from the per-anime pages.
  if (window.RarChatDrawer) {
    chat = window.RarChatDrawer.mount({
      getSession: () => ({
        id: 'quotes',
        context: {
          title: 'Welcome-door quotes',
          description: 'Brainstorm short, punchy anime character quotes for the site’s welcome door. Each is a single line with a "Character — Show" source. Keep them iconic and spoiler-light.',
        },
      }),
    });
    if (chat) chat.setAnime();   // enable the ✨ ASK button (fixed session)
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chat && chat.isOpen && chat.isOpen()) { chat.close(); }
  });

  // Guard against losing unsaved inline edits.
  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  probeServer();
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
