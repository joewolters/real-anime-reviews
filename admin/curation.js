// admin/curation.js — Curator admin panel (MEGA-RUN Milestone B).
// <!-- author: Code | date: 2026-07-02 -->
// Lists every catalog card with a public watch-STATUS select + a private
// admin-only NOTES textarea. Pure Firestore — works on the deployed site (no
// Mode-1 dependency). Mirrors the auth gate of admin/suggestions.js.
//
// Collections (both keyed by the catalog SLUG = slug(anime.Title)):
//   animeStatus/{slug}  { status, updatedAt }  — PUBLIC read; admin write.
//   curatorNotes/{slug} { note, updatedAt }    — admin-only read AND write.
import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { friendlyError } from '../friendly-errors.js?v=2.1.1';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const $ = (id) => document.getElementById(id);

// Canonical site slug — matches script.js / card-render.js exactly:
// lowercase, every run of non-alphanumerics → '-', trim leading/trailing '-'.
function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Status value → human label. Value '' = clear (delete the animeStatus doc).
const STATUS_OPTIONS = [
  { value: '',           label: '— none —' },
  { value: 'watching',   label: 'Currently watching' },
  { value: 'watchlist',  label: 'On my watchlist' },
  { value: 'on-hold',    label: 'On hold' },
  { value: 'finished',   label: 'Finished' },
  { value: 'rewatching', label: 'Rewatching' },
];
const STATUS_VALUES = new Set(STATUS_OPTIONS.map((o) => o.value).filter(Boolean));

// ---- State -----------------------------------------------------------------
let catalog = [];            // [{ slug, title }]
const rowBySlug = new Map(); // slug → <li> element

function getCatalog() {
  const list = (window.animeData && Array.isArray(window.animeData)) ? window.animeData : [];
  return list.map((a) => ({ title: a.Title || '', slug: slug(a.Title || '') }));
}

// ---- Per-row save feedback -------------------------------------------------
const flashTimers = new WeakMap();
function flash(li, kind, text) {
  const el = li.querySelector('.curation-row-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'curation-row-status ' + (kind === 'error' ? 'is-error' : 'is-saved');
  el.hidden = false;
  const prev = flashTimers.get(el);
  if (prev) clearTimeout(prev);
  // Errors linger longer than the transient "Saved ✓".
  const ms = kind === 'error' ? 6000 : 2200;
  flashTimers.set(el, setTimeout(() => { el.hidden = true; el.textContent = ''; }, ms));
}

// ---- Saves -----------------------------------------------------------------
async function saveStatus(li, itemSlug, value) {
  try {
    if (!value) {
      await deleteDoc(doc(db, 'animeStatus', itemSlug));
    } else {
      await setDoc(doc(db, 'animeStatus', itemSlug), {
        status: value,
        updatedAt: serverTimestamp(),
      });
    }
    flash(li, 'saved', 'Saved ✓');
  } catch (err) {
    console.error('[curation] status save failed for', itemSlug, err);
    flash(li, 'error', friendlyError(err, { kind: 'save' }));
  }
}

async function saveNote(li, itemSlug, rawText) {
  const text = String(rawText || '').trim();
  try {
    if (!text) {
      await deleteDoc(doc(db, 'curatorNotes', itemSlug));
    } else {
      await setDoc(doc(db, 'curatorNotes', itemSlug), {
        note: text,
        updatedAt: serverTimestamp(),
      });
    }
    flash(li, 'saved', 'Saved ✓');
  } catch (err) {
    console.error('[curation] note save failed for', itemSlug, err);
    flash(li, 'error', friendlyError(err, { kind: 'save' }));
  }
}

// ---- Row build -------------------------------------------------------------
function buildRow(entry) {
  const li = document.createElement('li');
  li.className = 'curation-row';
  li.dataset.slug = entry.slug;

  // Title — set via textContent (never innerHTML) so titles from animeData
  // can never inject markup.
  const titleEl = document.createElement('div');
  titleEl.className = 'curation-title';
  titleEl.textContent = entry.title;

  const controls = document.createElement('div');
  controls.className = 'curation-controls';

  // Status select
  const statusField = document.createElement('label');
  statusField.className = 'curation-field';
  const statusLabel = document.createElement('span');
  statusLabel.className = 'curation-field-label';
  statusLabel.textContent = 'Status';
  const select = document.createElement('select');
  select.className = 'curation-status-select';
  for (const opt of STATUS_OPTIONS) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  }
  select.addEventListener('change', () => saveStatus(li, entry.slug, select.value));
  statusField.appendChild(statusLabel);
  statusField.appendChild(select);
  // Milestone F (Part A.7 parity — the panel caught curation was the one admin
  // page the lane missed): the native select becomes the HIDDEN value store;
  // RarBrandSelect paints the visible themed control (the season-reviews
  // pattern). style.display, not [hidden] — the author-display trap has three
  // scalps. If brand-select.js ever fails to load, the native select stays
  // visible as the resilience fallback (same two-site tradeoff as the studio).
  if (window.RarBrandSelect) {
    select.style.display = 'none';
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    const ddHost = document.createElement('span');
    ddHost.className = 'curation-status-host';
    statusField.appendChild(ddHost);
    li._statusCtrl = window.RarBrandSelect({
      host: ddHost, label: 'Status for ' + entry.title, options: STATUS_OPTIONS,
      value: select.value,
      onChange: (v) => { select.value = v; saveStatus(li, entry.slug, v); },
    });
  }

  // Private note textarea
  const noteField = document.createElement('label');
  noteField.className = 'curation-field curation-field--note';
  const noteLabel = document.createElement('span');
  noteLabel.className = 'curation-field-label';
  noteLabel.textContent = 'Private note';
  const textarea = document.createElement('textarea');
  textarea.className = 'curation-note';
  textarea.maxLength = 2000;
  textarea.rows = 2;
  textarea.placeholder = 'Admin-only note…';
  let noteDirty = false;
  textarea.addEventListener('input', () => { noteDirty = true; });
  textarea.addEventListener('blur', () => {
    if (!noteDirty) return;
    noteDirty = false;
    saveNote(li, entry.slug, textarea.value);
  });
  noteField.appendChild(noteLabel);
  noteField.appendChild(textarea);

  controls.appendChild(statusField);
  controls.appendChild(noteField);

  const statusMsg = document.createElement('span');
  statusMsg.className = 'curation-row-status';
  statusMsg.setAttribute('role', 'status');
  statusMsg.hidden = true;

  li.appendChild(titleEl);
  li.appendChild(controls);
  li.appendChild(statusMsg);

  rowBySlug.set(entry.slug, li);
  return li;
}

function renderList() {
  const root = $('curation-list');
  root.innerHTML = '';
  rowBySlug.clear();
  const frag = document.createDocumentFragment();
  catalog.forEach((entry) => frag.appendChild(buildRow(entry)));
  root.appendChild(frag);
}

// ---- Current-state load ----------------------------------------------------
async function loadState() {
  const [statusSnap, notesSnap] = await Promise.all([
    getDocs(collection(db, 'animeStatus')),
    getDocs(collection(db, 'curatorNotes')),
  ]);

  statusSnap.forEach((d) => {
    const li = rowBySlug.get(d.id);
    if (!li) return;
    const value = (d.data() || {}).status || '';
    const sel = li.querySelector('.curation-status-select');
    if (sel && STATUS_VALUES.has(value)) sel.value = value;
    if (li._statusCtrl && STATUS_VALUES.has(value)) li._statusCtrl.value = value;
  });

  notesSnap.forEach((d) => {
    const li = rowBySlug.get(d.id);
    if (!li) return;
    const note = (d.data() || {}).note || '';
    const ta = li.querySelector('.curation-note');
    if (ta) ta.value = note;
  });
}

// ---- Search filter ---------------------------------------------------------
function applyFilter() {
  const q = ($('curation-search').value || '').trim().toLowerCase();
  let shown = 0;
  catalog.forEach((entry) => {
    const li = rowBySlug.get(entry.slug);
    if (!li) return;
    const match = !q || entry.title.toLowerCase().includes(q);
    li.hidden = !match;
    if (match) shown += 1;
  });
  const empty = $('curation-empty');
  if (empty) empty.hidden = shown !== 0;
  const stats = $('curation-stats');
  if (stats) {
    stats.textContent = `${shown} of ${catalog.length} card${catalog.length === 1 ? '' : 's'}`;
    stats.hidden = false;
  }
}

// ---- Boot ------------------------------------------------------------------
async function render() {
  catalog = getCatalog();
  renderList();
  applyFilter();
  $('curation-search').addEventListener('input', applyFilter);
  try {
    await loadState();
  } catch (err) {
    console.error('[curation] failed to load current state', err);
    const errCard = $('curation-error');
    if (errCard) errCard.hidden = false;
  }
}

let rendered = false;
onAuthStateChanged(auth, (user) => {
  const isAdmin = !!(user && user.uid === ADMIN_UID);
  const gate = $('admin-gate');
  const main = $('admin-main');
  if (isAdmin) {
    if (gate) gate.hidden = true;
    if (main) main.hidden = false;
    if (!rendered) { rendered = true; render(); }
  } else {
    // Keep the gate visible with a plain admin-only message (never leak the shell).
    if (main) main.hidden = true;
    if (gate) {
      gate.hidden = false;
      const msg = gate.querySelector('.admin-gate-message');
      if (msg) {
        const spinner = msg.querySelector('.admin-gate-spinner');
        if (spinner) spinner.remove();
        const p = msg.querySelector('p');
        if (p) p.textContent = 'Admin only.';
      }
    }
  }
});
