// admin/suggestions.js — Admin queue for visitor anime suggestions.
// Mirrors admin/new-anime.js's auth pattern (hardcoded ADMIN_UID + onAuthStateChanged
// redirect). Reads `suggestions` collection ordered newest-first, renders each row
// with title + reason + relative timestamp + status pill + Add/Mark-reviewed/Delete
// buttons. Click delegation on the list container (no per-button listeners).
//
// v1.6.11 gate 3b additions: stagger index per row (CSS uses --i for animation-delay),
// skeleton shimmer placeholders before getDocs resolves, queue header stats counter,
// smooth row-collapse on Delete (CSS transition before DOM removal).
//
// Author: Code | date: 2026-06-02 | v1.6.11 Suggestion Box (gate 3b UI overhaul)

import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const SKELETON_COUNT = 3;

// ---- Helpers ---------------------------------------------------------------

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function truncate(s, max = 120) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

// Two-tier timestamp: "<1h ago" / "Xh ago" / "M/D/YY" (no leading zeros, 2-digit year)
function formatTimestamp(ts) {
  if (!ts) return '';
  const ms = ts.toMillis ? ts.toMillis() : ts;
  const diffH = (Date.now() - ms) / 36e5;
  if (diffH < 1) return '<1h ago';
  if (diffH < 24) return Math.floor(diffH) + 'h ago';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

// ---- Skeleton shimmer (gate 3b Cowork addition #2) -------------------------

function renderSkeleton() {
  const skeletonRow = `<li class="suggestion-row skeleton" aria-hidden="true">
    <div class="row-body">
      <div class="sk-block sk-title"></div>
      <div class="sk-block sk-reason"></div>
      <div class="sk-block sk-meta"></div>
    </div>
    <div class="actions">
      <div class="sk-block sk-btn"></div>
      <div class="sk-block sk-btn"></div>
      <div class="sk-block sk-btn"></div>
    </div>
  </li>`;
  $('suggestions-list').innerHTML = skeletonRow.repeat(SKELETON_COUNT);
}

// ---- Stats counter (gate 3b creative addition) -----------------------------

function updateStats() {
  const rows = $('suggestions-list').querySelectorAll('li.suggestion-row:not(.skeleton):not(.removing)');
  if (!rows.length) {
    $('queue-stats').hidden = true;
    return;
  }
  let newCount = 0, reviewedCount = 0;
  rows.forEach(row => {
    if (row.classList.contains('reviewed')) reviewedCount++;
    else newCount++;
  });
  const parts = [];
  if (newCount > 0) parts.push(`<span class="stat-new">${newCount} NEW</span>`);
  if (newCount > 0 && reviewedCount > 0) parts.push(`<span class="stat-divider">·</span>`);
  if (reviewedCount > 0) parts.push(`<span class="stat-reviewed">${reviewedCount} REVIEWED</span>`);
  $('queue-stats').innerHTML = parts.join('');
  $('queue-stats').hidden = false;
}

// ---- Render ----------------------------------------------------------------

function renderRow(snap, index) {
  const data = snap.data();
  const id = snap.id;
  const status = data.status || 'new';   // 'new' | 'reviewed' | 'spam'
  const rowClass = status === 'reviewed' ? 'suggestion-row reviewed' : 'suggestion-row';
  const reasonHtml = data.reason
    ? `<p class="reason">${escapeHtml(truncate(data.reason))}</p>`
    : '';

  // v1.6.11 gate 3e — conditional cover thumb + format/year (visitor picked from dropdown)
  const coverHtml = data.coverImage
    ? `<img class="row-cover-img" src="${escapeHtml(data.coverImage)}" alt="" loading="lazy">`
    : '';
  const formatHtml = data.format
    ? `<span class="row-format-badge">${escapeHtml(data.format)}</span>`
    : '';
  const yearHtml = data.year
    ? `<span class="row-year">${escapeHtml(String(data.year))}</span>`
    : '';
  const anilistIdAttr = data.anilistId
    ? ` data-anilist-id="${escapeHtml(String(data.anilistId))}"`
    : '';

  return `<li class="${rowClass}" style="--i: ${index}" data-doc-id="${escapeHtml(id)}" data-title="${escapeHtml(data.title)}"${anilistIdAttr}>
    ${coverHtml}
    <div class="row-body">
      <h3 class="title">${escapeHtml(data.title)}</h3>
      ${reasonHtml}
      <div class="meta">
        <span class="timestamp">${escapeHtml(formatTimestamp(data.submittedAt))}</span>
        ${formatHtml}
        ${yearHtml}
        <span class="status-pill status-${escapeHtml(status)}">${escapeHtml(status)}</span>
      </div>
    </div>
    <div class="actions">
      <button data-action="add" class="admin-primary">Add this anime</button>
      <button data-action="reviewed" class="secondary">Mark reviewed</button>
      <button data-action="delete" class="danger">Delete</button>
    </div>
  </li>`;
}

function renderQueue(snaps) {
  const list = $('suggestions-list');
  if (snaps.empty || snaps.size === 0) {
    list.innerHTML = '';
    $('suggestions-empty').hidden = false;
    $('queue-stats').hidden = true;
    return;
  }
  $('suggestions-empty').hidden = true;
  list.innerHTML = snaps.docs.map((snap, i) => renderRow(snap, i)).join('');
  updateStats();
}

// ---- Event delegation ------------------------------------------------------

function wireListClicks() {
  $('suggestions-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const row = btn.closest('li.suggestion-row');
    if (!row) return;
    const docId = row.dataset.docId;
    const title = row.dataset.title;
    const action = btn.dataset.action;

    if (action === 'add') {
      // v1.6.11 gate 3e — if the visitor picked from the dropdown, hand Mode 1
      // the AniList ID directly so it can auto-fetch (skipping the search step).
      const anilistId = row.dataset.anilistId;
      const idQuery = anilistId ? `&anilistId=${encodeURIComponent(anilistId)}` : '';
      window.location.href = `/admin/new-anime?suggest=${encodeURIComponent(title)}${idQuery}`;
      return;
    }

    if (action === 'reviewed') {
      btn.disabled = true;
      try {
        await updateDoc(doc(db, 'suggestions', docId), {
          status: 'reviewed',
          reviewedAt: serverTimestamp(),
        });
        row.classList.add('reviewed');
        const pill = row.querySelector('.status-pill');
        if (pill) {
          pill.textContent = 'reviewed';
          pill.className = 'status-pill status-reviewed';
        }
        updateStats();
      } catch (err) {
        console.error('mark-reviewed failed', err);
        alert('Could not mark as reviewed — see console.');
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (action === 'delete') {
      if (!confirm(`Delete suggestion: "${title}"?`)) return;
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, 'suggestions', docId));
        // Smooth collapse-out before DOM removal (gate 3b)
        row.classList.add('removing');
        updateStats();
        const cleanup = () => {
          row.remove();
          if (!$('suggestions-list').querySelector('li.suggestion-row:not(.skeleton)')) {
            $('suggestions-empty').hidden = false;
            $('queue-stats').hidden = true;
          }
        };
        // Wait for the longest transition (max-height 320ms) then remove from DOM.
        let removed = false;
        row.addEventListener('transitionend', () => {
          if (removed) return;
          removed = true;
          cleanup();
        }, { once: true });
        // Fallback if reduced-motion skipped the transition entirely.
        setTimeout(() => { if (!removed) { removed = true; cleanup(); } }, 500);
      } catch (err) {
        console.error('delete failed', err);
        alert('Could not delete — see console.');
        btn.disabled = false;
      }
    }
  });
}

// ---- Load queue ------------------------------------------------------------

async function loadQueue() {
  try {
    const q = query(collection(db, 'suggestions'), orderBy('submittedAt', 'desc'));
    const snaps = await getDocs(q);
    renderQueue(snaps);
  } catch (err) {
    console.error('loadQueue failed', err);
    $('suggestions-list').innerHTML = '';   // clear skeleton rows
    $('suggestions-empty').hidden = true;   // gate 3d: hide empty card if visible
    $('queue-stats').hidden = true;         // gate 3d: hide stats counter if visible
    $('suggestions-error').hidden = false;
  }
}

// ---- Auth gate + init ------------------------------------------------------

onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== ADMIN_UID) {
    window.location.replace('../index.html');
    return;
  }
  $('admin-gate').style.display = 'none';
  $('admin-main').hidden = false;
  renderSkeleton();
  wireListClicks();
  loadQueue();
});
