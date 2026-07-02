// admin-fab.js — Admin Mode floating action button (FAB)
// =============================================================================
// What this is: a floating "Admin" pill in the bottom-right corner of every
// page, visible ONLY to Blake (admin UID). Click to open dropdown of admin
// tools. Currently one tool: "+ Add Anime".
//
// Author: Code | date: 2026-05-10 | Mode 1 baseline (v1.6.0)
// =============================================================================

import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';

// hrefs MUST be root-absolute — the FAB also mounts on /admin/* pages (new-anime),
// where a relative 'admin/…' href doubles to /admin/admin/… → 404.
const ADMIN_MENU_ITEMS = [
  {
    label: 'Add Anime',
    jp: '新規追加',
    href: '/admin/new-anime.html',
  },
  {
    label: 'Edit a Review',
    jp: '編集',
    href: '/admin/edit.html',
  },
  {
    label: 'Season Reviews',
    jp: '感想',
    href: '/admin/season-reviews.html',
  },
  {
    label: 'Curate Cards',
    jp: '整理',
    href: '/admin/curation.html',
  },
  {
    label: 'Quotes',
    jp: '名言',
    href: '/admin/quotes.html',
  },
  {
    label: 'Suggestion Queue',
    jp: '提案',
    href: '/admin/suggestions.html',
  },
  {
    label: 'Reports',
    jp: '通報',
    href: '/admin/reports.html',
  },
  {
    label: 'Inbox',
    jp: '受信箱',
    href: '/admin/inbox.html',
  },
  // Future entries land here:
  // { label: 'Site Health', jp: '監視', href: '/admin/health.html' },
  // { label: 'Audit', jp: '監査', href: '/admin/audit.html' },
];

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

  for (const item of ADMIN_MENU_ITEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-fab-menu-item';
    btn.setAttribute('role', 'menuitem');
    btn.innerHTML = `
      <span class="admin-fab-menu-item-label">${item.label}</span>
      <span class="admin-fab-menu-item-jp">${item.jp}</span>
    `;
    btn.addEventListener('click', () => {
      window.location.href = item.href;
    });
    menu.appendChild(btn);
  }

  root.appendChild(button);
  root.appendChild(menu);
  document.body.appendChild(root);

  let open = false;
  function setOpen(next) {
    open = next;
    button.setAttribute('aria-expanded', String(open));
    if (open) menu.classList.remove('admin-fab-menu-hidden');
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
