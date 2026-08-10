// admin/catalog.js — Cloud Admin catalog editor (cloud migration phase 3).
// <!-- author: Code | date: 2026-08-09 -->
// ---------------------------------------------------------------------------
// Reads and writes `catalog/{animeId}` in Firestore — no Mode-1 server, no
// Excel, so it works from any device including Blake's phone.
//
// THE HAND-OFF (Blake's decision: "phone and desktop should be asynchronous"):
// every keystroke autosaves a DRAFT to catalog/{animeId}/draft/current, tagged
// with which device wrote it. Open the same anime elsewhere and the draft is
// offered, never silently applied. Nothing reaches the live site until the
// separate publish step (scripts/catalog-publish.js).
//
// All logic lives in catalog-model.js (pure + unit-tested); this file is glue.
// ---------------------------------------------------------------------------
import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
  query, orderBy, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { friendlyError, showNotice } from '../friendly-errors.js?v=2.0.0';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const $ = (id) => document.getElementById(id);
const M = window.RarCatalogModel;

const FIELDS = ['Review', 'Description', 'Rating', 'Seasons', 'Genre', 'Studio', 'Tags', 'Platforms', 'Trailer', 'Top10Rank'];

// ---- device identity (for the phone <-> desktop hand-off) ------------------
function deviceId() {
  let id = null;
  try { id = localStorage.getItem('rar:deviceId'); } catch (_) {}
  if (!id) {
    id = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem('rar:deviceId', id); } catch (_) {}
  }
  return id;
}
const DEVICE_ID = deviceId();
const DEVICE_LABEL = M.deviceLabelFrom(navigator.userAgent, window.innerWidth);

// ---- state -----------------------------------------------------------------
let catalog = [];        // [{ animeId, Title, ... }] ordered
let current = null;      // the doc being edited
let currentDraft = null; // the stored draft, if any
let saveTimer = null;
let dirty = false;

// ---- list ------------------------------------------------------------------
function renderList(filter) {
  const list = $('cat-list');
  const q = String(filter || '').trim().toLowerCase();
  const rows = catalog.filter((a) => !q || String(a.Title || '').toLowerCase().includes(q));
  list.innerHTML = '';
  for (const a of rows) {
    const li = document.createElement('li');
    li.className = 'catalog-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'catalog-row-btn';
    btn.innerHTML =
      `<span class="catalog-row-title"></span>` +
      `<span class="catalog-row-meta"></span>`;
    btn.querySelector('.catalog-row-title').textContent = a.Title || a.animeId;
    btn.querySelector('.catalog-row-meta').textContent =
      `${a.Rating || '—'} · ${String(a.Review || '').length} chars`;
    btn.addEventListener('click', () => openEditor(a.animeId));
    li.appendChild(btn);
    list.appendChild(li);
  }
  $('cat-empty').hidden = rows.length > 0;
}

// ---- editor ----------------------------------------------------------------
function setView(which) {
  $('cat-list-view').hidden = which !== 'list';
  $('cat-edit-view').hidden = which !== 'edit';
}

function readForm() {
  const out = {};
  for (const f of FIELDS) {
    const el = $('f-' + f);
    if (el) out[f] = el.value;
  }
  return out;
}

function fillForm(src) {
  for (const f of FIELDS) {
    const el = $('f-' + f);
    if (!el) continue;
    const v = src ? src[f] : '';
    el.value = Array.isArray(v) ? v.join(', ') : (v == null ? '' : v);
  }
  updateCount();
}

function updateCount() {
  const el = $('f-Review-count');
  if (el) el.textContent = `${$('f-Review').value.length} characters`;
}

function setSaveState(text, kind) {
  const el = $('cat-savestate');
  el.textContent = text;
  el.className = 'catalog-savestate' + (kind ? ' is-' + kind : '');
}

function showErrors(errs) {
  const ul = $('cat-errors');
  ul.innerHTML = '';
  if (!errs.length) { ul.hidden = true; return; }
  for (const e of errs) {
    const li = document.createElement('li');
    li.textContent = e;
    ul.appendChild(li);
  }
  ul.hidden = false;
}

async function openEditor(animeId) {
  current = catalog.find((a) => a.animeId === animeId) || null;
  if (!current) return;
  currentDraft = null;
  dirty = false;
  $('cat-edit-title').textContent = current.Title || animeId;
  fillForm(current);
  showErrors([]);
  setSaveState('Up to date');
  $('cat-save').disabled = true;
  $('cat-draft-banner').hidden = true;
  setView('edit');
  window.scrollTo(0, 0);

  // Is there a draft waiting — possibly from another device?
  try {
    const snap = await getDoc(doc(db, 'catalog', animeId, 'draft', 'current'));
    if (!snap.exists()) return;
    currentDraft = snap.data();
    const state = M.draftState(currentDraft, current, DEVICE_ID);
    if (state.kind === 'other') {
      $('cat-draft-text').textContent = M.describeDraft(state);
      $('cat-draft-banner').hidden = false;
    } else if (state.kind === 'mine') {
      fillForm(Object.assign({}, current, currentDraft.fields));
      markDirty();
      $('cat-draft-text').textContent = M.describeDraft(state);
      $('cat-draft-banner').hidden = false;
      $('cat-draft-use').hidden = true;
    } else if (state.kind === 'stale') {
      deleteDoc(doc(db, 'catalog', animeId, 'draft', 'current')).catch(() => {});
    }
  } catch (err) {
    // A missing draft must never block editing.
    console.warn('draft read failed', err);
  }
}

function markDirty() {
  const changed = M.diffFields(current, readForm());
  dirty = changed.length > 0;
  $('cat-save').disabled = !dirty;
  if (dirty) setSaveState('Saving draft…', 'pending');
  else setSaveState('Up to date');
  return changed;
}

async function saveDraft() {
  if (!current || !dirty) return;
  try {
    await setDoc(doc(db, 'catalog', current.animeId, 'draft', 'current'), {
      fields: M.normalizeFields(readForm()),
      deviceId: DEVICE_ID,
      deviceLabel: DEVICE_LABEL,
      updatedAt: serverTimestamp(),
    });
    setSaveState('Draft saved', 'ok');
  } catch (err) {
    setSaveState(friendlyError(err, { kind: 'save' }), 'error');
  }
}

function onInput() {
  updateCount();
  markDirty();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 900);
}

async function saveToCatalog() {
  if (!current) return;
  const fields = M.normalizeFields(readForm());
  const errs = M.validate(Object.assign({}, current, fields));
  showErrors(errs);
  if (errs.length) { setSaveState('Not saved', 'error'); return; }

  const changed = M.diffFields(current, fields);
  if (!changed.length) { setSaveState('Up to date'); return; }

  $('cat-save').disabled = true;
  setSaveState('Saving…', 'pending');
  try {
    const before = {}; const after = {};
    for (const k of changed) { before[k] = current[k] === undefined ? null : current[k]; after[k] = fields[k]; }

    const patch = {};
    for (const k of changed) patch[k] = fields[k];
    patch.updatedBy = 'blake';
    patch.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'catalog', current.animeId), patch);

    // Append-only history — what replaces "open Excel and see ground truth".
    await setDoc(doc(collection(db, 'catalog', current.animeId, 'revisions')), {
      at: serverTimestamp(), by: 'blake', device: DEVICE_LABEL,
      fields: { before, after },
    });

    Object.assign(current, fields);
    await deleteDoc(doc(db, 'catalog', current.animeId, 'draft', 'current')).catch(() => {});
    currentDraft = null;
    dirty = false;
    $('cat-draft-banner').hidden = true;
    setSaveState('Saved ✓', 'ok');
    showNotice(`Saved “${current.Title}”. Publish when you're ready for it to go live.`);
    renderList($('cat-search').value);
  } catch (err) {
    setSaveState(friendlyError(err, { kind: 'save' }), 'error');
    $('cat-save').disabled = false;
  }
}

// ---- load ------------------------------------------------------------------
async function load() {
  try {
    const snap = await getDocs(query(collection(db, 'catalog'), orderBy('order')));
    catalog = snap.docs.map((d) => d.data());
    if (!catalog.length) { $('cat-unmigrated').hidden = false; return; }
    renderList('');
  } catch (err) {
    $('cat-error-body').textContent = friendlyError(err, { kind: 'save' });
    $('cat-error').hidden = false;
  }
}

function wire() {
  for (const f of FIELDS) {
    const el = $('f-' + f);
    if (el) el.addEventListener('input', onInput);
  }
  $('cat-search').addEventListener('input', (e) => renderList(e.target.value));
  $('cat-back').addEventListener('click', () => { setView('list'); current = null; });
  $('cat-save').addEventListener('click', saveToCatalog);
  $('cat-draft-use').addEventListener('click', () => {
    if (!currentDraft) return;
    fillForm(Object.assign({}, current, currentDraft.fields));
    markDirty();
    $('cat-draft-banner').hidden = true;
  });
  $('cat-draft-drop').addEventListener('click', async () => {
    $('cat-draft-banner').hidden = true;
    if (current) await deleteDoc(doc(db, 'catalog', current.animeId, 'draft', 'current')).catch(() => {});
    currentDraft = null;
    fillForm(current);
    markDirty();
  });
}

let rendered = false;
onAuthStateChanged(auth, (user) => {
  const isAdmin = !!(user && user.uid === ADMIN_UID);
  const gate = $('admin-gate');
  const main = $('admin-main');
  if (isAdmin) {
    if (gate) gate.hidden = true;
    if (main) main.hidden = false;
    if (!rendered) { rendered = true; wire(); load(); }
  } else {
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
