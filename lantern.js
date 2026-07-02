// lantern.js (ES module)
// THE Lantern notification center — the ONE source for BOTH pages (mega-run
// gate A0 unified it; script.js used to carry a duplicated twin that had
// already drifted). It owns #notif-btn / #notif-dot on whichever page loads it.
// Same center, same data, same gold-vs-purple gating, same unread glow.
//
// The CSS classes (.lantern-layer, .lantern-center, .lantern-row, .lantern-lit,
// etc.) already live globally in style.css — this module adds NO CSS.
//
// Page differences ride through initLantern(opts) hooks — NEVER through a copy:
//  - openTarget(targetPath, animeId): in-page deep-link router (index passes its
//    openNotifTarget; account omits it and rows NAVIGATE to index.html).
//  - onRowNavigate(): after an in-page deep-link lands (index shows its
//    floating "← Notifications" back chip).
//  - onOpen(): when the center opens (index hides that back chip).
//  - keepScrollLock(): closing the center keeps the scroll lock when a layer
//    below still owns it (index's anime modal under the lantern).
//  - safeAvatar(url): the page's avatar origin gate (index passes its shared
//    safeAvatar; the default below mirrors it — keep the gates in sync).

import { auth, db } from './firebase.js';
import {
  doc, setDoc, collection, onSnapshot, deleteDoc,
  query, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

// ── escapeHtml (copied from script.js's behavior) ────────────────────────────
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── State ────────────────────────────────────────────────────────────────────
let notifBtn = null;
let notifDot = null;
let hooks    = {};   // page hooks from initLantern(opts) — see the header comment

let unsubNotifs     = null;   // notifications collection listener
let unsubNotifPrefs = null;   // notifPrefs/prefs listener (lastSeenAt + muted)
let lastNotifs      = [];     // newest-first plain objects { id, ...data }
let notifLastSeenMs = 0;      // lastSeenAt in millis (0 = never seen)
let notifMuted      = {};     // { [type]: true }
let notifCenterOpen = false;

const NOTIF_KEEP  = 10;   // keep newest 10 in Firestore
const NOTIF_FETCH = 50;   // fetch extra so we can prune the old ones
let notifCleanupInFlight = false;

// Blake. Blake-origin pings get a gold pin and sort first.
const NOTIF_ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';

// Every type the center understands. Anything else falls back gracefully.
const NOTIF_VOTE_TYPES = ['comment_vote', 'review_vote'];
const NOTIF_TYPE_META = {
  reply:               { glyph: '↩', label: 'Replies',     verb: 'replied to you' },
  dm:                  { glyph: '✉', label: 'Messages',    verb: 'sent you a message' },
  blake_message:       { glyph: '★', label: 'From Blake',  verb: 'sent you a message' },
  suggestion_accepted: { glyph: '✓', label: 'Suggestions', verb: 'accepted your suggestion' },
  new_season:          { glyph: '◷', label: 'New seasons', verb: 'has a new season' },
  comment_vote:        { glyph: '♥', label: 'Likes',       verb: 'liked your comment' },
  review_vote:         { glyph: '♥', label: 'Likes',       verb: 'liked your review' },
  // dream-profile — the heart carve-out ping. Deterministic doc id (pl_<liker>)
  // server-side, so a like-unlike-like cycle re-lights ONE row, never spams.
  profile_like:        { glyph: '♥', label: 'Profile',     verb: 'liked your profile' },
  // gate 20 — the gold-flip: Blake reviewed something you requested. Blake-
  // origin (fromUid = ADMIN), so the row wears his gold; lands on the title's
  // secondary modal via targetPath secondary/<anilistId>.
  request_done:        { glyph: '✍', label: 'From Blake',  verb: 'reviewed it — you asked for this one' },
};

async function cleanupOldNotifications(uid, snapDocs) {
  if (!uid) return;
  if (!Array.isArray(snapDocs) || snapDocs.length <= NOTIF_KEEP) return;
  if (notifCleanupInFlight) return;

  notifCleanupInFlight = true;
  try {
    const oldDocs = snapDocs.slice(NOTIF_KEEP); // everything older than newest 10
    await Promise.all(oldDocs.map((d) =>
      deleteDoc(doc(db, 'users', uid, 'notifications', d.id)).catch(() => {})
    ));
  } finally {
    notifCleanupInFlight = false;
  }
}

function timeAgoMs(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

// Defensive createdAt → millis (Firestore Timestamp | number | {seconds} | null).
function notifCreatedMs(n) {
  const c = n && n.createdAt;
  if (c == null) return 0;
  if (typeof c === 'number') return c;
  if (typeof c.toMillis === 'function') return c.toMillis();
  if (typeof c.seconds === 'number') return c.seconds * 1000;
  return 0;
}

// Is this notification from Blake? (origin uid OR the dedicated type.)
function notifIsBlake(n) {
  if (!n) return false;
  return n.type === 'blake_message' || n.fromUid === NOTIF_ADMIN_UID;
}

// The default avatar origin gate (used when the page hooks none in).
function defaultSafeAvatar(u) {
  return (typeof u === 'string'
    && (/^https:\/\/(firebasestorage[.]googleapis[.]com|lh3[.]googleusercontent[.]com)\//.test(u)
      || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost')
        && /^http:\/\/127\.0\.0\.1:9199\//.test(u)))) ? u : '';
}

// ── PURE testable model (exposed on window for Playwright). Pure function of its
// inputs: notifs = plain objects with { fromUid, type, createdAtMillis, ... }.
// Returns { unreadCount, unreadBlake, sorted, rollup }. The on-page renderer calls
// this too so tests reflect reality.
function lanternModel(notifs, lastSeenMillis, adminUid) {
  const list = Array.isArray(notifs) ? notifs : [];
  const admin = adminUid || NOTIF_ADMIN_UID;
  const seen = Number(lastSeenMillis) || 0;

  const ms = (n) => Number(n && n.createdAtMillis) || 0;
  const isBlake = (n) => !!n && (n.type === 'blake_message' || n.fromUid === admin);
  const isVote = (n) => !!n && NOTIF_VOTE_TYPES.indexOf(n.type) !== -1;

  const unreadCount = list.filter((n) => ms(n) > seen).length;
  // Blake-origin unread only — drives the GOLD ember (gold = Blake). Community-only
  // unread keeps the lantern cool/purple. (See updateLanternGlyph.)
  const unreadBlake = list.filter((n) => ms(n) > seen && isBlake(n)).length;

  // Non-vote notifications, Blake-origin first, then createdAt desc.
  const sorted = list.filter((n) => !isVote(n)).slice().sort((a, b) => {
    const ba = isBlake(a) ? 1 : 0;
    const bb = isBlake(b) ? 1 : 0;
    if (ba !== bb) return bb - ba;            // Blake first
    return ms(b) - ms(a);                     // then newest first
  });

  // Vote-type notifications collapse into one summary row.
  const votes = list.filter(isVote);
  const rollup = { count: votes.length, hasAny: votes.length > 0 };

  return { unreadCount, unreadBlake, sorted, rollup };
}

// Adapt the live notif docs (Firestore shape) into the plain-object shape the
// pure model expects, then run the model.
function lanternModelFromLive(notifs, lastSeenMillis) {
  const plain = (notifs || []).map((n) => ({ ...n, createdAtMillis: notifCreatedMs(n) }));
  return lanternModel(plain, lastSeenMillis, NOTIF_ADMIN_UID);
}

// Resolve the verb shown for a row: explicit n.verb wins, else a sensible
// per-type phrase, else a neutral fallback. Always escaped at render time.
function notifVerb(n) {
  if (n && typeof n.verb === 'string' && n.verb.trim()) return n.verb.trim();
  const meta = NOTIF_TYPE_META[n && n.type];
  if (meta && meta.verb) return meta.verb;
  // Legacy vote rows carried value/type but no verb.
  if (n && (n.type === 'comment_vote' || n.type === 'review_vote')) {
    return (n.value === -1 ? 'disliked' : 'liked') +
           (n.type === 'review_vote' ? ' your review' : ' your comment');
  }
  return 'sent you tidings';
}

// ── The notification CENTER (veil-wearing center sheet). Built once, .active to
// open, closed via backdrop / Escape / close button. Reduced-motion aware.
let lanternEl = null;
let notifRollupOpen = false;     // is the vote rollup expanded into its "who liked" list?

function ensureLanternEl() {
  if (lanternEl) return;
  lanternEl = document.createElement('div');
  lanternEl.className = 'lantern-layer';
  lanternEl.hidden = true;
  lanternEl.innerHTML =
    '<div class="lantern-backdrop"></div>' +
    '<div class="lantern-center" role="dialog" aria-modal="true" aria-label="Notifications" tabindex="-1">' +
      '<div class="lantern-head">' +
        '<div class="lantern-head-titles">' +
          '<div class="lantern-kicker" lang="ja">便り</div>' +
          '<div class="lantern-title">Notifications</div>' +
        '</div>' +
        '<div class="lantern-head-actions">' +
          '<button type="button" class="lantern-markread" data-act="markread">Mark all read</button>' +
          '<button type="button" class="lantern-close" data-act="close" aria-label="Close">×</button>' +
        '</div>' +
      '</div>' +
      '<div class="lantern-scroll"></div>' +
    '</div>';
  document.body.appendChild(lanternEl);
  lanternEl.querySelector('.lantern-backdrop').addEventListener('click', closeLanternCenter);
  lanternEl.addEventListener('click', onLanternClick);
}

function onLanternKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeLanternCenter(); }
}

function onLanternClick(e) {
  const act = e.target.closest('[data-act]');
  if (act) {
    const kind = act.dataset.act;
    if (kind === 'close') { e.preventDefault(); closeLanternCenter(); return; }
    if (kind === 'markread') { e.preventDefault(); markAllNotifsRead(); return; }
  }
  // Per-type mute toggle.
  const mute = e.target.closest('.lantern-mute[data-type]');
  if (mute) {
    e.preventDefault();
    e.stopPropagation();
    toggleNotifMute(mute.dataset.type);
    return;
  }
  // Rollup drill-down — expand to "exactly who liked".
  const roll = e.target.closest('[data-rollup-toggle]');
  if (roll) { e.preventDefault(); notifRollupOpen = !notifRollupOpen; renderLanternCenter(); return; }
  // A deep-linkable notification row OR an itemized vote row → the page's
  // in-page router when one was hooked (index), else NAVIGATE to index.
  const link = e.target.closest('.lantern-row[data-target], .lantern-vote-item[data-target]');
  if (link) {
    const tgt = link.dataset.target, aid = link.dataset.animeid;
    if (!tgt && !aid) return;
    closeLanternCenter();
    if (typeof hooks.openTarget === 'function') {
      hooks.openTarget(tgt, aid);
      if (typeof hooks.onRowNavigate === 'function') hooks.onRowNavigate();
    } else {
      openNotifTarget(tgt, aid);
    }
  }
}

// Pure deep-link parse. comments/<slug>/items/<cid>[/replies/..] → the parent
// comment's anime; reviews/<slug>/items/<uid> → the review's anime; forum/<tid>
// + conversations/<id> → a hash route.
function parseNotifTarget(targetPath) {
  const path = (targetPath || '').trim();
  const mc = /^comments\/([^/]+)\/items\/([^/]+)/.exec(path);
  if (mc) return { kind: 'comment', slug: mc[1], id: mc[2] };
  const mr = /^reviews\/([^/]+)\/items\/([^/]+)/.exec(path);
  if (mr) return { kind: 'review', slug: mr[1], id: mr[2] };
  const mp = /^profiles\/([A-Za-z0-9_-]{1,128})$/.exec(path);   // dream-profile — profile_like
  if (mp) return { kind: 'profile', uid: mp[1] };
  if (/^(forum|conversations)\//.test(path)) return { kind: 'hash', path };
  const ms = /^secondary\/(\d{1,10})$/.exec(path);   // gate 20 — request_done lands on the deep-dive
  if (ms) return { kind: 'secondary', id: ms[1] };
  return { kind: 'none' };
}

// Pure: build the cross-page deep-link URL (exposed on window for headless testing).
// gate 6f — comment/review carry the FULL target via #notif= so index scrolls to +
// highlights the EXACT message (not just opens the anime). Index's #notif= boot
// handler hands it to the same scroll+poll+highlight path as a same-page deep-link.
export function notifHref(targetPath, animeId) {
  const t = parseNotifTarget(targetPath);
  if (t.kind === 'comment' || t.kind === 'review') return 'index.html#notif=' + encodeURIComponent(targetPath);
  if (t.kind === 'hash') return 'index.html#' + t.path;
  if (t.kind === 'profile') return 'index.html#profile=' + encodeURIComponent(t.uid);   // dream-profile
  if (t.kind === 'secondary') return 'index.html#secondary=' + encodeURIComponent(t.id);   // gate 20 — request_done
  if (animeId) return 'index.html#open=' + encodeURIComponent(animeId);
  return 'index.html';
}

// Account-page deep-link: the in-page anime modals live on index.html, so we NAVIGATE
// there. Used by both regular notification rows AND the who-liked drill-down rows.
function openNotifTarget(targetPath, animeId) {
  location.href = notifHref(targetPath, animeId);
}

// One row of the center, rendered per-type. Every user-derived string escaped.
function renderLanternRow(n) {
  const type = (n && n.type) || '';
  const meta = NOTIF_TYPE_META[type] || { glyph: '◆' };
  const blake = notifIsBlake(n);
  const name = n.fromDisplayName || (blake ? 'Blake' : 'Someone');
  const verb = notifVerb(n);
  const title = n.animeTitle || n.animeId || '';
  const ms = notifCreatedMs(n);
  const ago = ms ? timeAgoMs(ms) : '';
  // Unread glow: this row's createdAt is newer than the user's lastSeenAt.
  const unread = ms > notifLastSeenMs;

  // dream-profile fix: origin-gate the notif avatar too — senderIdentity's
  // users/ fallback photoURL is rules-unvalidated, so a hostile origin could
  // ride a notification into every recipient's lantern (IP beacon).
  // (gate 20.7: + the practice-emulator origin, localhost-only. Index passes
  // its shared safeAvatar via hooks; this default mirrors it — in sync.)
  const gate = (typeof hooks.safeAvatar === 'function') ? hooks.safeAvatar : defaultSafeAvatar;
  const safePhoto = gate(n.fromPhotoURL) || '';
  const avatar = safePhoto
    ? `<img src="${escapeHtml(safePhoto)}" alt="">`
    : `<span>${escapeHtml(String(name).trim().slice(0,1).toUpperCase() || '?')}</span>`;

  const target = n.targetPath || '';
  const animeAttr = n.animeId || '';
  const metaLine = [title, ago].filter(Boolean).map(escapeHtml).join(' · ');

  return `
    <div class="lantern-row${blake ? ' lantern-row--blake' : ''}${unread ? ' is-unread' : ''}" data-type="${escapeHtml(type)}" data-target="${escapeHtml(target)}" data-animeid="${escapeHtml(animeAttr)}">
      ${blake ? '<span class="lantern-pin" aria-hidden="true">★</span>' : ''}
      <div class="lantern-avatar"><span class="lantern-row-glyph" aria-hidden="true">${escapeHtml(meta.glyph || '◆')}</span>${avatar}</div>
      <div class="lantern-row-text">
        <div class="lantern-row-line"><strong>${escapeHtml(name)}</strong> ${escapeHtml(verb)}</div>
        ${metaLine ? `<div class="lantern-row-meta">${metaLine}</div>` : ''}
      </div>
    </div>
  `;
}

// The vote summary row (warm-but-purple, never gold). Clicking it DRILLS DOWN to an
// itemized "who liked" list built from the already-loaded vote notifications.
function renderLanternRollup(votes, expanded) {
  if (!votes || !votes.length) return '';
  const n = votes.length;
  // Unread glow on the rollup if ANY vote in it is newer than lastSeenAt.
  const unread = votes.some((v) => notifCreatedMs(v) > notifLastSeenMs);
  const items = expanded ? `<div class="lantern-rollup-items">${votes.map((v) => {
    const name = escapeHtml(v.fromDisplayName || 'Someone');
    const verb = escapeHtml(notifVerb(v));
    const where = [v.animeTitle || v.animeId || '', notifCreatedMs(v) ? timeAgoMs(notifCreatedMs(v)) : ''].filter(Boolean).map(escapeHtml).join(' · ');
    return `<div class="lantern-vote-item" data-target="${escapeHtml(v.targetPath || '')}" data-animeid="${escapeHtml(v.animeId || '')}">
      <span class="lvi-glyph" aria-hidden="true">${v.value === -1 ? '👎' : '👍'}</span>
      <div class="lvi-text"><strong>${name}</strong> ${verb}${where ? `<span class="lvi-meta"> · ${where}</span>` : ''}</div>
    </div>`;
  }).join('')}</div>` : '';
  return `
    <div class="lantern-rollup${expanded ? ' is-open' : ''}${unread ? ' is-unread' : ''}" data-rollup-toggle role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}">
      <span class="lantern-rollup-glyph" aria-hidden="true">♥</span>
      <div class="lantern-rollup-text">
        <div class="lantern-rollup-line">Your takes got liked</div>
        <div class="lantern-rollup-meta">${n} recent · tap to see who</div>
      </div>
      <span class="lantern-rollup-chev" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
    </div>${items}
  `;
}

// Compact per-type mute control strip.
function renderLanternMutes() {
  // gate 20: request_done joined — the CF checks the mute server-side, so the
  // chip must exist client-side or that check is dead letter.
  const types = ['reply', 'dm', 'comment_vote', 'profile_like', 'new_season', 'suggestion_accepted', 'request_done'];
  const chips = types.map((t) => {
    const meta = NOTIF_TYPE_META[t] || {};
    const off = !!notifMuted[t];
    return `<button type="button" class="lantern-mute${off ? ' is-muted' : ''}" data-type="${escapeHtml(t)}" aria-pressed="${off}" title="${off ? 'Unmute' : 'Mute'} ${escapeHtml(meta.label || t)}">${escapeHtml(meta.label || t)}</button>`;
  }).join('');
  return `<div class="lantern-mutes"><span class="lantern-mutes-label">Mute</span>${chips}</div>`;
}

function renderLanternCenter() {
  if (!lanternEl) return;
  const scroll = lanternEl.querySelector('.lantern-scroll');
  if (!scroll) return;

  const { sorted } = lanternModelFromLive(lastNotifs, notifLastSeenMs);
  const votes = (lastNotifs || []).filter((n) => n && (n.type === 'comment_vote' || n.type === 'review_vote'));
  const rows = sorted.map(renderLanternRow).join('');
  const rollupHtml = renderLanternRollup(votes, notifRollupOpen);

  const empty = `
    <div class="lantern-empty">
      <div class="lantern-empty-glyph" aria-hidden="true">🏮</div>
      <div class="lantern-empty-line">You're all caught up.</div>
    </div>
  `;

  scroll.innerHTML = renderLanternMutes() + (
    (rows || rollupHtml) ? `<div class="lantern-list">${rollupHtml}${rows}</div>` : empty
  );
}

// Toggle the Lantern glyph between COLD and WARM (lit) by unread count.
function updateLanternGlyph() {
  if (!notifBtn) return;
  const { unreadCount, unreadBlake } = lanternModelFromLive(lastNotifs, notifLastSeenMs);
  // GOLD ember = Blake-origin unread ONLY (gold is Blake's). Community-only unread
  // gets a COOL purple ember. The two classes are mutually exclusive.
  notifBtn.classList.toggle('lantern-lit', unreadBlake > 0);
  notifBtn.classList.toggle('lantern-lit-community', unreadCount > 0 && unreadBlake === 0);
  if (notifDot) notifDot.hidden = unreadCount === 0;   // ember shows for any unread (color by origin)
  notifBtn.setAttribute('aria-label', unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications');
}

// "Mark all read" = ONE write to notifPrefs/prefs.lastSeenAt (merge). No per-notif
// read flips anymore. (Exported: index's catch-up sheet marks pings read on open.)
export async function markAllNotifsRead() {
  const user = auth.currentUser;
  if (!user) return;
  // optimistic: light goes cold immediately
  notifLastSeenMs = Date.now();
  updateLanternGlyph();
  renderLanternCenter();
  try {
    await setDoc(doc(db, 'users', user.uid, 'notifPrefs', 'prefs'),
      { lastSeenAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('Mark-all-read failed:', err);
  }
}

// Per-type mute → notifPrefs/prefs.muted.{type} (merge). The Cloud Function honors
// `muted` at source; we only flip the flag.
async function toggleNotifMute(type) {
  const user = auth.currentUser;
  if (!user || !type) return;
  const next = !notifMuted[type];
  notifMuted = { ...notifMuted, [type]: next };   // optimistic
  renderLanternCenter();
  try {
    await setDoc(doc(db, 'users', user.uid, 'notifPrefs', 'prefs'),
      { muted: { [type]: next } }, { merge: true });
  } catch (err) {
    console.warn('Mute toggle failed:', err);
  }
}

function subscribeNotifications(user) {
  if (unsubNotifs)     { try { unsubNotifs(); }     catch(_) {} unsubNotifs = null; }
  if (unsubNotifPrefs) { try { unsubNotifPrefs(); } catch(_) {} unsubNotifPrefs = null; }
  lastNotifs = [];
  notifLastSeenMs = 0;
  notifMuted = {};
  updateLanternGlyph();
  if (notifCenterOpen) renderLanternCenter();

  if (!user) return;

  // Reactive lastSeenAt + muted (owner-writable prefs doc; also holds `muted`).
  unsubNotifPrefs = onSnapshot(doc(db, 'users', user.uid, 'notifPrefs', 'prefs'), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    const seen = data && data.lastSeenAt;
    notifLastSeenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis()
      : (typeof seen === 'number' ? seen : notifLastSeenMs);
    notifMuted = (data && data.muted) || {};
    updateLanternGlyph();
    if (notifCenterOpen) renderLanternCenter();
  }, () => {});

  const q = query(
    collection(db, 'users', user.uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(NOTIF_FETCH)
  );

  unsubNotifs = onSnapshot(q, (snap) => {
    cleanupOldNotifications(user.uid, snap.docs);   // prune anything past newest 10
    const shownDocs = snap.docs.slice(0, NOTIF_KEEP);
    lastNotifs = shownDocs.map(d => ({ id: d.id, ...d.data() }));
    updateLanternGlyph();
    if (notifCenterOpen) renderLanternCenter();
  }, (err) => {
    console.warn('Notifications listen failed:', err);
  });
}

export function openLanternCenter() {
  if (!auth.currentUser) return;   // logged out: clicking does nothing
  ensureLanternEl();
  if (typeof hooks.onOpen === 'function') hooks.onOpen();   // index drops its back chip
  notifCenterOpen = true;
  notifBtn?.setAttribute('aria-expanded', 'true');
  renderLanternCenter();           // rows GLOW while open (don't mark read on open)
  lanternEl.hidden = false;
  void lanternEl.offsetWidth;      // reflow so the transition runs
  lanternEl.classList.add('active');
  document.documentElement.style.overflow = 'hidden';
  document.addEventListener('keydown', onLanternKeydown);
}

function closeLanternCenter() {
  if (!lanternEl || !notifCenterOpen) return;
  notifCenterOpen = false;
  notifBtn?.setAttribute('aria-expanded', 'false');
  lanternEl.classList.remove('active');
  document.removeEventListener('keydown', onLanternKeydown);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const done = () => { if (lanternEl) lanternEl.hidden = true; };
  if (reduce) done(); else setTimeout(done, 300);
  // A layer below may still own the scroll lock (index's anime modal under the
  // lantern) — the page says so through the hook; default releases it.
  document.documentElement.style.overflow =
    (typeof hooks.keepScrollLock === 'function' && hooks.keepScrollLock()) ? 'hidden' : '';
  // AUTO-MARK-READ ON CLOSE: after the user opens then closes the center, the rows
  // stop glowing on the next open (and the glyph goes cold).
  markAllNotifsRead();
}

function toggleLanternCenter() {
  if (notifCenterOpen) closeLanternCenter();
  else openLanternCenter();
}

// ── INIT ─────────────────────────────────────────────────────────────────────
// Call once when the page initializes. Defensive: if #notif-btn is absent, no-op.
// opts (all optional — see the header comment): openTarget, onRowNavigate,
// onOpen, keepScrollLock, safeAvatar.
export function initLantern(opts) {
  hooks = opts || {};
  // Keep the pure model unit-testable from every page.
  if (typeof window !== 'undefined') {
    window.lanternModel = lanternModel;
    window.parseNotifTarget = parseNotifTarget;
    window.notifHref = notifHref;   // gate 6f: cross-page deep-link carry (testable)
  }

  notifBtn = document.getElementById('notif-btn');
  notifDot = document.getElementById('notif-dot');
  if (!notifBtn) return;   // no Lantern button on this page → graceful no-op

  updateLanternGlyph();

  notifBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleLanternCenter();
  });

  onAuthStateChanged(auth, (user) => subscribeNotifications(user));
}
