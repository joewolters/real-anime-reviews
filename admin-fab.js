// admin-fab.js — Admin Mode floating action button (FAB)
// =============================================================================
// What this is: a floating "Admin" pill in the bottom-LEFT corner of every page,
// visible ONLY to Blake (admin UID). Click to open a grid of admin tool tiles.
//
// Author: Code | date: 2026-05-10 | Mode 1 baseline (v1.6.0)
// (corner corrected 2026-08-12 — it moved left in v1.7.3 gate 3c to clear the
//  search bar and chat drawer; this comment had said "bottom-right" ever since.)
//
// v2.2.0 item 4 — Blake: "when I click admin, eight models pop up, like,
// rectangles on my screen that look neat. They say what it is in a quick
// description of what it's doing... short and sweet to the point... And as we
// add more models, we can, like, scroll down."
// So: TILES, each carrying a `desc` short enough to read at a glance, in a
// scrolling grid. Note he remembered eight; there are eleven — Letters and
// Member Stats are new, and on 2026-08-12 he said all eleven stay for now.
// =============================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {
  collection, query, where, getDocs, getDoc, doc, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';

// hrefs MUST be root-absolute — the FAB also mounts on /admin/* pages (new-anime),
// where a relative 'admin/…' href doubles to /admin/admin/… → 404.
// ⚠️ `desc` is Blake's "short and sweet to the point" — his own examples were
// "edit anime" and "change seasonal reviews". Keep them at a GLANCE length; a
// sentence here defeats the point of the redesign. Each one describes what the
// page actually does (checked against the pages themselves, not guessed).
const ADMIN_MENU_ITEMS = [
  {
    label: 'Add Anime',
    jp: '新規追加',
    desc: 'Write a brand-new review',
    href: '/admin/new-anime.html',
  },
  {
    label: 'Edit a Review',
    jp: '編集',
    desc: 'Change one you already wrote',
    href: '/admin/edit.html',
  },
  {
    label: 'Season Reviews',
    jp: '感想',
    desc: 'Per-season write-ups',
    href: '/admin/season-reviews.html',
  },
  {
    label: 'Curator Studio',
    jp: '工房',
    desc: 'Private notes on any anime',
    href: '/admin/studio.html',
  },
  {
    label: 'Curate Cards',
    jp: '整理',
    desc: 'Watch status on every card',
    href: '/admin/curation.html',
  },
  // Cloud migration phase 3 — the Cloud Admin catalog editor. Reads and writes
  // catalog/{animeId} straight from Firestore, so it works on any device
  // (Blake's phone included) with no Mode-1 server and no Excel.
  {
    label: 'Catalog',
    jp: '図書',
    desc: 'Edit anime data from anywhere',
    href: '/admin/catalog.html',
  },
  {
    label: 'Quotes',
    jp: '名言',
    desc: 'The quote bubbles on the door',
    href: '/admin/quotes.html',
  },
  {
    label: 'Suggestion Queue',
    jp: '提案',
    desc: 'What members asked you to watch',
    href: '/admin/suggestions.html',
    badge: 'suggestions',
  },
  {
    label: 'Reports',
    jp: '通報',
    desc: 'Flagged comments and posts',
    href: '/admin/reports.html',
    badge: 'reports',
  },
  // PATCH QUEUE item 5 — the Curator's Desk. Milestone F removed the admin
  // INBOX page on Blake's word ("people can properly dm me now"), and letters
  // reach him through the one account Letter Room. This is a shortcut to that
  // room, not a resurrection of the page — it exists so the unread count has
  // somewhere to live in "Blake's morning at a glance".
  {
    label: 'Letters',
    jp: '手紙',
    desc: 'Messages members sent you',
    href: '/account.html#inbox',
    badge: 'letters',
  },
  // PART A item 6 — the member-stats page. Counts only, never content: it reads
  // ONE Cloud-Function-written doc (adminStats/current), so opening it costs a
  // single Firestore read however often it is refreshed.
  {
    label: 'Member Stats',
    jp: '統計',
    desc: 'How many people are here',
    href: '/admin/stats.html',
  },
  // Milestone F (Blake: "get rid of the inbox on my admin page since people
  // can properly dm me now") — members' letters reach Blake through the ONE
  // unified account Inbox (account.html#inbox); the admin floor page is gone.
  // Future entries land here — give every one a `desc`, or its tile renders
  // shorter than its neighbours and the grid stops looking deliberate:
  // { label: 'Site Health', jp: '監視', desc: 'Is anything on fire', href: '/admin/health.html' },
  // { label: 'Audit', jp: '監査', desc: 'Who changed what', href: '/admin/audit.html' },
];

// =============================================================================
// PATCH QUEUE item 5 — THE CURATOR'S DESK BADGES.
// <!-- author: Code | date: 2026-08-10 -->
// "Live counts on the admin-FAB items — new suggestions / open reports /
// unread DMs = Blake's morning at a glance."
//
// Fetched WHEN THE MENU OPENS, not on page load. The FAB mounts on every page
// of the site; counting on load would bill three query fans per navigation for
// a number nobody is looking at. Opening the menu is the moment he asks.
//
// Suggestions and reports use getCountFromServer — the count comes back as a
// number without shipping the documents, so the queue's contents never touch a
// page that isn't the queue. Letters can't: unread is a per-conversation
// comparison, so it reads the conversation list plus one read-receipt each.
// =============================================================================

const badgeCounts = { suggestions: 0, reports: 0, letters: 0 };
let badgeFetchInFlight = false;

const tsMs = (t) => (t && typeof t.toMillis === 'function') ? t.toMillis() : 0;

// Unread letters — the SAME definition the Letter Room uses (account.js
// isUnread): a newer message that isn't mine and that I haven't read. Copying
// the rule rather than inventing a second one is the point; two definitions of
// "unread" would disagree and the badge would lie about the inbox.
async function countUnreadLetters(uid) {
  const snap = await getDocs(query(
    collection(db, 'conversations'), where('participants', 'array-contains', uid)));
  let n = 0;
  await Promise.all(snap.docs.map(async (d) => {
    const c = d.data() || {};
    if (c.lastSenderUid === uid) return;            // my own send is never unread
    let lastRead = 0;
    try {
      const r = await getDoc(doc(db, 'conversations', d.id, 'reads', uid));
      lastRead = r.exists() ? tsMs((r.data() || {}).lastReadAt) : 0;
    } catch (_) { /* unreadable receipt -> treat as never read */ }
    if (tsMs(c.lastMessageAt) > lastRead) n++;
  }));
  return n;
}

async function fetchBadgeCounts(uid) {
  // ⚠️ The filters mirror each QUEUE's own rule, not the value that happens to
  // be there today. suggestions.js splits on `status === 'reviewed'` and
  // reports.js skips `status === 'resolved'` — so these count the complement of
  // those, NOT `== 'new'`. Both are equivalent right now (only two values exist
  // on each, pinned at create by the rules), but a third status added later
  // would make an `== 'new'` badge quietly disagree with the page it links to,
  // and a badge that disagrees with its own queue is worse than no badge.
  const [sug, rep, letters] = await Promise.all([
    getCountFromServer(query(collection(db, 'suggestions'), where('status', '!=', 'reviewed')))
      .then((s) => s.data().count).catch(() => null),
    getCountFromServer(query(collection(db, 'reports'), where('status', '!=', 'resolved')))
      .then((s) => s.data().count).catch(() => null),
    countUnreadLetters(uid).catch(() => null),
  ]);
  // null = the query failed. Leave that badge's previous value alone rather
  // than painting a confident 0 over a number we could not check.
  if (sug !== null) badgeCounts.suggestions = sug;
  if (rep !== null) badgeCounts.reports = rep;
  if (letters !== null) badgeCounts.letters = letters;
}

function paintBadges() {
  document.querySelectorAll('#admin-fab-menu .admin-fab-badge').forEach((el) => {
    const n = badgeCounts[el.dataset.badge] || 0;
    // 99+ so a runaway number can never widen the menu row
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n === 0;
  });
}

async function refreshBadges() {
  const user = auth.currentUser;
  if (!user || user.uid !== ADMIN_UID) return;
  if (badgeFetchInFlight) return;
  badgeFetchInFlight = true;
  try {
    await fetchBadgeCounts(user.uid);
    paintBadges();
  } catch (err) {
    // A failed count must never break the menu it lives in — the tools still work.
    console.warn('[admin-fab] badge counts unavailable:', err && err.message);
  } finally {
    badgeFetchInFlight = false;
  }
}

// Exposed for the spec (the lanternModel / rarStatsView / rarTombstone
// precedent): the counts can't be produced in a test without an admin session
// and live data, but the PAINTING is what the badge promises — so the spec
// drives the real painter with known numbers and measures real pixels.
if (typeof window !== 'undefined') {
  window.rarFabBadges = { counts: badgeCounts, paint: paintBadges, refresh: refreshBadges };
}

function buildFab() {
  if (document.getElementById('admin-fab-root')) return;

  const root = document.createElement('div');
  root.id = 'admin-fab-root';
  root.className = 'admin-fab-hidden';
  root.setAttribute('aria-live', 'polite');

  const button = document.createElement('button');
  button.id = 'admin-fab-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open admin mode');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'admin-fab-menu');
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="22" height="22">
      <path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5l-8-3zm0 4.6 5.5 2v4.4c0 3.7-2.4 7.1-5.5 8.4-3.1-1.3-5.5-4.7-5.5-8.4V8.6L12 6.6z"/>
    </svg>
    <span class="admin-fab-label">Admin</span>
  `;

  const menu = document.createElement('div');
  menu.id = 'admin-fab-menu';
  menu.className = 'admin-fab-menu admin-fab-menu-hidden';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Admin tools');

  const header = document.createElement('div');
  header.className = 'admin-fab-menu-header';
  header.innerHTML = `ADMIN MODE <span class="admin-fab-jp">管理</span>`;
  menu.appendChild(header);

  // v2.2.0 item 4 — the tiles live in their OWN scrolling grid, so the "ADMIN
  // MODE" header stays pinned while the tools scroll under it. Blake: "as we
  // add more models, we can, like, scroll down." The old menu had no max-height
  // and no overflow at all — at eleven items it simply grew off the top of the
  // screen, so this is a fix, not only a restyle.
  const grid = document.createElement('div');
  grid.className = 'admin-fab-grid';
  for (const item of ADMIN_MENU_ITEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-fab-tile';
    btn.setAttribute('role', 'menuitem');
    // textContent, not innerHTML interpolation — these strings are authored in
    // this file today, but a tile whose label is ever sourced from data must not
    // become an HTML sink. Building the nodes costs nothing and closes it now.
    const top = document.createElement('span');
    top.className = 'admin-fab-tile-top';
    const lab = document.createElement('span');
    lab.className = 'admin-fab-menu-item-label';
    lab.textContent = item.label;
    const jp = document.createElement('span');
    jp.className = 'admin-fab-menu-item-jp';
    jp.textContent = item.jp;
    top.appendChild(lab);
    top.appendChild(jp);
    btn.appendChild(top);
    // PATCH QUEUE item 5 — the count slot. Ships hidden and EMPTY: a badge
    // reading 0 is noise, and a badge reading a stale number is worse than none.
    // It sits in the tile's TOP row so it keeps its own line and cannot be
    // pushed out of view by a long description.
    if (item.badge) {
      const b = document.createElement('span');
      b.className = 'admin-fab-badge';
      b.dataset.badge = item.badge;
      b.hidden = true;
      top.appendChild(b);
    }
    if (item.desc) {
      const d = document.createElement('span');
      d.className = 'admin-fab-tile-desc';
      d.textContent = item.desc;
      btn.appendChild(d);
    }
    btn.addEventListener('click', () => {
      window.location.href = item.href;
    });
    grid.appendChild(btn);
  }
  menu.appendChild(grid);

  root.appendChild(button);
  root.appendChild(menu);
  document.body.appendChild(root);

  let open = false;
  function setOpen(next) {
    open = next;
    button.setAttribute('aria-expanded', String(open));
    if (open) { menu.classList.remove('admin-fab-menu-hidden'); refreshBadges(); }
    else menu.classList.add('admin-fab-menu-hidden');
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  document.addEventListener('click', (e) => {
    if (open && !root.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      button.focus();
    }
  });
}

function showFab() {
  const root = document.getElementById('admin-fab-root');
  if (root) root.classList.remove('admin-fab-hidden');
}

function hideFab() {
  const root = document.getElementById('admin-fab-root');
  if (root) root.classList.add('admin-fab-hidden');
}

function init() {
  buildFab();
  onAuthStateChanged(auth, (user) => {
    const isAdmin = !!(user && user.uid === ADMIN_UID);
    // v1.7.4 (gate 3) — expose the admin flag so script.js's secondary modal can
    // show the inline "Edit season review" link (DRY — the UID gate lives here,
    // not duplicated into the public homepage bundle). Fires an event so an
    // already-open modal can react.
    window.__rarIsAdmin = isAdmin;
    try { window.dispatchEvent(new CustomEvent('rar:admin-change', { detail: { isAdmin } })); } catch (_) {}
    if (isAdmin) showFab();
    else hideFab();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
