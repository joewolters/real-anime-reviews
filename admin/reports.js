// admin/reports.js — Admin queue for user-reported content (v1.10.0 gate 4).
// Clones admin/suggestions.js's shape: hardcoded ADMIN_UID + onAuthStateChanged
// redirect gate, getDocs read, branded rows + event-delegated actions, a Promise
// branded confirm modal (no native confirm()).
//
// Reports are deduped by targetPath (N reports of one comment = ONE row "reported
// ×N") via window.dedupeReportsByTarget (admin/reports-model.js). The reporter
// snapshot is unverified, so the queue RE-FETCHES the live content from targetPath
// and renders BOTH (each labeled). Attacker-controlled text renders escape-first via
// window.reportSnapshotHtml (markdown.js inline → escape; never raw innerHTML).
//
// Actions: Ban author (gate-2 setBanState callable → onBanCascade tombstones their
// backlog), Remove content (admin hard-delete of the target doc), Dismiss (resolve
// the report). Ban + Remove are gated by the branded confirm modal.
//
// Author: Code | v1.10.0 gate 4 — admin reports queue.

import { auth, db, functions } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { collection, query, orderBy, getDocs, getDoc, doc, updateDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';

// ---- Helpers ---------------------------------------------------------------

function $(id) { return document.getElementById(id); }

// Attribute-safe escape (the content blocks use window.reportSnapshotHtml instead).
// textContent->innerHTML encodes & < > but NOT quotes — and these values land in
// double-quoted HTML attributes, so we MUST encode quotes too. Otherwise an
// attacker-controlled targetUid/targetPath (only `is string` in the rules) could
// carry a `"` to break out of the attribute and inject an event handler that runs
// in the ADMIN's session (stored XSS into the admin panel).
function escapeAttr(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// escape-first for content blocks — prefer the shared model helper, else inline-escape.
function safeHtml(s) {
  if (window.reportSnapshotHtml) return window.reportSnapshotHtml(s);
  return escapeAttr(s);
}

function shortUid(uid) { return uid ? (String(uid).slice(0, 6) + '…') : '—'; }

// Public deep-link to the reported content (opens in context on the live site: scroll + halo).
// comment/reply/review/thread -> the #notif= boot handler; forum/post -> the #forum= router
// (gate 5); dm viewing lands in gate 18.
function viewHref(targetType, targetPath) {
  if (!targetPath) return null;
  if (targetType === 'forum' || targetType === 'post') {
    const tid = String(targetPath).split('/')[1];   // forum/{tid}[/posts/{pid}]
    return tid ? '../index.html#forum=' + encodeURIComponent(tid) : null;
  }
  if (targetType === 'dm') return null;
  return '../index.html#notif=' + encodeURIComponent(targetPath);
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : (ts.seconds ? ts.seconds * 1000 : 0));
  if (!ms) return '';
  const diffH = (Date.now() - ms) / 36e5;
  if (diffH < 1) return '<1h ago';
  if (diffH < 24) return Math.floor(diffH) + 'h ago';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

// ---- Skeleton --------------------------------------------------------------

function renderSkeleton() {
  const row = `<li class="report-row skeleton" aria-hidden="true">
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
  $('reports-list').innerHTML = row.repeat(3);
}

// ---- Live-content re-fetch (snapshot is reporter-supplied / unverified) -----

// Reads the LIVE doc at targetPath so the admin reviews real current content, not
// the reporter's (possibly stale/forged) snapshot. Returns { state, html }.
async function fetchLive(targetPath) {
  if (!targetPath) return { state: 'none', html: '<em>No target path on this report.</em>' };
  let ref;
  try { ref = doc(db, targetPath); }
  catch (_e) { return { state: 'badpath', html: '<em>Unreadable target path.</em>' }; }
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return { state: 'gone', html: '<em>Content no longer exists (deleted).</em>' };
    const d = snap.data() || {};
    if (d.removed === true) return { state: 'removed', html: '<em>Content already removed (tombstoned).</em>' };
    const text = d.text || d.body || d.title || '';
    if (!text) return { state: 'empty', html: '<em>(no text content)</em>' };
    return { state: 'live', html: safeHtml(text) };
  } catch (_e) {
    return { state: 'error', html: '<em>Couldn\'t load live content.</em>' };
  }
}

// ---- Render ----------------------------------------------------------------

function renderRow(g, index) {
  const reasons = (g.reasons && g.reasons.length) ? g.reasons.join(', ') : '—';
  const countBadge = g.reportCount > 1
    ? `<span class="report-count-badge">reported ×${g.reportCount}</span>`
    : `<span class="report-count-badge single">1 report</span>`;
  const snapshot = (g.latest && g.latest.snapshotText) || '';
  const note = (g.latest && g.latest.note) || '';
  const noteHtml = note ? `<div class="report-note"><span class="report-block-label">Reporter note</span><div class="report-block-content">${safeHtml(note)}</div></div>` : '';
  const banDisabled = g.targetUid ? '' : ' disabled title="No target user on this report"';

  return `<li class="report-row" style="--i: ${index}"
      data-target-path="${escapeAttr(g.targetPath)}"
      data-target-uid="${escapeAttr(g.targetUid)}"
      data-report-ids="${escapeAttr((g.ids || []).join(','))}"
      data-target-type="${escapeAttr(g.targetType)}">
    <div class="row-body">
      <div class="report-head">
        <span class="report-type-pill">${escapeAttr(g.targetType || 'content')}</span>
        ${countBadge}
        <span class="timestamp">${escapeAttr(formatTimestamp(g.latestMs))}</span>
      </div>
      <div class="report-reasons"><span class="rr-label">Reason${g.reasons.length > 1 ? 's' : ''}:</span> ${escapeAttr(reasons)}</div>
      <div class="report-block report-snapshot">
        <span class="report-block-label">Reporter snapshot · unverified</span>
        <div class="report-block-content">${safeHtml(snapshot) || '<em>(none)</em>'}</div>
      </div>
      <div class="report-block report-live" data-live="pending">
        <span class="report-block-label">Live content</span>
        <div class="report-block-content live-content">Loading live content…</div>
      </div>
      ${noteHtml}
      <div class="report-foot">
        <span class="report-foot-item">Reporters: ${g.reporters.length}</span>
        <span class="report-foot-item">Author: ${escapeAttr(shortUid(g.targetUid))}</span>
      </div>
    </div>
    <div class="actions">
      <button data-action="view" class="admin-primary">View</button>
      <button data-action="dismiss" class="secondary">Dismiss</button>
      <button data-action="remove" class="secondary">Remove content</button>
      <button data-action="ban" class="danger"${banDisabled}>Ban author</button>
    </div>
  </li>`;
}

async function renderQueue(rows) {
  $('reports-error').hidden = true;
  const list = $('reports-list');

  if (!rows.length) {
    list.innerHTML = '';
    $('reports-empty').hidden = false;
    $('queue-stats').hidden = true;
    return;
  }
  $('reports-empty').hidden = true;

  list.innerHTML = rows.map((g, i) => renderRow(g, i)).join('');

  $('queue-stats').innerHTML = `<span class="stat-open">${rows.length} OPEN</span>`;
  $('queue-stats').hidden = false;

  // Re-fetch live content for each row in parallel, then inject (labeled).
  await Promise.all(rows.map(async (g, i) => {
    const liRows = list.querySelectorAll('li.report-row');
    const li = liRows[i];
    if (!li) return;
    const res = await fetchLive(g.targetPath);
    const block = li.querySelector('.report-live');
    const content = li.querySelector('.report-live .live-content');
    if (content) content.innerHTML = res.html;
    if (block) block.dataset.live = res.state;
  }));
}

// ---- Branded confirm modal (parameterized clone of suggestions') -----------

function confirmModal({ glyph, kicker, kickerJp, body, okLabel }) {
  return new Promise((resolve) => {
    const overlay = $('confirm-modal');
    const card = overlay.querySelector('.confirm-card');
    const cancelBtn = overlay.querySelector('[data-confirm="cancel"]');
    const okBtn = overlay.querySelector('[data-confirm="ok"]');
    $('confirm-glyph').textContent = glyph || '⚠️';
    $('confirm-kicker').innerHTML = `${escapeAttr(kicker || 'CONFIRM')} <span class="jp-mini">${escapeAttr(kickerJp || '確認')}</span>`;
    $('confirm-title').textContent = body || 'Are you sure?';
    okBtn.textContent = okLabel || 'Confirm';

    const prevFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-open')));
    cancelBtn.focus();

    const close = (val) => {
      overlay.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      card.classList.remove('is-open');
      overlay.hidden = true;
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(val);
    };
    const onClick = (e) => {
      if (e.target === overlay) return close(false);
      const b = e.target.closest('[data-confirm]');
      if (b) close(b.dataset.confirm === 'ok');
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); return close(false); }
      if (e.key === 'Tab') {
        const active = document.activeElement;
        if (e.shiftKey && active === cancelBtn) { e.preventDefault(); okBtn.focus(); }
        else if (!e.shiftKey && active === okBtn) { e.preventDefault(); cancelBtn.focus(); }
      }
    };
    overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}

// ---- Row removal animation (clone of suggestions' collapse-out) ------------

function collapseAndRemove(row) {
  row.classList.add('removing');
  let removed = false;
  const cleanup = () => {
    if (removed) return; removed = true;
    row.remove();
    const remaining = $('reports-list').querySelectorAll('li.report-row:not(.removing)').length;
    $('queue-stats').innerHTML = `<span class="stat-open">${remaining} OPEN</span>`;
    $('queue-stats').hidden = remaining === 0;
    if (remaining === 0) $('reports-empty').hidden = false;
  };
  row.addEventListener('transitionend', cleanup, { once: true });
  setTimeout(cleanup, 500);
}

// Mark every report doc behind a row as resolved (admin-only update per rules).
async function resolveReports(row) {
  const ids = (row.dataset.reportIds || '').split(',').filter(Boolean);
  await Promise.all(ids.map((id) =>
    updateDoc(doc(db, 'reports', id), { status: 'resolved', resolvedAt: serverTimestamp() })
  ));
}

// ---- Event delegation ------------------------------------------------------

function wireClicks() {
  $('reports-queue').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const row = btn.closest('li.report-row');
    if (!row) return;
    const action = btn.dataset.action;
    const targetPath = row.dataset.targetPath;
    const targetUid = row.dataset.targetUid;
    const targetType = row.dataset.targetType;

    if (action === 'view') {
      const href = viewHref(targetType, targetPath);
      if (href) window.open(href, '_blank', 'noopener');
      else alert('That content type can\'t be opened from here yet.');
      return;
    }

    if (action === 'dismiss') {
      btn.disabled = true;
      try {
        await resolveReports(row);
        collapseAndRemove(row);
      } catch (err) {
        console.error('dismiss failed', err);
        alert('Could not dismiss — see console.');
        btn.disabled = false;
      }
      return;
    }

    if (action === 'remove') {
      const ok = await confirmModal({
        glyph: '🗑️', kicker: 'REMOVE CONTENT', kickerJp: '削除',
        body: `Permanently delete this ${targetType || 'content'}? This can't be undone.`,
        okLabel: 'Remove',
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        // Per-type removal: comment/reply/review/thread are admin-deletable; forum
        // threads + posts are delete:false in the rules (soft-delete via the `removed`
        // flag + a CF cascade), so REDACT them instead; dm messages are immutable
        // (moderated by locking the conversation / banning), so there's no content op.
        const HARD = ['comment', 'reply', 'review', 'thread'];
        const SOFT = ['forum', 'post'];
        if (targetPath && HARD.indexOf(targetType) !== -1) {
          await deleteDoc(doc(db, targetPath));
        } else if (targetPath && SOFT.indexOf(targetType) !== -1) {
          await updateDoc(doc(db, targetPath),
            targetType === 'forum' ? { removed: true, title: '', body: '' } : { removed: true, body: '' });
        }
        // (dm / unknown: no content write — just resolve the report.)
        await resolveReports(row);
        collapseAndRemove(row);
      } catch (err) {
        console.error('remove failed', err);
        alert('Could not remove the content — see console. (It may already be gone.)');
        btn.disabled = false;
      }
      return;
    }

    if (action === 'ban') {
      if (!targetUid) { alert('No target user on this report.'); return; }
      const ok = await confirmModal({
        glyph: '🚫', kicker: 'BAN AUTHOR', kickerJp: '追放',
        body: `Ban this account and tombstone everything they've posted? This is reversible from the console, but heavy.`,
        okLabel: 'Ban + cascade',
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        await httpsCallable(functions, 'setBanState')({ uid: targetUid, banned: true, reason: 'Reported content' });
        await resolveReports(row);
        collapseAndRemove(row);
      } catch (err) {
        console.error('ban failed', err);
        alert('Could not ban — see console. ' + (err && err.message ? err.message : ''));
        btn.disabled = false;
      }
      return;
    }
  });
}

// ---- Load queue ------------------------------------------------------------

async function loadQueue() {
  $('reports-empty').hidden = true;
  $('reports-error').hidden = true;
  try {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const snaps = await getDocs(q);
    const open = [];
    snaps.forEach((s) => {
      const d = s.data() || {};
      if (d.status === 'resolved') return;   // only OPEN reports in the queue
      open.push({ id: s.id, ...d });
    });
    const rows = window.dedupeReportsByTarget ? window.dedupeReportsByTarget(open) : open;
    await renderQueue(rows);
  } catch (err) {
    console.error('loadQueue failed', err);
    $('reports-list').innerHTML = '';
    $('reports-empty').hidden = true;
    $('queue-stats').hidden = true;
    $('reports-error').hidden = false;
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
  wireClicks();
  loadQueue();
});
