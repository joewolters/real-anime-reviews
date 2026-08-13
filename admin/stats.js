// admin/stats.js — Member Stats (PART A item 6).
// <!-- author: Code | date: 2026-08-10 -->
// Reads ONE document — `adminStats/current` — written by the recomputeStats
// schedule and the refreshStatsNow callable (functions/lib/stats.js). That is
// the whole cost model: opening this page is exactly one Firestore read, no
// matter how often Blake refreshes it. Auth gate mirrors admin/curation.js.
//
// Nothing on this page is content. The document holds counts and nothing else;
// there is no member name, no comment text and no letter anywhere in it.
import { auth, db, functions } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js';
import { friendlyError } from '../friendly-errors.js?v=2.2.2';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const $ = (id) => document.getElementById(id);

// Row order + labels for the content table. Keys match lib/stats.js SURFACES —
// a surface added there without a label here simply doesn't render, which is
// the safe direction to fail.
const CONTENT_ROWS = [
  ['comments', 'Comments'],
  ['reviews', 'Community reviews'],
  ['commentReplies', 'Comment replies'],
  ['reviewReplies', 'Review replies'],
  ['forumThreads', 'Hub threads'],
  ['forumPosts', 'Hub posts'],
];

// Numbers read as numbers — a missing key shows an em dash, never "undefined"
// and never a silent 0 (a real 0 and a missing field mean different things).
function num(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? v.toLocaleString('en-US') : '—';
}
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

// "Recomputed 3 hours ago" — the page must never imply it is live when it is a
// daily snapshot, so freshness is stated, not hidden.
function agoLabel(ms) {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return 'just now';
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hrs / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

function toMillis(v) {
  if (!v) return NaN;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return NaN;
}

function render(s) {
  const members = s.members || {};
  const content = s.content || {};
  const recent = s.recent || {};
  const dms = s.dms || {};

  setText('s-members-total', num(members.total));
  setText('s-members-month', num(members.joinedThisMonth));
  setText('s-members-recent', num(members.joinedRecent));
  setText('s-members-active', num(members.active));
  setText('s-month-label', s.monthLabel || 'this month');

  const bannedLine = $('s-banned-line');
  if (bannedLine) {
    const banned = members.banned;
    if (typeof banned === 'number' && banned > 0) {
      bannedLine.textContent = banned === 1
        ? '1 of those accounts is banned.'
        : banned + ' of those accounts are banned.';
      bannedLine.hidden = false;
    } else {
      bannedLine.hidden = true;
    }
  }

  const tbody = $('stats-content-rows');
  if (tbody) {
    tbody.innerHTML = '';
    for (const [key, label] of CONTENT_ROWS) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = label;
      const all = document.createElement('td');
      all.className = 'stats-num';
      all.textContent = num(content[key]);
      const rec = document.createElement('td');
      rec.className = 'stats-num';
      rec.textContent = num(recent[key]);
      tr.appendChild(th); tr.appendChild(all); tr.appendChild(rec);
      tbody.appendChild(tr);
    }
  }
  setText('s-content-total', num(content.total));
  setText('s-recent-total', num(recent.total));

  const tombLine = $('s-tombstone-line');
  if (tombLine) {
    const t = s.tombstones;
    if (typeof t === 'number' && t > 0) {
      // Said plainly: these slots are still in their threads, their words are not.
      tombLine.textContent = t === 1
        ? 'One more slot is a tombstone — removed or its author left. It holds its place in the thread; the words are gone.'
        : t + ' more slots are tombstones — removed, or their authors left. They hold their places in their threads; the words are gone.';
      tombLine.hidden = false;
    } else {
      tombLine.hidden = true;
    }
  }

  setText('s-dm-convos', num(dms.conversations));
  setText('s-dm-messages', num(dms.messages));
  setText('s-appreciates', num(s.appreciates));

  const fresh = $('stats-freshness');
  if (fresh) {
    const ms = toMillis(s.generatedAt);
    const how = s.source === 'manual' ? 'refreshed by hand' : 'daily recompute';
    fresh.textContent = Number.isFinite(ms)
      ? 'Counted ' + agoLabel(ms) + ' · ' + how
      : 'Counted · ' + how;
    fresh.hidden = false;
  }

  $('stats-body').hidden = false;
  $('stats-empty').hidden = true;
}

async function load() {
  const snap = await getDoc(doc(db, 'adminStats', 'current'));
  if (!snap.exists()) {
    // Not an error — the schedule simply hasn't run yet on a fresh deploy.
    $('stats-body').hidden = true;
    $('stats-empty').hidden = false;
    return;
  }
  render(snap.data() || {});
}

function noteFlash(kind, text) {
  const note = $('stats-refresh-note');
  if (!note) return;
  note.textContent = text;
  note.className = 'stats-refresh-note ' + (kind === 'error' ? 'is-error' : 'is-ok');
  note.hidden = false;
}

async function refreshNow() {
  const btn = $('stats-refresh');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const was = btn.textContent;
  btn.textContent = 'Counting…';
  noteFlash('ok', 'Walking every collection — this takes a moment.');
  try {
    await httpsCallable(functions, 'refreshStatsNow')({});
    await load();
    noteFlash('ok', 'Up to date.');
  } catch (err) {
    console.error('[stats] refresh failed', err);
    noteFlash('error', friendlyError(err, { kind: 'save' }));
  } finally {
    btn.disabled = false;
    btn.textContent = was;
  }
}

async function boot() {
  $('stats-refresh').addEventListener('click', refreshNow);
  try {
    await load();
  } catch (err) {
    // Say WHICH failure this is. A denial and a dropped connection want
    // opposite reactions, and "couldn't reach the stats" sent Blake looking for
    // a network problem when the real answer was that the rules for this
    // collection are written but NOT DEPLOYED yet — the page cannot work until
    // firestore rules + functions ship, and it should say so instead of
    // implying a blip. (friendlyError's vocabulary is written for WRITES: it
    // would say "that didn't go through" about a read that never went anywhere.)
    console.error('[stats] failed to load', err);
    const code = String((err && (err.code || err.message)) || '').toLowerCase();
    const denied = /permission|denied|insufficient|unauthenticated/.test(code);
    const kicker = $('stats-error-kicker');
    const body = $('stats-error-body');
    if (denied) {
      if (kicker) kicker.innerHTML = 'NOT LIVE YET <span class="jp-mini">未公開</span>';
      if (body) {
        body.textContent = 'This page is built but not deployed. Its rules and its '
          + 'counting function have to ship before any numbers exist — until then '
          + 'the site correctly refuses to hand them over. Nothing is broken.';
      }
    }
    const card = $('stats-error');
    if (card) card.hidden = false;
  }
}

// Exposed model (the lanternModel / histogramModel / coverClamp precedent):
// the spec drives the REAL render with a known payload and then measures real
// pixels, instead of asserting class names at a page that never painted.
if (typeof window !== 'undefined') window.rarStatsView = { render, agoLabel, num };

let rendered = false;
onAuthStateChanged(auth, (user) => {
  const isAdmin = !!(user && user.uid === ADMIN_UID);
  const gate = $('admin-gate');
  const main = $('admin-main');
  if (isAdmin) {
    if (gate) gate.hidden = true;
    if (main) main.hidden = false;
    if (!rendered) { rendered = true; boot(); }
  } else {
    // Keep the gate visible with a plain admin-only message (never leak the shell).
    if (main) main.hidden = true;
    if (gate) {
      gate.hidden = false;
      const msg = gate.querySelector('.admin-gate-message');
      if (msg) {
        const spinner = msg.querySelector('.admin-gate-spinner');
        if (spinner) spinner.remove();
        const p = msg.querySelector('p');
        if (p) p.textContent = 'Admin only.';
      }
    }
  }
});
