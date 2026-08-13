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
// gate 20 — a TEXT report whose live target doc carries imageRefs also previews
// those attached images as thumbs (SDK getDownloadURL only, like gate 14).
//
// Author: Code | v1.10.0 gate 4 — admin reports queue.

import { auth, db, functions, storage } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { collection, query, orderBy, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js';
import { ref as storRef, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js'; // gate 14 — image-report previews
import { confirmModal, noticeModal } from './admin-modals.js?v=2.2.5';   // PATCH QUEUE 2 — the shared dialogs

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
  // 'image' rides the forum deep-link too — targetPath is the forum doc holding
  // the pointer, so View opens the thread the image sits in.
  if (targetType === 'forum' || targetType === 'post' || targetType === 'image') {
    const tid = String(targetPath).split('/')[1];   // forum/{tid}[/posts/{pid}]
    return tid ? '../index.html#forum=' + encodeURIComponent(tid) : null;
  }
  // dream-profile — a reported profile opens its live sheet (bio/tags/status/
  // avatar/background all visible in one place).
  if (targetType === 'profile') {
    const uid = String(targetPath).split('/')[1];   // profiles/{uid}
    return uid ? '../index.html#profile=' + encodeURIComponent(uid) : null;
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
// the reporter's (possibly stale/forged) snapshot. Returns { state, html } plus,
// for text docs, the shape-validated imageRefs (≤4) for the gate-20 thumbs.
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
    // dream-profile — a profiles/{uid} target previews the live identity text
    // (name · status · bio · tags), escape-first like everything else here.
    if (/^profiles\//.test(targetPath)) {
      if (d.isBanned === true) return { state: 'removed', html: '<em>Account already suspended.</em>' };
      const bits = [d.displayName, d.status, d.bio,
        Array.isArray(d.tags) && d.tags.length ? 'tags: ' + d.tags.slice(0, 6).map((t) => String(t).slice(0, 24)).join(', ') : ''
      ].filter(Boolean).join(' · ');
      return bits ? { state: 'live', html: safeHtml(bits) } : { state: 'empty', html: '<em>(a bare profile — no bio/status/tags)</em>' };
    }
    const text = d.text || d.body || d.title || '';
    // gate 20 — carry the doc's ATTACHED image pointers out so TEXT reports can
    // preview them (a reported comment's images were invisible unless the image
    // itself was reported). Shape-validate each ref here (same charset/segment
    // caps as the gate-14 imagePath check) and honor the rules' ≤4 cap; the
    // queue resolves them via SDK getDownloadURL ONLY — never doc-built URLs.
    const imageRefs = Array.isArray(d.imageRefs)
      ? d.imageRefs.filter((p) => typeof p === 'string'
          && /^uploads\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9_-]{1,120}$/.test(p)).slice(0, 4)
      : [];
    if (!text) return { state: 'empty', html: '<em>(no text content)</em>', imageRefs };
    return { state: 'live', html: safeHtml(text), imageRefs };
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
      data-image-path="${escapeAttr(g.imagePath || '')}"
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
    // gate 14 — an image report also previews the reported OBJECT itself
    // (shape-pinned path -> getDownloadURL; a dead pointer shows as removed).
    // dream-profile: a 'profile' report with a background pointer previews it
    // the same way (Blake sees the reported bg without opening the sheet).
    // adversarial LOW: the rules pin imagePath SHAPE but never bind it to the
    // target — a forged 'profile' report could point imagePath at an unrelated
    // victim object and surface it under a profile label. For a 'profile'
    // report, require the bg object to belong to the TARGET uid's profilebg
    // prefix before fetching/previewing it.
    const profOwner = g.targetType === 'profile' ? String(g.targetPath || '').split('/')[1] : '';
    const imagePathOk = g.targetType === 'profile'
      ? new RegExp('^uploads/' + (profOwner || '\0').replace(/[^A-Za-z0-9_-]/g, '') + '/profilebg/[A-Za-z0-9_-]{1,120}$').test(g.imagePath || '')
      : /^uploads\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9_-]{1,120}$/.test(g.imagePath || '');
    if (content && (g.targetType === 'image' || g.targetType === 'profile') && imagePathOk) {
      try {
        const url = await getDownloadURL(storRef(storage, g.imagePath));
        const img = document.createElement('img');
        img.src = url; img.alt = 'Reported image'; img.loading = 'lazy';
        img.style.cssText = 'display:block;max-width:220px;max-height:160px;margin-top:8px;border-radius:8px;border:1px solid rgba(187,134,252,.4);';
        content.appendChild(img);
      } catch (_e) {
        const gone = document.createElement('em');
        gone.textContent = ' (the image object is already gone from Storage)';
        content.appendChild(gone);
      }
    }
    // gate 20 — a TEXT report whose live target doc carries imageRefs previews
    // those ATTACHED images as small thumbs under the live text (Blake sees a
    // reported comment's images without needing an image-specific report).
    // Disjoint from the gate-14 branch above ('image'/'profile' are excluded
    // here), same safe resolution: shape-validated refs (in fetchLive) → SDK
    // getDownloadURL only. Thumbs lazy-load; click opens the full image in a
    // new tab. A dead pointer is skipped; all-dead shows a quiet note. If the
    // doc itself is unreachable/deleted, fetchLive already rendered the quiet
    // "content no longer exists" note above and returns no refs.
    const TEXT_TYPES = ['comment', 'reply', 'review', 'thread', 'forum', 'post'];
    if (content && TEXT_TYPES.indexOf(g.targetType) !== -1 && res.imageRefs && res.imageRefs.length) {
      const urls = await Promise.all(res.imageRefs.slice(0, 4).map((p) =>
        getDownloadURL(storRef(storage, p)).catch(() => null)));
      const wrap = document.createElement('div');
      wrap.className = 'report-attached-thumbs';
      urls.forEach((url) => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        a.className = 'attached-thumb';
        a.title = 'Open full image in a new tab';
        const img = document.createElement('img');
        img.src = url; img.alt = 'Attached image'; img.loading = 'lazy';
        a.appendChild(img);
        wrap.appendChild(a);
      });
      if (wrap.children.length) {
        const label = document.createElement('span');
        label.className = 'attached-thumbs-label';
        label.textContent = 'Attached images';
        content.appendChild(label);
        content.appendChild(wrap);
      } else {
        const gone = document.createElement('em');
        gone.textContent = ' (the attached image objects are already gone from Storage)';
        content.appendChild(gone);
      }
    }
  }));
}

// ---- Branded confirm/notice modals ----------------------------------------
// PATCH QUEUE item 2: both used to be defined HERE, as commented clones of
// suggestions'. They now come from the shared admin/admin-modals.js so a fix to
// the focus trap or the entrance transition lands on every admin page at once.
// Call shape is unchanged — this file's object form BECAME the shared one.

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
      else noticeModal({ glyph: '🔗', kicker: 'NO VIEW YET', kickerJp: '未対応', body: 'That content type can\'t be opened from here yet.' });
      return;
    }

    if (action === 'dismiss') {
      btn.disabled = true;
      try {
        await resolveReports(row);
        collapseAndRemove(row);
      } catch (err) {
        console.error('dismiss failed', err);
        noticeModal({ kicker: 'DISMISS FAILED', kickerJp: '失敗', body: 'Couldn\'t dismiss that one — the console has the details.' });
        btn.disabled = false;
      }
      return;
    }

    if (action === 'remove') {
      const isProfileBg = targetType === 'profile' && row.dataset.imagePath;
      const ok = await confirmModal({
        glyph: '🗑️', kicker: 'REMOVE CONTENT', kickerJp: '削除',
        body: targetType === 'image'
          ? 'Remove this image for good? It leaves Storage AND the post pointer together (the atomic remove).'
          : isProfileBg
            ? 'Remove this profile BACKGROUND for good? Storage object + the bgRef pointer leave together. (Bio/tags scrub rides the Ban action.)'
            : targetType === 'profile'
              ? 'A profile with no reported background has nothing to remove here — use Ban to take the account (it scrubs the profile), or dismiss.'
              : `Permanently delete this ${targetType || 'content'}? This can't be undone.`,
        okLabel: 'Remove',
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        // gate 14 — IMAGE rows go through the adminRemoveImage callable: the
        // Storage object is deleted FIRST, then the Firestore pointer (never
        // the Firestore-only path — that's the legal trap). dream-profile:
        // a profile's reported BACKGROUND rides the same atomic callable
        // (docPath profiles/{uid} → the bgRef field).
        if (targetType === 'image' || isProfileBg) {
          const imagePath = row.dataset.imagePath;
          if (!imagePath) throw new Error('No image path on this report.');
          await httpsCallable(functions, 'adminRemoveImage')({ docPath: targetPath, imagePath });
          await resolveReports(row);
          collapseAndRemove(row);
          return;
        }
        if (targetType === 'profile') { btn.disabled = false; return; }   // nothing removable without a bg pointer
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
        noticeModal({ kicker: 'REMOVE FAILED', kickerJp: '失敗', body: 'Couldn\'t remove the content — the console has the details. (It may already be gone.)' });
        btn.disabled = false;
      }
      return;
    }

    if (action === 'ban') {
      if (!targetUid) { noticeModal({ glyph: '🚫', kicker: 'NO TARGET USER', kickerJp: '不明', body: 'This report doesn\'t name a user, so there\'s no one to ban.' }); return; }
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
        noticeModal({ glyph: '🚫', kicker: 'BAN FAILED', kickerJp: '失敗', body: 'Couldn\'t ban — the console has the details. ' + (err && err.message ? err.message : '') });
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

// ---- gate 12 — the uploadsEnabled KILL-SWITCH -------------------------------
// One admin write to commentsMeta/uploads {uploadsEnabled:false} blocks EVERY
// upload at the storage.rules layer (no redeploy); the site's pickers read the
// same doc and go quiet. This toggle is that write.

async function mountKillSwitch() {
  const header = document.querySelector('.admin-header');
  if (!header) return;
  const wrap = document.createElement('div');
  wrap.className = 'uploads-killswitch';
  wrap.innerHTML = '<button type="button" id="uploads-toggle" class="secondary" title="The Storage rules read this flag live — flipping it needs no deploy.">…</button>';
  header.appendChild(wrap);
  const btn = wrap.querySelector('#uploads-toggle');
  let enabled = true;
  const paint = () => {
    btn.textContent = enabled ? '🖼 Image uploads: ON' : '🚫 Image uploads: OFF';
    btn.classList.toggle('danger', !enabled);
  };
  try {
    const s = await getDoc(doc(db, 'commentsMeta', 'uploads'));
    enabled = !(s.exists() && s.data() && s.data().uploadsEnabled === false);
  } catch (_e) { /* default ON */ }
  paint();
  btn.addEventListener('click', async () => {
    const flipTo = !enabled;
    const ok = await confirmModal({
      glyph: flipTo ? '🖼' : '🚫',
      kicker: flipTo ? 'ENABLE UPLOADS' : 'KILL UPLOADS', kickerJp: flipTo ? '許可' : '停止',
      body: flipTo
        ? 'Turn image uploads back on for everyone?'
        : 'Shut off ALL image uploads right now? (Existing images stay up — remove those per-report.)',
      okLabel: flipTo ? 'Turn on' : 'Shut off',
    });
    if (!ok) return;
    btn.disabled = true;
    try {
      await setDoc(doc(db, 'commentsMeta', 'uploads'), { uploadsEnabled: flipTo }, { merge: true });
      enabled = flipTo;
      paint();
    } catch (err) { noticeModal({ glyph: '🖼', kicker: 'TOGGLE FAILED', kickerJp: '失敗', body: 'Couldn\'t flip the switch: ' + (err && err.message ? err.message : err) }); }
    btn.disabled = false;
  });
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
  mountKillSwitch();   // gate 12 — the uploadsEnabled toggle
  loadQueue();
});
