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
// v1.6.12 additions: (1) loadQueue clears stale empty/error cards before fetch;
// (2) custom branded delete-confirmation modal (confirmModal) replacing native
// confirm(); (3) reviewed rows move to a separate NEW/REVIEWED section split with
// a 320ms cross-slide instead of dimming in place.
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
  // Skeleton lives in the NEW section; reviewed stays hidden until data resolves.
  $('section-new').hidden = false;
  $('section-reviewed').hidden = true;
  $('suggestions-list-new').innerHTML = skeletonRow.repeat(SKELETON_COUNT);
}

// ---- Stats counter (gate 3b creative addition; v1.6.12 two-list aware) ------

// Count live rows (excludes skeletons + any mid-animation rows) in one list.
function liveCount(listId) {
  return $(listId).querySelectorAll(
    'li.suggestion-row:not(.skeleton):not(.removing):not(.leaving)'
  ).length;
}

function updateStats() {
  const newCount = liveCount('suggestions-list-new');
  const reviewedCount = liveCount('suggestions-list-reviewed');

  // Top widget — keeps the existing `X NEW · Y REVIEWED` summary.
  if (!newCount && !reviewedCount) {
    $('queue-stats').hidden = true;
  } else {
    const parts = [];
    if (newCount > 0) parts.push(`<span class="stat-new">${newCount} NEW</span>`);
    if (newCount > 0 && reviewedCount > 0) parts.push(`<span class="stat-divider">·</span>`);
    if (reviewedCount > 0) parts.push(`<span class="stat-reviewed">${reviewedCount} REVIEWED</span>`);
    $('queue-stats').innerHTML = parts.join('');
    $('queue-stats').hidden = false;
  }

  // Per-section header counts (v1.6.12 rec #5 — local count beside each kicker).
  $('count-new').textContent = newCount ? String(newCount) : '';
  $('count-reviewed').textContent = reviewedCount ? String(reviewedCount) : '';

  // Section visibility follows live row counts — hide an empty section's header.
  $('section-new').hidden = newCount === 0;
  $('section-reviewed').hidden = reviewedCount === 0;
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
  const newList = $('suggestions-list-new');
  const reviewedList = $('suggestions-list-reviewed');

  if (snaps.empty || snaps.size === 0) {
    newList.innerHTML = '';
    reviewedList.innerHTML = '';
    $('section-new').hidden = true;
    $('section-reviewed').hidden = true;
    $('suggestions-empty').hidden = false;
    $('queue-stats').hidden = true;
    return;
  }

  $('suggestions-empty').hidden = true;

  // v1.6.12 item 3 — split docs into NEW vs REVIEWED, render into their own lists.
  const newDocs = [], reviewedDocs = [];
  snaps.docs.forEach((snap) => {
    const status = snap.data().status || 'new';
    (status === 'reviewed' ? reviewedDocs : newDocs).push(snap);
  });
  newList.innerHTML = newDocs.map((snap, i) => renderRow(snap, i)).join('');
  reviewedList.innerHTML = reviewedDocs.map((snap, i) => renderRow(snap, i)).join('');

  updateStats();   // also sets section visibility + per-section counts
}

// ---- Branded confirm modal (v1.6.12 item 2) --------------------------------

// Promise-based replacement for native confirm(). Resolves true on Delete,
// false on Cancel / backdrop / Escape. Reuses the static #confirm-modal overlay
// already in the DOM (admin/suggestions.html). Focus trap keeps Tab inside the
// two buttons while open; reduced-motion is handled in CSS.
function confirmModal(title) {
  return new Promise((resolve) => {
    const overlay = $('confirm-modal');
    const card = overlay.querySelector('.confirm-card');
    const cancelBtn = overlay.querySelector('[data-confirm="cancel"]');
    const okBtn = overlay.querySelector('[data-confirm="ok"]');
    $('confirm-title').textContent = `Delete suggestion "${title}"?`;

    const prevFocus = document.activeElement;
    overlay.hidden = false;
    // Double-rAF so the entrance transition replays reliably on every open
    // (single rAF batches the hidden-removal + class-add into one frame).
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-open')));
    cancelBtn.focus();   // default focus on the safe option

    const close = (val) => {
      overlay.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      card.classList.remove('is-open');
      overlay.hidden = true;
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(val);
    };
    const onClick = (e) => {
      if (e.target === overlay) return close(false);          // backdrop = cancel
      const b = e.target.closest('[data-confirm]');
      if (b) close(b.dataset.confirm === 'ok');
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); return close(false); }
      if (e.key === 'Tab') {
        // Two-stop focus trap between Cancel and Delete.
        const active = document.activeElement;
        if (e.shiftKey && active === cancelBtn) { e.preventDefault(); okBtn.focus(); }
        else if (!e.shiftKey && active === okBtn) { e.preventDefault(); cancelBtn.focus(); }
      }
    };
    overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}

// ---- Reviewed-section move (v1.6.12 item 3) --------------------------------

// Slides a row out of the NEW list and into the REVIEWED list with a 320ms
// cross-slide. Uses the gate-3f double-rAF pattern so the entrance transition
// replays; a setTimeout fallback covers reduced-motion (zeroed transitions
// don't fire transitionend reliably).
function moveToReviewed(row) {
  const reviewedList = $('suggestions-list-reviewed');
  $('section-reviewed').hidden = false;   // ensure target visible before the move
  row.classList.add('leaving');

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    row.classList.remove('leaving');
    reviewedList.appendChild(row);        // physical DOM move between lists
    row.classList.add('entering');
    requestAnimationFrame(() => requestAnimationFrame(() => row.classList.remove('entering')));
    updateStats();                        // refresh counts + section visibility
  };
  row.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 400);                // reduced-motion / no-transition fallback
}

// ---- Event delegation ------------------------------------------------------

function wireListClicks() {
  // Delegate on the wrapper so clicks in BOTH the new + reviewed lists are caught
  // (a row physically moves between the two lists on Mark Reviewed).
  $('suggestions-queue').addEventListener('click', async (e) => {
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
        moveToReviewed(row);   // v1.6.12 item 3 — slide row into the REVIEWED section
      } catch (err) {
        console.error('mark-reviewed failed', err);
        alert('Could not mark as reviewed — see console.');
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (action === 'delete') {
      // v1.6.12 item 2 — branded modal in place of the native confirm() dialog.
      if (!(await confirmModal(title))) return;
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, 'suggestions', docId));
        // Smooth collapse-out before DOM removal (gate 3b)
        row.classList.add('removing');
        updateStats();
        const cleanup = () => {
          row.remove();
          updateStats();   // refresh counts + section visibility after removal
          if (!$('suggestions-queue').querySelector('li.suggestion-row:not(.skeleton):not(.removing)')) {
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
  // v1.6.12 item 1 — clear any stale empty/error card before fetching so a
  // prior failed attempt's error card can't linger past a later success.
  $('suggestions-empty').hidden = true;
  $('suggestions-error').hidden = true;
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
