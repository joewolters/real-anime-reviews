// account.js (ES module)
import { auth, db, functions } from './firebase.js';
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
  doc, setDoc, getDoc, getDocs, addDoc, collection, onSnapshot, deleteDoc,
  query, orderBy, where, limit, collectionGroup,
  serverTimestamp, deleteField
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
// (round-2 adversarial HIGH: addDoc was USED by the gate-18 inbox at two call
// sites but never imported — every "Message Blake"/Send threw ReferenceError.
// Carried from the mega-batch; no spec drove the flow. The new e2e does.)


import { getStorage, ref as storageRef, uploadBytes, getDownloadURL }
  from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js';

// (?v= wired at the v1.10.0 cutover — these once-bare imports cache-bust now;
// bump-version.js carries the import targets.)
import { initLantern } from './lantern.js?v=1.10.1';
// round 2 — the ONE consent implementation (shared with script.js): the
// account page accepts the community rules IN PLACE (Blake: "its dumb for
// users to have to go comment to accept the terms").
import { ensureConsent, peekConsent } from './consent.js?v=1.10.1';
import { openCropper } from './cropper.js?v=1.10.1';   // round 4 — frame-it crop/reposition (item 2)
// v1.10.1 hotfix — the ONE branded-error module (no raw SDK strings in UI, ever)
import { friendlyError } from './friendly-errors.js?v=1.10.1';


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

// --- Tabs --- round 2: six full panels (profile is a REAL tab now; settings
// split out of the profile editor — Blake's Discord/Reddit IA). The panel-in
// class drives the slide+fade entrance (transform/opacity only; reduced-motion
// nulls it in CSS).
const tabs = ['profile','watchlist','favorites','collections','activity','inbox','settings'];   // round 4: + personal collections
function activateTab(name){
  $$('.side-link').forEach(btn => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  tabs.forEach(t => {
    const panel = document.getElementById(`tab-${t}`);
    if (!panel) return;
    const show = t === name;
    const wasHidden = panel.hasAttribute('hidden');
    panel.toggleAttribute('hidden', !show);
    if (show && wasHidden) {
      panel.classList.remove('panel-in');
      void panel.offsetWidth;            // restart the entrance animation
      panel.classList.add('panel-in');
    }
  });
}
$$('.side-link').forEach(btn => {
  btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab);
    if (btn.dataset.tab === 'activity') ensureActivity();        // lazy — see boot block
    if (btn.dataset.tab === 'collections') ensureCollections();  // round 4 — lazy too
  });
});
// deep-link: #inbox lands on the Inbox tab (the Lantern's dm pings route here);
// #settings lands on the split-out account settings; #collections on the shelves.
activateTab(location.hash === '#inbox' ? 'inbox'
  : (location.hash === '#settings' ? 'settings'
  : (location.hash === '#collections' ? 'collections' : 'profile')));
if (location.hash === '#collections') {
  // the subscription needs auth — retry once the user lands (same lazy shape
  // as ensureActivity's boot block)
  onAuthStateChanged(auth, (u) => { if (u) ensureCollections(); });
}

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
// round 4 (item 3) — the palette grows up: 10 solids + 6 gradients + a glow
// switch. Keys mirror the rules enum EXACTLY (and script.js's viewer list);
// still curated, still gold-free — gold is Blake's.
const PROF_ACCENTS = ['violet', 'ember', 'teal', 'rose', 'sky', 'moss',
  'crimson', 'indigo', 'peach', 'pearl',
  'g-nebula', 'g-ember', 'g-ocean', 'g-meadow', 'g-dusk', 'g-sakura'];
const PROF_ACCENT_GROUPS = [
  ['Solids', '色', PROF_ACCENTS.slice(0, 10)],
  ['Gradients', '移ろい', PROF_ACCENTS.slice(10)],
];
// round 2 — the CURATED tag catalog behind the branded dropdown (Blake: "More
// unique tags. Dropdown list should be included"). Grouped, anime-flavored;
// custom tags still ride the input. Every entry ≤24 chars (the render clamp).
const PROF_TAG_CATALOG = [
  ['Genres', '系', ['Action', 'Romance', 'Slice of Life', 'Fantasy', 'Isekai', 'Mecha', 'Sports', 'Horror', 'Psychological', 'Comedy', 'Drama', 'Sci-Fi']],
  ['Watch style', '流儀', ['Sub', 'Dub', 'Sub & Dub', 'Binge-watcher', 'Weekly watcher', 'Seasonal sampler', 'Completionist', 'Serial dropper', 'Rewatcher', 'Night-shift watcher']],
  ['Identity', '正体', ['Manga reader', 'Light-novel reader', 'AMV maker', 'Cosplayer', 'Figure collector', 'Tier-list maker', 'OST enjoyer', 'Sakuga nerd', 'Lore historian', 'Power-scaler', 'Theory crafter', 'Waifu connoisseur', 'Husbando defender', 'Filler apologist', 'Subtitle purist', 'Con-goer', 'Gacha survivor', 'Spoiler-phobic']],
];
const profState = {
  bio: '', status: '', tags: [], accent: '', accentGlow: false, frame: '', bgRef: '', featuredAnime: '',
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
  // gate 20.7 (Blake item 1): with a background in play, say plainly that the
  // PUBLIC card is the true render (the editor hero is a different width —
  // the crop reads wider there; Blake's call: a note, not a geometry change).
  const cropNote = document.getElementById('acct-crop-note');
  if (cropNote) cropNote.hidden = !bgUrl;
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
  host.toggleAttribute('data-accent-glow', !!profState.accentGlow);
  // gate 20.5 (item 9b) — the frame theme wraps the hero live
  if (profState.frame && frameKeyValid(profState.frame)) host.setAttribute('data-frame', profState.frame);
  else host.removeAttribute('data-frame');
  // gate 20.5 (item 9) — the accent ring is a real edge layer (true gradients)
  if (!host.querySelector('.pf-accent-ring')) {
    const ring = document.createElement('span');
    ring.className = 'pf-accent-ring'; ring.setAttribute('aria-hidden', 'true');
    host.appendChild(ring);
  }
  syncPreviewBg(host);   // bg layer: untouched unless its URL changed
  let head = host.querySelector('.profile-head');
  if (!head) { head = document.createElement('div'); head.className = 'profile-head'; host.appendChild(head); }
  head.innerHTML = `<div class="profile-avatar">${avatar}
        <button type="button" class="acct-hover-pill acct-hover-avatar" aria-label="Change avatar">✎ Change<br>avatar</button>
      </div>
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
  input.placeholder = input.disabled ? '6 of 6 — remove one to add' : 'Type your own + Enter';
  renderTagDropdown();
}

// the branded tag DROPDOWN — grouped catalog; an already-worn tag shows ticked;
// click toggles (add if room, remove if worn). Stays open for multi-picking.
function renderTagDropdown() {
  const dd = document.getElementById('acct-tag-dd');
  if (!dd) return;
  dd.innerHTML = '';
  PROF_TAG_CATALOG.forEach(([label, jp, items]) => {
    const head = document.createElement('div');
    head.className = 'acct-tag-dd-group';
    const jpEl = document.createElement('span'); jpEl.className = 'jp-mini'; jpEl.textContent = jp;
    head.textContent = label + ' '; head.appendChild(jpEl);
    dd.appendChild(head);
    const row = document.createElement('div');
    row.className = 'acct-tag-dd-row';
    items.forEach((t) => {
      const worn = profState.tags.indexOf(t) !== -1;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'acct-tag-dd-opt' + (worn ? ' is-worn' : '');
      b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(worn));
      b.textContent = worn ? '✓ ' + t : t;
      b.addEventListener('click', () => {
        if (worn) { const i = profState.tags.indexOf(t); if (i !== -1) profState.tags.splice(i, 1); }
        else addProfTag(t);
        renderTagEditor(); renderProfPreview();
      });
      row.appendChild(b);
    });
    dd.appendChild(row);
  });
}
function initTagDropdown() {
  const btn = document.getElementById('acct-tag-dd-btn');
  const dd = document.getElementById('acct-tag-dd');
  if (!btn || !dd || btn._wired) return;
  btn._wired = true;
  const setOpen = (open) => {
    dd.toggleAttribute('hidden', !open);
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('is-open', open);
  };
  btn.addEventListener('click', () => setOpen(dd.hasAttribute('hidden')));
  document.addEventListener('click', (e) => {
    if (!dd.hasAttribute('hidden') && !e.target.closest('.acct-tag-dd-wrap')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dd.hasAttribute('hidden')) { e.stopPropagation(); setOpen(false); btn.focus(); }
  });
}
function addProfTag(raw) {
  const t = String(raw || '').trim().slice(0, 24);
  if (!t || profState.tags.length >= 6 || profState.tags.indexOf(t) !== -1) return;
  profState.tags.push(t);
  renderTagEditor(); renderProfPreview();
}

// round 4 (Blake recurring #2) — the branded SELECT. Native <select> popups
// can't be themed (the OS white outline he kept reporting), so every dropdown
// on this page is now a button + listbox wearing the site's purple. Fully
// keyboard-driven: Enter/Space/ArrowDown opens, arrows rove, Home/End jump,
// Esc closes back to the button. There must be ZERO native <select> here —
// a spec pins that.
function brandSelect({ host, label, options, value, onChange }) {
  if (!host) return null;
  let cur = value || '';
  host.innerHTML = '';
  host.classList.add('acct-dd-wrap');
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'acct-dd-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  if (label) btn.setAttribute('aria-label', label);
  const txt = document.createElement('span'); txt.className = 'acct-dd-text';
  const chev = document.createElement('span'); chev.className = 'acct-dd-chev'; chev.setAttribute('aria-hidden', 'true'); chev.textContent = '▾';
  btn.appendChild(txt); btn.appendChild(chev);
  const menu = document.createElement('div');
  menu.className = 'acct-dd-menu'; menu.setAttribute('role', 'listbox');
  if (label) menu.setAttribute('aria-label', label);
  menu.hidden = true;
  host.appendChild(btn); host.appendChild(menu);

  const labelFor = (v) => { const o = options.find((x) => x.value === v); return o ? o.label : (options[0] ? options[0].label : ''); };
  const paint = () => {
    txt.textContent = labelFor(cur);
    menu.querySelectorAll('.acct-dd-opt').forEach((b) => {
      const on = b.getAttribute('data-value') === cur;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
  };
  options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'acct-dd-opt';
    b.setAttribute('role', 'option'); b.setAttribute('data-value', o.value);
    b.textContent = o.label;
    b.addEventListener('click', () => { cur = o.value; paint(); setOpen(false); btn.focus(); if (onChange) onChange(cur); });
    menu.appendChild(b);
  });
  const setOpen = (open) => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('is-open', open);
    if (open) (menu.querySelector('.acct-dd-opt.is-on') || menu.querySelector('.acct-dd-opt'))?.focus();
  };
  btn.addEventListener('click', () => setOpen(menu.hidden));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); }
  });
  menu.addEventListener('keydown', (e) => {
    const opts = Array.from(menu.querySelectorAll('.acct-dd-opt'));
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || opts[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (opts[i - 1] || opts[opts.length - 1]).focus(); }
    else if (e.key === 'Home') { e.preventDefault(); opts[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); opts[opts.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.focus(); }
  });
  host.addEventListener('focusout', (e) => {
    if (!menu.hidden && !host.contains(e.relatedTarget)) setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !host.contains(e.target)) setOpen(false);
  });
  paint();
  return {
    get value() { return cur; },
    set value(v) { cur = v || ''; paint(); },
  };
}

// round 4 (item 3) — the accent MENU: grouped solids + gradients, plus the
// glow switch. Click toggles; the live hero repaints immediately.
function renderAccentPicker() {
  const host = document.getElementById('acct-accents');
  if (!host) return;
  host.innerHTML = '';
  PROF_ACCENT_GROUPS.forEach(([label, jp, keys]) => {
    const head = document.createElement('div');
    head.className = 'acct-accent-group';
    const jpEl = document.createElement('span'); jpEl.className = 'jp-mini'; jpEl.textContent = jp;
    head.textContent = label + ' '; head.appendChild(jpEl);
    host.appendChild(head);
    const row = document.createElement('div');
    row.className = 'acct-accent-row';
    keys.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'acct-accent'; b.setAttribute('data-accent', a);
      b.setAttribute('role', 'radio'); b.title = a.replace(/^g-/, '');
      const on = profState.accent === a;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
      b.addEventListener('click', () => { profState.accent = (profState.accent === a) ? '' : a; renderAccentPicker(); renderProfPreview(); });
      row.appendChild(b);
    });
    host.appendChild(row);
  });
  // the glow switch — an outer aura on the frame + avatar, any accent
  const glowRow = document.createElement('div');
  glowRow.className = 'acct-accent-row acct-accent-row--glow';
  const glow = document.createElement('button');
  glow.type = 'button'; glow.className = 'acct-glow-toggle';
  glow.setAttribute('role', 'switch');
  glow.setAttribute('aria-checked', String(!!profState.accentGlow));
  glow.classList.toggle('is-on', !!profState.accentGlow);
  glow.innerHTML = `<span class="acct-glow-dot" aria-hidden="true"></span> Glow <span class="jp-mini">灯り</span>`;
  glow.addEventListener('click', () => { profState.accentGlow = !profState.accentGlow; renderAccentPicker(); renderProfPreview(); });
  glowRow.appendChild(glow);
  host.appendChild(glowRow);
}

// gate 20.5 (item 9b) — the FRAME picker: swatch tiles from window.RAR_FRAMES
// (frames.js; keys mirror the rules enum in lock-step). Blake's exclusive
// 'blake' tile renders ONLY for his account — and the RULES are what enforce
// the exclusivity (this UI filter is courtesy, not security).
function frameList() {
  const list = Array.isArray(window.RAR_FRAMES) ? window.RAR_FRAMES : [];
  const isBlake = !!(auth.currentUser && auth.currentUser.uid === RAR_ADMIN_UID);
  return list.filter((f) => f && f.key && (!f.blakeOnly || isBlake));
}
function frameKeyValid(k) {
  return frameList().some((f) => f.key === k);
}
function renderFramePicker() {
  const host = document.getElementById('acct-frames');
  if (!host) return;
  host.innerHTML = '';
  const mkTile = (key, label, jp, blakeOnly) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'acct-frame-tile' + (blakeOnly ? ' is-blake-tile' : '');
    b.setAttribute('role', 'radio');
    const on = (profState.frame || '') === key;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-checked', String(on));
    const sw = document.createElement('span');
    sw.className = 'frame-swatch';
    if (key) sw.setAttribute('data-frame', key);
    sw.setAttribute('aria-hidden', 'true');
    const nm = document.createElement('span');
    nm.className = 'acct-frame-name';
    nm.textContent = label;
    if (jp) { const j = document.createElement('span'); j.className = 'jp-mini'; j.textContent = ' ' + jp; nm.appendChild(j); }
    b.appendChild(sw); b.appendChild(nm);
    b.addEventListener('click', () => {
      profState.frame = (profState.frame === key) ? '' : key;
      renderFramePicker(); renderProfPreview();
      // 20.5 LOW: the rebuild dropped keyboard focus to <body> — land it back
      // on the picked tile.
      try { (document.querySelector('.acct-frame-tile.is-active') || document.querySelector('.acct-frame-tile'))?.focus(); } catch (_) {}
    });
    return b;
  };
  host.appendChild(mkTile('', 'Plain', '無地', false));
  frameList().forEach((f) => host.appendChild(mkTile(f.key, f.label || f.key, f.jp || '', !!f.blakeOnly)));
}

// background staging — upload happens on Save (the onProfileWritten CF sweeps
// the OLD object once bgRef changes, so no client-side delete dance).
const PROF_BG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
function renderBgThumb() {
  // gate 20 (item 2): the form-row thumb is gone — this now keeps the hero's
  // Remove-background pill in sync with whether a background exists.
  const removeBtn = document.getElementById('acct-bg-remove');
  if (!removeBtn) return;
  const url = profState.bgRemove ? '' : (profState.bgStagedUrl || profState.bgCurrentUrl);
  removeBtn.hidden = !url;
}
function initBgPicker() {
  const file = document.getElementById('acct-bg-file');
  if (!file) return;
  file.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    file.value = '';
    if (!f) return;
    if (PROF_BG_TYPES.indexOf(f.type) === -1) { errEl.textContent = 'Background must be JPEG, PNG, WebP, or GIF.'; return; }
    if (f.size > 5 * 1024 * 1024) { errEl.textContent = 'Background is over 5 MB — choose a smaller file.'; return; }
    errEl.textContent = '';
    // GIFs upload as-is (a canvas crop would freeze the animation); the server
    // pipeline re-encodes + strips metadata regardless. Stills go through the
    // FRAME THE NIGHT cropper first (round 4, item 2).
    let staged = f, mime = f.type;
    if (f.type !== 'image/gif') {
      const cropped = await openCropper({ file: f, mode: 'background' });
      if (!cropped) return;   // cancelled — keep the previous background
      if (cropped.blob.size > 5 * 1024 * 1024) { errEl.textContent = 'Background is over 5 MB after crop — choose a smaller file.'; return; }
      staged = cropped.blob; mime = cropped.mime;
    }
    profState.bgStagedBlob = staged; profState.bgStagedMime = mime; profState.bgRemove = false;
    if (profState.bgStagedUrl) { try { URL.revokeObjectURL(profState.bgStagedUrl); } catch (_) {} }
    profState.bgStagedUrl = URL.createObjectURL(staged);
    renderBgThumb(); renderProfPreview();
  });
}

// round 4 (item 4) — pro-site hover pickers: the hero preview IS the picker.
// Hovering (or focusing into) the hero raises two opaque pills — "Change
// avatar" on the circle, "Change background" top-right — wired straight to the
// existing hidden file inputs. Delegated, because the head rebuilds per
// keystroke; the bg pill is a persistent sibling of the head.
function initHeroPickers() {
  const host = document.getElementById('acct-preview');
  if (!host || host._pickersWired) return;
  host._pickersWired = true;
  const bgBtn = document.createElement('button');
  bgBtn.type = 'button';
  bgBtn.className = 'acct-hover-pill acct-hover-bg';
  bgBtn.textContent = '🌌 Change background';
  host.appendChild(bgBtn);
  bgBtn.addEventListener('click', () => document.getElementById('acct-bg-file')?.click());
  // gate 20 (item 2): with the form row gone, Remove lives on the hero too —
  // a second pill under Change, visible only while a background exists.
  const rmBtn = document.createElement('button');
  rmBtn.type = 'button';
  rmBtn.id = 'acct-bg-remove';
  rmBtn.className = 'acct-hover-pill acct-hover-bg-remove';
  rmBtn.textContent = '✕ Remove background';
  rmBtn.hidden = true;
  host.appendChild(rmBtn);
  rmBtn.addEventListener('click', () => {
    profState.bgRemove = true; profState.bgStagedBlob = null; profState.bgStagedMime = '';
    if (profState.bgStagedUrl) { try { URL.revokeObjectURL(profState.bgStagedUrl); } catch (_) {} profState.bgStagedUrl = ''; }
    renderBgThumb(); renderProfPreview();
  });
  host.addEventListener('click', (e) => {
    if (e.target.closest('.acct-hover-avatar')) avatarFile?.click();
  });
}

// featured-review picker — only the user's OWN reviews can be pinned (the
// public sheet fetches reviews/{key}/items/{their uid}, so it's structural).
// round 4: rides brandSelect (recurring #2 — no native <select> on this page).
async function loadFeaturedChoices(uid) {
  const host = document.getElementById('acct-featured-host');
  if (!host) return;
  const options = [{ value: '', label: 'None — let the latest speak' }];
  try {
    const snap = await getDocs(query(collectionGroup(db, 'items'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(60)));
    snap.forEach((d) => {
      if (!d.ref.path.startsWith('reviews/')) return;
      const v = d.data() || {}; if (v.removed) return;
      const key = d.ref.path.split('/')[1] || '';
      const label = (titleById.get(key) || (key.indexOf('al:') === 0 ? 'a season' : key.replace(/-/g, ' ')));
      options.push({ value: key, label: `${label} — “${String(v.title || '(review)').slice(0, 60)}”` });
    });
  } catch (_) { /* just the None option */ }
  const saved = profState.featuredAnime || '';
  // adversarial MED (3 lenses): NEVER write the dropdown's value back into
  // profState here — a failed/evicted fetch (the items CG is limit-60 across
  // reviews AND comments) would coerce the saved pin to '' and the next Save
  // of an unrelated edit would silently unpin. The pin changes ONLY on an
  // explicit user pick (onChange).
  brandSelect({
    host, label: 'Pinned review', options,
    value: options.some((o) => o.value === saved) ? saved : '',
    onChange: (v) => { profState.featuredAnime = v || ''; },
  });
}

// round 2 — "see what viewers see": renders the SAVED public identity with the
// real profile-sheet vocabulary (same classes; style.css is shared), inside the
// panel. Reads the profiles doc fresh so it shows what the room actually sees
// — unsaved edits stay in the editor.
function freezeIfReduced(img) {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  img.addEventListener('load', () => {
    try {
      const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
      const w = Math.min(nw, 1280), h = Math.max(1, Math.round(w * nh / nw));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.className = img.className;
      img.replaceWith(c);
    } catch (_) {}
  }, { once: true });
}
const VIEWER_AVATAR_RE = /^https:\/\/(firebasestorage\.googleapis\.com|lh3\.googleusercontent\.com)\//;
// gate 20.7 (Blake item 2): practice-emulator avatar origin, localhost-only
// (mirrors script.js safeAvatar — keep the three client gates in sync).
const PRACTICE_AVATAR_OK = (u) =>
  (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
  && /^http:\/\/127\.0\.0\.1:9199\//.test(String(u || ''));
async function renderViewerMode(user) {
  const host = document.getElementById('acct-viewer');
  if (!host) return;
  host.innerHTML = '<p class="muted">Opening the public view…</p>';
  // v1.10.2 (Blake's 3rd ask — supersedes the no-sheet heart spec): the admin
  // gets THE CREATOR SHEET now. His Public view renders it like any member's
  // preview (he wanted to SEE it), his Studio save may mint his profiles doc
  // (the rules' reserved-name denylist carries an admin carve-out), and the
  // sheet stays count-free — gold is never counted.
  const isCreator = user.uid === RAR_ADMIN_UID;
  let p = null;
  try { const s = await getDoc(doc(db, 'profiles', user.uid)); p = s.exists() ? s.data() : null; } catch (_) {}
  if (!p) {
    host.innerHTML = isCreator
      ? '<div class="acct-viewer-empty acct-viewer-empty--creator">🏮 <b>Your Creator sheet is ready to wear.</b><br>Save your profile once and every member who clicks your name meets it — gold kicker, the Den Keeper frame, and the path home to the Den.</div>'
      : '<div class="acct-viewer-empty">🌙 Nothing public yet — save your profile once and the room can see you.</div>';
    return;
  }
  // honesty (adversarial MED): a suspended account's viewers see the tombstone,
  // not the sheet — the preview must say so too (same copy as the live page).
  if (p.isBanned === true) {
    host.innerHTML = '<div class="acct-viewer-empty">🚫 <b>This account is suspended.</b><br>Viewers see this notice — not your profile.</div>';
    return;
  }
  // source the preview EXCLUSIVELY from the profiles doc (the live sheet never
  // reads auth) — an auth-name fallback here would present private PII as public.
  const name = esc(String(p.displayName || 'Member').slice(0, 40));
  const initial = esc((p.displayName || '?').toString().trim().charAt(0).toUpperCase() || '?');
  const photo = (typeof p.photoURL === 'string' && (VIEWER_AVATAR_RE.test(p.photoURL) || PRACTICE_AVATAR_OK(p.photoURL))) ? p.photoURL : '';
  const accent = (PROF_ACCENTS.indexOf(p.accent) !== -1) ? p.accent : '';
  const since = p.joinedAt && p.joinedAt.toMillis
    ? `<div class="profile-since">here since ${esc(new Date(p.joinedAt.toMillis()).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }))}</div>` : '';
  const status = (typeof p.status === 'string' && p.status.trim())
    ? `<div class="profile-status">${esc(String(p.status).slice(0, 80))}</div>` : '';
  const tags = (Array.isArray(p.tags) && p.tags.length)
    ? `<div class="profile-tags">${p.tags.slice(0, 6).map((t) => `<span class="profile-tag">${esc(String(t).slice(0, 24))}</span>`).join('')}</div>` : '';
  // bio renders through the SAME escape-first markdown as the live sheet
  // (markdown.js is loaded by account.html; esc() is the no-JS fallback).
  const bio = (typeof p.bio === 'string' && p.bio.trim())
    ? `<div class="profile-bio">${window.renderMarkdownInline ? window.renderMarkdownInline(String(p.bio)) : esc(p.bio)}</div>` : '';
  // viewers ALWAYS see the Appreciate row (the live sheet coerces a missing
  // count to 0) — the preview must too, or a fresh profile under-promises.
  // v1.10.2 HEART: except the CREATOR — gold is never counted; his preview
  // carries the gold kicker + the Den path instead, exactly like the live sheet.
  const likesCount = (typeof p.likesCount === 'number') ? p.likesCount : 0;
  const likes = isCreator ? '' : `<div class="profile-like-row"><button type="button" class="profile-like-btn" disabled title="Viewers can appreciate you here"><span class="profile-like-heart" aria-hidden="true">♥</span><span class="profile-like-verb">Appreciate</span></button><span class="profile-like-count" aria-label="appreciations">${Math.max(0, likesCount)}</span></div>`;
  const denPath = isCreator ? '<button type="button" class="profile-den-path" disabled><span class="den-path-glyph" aria-hidden="true">🏮</span> Visit the Den <span class="jp-mini">隠れ家へ</span><span class="den-path-arrow" aria-hidden="true">→</span></button>' : '';
  const vFrame = (typeof p.frame === 'string' && frameKeyValid(p.frame)) ? p.frame : (isCreator ? 'blake' : '');
  host.innerHTML = `<section class="profile-sheet acct-viewer-sheet${isCreator ? ' is-creator' : ''}"${accent ? ` data-accent="${esc(accent)}"` : ''}${p.accentGlow === true ? ' data-accent-glow' : ''}${vFrame ? ` data-frame="${esc(vFrame)}"` : ''}>
      <span class="pf-accent-ring" aria-hidden="true"></span>
      <div class="profile-kicker">${isCreator ? 'CREATOR <span class="jp-mini">創り手</span>' : 'MEMBER <span class="jp-mini">旅人</span>'}
        <span class="acct-viewer-badge">as last saved — exactly what viewers see</span></div>
      <div class="profile-body">
        <div class="profile-head">
          <div class="profile-avatar">${photo ? `<img src="${esc(photo)}" alt="">` : initial}</div>
          <h2 class="profile-name">${name}</h2>
          ${status}${since}${tags}${bio}${likes}
        </div>
        ${denPath}
        <div class="profile-featured-slot"></div>
        <div class="acct-viewer-foot">
          <span class="fld-hint">${isCreator ? 'your threads load on the live page · the Den path takes them home' : 'their threads · reviews load on the live page · viewers can also report a profile'}</span>
          <button type="button" class="linky" id="acct-viewer-live">Open the live page ↗</button>
        </div>
      </div>
    </section>`;
  // background — same pipeline shape as the real sheet (SDK-derived URL only)
  const bgRef = (typeof p.bgRef === 'string' && /^uploads\/[A-Za-z0-9_-]{1,128}\/profilebg\/[A-Za-z0-9_-]{1,120}$/.test(p.bgRef)) ? p.bgRef : '';
  const sheet = host.querySelector('.profile-sheet');
  if (bgRef && sheet) {
    try {
      const url = await getDownloadURL(storageRef(getStorage(), bgRef));
      sheet.classList.add('has-bg');
      const wrap = document.createElement('div');
      wrap.className = 'profile-bg-wrap'; wrap.setAttribute('aria-hidden', 'true');
      const img = document.createElement('img'); img.className = 'profile-bg'; img.alt = ''; img.decoding = 'async';
      freezeIfReduced(img);
      img.src = url;
      wrap.appendChild(img);
      sheet.insertBefore(wrap, sheet.firstChild);
    } catch (_) { /* dangling ref — the veil panel stands */ }
  }
  // the featured pin — the owner's own saved pick
  if (typeof p.featuredAnime === 'string' && /^[A-Za-z0-9:_-]{1,120}$/.test(p.featuredAnime)) {
    try {
      const fs = await getDoc(doc(db, 'reviews', p.featuredAnime, 'items', user.uid));
      if (fs.exists() && !(fs.data() || {}).removed) {
        const fv = fs.data() || {};
        const flabel = p.featuredAnime.indexOf('al:') === 0 ? 'a season' : p.featuredAnime.replace(/-/g, ' ');
        const slot = host.querySelector('.profile-featured-slot');
        if (slot) slot.innerHTML = `<div class="profile-featured">
            <span class="profile-featured-kicker">📌 PINNED REVIEW</span>
            <span class="profile-item-title">${esc(fv.title || '(review)')}</span>
            <span class="profile-item-sub">${esc(flabel)} · ${esc(String(fv.rating || ''))}/10</span>
          </div>`;
      }
    } catch (_) {}
  }
  document.getElementById('acct-viewer-live')?.addEventListener('click', () => {
    location.href = 'index.html#profile=' + encodeURIComponent(user.uid);
  });
}

// the Edit ↔ Public-view toggle
function initModeToggle(user) {
  const editBtn = document.getElementById('acct-mode-edit');
  const viewBtn = document.getElementById('acct-mode-view');
  const editMode = document.getElementById('acct-edit-mode');
  const viewMode = document.getElementById('acct-viewer-mode');
  if (!editBtn || !viewBtn || !editMode || !viewMode || editBtn._wired) return;
  editBtn._wired = true;
  const setMode = (m) => {
    const isEdit = m === 'edit';
    editBtn.classList.toggle('is-active', isEdit); editBtn.setAttribute('aria-selected', String(isEdit));
    viewBtn.classList.toggle('is-active', !isEdit); viewBtn.setAttribute('aria-selected', String(!isEdit));
    editMode.toggleAttribute('hidden', !isEdit);
    viewMode.toggleAttribute('hidden', isEdit);
    if (!isEdit) renderViewerMode(user);
  };
  editBtn.addEventListener('click', () => setMode('edit'));
  viewBtn.addEventListener('click', () => setMode('view'));
}

// round 2 — the consent DEAD-END fix: the banner shows while the rules are
// unaccepted; "Read the rules" opens the SAME branded modal the index uses
// (consent.js — acceptRules CF mints the doc server-side, never self-attested).
async function initConsentBanner(user) {
  const banner = document.getElementById('acct-consent-banner');
  const openBtn = document.getElementById('acct-consent-open');
  if (!banner || !openBtn || banner._wired) return;
  banner._wired = true;
  // wire the button FIRST — the save handler may unhide the banner later (a
  // cancelled consent), and its button must work regardless of the boot peek.
  openBtn.addEventListener('click', async () => {
    const res = await ensureConsent(user, db, functions, { adminUid: RAR_ADMIN_UID });
    if (res === 'ok') {
      banner.hidden = true;
      statusEl.textContent = 'Rules accepted — your profile is unlocked. 🔓';
    }
  });
  const d = await peekConsent(user, db, { adminUid: RAR_ADMIN_UID });
  if (d === 'consent') banner.hidden = false;   // ok / suspended / unknown stay hidden (suspended surfaces on action)
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
      profState.accentGlow = p.accentGlow === true;
      profState.frame = (typeof p.frame === 'string' && frameKeyValid(p.frame)) ? p.frame : '';
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
  renderTagEditor(); renderAccentPicker(); renderFramePicker(); renderBgThumb(); renderProfPreview();
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
  initHeroPickers();        // round 4 — hover-to-change on the hero preview
  initTagDropdown();        // round 2 — the curated catalog
  initModeToggle(user);     // round 2 — Edit ↔ Public view
  initConsentBanner(user);  // round 2 — accept the rules in place
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

// round 3 — slug → cover image (the activity rows show the anime's thumbnail).
const imageById = (() => {
  const arr = (window.__ANIME_DATA__ && Array.isArray(window.__ANIME_DATA__)) ? window.__ANIME_DATA__ : [];
  const map = new Map();
  arr.forEach(a => {
    const t = a?.Title;
    if (!t || !a.image) return;
    const id = slugFromTitle(t);
    if (id) map.set(id, String(a.image));
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

  const KIND_GLYPH = { comment: '💬', reply: '↩', thread: '📜', review: '✍' };   // no gold stars — the heart rule

  // gate 20 (Blake item 8) — snippets read like sentences, not source: image
  // tokens become 🖼, markdown markers are stripped. Render stays textContent
  // (plain text in, plain text out — no new HTML sink).
  function activityPlain(s) {
    let t = String(s || '');
    t = t.replace(/\[img:\d+\]/gi, '🖼');
    t = t.replace(/\|\|/g, '');                         // spoiler pipes (your own feed shows your own text)
    t = t.replace(/(\*\*|__|\*|_|~~)([^*_~]+)\1/g, '$2');   // **bold** *italic* ~~strike~~
    t = t.replace(/^#{1,4}\s+/gm, '');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }
  items.forEach((it) => {
    const li = document.createElement('li');
    li.className = 'saved-item activity-item';

    // round 3 — the whole row deep-links to the EXACT comment/reply/review with
    // the halo (#notif= rides the gate-6f landing machinery; al: keys land on
    // the secondary modal via the gate-19 bridge). Forum items keep #forum=.
    const go = () => {
      const href = it.path ? `index.html#notif=${encodeURIComponent(it.path)}`
        : (it.href || (it.animeId ? `index.html#open=${encodeURIComponent(it.animeId)}` : ''));
      if (href) location.href = href;
    };

    const glyph = document.createElement('span');
    glyph.className = 'act-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = KIND_GLYPH[it.kind] || '✦';

    // review rows carry the anime's cover for the at-a-glance scan
    const img = it.kind === 'review' ? imageById.get(it.animeId) : null;
    let thumbEl = null;
    if (img && /^[A-Za-z0-9._-]+$/.test(img)) {
      thumbEl = document.createElement('img');
      thumbEl.className = 'act-thumb';
      thumbEl.alt = ''; thumbEl.loading = 'lazy';
      thumbEl.onerror = () => { try { thumbEl.replaceWith(glyph); } catch (_) {} };   // a missing asset falls back to the glyph, never a broken-image box
      thumbEl.src = 'assets/' + img;
    }

    const main = document.createElement('div');
    main.className = 'activity-main';

    const openBtn = document.createElement('button');
    openBtn.className = 'saved-open';
    openBtn.type = 'button';
    openBtn.textContent = it.title || it.animeId;
    openBtn.title = 'Open in place (with the halo)';
    openBtn.addEventListener('click', go);

    const desc = document.createElement('div');
    desc.className = 'activity-desc';
    desc.textContent = activityPlain(it.desc);

    const dateEl = document.createElement('span');
    dateEl.className = 'saved-date';
    dateEl.textContent = formatDate(it.ms);

    main.appendChild(openBtn);
    main.appendChild(desc);

    if (thumbEl) li.appendChild(thumbEl); else li.appendChild(glyph);
    li.appendChild(main);
    li.appendChild(dateEl);
    // the row itself is clickable too (intuitive target, not just the title)
    li.addEventListener('click', (e) => { if (!e.target.closest('button')) go(); });
    li.classList.add('is-linked');

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
      const title = titleById.get(animeId) || (String(animeId).indexOf('al:') === 0 ? 'A season (beyond the reviews)' : animeId);
      const ms = toMillis(data.editedAt || data.updatedAt || data.createdAt);
      if (root === 'comments') {
        next.push({ animeId, title, ms, kind: 'comment', path: d.ref.path, desc: `Commented: ${shorten(data.text)}` });
      } else if (root === 'reviews') {
        const rt = (data.title || '').trim();
        const r = (typeof data.rating === 'number') ? data.rating : null;
        next.push({ animeId, title, ms, kind: 'review', path: d.ref.path, desc: r ? `Reviewed (${r}/10): ${shorten(rt)}` : `Reviewed: ${shorten(rt)}` });
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
      const title = titleById.get(animeId) || (String(animeId).indexOf('al:') === 0 ? 'A season (beyond the reviews)' : animeId);
      const ms = toMillis(data.editedAt || data.updatedAt || data.createdAt);
      next.push({ animeId, title, ms, kind: 'reply', path: d.ref.path, desc: `Discussion comment: ${shorten(data.text)}` });
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
        next.push({ animeId, title: titleById.get(animeId) || (String(animeId).indexOf('al:') === 0 ? 'A season (beyond the reviews)' : animeId), ms: toMillis(data.editedAt || data.updatedAt || data.createdAt),
          kind: 'reply', path: d.ref.path, desc: `Replied: ${shorten(data.text)}` });
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
      // reviewed kicker / carousel ✓ badge).
      // round 4 (Blake item 6: "load the preview png") — catalog rows now carry
      // the catalog cover too (imageById, the Activity-thumb pattern), so list
      // AND grid read as covers for both row types.
      openBtn.classList.add('saved-open--catalog', 'saved-open--rich');
      const asset = imageById.get(it.animeId);
      const cover = asset
        ? `<img class="saved-cover" src="assets/${esc(asset)}" alt="" loading="lazy">`
        : `<span class="saved-cover saved-cover--ph" aria-hidden="true"></span>`;
      openBtn.innerHTML = cover +
        `<span class="saved-meta">` +
          `<span class="saved-title">${esc(it.title || it.animeId)}</span>` +
          `<span class="saved-reviewed" title="Reviewed by Blake">✓ REVIEWED</span>` +
        `</span>`;
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
        console.error('saved-item remove failed', e);
        alert('Could not remove: ' + friendlyError(e, { kind: 'save' }));
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
  watchlist: { items: [], filter: '', sort: 'recent', type: 'all', view: 'list' },
  favorites: { items: [], filter: '', sort: 'recent', type: 'all', view: 'list' },
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
  if (listEl) listEl.classList.toggle('is-grid', st.view === 'grid');   // round 2 — cover view
  renderSaved(listEl, emptyEl, v, kind, uid);
}
function initSavedControls(uid) {
  ['watchlist', 'favorites'].forEach((kind) => {
    const host = document.querySelector(`[data-saved-controls="${kind}"]`);
    if (!host || host._wired) return;
    host._wired = true;
    const st = savedView[kind];
    host.querySelector('.saved-filter')?.addEventListener('input', (e) => { st.filter = e.target.value.trim(); repaintSaved(kind, uid); });
    // round 4 — the sort rides brandSelect (recurring #2: zero native <select>)
    brandSelect({
      host: host.querySelector('[data-sort-dd]'),
      label: `Sort ${kind}`,
      options: [
        { value: 'recent', label: 'Recently added' },
        { value: 'alpha', label: 'A → Z' },
        { value: 'year', label: 'By year' },
      ],
      value: st.sort || 'recent',
      onChange: (v) => { st.sort = v; repaintSaved(kind, uid); },
    });
    host.querySelectorAll('.saved-type-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        st.type = chip.getAttribute('data-type') || 'all';
        host.querySelectorAll('.saved-type-chip').forEach((c) => c.classList.toggle('is-active', c === chip));
        repaintSaved(kind, uid);
      });
    });
    // round 2 — list ↔ cover view (the panel-head toggle)
    const vm = document.querySelector(`[data-viewmode="${kind}"]`);
    if (vm && !vm._wired) {
      vm._wired = true;
      vm.querySelectorAll('.saved-view-btn').forEach((b) => {
        b.addEventListener('click', () => {
          st.view = b.getAttribute('data-view') || 'list';
          vm.querySelectorAll('.saved-view-btn').forEach((c) => c.classList.toggle('is-active', c === b));
          repaintSaved(kind, uid);
        });
      });
    }
  });
}

// =============================================================================
// PERSONAL COLLECTIONS — round 4 (Blake item 7): user-made shelves under
// users/{uid}/collections/{id} {name, public, items[], createdAt, updatedAt}.
// Private by default; flipping public is consent-gated (rules-enforced, and
// pre-flighted here with the shared consent modal). Public shelves render on
// the live profile (script.js). Items are snapshots {animeId, title,
// coverImage} — same shape as saved rows, so covers paint without a network.
// =============================================================================
let unsubCollections = null;
let _colWired = false;

// cover sources are pinned to our own assets or https (hubSafeCover discipline
// — a collection item is a render sink like any other cover).
function colSafeCover(src) {
  const s = String(src || '');
  if (/^assets\/[A-Za-z0-9._-]{1,120}$/.test(s)) return s;
  if (/^https:\/\/[^"'<>\s]{1,400}$/.test(s)) return s;
  return '';
}
function colId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// candidates for the add-picker: Blake's catalog + the user's saved entries
function colCandidates() {
  // gate 20 (item 6): the user's OWN saves lead the list (Blake: "should also
  // include anime that they've already added to their favorites or watchlist
  // not just my reviewed list"); the 44 follow.
  const out = new Map();
  ['watchlist', 'favorites'].forEach((kind) => {
    (savedView[kind].items || []).forEach((it) => {
      if (!out.has(it.animeId)) out.set(it.animeId, {
        animeId: String(it.animeId).slice(0, 130),
        title: String(it.title || it.animeId).slice(0, 120),
        coverImage: String(it.coverImage || '').slice(0, 400),
        src: 'saved',
      });
    });
  });
  const arr = (window.__ANIME_DATA__ && Array.isArray(window.__ANIME_DATA__)) ? window.__ANIME_DATA__ : [];
  arr.forEach((a) => {
    const t = a?.Title; if (!t) return;
    const id = slugFromTitle(t); if (!id) return;
    if (!out.has(id)) out.set(id, { animeId: id, title: String(t).slice(0, 120), coverImage: a.image ? 'assets/' + String(a.image) : '', src: 'catalog' });
  });
  const rows = Array.from(out.values());
  rows.sort((a, b) => (a.src === b.src ? a.title.localeCompare(b.title) : (a.src === 'saved' ? -1 : 1)));
  return rows;
}

async function colWrite(uid, id, data) {
  await setDoc(doc(db, 'users', uid, 'collections', id),
    { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// the add-picker — a branded overlay: your saves + the 44 up front, and a LIVE
// wider-world search as you type (gate 20 item 6 — the Discover search infra,
// debounced + abortable; no provider names in the copy).
function openColAdder(uid, col) {
  const existing = new Set((col.items || []).map((x) => x.animeId));
  const overlay = document.createElement('div');
  overlay.className = 'col-adder-overlay';
  overlay.innerHTML = `<div class="col-adder" role="dialog" aria-modal="true" aria-label="Add anime to ${esc(col.name)}">
      <div class="col-adder-head"><span class="fld-pill">＋ Add to “${esc(String(col.name).slice(0, 40))}”</span>
        <button type="button" class="col-adder-close" aria-label="Close">×</button></div>
      <input type="search" class="col-adder-search" placeholder="Search anime — yours, or anything out there…" aria-label="Search anime" />
      <div class="col-adder-list" role="list"></div>
    </div>`;
  document.body.appendChild(overlay);
  const listEl = overlay.querySelector('.col-adder-list');
  const searchEl = overlay.querySelector('.col-adder-search');
  const all = colCandidates();
  let extRows = [];        // live wider-world results for the current needle
  let extAbort = null;
  let extTimer = null;
  let extLoading = false;

  const rowFor = (c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'col-adder-row';
    const cov = colSafeCover(c.coverImage);
    b.innerHTML = (cov ? `<img class="saved-cover" src="${esc(cov)}" alt="" loading="lazy">`
      : '<span class="saved-cover saved-cover--ph" aria-hidden="true"></span>')
      + `<span class="saved-title">${esc(c.title)}</span>`;
    b.addEventListener('click', async () => {
      // adversarial MED: at the 200-item rules cap, concat+slice dropped the
      // NEW item and the write "succeeded" — silent false-success. Say so.
      if ((col.items || []).length >= 200) { alert('This shelf is full — 200 titles max. Make another shelf!'); return; }
      b.disabled = true;
      try {
        const items = (col.items || []).concat([{ animeId: c.animeId, title: c.title, coverImage: c.coverImage }]);
        await colWrite(uid, col.id, { items });
        existing.add(c.animeId); col.items = items;
        paint(searchEl.value);
      } catch (e) { console.error('shelf add failed', e); alert('Could not add: ' + friendlyError(e, { kind: 'save' })); b.disabled = false; }
    });
    return b;
  };
  const group = (label, jp) => {
    const h = document.createElement('div');
    h.className = 'col-adder-group';
    h.innerHTML = `${esc(label)} <span class="jp-mini">${esc(jp)}</span>`;
    return h;
  };
  const paint = (q) => {
    const needle = String(q || '').toLowerCase();
    listEl.innerHTML = '';
    const locals = all.filter((c) => !existing.has(c.animeId) && (!needle || c.title.toLowerCase().includes(needle))).slice(0, 60);
    if (locals.length) {
      listEl.appendChild(group("Your lists & Blake's reviews", '棚'));
      locals.forEach((c) => listEl.appendChild(rowFor(c)));
    }
    const ext = extRows.filter((c) => !existing.has(c.animeId) && !all.some((l) => l.animeId === c.animeId));
    if (needle.length >= 3 && (ext.length || extLoading)) {
      listEl.appendChild(group('From the wider world', '検索'));
      if (extLoading && !ext.length) {
        const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Searching…';
        listEl.appendChild(p);
      }
      ext.forEach((c) => listEl.appendChild(rowFor(c)));
    }
    if (!listEl.children.length) listEl.innerHTML = '<p class="muted">No matches — try a different title.</p>';
  };
  const extSearch = (q) => {
    const term = String(q || '').trim();
    clearTimeout(extTimer);
    if (extAbort) { try { extAbort.abort(); } catch (_) {} extAbort = null; }
    if (term.length < 3 || !window.franchiseFetch?.searchMediaList) { extRows = []; extLoading = false; return; }
    extLoading = true;
    extRows = [];   // a new needle clears the previous term's rows immediately
    extTimer = setTimeout(async () => {
      extAbort = new AbortController();
      const got = await window.franchiseFetch.searchMediaList(term, 12, extAbort.signal);
      // a stale response must not clobber a newer query's rows (case-folded
      // BOTH sides — adversarial LOW)
      if (searchEl.value.trim().toLowerCase() !== term.trim().toLowerCase()) return;
      extRows = (got || []).map((m) => ({
        animeId: 'al:' + m.id,
        title: String(m.title?.english || m.title?.romaji || ('#' + m.id)).slice(0, 120),
        coverImage: String(m.coverImage?.large || '').slice(0, 400),
      }));
      extLoading = false;
      paint(searchEl.value);
    }, 350);
  };
  paint('');
  searchEl.addEventListener('input', () => { extSearch(searchEl.value); paint(searchEl.value); });
  const close = () => {
    clearTimeout(extTimer);
    if (extAbort) { try { extAbort.abort(); } catch (_) {} }
    try { overlay.remove(); } catch (_) {}
    document.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.col-adder-close')) close(); });
  searchEl.focus();
}

function renderCollections(uid, cols) {
  const host = document.getElementById('col-list');
  const empty = document.getElementById('col-empty');
  if (!host || !empty) return;
  host.innerHTML = '';
  empty.hidden = !!cols.length;
  cols.forEach((col) => {
    const card = document.createElement('section');
    card.className = 'col-card';
    const isPub = col.public === true;
    card.innerHTML = `<div class="col-card-head">
        <span class="col-card-name">${esc(col.name || '(unnamed)')}</span>
        <button type="button" class="col-vis ${isPub ? 'is-public' : ''}" title="${isPub ? 'Public — on your profile. Click to make private.' : 'Private — only you. Click to publish.'}"
          role="switch" aria-checked="${isPub}">${isPub ? '🌐 Public' : '🔒 Private'}</button>
        <span class="col-count">${(col.items || []).length} title${(col.items || []).length === 1 ? '' : 's'}</span>
        <span class="col-card-tools">
          <button type="button" class="linky col-rename">Rename</button>
          <button type="button" class="linky col-describe">${col.description ? 'Edit description' : 'Add description'}</button>
          <button type="button" class="linky col-del">Delete</button>
        </span>
      </div>
      ${col.description ? `<p class="col-card-desc">${esc(col.description)}</p>` : ''}
      <div class="col-items"></div>
      <button type="button" class="col-add inline-header-btn small">＋ Add anime</button>`;
    const itemsEl = card.querySelector('.col-items');
    (col.items || []).forEach((it, i) => {
      const row = document.createElement('span');
      row.className = 'col-item';
      const cov = colSafeCover(it.coverImage);
      row.innerHTML = (cov ? `<img class="col-item-cover" src="${esc(cov)}" alt="" loading="lazy" title="${esc(it.title || '')}">`
        : `<span class="col-item-cover col-item-cover--ph" title="${esc(it.title || '')}">${esc(String(it.title || '?').charAt(0))}</span>`)
        + `<button type="button" class="col-item-x" aria-label="Remove ${esc(it.title || 'item')}">×</button>`;
      row.querySelector('.col-item-x').addEventListener('click', async () => {
        try {
          const items = col.items.slice(); items.splice(i, 1);
          await colWrite(uid, col.id, { items });
        } catch (e) { console.error('collection remove failed', e); alert('Could not remove: ' + friendlyError(e, { kind: 'save' })); }
      });
      itemsEl.appendChild(row);
    });
    if (!(col.items || []).length) itemsEl.innerHTML = '<span class="muted col-items-empty">empty shelf — add something you love</span>';
    card.querySelector('.col-add').addEventListener('click', () => openColAdder(uid, col));
    card.querySelector('.col-vis').addEventListener('click', async () => {
      try {
        if (!isPub) {
          // publishing is a community act — the shared consent gate fronts it
          const res = await ensureConsent(auth.currentUser, db, functions, { adminUid: RAR_ADMIN_UID });
          if (res !== 'ok') return;
        }
        await colWrite(uid, col.id, { public: !isPub });
      } catch (e) { console.error('visibility change failed', e); alert('Could not change visibility: ' + friendlyError(e, { kind: 'save' })); }
    });
    card.querySelector('.col-del').addEventListener('click', async () => {
      if (!card.dataset.confirmDel) {
        card.dataset.confirmDel = '1';
        card.querySelector('.col-del').textContent = 'Really delete?';
        setTimeout(() => { try { delete card.dataset.confirmDel; card.querySelector('.col-del').textContent = 'Delete'; } catch (_) {} }, 2600);
        return;
      }
      try { await deleteDoc(doc(db, 'users', uid, 'collections', col.id)); } catch (e) { console.error('collection delete failed', e); alert('Could not delete: ' + friendlyError(e, { kind: 'save' })); }
    });
    // gate 20 (item 7) — the description editor, same inline shape as rename
    card.querySelector('.col-describe').addEventListener('click', () => {
      if (card.querySelector('.col-desc-input')) return;
      const input = document.createElement('textarea');
      input.maxLength = 200; input.rows = 2; input.className = 'col-desc-input';
      input.value = col.description || '';
      input.placeholder = "What's this shelf about?";
      const anchor = card.querySelector('.col-card-desc');
      if (anchor) anchor.replaceWith(input);
      else card.querySelector('.col-card-head').insertAdjacentElement('afterend', input);
      input.focus();
      // gate-20 adversarial MED (4 lenses): the input must REMOVE ITSELF on
      // commit — the snapshot repaint defers while any editor is open, so a
      // lingering input deadlocked the panel (and blur double-committed).
      const commit = async () => {
        if (input.dataset.done) return;
        input.dataset.done = '1';
        const v = input.value.trim().slice(0, 200);
        try { input.remove(); } catch (_) {}
        if (v !== (col.description || '')) {
          try { await colWrite(uid, col.id, { description: v || deleteField() }); }
          catch (e) { console.error('description save failed', e); alert('Could not save the description: ' + friendlyError(e, { kind: 'save' })); renderCollections(uid, cols); }
        } else renderCollections(uid, cols);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { input.dataset.done = '1'; renderCollections(uid, cols); }
      });
      input.addEventListener('blur', commit);
    });
    card.querySelector('.col-rename').addEventListener('click', () => {
      const nameEl = card.querySelector('.col-card-name');
      const input = document.createElement('input');
      input.type = 'text'; input.maxLength = 60; input.value = col.name || ''; input.className = 'col-rename-input';
      nameEl.replaceWith(input); input.focus(); input.select();
      const commit = async () => {
        if (input.dataset.done) return;   // same deadlock class as the description editor
        input.dataset.done = '1';
        const v = input.value.trim().slice(0, 60);
        try { input.remove(); } catch (_) {}
        if (v && v !== col.name) { try { await colWrite(uid, col.id, { name: v }); } catch (e) { console.error('rename failed', e); alert('Rename failed: ' + friendlyError(e, { kind: 'save' })); renderCollections(uid, cols); } }
        else renderCollections(uid, cols);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { input.dataset.done = '1'; renderCollections(uid, cols); }
      });
      input.addEventListener('blur', commit);
    });
    host.appendChild(card);
  });
}

function ensureCollections() {
  const u = auth.currentUser;
  if (!u) return;
  if (!_colWired) {
    _colWired = true;
    const composer = document.getElementById('col-composer');
    const nameEl = document.getElementById('col-name');
    let visDd = null;
    document.getElementById('col-new')?.addEventListener('click', () => {
      composer.hidden = !composer.hidden;
      if (!composer.hidden) {
        if (!visDd) visDd = brandSelect({
          host: document.getElementById('col-visibility-host'), label: 'Visibility',
          options: [{ value: '', label: '🔒 Private — only you' }, { value: 'pub', label: '🌐 Public — on your profile' }],
          value: '',
        });
        nameEl.focus();
      }
    });
    document.getElementById('col-cancel')?.addEventListener('click', () => { composer.hidden = true; });
    document.getElementById('col-create')?.addEventListener('click', async () => {
      const name = (nameEl.value || '').trim().slice(0, 60);
      if (!name) { nameEl.focus(); return; }
      const wantPub = visDd && visDd.value === 'pub';
      const descEl = document.getElementById('col-desc');
      const desc = (descEl?.value || '').trim().slice(0, 200);
      try {
        if (wantPub) {
          const res = await ensureConsent(auth.currentUser, db, functions, { adminUid: RAR_ADMIN_UID });
          if (res !== 'ok') return;
        }
        const data = {
          name, public: !!wantPub, items: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        };
        if (desc) data.description = desc;   // optional — gate 20 item 7
        await setDoc(doc(db, 'users', u.uid, 'collections', colId()), data);
        nameEl.value = ''; if (descEl) descEl.value = ''; composer.hidden = true;
      } catch (e) { console.error('collection create failed', e); alert('Could not create: ' + friendlyError(e, { kind: 'save' })); }
    });
    nameEl?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('col-create')?.click(); });
  }
  if (unsubCollections) return;   // already live
  unsubCollections = onSnapshot(
    query(collection(db, 'users', u.uid, 'collections'), orderBy('updatedAt', 'desc')),
    (snap) => {
      // adversarial MED (the comment-list rebuild class): a snapshot landing
      // mid-RENAME (or mid-description, gate 20) would innerHTML the open
      // input away and eat the typing. Defer — the commit's own write triggers
      // the next snapshot and repaints everything anyway.
      if (document.querySelector('.col-rename-input, .col-desc-input')) return;
      const cols = [];
      snap.forEach((d) => { const v = d.data() || {}; cols.push({ id: d.id, name: v.name, public: v.public, description: typeof v.description === 'string' ? v.description : '', items: Array.isArray(v.items) ? v.items : [] }); });
      renderCollections(u.uid, cols);
    },
    (err) => console.error('Collections failed:', err)
  );
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
    verifyMsg.style.color = '#cbb0ff';   // purple-family notice (gold-adjacent #ffdf96 read as Blake's temperature)
  } catch (e) {
    console.error('verification email failed', e);
    alert('Could not send the verification email — ' + friendlyError(e, { kind: 'post' }));
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
    console.error('password check failed', e); alert('That current password didn’t match — try again.');
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
    console.error('password change failed', e); alert('Failed to change the password — ' + friendlyError(e, { kind: 'save' }));
  }
});

resetPassBtn?.addEventListener('click', async () => {
  const u = auth.currentUser; if (!u?.email) return;
  try {
    await sendPasswordResetEmail(auth, u.email);
    alert('Reset email sent to ' + u.email);
  } catch (e) {
    console.error('reset email failed', e);
    alert('Could not send the reset email — ' + friendlyError(e, { kind: 'post' }));
  }
});

avatarPick?.addEventListener('click', () => avatarFile?.click());

let _avatarPreviewUrl = '';   // adversarial LOW: revoke across re-picks
avatarFile?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';   // re-picking the same file must re-fire change
  if (!file) return;
  try {
    let staged;
    // round 4 (item 2) — the FRAME IT cropper: drag/zoom the circle like a
    // modern social app. GIFs skip it (canvas would freeze the animation) and
    // ride the legacy downscale, same as before.
    if (/image\/(jpeg|png|webp)/.test(file.type || '')) {
      const cropped = await openCropper({ file, mode: 'avatar' });
      if (!cropped) return;   // cancelled — keep whatever was staged before
      staged = cropped;
    } else {
      staged = await downscaleImage(file, 512);
    }
    // adversarial LOW: the avatars/ storage rule caps at 2 MB (the old 5 MB
    // check was dead letter — the upload would bounce at Save).
    if (staged.blob.size > 2 * 1024 * 1024) throw new Error('Avatar is over 2 MB after processing. Use a smaller image.');
    newAvatarBlob = staged.blob;
    newAvatarMime = staged.mime;
    // Preview the chosen image in the circle
    if (_avatarPreviewUrl) { try { URL.revokeObjectURL(_avatarPreviewUrl); } catch (_) {} }
    _avatarPreviewUrl = URL.createObjectURL(staged.blob);
    avatarPick.innerHTML = `<img src="${_avatarPreviewUrl}" alt="">`;
    renderProfPreview();      // the hero circle updates live too
    avatarPick.focus();       // adversarial LOW: the hero pill the crop started
                              // from is rebuilt — land focus somewhere real
  } catch (err) {
    console.error('avatar staging failed', err);   // v1.10.1: raw → console only
    alert(friendlyError(err, { kind: 'upload', user: auth.currentUser }));
    newAvatarBlob = null;
    newAvatarMime = '';
  }
});


// Sign out (both spots)
async function doSignOut() {
  try { await signOut(auth); }
  finally {
    // gate 20 (Blake item 1) — sign-out is a fresh arrival: let the door greet
    // again (it's once-per-session; an in-tab sign-out otherwise skipped it).
    try { sessionStorage.removeItem('rar:welcomed'); } catch (_) {}
    location.href = 'index.html';
  }
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
    // round 2 — the consent dead-end fix: a gated save offers the rules IN
    // PLACE (the same CF-minted flow as the first post). 'cancelled' falls
    // through to the legacy name/photo save with the honest message below;
    // 'ok' proceeds with the full profile write. Already-consented users hit
    // the session cache (no modal, ≤1 read).
    const consentRes = await ensureConsent(u, db, functions, { adminUid: RAR_ADMIN_UID });
    const consentOk = consentRes === 'ok';
    if (consentOk) {
      const cb = document.getElementById('acct-consent-banner');
      if (cb) cb.hidden = true;
    }

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

    // round-2 walk catch: the Auth API rejects photoURL:null ("photourl must be
    // string"), which ABORTED the whole save for any avatar-less account. Only
    // send the field when there is a photo.
    await updateProfile(u, photo ? { displayName: name, photoURL: photo } : { displayName: name });
    await setDoc(doc(db, 'users', u.uid), { username: name, photoURL: photo }, { merge: true });

    // dream-profile — stage the background upload BEFORE the profiles write so
    // bgRef only ever points at an object that exists. The onProfileWritten CF
    // sweeps the old object once the pointer moves; a failed upload surfaces
    // honestly (verify-email / size are the usual suspects) and the save of
    // everything else still proceeds.
    let nextBgRef = profState.bgRemove ? null : (profState.bgRef || null);
    let bgUploadErr = '';
    if (profState.bgStagedBlob && !profState.bgRemove && consentOk) {
      try {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        const path = `uploads/${u.uid}/profilebg/${id}`;
        await uploadBytes(storageRef(getStorage(), path), profState.bgStagedBlob, { contentType: profState.bgStagedMime });
        nextBgRef = path;
      } catch (bgErr) {
        // honest partial-save copy (adversarial LOW): the rest of the profile
        // still saves below — say so instead of implying nothing did.
        // v1.10.1 HOTFIX: the old permission branch blamed the consent gate and
        // told Blake to "Hit Save again" forever, on prod, for a Storage-side
        // denial the retry could never fix. The ONE branded-error module owns
        // the truthful split now (verify-email vs site-side lock vs generic);
        // the raw error goes to the console only.
        console.error('background upload failed', bgErr);
        bgUploadErr = 'Saved — but the background didn\'t upload: '
          + friendlyError(bgErr, { kind: 'upload', user: u });
      }
    }

    // v1.10.0 gate 15 → dream-profile — the public profile doc now carries the
    // whole identity (name/photo/bio/status/tags/accent/bgRef/featuredAnime).
    // Best-effort: the staged rules consent-gate profiles writes, so a
    // pre-consent save must not break the legacy path above — but it now SAYS
    // so instead of failing silent.
    let profWriteOk = consentOk;   // a declined consent skips the public write cleanly
    // gate 20.6 (Blake item 6): the write is a closure so the no-dead-end retry
    // below can run the SAME write after a re-offered consent lands.
    const writeProfileDoc = async () => {
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
        accentGlow: profState.accentGlow === true ? true : deleteField(),
        bgRef: nextBgRef,
        featuredAnime: profState.featuredAnime || null,
      };
      // 20.5 adversarial LOW: if frames.js ever fails to load, frameKeyValid
      // is false for EVERYTHING and a blanket deleteField would silently wipe
      // the member's saved frame on an unrelated save — touch the key only
      // when the manifest is actually present.
      if (Array.isArray(window.RAR_FRAMES) && window.RAR_FRAMES.length) {
        pData.frame = (profState.frame && frameKeyValid(profState.frame)) ? profState.frame : deleteField();
      }
      if (!pSnap.exists()) pData.joinedAt = serverTimestamp();   // member-since: first write only
      await setDoc(pref, pData, { merge: true });
      profState.bgRef = nextBgRef || '';
    };
    if (consentOk) try { await writeProfileDoc(); } catch (_profileErr) {
      profWriteOk = false;
    }

    // gate-20.6 adversarial MED: the bg-upload early-return used to run FIRST,
    // which preempted the consent re-offer below whenever a background was
    // staged — the blip scenario then showed "Saved — …" while NOTHING public
    // had saved. The profile-write outcome (incl. the re-offer + retry) now
    // resolves first; the bg message only stands once it's honest.
    if (!profWriteOk) {
      // round-2 adversarial MED: 'suspended' must not get the accept-the-rules
      // copy (the suspended modal already fired; a banned account can't comply).
      if (consentRes === 'suspended') {
        errEl.textContent = 'Your account is suspended — public profile changes are paused.';
        saveBtn.disabled = false; return;
      }
      // gate 20.6 (Blake item 6): no banner dead-ends — the rules COME TO the
      // save. This branch with consentRes 'ok' means the gate read degraded on
      // a blip (the modal never showed) and the rules then denied the write —
      // re-offer the modal IN PLACE and retry the write once. A 'cancelled'
      // user just declined the modal seconds ago: don't nag with a second one,
      // but tell them Save itself re-offers (no banner hunt required).
      if (consentRes === 'ok') {
        const again = await ensureConsent(u, db, functions, { adminUid: RAR_ADMIN_UID });
        if (again === 'suspended') {
          errEl.textContent = 'Your account is suspended — public profile changes are paused.';
          saveBtn.disabled = false; return;
        }
        if (again === 'ok') {
          // a consent that just landed unblocks the staged background too —
          // retry the upload before the write so bgRef points at a real object
          if (bgUploadErr && profState.bgStagedBlob && !profState.bgRemove) {
            try {
              const rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
              const rpath = `uploads/${u.uid}/profilebg/${rid}`;
              await uploadBytes(storageRef(getStorage(), rpath), profState.bgStagedBlob, { contentType: profState.bgStagedMime });
              nextBgRef = rpath;
              bgUploadErr = '';
            } catch (_bgRetryErr) { /* the original message stands */ }
          }
          try { await writeProfileDoc(); profWriteOk = true; } catch (_e) {}
        }
        if (!profWriteOk) {
          if (again === 'cancelled') {
            const cb = document.getElementById('acct-consent-banner');
            if (cb) cb.hidden = false;
            errEl.textContent = 'Your name is saved. The public profile bits (bio, tags, background…) unlock once you accept the community rules — hit Save again and they\'ll pop right back up.';
          } else {
            errEl.textContent = 'Your name is saved, but the public profile changes didn\'t go through — give it a moment and hit Save again.';
          }
          saveBtn.disabled = false; return;
        }
      } else {
        const cb = document.getElementById('acct-consent-banner');
        if (cb) cb.hidden = false;   // secondary affordance, not the only door
        errEl.textContent = 'Your name is saved. The public profile bits (bio, tags, background…) unlock once you accept the community rules — hit Save again and they\'ll pop right back up.';
        saveBtn.disabled = false; return;
      }
    }
    // the profile write is resolved (possibly via the re-offer) — a bg error
    // shown now is truthful: everything else DID save.
    if (bgUploadErr) { errEl.textContent = bgUploadErr; saveBtn.disabled = false; return; }

    // round 3 — a branded "saved" toast lands FIRST (a bare hard reload read as
    // a glitch, not a confirmation); the reload still follows so every header
    // token / preview repaints consistently (the original request #3 intact).
    try {
      const toast = document.createElement('div');
      toast.className = 'acct-toast';
      toast.setAttribute('role', 'status');
      toast.innerHTML = '<span class="acct-toast-glyph" aria-hidden="true">✓</span> Saved — looking sharp.';
      document.body.appendChild(toast);
    } catch (_) {}
    setTimeout(() => location.reload(), 1800);   // round-3: a real runway — SRs finish the announcement, eyes catch the toast
    } catch (err) {
    console.error('Avatar/Profile save failed:', err);
    // v1.10.1: the raw message + SDK code used to render here — branded only
    errEl.textContent = friendlyError(err, { kind: 'save', user: auth.currentUser });
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
  verifyMsg.style.color = user.emailVerified ? '#b7ffbf' : '#cbb0ff';   // purple notice, not gold-adjacent
  if (verifyBtn && resendBtn) {
    const show = !user.emailVerified;
    verifyBtn.style.display = show ? '' : 'none';
    resendBtn.style.display = show ? '' : 'none';
  }


  // header buttons
  const headerSignoutBtn = document.querySelector('#signout-btn');
  if (headerSignoutBtn) headerSignoutBtn.style.display = '';
  // round 2 — the Settings panel's session card
  const so2 = document.getElementById('acct-signout-2');
  if (so2 && !so2._wired) { so2._wired = true; so2.addEventListener('click', doSignOut); }
  const sinceEl = document.getElementById('set-member-since');
  if (sinceEl) {
    const t = user.metadata && user.metadata.creationTime;
    sinceEl.textContent = t ? ('Member since ' + new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })) : '';
  }
  subscribeSavedLists(user);
  // adversarial perf MED: DON'T subscribe activity on load — it's ~110 reads +
  // 2 live collection-group listeners for a tab that starts HIDDEN (Profile is
  // the default). Defer to the first time the Activity tab is opened. If the
  // page deep-links straight to activity, run it now.
  activityUserPending = user;
  if (document.querySelector('.side-link[data-tab="activity"].is-active')) ensureActivity();
  // adversarial LOW: a collections-tab click BEFORE auth resolved bounced off
  // ensureCollections' auth guard and left the panel blank — catch up now.
  if (document.querySelector('.side-link[data-tab="collections"].is-active')) ensureCollections();
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

  // gate 20.8 (fix 1): the DM composer chip wears YOUR face (origin-gated,
  // escape-safe; the initial disc when no photo; mirrors script.js's chip).
  try {
    const ava = document.getElementById('inbox-self-ava');
    if (ava) {
      const purl = user.photoURL || '';
      if (purl && (VIEWER_AVATAR_RE.test(purl) || PRACTICE_AVATAR_OK(purl))) {
        ava.innerHTML = `<img src="${esc(purl)}" alt="">`;
      } else {
        ava.textContent = String(user.displayName || '?').trim().charAt(0).toUpperCase() || '?';
      }
    }
  } catch (_) {}

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
        // round-3 adversarial (heart): gold keys on IDENTITY — a letter wears
        // Blake's gold edge when BLAKE sent it, on every viewer's screen.
        const fromBlake = m.senderUid === RAR_ADMIN_UID;
        rows.push(`<div class="inbox-msg${mine ? ' is-mine' : ''}${fromBlake ? ' is-blake' : ''}">${escText(m.text || '')}</div>`);
      });
      msgsEl.innerHTML = rows.length ? rows.join('')
        : '<div class="inbox-empty"><span class="inbox-empty-lantern" aria-hidden="true">🏮</span>'
          + '<p>Say hello — this goes straight to Blake.</p>'
          + '<p class="inbox-empty-sub">He reads every letter himself.</p></div>';
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
    } catch (err) { console.error('DM send failed', err); alert('Could not send: ' + friendlyError(err, { kind: 'post' })); }
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
      console.error('conversation start failed', err);
      alert('Could not start the conversation: ' + friendlyError(err, { kind: 'post' }));
    } finally { blakeBtn.disabled = false; }
  });
}

