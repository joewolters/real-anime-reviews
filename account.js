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
  doc, setDoc, collection, onSnapshot, deleteDoc,
  query, orderBy, where, limit, collectionGroup,
  serverTimestamp
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
const tabs = ['profile','watchlist','favorites','activity'];
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
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});
activateTab('profile'); // default

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

// HTML-escape used by the saved-row renderers below (favorites/watchlist/AniList).
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
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
      location.href = `index.html#open=${encodeURIComponent(it.animeId)}`;
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

function subscribeActivity(user) {
  if (unsubActivity) { try { unsubActivity(); } catch(_) {} unsubActivity = null; }

  clearActivityUI();
  if (!user) return;

  if (activityEmptyEl) {
    activityEmptyEl.textContent = 'Loading...';
    activityEmptyEl.style.display = '';
  }

  const uid = user.uid;

  // We listen to TWO streams and merge them:
  // 1) collectionGroup('items')  -> anime comments + community reviews
  // 2) collectionGroup('threads')-> discussion comments under community reviews
  let itemsA = [];
  let itemsB = [];
  let gotA = false;
  let gotB = false;

  const shorten = (s, max = 120) => {
    const str = String(s || '').trim();
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + '…';
  };

  const rerender = () => {
    // Once at least one stream has loaded, render what we have
    if (!gotA && !gotB) return;

    const merged = [...itemsA, ...itemsB];
    merged.sort((a,b) => (b.ms || 0) - (a.ms || 0));
    renderActivity(merged.slice(0, 15));
  };

  const qItems = query(
    collectionGroup(db, 'items'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(25)
  );

  const unsubA = onSnapshot(qItems, (snap) => {
    gotA = true;
    const next = [];

    snap.forEach((d) => {
      const data = d.data() || {};
      const path = d.ref.path.split('/');
      const root = path[0];
      const animeId = path[1];
      if (!animeId) return;

      const title = titleById.get(animeId) || animeId;
      const ms = toMillis(data.editedAt || data.updatedAt || data.createdAt);

      let desc = '';
      if (root === 'comments') {
        desc = `Commented: ${shorten(data.text)}`;
      } else if (root === 'reviews') {
        const rt = (data.title || '').trim();
        const r = (typeof data.rating === 'number') ? data.rating : null;
        desc = r ? `Reviewed (${r}/10): ${shorten(rt)}` : `Reviewed: ${shorten(rt)}`;
      } else {
        return;
      }

      next.push({ animeId, title, ms, desc });
    });

    itemsA = next;
    rerender();
  }, (err) => {
    console.warn('Activity items failed:', err);
    gotA = true;
    itemsA = [];
    rerender();
  });

  const qThreads = query(
    collectionGroup(db, 'threads'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(25)
  );

  const unsubB = onSnapshot(qThreads, (snap) => {
    gotB = true;
    const next = [];

    snap.forEach((d) => {
      const data = d.data() || {};
      const path = d.ref.path.split('/');
      // reviews/{animeId}/items/{reviewUid}/threads/{tid}
      const animeId = path[1];
      if (!animeId) return;

      const title = titleById.get(animeId) || animeId;
      const ms = toMillis(data.editedAt || data.updatedAt || data.createdAt);
      const txt = shorten(data.text);
      const desc = `Discussion comment: ${txt}`;

      next.push({ animeId, title, ms, desc });
    });

    itemsB = next;
    rerender();
  }, (err) => {
    console.warn('Activity threads failed:', err);

    // NOTE: If you see a Firebase Console link about an index, you need to create it.
    // Typical fix is a collection group index on:
    //   threads: uid (ASC) + createdAt (DESC)

    gotB = true;
    itemsB = [];
    rerender();
  });

  unsubActivity = () => {
    try { unsubA(); } catch(_) {}
    try { unsubB(); } catch(_) {}
  };
}



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

function subscribeSavedLists(user) {
  if (unsubFav) { try { unsubFav(); } catch(_) {} unsubFav = null; }
  if (unsubWatch) { try { unsubWatch(); } catch(_) {} unsubWatch = null; }

  clearSavedUI();
  if (!user) return;

  const uid = user.uid;

  unsubFav = onSnapshot(
    collection(db, 'users', uid, 'favorites'),
    (snap) => {
      const items = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        const ts = data.updatedAt || data.savedAt || data.createdAt || null;
        items.push({
          animeId: d.id,
          title: data.title || data.animeTitle || d.id,
          ms: toMillis(ts),
          // v1.7.5 (gate 2) — non-catalog (AniList) saves carry a snapshot.
          type: data.type || 'catalog',
          aniListId: data.aniListId || null,
          coverImage: data.coverImage || '',
          format: data.format || '',
          year: data.year || null
        });
      });
      items.sort((a,b) => (b.ms || 0) - (a.ms || 0));
      renderSaved(favListEl, favEmptyEl, items, 'favorites', uid);
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
        items.push({
          animeId: d.id,
          title: data.title || data.animeTitle || d.id,
          ms: toMillis(ts),
          // v1.7.5 (gate 2) — non-catalog (AniList) saves carry a snapshot.
          type: data.type || 'catalog',
          aniListId: data.aniListId || null,
          coverImage: data.coverImage || '',
          format: data.format || '',
          year: data.year || null
        });
      });
      items.sort((a,b) => (b.ms || 0) - (a.ms || 0));
      renderSaved(watchListEl, watchEmptyEl, items, 'watchlist', uid);
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
  subscribeActivity(user);
  // Notifications (Lantern) subscribe to auth on their own inside initLantern().
});

