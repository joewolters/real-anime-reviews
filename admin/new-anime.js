// admin/new-anime.js — the Add Anime form (publishes straight to the catalog)
// =============================================================================
// What this does:
//   1. Gates the page behind admin UID check
//   2. Form: type title → fetch from AniList → edit fields → review/rating
//   3. Publishes straight to `catalog/{animeId}` in Firestore (v2.3.0). The old
//      Mode 1 desktop server and the Excel paste workflow are both retired.
//   4. Inline AI suggestion panels (open Claude with prompt → paste back)
//
// Author: Code | date: 2026-05-10 | Mode 1 baseline (v1.6.0) + server (v1.6.1)
// =============================================================================

import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {
  doc, getDoc, setDoc, collection, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const FULL_QUERY = `
query ($search: String!) {
  Media(search: $search, type: ANIME) {
    id
    idMal
    title { romaji english }
    description(asHtml: false)
    episodes
    seasonYear
    season
    format
    status
    genres
    tags { name rank isMediaSpoiler }
    studios { nodes { name isAnimationStudio } }
    coverImage { large extraLarge color }
    averageScore
    trailer { id site }
    externalLinks { site url type language }
    siteUrl
    relations {
      edges {
        relationType
        node {
          id
          title { romaji english }
          format
          episodes
          seasonYear
          type
          status
          studios { nodes { name isAnimationStudio } }
          averageScore
          coverImage { large }
        }
      }
    }
  }
}`;

// ---- v1.6.5: search-as-you-type + ID-import + live preview ----------------
const SEARCH_DEBOUNCE_MS = 250;
const PREVIEW_DEBOUNCE_MS = 120;
const SEARCH_MIN_CHARS = 2;

// Lightweight query for the dropdown — just enough to render result items.
const SEARCH_QUERY = `
query ($search: String!) {
  Page(perPage: 8) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title { romaji english }
      format
      seasonYear
    }
  }
}`;

// Same shape as FULL_QUERY but takes an Int id instead of String search.
// Used by dropdown-select + ID-import paths (both land at populateForm).
const FULL_QUERY_BY_ID = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title { romaji english }
    description(asHtml: false)
    episodes
    seasonYear
    season
    format
    status
    genres
    tags { name rank isMediaSpoiler }
    studios { nodes { name isAnimationStudio } }
    coverImage { large extraLarge color }
    averageScore
    trailer { id site }
    externalLinks { site url type language }
    siteUrl
    relations {
      edges {
        relationType
        node {
          id
          title { romaji english }
          format
          episodes
          seasonYear
          type
          status
          studios { nodes { name isAnimationStudio } }
          averageScore
          coverImage { large }
        }
      }
    }
  }
}`;

const state = {
  anilist: null,
  imageSource: 'anilist',
  imageOverride: '',
  // v1.7.3 — watched-set: the multi-hop franchise entries, the checked id Set,
  // and the full visible id list (KnownAniListIds snapshot for Mode 2's future diff).
  watchedEntries: [],
  watchedChecked: null,
  watchedTreeIds: [],
  // v1.7.3 — chatbot drawer conversation (mirrored to sessionStorage per anime)
  chatMessages: [],
};

// v1.6.5 module-level state for search-as-you-type + preview debounce
let _searchDebounceTimer = null;
let _previewDebounceTimer = null;
let _searchResultsCache = [];
let _searchSelectedIndex = -1;

// ---- v2.3.0 - the desktop-server probe is gone: there is no server to
//      detect. The page has one mode, and it is the cloud.

// ---- Helpers -------------------------------------------------------------
function $(id) { return document.getElementById(id); }

function setStatus(message, kind = 'info') {
  const el = $('fetch-status');
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = 'muted small status-line ' + (kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : '');
}

function showStep(n) { $('step' + n).hidden = false; }
function hideAllSteps() {
  for (const id of ['step2', 'step3', 'step4', 'step5', 'output-section']) {
    $(id).hidden = true;
  }
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function maybeCapitalize(name) {
  if (!name) return '';
  if (name === name.toLowerCase()) {
    return name.split(/\s+/).map(w => (w[0] || '').toUpperCase() + w.slice(1)).join(' ');
  }
  return name;
}

function pickAnimationStudios(studios) {
  if (!studios?.nodes?.length) return '';
  const animation = studios.nodes.filter(s => s.isAnimationStudio);
  const list = animation.length ? animation : studios.nodes;
  return list.map(s => maybeCapitalize(s.name)).join(', ');
}

function normalizeTrailer(trailer) {
  if (!trailer?.id || trailer.site !== 'youtube') return '';
  return `https://www.youtube.com/embed/${trailer.id}`;
}

function formatEpisodesHint(media) {
  const parts = [];
  if (media.format) parts.push(media.format);
  if (media.episodes) parts.push(`${media.episodes} ep`);
  if (media.seasonYear) parts.push(media.seasonYear);
  if (media.status) parts.push(media.status.toLowerCase().replace('_', ' '));
  return parts.join(' · ');
}

function formatScore(score) {
  return score ? (score / 10).toFixed(1) + '/10 (' + score + '/100)' : 'n/a';
}

function streamingFromAniList(externalLinks) {
  if (!externalLinks?.length) return [];
  return externalLinks.filter(l => l.type === 'STREAMING').map(l => l.site);
}

async function fetchAniList(title) {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: FULL_QUERY, variables: { search: title } }),
  });
  if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data?.Media || null;
}

// v1.6.5 — lightweight multi-result search for the dropdown.
async function searchAniList(query) {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query } }),
  });
  if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data?.Page?.media || [];
}

// v1.6.5 — full Media payload by ID. Used by dropdown-select + ID-import paths.
async function fetchAniListById(id) {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: FULL_QUERY_BY_ID, variables: { id: parseInt(id, 10) } }),
  });
  if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data?.Media || null;
}

// ---- v1.6.7 — franchise aggregation -----------------------------------------
//
// Aggregate franchise data from media.relations (single-hop only).
// Filter: type:ANIME + relationType in PREQUEL|SEQUEL|PARENT (main TV chain).
// SIDE_STORY, ALTERNATIVE, ADAPTATION, SUMMARY, OTHER excluded — the panel
// would get noisy if every spin-off counted as a "season."
//
// One-hop limitation: fetching Season 2 catches Season 1 (PREQUEL) and
// Season 3 (SEQUEL) but not earlier prequels. populateForm surfaces a
// setStatus warning when the fetched entry has a PREQUEL, hinting the
// user might want to fetch Season 1 for cleanest aggregation.
//
// Returns { seasonCount, totalEpisodes, studios, entries }:
//   - entries[] sorted chronologically (seasonYear ascending; ties broken
//     by TYPE_ORDER so PREQUEL < PARENT < MAIN < SEQUEL — captures natural
//     reading order when AniList groups same-year prequel OVAs with the
//     main TV entry, e.g. OPM Season 1 + Road to Hero both in 2015).
//   - studios[] case-insensitively deduplicated; original capitalization
//     preserved. Caller does maybeCapitalize() for display.
function aggregateFranchise(media) {
  const MAIN_RELATIONS = ['PREQUEL', 'SEQUEL', 'PARENT'];
  const TYPE_ORDER = { PREQUEL: 0, PARENT: 1, MAIN: 2, SEQUEL: 3 };

  // Combine fetched entry with its main-franchise neighbors.
  const entries = [
    { ...media, relationType: 'MAIN' },
    ...(media.relations?.edges || [])
      .filter(e => e.node?.type === 'ANIME' && MAIN_RELATIONS.includes(e.relationType))
      .map(e => ({ ...e.node, relationType: e.relationType })),
  ];

  // Chronological order; same-year ties resolved by relation type so
  // PREQUEL/PARENT appear before MAIN, SEQUEL after.
  entries.sort((a, b) => {
    const yearDelta = (a.seasonYear || 0) - (b.seasonYear || 0);
    if (yearDelta !== 0) return yearDelta;
    return (TYPE_ORDER[a.relationType] ?? 99) - (TYPE_ORDER[b.relationType] ?? 99);
  });

  const seasonCount = entries.length;
  const totalEpisodes = entries.reduce((sum, e) => sum + (e.episodes || 0), 0);

  // Union studios across all franchise entries (case-insensitive dedupe,
  // preserve first-seen capitalization). Animation-studio filter mirrors
  // pickAnimationStudios() at the top of the file.
  const studioSet = new Map();
  for (const e of entries) {
    for (const s of e.studios?.nodes || []) {
      if (s.isAnimationStudio) studioSet.set(s.name.toLowerCase(), s.name);
    }
  }
  const studios = Array.from(studioSet.values());

  return { seasonCount, totalEpisodes, studios, entries };
}

// v1.7.3 — WATCHED-SET checkbox tree (replaces the v1.6.7 single-hop
// renderFranchisePanel). Fetches the FULL franchise via the shared module
// (window.franchiseFetch.traverseFranchise — spine + grouped non-spine) and
// renders a checkbox per entry. Default-checks FINISHED-status entries (locked
// Decision 1: Blake watches after a season fully releases). The source's own
// row is ticked + disabled (locked Decision 7, belt+suspenders — also force-
// injected at row-gen). Checked set → WatchedAniListIds; full visible tree →
// KnownAniListIds (locked two-column Mode 2 shape). Async: self-renders when the
// traversal returns (populateForm fires it without awaiting).
function watchedTitleOf(n) {
  return (n.title && (n.title.english || n.title.romaji)) || '(untitled)';
}
function watchedMeta(n) {
  const studio = Array.from(new Set(
    (n.studios?.nodes || []).filter(s => s.isAnimationStudio).map(s => maybeCapitalize(s.name))
  )).join(', ');
  const parts = [n.format, n.episodes ? `${n.episodes} ep` : '', n.seasonYear || ''].filter(Boolean);
  const meta = parts.join(' · ');
  return studio ? (meta ? `${meta} · ${studio}` : studio) : meta;
}
function watchedStatusLabel(s) {
  if (s === 'NOT_YET_RELEASED') return 'UPCOMING';
  if (s === 'RELEASING') return 'AIRING';
  return s || '';
}

async function renderWatchedSetPanel(media) {
  const panel = $('franchise-info-panel');
  if (!panel) return;
  const ul = $('franchise-entries');
  const sourceId = media && media.id;

  state.watchedEntries = [];
  state.watchedChecked = new Set();
  state.watchedTreeIds = [];

  // loading state
  panel.hidden = false;
  ul.innerHTML = '<li class="watched-loading">Loading franchise…</li>';
  updateWatchedCount();

  let tree = null;
  try {
    if (window.franchiseFetch && window.franchiseFetch.traverseFranchise) {
      tree = await window.franchiseFetch.traverseFranchise(sourceId);
    }
  } catch (_) { tree = null; }

  // Visitor may have re-fetched a different anime while this resolved — bail if
  // the current AniList id no longer matches what we started.
  if (!state.anilist || state.anilist.id !== sourceId) return;

  const hasTree = tree && (tree.spine.length || Object.keys(tree.groups).length);
  if (!hasTree) {
    // single entry / fetch failed — hide the panel; watched set is just the
    // source (force-injected at row-gen so the pill still works for S1).
    panel.hidden = true;
    return;
  }

  const entries = [];
  const seen = new Set();
  const pushNode = (n, group, isSource) => {
    if (!n || !n.id || seen.has(n.id)) return;
    seen.add(n.id);
    entries.push({
      id: n.id,
      title: watchedTitleOf(n),
      status: n.status || null,
      meta: watchedMeta(n),
      cover: (n.coverImage && n.coverImage.large) || '',
      group,
      isSource: !!isSource,
    });
  };
  tree.spine.forEach(n => pushNode(n, 'SPINE', n.isSource));
  for (const [rt, nodes] of Object.entries(tree.groups)) {
    nodes.forEach(n => pushNode(n, rt, false));
  }

  state.watchedEntries = entries;
  state.watchedTreeIds = entries.map(e => e.id);
  // default-check: FINISHED only + the source (forced)
  for (const e of entries) {
    if (e.isSource || e.status === 'FINISHED') state.watchedChecked.add(e.id);
  }
  if (sourceId) state.watchedChecked.add(Number(sourceId));

  renderWatchedRows();
}

function renderWatchedRows() {
  const ul = $('franchise-entries');
  if (!ul) return;
  const entries = state.watchedEntries || [];
  ul.innerHTML = entries.map(e => {
    const checked = state.watchedChecked.has(e.id) ? ' checked' : '';
    const disabled = e.isSource ? ' disabled' : '';
    const tag = e.isSource
      ? '<span class="entry-relation entry-relation--main">MAIN</span>'
      : `<span class="entry-relation">${escapeHtml(e.group)}</span>`;
    const cover = e.cover
      ? `<img class="watched-cover" src="${escapeHtml(e.cover)}" alt="" loading="lazy">`
      : '<span class="watched-cover watched-cover--ph" aria-hidden="true"></span>';
    const statusTag = (e.status && e.status !== 'FINISHED')
      ? `<span class="watched-status">${escapeHtml(watchedStatusLabel(e.status))}</span>` : '';
    return `<li class="watched-row${e.isSource ? ' is-source' : ''}">
      <label class="watched-check"${e.isSource ? ' title="The main entry is always included"' : ''}>
        <input type="checkbox" data-watched-id="${escapeHtml(String(e.id))}"${checked}${disabled}>
        <span class="watched-box" aria-hidden="true"></span>
      </label>
      ${cover}
      <span class="watched-body">
        ${tag}
        <span class="entry-title">${escapeHtml(e.title)} ${statusTag}</span>
        <span class="entry-meta">${escapeHtml(e.meta)}</span>
      </span>
    </li>`;
  }).join('');
  updateWatchedCount();
}

function updateWatchedCount() {
  const el = $('watched-count');
  if (!el) return;
  const total = (state.watchedEntries || []).length;
  const sel = state.watchedChecked ? state.watchedChecked.size : 0;
  el.textContent = total ? `${sel} of ${total} selected` : '—';
}

// Comma-separated id strings for the row generator / Mode 1 payload.
// Source AniListId is force-injected into the watched set (belt+suspenders).
function getWatchedAniListIds() {
  const set = new Set(state.watchedChecked ? Array.from(state.watchedChecked).map(Number) : []);
  const src = state.anilist && state.anilist.id;
  if (src) set.add(Number(src));
  return Array.from(set).join(',');
}
function getKnownAniListIds() {
  const set = new Set((state.watchedTreeIds || []).map(Number));
  const src = state.anilist && state.anilist.id;
  if (src) set.add(Number(src));
  return Array.from(set).join(',');
}

// ---- Populate form --------------------------------------------------------
function populateForm(media) {
  state.anilist = media;

  // v1.6.7 — compute franchise aggregation up front; all downstream logic
  // (seasons field, studio field, anilist-summary, FRANCHISE INFO panel)
  // reads from this single object so prefill stays consistent.
  const franchise = aggregateFranchise(media);
  state.franchise = franchise;

  // gate 5c — overwrite title with AniList canonical (e.g. "GOSICK" not user's "gosick")
  // so saved data matches the show's official spelling. English first, romaji fallback,
  // preserve typed value only if both are null (rare). Same pattern as renderSearchResults.
  $('title-input').value = media.title?.english || media.title?.romaji || $('title-input').value;

  const genres = (media.genres || []).slice(0, 2);
  $('genre-input').value = genres.join(' / ');
  $('anilist-genres-list').textContent = `AniList genres: ${(media.genres || []).join(', ') || 'none'}`;

  const fmt = media.format;
  let seasonsGuess;
  if (franchise.seasonCount > 1) {
    // v1.6.7 — use aggregated franchise count instead of single-entry heuristic
    seasonsGuess = `${franchise.seasonCount} seasons`;
  } else {
    seasonsGuess = '1 season';
    if (fmt === 'MOVIE') seasonsGuess = '1 movie';
    else if (fmt === 'OVA' || fmt === 'ONA' || fmt === 'SPECIAL') seasonsGuess = `1 ${fmt.toLowerCase()}`;
  }
  $('seasons-input').value = seasonsGuess;
  $('anilist-episodes-hint').textContent = `AniList: ${formatEpisodesHint(media)}`;

  let desc = (media.description || '').replace(/<[^>]+>/g, '').trim();
  if (desc.length > 600) desc = desc.slice(0, 600) + '…';
  $('description-input').value = desc;

  // v1.6.7 — union studios across franchise when there's more than one
  // animation studio across entries; otherwise fall back to single-entry pick.
  $('studio-input').value = franchise.studios.length > 1
    ? franchise.studios.map(maybeCapitalize).join(', ')
    : pickAnimationStudios(media.studios);
  $('trailer-input').value = normalizeTrailer(media.trailer);

  const streaming = streamingFromAniList(media.externalLinks);
  $('watch-official-input').value = streaming.join(', ');
  const fillBtn = $('fill-official-btn'); if (fillBtn) fillBtn.disabled = false;
  $('anilist-streaming-list').textContent = streaming.length
    ? `AniList STREAMING links: ${streaming.join(', ')}`
    : 'AniList: no STREAMING links — fill in manually.';

  const goodTags = (media.tags || [])
    .filter(t => t.rank >= 60 && !t.isMediaSpoiler)
    .slice(0, 8)
    .map(t => '#' + t.name.toLowerCase().replace(/\s+/g, '-'));
  $('tags-input').value = goodTags.join(' ');
  $('anilist-tags-list').textContent = `AniList top tags: ${(media.tags || []).slice(0, 12).map(t => t.name).join(', ') || 'none'}`;

  state.imageSource = 'anilist';
  state.imageOverride = '';
  const previewImg = $('image-preview');
  previewImg.src = media.coverImage?.extraLarge || media.coverImage?.large || '';
  previewImg.alt = (media.title?.romaji || 'Cover') + ' cover (AniList)';
  $('image-source-label').textContent = 'AniList default';
  $('image-dims-label').textContent = '';
  previewImg.onload = () => {
    const w = previewImg.naturalWidth, h = previewImg.naturalHeight;
    const ratio = h / w;
    const ratioOk = ratio > 1.3 && ratio < 1.7;
    $('image-dims-label').textContent = `${w} × ${h} px${ratioOk ? '' : ' ⚠ not 2:3'}`;
  };
  $('override-row').hidden = true;
  $('image-filename-input').value = '';

  // v1.6.7 — append franchise info when the aggregator found multiple entries
  const summaryParts = [
    `AniList ID ${media.id}`,
    formatScore(media.averageScore),
    media.title?.romaji || '',
  ];
  if (franchise.seasonCount > 1) {
    summaryParts.push(`franchise: ${franchise.seasonCount} entries, ${franchise.totalEpisodes} ep`);
  }
  $('anilist-summary').textContent = summaryParts.filter(Boolean).join(' · ');

  showStep(2); showStep(3); showStep(4); showStep(5);
  $('output-section').hidden = true;

  // v1.6.7 — warn if fetched entry has a PREQUEL (likely Season 2+;
  // single-hop aggregation will be partial — recommend fetch Season 1).
  const hasPrequel = (media.relations?.edges || [])
    .some(e => e.relationType === 'PREQUEL' && e.node?.type === 'ANIME');
  if (hasPrequel) {
    setStatus(`Heads up: this entry has a PREQUEL on AniList — aggregation may miss earlier seasons. For the cleanest franchise data, fetch Season 1.`, 'warn');
  }

  // v1.7.3 — render the WATCHED-SET checkbox tree (multi-hop, async).
  renderWatchedSetPanel(media);

  // v1.7.3 — chat: enable the ✨ ASK summon + load this anime's saved history.
  const chatSummon = $('chat-summon-btn'); if (chatSummon) chatSummon.disabled = false;
  loadChatHistory();
  renderChatThread();

  // v1.6.5 — render the live preview card now that AniList data is loaded.
  // All three entry paths (Fetch button, dropdown select, ID-import) land here
  // and therefore get the preview rendered as a side effect of populateForm.
  updatePreview();
}

// ---- v1.6.5: search dropdown + ID-import + live preview helpers -----------

function parseAniListIdOrUrl(input) {
  const trimmed = String(input || '').trim();
  // URL pattern: anilist.co/anime/<digits>/anything  (also without trailing slash)
  const urlMatch = trimmed.match(/anilist\.co\/anime\/(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);
  // Bare numeric
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const err = new Error("That doesn't look like an AniList URL or ID. Paste either the full URL from anilist.co or just the number.");
  err.code = 'PARSE';
  throw err;
}

function renderSearchResults(results) {
  _searchResultsCache = results;
  _searchSelectedIndex = -1;
  const ul = $('search-results');
  if (!results.length) {
    ul.innerHTML = `<li class="search-results-empty">No matches on AniList. Try a different spelling, or use Fetch by ID.</li>`;
    ul.hidden = false;
    $('title-input').setAttribute('aria-expanded', 'true');
    return;
  }
  ul.innerHTML = results.map(r => {
    const title = (r.title?.english || r.title?.romaji || '(no title)');
    const meta = `${r.format || '?'} · ${r.seasonYear || '—'}`;
    return `<li class="search-result-item" role="option" aria-selected="false" data-anilist-id="${r.id}">
      <span class="result-title">${escapeHtml(title)}</span>
      <span class="result-meta">${escapeHtml(meta)}</span>
    </li>`;
  }).join('');
  ul.hidden = false;
  $('title-input').setAttribute('aria-expanded', 'true');
}

function renderSearchResultsError(msg) {
  const ul = $('search-results');
  ul.innerHTML = `<li class="search-results-empty">${escapeHtml(msg)}</li>`;
  ul.hidden = false;
  $('title-input').setAttribute('aria-expanded', 'true');
}

function clearSearchResults() {
  const ul = $('search-results');
  ul.innerHTML = '';
  ul.hidden = true;
  _searchResultsCache = [];
  _searchSelectedIndex = -1;
  $('title-input').setAttribute('aria-expanded', 'false');
}

function highlightResult(index) {
  if (!_searchResultsCache.length) return;
  if (index < 0) index = _searchResultsCache.length - 1;
  if (index >= _searchResultsCache.length) index = 0;
  _searchSelectedIndex = index;
  const items = $('search-results').querySelectorAll('.search-result-item');
  items.forEach((li, i) => {
    li.setAttribute('aria-selected', i === index ? 'true' : 'false');
    if (i === index) li.scrollIntoView({ block: 'nearest' });
  });
}

function selectResultByIndex(index) {
  if (index < 0 || index >= _searchResultsCache.length) return;
  selectResultById(_searchResultsCache[index].id);
}

async function selectResultById(anilistId) {
  setStatus('Fetching from AniList…');
  try {
    const media = await fetchAniListById(anilistId);
    if (!media) {
      setStatus(`Couldn't find an anime with ID ${anilistId} on AniList. Double-check the number.`, 'error');
      return;
    }
    populateForm(media);   // calls updatePreview() at its end (gate 5 adjustment #2 — no duplicate)
    clearSearchResults();
    setStatus(`Loaded "${media.title?.romaji || ''}".`);
  } catch (err) {
    setStatus(`AniList error: ${err.message}`, 'error');
  }
}

function setIdStatus(msg, kind) {
  const el = $('id-fetch-status');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
  el.className = 'muted small status-line' + (kind === 'error' ? ' error' : '');
}

// Build the preview card data from CURRENT form state so Blake's edits reflect
// immediately, not the AniList original. Image handling: AniList CDN URLs use
// assetBase='' (URL is absolute); manual overrides + placeholder fall back to
// '../assets/' because the admin form lives one level deep.
function buildPreviewAnimeData() {
  const title = $('title-input').value.trim() || '(Untitled)';
  const genre = $('genre-input').value.trim();
  const rating = $('rating-input').value.trim();
  let image, assetBase;
  if (state.imageSource === 'override' && state.imageOverride) {
    image = state.imageOverride;
    assetBase = '../assets/';
  } else if (state.anilist?.coverImage) {
    image = state.anilist.coverImage.extraLarge || state.anilist.coverImage.large || '';
    assetBase = '';
  } else {
    image = 'placeholder.png';
    assetBase = '../assets/';
  }
  return { anime: { Title: title, Genre: genre, Rating: rating, image }, assetBase };
}

function updatePreview() {
  if (typeof window.renderAnimeCardMarkup !== 'function') return;  // gate 1 contract
  const slot = $('card-preview-slot');
  if (!slot) return;
  // Leave placeholder visible until the user has fetched OR typed a title.
  if (!state.anilist && !$('title-input').value.trim()) return;
  const { anime, assetBase } = buildPreviewAnimeData();
  slot.innerHTML = '';
  const card = window.renderAnimeCardMarkup(anime, { animeId: 'preview', assetBase });
  slot.appendChild(card);
}

function schedulePreviewUpdate() {
  clearTimeout(_previewDebounceTimer);
  _previewDebounceTimer = setTimeout(updatePreview, PREVIEW_DEBOUNCE_MS);
}

// ---- Generate Excel row + commands (paste workflow) -----------------------
function combinedWatch() {
  // v1.7.3 — official platforms only (the unofficial field was removed site-wide).
  const off = $('watch-official-input').value.trim();
  const seen = new Set();
  const out = [];
  for (const seg of off.split(',').map(s => s.trim()).filter(Boolean)) {
    const key = seg.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(seg); }
  }
  return out.join(', ');
}

// ── v2.3.0 — PUBLISH TO THE CATALOG (the cloud path) ────────────────────────
// <!-- author: Code | date: 2026-08-13 -->
// Blake, with a finished review he could not post: "the website posting anime
// admin section thinks we need mode 1 to publish the excel role... We have moved
// onto the cloud."
//
// He was right, and it was worse than a stale banner: this page could only ship
// through the Mode 1 desktop server or an Excel row, and BOTH were retired by the
// cloud migration (`npm run sync` refuses to write from the spreadsheet now).
// Adding a new anime has been impossible since. This is the replacement: one
// write to `catalog/{animeId}`, from any device, no desktop server.
//
// ⚠️ THE SLUG IS THE ONE THING THAT CANNOT BE WRONG. It is the document id AND
// the key every live comment room hangs off, so it comes from the SHARED model
// (RarCatalogModel.slug) — never a local re-implementation. The rules enforce
// animeId == slug == the doc id, so a mismatch is rejected rather than silently
// orphaning discussion.
// The catalog fields the form owns, read straight off the DOM and normalised by
// the SHARED model so this page, the Cloud editor and the old Excel sync cannot
// drift apart. Both the pre-flight check and the write below go through here —
// one reader, so a field can never be validated in one shape and saved in another.
function collectCoreFields(M) {
  const fields = {
    Title: $('title-input').value.trim(),
    Genre: $('genre-input').value.trim(),
    Rating: $('rating-input').value.trim(),
    Seasons: $('seasons-input').value.trim(),
    Description: $('description-input').value.trim(),
    Review: reviewValue(),
    Tags: M.normalizeTags($('tags-input').value.trim()),
    Studio: $('studio-input').value.trim(),
    Platforms: M.normalizePlatforms(combinedWatch()),
    Trailer: M.normalizeTrailer($('trailer-input').value.trim()),
  };
  const top10 = $('top10-input').value.trim();
  if (top10) fields.Top10Rank = Number(top10);
  return fields;
}

// ── v2.3.2 — RESTORED. This function was deleted with the Mode 1 Excel pipeline
// in v2.3.0, but ITS CALL WAS LEFT BEHIND in the Publish click handler. So every
// press of "Publish to catalog" threw `ReferenceError: validateBeforeGenerate is
// not defined` BEFORE publishToCatalog() ever ran: no write, no error text, no
// spinner. Blake: "when I go to publish a new review nothing happens." The page
// booted clean and the button looked right, which is exactly why the v2.3.0 test
// (it reads the label but never clicks) went green over a dead button.
//
// The shared rules stay in RarCatalogModel.validate — ONE source of truth with
// the sync and the Cloud editor. Only what the model cannot see lives here: the
// AniList fetch, and the two fields it does not own (Seasons, Studio) plus the
// image override, which is a form concern, not a catalog one.
function validateBeforeGenerate() {
  const M = window.RarCatalogModel;
  if (!M || typeof M.validate !== 'function') {
    return ['The catalog model did not load — reload the page and try again.'];
  }
  const errors = [];
  if (!state.anilist) errors.push('Fetch from AniList first.');
  errors.push(...M.validate(collectCoreFields(M)));
  if (!$('seasons-input').value.trim()) errors.push('Seasons is empty.');
  if (!$('studio-input').value.trim()) errors.push('Studio is empty.');
  if (state.imageSource === 'override' && !$('image-filename-input').value.trim()) {
    errors.push('Override image filename is empty.');
  }
  return errors;
}

async function publishToCatalog() {
  const btn = $('generate-btn');
  const err = $('generate-error');
  const say = (m) => { if (err) { err.textContent = m; err.hidden = !m; } };
  say('');

  const M = window.RarCatalogModel;
  if (!M || typeof M.slug !== 'function') {
    say('The catalog model did not load — reload the page and try again.');
    return;
  }

  const title = $('title-input').value.trim();
  const review = reviewValue();
  if (!title) { say('A title is required.'); return; }
  if (!review) { say('The review is empty.'); return; }

  const animeId = M.slug(title);
  if (!animeId) { say('That title does not make a usable id.'); return; }

  const a = state.anilist || {};
  // the cover stays a FILENAME (every card builds `assets/<file>`); when he has
  // not overridden it we derive one and the deploy step fetches the art.
  const image = state.imageOverride || (animeId + '.png');

  const fields = { ...collectCoreFields(M), image };
  if (a.id) fields.AniListId = Number(a.id);
  if (a.idMal) fields.IdMal = Number(a.idMal);
  if (a.averageScore) fields.AniListScore = Number(a.averageScore);
  if (a.coverImage && a.coverImage.color) fields.AniListColor = a.coverImage.color;
  if (a.title) {
    if (a.title.english) fields.TitleEnglish = a.title.english;
    if (a.title.romaji) fields.TitleRomaji = a.title.romaji;
    if (a.title.native) fields.TitleNative = a.title.native;
  }
  const watched = getWatchedAniListIds();
  const known = getKnownAniListIds();
  if (watched) fields.WatchedAniListIds = String(watched).split(',').map(Number).filter(Boolean);
  if (known) fields.KnownAniListIds = String(known).split(',').map(Number).filter(Boolean);

  // the sync's own rules, applied BEFORE the write — same validator the Cloud
  // editor uses, so what saves here is what would have shipped from Excel.
  if (typeof M.validate === 'function') {
    const problems = M.validate(fields);
    if (problems && problems.length) { say(problems.join(' · ')); return; }
  }

  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Publishing…';
  try {
    const ref = doc(db, 'catalog', animeId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      say('That anime is already in the catalog — use Edit a Review instead.');
      return;
    }
    // `order` goes on the end. Read the count rather than guess: a wrong order
    // silently reshuffles the whole grid.
    const all = await getDocs(collection(db, 'catalog'));
    const order = all.size;

    await setDoc(ref, {
      animeId, slug: animeId, order,
      ...fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    state.published = { animeId, image, hasOverride: !!state.imageOverride,
                        cover: (a.coverImage && (a.coverImage.extraLarge || a.coverImage.large)) || '' };
    showPublished();
  } catch (e) {
    say('Could not save: ' + (e && e.message ? e.message : 'unknown error'));
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// what he sees when it worked — honest about the one remaining manual step.
function showPublished() {
  const out = $('output-section');
  const box = $('publish-result');
  if (!out || !box) return;
  const p = state.published || {};
  box.innerHTML = '';
  const h = document.createElement('p');
  h.innerHTML = '<strong>Saved to the catalog.</strong> It is stored in the cloud now — '
    + 'your words are safe from here.';
  const n = document.createElement('p');
  n.className = 'muted';
  n.textContent = p.hasOverride
    ? 'Cover: assets/' + p.image + ' (your own file).'
    : 'Cover: assets/' + p.image + ' — the art is fetched from AniList when the site is rebuilt.';
  const s2 = document.createElement('p');
  s2.className = 'muted';
  s2.textContent = 'The public site is built from a generated file, so it appears once the site is rebuilt and deployed.';
  box.appendChild(h); box.appendChild(n); box.appendChild(s2);
  $('step5').hidden = true;
  out.hidden = false;
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- v2.3.0 - the Excel row builder, the 'commands to run' block, and the
//      whole Mode 1 Submit and Ship pipeline (the payload builder, the SSE
//      stream and its progress UI) were DELETED with the workflow they
//      served. The catalog is the source of truth; publishToCatalog above is
//      the one path. Kept out rather than commented out - dead code that
//      reaches for removed DOM ids is a trap for the next reader.

// ---- Helpers -------------------------------------------------------------
// v1.7.3 — the paste-back AI panel (buildAiPrompt / openAiPanel) was removed;
// the chatbot drawer (gate 3) is the only AI surface now. escapeHtml stays —
// it's used by the watched-set rows + elsewhere.
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ---- v1.7.3 — chatbot drawer ---------------------------------------------
// Configurable endpoint — a future Firebase Cloud Function (Option A) drops in
// by changing this one constant.
const CHAT_ENDPOINT = '/api/chat';

function chatKey() {
  const id = state.anilist && state.anilist.id;
  return id ? `rar:chat:${id}` : null;
}
function chatContext() {
  const a = state.anilist || {};
  return {
    title: a.title?.english || a.title?.romaji || '',
    romaji: a.title?.romaji || '',
    year: a.seasonYear || '',
    format: a.format || '',
    studios: Array.from(new Set((a.studios?.nodes || []).filter(s => s.isAnimationStudio).map(s => s.name))),
    genres: a.genres || [],
    description: a.description || '',
  };
}
function loadChatHistory() {
  state.chatMessages = [];
  const k = chatKey();
  if (!k) return;
  try {
    const raw = sessionStorage.getItem(k);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) state.chatMessages = arr.filter(m => !m.pending); }
  } catch (_) {}
}
function saveChatHistory() {
  const k = chatKey();
  if (!k) return;
  try { sessionStorage.setItem(k, JSON.stringify((state.chatMessages || []).filter(m => !m.pending))); } catch (_) {}
}
function clearChatForCurrent() {
  const k = chatKey();
  state.chatMessages = [];
  if (k) { try { sessionStorage.removeItem(k); } catch (_) {} }
  renderChatThread();
}
function openChatDrawer() {
  const d = $('chat-drawer');
  if (!d || !state.anilist) return;
  d.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('open')));
  $('chat-summon-btn')?.setAttribute('aria-expanded', 'true');
  renderChatThread();
  $('chat-input')?.focus();
}
function closeChatDrawer() {
  const d = $('chat-drawer');
  if (!d) return;
  d.classList.remove('open');
  $('chat-summon-btn')?.setAttribute('aria-expanded', 'false');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) d.hidden = true;
  else setTimeout(() => { if (!d.classList.contains('open')) d.hidden = true; }, 280);
}
function renderChatThread() {
  const thread = $('chat-thread');
  const empty = $('chat-empty');
  if (!thread) return;
  const msgs = state.chatMessages || [];
  if (empty) empty.hidden = msgs.length > 0;
  thread.innerHTML = msgs.map((m, i) => {
    if (m.pending) {
      return '<div class="chat-msg chat-msg--assistant"><div class="chat-bubble"><span class="chat-dots"><i></i><i></i><i></i></span></div></div>';
    }
    if (m.error) {
      const retry = m.retry ? ` <button type="button" class="chat-retry" data-retry="${i}">Retry</button>` : '';
      return `<div class="chat-msg chat-msg--assistant"><div class="chat-bubble chat-bubble--error">${escapeHtml(m.content)}${retry}</div></div>`;
    }
    const cls = m.role === 'user' ? 'chat-msg chat-msg--user' : 'chat-msg chat-msg--assistant';
    return `<div class="${cls}"><div class="chat-bubble">${escapeHtml(m.content).replace(/\n/g, '<br>')}</div></div>`;
  }).join('');
  thread.scrollTop = thread.scrollHeight;
}
async function callChatApi() {
  state.chatMessages.push({ role: 'assistant', pending: true });
  renderChatThread();
  const apiMessages = state.chatMessages
    .filter(m => !m.pending && !m.error)
    .map(m => ({ role: m.role, content: m.content }));
  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages, animeContext: chatContext() }),
    });
    state.chatMessages = state.chatMessages.filter(m => !m.pending);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      // v1.10.2 — friendly copy only (mirrors admin/chat-drawer.js): raw server
      // errors / status codes never reach the drawer. A JSON error body means
      // Mode 1 answered and hit a snag; anything else means it isn't reachable.
      let msg;
      if (/API_KEY/i.test(b.error || '')) {
        msg = 'The assistant key is missing from .env on the desktop — add it, then restart Mode 1.';
      } else if (b.error) {
        msg = 'The assistant hit a snag — please try again.';
      } else {
        msg = 'The assistant needs Mode 1 running on the desktop — double-click MODE 1, then try again.';
      }
      state.chatMessages.push({ role: 'assistant', error: true, retry: true, content: msg });
    } else {
      const data = await res.json();
      state.chatMessages.push({ role: 'assistant', content: data.text || '(no response)' });
    }
  } catch (_) {
    state.chatMessages = state.chatMessages.filter(m => !m.pending);
    state.chatMessages.push({ role: 'assistant', error: true, retry: true, content: 'The assistant needs Mode 1 running on the desktop — double-click MODE 1, then try again.' });
  }
  renderChatThread();
  saveChatHistory();
}
function sendChat(text) {
  text = (text || '').trim();
  if (!text || !state.anilist) return;
  state.chatMessages.push({ role: 'user', content: text });
  saveChatHistory();
  callChatApi();
}
function retryChat() {
  while (state.chatMessages.length && state.chatMessages[state.chatMessages.length - 1].error) {
    state.chatMessages.pop();
  }
  saveChatHistory();
  callChatApi();
}

// ---- Wire UI -------------------------------------------------------------
function wire() {
  $('fetch-btn').addEventListener('click', async () => {
    const title = $('title-input').value.trim();
    if (!title) { setStatus('Type a title first.', 'error'); return; }
    setStatus('Fetching from AniList…');
    try {
      const media = await fetchAniList(title);
      if (!media) { setStatus(`No match on AniList for "${title}". Try a different spelling?`, 'error'); return; }
      populateForm(media);
      setStatus(`Loaded "${media.title?.romaji || title}" — review and edit fields below, then Publish.`);
    } catch (err) {
      setStatus(`AniList error: ${err.message}`, 'error');
    }
  });

  $('title-input').addEventListener('keydown', (e) => {
    // v1.6.5 — dropdown keyboard nav takes precedence when a result is highlighted;
    // otherwise Enter falls back to the existing fetch-btn behavior.
    if (e.key === 'ArrowDown') {
      if ($('search-results').hidden) return;
      e.preventDefault();
      highlightResult(_searchSelectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      if ($('search-results').hidden) return;
      e.preventDefault();
      highlightResult(_searchSelectedIndex - 1);
    } else if (e.key === 'Enter') {
      if (_searchSelectedIndex >= 0) {
        e.preventDefault();
        selectResultByIndex(_searchSelectedIndex);
      } else {
        e.preventDefault();
        $('fetch-btn').click();
      }
    } else if (e.key === 'Escape') {
      clearSearchResults();
    }
  });

  // v1.6.5 — search-as-you-type
  $('title-input').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(_searchDebounceTimer);
    if (q.length < SEARCH_MIN_CHARS) { clearSearchResults(); return; }
    _searchDebounceTimer = setTimeout(async () => {
      try {
        const results = await searchAniList(q);
        renderSearchResults(results);
      } catch (err) {
        renderSearchResultsError("Couldn't reach AniList — try again in a moment.");
      }
    }, SEARCH_DEBOUNCE_MS);
  });

  // v1.6.5 — dropdown click delegation
  $('search-results').addEventListener('click', (e) => {
    const li = e.target.closest('.search-result-item');
    if (!li) return;
    const id = parseInt(li.dataset.anilistId, 10);
    if (Number.isFinite(id)) selectResultById(id);
  });

  // v1.6.5 — click outside the dropdown clears it
  document.addEventListener('click', (e) => {
    const results = $('search-results');
    if (!results || results.hidden) return;
    if (!results.contains(e.target) && e.target !== $('title-input')) {
      clearSearchResults();
    }
  });

  // v1.6.5 — ID-import button: parse → fetch by ID → populateForm (which renders preview)
  $('fetch-by-id-btn').addEventListener('click', async () => {
    const raw = $('anilist-id-input').value;
    setIdStatus('');
    let id;
    try { id = parseAniListIdOrUrl(raw); }
    catch (err) { setIdStatus(err.message, 'error'); return; }
    setIdStatus(`Fetching AniList ID ${id}…`);
    try {
      const media = await fetchAniListById(id);
      if (!media) {
        setIdStatus(`Couldn't find an anime with ID ${id} on AniList. Double-check the number.`, 'error');
        return;
      }
      populateForm(media);   // calls updatePreview() at its end (gate 5 adjustment #2 — no duplicate)
      setIdStatus(`Loaded "${media.title?.romaji || ''}" by ID.`);
      $('anilist-id-input').value = '';
    } catch (err) {
      setIdStatus(`AniList error: ${err.message}`, 'error');
    }
  });

  // v1.6.5 — Enter key on id-input triggers the ID-import button
  $('anilist-id-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('fetch-by-id-btn').click(); }
  });

  // v1.6.5 — live preview re-render on field changes
  for (const fieldId of ['title-input', 'genre-input', 'rating-input']) {
    $(fieldId)?.addEventListener('input', schedulePreviewUpdate);
  }

  $('override-btn').addEventListener('click', () => {
    state.imageSource = 'override';
    $('override-row').hidden = false;
    $('image-source-label').textContent = 'Manual override';
    $('image-filename-input').focus();
    schedulePreviewUpdate();   // v1.6.5
  });

  $('image-filename-input').addEventListener('input', (e) => {
    state.imageOverride = e.target.value.trim();
    if (state.imageOverride) {
      $('image-preview').src = '../assets/' + state.imageOverride;
      $('image-preview').alt = state.imageOverride + ' (manual override)';
    }
    schedulePreviewUpdate();   // v1.6.5
  });

  $('revert-image-btn').addEventListener('click', () => {
    if (!state.anilist) return;
    state.imageSource = 'anilist';
    state.imageOverride = '';
    $('image-preview').src = state.anilist.coverImage?.extraLarge || state.anilist.coverImage?.large || '';
    $('image-preview').alt = (state.anilist.title?.romaji || 'Cover') + ' cover (AniList)';
    $('image-source-label').textContent = 'AniList default';
    $('override-row').hidden = true;
    $('image-filename-input').value = '';
    schedulePreviewUpdate();   // v1.6.5
  });

  $('generate-btn').addEventListener('click', () => {
    const errors = validateBeforeGenerate();
    if (errors.length) {
      $('generate-error').hidden = false;
      $('generate-error').textContent = 'Fix these first: ' + errors.join(' ');
      return;
    }
    $('generate-error').hidden = true;
    clearChatForCurrent(); // v1.7.3 — auto-clear the chat on publish
    publishToCatalog();
  });

  // v2.3.0 - the deploy-confirm buttons went with the Mode 1 pipeline.

  // Copy buttons (for paste-workflow output blocks)
  document.addEventListener('click', async (e) => {
    if (!e.target.matches('.copy-btn')) return;
    const targetId = e.target.dataset.copyTarget;
    const text = $(targetId)?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      const orig = e.target.textContent;
      e.target.textContent = 'Copied!';
      e.target.classList.add('copied');
      setTimeout(() => { e.target.textContent = orig; e.target.classList.remove('copied'); }, 1400);
    } catch (err) {
      // gate 31 — no native alert(): report failure the same way success is
      // reported, inline on the button itself (the status Blake is looking at).
      console.error('copy failed', err);
      const orig = e.target.textContent;
      e.target.textContent = 'Copy failed — grab it by hand';
      setTimeout(() => { e.target.textContent = orig; }, 2200);
    }
  });

  $('reset-btn').addEventListener('click', () => {
    for (const id of ['title-input', 'genre-input', 'seasons-input', 'description-input',
                      'studio-input', 'trailer-input', 'watch-official-input', 'tags-input',
                      'rating-input', 'top10-input', 'image-filename-input']) {
      $(id).value = '';
    }
    if (reviewEditor) reviewEditor.load('');   // clear the section-aware Review editor
    state.anilist = null;
    state.imageSource = 'anilist';
    state.imageOverride = '';
    state.watchedEntries = [];
    state.watchedChecked = null;
    state.watchedTreeIds = [];
    state.chatMessages = [];
    const chatSummonBtn = $('chat-summon-btn'); if (chatSummonBtn) chatSummonBtn.disabled = true;
    closeChatDrawer();
    hideAllSteps();
    setStatus('');
    $('title-input').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Number stepper buttons
  document.querySelectorAll('.num-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input[type="number"]');
      if (!input) return;
      const step = parseInt(btn.dataset.step, 10);
      const current = input.value === '' ? 0 : parseInt(input.value, 10);
      const next = current + step;
      const min = parseInt(input.min, 10);
      const max = parseInt(input.max, 10);
      if (!isNaN(min) && next < min) return;
      if (!isNaN(max) && next > max) return;
      input.value = next;
    });
  });

  // v1.7.3 — watched-set: checkbox changes + quick toggles (delegated on the panel)
  const fp = $('franchise-info-panel');
  if (fp) {
    fp.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-watched-id]');
      if (!cb || !state.watchedChecked) return;
      const id = Number(cb.dataset.watchedId);
      if (cb.checked) state.watchedChecked.add(id);
      else state.watchedChecked.delete(id);
      updateWatchedCount();
    });
    fp.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-watched-toggle]');
      if (!btn || !state.watchedChecked) return;
      const mode = btn.dataset.watchedToggle;
      const entries = state.watchedEntries || [];
      if (mode === 'all') {
        entries.forEach(en => state.watchedChecked.add(en.id));
      } else if (mode === 'none') {
        state.watchedChecked.clear();
        entries.forEach(en => { if (en.isSource) state.watchedChecked.add(en.id); }); // source forced
      } else if (mode === 'spine') {
        state.watchedChecked.clear();
        entries.forEach(en => { if (en.group === 'SPINE') state.watchedChecked.add(en.id); });
      }
      renderWatchedRows();
    });
  }

  // v1.7.3 — "Fill from AniList" re-applies the official streaming list on demand.
  $('fill-official-btn')?.addEventListener('click', () => {
    const m = state.anilist;
    if (!m) return;
    $('watch-official-input').value = streamingFromAniList(m.externalLinks).join(', ');
  });

  // v1.7.3 — chatbot drawer wiring
  $('chat-summon-btn')?.addEventListener('click', openChatDrawer);
  $('chat-close-btn')?.addEventListener('click', closeChatDrawer);
  $('chat-clear-btn')?.addEventListener('click', clearChatForCurrent);
  const chatForm = $('chat-input-row');
  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('chat-input');
    const v = inp.value;
    inp.value = '';
    inp.style.height = '';
    sendChat(v);
  });
  const chatInput = $('chat-input');
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatForm.requestSubmit) chatForm.requestSubmit();
      else { const v = chatInput.value; chatInput.value = ''; sendChat(v); }
    }
  });
  // auto-grow the input up to its max-height
  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });
  $('chat-drawer')?.addEventListener('click', (e) => {
    const qs = e.target.closest('[data-quickstart]');
    if (qs) { sendChat(qs.dataset.quickstart); return; }
    if (e.target.closest('[data-retry]')) { retryChat(); return; }
  });
}

// ---- UID gate + init -----------------------------------------------------
async function init() {

  onAuthStateChanged(auth, (user) => {
    if (!user || user.uid !== ADMIN_UID) {
      window.location.replace('../index.html');
      return;
    }
    $('admin-gate').style.display = 'none';
    $('admin-main').hidden = false;
    wire();

    // v1.6.11 — Suggestion Box handoff: if `?suggest=<title>` is present (the
    // admin clicked "Add this anime" on the /admin/suggestions queue), prefill
    // the title input. Coexists with `?skipPush=1` / `?dryRun=1` submit-time
    const handoffParams = new URLSearchParams(window.location.search);
    const suggestTitle = handoffParams.get('suggest');
    if (suggestTitle) {
      const titleInput = document.getElementById('title-input');
      if (titleInput) titleInput.value = suggestTitle;
    }

    // v1.6.11 gate 3e — if the visitor picked from /suggest's search dropdown,
    // the queue row's "Add this anime" button also passes `?anilistId=<id>`.
    // Auto-trigger Fetch by ID so admin skips the search step entirely.
    const anilistId = handoffParams.get('anilistId');
    if (anilistId) {
      const idInput = document.getElementById('anilist-id-input');
      const fetchByIdBtn = document.getElementById('fetch-by-id-btn');
      if (idInput && fetchByIdBtn) {
        idInput.value = anilistId;
        fetchByIdBtn.click();
      }
    }

    // Milestone F — the Curator Studio's "Publish this one" handoff: the studio
    // stashes its 9-section notes in localStorage (they can't ride a URL), then
    // sends the admin here with ?anilistId=&fromStudio=1. AniList fills the
    // metadata; the Review field is BLAKE's own (AniList never touches it), so
    // loading his studio notes into the section editor here is race-free —
    // independent of the fetch above. One-shot: the draft is cleared on read.
    try {
      if (handoffParams.get('fromStudio') === '1') {
        const raw = localStorage.getItem('rar:studio-draft');
        const draft = raw ? JSON.parse(raw) : null;
        if (draft && String(draft.anilistId) === String(anilistId)) {
          if (reviewEditor && typeof draft.notesMd === 'string' && draft.notesMd.trim()) {
            reviewEditor.load(draft.notesMd);
          }
          if (draft.title) {
            const titleInput = document.getElementById('title-input');
            if (titleInput && !titleInput.value.trim()) titleInput.value = draft.title;
          }
        }
        localStorage.removeItem('rar:studio-draft');
      }
    } catch (_) { /* a malformed draft just means no prefill */ }

    // v2.3.0 — ONE path now: straight to the catalog in the cloud. The Mode 1
    // desktop server and the Excel paste workflow are both gone (the migration
    // retired them; `npm run sync` refuses to write from the spreadsheet), and
    // leaving their labels here was telling Blake to go and start a server that
    // no longer exists.
    $('generate-btn').textContent = 'Publish to catalog';
    $('server-mode-label').textContent = 'Cloud - 雲';
    $('server-mode-label').className = 'admin-section-aside local';

    const modeNotice = $('mode-notice');
    if (modeNotice) {
      modeNotice.textContent = 'Saves straight to the catalog in the cloud. '
        + 'It goes public when the site is next rebuilt and deployed.';
      modeNotice.className = 'mode-notice local';
      modeNotice.hidden = false;
    }

    $('title-input').focus();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================================================
// v1.7.4 (gate 3b) — Review field markdown: live preview + B/I/Link toolbar.
// Uses the shared window.renderMarkdown (markdown.js) — single source of truth.
// ============================================================================
// v1.8.2 (gate 3b) — the Review field is now the shared section-aware editor
// (admin/section-editor.js); its per-section B/I/🔗 toolbars replace the old single
// toolbar, and reviewValue() compiles the sections back to the stored markdown.
let reviewEditor = null;
function reviewValue() { return reviewEditor ? reviewEditor.value().trim() : ''; }
function initReviewMarkdown() {
  const mountEl = document.getElementById('review-editor');
  const preview = document.getElementById('review-md-preview');
  if (!mountEl || !preview) return;
  const updatePreview = () => {
    const md = reviewEditor ? reviewEditor.value() : '';
    preview.innerHTML = (md && md.trim())
      ? (window.RarSectionEditor ? window.RarSectionEditor.previewHtml(md)
        : (window.renderMarkdown ? window.renderMarkdown(md) : ''))
      : '<p class="md-preview-empty">Formatted preview appears here as you type.</p>';
  };
  if (window.RarSectionEditor) reviewEditor = window.RarSectionEditor.mount(mountEl, { onChange: updatePreview });
  updatePreview();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReviewMarkdown);
} else {
  initReviewMarkdown();
}
