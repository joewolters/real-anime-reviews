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
// v1.10.0 gate 20.5 addition: after a successful Mark-reviewed on a suggestion
// that carries an anilistId, a branded picker (offerMigration) offers to retag
// that title's 'anime:al:<id>' Tavern threads onto the picked catalog slug via
// the migrateRequestThread callable — the threads GAIN the gold verdict rail.
//
// v1.10.2 addition: clicking a row (or Enter/Space on its body) expands an
// inline detail panel — submitter name resolved via the inbox.js nameFor
// pattern (Anonymous when the doc predates gate 20.5), the FULL untruncated
// reason, the full submitted date, and any dropdown extras the doc carries.
//
// Author: Code | date: 2026-06-02 | v1.6.11 Suggestion Box (gate 3b UI overhaul)

import { auth, db, functions } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { collection, query, orderBy, getDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js';
import { confirmModal, noticeModal } from './admin-modals.js?v=2.2.1';   // PATCH QUEUE 2 — the shared dialogs

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const SKELETON_COUNT = 3;

// ---- Helpers ---------------------------------------------------------------

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

// Attribute-safe escape (gate 18 — clone of reports.js's discipline). escapeHtml
// above encodes & < > but NOT quotes, and the submitterUid lands inside a
// double-quoted HTML attribute — so quotes MUST be encoded too.
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

// Full timestamp for the expanded detail panel (v1.10.2) — the meta strip
// keeps the two-tier relative form above.
function formatFullDate(ts) {
  if (!ts) return '';
  const ms = ts.toMillis ? ts.toMillis() : ts;
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Resolve a submitter's display name: profiles/{uid} first, then users/{uid}
// displayName || username (the inbox.js nameFor pattern — both reads are
// world-readable per rules). Cached per uid; results land via textContent.
const nameCache = new Map();     // uid -> display name (or null when unresolvable)
async function nameFor(uid) {
  if (!uid) return null;
  if (nameCache.has(uid)) return nameCache.get(uid);
  let name = null;
  try {
    const p = await getDoc(doc(db, 'profiles', uid));
    if (p.exists()) { const d = p.data() || {}; name = d.displayName || null; }
  } catch (_e) { /* fall through to users */ }
  if (!name) {
    try {
      const u = await getDoc(doc(db, 'users', uid));
      if (u.exists()) { const d = u.data() || {}; name = d.displayName || d.username || null; }
    } catch (_e) { /* unresolvable — the short uid carries the line */ }
  }
  nameCache.set(uid, name);
  return name;
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

  // v1.6.12 iteration — both columns stay visible; show each column's inline
  // empty placeholder when its list has no live rows (keeps columns symmetric).
  $('empty-new').hidden = newCount > 0;
  $('empty-reviewed').hidden = reviewedCount > 0;
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

  // gate 18 — a row carrying a (rules-verified == submitter's own) submitterUid
  // gets a Reply button → the admin Inbox's ?to= suggestion-reply channel.
  const submitterUid = data.submitterUid ? String(data.submitterUid) : '';
  const submitterAttr = submitterUid
    ? ` data-submitter-uid="${escapeAttr(submitterUid)}"`
    : '';
  const replyHtml = submitterUid
    ? `<button data-action="reply" class="secondary" title="Message this member in the Inbox">Reply</button>`
    : '';

  // v1.10.2 — expandable detail panel: who sent it (nameFor resolves async on
  // first open; docs without submitterUid predate gate 20.5 → Anonymous), the
  // FULL untruncated reason, the full submitted date, plus any dropdown extras
  // the doc carries. Everything escapes before it lands in the markup.
  const detailId = `detail-${escapeAttr(id)}`;
  const detailPairs = [];
  detailPairs.push(['From', submitterUid
    ? `<span class="detail-submitter" data-uid="${escapeAttr(submitterUid)}">Loading…</span>`
    : 'Anonymous']);
  if (data.reason) detailPairs.push(['Request', escapeHtml(data.reason)]);
  const fullDate = formatFullDate(data.submittedAt);
  if (fullDate) detailPairs.push(['Submitted', escapeHtml(fullDate)]);
  if (data.englishTitle) detailPairs.push(['English', escapeHtml(data.englishTitle)]);
  if (data.romajiTitle) detailPairs.push(['Romaji', escapeHtml(data.romajiTitle)]);
  if (data.format) detailPairs.push(['Format', escapeHtml(data.format)]);
  if (data.year) detailPairs.push(['Year', escapeHtml(String(data.year))]);
  if (data.anilistId) detailPairs.push(['AniList ID', escapeHtml(String(data.anilistId))]);
  const detailHtml = `<div class="row-detail" id="${detailId}" hidden>
      ${detailPairs.map(([k, v]) => `<span class="detail-label">${k}</span><span class="detail-value">${v}</span>`).join('\n      ')}
    </div>`;

  return `<li class="${rowClass}" style="--i: ${index}" data-doc-id="${escapeHtml(id)}" data-title="${escapeHtml(data.title)}"${anilistIdAttr}${submitterAttr}>
    ${coverHtml}
    <div class="row-body" role="button" tabindex="0" aria-expanded="false" aria-controls="${detailId}" title="Show full details">
      <h3 class="title">${escapeHtml(data.title)}</h3>
      ${reasonHtml}
      <div class="meta">
        <span class="timestamp">${escapeHtml(formatTimestamp(data.submittedAt))}</span>
        ${formatHtml}
        ${yearHtml}
        ${data.kind === 'info' ? '<span class="status-pill kind-info">ⓘ INFO</span>' : ''}
        <span class="status-pill status-${escapeHtml(status)}">${escapeHtml(status)}</span>
      </div>
    </div>
    <div class="actions">
      <button data-action="add" class="admin-primary">Add this anime</button>
      <button data-action="reviewed" class="secondary">Mark reviewed</button>
      ${replyHtml}
      <button data-action="delete" class="danger">Delete</button>
    </div>
    ${detailHtml}
  </li>`;
}

function renderQueue(snaps) {
  const newList = $('suggestions-list-new');
  const reviewedList = $('suggestions-list-reviewed');

  $('suggestions-error').hidden = true;   // success path — never show error, period

  // Whole-queue-empty (0 docs total) — keep the branded QUEUE EMPTY card and
  // hide both columns (the per-column placeholders are for partial-empty only).
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

  // v1.6.12 iteration — both columns stay visible side-by-side; updateStats()
  // toggles each column's inline placeholder when its list is empty.
  $('section-new').hidden = false;
  $('section-reviewed').hidden = false;

  updateStats();   // drives per-section counts + per-column empty placeholders
}

// ---- Branded confirm modal (v1.6.12 item 2) --------------------------------

// PATCH QUEUE item 2 — confirmModal/noticeModal moved to the shared
// admin/admin-modals.js (reports.js carried a commented CLONE of the pair that
// used to live here). Call sites below use the shared object shape; the old
// positional forms are gone rather than shimmed, because a shim that accepts
// both shapes is the duplication moved, not removed.

// ---- Gold-flip migration picker (v1.10.0 gate 20.5) -------------------------

// MUST match script.js's slug()/animeSlug() EXACTLY — that pair mints the
// Hub's anime:<slug> forum tags (the verdict-rail key). NOT edit.js's
// slugify(), which strips apostrophes for Excel-row lookups and would produce
// a DIFFERENT slug for titles like "JoJo's Bizarre Adventure".
function tagSlug(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// The catalog (Blake's 44) from the animeData.js bridge — same read pattern as
// edit.js/season-reviews.js getCatalog().
function getCatalog() {
  const list = (window.animeData && Array.isArray(window.animeData)) ? window.animeData : [];
  return list
    .filter((a) => a && a.Title)
    .map((a) => ({ slug: tagSlug(a.Title), title: a.Title }))
    .sort((x, y) => x.title.toLowerCase().localeCompare(y.title.toLowerCase()));
}

// After a successful Mark-reviewed on a suggestion carrying an anilistId,
// offer to migrate that title's 'anime:al:<id>' Tavern threads onto the
// catalog slug Blake's review now lives under — they GAIN the gold verdict
// rail. The slug truth is animeData.js (AniList titles ≠ Blake's Excel
// titles), which is why the CF can't do this from a trigger — the admin picks
// the title here. SKIPPABLE by design (Skip / backdrop / Escape close without
// calling anything — not every review maps to a thread). Reuses the
// confirmModal overlay vocabulary: double-rAF entrance, focus containment,
// safe-option default focus.
function offerMigration(anilistId, suggestionTitle) {
  const catalog = getCatalog();
  if (!catalog.length) return;            // catalog bridge failed — nothing to offer

  const overlay = $('migrate-modal');
  const card = overlay.querySelector('.confirm-card');
  const listEl = $('migrate-list');
  const resultEl = $('migrate-result');
  const skipBtn = overlay.querySelector('[data-migrate="skip"]');

  $('migrate-title').textContent =
    `"${suggestionTitle}" is reviewed — move its community threads onto a catalog title's gold verdict rail?`;
  listEl.innerHTML = catalog
    .map((c) => `<li><button type="button" data-migrate-slug="${escapeAttr(c.slug)}">${escapeHtml(c.title)}</button></li>`)
    .join('');
  listEl.hidden = false;
  resultEl.hidden = true;
  resultEl.textContent = '';
  skipBtn.textContent = 'Skip';

  const prevFocus = document.activeElement;
  overlay.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-open')));
  skipBtn.focus();                        // default focus on the safe option

  let busy = false;                       // a callable is in flight — hold the door
  const close = () => {
    overlay.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    card.classList.remove('is-open');
    overlay.hidden = true;
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  };

  // Swap the list for the result line ("toast" in the page's card vocabulary);
  // Skip becomes Done so the close affordance survives the swap.
  const showResult = (text) => {
    listEl.hidden = true;
    resultEl.textContent = text;
    resultEl.hidden = false;
    skipBtn.textContent = 'Done';
    skipBtn.focus();
  };

  const pick = async (slug) => {
    if (busy) return;
    busy = true;
    listEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    skipBtn.disabled = true;
    try {
      const res = await httpsCallable(functions, 'migrateRequestThread')({ anilistId: Number(anilistId), slug });
      const n = (res && res.data && res.data.migrated) || 0;
      // gate-20.5 adversarial MED: the callable caps at 50 docs a call — a
      // capped run must SAY more may remain, not read as complete.
      showResult(n >= 50
        ? `Migrated ${n} threads — that hit the per-run cap, so more may remain. Run Mark-reviewed's migration again to catch the rest.`
        : (n > 0
          ? `Migrated ${n} thread${n === 1 ? '' : 's'} to the verdict rail.`
          : 'No community threads to migrate.'));
    } catch (err) {
      console.error('migrateRequestThread failed', err);
      showResult('Migration failed — see console.');
    } finally {
      busy = false;
      skipBtn.disabled = false;
      skipBtn.focus();
    }
  };

  // gate-20.5 adversarial MED: a wrong catalog pick is an irreversible bulk
  // retag — the first click ARMS the title, the second confirms it (the
  // col-del two-tap pattern; clicking anything else disarms).
  let armedSlug = null;
  const disarm = () => {
    armedSlug = null;
    listEl.querySelectorAll('button[data-migrate-slug]').forEach((b) => {
      b.classList.remove('is-armed');
      if (b.dataset.origLabel) { b.textContent = b.dataset.origLabel; delete b.dataset.origLabel; }
    });
  };
  const onClick = (e) => {
    if (busy) return;
    if (e.target === overlay) return close();                    // backdrop = skip
    if (e.target.closest('[data-migrate="skip"]')) return close();
    const b = e.target.closest('button[data-migrate-slug]');
    if (!b) return;
    if (armedSlug === b.dataset.migrateSlug) { disarm(); pick(b.dataset.migrateSlug); return; }
    disarm();
    armedSlug = b.dataset.migrateSlug;
    b.dataset.origLabel = b.textContent;
    b.classList.add('is-armed');
    b.textContent = `Retag threads to “${b.dataset.origLabel}”? Click again to confirm`;
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { if (!busy) { e.preventDefault(); close(); } return; }
    if (e.key === 'Tab') {
      // Focus containment across the modal's enabled buttons (the confirmModal
      // two-stop trap, generalized for the N-button list).
      const focusables = Array.from(card.querySelectorAll('button:not(:disabled)'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  overlay.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
}

// ---- Reviewed-section move (v1.6.12 item 3) --------------------------------

// Moves a row from the NEW column into the REVIEWED column. v1.6.12 iteration —
// fade+scale OUT (200ms) → physical DOM move → fade+scale IN (240ms); works
// regardless of the two columns' differing heights. Uses the gate-3f double-rAF
// so the entrance transition replays; the setTimeout fallback covers
// reduced-motion (zeroed transitions don't fire transitionend reliably).
function moveToReviewed(row) {
  const reviewedList = $('suggestions-list-reviewed');
  $('section-reviewed').hidden = false;   // safety — column should already be visible
  row.classList.add('leaving');

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    row.classList.remove('leaving');
    reviewedList.appendChild(row);        // physical DOM move between columns
    row.classList.add('entering');
    requestAnimationFrame(() => requestAnimationFrame(() => row.classList.remove('entering')));
    updateStats();                        // refresh counts + column placeholders
  };
  row.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 320);                // reduced-motion / no-transition fallback
}

// ---- Row expand/collapse (v1.10.2) ------------------------------------------

// Toggles a row's inline detail panel. aria-expanded lives on .row-body (the
// role="button" toggle); the submitter's display name resolves lazily on the
// first open — via textContent, so a member-controlled name has no HTML path.
function toggleDetail(row) {
  const body = row.querySelector('.row-body');
  const detail = row.querySelector('.row-detail');
  if (!body || !detail) return;
  const expand = detail.hidden;
  detail.hidden = !expand;
  body.setAttribute('aria-expanded', String(expand));
  row.classList.toggle('expanded', expand);
  if (expand) {
    const nameEl = detail.querySelector('.detail-submitter[data-uid]');
    if (nameEl && !nameEl.dataset.resolved) {
      nameEl.dataset.resolved = '1';
      nameFor(nameEl.dataset.uid).then((name) => {
        nameEl.textContent = name || ('Member ' + nameEl.dataset.uid.slice(0, 6) + '…');
      });
    }
  }
}

// ---- Event delegation ------------------------------------------------------

function wireListClicks() {
  // Delegate on the wrapper so clicks in BOTH the new + reviewed lists are caught
  // (a row physically moves between the two lists on Mark Reviewed).
  $('suggestions-queue').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) {
      // v1.10.2 — a click on the row itself (not its action buttons, not inside
      // the open detail panel — text there should be selectable) toggles detail.
      const clickedRow = e.target.closest('li.suggestion-row');
      if (clickedRow && !clickedRow.classList.contains('skeleton') &&
          !e.target.closest('.actions') && !e.target.closest('.row-detail')) {
        toggleDetail(clickedRow);
      }
      return;
    }
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

    if (action === 'reply') {
      // Milestone F — the admin Inbox is gone (Blake's call: the unified
      // account Inbox is the one letter room). Same door every member walks:
      // account.html#inbox/new/<uid> composes to the submitter directly.
      const submitterUid = row.dataset.submitterUid;
      if (submitterUid) window.location.href = '../account.html#inbox/new/' + encodeURIComponent(submitterUid);
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
        // gate 20.5 — the gold-flip's migration half: a dropdown-picked
        // suggestion carries an anilistId, so its Tavern threads (if any) are
        // tagged anime:al:<id>. Offer to dock them at the verdict rail.
        if (row.dataset.anilistId) offerMigration(row.dataset.anilistId, title);
      } catch (err) {
        console.error('mark-reviewed failed', err);
        noticeModal('Couldn\'t mark that one as reviewed — the console has the details.', 'MARK FAILED', '失敗');
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (action === 'delete') {
      // v1.6.12 item 2 — branded modal in place of the native confirm() dialog.
      if (!(await confirmModal({
        glyph: '🗑️', kicker: 'DELETE SUGGESTION', kickerJp: '削除',
        body: `Delete suggestion "${title}"?`, okLabel: 'Delete',
      }))) return;
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, 'suggestions', docId));
        // Smooth collapse-out before DOM removal (gate 3b)
        row.classList.add('removing');
        updateStats();
        const cleanup = () => {
          row.remove();
          updateStats();   // refresh counts + column placeholders after removal
          if (!$('suggestions-queue').querySelector('li.suggestion-row:not(.skeleton):not(.removing)')) {
            // Whole queue now empty — match renderQueue's empty branch: big card,
            // both columns hidden (not the per-column "Nothing yet" placeholders).
            $('section-new').hidden = true;
            $('section-reviewed').hidden = true;
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
        noticeModal('Couldn\'t delete that suggestion — the console has the details.', 'DELETE FAILED', '失敗');
        btn.disabled = false;
      }
    }
  });

  // v1.10.2 — keyboard path for the row toggle (.row-body is role="button" +
  // tabindex="0"; Enter/Space activate it like a real button).
  $('suggestions-queue').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const body = e.target.closest('.row-body[role="button"]');
    if (!body) return;
    e.preventDefault();                     // Space must not scroll the page
    const row = body.closest('li.suggestion-row');
    if (row) toggleDetail(row);
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
    // v1.6.12 iteration — repointed at the two-section list IDs. The old
    // single-list element was renamed in the gate-0 split; the stale reference
    // here threw a TypeError and broke the whole error path.
    $('suggestions-list-new').innerHTML = '';        // clear skeleton rows
    $('suggestions-list-reviewed').innerHTML = '';
    $('section-new').hidden = true;
    $('section-reviewed').hidden = true;
    $('suggestions-empty').hidden = true;            // hide empty card if visible
    $('queue-stats').hidden = true;                  // hide stats counter if visible
    $('suggestions-error').hidden = false;           // now actually reached
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
