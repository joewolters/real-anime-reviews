// suggest.js — Suggestion Box submit handler + search-as-you-type.
// Adds a new doc to the `suggestions` Firestore collection.
// Spam protection: honeypot field (hp_email) + sessionStorage 60s rate-limit.
// Field shape is also enforced at the Firestore rules layer (defense in depth).
//
// v1.6.11 gate 3e additions:
//   - Search-as-you-type with 350ms debounce + AbortController for in-flight cancel
//   - Dropdown render with cover thumbs, format pill, year (5-8 results)
//   - Selection state — confirmation card replaces input, "Change" reverts
//   - Keyboard nav (arrow up/down + Enter + Escape)
//   - Selection-aware submit payload (extends with anilistId/coverImage/format/
//     year/englishTitle/romajiTitle when visitor picks from dropdown)
//   - Raw-title fallback preserved (no selection = pre-3e shape)
//   - NO visible third-party branding in any visitor-facing copy
//
// Author: Code | date: 2026-06-02 | v1.6.11 gate 3e

import { db, auth } from './firebase.js';
import { collection, addDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
// Part C — the ONE branded-error module (parity with every other write path)
import { friendlyError } from './friendly-errors.js?v=2.2.1';

// ---- Constants -------------------------------------------------------------

const RATE_LIMIT_MS = 60_000;
const SESSION_KEY = 'suggest_last_submit_ms';

// Self-contained search infrastructure (lifted from admin/new-anime.js:18,66-76,229-240
// with coverImage { medium } added for the visitor variant + AbortController support).
const SEARCH_ENDPOINT = 'https://graphql.anilist.co';
const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_MIN_CHARS = 2;
const SEARCH_QUERY = `
query ($search: String!) {
  Page(perPage: 8) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title { romaji english }
      coverImage { medium }
      format
      seasonYear
    }
  }
}`;

// ---- State -----------------------------------------------------------------

let searchDebounceTimer = null;
let inFlightController = null;
let selection = null;              // { id, englishTitle, romajiTitle, coverImage, format, year } or null
let dropdownFocusedIndex = -1;

// ---- DOM helpers -----------------------------------------------------------

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

function setStatus(msg, kind = 'info') {
  const el = $('suggest-status');
  el.hidden = false;
  el.textContent = msg;
  el.className = 'suggest-status ' + kind;
}

function isRateLimited() {
  const last = parseInt(sessionStorage.getItem(SESSION_KEY) || '0', 10);
  return last && (Date.now() - last) < RATE_LIMIT_MS;
}

// ---- Spinner ---------------------------------------------------------------

function showSpinner() { $('suggest-search-spinner').hidden = false; }
function hideSpinner() { $('suggest-search-spinner').hidden = true; }

// ---- Search fetch ----------------------------------------------------------

async function searchLite(query, signal) {
  const res = await fetch(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query } }),
    signal,
  });
  if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data?.Page?.media || [];
}

// ---- Debounced input handler -----------------------------------------------

function onTitleInput() {
  const q = $('suggest-title').value.trim();
  // gate 3g — belt-and-suspenders state-clear: typing in the input means the
  // visitor is searching fresh; force the selected card hidden + selection
  // cleared synchronously (no animated reverse swap that could race the new
  // input handling). Defensive against any future transitionend race where
  // the gate-3f coordinator doesn't fully settle before the visitor types.
  if (selection || !$('suggest-selected').hidden) {
    selection = null;
    $('suggest-selected').hidden = true;
    $('suggest-selected').classList.remove('is-leaving', 'is-entering');
  }
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  if (inFlightController) inFlightController.abort();

  if (q.length < SEARCH_MIN_CHARS) {
    hideDropdown();
    hideSpinner();
    return;
  }

  showSpinner();
  searchDebounceTimer = setTimeout(() => doSearch(q), SEARCH_DEBOUNCE_MS);
}

async function doSearch(q) {
  inFlightController = new AbortController();
  try {
    const results = await searchLite(q, inFlightController.signal);
    hideSpinner();
    renderDropdown(results);
  } catch (err) {
    if (err.name === 'AbortError') return;   // user typed further, ignore
    hideSpinner();
    console.error('AniList search failed', err);
    renderDropdownError();
  }
}

// ---- Dropdown render -------------------------------------------------------

function renderDropdown(results) {
  const dd = $('suggest-search-results');
  dropdownFocusedIndex = -1;

  if (!results.length) {
    // Visitor-facing copy — no third-party branding.
    dd.innerHTML = '<div class="suggest-result-empty">No matches found. You can still submit with the title you typed.</div>';
    dd.hidden = false;
    $('suggest-title').setAttribute('aria-expanded', 'true');
    return;
  }

  dd.innerHTML = results.map((r, i) => renderResultRow(r, i)).join('');
  dd.hidden = false;
  $('suggest-title').setAttribute('aria-expanded', 'true');
}

function renderResultRow(r, i) {
  const english = r.title?.english || '';
  const romaji = r.title?.romaji || '';
  const primary = english || romaji || '';
  const secondary = (english && romaji && english !== romaji) ? romaji : '';
  const cover = r.coverImage?.medium || '';
  const fmt = r.format || '';
  const year = r.seasonYear || '';

  const coverHtml = cover
    ? `<img class="suggest-result-cover" src="${escapeAttr(cover)}" alt="" loading="lazy">`
    : `<div class="suggest-result-cover suggest-result-cover-placeholder" aria-hidden="true"></div>`;
  const secondaryHtml = secondary
    ? `<div class="suggest-result-romaji">${escapeHtml(secondary)}</div>`
    : '';
  const fmtHtml = fmt
    ? `<span class="suggest-result-format-badge">${escapeHtml(fmt)}</span>`
    : '';
  const yearHtml = year
    ? `<span class="suggest-result-year">${escapeHtml(String(year))}</span>`
    : '';

  return `<div class="suggest-result-row" role="option" data-index="${i}"
       style="--i: ${i}"
       data-id="${escapeAttr(r.id)}"
       data-cover="${escapeAttr(cover)}"
       data-english="${escapeAttr(english)}"
       data-romaji="${escapeAttr(romaji)}"
       data-format="${escapeAttr(fmt)}"
       data-year="${escapeAttr(year)}">
    ${coverHtml}
    <div class="suggest-result-body">
      <div class="suggest-result-title">${escapeHtml(primary)}</div>
      ${secondaryHtml}
      <div class="suggest-result-meta">
        ${fmtHtml}
        ${yearHtml}
      </div>
    </div>
  </div>`;
}

function renderDropdownError() {
  const dd = $('suggest-search-results');
  // Generic visitor-facing copy — no third-party branding.
  dd.innerHTML = '<div class="suggest-result-empty">Couldn\'t search right now — submit your title and the Creator will look it up.</div>';
  dd.hidden = false;
  $('suggest-title').setAttribute('aria-expanded', 'true');
  dropdownFocusedIndex = -1;
}

function hideDropdown() {
  $('suggest-search-results').hidden = true;
  $('suggest-title').setAttribute('aria-expanded', 'false');
  dropdownFocusedIndex = -1;
}

// ---- Selection -------------------------------------------------------------

function selectResult(rowEl) {
  selection = {
    id: parseInt(rowEl.dataset.id, 10),
    englishTitle: rowEl.dataset.english || null,
    romajiTitle: rowEl.dataset.romaji || null,
    coverImage: rowEl.dataset.cover || null,
    format: rowEl.dataset.format || null,
    year: rowEl.dataset.year ? parseInt(rowEl.dataset.year, 10) : null,
  };
  showSelectedCard(selection);
  hideDropdown();
}

// Populate the selected-card's content fields. Pure data binding — no
// visibility / animation logic here (that's showSelectedCard's job).
function populateCard(sel) {
  const card = $('suggest-selected');
  const cover = card.querySelector('.selected-cover');
  const title = card.querySelector('.selected-title');
  const pill = card.querySelector('.selected-format-pill');
  const year = card.querySelector('.selected-year');

  cover.src = sel.coverImage || '';
  cover.alt = sel.englishTitle || sel.romajiTitle || 'Selected anime cover';
  title.textContent = sel.englishTitle || sel.romajiTitle || '';

  if (sel.format) {
    pill.textContent = sel.format;
    pill.hidden = false;
  } else {
    pill.hidden = true;
  }
  year.textContent = sel.year ? String(sel.year) : '';
}

// Forward swap (input → selected card): wrap fades+slides out (220ms), then
// card slides+scales in from above (380ms). Uses transition-based animation
// (replays reliably every toggle, unlike `animation`) coordinated by
// `transitionend` + the double-rAF pattern to force the .is-entering initial
// state to apply before the class is removed.
function showSelectedCard(sel) {
  populateCard(sel);
  const wrap = document.querySelector('.suggest-search-wrap');
  const card = $('suggest-selected');

  // Phase 1: wrap leaves (opacity 1→0, translateY 0→8px, 220ms)
  wrap.classList.add('is-leaving');
  const onWrapDone = () => {
    wrap.removeEventListener('transitionend', onWrapDone);
    wrap.hidden = true;
    wrap.classList.remove('is-leaving');

    // Phase 2: card enters (opacity 0→1, translateY -8px→0, scale 0.97→1, 380ms)
    card.classList.add('is-entering');
    card.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      card.classList.remove('is-entering');
      // Focus Change button when the transform transition settles
      const onCardSettled = (e) => {
        if (e.propertyName !== 'transform') return;
        card.removeEventListener('transitionend', onCardSettled);
        card.querySelector('.selected-change-btn').focus();
      };
      card.addEventListener('transitionend', onCardSettled);
    }));
  };
  wrap.addEventListener('transitionend', onWrapDone);
}

// Reverse swap (selected card → input): card retreats (260ms), then wrap
// slides+fades back in from above (320ms). Same transitionend + double-rAF
// pattern; slightly shorter durations so "I changed my mind" feels lighter
// than "I confirmed my pick."
function clearSelection() {
  selection = null;
  const wrap = document.querySelector('.suggest-search-wrap');
  const card = $('suggest-selected');

  // Short-circuit: card not visible (e.g. submit-success path) — direct reset
  if (card.hidden) {
    wrap.hidden = false;
    $('suggest-title').focus();
    return;
  }

  // Phase 1: card leaves (opacity 1→0, translateY 0→8px, scale 1→0.97, 260ms)
  card.classList.add('is-leaving');
  const onCardDone = () => {
    card.removeEventListener('transitionend', onCardDone);
    card.hidden = true;
    card.classList.remove('is-leaving');

    // Phase 2: wrap enters (opacity 0→1, translateY -8px→0, 320ms)
    wrap.classList.add('is-entering');
    wrap.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.classList.remove('is-entering');
      $('suggest-title').focus();
      const v = $('suggest-title').value;
      $('suggest-title').setSelectionRange(v.length, v.length);
    }));
  };
  card.addEventListener('transitionend', onCardDone);
}

// ---- Keyboard navigation ---------------------------------------------------

function onTitleKeydown(e) {
  const dd = $('suggest-search-results');
  if (dd.hidden) return;
  const rows = dd.querySelectorAll('.suggest-result-row');
  if (!rows.length) {
    // Empty / error state — only Escape is meaningful.
    if (e.key === 'Escape') hideDropdown();
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1, rows); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1, rows); }
  else if (e.key === 'Enter' && dropdownFocusedIndex >= 0) {
    e.preventDefault();
    selectResult(rows[dropdownFocusedIndex]);
  } else if (e.key === 'Escape') {
    hideDropdown();
  }
}

function moveFocus(delta, rows) {
  if (dropdownFocusedIndex < 0) {
    dropdownFocusedIndex = delta > 0 ? 0 : rows.length - 1;
  } else {
    dropdownFocusedIndex = (dropdownFocusedIndex + delta + rows.length) % rows.length;
  }
  rows.forEach((r, i) => r.classList.toggle('focused', i === dropdownFocusedIndex));
  rows[dropdownFocusedIndex].scrollIntoView({ block: 'nearest' });
}

// ---- Submit handler --------------------------------------------------------

async function handleSubmit(e) {
  e.preventDefault();

  // Honeypot — silent success so bots don't learn they're caught.
  if ($('hp_email').value.trim()) {
    $('suggest-form').reset();
    clearSelection();
    setStatus('Thanks! Your suggestion has been sent.', 'success');
    return;
  }

  if (isRateLimited()) {
    setStatus('You just sent one — give it a minute before sending another.', 'warn');
    return;
  }

  // Resolve title from selection (if any) OR raw input.
  const rawTitle = $('suggest-title').value.trim();
  const title = selection
    ? (selection.englishTitle || selection.romajiTitle || rawTitle)
    : rawTitle;
  const reason = $('suggest-reason').value.trim();

  if (!title) {
    setStatus('Title is required.', 'error');
    return;
  }
  // Part C audit (LOW): the rules demand STRICTLY under 200/1000 — the old
  // >200/>1000 checks let an exact-boundary submit pass every client gate and
  // then die on permission-denied.
  if (title.length >= 200) {
    setStatus('Title is too long — keep it under 200 characters.', 'error');
    return;
  }
  if (reason.length >= 1000) {
    setStatus('Reason is too long — keep it under 1000 characters.', 'error');
    return;
  }

  $('suggest-submit').disabled = true;
  setStatus('Sending…', 'info');

  try {
    const docData = {
      title,
      submittedAt: serverTimestamp(),
      status: 'new',
    };
    // gate 20.5 (the item-11 chain audit) — Q2's submitterUid was rules-ready
    // and admin-rendered but NEVER client-written: the gold-flip letter and
    // the admin reply affordance both key on it. Signed-in requests carry it
    // now (rules pin it to the caller's own uid); anonymous stays anonymous.
    try { if (auth && auth.currentUser) docData.submitterUid = auth.currentUser.uid; } catch (_) {}
    if (reason) docData.reason = reason;
    if (selection) {
      if (selection.id != null && !Number.isNaN(selection.id)) docData.anilistId = selection.id;
      if (selection.coverImage) docData.coverImage = selection.coverImage;
      if (selection.format) docData.format = selection.format;
      if (selection.year != null && !Number.isNaN(selection.year)) docData.year = selection.year;
      if (selection.englishTitle) docData.englishTitle = selection.englishTitle;
      if (selection.romajiTitle) docData.romajiTitle = selection.romajiTitle;
    }
    await addDoc(collection(db, 'suggestions'), docData);
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    $('suggest-form').reset();
    clearSelection();
    setStatus('Thanks! Your suggestion has been sent.', 'success');
  } catch (err) {
    console.error('suggest submit failed', err);
    // Part C audit (LOW): route through the shared branded-error module like
    // every other write path (offline/permission splits instead of one blur).
    setStatus(friendlyError(err, { kind: 'post' }), 'error');
  } finally {
    $('suggest-submit').disabled = false;
  }
}

// ---- Wire-up ---------------------------------------------------------------

$('suggest-title').addEventListener('input', onTitleInput);
$('suggest-title').addEventListener('keydown', onTitleKeydown);

$('suggest-search-results').addEventListener('click', (e) => {
  const row = e.target.closest('.suggest-result-row');
  if (row) selectResult(row);
});

$('suggest-selected').addEventListener('click', (e) => {
  if (e.target.matches('.selected-change-btn')) clearSelection();
});

// Click outside the search area dismisses the dropdown.
document.addEventListener('click', (e) => {
  if ($('suggest-search-results').hidden) return;
  if (e.target.closest('.suggest-row-search')) return;
  hideDropdown();
});

$('suggest-form').addEventListener('submit', handleSubmit);

// ---- Prefill from /suggest?title=&anilistId= -------------------------------
// v1.7.4 (gate 2b) — the homepage secondary modal's "📝 Request this anime"
// button links here with the title + AniList id. (This page previously read NO
// URL params — the v1.6.11 prefill loop only covered the admin queue → Mode 1
// form, not the public suggest page; added here so the Request button works.)
// Resolves the exact AniList entry so the suggestion carries anilistId + cover/
// format (same payload a manual dropdown pick yields), with a bare {id,title}
// fallback. Card shown synchronously — no transition dependency, reduced-motion-safe.
function showPrefilledSelection(sel) {
  selection = sel;
  populateCard(sel);
  const wrap = document.querySelector('.suggest-search-wrap');
  if (wrap) { wrap.hidden = true; wrap.classList.remove('is-leaving', 'is-entering'); }
  $('suggest-selected').hidden = false;
}

function prefillSuggestFromQuery() {
  let params;
  try { params = new URLSearchParams(location.search); } catch (_) { return; }
  const title = (params.get('title') || '').trim().slice(0, 200);
  const aniId = parseInt(params.get('anilistId') || '', 10);
  if (!title && !Number.isFinite(aniId)) return;
  if (title) $('suggest-title').value = title;          // raw-title fallback (always)
  if (!Number.isFinite(aniId) || !title) return;        // no id → leave the typed title

  const bare = { id: aniId, englishTitle: title, romajiTitle: null, coverImage: null, format: null, year: null };
  searchLite(title).then(results => {
    const match = (results || []).find(r => r && r.id === aniId);
    showPrefilledSelection(match ? {
      id: match.id,
      englishTitle: match.title?.english || null,
      romajiTitle: match.title?.romaji || null,
      coverImage: match.coverImage?.medium || null,
      format: match.format || null,
      year: match.seasonYear || null,
    } : bare);
  }).catch(() => showPrefilledSelection(bare));
}

prefillSuggestFromQuery();
