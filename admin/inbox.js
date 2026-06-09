// admin/inbox.js — Blake's ADMIN INBOX for the gate-18 "Message Blake" DM floor.
// Clones admin/reports.js's shape: hardcoded ADMIN_UID + onAuthStateChanged
// redirect gate, ../firebase.js imports, escapeAttr discipline, event delegation.
//
// Schema (LIVE): conversations/{convId} {participants:[uid,ADMIN], kind:'admin',
// state:'open'|'locked', createdAt, lastMessageAt} + messages subcollection
// {senderUid, text, createdAt} + reads/{uid} {lastReadAt}. The admin is ALWAYS
// a participant of kind-'admin' conversations, so plain client SDK calls work.
// The onDmMessageCreate CF notifies the other party + bumps lastMessageAt.
//
// XSS discipline: every interpolated value (uids, names) flows through
// escapeAttr; message text renders textContent-based (createElement, never
// innerHTML — a DM body is attacker-controlled).
//
// ?to=<uid> — the SUGGESTION-REPLY channel: find the existing kind-'admin'
// conversation containing that uid, else create it, then open it.
//
// Author: Code | v1.10.0 gate 18 — admin inbox.

import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { collection, query, where, orderBy, limit, onSnapshot, getDoc, doc, addDoc, setDoc, updateDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';

// ---- Helpers ---------------------------------------------------------------

function $(id) { return document.getElementById(id); }

// Attribute-safe escape (clone of reports.js). textContent->innerHTML encodes
// & < > but NOT quotes — and these values land in double-quoted HTML attributes,
// so quotes MUST be encoded too (display names + uids are attacker-controlled).
function escapeAttr(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function shortUid(uid) { return uid ? (String(uid).slice(0, 6) + '…') : '—'; }

function ms(t) { return t && t.toMillis ? t.toMillis() : 0; }

function formatTimestamp(ts) {
  if (!ts) return '';
  const m = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : (ts.seconds ? ts.seconds * 1000 : 0));
  if (!m) return '';
  const diffH = (Date.now() - m) / 36e5;
  if (diffH < 1) return '<1h ago';
  if (diffH < 24) return Math.floor(diffH) + 'h ago';
  const d = new Date(m);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

// ---- State -----------------------------------------------------------------

let convos = [];                 // live conversation docs, newest activity first
let myReads = {};                // convId -> my lastReadAt ms (unread = lastMessageAt newer)
const nameCache = new Map();     // uid -> display name (or null when unresolvable)
let openConvId = null;
let unsubMsgs = null;
let booted = false;

// ?to=<uid> — the suggestion-reply channel. Shape-checked before any use
// (it rides the URL, so treat it as hostile until it matches a uid shape).
const rawTo = new URLSearchParams(location.search).get('to') || '';
let pendingTo = /^[A-Za-z0-9_-]{6,128}$/.test(rawTo) ? rawTo : null;
if (pendingTo === ADMIN_UID) pendingTo = null;   // no self-DM

function counterpartOf(c) {
  const parts = Array.isArray(c.participants) ? c.participants : [];
  return parts.find((u) => u !== ADMIN_UID) || null;
}

function isUnread(c) { return ms(c.lastMessageAt) > (myReads[c.id] || 0); }

// Resolve a counterpart's display name: profiles/{uid} with users/{uid} fallback.
// Both reads are public per the rules; results are escaped at render time.
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
    } catch (_e) { /* unresolvable — shortUid carries the row */ }
  }
  nameCache.set(uid, name);
  return name;
}

// ---- Skeleton --------------------------------------------------------------

function renderSkeleton() {
  const row = `<li class="conv-row skeleton" aria-hidden="true">
    <div class="sk-block sk-glyph"></div>
    <div class="sk-col">
      <div class="sk-block sk-name"></div>
      <div class="sk-block sk-uid"></div>
    </div>
  </li>`;
  $('conv-list').innerHTML = row.repeat(4);
}

// ---- Conversation list -----------------------------------------------------

function paintList() {
  const listEl = $('conv-list');
  if (!convos.length) {
    listEl.innerHTML = '';
    $('conv-empty').hidden = false;
    $('inbox-stats').hidden = true;
    return;
  }
  $('conv-empty').hidden = true;

  listEl.innerHTML = convos.map((c, i) => {
    const other = counterpartOf(c);
    const name = c.counterpartName || 'Member';
    const unread = isUnread(c);
    const locked = c.state !== 'open';
    return `<li class="conv-row${unread ? ' is-unread' : ''}${c.id === openConvId ? ' is-active' : ''}"
        style="--i: ${i}" data-conv="${escapeAttr(c.id)}" role="button" tabindex="0"
        aria-label="Conversation with ${escapeAttr(name)}${unread ? ', unread' : ''}">
      <span class="conv-glyph" aria-hidden="true">✉</span>
      <span class="conv-meta">
        <span class="conv-name">${escapeAttr(name)}</span>
        <span class="conv-uid">${escapeAttr(shortUid(other))}</span>
      </span>
      <span class="conv-side">
        <span class="conv-time">${escapeAttr(formatTimestamp(c.lastMessageAt))}</span>
        ${locked ? '<span class="conv-lock" title="Locked">🔒</span>' : ''}
        ${unread ? '<span class="conv-dot" aria-label="Unread"></span>' : ''}
      </span>
    </li>`;
  }).join('');

  const unreadCount = convos.filter(isUnread).length;
  $('inbox-stats').innerHTML = `<span class="stat-total">${convos.length} LETTER${convos.length === 1 ? '' : 'S'}</span>`
    + (unreadCount ? `<span class="stat-divider">·</span><span class="stat-unread">${unreadCount} UNREAD</span>` : '');
  $('inbox-stats').hidden = false;
}

function subscribeConvos() {
  // Composite index (kind ASC, participants array-contains, lastMessageAt DESC)
  // EXISTS in firestore.indexes.json — this exact query shape rides it.
  const cq = query(
    collection(db, 'conversations'),
    where('kind', '==', 'admin'),
    where('participants', 'array-contains', ADMIN_UID),
    orderBy('lastMessageAt', 'desc'),
    limit(50)
  );
  onSnapshot(cq, async (snap) => {
    convos = [];
    snap.forEach((d) => convos.push({ id: d.id, ...(d.data() || {}) }));
    // read receipts + counterpart names (N≤50, admin-page only; names are cached)
    await Promise.all(convos.map(async (c) => {
      try {
        const r = await getDoc(doc(db, 'conversations', c.id, 'reads', auth.currentUser.uid));
        myReads[c.id] = r.exists() ? ms(r.data().lastReadAt) : 0;
      } catch (_e) { myReads[c.id] = myReads[c.id] || 0; }
      c.counterpartName = await nameFor(counterpartOf(c));
    }));
    $('inbox-error').hidden = true;
    paintList();
    if (openConvId) paintThreadHead();   // lock state / name may have changed
    if (pendingTo) { const to = pendingTo; pendingTo = null; resolvePendingTo(to); }
  }, (err) => {
    console.error('conversations subscribe failed', err);
    $('conv-list').innerHTML = '';
    $('inbox-stats').hidden = true;
    $('inbox-error').hidden = false;
  });
}

// ---- ?to=<uid> — find-or-create the suggestion-reply conversation -----------

async function resolvePendingTo(to) {
  const existing = convos.find((c) => Array.isArray(c.participants) && c.participants.indexOf(to) !== -1);
  if (existing) { openConv(existing.id); return; }
  try {
    // The rules' create branch: 2 participants, one is ADMIN_UID, kind 'admin',
    // state 'open', createdAt == now. The CF keeps lastMessageAt fresh after this.
    const ref = await addDoc(collection(db, 'conversations'), {
      participants: [to, ADMIN_UID],
      kind: 'admin',
      state: 'open',
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
    });
    openConv(ref.id, to);
  } catch (err) {
    console.error('could not start conversation', err);
    alert('Could not start a conversation with that member: ' + (err && err.message ? err.message : err));
  }
}

// ---- Thread pane -----------------------------------------------------------

// fallbackUid covers a just-created conversation that the list snapshot hasn't
// delivered yet (so convos.find misses — the head still shows who it's for).
let openFallbackUid = null;

function paintThreadHead() {
  const c = convos.find((x) => x.id === openConvId) || null;
  const other = c ? counterpartOf(c) : openFallbackUid;
  const nameEl = $('thread-who-name');
  nameEl.textContent = (c && c.counterpartName) || 'Member';        // textContent — never innerHTML
  $('thread-who-uid').textContent = shortUid(other);
  if (other && !(c && c.counterpartName)) {
    const paintedConv = openConvId;
    nameFor(other).then((n) => { if (n && openConvId === paintedConv) nameEl.textContent = n; });
  }

  const locked = !!(c && c.state !== 'open');
  const btn = $('lock-toggle');
  btn.textContent = locked ? '🔓 Unlock' : '🔒 Lock';
  btn.classList.toggle('is-locked', locked);
  btn.title = locked
    ? 'Reopen this conversation (writing works again — for both sides)'
    : 'Lock this conversation (nobody can write while locked, including you)';

  // The rules require state=='open' for EVERY message create — admin included —
  // so a locked thread parks the composer too.
  const input = $('reply-input');
  input.readOnly = locked;
  input.placeholder = locked ? 'Locked — unlock to reply.' : 'Reply as Blake…';
  updateSendState();
}

function openConv(convId, fallbackUid) {
  openConvId = convId;
  openFallbackUid = fallbackUid || null;
  $('thread-placeholder').hidden = true;
  $('thread-open').hidden = false;
  paintThreadHead();
  paintList();   // repaint so the active row highlights

  const msgsEl = $('thread-messages');
  msgsEl.textContent = '';
  const loading = document.createElement('p');
  loading.className = 'thread-note';
  loading.textContent = 'Opening…';
  msgsEl.appendChild(loading);

  if (unsubMsgs) { try { unsubMsgs(); } catch (_e) {} unsubMsgs = null; }
  const mq = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
  unsubMsgs = onSnapshot(mq, (snap) => {
    // Bubbles are built createElement/textContent — message text is
    // attacker-controlled and NEVER touches innerHTML.
    msgsEl.textContent = '';
    if (snap.empty) {
      const p = document.createElement('p');
      p.className = 'thread-note';
      p.textContent = 'No messages yet — start the letter below.';
      msgsEl.appendChild(p);
    } else {
      snap.forEach((d) => {
        const m = d.data() || {};
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble' + (m.senderUid === auth.currentUser.uid ? ' is-mine' : '');
        const text = document.createElement('div');
        text.className = 'msg-text';
        text.textContent = m.text || '';
        const time = document.createElement('span');
        time.className = 'msg-time';
        time.textContent = formatTimestamp(m.createdAt);
        bubble.appendChild(text);
        bubble.appendChild(time);
        msgsEl.appendChild(bubble);
      });
    }
    msgsEl.scrollTop = msgsEl.scrollHeight;
    // read receipt on each paint (rules-legal: reads/{self} for a participant)
    setDoc(doc(db, 'conversations', convId, 'reads', auth.currentUser.uid),
      { lastReadAt: serverTimestamp() }, { merge: true })
      .then(() => { myReads[convId] = Date.now(); paintList(); })
      .catch(() => {});
  }, () => {
    msgsEl.textContent = '';
    const p = document.createElement('p');
    p.className = 'thread-note';
    p.textContent = 'Couldn\'t open this conversation.';
    msgsEl.appendChild(p);
  });
}

// ---- Composer + lock toggle ------------------------------------------------

function updateSendState() {
  const input = $('reply-input');
  const v = input.value.trim();
  $('reply-send').disabled = !(openConvId && v.length > 0 && v.length <= 2000 && !input.readOnly);
}

async function sendReply() {
  const input = $('reply-input');
  const text = input.value.trim();
  if (!text || text.length > 2000 || !openConvId) return;
  $('reply-send').disabled = true;
  try {
    await addDoc(collection(db, 'conversations', openConvId, 'messages'), {
      senderUid: auth.currentUser.uid,   // auth-sourced — never a UID literal in a WRITE
      text,
      createdAt: serverTimestamp(),
    });
    input.value = '';
    // lastMessageAt bump + recipient ping are the onDmMessageCreate CF's job.
  } catch (err) {
    console.error('send failed', err);
    alert('Could not send: ' + (err && err.message ? err.message : err));
  }
  updateSendState();
}

async function toggleLock() {
  if (!openConvId) return;
  const c = convos.find((x) => x.id === openConvId);
  const next = (c && c.state !== 'open') ? 'open' : 'locked';
  const btn = $('lock-toggle');
  btn.disabled = true;
  try {
    // The rules' admin-only branch allows exactly this: affectedKeys == ['state'].
    await updateDoc(doc(db, 'conversations', openConvId), { state: next });
    if (c) c.state = next;   // optimistic — the snapshot confirms
    paintThreadHead();
    paintList();
  } catch (err) {
    console.error('lock toggle failed', err);
    alert('Could not change the lock state — see console.');
  }
  btn.disabled = false;
}

// ---- Wiring (event delegation on the list; direct on the few controls) ------

function wireUi() {
  const listEl = $('conv-list');
  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('li[data-conv]');
    if (row) openConv(row.getAttribute('data-conv'));
  });
  listEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('li[data-conv]');
    if (row) { e.preventDefault(); openConv(row.getAttribute('data-conv')); }
  });

  $('reply-input').addEventListener('input', updateSendState);
  $('reply-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('reply-send').disabled) {
      e.preventDefault();
      sendReply();
    }
  });
  $('reply-send').addEventListener('click', sendReply);
  $('lock-toggle').addEventListener('click', toggleLock);
}

// ---- Auth gate + init (identical shape to reports.js) -----------------------

onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== ADMIN_UID) {
    window.location.replace('../index.html');
    return;
  }
  if (booted) return;   // onSnapshot subscriptions must not duplicate
  booted = true;
  $('admin-gate').style.display = 'none';
  $('admin-main').hidden = false;
  renderSkeleton();
  wireUi();
  subscribeConvos();
});
