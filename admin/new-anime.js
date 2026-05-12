// admin/new-anime.js — Mode 1 baseline form logic
// =============================================================================
// What this does:
//   1. Gates the page behind admin UID check
//   2. Form: type title → fetch from AniList → edit fields → review/rating
//   3. Detects Mode 1 server (localhost) vs deployed:
//      - Local: Submit & Ship (sends to /api/submit, streams progress)
//      - Remote: Generate Excel Row (paste workflow)
//   4. Inline AI suggestion panels (open Claude with prompt → paste back)
//
// Author: Code | date: 2026-05-10 | Mode 1 baseline (v1.6.0) + server (v1.6.1)
// =============================================================================

import { auth } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

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
  }
}`;

const state = {
  anilist: null,
  imageSource: 'anilist',
  imageOverride: '',
  serverMode: 'remote',
};

// v1.6.5 module-level state for search-as-you-type + preview debounce
let _searchDebounceTimer = null;
let _previewDebounceTimer = null;
let _searchResultsCache = [];
let _searchSelectedIndex = -1;

// ---- Detect Mode 1 server (localhost only) -------------------------------
async function detectServerMode() {
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocal) return 'remote';
  try {
    const res = await fetch('/api/health', { method: 'GET' });
    if (res.ok) {
      const body = await res.json();
      if (body?.ok && body?.server === 'mode1') return 'local';
    }
  } catch { /* server not running */ }
  return 'remote';
}

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
  el.className = 'muted small status-line ' + (kind === 'error' ? 'error' : '');
}

function showStep(n) { $('step' + n).hidden = false; }
function hideAllSteps() {
  for (const id of ['step2', 'step3', 'step4', 'step5', 'output-section', 'progress-section']) {
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

// ---- Populate form --------------------------------------------------------
function populateForm(media) {
  state.anilist = media;

  // gate 5c — overwrite title with AniList canonical (e.g. "GOSICK" not user's "gosick")
  // so saved data matches the show's official spelling. English first, romaji fallback,
  // preserve typed value only if both are null (rare). Same pattern as renderSearchResults.
  $('title-input').value = media.title?.english || media.title?.romaji || $('title-input').value;

  const genres = (media.genres || []).slice(0, 2);
  $('genre-input').value = genres.join(' / ');
  $('anilist-genres-list').textContent = `AniList genres: ${(media.genres || []).join(', ') || 'none'}`;

  const fmt = media.format;
  let seasonsGuess = '1 season';
  if (fmt === 'MOVIE') seasonsGuess = '1 movie';
  else if (fmt === 'OVA' || fmt === 'ONA' || fmt === 'SPECIAL') seasonsGuess = `1 ${fmt.toLowerCase()}`;
  $('seasons-input').value = seasonsGuess;
  $('anilist-episodes-hint').textContent = `AniList: ${formatEpisodesHint(media)}`;

  let desc = (media.description || '').replace(/<[^>]+>/g, '').trim();
  if (desc.length > 600) desc = desc.slice(0, 600) + '…';
  $('description-input').value = desc;

  $('studio-input').value = pickAnimationStudios(media.studios);
  $('trailer-input').value = normalizeTrailer(media.trailer);

  const streaming = streamingFromAniList(media.externalLinks);
  $('watch-official-input').value = streaming.join(', ');
  $('watch-unofficial-input').value = '';
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

  $('anilist-summary').textContent =
    `AniList ID ${media.id} · ${formatScore(media.averageScore)} · ${media.title?.romaji || ''}`;

  showStep(2); showStep(3); showStep(4); showStep(5);
  $('output-section').hidden = true;
  $('progress-section').hidden = true;

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
  const off = $('watch-official-input').value.trim();
  const unoff = $('watch-unofficial-input').value.trim();
  const seen = new Set();
  const out = [];
  for (const seg of (off + ',' + unoff).split(',').map(s => s.trim()).filter(Boolean)) {
    const key = seg.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(seg); }
  }
  return out.join(', ');
}

function buildExcelRow() {
  const title = $('title-input').value.trim();
  const rating = $('rating-input').value.trim();
  const seasons = $('seasons-input').value.trim();
  const genre = $('genre-input').value.trim();
  const description = $('description-input').value.trim();
  const review = $('review-input').value.trim();
  const tags = $('tags-input').value.trim();
  const watch = combinedWatch();
  const studio = $('studio-input').value.trim();
  const trailer = $('trailer-input').value.trim();
  const top10 = $('top10-input').value.trim();

  const a = state.anilist || {};
  const aniListId = a.id || '';
  const idMal = a.idMal || '';
  const aniListScore = a.averageScore || '';
  const aniListColor = a.coverImage?.color || '';

  const cols = [
    title, rating, seasons, genre, description, review, tags, watch, studio, trailer,
    '', '',
    top10, aniListId, idMal, aniListScore, aniListColor,
  ];
  return cols.map(v => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t');
}

function buildCommands() {
  const title = $('title-input').value.trim();
  const imageStep = state.imageSource === 'anilist'
    ? `# 0. Save the AniList cover image into assets/ (download from the URL on this page).\n#    Use a slug filename like ${slugify(title)}.png — match the format of existing images.\n\n`
    : `# 0. Confirm your override image file already exists at assets/${state.imageOverride}.\n\n`;
  return imageStep +
`cd "C:\\Users\\Owner\\PROJECTS\\Real Anime Reviews\\Current Version"
npm run sync
npm test
node scripts/bump-version.js --check
# bump version (this is a PATCH per project convention for new-anime adds):
# node scripts/bump-version.js <next-version>
git add -A
git commit -m "Add anime: ${title}"
git push
firebase hosting:channel:deploy add-${slugify(title).slice(0, 24)}
# verify the preview URL, then:
firebase deploy --only hosting`;
}

function validateBeforeGenerate() {
  const errors = [];
  if (!state.anilist) errors.push('Fetch from AniList first.');
  if (!$('title-input').value.trim()) errors.push('Title is empty.');
  if (!/^\d+(\.\d+)?\/10$/.test($('rating-input').value.trim())) errors.push('Rating must be X/10 or X.Y/10.');
  if (!$('description-input').value.trim()) errors.push('Description is empty.');
  if (!$('review-input').value.trim()) errors.push('Review is empty.');
  if (!$('genre-input').value.trim()) errors.push('Genre is empty.');
  if (!$('seasons-input').value.trim()) errors.push('Seasons is empty.');
  if (!$('tags-input').value.trim()) errors.push('Tags is empty.');
  if (!combinedWatch()) errors.push('Where to watch is empty.');
  if (!$('studio-input').value.trim()) errors.push('Studio is empty.');
  const trailer = $('trailer-input').value.trim();
  if (!/^https:\/\/www\.youtube\.com\/embed\/[\w-]+$/.test(trailer)) {
    errors.push('Trailer must be a https://www.youtube.com/embed/<id> URL.');
  }
  if (state.imageSource === 'override' && !state.imageOverride.trim()) {
    errors.push('Override image filename is empty.');
  }
  const top10 = $('top10-input').value.trim();
  if (top10 && (!/^\d+$/.test(top10) || +top10 < 1 || +top10 > 10)) {
    errors.push('Top10Rank must be 1–10 if provided.');
  }
  return errors;
}

function showOutput() {
  $('excel-row-output').textContent = buildExcelRow();
  $('commands-output').textContent = buildCommands();
  $('output-section').hidden = false;
  $('output-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Submit & Ship (Mode 1 server) ---------------------------------------
function buildSubmitPayload() {
  const a = state.anilist || {};
  return {
    title: $('title-input').value.trim(),
    rating: $('rating-input').value.trim(),
    seasons: $('seasons-input').value.trim(),
    genre: $('genre-input').value.trim(),
    description: $('description-input').value.trim(),
    review: $('review-input').value.trim(),
    tags: $('tags-input').value.trim(),
    watchOfficial: $('watch-official-input').value.trim(),
    watchUnofficial: $('watch-unofficial-input').value.trim(),
    studio: $('studio-input').value.trim(),
    trailer: $('trailer-input').value.trim(),
    top10Rank: $('top10-input').value.trim(),
    aniListId: a.id,
    idMal: a.idMal,
    aniListScore: a.averageScore,
    aniListColor: a.coverImage?.color,
    imageSource: state.imageSource,
    imageUrl: a.coverImage?.extraLarge || a.coverImage?.large || '',
    imageOverrideFilename: state.imageOverride,
    customBullets: null,
  };
}

function setProgressHeader(text, kind) {
  $('progress-h').textContent = text;
  const num = $('progress-num');
  num.className = 'step-num';
  if (kind === 'running') { num.classList.add('running'); num.textContent = '⟳'; }
  else if (kind === 'done') { num.classList.add('done'); num.textContent = '✓'; }
  else if (kind === 'failed') { num.classList.add('failed'); num.textContent = '✗'; }
}

function appendProgressStep(id, label, status) {
  const list = $('progress-list');
  let li = list.querySelector(`[data-step="${id}"]`);
  if (!li) {
    li = document.createElement('li');
    li.className = `progress-step ${status}`;
    li.dataset.step = id;
    li.innerHTML = `<span class="icon"></span><span class="label"></span>`;
    list.appendChild(li);
  }
  li.className = `progress-step ${status}`;
  li.querySelector('.label').textContent = label;
  const icon = { running: '⟳', done: '✓', failed: '✗', pending: '·' }[status] || '·';
  li.querySelector('.icon').textContent = icon;
}

async function streamSse(url, payload) {
  setProgressHeader('Shipping…', 'running');
  $('progress-section').hidden = false;
  $('progress-error').hidden = true;
  $('progress-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    setProgressHeader('Network error', 'failed');
    $('progress-error').hidden = false;
    $('progress-error').textContent = `Could not reach Mode 1 server: ${err.message}. Is it still running?`;
    return;
  }
  if (!res.ok) {
    setProgressHeader('Server error', 'failed');
    $('progress-error').hidden = false;
    $('progress-error').textContent = `HTTP ${res.status} from Mode 1 server.`;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const lines = block.split('\n');
        let event = 'message';
        // Per SSE spec: multiple `data:` lines join with '\n', and only one
        // optional leading space is stripped (not a full trim).
        const dataParts = [];
        for (const line of lines) {
          if (line.startsWith('event:')) {
            event = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const after = line.slice(5);
            dataParts.push(after.startsWith(' ') ? after.slice(1) : after);
          }
        }
        const data = dataParts.join('\n');
        let pl;
        try { pl = JSON.parse(data); } catch { continue; }
        handleSseEvent(event, pl);
      }
    }
  } catch (err) {
    setProgressHeader('Connection lost', 'failed');
    $('progress-error').hidden = false;
    $('progress-error').textContent = `Stream interrupted: ${err.message}. Check the server terminal for what happened.`;
  }
}

function handleSseEvent(event, data) {
  if (event === 'step') {
    appendProgressStep(data.id, data.label, data.status);
  } else if (event === 'log') {
    appendLogLine(data.line);
  } else if (event === 'error') {
    setProgressHeader('Failed', 'failed');
    $('progress-error').hidden = false;
    $('progress-error').textContent = data.message;
  } else if (event === 'done') {
    if (data.awaitingDeploy) {
      setProgressHeader('Ready to deploy', 'running');
      $('deploy-confirm-row').hidden = false;
    } else {
      setProgressHeader(`Shipped v${data.newVersion || '—'} 🎉`, 'done');
    }
  }
}

// Append a server log line to the streaming details panel (auto-creates it
// if not already present). Useful when a step takes >5s — gives the user
// confidence that something is actually happening.
function appendLogLine(line) {
  let panel = document.getElementById('progress-log-panel');
  if (!panel) {
    panel = document.createElement('details');
    panel.id = 'progress-log-panel';
    panel.className = 'progress-log-panel';
    panel.innerHTML = `
      <summary>Show server output</summary>
      <pre id="progress-log-pre" class="progress-log-pre"></pre>
    `;
    $('progress-list').after(panel);
  }
  const pre = document.getElementById('progress-log-pre');
  if (pre) {
    pre.textContent += line + '\n';
    pre.scrollTop = pre.scrollHeight;
  }
}

function submitAndShip() {
  const payload = buildSubmitPayload();
  $('progress-list').innerHTML = '';
  $('progress-error').hidden = true;
  $('progress-error').textContent = '';
  $('deploy-confirm-row').hidden = true;
  // Clear any previous log panel
  document.getElementById('progress-log-panel')?.remove();
  $('progress-section').hidden = false;
  // Default flags — Blake or Code can append &skipPush=1 manually for tests
  const params = new URLSearchParams(window.location.search);
  const queryFlags = ['skipDeploy=1'];
  if (params.has('skipPush')) queryFlags.push('skipPush=1');
  if (params.has('dryRun')) queryFlags.push('dryRun=1');
  streamSse('/api/submit?' + queryFlags.join('&'), payload);
}

// ---- AI suggestion panel -------------------------------------------------
function buildAiPrompt(kind) {
  const m = state.anilist;
  if (!m) return '';
  const cleanDesc = (m.description || '').replace(/<[^>]+>/g, '').slice(0, 500);
  if (kind === 'description') {
    return `Write a single factual sentence (max ~30 words) describing this anime's premise, suitable for an anime-review website card. Just the premise, no opinions.\n\nTitle: ${m.title?.romaji || ''}\nGenres: ${(m.genres || []).join(', ')}\nFormat: ${m.format || ''}\nEpisodes: ${m.episodes || 'unknown'}\nAniList raw: ${cleanDesc}`;
  }
  return `Suggest 4-7 short kebab-case tags for this anime, # prefixed and space-separated (like "#action #fan-service #op-mc"). Match a casual hobbyist tone — concrete, evocative, opinionated. Avoid generic tags like "anime" or "japan".\n\nTitle: ${m.title?.romaji || ''}\nGenres: ${(m.genres || []).join(', ')}\nAniList top tags: ${(m.tags || []).slice(0, 10).map(t => t.name).join(', ')}\nDescription: ${cleanDesc.slice(0, 300)}`;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function openAiPanel(kind) {
  if (!state.anilist) {
    alert('Fetch the anime from AniList first — Claude needs the metadata to suggest something useful.');
    return;
  }
  const targetId = kind === 'description' ? 'description-input' : 'tags-input';
  const panelId = kind === 'description' ? 'ai-panel-description' : 'ai-panel-tags';
  const panel = $(panelId);
  const prompt = buildAiPrompt(kind);

  panel.innerHTML = `
    <div class="ai-panel-head">
      <span>✨ AI suggestion · ${kind}</span>
      <button type="button" class="ai-panel-close" data-close="${panelId}" aria-label="Close">×</button>
    </div>
    <pre class="ai-panel-prompt">${escapeHtml(prompt)}</pre>
    <div class="ai-panel-actions">
      <button type="button" class="ai-panel-btn" data-copy-prompt="${panelId}">Copy prompt</button>
      <button type="button" class="ai-panel-btn" data-open-claude="${panelId}">Open Claude →</button>
    </div>
    <textarea class="ai-panel-paste" placeholder="Paste Claude's response here…"></textarea>
    <div class="ai-panel-actions">
      <button type="button" class="ai-panel-btn primary" data-use-suggestion="${targetId}|${panelId}">Use this as ${kind === 'description' ? 'Description' : 'Tags'}</button>
    </div>
    <p class="ai-panel-tip">Tip: a real one-click AI integration is planned — see <code>docs/ai-integration-design.md</code>.</p>
  `;
  panel.hidden = false;
  panel.dataset.prompt = prompt;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      setStatus(`Loaded "${media.title?.romaji || title}" — review and edit fields below, then ${state.serverMode === 'local' ? 'Submit & Ship' : 'Generate'}.`);
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
    if (state.serverMode === 'local') submitAndShip();
    else showOutput();
  });

  $('confirm-deploy-btn')?.addEventListener('click', () => {
    $('deploy-confirm-row').hidden = true;
    streamSse('/api/deploy', {});
  });
  $('cancel-deploy-btn')?.addEventListener('click', () => {
    $('deploy-confirm-row').hidden = true;
    setProgressHeader('Deploy cancelled', 'failed');
  });

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
      alert('Copy failed: ' + err.message);
    }
  });

  $('reset-btn').addEventListener('click', () => {
    for (const id of ['title-input', 'genre-input', 'seasons-input', 'description-input',
                      'studio-input', 'trailer-input', 'watch-official-input', 'watch-unofficial-input', 'tags-input',
                      'rating-input', 'top10-input', 'review-input', 'image-filename-input']) {
      $(id).value = '';
    }
    state.anilist = null;
    state.imageSource = 'anilist';
    state.imageOverride = '';
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

  // AI suggest buttons
  $('suggest-description-btn')?.addEventListener('click', () => openAiPanel('description'));
  $('suggest-tags-btn')?.addEventListener('click', () => openAiPanel('tags'));
}

// Delegated AI panel handlers
document.addEventListener('click', async (e) => {
  if (e.target.matches('.ai-panel-close')) {
    const panel = $(e.target.dataset.close);
    if (panel) { panel.hidden = true; panel.innerHTML = ''; }
    return;
  }
  if (e.target.matches('[data-copy-prompt]')) {
    const panel = $(e.target.dataset.copyPrompt);
    if (panel?.dataset.prompt) {
      try {
        await navigator.clipboard.writeText(panel.dataset.prompt);
        const orig = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => { e.target.textContent = orig; }, 1200);
      } catch { alert('Copy failed.'); }
    }
    return;
  }
  if (e.target.matches('[data-open-claude]')) {
    const panel = $(e.target.dataset.openClaude);
    if (panel?.dataset.prompt) {
      window.open('https://claude.ai/new?q=' + encodeURIComponent(panel.dataset.prompt), '_blank', 'noopener');
    }
    return;
  }
  if (e.target.matches('[data-use-suggestion]')) {
    const [targetId, panelId] = e.target.dataset.useSuggestion.split('|');
    const panel = $(panelId);
    const paste = panel?.querySelector('.ai-panel-paste');
    const value = paste?.value.trim();
    if (!value) { alert("Paste Claude's response into the box first."); return; }
    const target = $(targetId);
    if (target) target.value = value;
    panel.hidden = true;
    panel.innerHTML = '';
    target.focus();
    return;
  }
});

// ---- UID gate + init -----------------------------------------------------
async function init() {
  state.serverMode = await detectServerMode();

  onAuthStateChanged(auth, (user) => {
    if (!user || user.uid !== ADMIN_UID) {
      window.location.replace('../index.html');
      return;
    }
    $('admin-gate').style.display = 'none';
    $('admin-main').hidden = false;
    wire();

    if (state.serverMode === 'local') {
      $('generate-btn').textContent = 'Submit & Ship';
      $('server-mode-label').textContent = 'Mode 1 server · 一発';
      $('server-mode-label').className = 'admin-section-aside local';
    } else {
      $('generate-btn').textContent = 'Generate Excel Row';
      $('server-mode-label').textContent = 'Paste workflow · ペースト';
      $('server-mode-label').className = 'admin-section-aside remote';
    }

    $('title-input').focus();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
