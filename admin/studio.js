// admin/studio.js — THE CURATOR STUDIO (MEGA-RUN Milestone F).
// <!-- author: Code | date: 2026-07-03 -->
// Blake's vision: track ANY anime (not just the 44), keep detailed private
// notes in the SAME 9 sections a review uses, an ✨ ASK helper, and a
// "Publish this one" that pre-fills Add Anime so a set of notes becomes a real
// catalog review without retyping. Cloud-first: everything lives in Firestore
// (admin-only), an anime enters Excel only at publish.
//
// Collections (key = catalog SLUG for one of the 44, else 'al:<aniListId>'):
//   animeStatus/{key}   { status, updatedAt, title? }  — PUBLIC read; admin write.
//                        (title rides only on al: keys so the Den line can name them)
//   curatorNotes/{key}  { note?, notesMd?, seasons?, title?, updatedAt } — admin-only.
import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { friendlyError } from '../friendly-errors.js?v=2.3.3';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const $ = (id) => document.getElementById(id);

// canonical site slug — identical to script.js / card-render.js / curation.js
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
// Panel fix (MED): textContent→innerHTML escapes & < > but NOT quotes — inside
// a src="…" attribute a stray " breaks out (the gate-18 lesson, suggestions.js).
function esc(s) {
  const d = document.createElement('div'); d.textContent = s == null ? '' : String(s);
  return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Panel fix (MED): AniList cover URLs are third-party data — scheme-gate them
// like every other cover sink (script.js hubSafeCover).
function safeCover(u) { return /^https:\/\//.test(String(u || '')) ? u : ''; }

const STATUS_OPTIONS = [
  { value: '',           label: '— none —' },
  { value: 'watching',   label: 'Currently watching' },
  { value: 'watchlist',  label: 'On my watchlist' },
  { value: 'on-hold',    label: 'On hold' },
  { value: 'finished',   label: 'Finished' },
  { value: 'rewatching', label: 'Rewatching' },
];
const STATUS_VALUES = new Set(STATUS_OPTIONS.map((o) => o.value).filter(Boolean));

// ---- catalog helpers -------------------------------------------------------
function catalog() { return (window.animeData && Array.isArray(window.animeData)) ? window.animeData : []; }
function catalogBySlug(s) { return catalog().find((a) => a && a.Title && slug(a.Title) === s) || null; }
// a search hit that IS one of the 44 (by AniListId) → track under the catalog slug
function catalogByAniListId(id) {
  const n = Number(id);
  return catalog().find((a) => a && (Number(a.AniListId) === n
    || (Array.isArray(a.WatchedAniListIds) && a.WatchedAniListIds.map(Number).includes(n)))) || null;
}

// ---- editor state ----------------------------------------------------------
let sectionEditor = null;   // RarSectionEditor controller
let chat = null;            // RarChatDrawer controller
let statusSelect = null;    // RarBrandSelect controller
let current = null;         // { key, aniListId, title, coverImage, romaji, genres, year, format, description, statusVal, loaded, loadedNotesMd }
let editorHideTimer = null; // closeEditor's 240ms slide-out hide
let editorInvoker = null;   // the element that opened the editor (focus return)

// =============================================================================
// SEARCH — any anime
// =============================================================================
let searchAbort = null;
let searchTimer = null;

function wireSearch() {
  const input = $('studio-search');
  const clear = $('studio-search-clear');
  if (!input) return;
  input.addEventListener('input', () => {
    clear.hidden = !input.value;
    if (searchTimer) clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { $('studio-results').innerHTML = ''; return; }
    searchTimer = setTimeout(() => runSearch(q), 320);
  });
  clear.addEventListener('click', () => {
    input.value = ''; clear.hidden = true; $('studio-results').innerHTML = ''; input.focus();
  });
}

async function runSearch(q) {
  const out = $('studio-results');
  out.innerHTML = '<li class="studio-result-skel">Searching…</li>';
  if (searchAbort) { try { searchAbort.abort(); } catch (_) {} }
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  searchAbort = ctrl;
  let list = [];
  try {
    list = await window.franchiseFetch.searchMediaList(q, 12, ctrl ? ctrl.signal : undefined);
  } catch (_) { list = []; }
  if (ctrl && ctrl !== searchAbort) return;   // a newer search superseded us
  renderResults(Array.isArray(list) ? list : []);
}

function titleOf(m) {
  return (m && m.title && (m.title.english || m.title.romaji || m.title.native)) || 'Untitled';
}
function coverOf(m) {
  const c = m && m.coverImage;
  return (c && (c.large || c.medium || c.extraLarge)) || '';
}

function renderResults(list) {
  const out = $('studio-results');
  if (!list.length) { out.innerHTML = '<li class="studio-result-empty">No matches. Try another title.</li>'; return; }
  out.innerHTML = '';
  list.forEach((m) => {
    const li = document.createElement('li');
    li.className = 'studio-result';
    const inCat = catalogByAniListId(m.id);
    const cov = safeCover(coverOf(m));
    li.innerHTML =
      (cov ? `<img class="studio-result-cover" src="${esc(cov)}" alt="" loading="lazy">` : '<span class="studio-result-cover studio-result-nocover" aria-hidden="true">🎞</span>') +
      `<span class="studio-result-meta"><span class="studio-result-title">${esc(titleOf(m))}</span>` +
      `<span class="studio-result-sub">${esc(m.seasonYear || m.format || '')}${inCat ? ' · already in your catalog' : ''}</span></span>` +
      `<button type="button" class="studio-result-track">Track</button>`;
    li.querySelector('.studio-result-track').addEventListener('click', () => openEditorForMedia(m));
    out.appendChild(li);
  });
}

// =============================================================================
// THE EDITOR
// =============================================================================
function keyForMedia(m) {
  const cat = catalogByAniListId(m.id);
  return cat ? slug(cat.Title) : ('al:' + Number(m.id));
}

function openEditorForMedia(m) {
  const cat = catalogByAniListId(m.id);
  openEditor({
    key: keyForMedia(m),
    aniListId: Number(m.id) || null,
    title: cat ? cat.Title : titleOf(m),
    coverImage: safeCover(coverOf(m)) || (cat ? '../assets/' + cat.image : ''),
    romaji: (m.title && m.title.romaji) || '',
    genres: Array.isArray(m.genres) ? m.genres : [],
    year: m.seasonYear || null,
    format: m.format || '',
    description: m.description || '',
    inCatalog: !!cat,
  });
}

// open from a tracked row — resolve context from the catalog (al: keys keep
// the title we stored)
function openEditorForTracked(key, storedTitle) {
  const cat = key.indexOf('al:') === 0 ? null : catalogBySlug(key);
  openEditor({
    key,
    aniListId: key.indexOf('al:') === 0 ? Number(key.slice(3)) : (cat ? Number(cat.AniListId) || null : null),
    title: cat ? cat.Title : (storedTitle || key),
    coverImage: cat ? '../assets/' + cat.image : '',
    romaji: cat ? (cat.TitleRomaji || '') : '',
    genres: cat && cat.Genre ? String(cat.Genre).split(/[/,]+/).map((g) => g.trim()) : [],
    year: null, format: '', description: cat ? (cat.Description || '') : '',
    inCatalog: !!cat,
  });
}

async function openEditor(ctx) {
  current = ctx;
  ctx.loaded = false;   // panel fix (HIGH): Save stays dead until the docs load
  const sheet = $('studio-editor');
  // panel fix (LOW): a close within the last 240ms left a hide-timer armed —
  // cancel it or the freshly opened sheet vanishes mid-open.
  if (editorHideTimer) { clearTimeout(editorHideTimer); editorHideTimer = null; }
  editorInvoker = document.activeElement;   // return focus here on close
  $('studio-ed-title').textContent = ctx.title;
  $('studio-ed-sub').textContent = ctx.inCatalog ? 'In your catalog · one of the 44' : 'Tracked from the wider world';
  const cover = $('studio-ed-cover');
  if (ctx.coverImage) { cover.src = ctx.coverImage; cover.hidden = false; } else { cover.hidden = true; }
  $('studio-ed-status').textContent = '';

  // status brandSelect (never a native <select>)
  mountStatus('');
  // clear the editors before load
  if (sectionEditor) sectionEditor.load('');
  $('studio-quicknote').value = '';
  $('studio-seasons').innerHTML = '';

  sheet.hidden = false;   // modal-scroll-lock.js observes this — it owns the page lock
  requestAnimationFrame(() => {
    sheet.classList.add('is-open');
    const x = sheet.querySelector('.studio-ed-x');
    if (x) x.focus();   // aria-modal dialogs receive focus on open
  });
  document.addEventListener('keydown', onEditorKey, true);

  // publish is catalog-agnostic but only meaningful for something with an id;
  // both actions stay DISABLED until this anime's docs actually loaded — a Save
  // over an unloaded editor would non-merge-write emptiness over real notes.
  $('studio-publish-btn').hidden = !ctx.aniListId;
  $('studio-publish-btn').disabled = true;
  $('studio-save-btn').disabled = true;
  // the in-editor ✨ Ask (the header summon sits UNDER the editor scrim — this
  // is the reachable one mid-note; same availability rule as the drawer session)
  const askBtn = $('studio-ed-ask');
  if (askBtn) askBtn.disabled = !ctx.aniListId;

  // hand the anime to the ✨ ASK drawer
  if (chat) chat.setAnime();

  // load existing docs
  try {
    const [stSnap, ntSnap] = await Promise.all([
      getDoc(doc(db, 'animeStatus', ctx.key)),
      getDoc(doc(db, 'curatorNotes', ctx.key)),
    ]);
    // panel fix (MED): identity guard — a stale load must never populate (or
    // be saved under) a different anime's editor (the runSearch-abort pattern).
    if (current !== ctx) return;
    if (stSnap.exists()) {
      const v = stSnap.data() || {};
      if (STATUS_VALUES.has(v.status)) { current.statusVal = v.status; mountStatus(v.status); }
    }
    ctx.loadedNotesMd = '';
    if (ntSnap.exists()) {
      const n = ntSnap.data() || {};
      if (typeof n.notesMd === 'string') {
        ctx.loadedNotesMd = n.notesMd;   // carried so a dead section editor can't blank it
        if (sectionEditor) sectionEditor.load(n.notesMd);
      }
      if (typeof n.note === 'string') $('studio-quicknote').value = n.note;
      if (n.seasons && typeof n.seasons === 'object') {
        Object.keys(n.seasons).forEach((label) => addSeasonRow(label, n.seasons[label]));
      }
    }
    ctx.loaded = true;
    $('studio-save-btn').disabled = false;
    $('studio-publish-btn').disabled = false;
  } catch (err) {
    if (current !== ctx) return;
    // Save/Publish stay disabled — saving over a failed load would DESTROY the
    // saved notes (the panel's HIGH). Honest copy, not the generic save error.
    setEdStatus('error', "Couldn't load this anime's saved notes — Save is off to protect them. Close and reopen to retry.");
  }
}

function mountStatus(value) {
  const host = $('studio-status-host');
  host.innerHTML = '';
  if (window.RarBrandSelect) {
    statusSelect = window.RarBrandSelect({
      host, label: 'Status', options: STATUS_OPTIONS,
      value: STATUS_VALUES.has(value) ? value : '',
      onChange: (v) => { if (current) current.statusVal = v || ''; },
    });
  } else {
    // resilient fallback (brand-select.js failed to load) — still no native menu
    // is ideal, but a labelled native select beats a broken control.
    const sel = document.createElement('select');
    sel.className = 'studio-status-fallback';
    STATUS_OPTIONS.forEach((o) => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; sel.appendChild(op); });
    sel.value = STATUS_VALUES.has(value) ? value : '';
    sel.addEventListener('change', () => { if (current) current.statusVal = sel.value; });
    host.appendChild(sel);
  }
  if (current) current.statusVal = STATUS_VALUES.has(value) ? value : '';
}

// ---- per-season rows -------------------------------------------------------
function addSeasonRow(label, body) {
  const wrap = document.createElement('div');
  wrap.className = 'studio-season-row';
  wrap.innerHTML =
    '<input type="text" class="studio-season-label" maxlength="60" placeholder="Season (e.g. Season 2)">' +
    '<textarea class="studio-season-body" maxlength="4000" rows="2" placeholder="Thoughts on this season…"></textarea>' +
    '<button type="button" class="studio-season-x" aria-label="Remove season note">×</button>';
  wrap.querySelector('.studio-season-label').value = label || '';
  wrap.querySelector('.studio-season-body').value = body || '';
  wrap.querySelector('.studio-season-x').addEventListener('click', () => wrap.remove());
  $('studio-seasons').appendChild(wrap);
}
function collectSeasons() {
  const seasons = {};
  $('studio-seasons').querySelectorAll('.studio-season-row').forEach((r) => {
    const label = r.querySelector('.studio-season-label').value.trim().slice(0, 60);
    const body = r.querySelector('.studio-season-body').value.trim();
    if (label && body) seasons[label] = body.slice(0, 4000);
  });
  return seasons;
}

// ---- close -----------------------------------------------------------------
function closeEditor() {
  const sheet = $('studio-editor');
  if (sheet.hidden) return;
  sheet.classList.remove('is-open');
  document.removeEventListener('keydown', onEditorKey, true);
  editorHideTimer = setTimeout(() => { sheet.hidden = true; editorHideTimer = null; }, 240);
  // (the page scroll lock is modal-scroll-lock.js's — it watches #studio-editor
  // and #chat-drawer together, so closing one never unlocks under the other)
  current = null;
  if (editorInvoker && document.contains(editorInvoker) && editorInvoker.focus) editorInvoker.focus();
  editorInvoker = null;
}
function onEditorKey(e) {
  if (e.key !== 'Escape') return;
  // Esc layers: first close the ✨ ASK drawer, the next closes the editor
  if (chat && chat.isOpen && chat.isOpen()) { e.stopPropagation(); chat.close(); return; }
  e.stopPropagation();
  closeEditor();
}

// ---- save ------------------------------------------------------------------
function setEdStatus(kind, text) {
  const el = $('studio-ed-status');
  el.textContent = text;
  el.className = 'studio-ed-savestatus ' + (kind === 'error' ? 'is-error' : 'is-saved');
}

async function saveEditor() {
  // the loaded guard is the HIGH fix: never write (or delete) over an editor
  // whose docs never arrived — that path destroyed notes behind a "Saved ✓".
  if (!current || !current.loaded) return;
  const key = current.key;
  const isAl = key.indexOf('al:') === 0;
  const statusVal = current.statusVal || '';
  // a dead section editor must not read as "no notes" — carry the loaded copy
  const notesMd = sectionEditor ? sectionEditor.value().trim() : (current.loadedNotesMd || '');
  const quick = $('studio-quicknote').value.trim();
  const seasons = collectSeasons();
  $('studio-save-btn').disabled = true;
  try {
    // animeStatus — public. al: keys carry the title so the Den line can name them.
    if (!statusVal) {
      await deleteDoc(doc(db, 'animeStatus', key));
    } else {
      const st = { status: statusVal, updatedAt: serverTimestamp() };
      if (isAl && current.title) st.title = current.title.slice(0, 120);
      await setDoc(doc(db, 'animeStatus', key), st);
    }
    // curatorNotes — private. Only write the fields that carry content (hasOnly
    // in the rules bounces stray keys; we keep the doc lean).
    const noteDoc = { updatedAt: serverTimestamp() };
    if (quick) noteDoc.note = quick.slice(0, 2000);
    if (notesMd) noteDoc.notesMd = notesMd.slice(0, 40000);
    if (Object.keys(seasons).length) noteDoc.seasons = seasons;
    if (isAl && current.title) noteDoc.title = current.title.slice(0, 120);
    const hasContent = noteDoc.note || noteDoc.notesMd || noteDoc.seasons;
    if (hasContent) await setDoc(doc(db, 'curatorNotes', key), noteDoc);
    else await deleteDoc(doc(db, 'curatorNotes', key));
    if (current) current.loadedNotesMd = notesMd;   // the saved copy is the loaded copy now
    setEdStatus('saved', 'Saved ✓');
    loadTracking();   // refresh the tracked list (a new status may appear)
  } catch (err) {
    setEdStatus('error', friendlyError(err, { kind: 'save' }));
  } finally {
    $('studio-save-btn').disabled = false;
  }
}

// ---- publish → pre-fill Add Anime ------------------------------------------
async function publishEditor() {
  if (!current || !current.loaded || !current.aniListId) return;
  // save first so nothing is lost, then hand the notes to Add Anime via
  // localStorage (they can't ride a URL) + the ?anilistId=&fromStudio=1 route.
  await saveEditor();
  const notesMd = sectionEditor ? sectionEditor.value() : '';
  try {
    localStorage.setItem('rar:studio-draft', JSON.stringify({
      anilistId: current.aniListId, notesMd, title: current.title,
    }));
  } catch (_) { /* full storage → the fetch prefill still carries the metadata */ }
  window.location.href = 'new-anime.html?anilistId=' + encodeURIComponent(current.aniListId) + '&fromStudio=1';
}

// =============================================================================
// NOW TRACKING list
// =============================================================================
async function loadTracking() {
  const listEl = $('studio-tracking-list');
  const emptyEl = $('studio-tracking-empty');
  try {
    const [stSnap, ntSnap] = await Promise.all([
      getDocs(collection(db, 'animeStatus')),
      getDocs(collection(db, 'curatorNotes')),
    ]);
    const rows = new Map();   // key -> { key, status, title, hasNotes }
    stSnap.forEach((d) => {
      const v = d.data() || {};
      if (!STATUS_VALUES.has(v.status)) return;
      rows.set(d.id, { key: d.id, status: v.status, title: v.title || '', hasNotes: false });
    });
    ntSnap.forEach((d) => {
      const v = d.data() || {};
      const existing = rows.get(d.id) || { key: d.id, status: '', title: v.title || '', hasNotes: false };
      existing.hasNotes = true;
      if (!existing.title && v.title) existing.title = v.title;
      rows.set(d.id, existing);
    });
    renderTracking(Array.from(rows.values()));
    emptyEl.hidden = rows.size > 0;
  } catch (err) {
    $('studio-error').hidden = false;
    console.error('[studio] tracking load failed', err);
  }
}

const STATUS_LABEL = { watching: 'Watching', watchlist: 'Watchlist', 'on-hold': 'On hold', finished: 'Finished', rewatching: 'Rewatching' };

function renderTracking(rows) {
  const listEl = $('studio-tracking-list');
  listEl.innerHTML = '';
  rows.sort((a, b) => (a.title || a.key).localeCompare(b.title || b.key));
  rows.forEach((r) => {
    const cat = r.key.indexOf('al:') === 0 ? null : catalogBySlug(r.key);
    const title = cat ? cat.Title : (r.title || r.key);
    const li = document.createElement('li');
    li.className = 'studio-track-row';
    li.innerHTML =
      `<span class="studio-track-title">${esc(title)}</span>` +
      (r.status ? `<span class="studio-track-status status-${esc(r.status)}">${esc(STATUS_LABEL[r.status] || r.status)}</span>` : '') +
      (r.hasNotes ? '<span class="studio-track-notes" title="Has notes" aria-label="Has notes">✎</span>' : '') +
      `<button type="button" class="studio-track-edit">Edit</button>`;
    li.querySelector('.studio-track-edit').addEventListener('click', () => openEditorForTracked(r.key, r.title));
    listEl.appendChild(li);
  });
}

// =============================================================================
// ✨ ASK drawer
// =============================================================================
function mountChat() {
  if (!window.RarChatDrawer) return;
  chat = window.RarChatDrawer.mount({
    endpoint: '/api/chat',
    getSession: () => {
      if (!current || !current.aniListId) return null;
      return {
        id: String(current.aniListId),
        context: {
          title: current.title, romaji: current.romaji, year: current.year,
          format: current.format, genres: current.genres, description: current.description,
        },
      };
    },
  });
}

// =============================================================================
// WIRE + GATE
// =============================================================================
function wire() {
  wireSearch();
  const edAsk = $('studio-ed-ask');
  if (edAsk) edAsk.addEventListener('click', () => {
    const b = $('chat-summon-btn');
    if (b && !b.disabled) b.click();   // same controller path as the header summon
  });
  $('studio-season-add').addEventListener('click', () => addSeasonRow('', ''));
  $('studio-save-btn').addEventListener('click', saveEditor);
  $('studio-publish-btn').addEventListener('click', publishEditor);
  $('studio-editor').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeEditor(); });
  const mountEl = $('studio-sections-mount');
  if (window.RarSectionEditor && mountEl) sectionEditor = window.RarSectionEditor.mount(mountEl, { onChange: () => {} });
  mountChat();
}

onAuthStateChanged(auth, (user) => {
  const gate = $('admin-gate');
  const main = $('admin-main');
  if (user && user.uid === ADMIN_UID) {
    gate.hidden = true;
    main.hidden = false;
    wire();
    loadTracking();
  } else {
    gate.innerHTML = '<div class="admin-gate-message"><p>Admin only.</p></div>';
    main.hidden = true;
  }
});
