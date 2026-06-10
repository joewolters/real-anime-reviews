// account.js (ES module)
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  updateProfile,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendEmailVerification,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {
  doc, setDoc, getDoc, getDocs, collection, onSnapshot, deleteDoc,
  query, orderBy, where, limit, collectionGroup,
  serverTimestamp, deleteField
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';


import { getStorage, ref as storageRef, uploadBytes, getDownloadURL }
  from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js';

import { initLantern } from './lantern.js';


const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const nameOut    = $('#acct-name');
const signoutA   = $('#acct-signout');     // the pill in the page header

const verifyBtn = document.querySelector('#acct-verify-email');
const resendBtn = document.querySelector('#acct-resend-verify');
const changePassBtn = document.querySelector('#acct-change-pass');
const resetPassBtn  = document.querySelector('#acct-reset-pass');


// profile fields
const profEmail  = $('#prof-email');
const profName   = $('#prof-name');
const avatarPick = document.getElementById('avatar-pick');
const avatarFile = document.getElementById('avatar-file');

const verifyMsg = $('#prof-email-verify');
const saveBtn   = $('#profile-save');
const statusEl  = $('#profile-status');
const errEl     = $('#profile-error');

// --- Tabs ---
const tabs = ['profile','watchlist','favorites','activity','inbox'];   // gate 18 — Inbox is the 5th place
function activateTab(name){
  $$('.side-link').forEach(btn => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  tabs.forEach(t => {
    const panel = document.getElementById(`tab-${t}`);
    if (panel) panel.toggleAttribute('hidden', t !== name);
  });
}
$$('.side-link').forEach(btn => {
  btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab);
    if (btn.dataset.tab === 'activity') ensureActivity();   // lazy — see boot block
  });
});
// deep-link: #inbox lands on the Inbox tab (the Lantern's dm pings route here)
activateTab(location.hash === '#inbox' ? 'inbox' : 'profile');

// ===== Favorites + Watchlist UI =====
const favListEl = document.getElementById('favoritesList');
const favEmptyEl = document.getElementById('favorites-empty');
const watchListEl = document.getElementById('watchlistList');
const watchEmptyEl = document.getElementById('watchlist-empty');

let unsubFav = null;
let unsubWatch = null;

// ===== My Activity UI =====
const activityListEl = document.getElementById('activity-list');
const activityEmptyEl = document.getElementById('activity-empty');

// ===== Notifications: the Lantern center =====
// The full Lantern notification center now lives in lantern.js (an ES module the
// account page imports). It owns #notif-btn / #notif-dot, subscribes to auth on
// its own, and renders the same center / gold-vs-purple gating as the index page.
// The old account-page dropdown shell (renderNotifShell / renderNotifications /
// updateNotifDot / markVisibleNotifsRead / toggleNotifMenu) was removed here so it
// can't fight the Lantern for #notif-btn. initLantern() is called once below.
// (NOTE: bare import — lantern.js is NOT cache-busted by ?v= like the other JS. Fine
// for the cutover since it's a brand-new file, but a POST-CUTOVER item: version-bust
// it so future v1.9.x deploys that change lantern.js refresh for visitors.)
initLantern();

// dream-profile — the veil pulse comes to the account page (same gating as
// index's initVeilPulse: the class only when the element exists AND motion is
// allowed; reduced-motion keeps the static LIT veil).
(function initVeilPulse() {
  const vp = document.getElementById('veil-pulse');
  if (!vp) return;
  const glow = vp.querySelector('.vp-glow');
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => document.documentElement.classList.toggle('veil-pulse-active', !mq.matches);
  apply();
  if (mq.addEventListener) mq.addEventListener('change', apply);
  else if (mq.addListener) mq.addListener(apply);
  const syncPlay = () => { if (glow) glow.style.animationPlayState = document.hidden ? 'paused' : 'running'; };
  syncPlay();
  document.addEventListener('visibilitychange', syncPlay);
})();

// HTML-escape used by the saved-row renderers below (favorites/watchlist/AniList).
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

// =============================================================================
// DREAM-PROFILE — the identity STUDIO state. Everything the public profile can
// wear, staged here and written to profiles/{uid} on Save. The accent palette
// mirrors the rules enum exactly (curated, gold-free).
// =============================================================================
const PROF_ACCENTS = ['violet', 'ember', 'teal', 'rose', 'sky', 'moss'];
const PROF_TAG_SUGGEST = ['Action', 'Romance', 'Slice of Life', 'Mecha', 'Sports', 'Horror', 'Isekai',
  'Shonen', 'Seinen', 'Sub', 'Dub', 'Binge-watcher', 'Weekly watcher', 'Manga reader', 'Cosplayer'];
const profState = {
  bio: '', status: '', tags: [], accent: '', bgRef: '', featuredAnime: '',
  bgStagedBlob: null, bgStagedMime: '', bgStagedUrl: '', bgRemove: false, bgCurrentUrl: '',
};

const profStatus2 = () => document.getElementById('prof-status');
const profBio     = () => document.getElementById('prof-bio');

// the live preview — a compact mirror of the public sheet's header (same
// escape-first discipline; the real sheet's builder lives in script.js, which
// this page doesn't load).
// adversarial perf MED: the preview is split so a keystroke only repaints the
// TEXT head — the bg <img> node is rebuilt ONLY when the bg URL actually
// changes (a fresh innerHTML per keypress restarted/re-decoded the staged GIF
// every character). The head and the bg layer are sibling nodes; syncPreviewBg
// is keyed by URL so an unchanged bg is left entirely alone.
let _previewBgUrl = null;
function syncPreviewBg(host) {
  const bgUrl = profState.bgRemove ? '' : (profState.bgStagedUrl || profState.bgCurrentUrl);
  if (bgUrl === _previewBgUrl) return;   // unchanged — never touch the live GIF
  _previewBgUrl = bgUrl;
  let wrap = host.querySelector('.acct-preview-bg');
  if (!bgUrl) { if (wrap) wrap.remove(); return; }
  if (!wrap) { wrap = document.createElement('span'); wrap.className = 'acct-preview-bg'; host.insertBefore(wrap, host.firstChild); }
  const img = document.createElement('img'); img.alt = ''; img.src = bgUrl;
  wrap.innerHTML = ''; wrap.appendChild(img);
  // reduced-motion: freeze the GIF to its first frame, capped at display scale.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    img.addEventListener('load', () => {
      try {
        const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
        const w = Math.min(nw, 1280), h = Math.max(1, Math.round(w * nh / nw));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        img.replaceWith(c);
      } catch (_) {}
    }, { once: true });
  }
}
function renderProfPreview() {
  const host = document.getElementById('acct-preview');
  if (!host) return;
  const u = auth.currentUser;
  const name = esc(($('#prof-name')?.value || '').trim() || (u && u.displayName) || 'You');
  const status = (profStatus2()?.value || '').trim();
  const bio = (profBio()?.value || '').trim();
  const avatarImg = avatarPick?.querySelector('img');
  const avatar = avatarImg ? `<img src="${esc(avatarImg.src)}" alt="">`
    : esc((name || '?').trim().charAt(0).toUpperCase() || '?');
  const tags = profState.tags.length
    ? `<div class="profile-tags">${profState.tags.slice(0, 6).map((t) => `<span class="profile-tag">${esc(String(t).slice(0, 24))}</span>`).join('')}</div>` : '';
  host.setAttribute('data-accent', PROF_ACCENTS.indexOf(profState.accent) !== -1 ? profState.accent : 'violet');
  syncPreviewBg(host);   // bg layer: untouched unless its URL changed
  let head = host.querySelector('.profile-head');
  if (!head) { head = document.createElement('div'); head.className = 'profile-head'; host.appendChild(head); }
  head.innerHTML = `<div class="profile-avatar">${avatar}</div>
      <h2 class="profile-name">${name}</h2>
      ${status ? `<div class="profile-status">${esc(status.slice(0, 80))}</div>` : ''}
      ${tags}
      ${bio ? `<div class="profile-bio">${esc(bio)}</div>` : ''}`;
}

function renderTagEditor() {
  const wrap = document.getElementById('acct-tags');
  const input = document.getElementById('acct-tag-input');
  if (!wrap || !input) return;
  wrap.querySelectorAll('.acct-tag-chip').forEach((n) => n.remove());
  profState.tags.slice(0, 6).forEach((t, i) => {
    const chip = document.createElement('span');
    chip.className = 'acct-tag-chip';
    const txt = document.createElement('span'); txt.textContent = String(t).slice(0, 24);
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'acct-tag-x'; x.setAttribute('aria-label', 'Remove tag'); x.textContent = '×';
    x.addEventListener('click', () => { profState.tags.splice(i, 1); renderTagEditor(); renderProfPreview(); });
    chip.appendChild(txt); chip.appendChild(x);
    wrap.insertBefore(chip, input);
  });
  input.disabled = profState.tags.length >= 6;
  input.placeholder = input.disabled ? '6 of 6 — remove one to add' : 'Add a tag + Enter';
  const sug = document.getElementById('acct-tag-suggest');
  if (sug) {
    sug.innerHTML = '';
    PROF_TAG_SUGGEST.filter((t) => profState.tags.indexOf(t) === -1).slice(0, 10).forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t;
      b.addEventListener('click', () => { addProfTag(t); });
      sug.appendChild(b);
    });
  }
}
function addProfTag(raw) {
  const t = String(raw || '').trim().slice(0, 24);
  if (!t || profState.tags.length >= 6 || profState.tags.indexOf(t) !== -1) return;
  profState.tags.push(t);
  renderTagEditor(); renderProfPreview();
}

function renderAccentPicker() {
  const host = document.getElementById('acct-accents');
  if (!host) return;
  host.innerHTML = '';
  PROF_ACCENTS.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'acct-accent'; b.setAttribute('data-accent', a);
    b.setAttribute('role', 'radio'); b.title = a;
    const on = profState.accent === a;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-checked', String(on));
    b.addEventListener('click', () => { profState.accent = (profState.accent === a) ? '' : a; renderAccentPicker(); renderProfPreview(); });
    host.appendChild(b);
  });
}

// background staging — upload happens on Save (the onProfileWritten CF sweeps
// the OLD object once bgRef changes, so no client-side delete dance).
const PROF_BG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
function renderBgThumb() {
  const thumb = document.getElementById('acct-bg-thumb');
  const removeBtn = document.getElementById('acct-bg-remove');
  if (!thumb) return;
  const url = profState.bgRemove ? '' : (profState.bgStagedUrl || profState.bgCurrentUrl);
  thumb.innerHTML = '';
  if (url) { const img = document.createElement('img'); img.alt = ''; img.src = url; thumb.appendChild(img); }
  else thumb.textContent = 'none yet';
  if (removeBtn) removeBtn.hidden = !url;
}
function initBgPicker() {
  const pick = document.getElementById('acct-bg-pick');
  const file = document.getElementById('acct-bg-file');
  const removeBtn = document.getElementById('acct-bg-remove');
  if (!pick || !file) return;
  pick.addEventListener('click', () => file.click());
  removeBtn?.addEventListener('click', () => {
    profState.bgRemove = true; profState.bgStagedBlob = null; profState.bgStagedMime = '';
    if (profState.bgStagedUrl) { try { URL.revokeObjectURL(profState.bgStagedUrl); } catch (_) {} profState.bgStagedUrl = ''; }
    renderBgThumb(); renderProfPreview();
  });
  file.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    file.value = '';
    if (!f) return;
    if (PROF_BG_TYPES.indexOf(f.type) === -1) { errEl.textContent = 'Background must be JPEG, PNG, WebP, or GIF.'; return; }
    if (f.size > 5 * 1024 * 1024) { errEl.textContent = 'Background is over 5 MB — choose a smaller file.'; return; }
    errEl.textContent = '';
    // GIFs upload as-is (a canvas downscale would freeze the animation); the
    // server pipeline re-encodes + strips metadata regardless.
    profState.bgStagedBlob = f; profState.bgStagedMime = f.type; profState.bgRemove = false;
    if (profState.bgStagedUrl) { try { URL.revokeObjectURL(profState.bgStagedUrl); } catch (_) {} }
    profState.bgStagedUrl = URL.createObjectURL(f);
    renderBgThumb(); renderProfPreview();
  });
}

// featured-review picker — only the user's OWN reviews can be pinned (the
// public sheet fetches reviews/{key}/items/{their uid}, so it's structural).
async function loadFeaturedChoices(uid) {
  const sel = document.getElementById('acct-featured');
  if (!sel) return;
  try {
    const snap = await getDocs(query(collectionGroup(db, 'items'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(60)));
    snap.forEach((d) => {
      if (!d.ref.path.startsWith('reviews/')) return;
      const v = d.data() || {}; if (v.removed) return;
      const key = d.ref.path.split('/')[1] || '';
      const label = (titleById.get(key) || (key.indexOf('al:') === 0 ? 'a season' : key.replace(/-/g, ' ')));
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${label} — “${String(v.title || '(review)').slice(0, 60)}”`;
      sel.appendChild(opt);
    });
    sel.value = profState.featuredAnime || '';
    if (sel.value !== (profState.featuredAnime || '')) sel.value = '';
  } catch (_) { /* leave the None option */ }
  sel.addEventListener('change', () => { profState.featuredAnime = sel.value || ''; });
}

// load the saved customization into the studio
async function initProfileStudio(user) {
  try {
    const ps = await getDoc(doc(db, 'profiles', user.uid));
    if (ps.exists()) {
      const p = ps.data() || {};
      profState.bio = typeof p.bio === 'string' ? p.bio : '';
      profState.status = typeof p.status === 'string' ? p.status : '';
      profState.tags = Array.isArray(p.tags) ? p.tags.slice(0, 6).map((t) => String(t).slice(0, 24)) : [];
      profState.accent = (PROF_ACCENTS.indexOf(p.accent) !== -1) ? p.accent : '';
      profState.bgRef = typeof p.bgRef === 'string' ? p.bgRef : '';
      profState.featuredAnime = typeof p.featuredAnime === 'string' ? p.featuredAnime : '';
    }
  } catch (_) {}
  if (profStatus2()) profStatus2().value = profState.status;
  if (profBio()) profBio().value = profState.bio;
  // hydrate the current background thumb (SDK-derived URL, never doc-built)
  if (profState.bgRef && /^uploads\/[A-Za-z0-9_-]{1,128}\/profilebg\/[A-Za-z0-9_-]{1,120}$/.test(profState.bgRef)) {
    try {
      profState.bgCurrentUrl = await getDownloadURL(storageRef(getStorage(), profState.bgRef));
    } catch (_) { profState.bgCurrentUrl = ''; }
  }
  renderTagEditor(); renderAccentPicker(); renderBgThumb(); renderProfPreview();
  loadFeaturedChoices(user.uid);
  // live preview while typing
  $('#prof-name')?.addEventListener('input', renderProfPreview);
  profStatus2()?.addEventListener('input', renderProfPreview);
  profBio()?.addEventListener('input', renderProfPreview);
  const tagInput = document.getElementById('acct-tag-input');
  tagInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addProfTag(tagInput.value); tagInput.value = '';
  });
  initBgPicker();
  document.getElementById('acct-view-public')?.addEventListener('click', () => {
    location.href = 'index.html#profile=' + encodeURIComponent(user.uid);
  });
}


let unsubActivity = null;

function slugFromTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const titleById = (() => {
  const arr = (window.__ANIME_DATA__ && Array.isArray(window.__ANIME_DATA__)) ? window.__ANIME_DATA__ : [];
  const map = new Map();
  arr.forEach(a => {
    const t = a?.Title;
    if (!t) return;
    const id = slugFromTitle(t);
    if (id) map.set(id, t);
  });
  return map;
})();

function clearActivityUI() {
  if (activityListEl) activityListEl.innerHTML = '';
  if (activityEmptyEl) {
    activityEmptyEl.textContent = 'No activity yet.';
    activityEmptyEl.style.display = '';
  }
}

function renderActivity(items) {
  if (!activityListEl || !activityEmptyEl) return;

  activityListEl.innerHTML = '';

  if (!items.length) {
    activityEmptyEl.textContent = 'No activity yet.';
    activityEmptyEl.style.display = '';
    return;
  }

  activityEmptyEl.style.display = 'none';

  items.forEach((it) => {
    const li = document.createElement('li');
    li.className = 'saved-item activity-item';

    const main = document.createElement('div');
    main.className = 'activity-main';

    const openBtn = document.createElement('button');
    openBtn.className = 'saved-open';
    openBtn.type = 'button';
    openBtn.textContent = it.title || it.animeId;
    openBtn.title = 'Open details';
    openBtn.addEventListener('click', () => {
      // dream-profile: forum items carry their own deep-link
      location.href = it.href || `index.html#open=${encodeURIComponent(it.animeId)}`;
    });

    const desc = document.createElement('div');
    desc.className = 'activity-desc';
    desc.textContent = it.desc || '';

    const dateEl = document.createElement('span');
    dateEl.className = 'saved-date';
    dateEl.textContent = formatDate(it.ms);

    main.appendChild(openBtn);
    main.appendChild(desc);

    li.appendChild(main);
    li.appendChild(dateEl);

    activityListEl.appendChild(li);
  });
}

// dream-profile — activity SEPARATED BY TYPE. Five streams, one merged model,
// a chip filter on top: comments · replies (comment replies + review
// discussions + forum replies) · threads (forum) · reviews. The two original
// streams stay LIVE (onSnapshot); the three new ones are one-shot reads
// (owner-scoped, capped — a tab visit doesn't need five live listeners).
let actTypeFilter = 'all';
const ACT_KIND_FOR_FILTER = {
  all: null,
  comments: ['comment'],
  replies: ['reply'],
  threads: ['thread'],
  reviews: ['review'],
};

function subscribeActivity(user) {
  if (unsubActivity) { try { unsubActivity(); } catch(_) {} unsubActivity = null; }

  clearActivityUI();
  if (!user) return;

  if (activityEmptyEl) {
    activityEmptyEl.textContent = 'Loading...';
    activityEmptyEl.style.display = '';
  }

  const uid = user.uid;

  const streams = { items: [], discussions: [], replies: [], forumThreads: [], forumPosts: [] };
  let gotAny = false;

  const shorten = (s, max = 120) => {
    const str = String(s || '').trim();
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + '…';
  };

  const rerender = () => {
    if (!gotAny) return;
    const merged = [...streams.items, ...streams.discussions, ...streams.replies,
                    ...streams.forumThreads, ...streams.forumPosts];
    const kinds = ACT_KIND_FOR_FILTER[actTypeFilter] || null;
    const view = kinds ? merged.filter((it) => kinds.indexOf(it.kind) !== -1) : merged;
    view.sort((a, b) => (b.ms || 0) - (a.ms || 0));
    renderActivity(view.slice(0, 20));
  };
  subscribeActivity._rerender = rerender;   // the chip handler reaches it

  const qItems = query(
    collectionGroup(db, 'items'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(25)
  );

  const unsubA = onSnapshot(qItems, (snap) => {
    gotAny = true;
    const next = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      if (data.removed) return;
      const path = d.ref.path.split('/');
      const root = path[0];
      const animeId = path[1];
      if (!animeId) return;
      const title = titleById.get(animeId) || animeId;
      const ms = toMillis(data.editedAt || data.updatedAt || data.createdAt);
      if (root === 'comments') {
        next.push({ animeId, title, ms, kind: 'comment', desc: `Commented: ${shorten(data.text)}` });
      } else if (root === 'reviews') {
        const rt = (data.title || '').trim();
        const r = (typeof data.rating === 'number') ? data.rating : null;
        next.push({ animeId, title, ms, kind: 'review', desc: r ? `Reviewed (${r}/10): ${shorten(rt)}` : `Reviewed: ${shorten(rt)}` });
      }
    });
    streams.items = next;
    rerender();
  }, (err) => {
    console.warn('Activity items failed:', err);
    gotAny = true; streams.items = []; rerender();
  });

  const qThreads = query(
    collectionGroup(db, 'threads'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(25)
  );

  const unsubB = onSnapshot(qThreads, (snap) => {
    gotAny = true;
    const next = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      if (data.removed) return;
      const path = d.ref.path.split('/');
      // reviews/{animeId}/items/{reviewUid}/threads/{tid}
      const animeId = path[1];
      if (!animeId) return;
      const title = titleById.get(animeId) || animeId;
      const ms = toMillis(data.editedAt || data.updatedAt || data.createdAt);
      next.push({ animeId, title, ms, kind: 'reply', desc: `Discussion comment: ${shorten(data.text)}` });
    });
    streams.discussions = next;
    rerender();
  }, (err) => {
    console.warn('Activity threads failed:', err);
    gotAny = true; streams.discussions = []; rerender();
  });

  // one-shot: comment replies
  getDocs(query(collectionGroup(db, 'replies'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(20)))
    .then((snap) => {
      const next = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        if (data.removed) return;
        const animeId = d.ref.path.split('/')[1];
        if (!animeId) return;
        next.push({ animeId, title: titleById.get(animeId) || animeId, ms: toMillis(data.editedAt || data.updatedAt || data.createdAt),
          kind: 'reply', desc: `Replied: ${shorten(data.text)}` });
      });
      gotAny = true; streams.replies = next; rerender();
    }).catch(() => { gotAny = true; rerender(); });

  // one-shot: forum threads + forum replies (the Tavern)
  getDocs(query(collection(db, 'forum'), where('authorUid', '==', uid), orderBy('createdAt', 'desc'), limit(20)))
    .then((snap) => {
      const next = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        if (data.removed) return;
        next.push({ title: 'The Tavern', ms: toMillis(data.editedAt || data.createdAt),
          kind: 'thread', desc: `Thread: ${shorten(data.title)}`, href: `index.html#forum=${encodeURIComponent(d.id)}` });
      });
      gotAny = true; streams.forumThreads = next; rerender();
    }).catch(() => { gotAny = true; rerender(); });
  getDocs(query(collectionGroup(db, 'posts'), where('authorUid', '==', uid), orderBy('createdAt', 'desc'), limit(20)))
    .then((snap) => {
      const next = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        if (data.removed) return;
        const tid = d.ref.path.split('/')[1];
        next.push({ title: 'The Tavern', ms: toMillis(data.editedAt || data.createdAt),
          kind: 'reply', desc: `Tavern reply: ${shorten(data.body)}`, href: tid ? `index.html#forum=${encodeURIComponent(tid)}` : undefined });
      });
      gotAny = true; streams.forumPosts = next; rerender();
    }).catch(() => { gotAny = true; rerender(); });

  unsubActivity = () => {
    try { unsubA(); } catch(_) {}
    try { unsubB(); } catch(_) {}
  };
}

// the activity chips (account page) — filter without re-querying
document.getElementById('acct-act-chips')?.addEventListener('click', (e) => {
  const chip = e.target.closest('.profile-act-chip');
  if (!chip) return;
  actTypeFilter = chip.getAttribute('data-act') || 'all';
  document.querySelectorAll('#acct-act-chips .profile-act-chip').forEach((c) => {
    const on = c === chip;
    c.classList.toggle('is-active', on);
    c.setAttribute('aria-selected', String(on));
  });
  if (typeof subscribeActivity._rerender === 'function') subscribeActivity._rerender();
});



function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  return 0;
}

function formatDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function clearSavedUI() {
  if (favListEl) favListEl.innerHTML = '';
  if (watchListEl) watchListEl.innerHTML = '';
  if (favEmptyEl) favEmptyEl.style.display = '';
  if (watchEmptyEl) watchEmptyEl.style.display = '';
}

// v1.7.5 (gate 2) — pretty-print an AniList format enum for the row sub-line.
function prettyFormat(f) {
  if (!f) return '';
  const MAP = { TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music' };
  return MAP[f] || String(f).replace(/_/g, ' ');
}

// Inner markup for a non-catalog (AniList) saved row: cover + title + FORMAT · YEAR
// + an ANILIST attribution kicker (the established carve-out — no review pill, the
// differentiation from catalog rows). esc() covers text + attribute contexts.
function buildAnilistRowInner(it) {
  const cover = it.coverImage
    ? `<img class="saved-cover" src="${esc(it.coverImage)}" alt="" loading="lazy">`
    : `<span class="saved-cover saved-cover--ph" aria-hidden="true"></span>`;
  const sub = [prettyFormat(it.format), it.year || ''].filter(Boolean).join(' · ');
  return cover +
    `<span class="saved-meta">` +
      `<span class="saved-title">${esc(it.title || ('AniList #' + it.aniListId))}</span>` +
      (sub ? `<span class="saved-sub">${esc(sub)}</span>` : '') +
      `<span class="saved-kicker">ANILIST</span>` +
    `</span>`;
}

// Legacy-row backfill: fetch cover/format/year and patch the row in place. Only
// fires for a row saved before the snapshot existed (new saves carry it), and is
// a no-op if franchise-fetch.js / network is unavailable.
async function backfillAnilistRow(openBtn, it) {
  const ff = window.franchiseFetch;
  if (!ff || typeof ff.fetchMediaDetail !== 'function') return;
  try {
    const d = await ff.fetchMediaDetail(Number(it.aniListId));
    if (!d) return;
    openBtn.innerHTML = buildAnilistRowInner({
      aniListId: it.aniListId,
      title: it.title || d.title.english || d.title.romaji || ('AniList #' + it.aniListId),
      coverImage: (d.coverImage && (d.coverImage.extraLarge || d.coverImage.large)) || '',
      format: d.format || '',
      year: d.seasonYear || null
    });
  } catch (_) { /* leave the snapshot/placeholder row as-is */ }
}

function renderSaved(listEl, emptyEl, items, kind, uid) {
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';

  if (!items.length) {
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  items.forEach((it) => {
    const li = document.createElement('li');
    li.className = 'saved-item';
    li.dataset.id = it.animeId;

    const openBtn = document.createElement('button');
    openBtn.className = 'saved-open';
    openBtn.type = 'button';
    openBtn.title = 'Open details';

    if (it.type === 'anilist') {
      // v1.7.5 (gate 2) — non-catalog row: cover + title + FORMAT · YEAR + kicker,
      // painted from the saved snapshot (no per-row network). Click opens the
      // in-site secondary "deep dive" modal by AniList id — never external.
      li.classList.add('saved-item--anilist');
      openBtn.classList.add('saved-open--rich');
      openBtn.innerHTML = buildAnilistRowInner(it);
      openBtn.addEventListener('click', () => {
        location.href = `index.html#secondary=${encodeURIComponent(it.aniListId)}`;
      });
      if ((!it.coverImage || !it.format) && it.aniListId) backfillAnilistRow(openBtn, it);
    } else {
      // v1.7.5 (gate 3) — catalog (reviewed) rows get a subtle green ✓ REVIEWED
      // affordance, matching the established checkmark vocabulary (secondary-modal
      // reviewed kicker / carousel ✓ badge). Row stays a text link to the review.
      openBtn.classList.add('saved-open--catalog');
      openBtn.innerHTML =
        '<span class="saved-title-text">' + esc(it.title || it.animeId) + '</span>' +
        '<span class="saved-reviewed" title="Reviewed by Blake">✓ REVIEWED</span>';
      openBtn.addEventListener('click', () => {
        // Send them to index and auto-open the modal there
        location.href = `index.html#open=${encodeURIComponent(it.animeId)}`;
      });
    }

    const dateEl = document.createElement('span');
    dateEl.className = 'saved-date';
    dateEl.textContent = formatDate(it.ms);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'saved-remove';
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Remove from list';
    removeBtn.addEventListener('click', async () => {
      removeBtn.disabled = true;
      try {
        await deleteDoc(doc(db, 'users', uid, kind, it.animeId));
      } catch (e) {
        alert('Could not remove: ' + (e.message || String(e)));
      } finally {
        removeBtn.disabled = false;
      }
    });

    li.appendChild(openBtn);
    li.appendChild(dateEl);
    li.appendChild(removeBtn);
    listEl.appendChild(li);
  });
}

// dream-profile — precise list controls: a client-side view (filter · sort ·
// type) over the live snapshot. The snapshot stays the model; the controls
// only change how it reads. al:<id> + #open=/#secondary= routing untouched.
const savedView = {
  watchlist: { items: [], filter: '', sort: 'recent', type: 'all' },
  favorites: { items: [], filter: '', sort: 'recent', type: 'all' },
};
function applySavedView(kind) {
  const st = savedView[kind];
  let v = st.items.slice();
  if (st.type !== 'all') v = v.filter((it) => (it.type || 'catalog') === st.type);
  if (st.filter) {
    const f = st.filter.toLowerCase();
    v = v.filter((it) => String(it.title || it.animeId).toLowerCase().indexOf(f) !== -1);
  }
  if (st.sort === 'alpha') v.sort((a, b) => String(a.title || a.animeId).localeCompare(String(b.title || b.animeId)));
  else if (st.sort === 'year') v.sort((a, b) => (b.year || 0) - (a.year || 0) || (b.ms || 0) - (a.ms || 0));
  else v.sort((a, b) => (b.ms || 0) - (a.ms || 0));
  return v;
}
function repaintSaved(kind, uid) {
  const listEl = kind === 'watchlist' ? watchListEl : favListEl;
  const emptyEl = kind === 'watchlist' ? watchEmptyEl : favEmptyEl;
  const st = savedView[kind];
  const v = applySavedView(kind);
  if (emptyEl) emptyEl.textContent = (st.items.length && !v.length) ? 'No matches in this view.' : (kind === 'watchlist' ? 'No watchlist yet.' : 'No favorites yet.');
  renderSaved(listEl, emptyEl, v, kind, uid);
}
function initSavedControls(uid) {
  ['watchlist', 'favorites'].forEach((kind) => {
    const host = document.querySelector(`[data-saved-controls="${kind}"]`);
    if (!host || host._wired) return;
    host._wired = true;
    const st = savedView[kind];
    host.querySelector('.saved-filter')?.addEventListener('input', (e) => { st.filter = e.target.value.trim(); repaintSaved(kind, uid); });
    host.querySelector('select')?.addEventListener('change', (e) => { st.sort = e.target.value; repaintSaved(kind, uid); });
    host.querySelectorAll('.saved-type-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        st.type = chip.getAttribute('data-type') || 'all';
        host.querySelectorAll('.saved-type-chip').forEach((c) => c.classList.toggle('is-active', c === chip));
        repaintSaved(kind, uid);
      });
    });
  });
}

function subscribeSavedLists(user) {
  if (unsubFav) { try { unsubFav(); } catch(_) {} unsubFav = null; }
  if (unsubWatch) { try { unsubWatch(); } catch(_) {} unsubWatch = null; }

  clearSavedUI();
  if (!user) return;

  const uid = user.uid;
  initSavedControls(uid);

  unsubFav = onSnapshot(
    collection(db, 'users', uid, 'favorites'),
    (snap) => {
      const items = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        const ts = data.updatedAt || data.savedAt || data.createdAt || null;
        // mega-batch D (cover-art ROOT CAUSE): legacy al:<id> saves missing the
        // type/aniListId FIELDS fell into the art-less catalog branch and never
        // qualified for the backfill — but both values live in the DOC ID.
        const isAl = /^al:\d+$/.test(d.id);
        items.push({
          animeId: d.id,
          title: data.title || data.animeTitle || d.id,
          ms: toMillis(ts),
          // v1.7.5 (gate 2) — non-catalog (AniList) saves carry a snapshot.
          type: data.type || (isAl ? 'anilist' : 'catalog'),
          aniListId: data.aniListId || (isAl ? Number(d.id.slice(3)) : null),
          coverImage: data.coverImage || '',
          format: data.format || '',
          year: data.year || null
        });
      });
      savedView.favorites.items = items;
      repaintSaved('favorites', uid);
    },
    (err) => console.error('Favorites list failed:', err)
  );

  unsubWatch = onSnapshot(
    collection(db, 'users', uid, 'watchlist'),
    (snap) => {
      const items = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        const ts = data.updatedAt || data.savedAt || data.createdAt || null;
        const isAl = /^al:\d+$/.test(d.id);   // mega-batch D — same root-cause heal as favorites
        items.push({
          animeId: d.id,
          title: data.title || data.animeTitle || d.id,
          ms: toMillis(ts),
          // v1.7.5 (gate 2) — non-catalog (AniList) saves carry a snapshot.
          type: data.type || (isAl ? 'anilist' : 'catalog'),
          aniListId: data.aniListId || (isAl ? Number(d.id.slice(3)) : null),
          coverImage: data.coverImage || '',
          format: data.format || '',
          year: data.year || null
        });
      });
      savedView.watchlist.items = items;
      repaintSaved('watchlist', uid);
    },
    (err) => console.error('Watchlist failed:', err)
  );
}


let newAvatarBlob = null;
let newAvatarMime = '';

function avatarHTML(url, name) {
  if (url) return `<img src="${String(url).replace(/"/g,'&quot;')}" alt="">`;
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return letter;
}

function downscaleImage(file, max = 512) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // keep PNG if source is PNG, else JPEG
        const mime = file.type.includes('png') ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Failed to create image blob.'));
          if (blob.size > 5 * 1024 * 1024) {
            return reject(new Error('Image is over 5 MB after resize. Use a smaller file.'));
          }
          resolve({ blob, mime });
        }, mime, 0.9);
      };
      img.onerror = () => reject(new Error('Could not read image.'));
      img.src = fr.result;
    };
    fr.onerror = () => reject(new Error('Could not read file.'));
    fr.readAsDataURL(file);
  });
}


verifyBtn?.addEventListener('click', async () => {
  const u = auth.currentUser; if (!u) return;
  try {
    await sendEmailVerification(u);
    verifyMsg.textContent = 'Verification email sent. Check your inbox.';
    verifyMsg.style.color = '#ffdf96';
  } catch (e) {
    alert('Could not send verification email: ' + e.message);
  }
});
resendBtn?.addEventListener('click', () => verifyBtn?.click());
changePassBtn?.addEventListener('click', async () => {
  const u = auth.currentUser; if (!u?.email) return;

  const current = prompt('Enter your current password to confirm:');
  if (!current) return;

  try {
    const cred = EmailAuthProvider.credential(u.email, current);
    await reauthenticateWithCredential(u, cred);
  } catch (e) {
    alert('Current password incorrect: ' + e.message);
    return;
  }

  const next = prompt('New password (min 6 characters):');
  if (!next || next.length < 6) {
    alert('Password must be at least 6 characters.');
    return;
  }

  try {
    await updatePassword(u, next);
    alert('Password changed.');
  } catch (e) {
    alert('Failed to change password: ' + e.message);
  }
});

resetPassBtn?.addEventListener('click', async () => {
  const u = auth.currentUser; if (!u?.email) return;
  try {
    await sendPasswordResetEmail(auth, u.email);
    alert('Reset email sent to ' + u.email);
  } catch (e) {
    alert('Could not send reset email: ' + e.message);
  }
});

avatarPick?.addEventListener('click', () => avatarFile?.click());

avatarFile?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const { blob, mime } = await downscaleImage(file, 512);
    newAvatarBlob = blob;
    newAvatarMime = mime;
    // Preview the chosen image in the circle
    const url = URL.createObjectURL(blob);
    avatarPick.innerHTML = `<img src="${url}" alt="">`;
  } catch (err) {
    alert(err.message || String(err));
    newAvatarBlob = null;
    newAvatarMime = '';
  }
});


// Sign out (both spots)
async function doSignOut() {
  try { await signOut(auth); }
  finally { location.href = 'index.html'; }
}
signoutA?.addEventListener('click', doSignOut);

// Save profile
saveBtn.addEventListener('click', async () => {
  errEl.textContent = '';
  statusEl.textContent = '';
  const u = auth.currentUser;
  if (!u) { location.href = 'index.html?signin=1'; return; }

  const name = (profName.value || '').trim();
  if (!name || name.length > 40) { errEl.textContent = 'Name must be 1–40 chars.'; return; }

  saveBtn.disabled = true;
  try {
    let photo = u.photoURL || null;

    // If a new avatar was picked, upload it
    if (newAvatarBlob) {
      const storage = getStorage(); // default app
      const ext = newAvatarMime === 'image/png' ? 'png' : 'jpg';
      const path = `avatars/${u.uid}/profile.${ext}`;
      const ref  = storageRef(storage, path);
      await uploadBytes(ref, newAvatarBlob, { contentType: newAvatarMime });
      photo = await getDownloadURL(ref);
    }

    await updateProfile(u, { displayName: name, photoURL: photo });
    await setDoc(doc(db, 'users', u.uid), { username: name, photoURL: photo }, { merge: true });

    // dream-profile — stage the background upload BEFORE the profiles write so
    // bgRef only ever points at an object that exists. The onProfileWritten CF
    // sweeps the old object once the pointer moves; a failed upload surfaces
    // honestly (verify-email / size are the usual suspects) and the save of
    // everything else still proceeds.
    let nextBgRef = profState.bgRemove ? null : (profState.bgRef || null);
    let bgUploadErr = '';
    if (profState.bgStagedBlob && !profState.bgRemove) {
      try {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        const path = `uploads/${u.uid}/profilebg/${id}`;
        await uploadBytes(storageRef(getStorage(), path), profState.bgStagedBlob, { contentType: profState.bgStagedMime });
        nextBgRef = path;
      } catch (bgErr) {
        bgUploadErr = !u.emailVerified
          ? 'Background not saved — verify your email first (uploads are email-verified only).'
          : (/permission|unauthorized|403/i.test(String(bgErr?.message || bgErr))
              ? 'Background not saved — uploads unlock after you accept the community rules (open any discussion to read them).'
              : 'Background upload failed — ' + (bgErr?.message || String(bgErr)));
      }
    }

    // v1.10.0 gate 15 → dream-profile — the public profile doc now carries the
    // whole identity (name/photo/bio/status/tags/accent/bgRef/featuredAnime).
    // Best-effort: the staged rules consent-gate profiles writes, so a
    // pre-consent save must not break the legacy path above — but it now SAYS
    // so instead of failing silent.
    let profWriteOk = true;
    try {
      const pref = doc(db, 'profiles', u.uid);
      const pSnap = await getDoc(pref);
      const pData = {
        displayName: name, photoURL: photo,
        bio: (profBio()?.value || '').trim().slice(0, 500),
        status: (profStatus2()?.value || '').trim().slice(0, 80),
        tags: profState.tags.slice(0, 6).map((t) => String(t).slice(0, 24)),
        // the accent enum has no null — clearing means REMOVING the key
        // (post-merge the key is gone, so the rules' `in`-check is skipped).
        accent: (PROF_ACCENTS.indexOf(profState.accent) !== -1) ? profState.accent : deleteField(),
        bgRef: nextBgRef,
        featuredAnime: profState.featuredAnime || null,
      };
      if (!pSnap.exists()) pData.joinedAt = serverTimestamp();   // member-since: first write only
      await setDoc(pref, pData, { merge: true });
      profState.bgRef = nextBgRef || '';
    } catch (_profileErr) {
      profWriteOk = false;
    }

    if (bgUploadErr) { errEl.textContent = bgUploadErr; saveBtn.disabled = false; return; }
    if (!profWriteOk) {
      errEl.textContent = 'Your name is saved. The public profile bits (bio, tags, background…) unlock after you accept the community rules — open any discussion to read and accept them.';
      saveBtn.disabled = false; return;
    }

    // Full-page reload to signal saved state (your request #3)
    location.reload();
    } catch (err) {
    console.error('Avatar/Profile save failed:', err);
    const code = err?.code ? ` (${err.code})` : '';
    errEl.textContent = (err?.message || String(err)) + code;
  } finally {

    saveBtn.disabled = false;
  }
});



// Gate + populate
onAuthStateChanged(auth, (user) => {
  if (!user) { location.href = 'index.html?signin=1'; return; }

  const name  = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  const photo = user.photoURL || '';

  nameOut.textContent = name;
  profEmail.value = user.email || '';
  profName.value  = name;
  avatarPick.innerHTML = avatarHTML(photo, name);
  verifyMsg.textContent = user.emailVerified ? 'Email verified' : 'Email not verified';
  verifyMsg.style.color = user.emailVerified ? '#b7ffbf' : '#ffdf96';
  if (verifyBtn && resendBtn) {
    const show = !user.emailVerified;
    verifyBtn.style.display = show ? '' : 'none';
    resendBtn.style.display = show ? '' : 'none';
  }


  // header buttons
  const headerSignoutBtn = document.querySelector('#signout-btn');
  if (headerSignoutBtn) headerSignoutBtn.style.display = '';
  subscribeSavedLists(user);
  // adversarial perf MED: DON'T subscribe activity on load — it's ~110 reads +
  // 2 live collection-group listeners for a tab that starts HIDDEN (Profile is
  // the default). Defer to the first time the Activity tab is opened. If the
  // page deep-links straight to activity, run it now.
  activityUserPending = user;
  if (document.querySelector('.side-link[data-tab="activity"].is-active')) ensureActivity();
  initProfileStudio(user);   // dream-profile — the identity studio
  initInbox(user);   // gate 18 — the Message-Blake DM
  // Notifications (Lantern) subscribe to auth on their own inside initLantern().
});

// lazy activity — subscribe the first time the Activity tab is shown
let activityUserPending = null;
let activityStarted = false;
function ensureActivity() {
  if (activityStarted || !activityUserPending) return;
  activityStarted = true;
  subscribeActivity(activityUserPending);
}

// =============================================================================
// GATE 18 — the INBOX (admin-floor DM: "Message Blake"). Peer DMs stay BANKED —
// the People folder is a locked promise, not a surface. The conversation is
// CLIENT-created under the live rules (kind 'admin', Blake always a party,
// state 'open'); messages are plain text (escape-rendered, no markdown — a DM
// is a letter, not a post). Unread = conversation.lastMessageAt newer than my
// reads/{uid}.lastReadAt (the rules-legal read receipt; the CF's unread_
// counter is server telemetry, not trusted client state).
// =============================================================================
const RAR_ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
function escText(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

function initInbox(user) {
  const homeEl = document.getElementById('inbox-home');
  const threadEl = document.getElementById('inbox-thread');
  const listEl = document.getElementById('inbox-list');
  const msgsEl = document.getElementById('inbox-messages');
  const inputEl = document.getElementById('inbox-input');
  const sendBtn = document.getElementById('inbox-send');
  const backBtn = document.getElementById('inbox-back');
  const blakeBtn = document.getElementById('inbox-message-blake');
  const dotEl = document.getElementById('inbox-dot');
  if (!homeEl || !threadEl) return;

  const isBlake = user.uid === RAR_ADMIN_UID;
  if (isBlake && blakeBtn) blakeBtn.closest('.inbox-blake-card').hidden = true;   // Blake sees the list, not himself

  let convos = [];
  let myReads = {};            // convId -> lastReadAt ms
  let openConvId = null;
  let unsubMsgs = null;
  const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);

  // my conversations, newest activity first (the index exists)
  const cq = query(collection(db, 'conversations'),
    where('participants', 'array-contains', user.uid), orderBy('lastMessageAt', 'desc'), limit(30));
  onSnapshot(cq, async (snap) => {
    convos = [];
    snap.forEach((d) => convos.push({ id: d.id, ...(d.data() || {}) }));
    // read receipts (one get per convo — N≤30, account-page only)
    await Promise.all(convos.map(async (c) => {
      try { const r = await getDoc(doc(db, 'conversations', c.id, 'reads', user.uid)); myReads[c.id] = r.exists() ? ms(r.data().lastReadAt) : 0; }
      catch (_) { myReads[c.id] = 0; }
    }));
    paintList();
  }, () => {});

  // unread = a NEWER message I haven't read AND it wasn't mine (adversarial
  // review, MED: my own send bumped lastMessageAt and could flag my own row
  // unread in the send-then-leave window). lastSenderUid is CF-owned.
  function isUnread(c) { return c.lastSenderUid !== user.uid && ms(c.lastMessageAt) > (myReads[c.id] || 0); }
  function paintList() {
    if (!listEl) return;
    listEl.innerHTML = convos.length ? convos.map((c) => `
      <li class="inbox-row${isUnread(c) ? ' is-unread' : ''}" data-conv="${escText(c.id)}" role="button" tabindex="0">
        <span class="inbox-row-who">${isBlake ? '✉ A member' : '🏮 Blake'}</span>
        <span class="inbox-row-state">${c.state === 'locked' ? '🔒' : ''}${isUnread(c) ? '<span class="inbox-row-dot" aria-label="Unread"></span>' : ''}</span>
      </li>`).join('') : '<li class="inbox-empty muted">No conversations yet.</li>';
    if (dotEl) dotEl.hidden = !convos.some(isUnread);
  }

  async function openConv(convId) {
    openConvId = convId;
    homeEl.hidden = true; threadEl.hidden = false;
    msgsEl.innerHTML = '<p class="muted">Opening…</p>';
    if (unsubMsgs) { try { unsubMsgs(); } catch (_) {} }
    const mq = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
    unsubMsgs = onSnapshot(mq, (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const m = d.data() || {};
        const mine = m.senderUid === user.uid;
        rows.push(`<div class="inbox-msg${mine ? ' is-mine' : ''}">${escText(m.text || '')}</div>`);
      });
      msgsEl.innerHTML = rows.length ? rows.join('') : '<p class="muted">Say hello — this goes straight to Blake.</p>';
      msgsEl.scrollTop = msgsEl.scrollHeight;
      // read receipt (rules-legal: reads/{uid} is owner-writable for participants)
      setDoc(doc(db, 'conversations', convId, 'reads', user.uid), { lastReadAt: serverTimestamp() }, { merge: true })
        .then(() => {
          // clamp to the server lastMessageAt (not the client clock) so skew
          // can't leave a just-read thread showing unread (review, MED).
          const c = convos.find((x) => x.id === convId);
          myReads[convId] = Math.max(myReads[convId] || 0, c ? ms(c.lastMessageAt) : 0, Date.now());
          paintList();
        }).catch(() => {});
    }, () => { msgsEl.innerHTML = '<p class="muted">Couldn\'t open this conversation.</p>'; });
    const c = convos.find((x) => x.id === convId);
    const locked = c && c.state !== 'open';
    inputEl.readOnly = !!locked;
    inputEl.placeholder = locked ? 'This conversation is closed.' : (isBlake ? 'Reply as Blake…' : 'Write to Blake…');
    sendBtn.disabled = true;
  }
  function closeConv() {
    openConvId = null;
    if (unsubMsgs) { try { unsubMsgs(); } catch (_) {} unsubMsgs = null; }
    threadEl.hidden = true; homeEl.hidden = false;
  }

  inputEl.addEventListener('input', () => {
    const v = inputEl.value.trim();
    sendBtn.disabled = !(v.length > 0 && v.length <= 2000 && !inputEl.readOnly);
  });
  sendBtn.addEventListener('click', async () => {
    const text = inputEl.value.trim();
    if (!text || !openConvId) return;
    sendBtn.disabled = true;
    try {
      await addDoc(collection(db, 'conversations', openConvId, 'messages'), {
        senderUid: user.uid, text, createdAt: serverTimestamp(),
      });
      inputEl.value = '';
    } catch (err) { alert('Could not send: ' + (err && err.message || err)); }
  });
  backBtn.addEventListener('click', closeConv);
  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('[data-conv]');
    if (row) openConv(row.getAttribute('data-conv'));
  });
  listEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('[data-conv]');
    if (row) { e.preventDefault(); openConv(row.getAttribute('data-conv')); }
  });

  if (blakeBtn) blakeBtn.addEventListener('click', async () => {
    // one floor-conversation per member: reuse mine if it exists
    const mine = convos.find((c) => c.kind === 'admin' && (c.participants || []).indexOf(RAR_ADMIN_UID) !== -1);
    if (mine) { openConv(mine.id); return; }
    blakeBtn.disabled = true;
    try {
      const ref = await addDoc(collection(db, 'conversations'), {
        participants: [user.uid, RAR_ADMIN_UID],
        kind: 'admin', state: 'open',
        createdAt: serverTimestamp(), lastMessageAt: serverTimestamp(),
      });
      openConv(ref.id);
    } catch (err) {
      alert('Could not start the conversation: ' + (err && err.message || err));
    } finally { blakeBtn.disabled = false; }
  });
}

