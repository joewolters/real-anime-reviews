// script.js (ES module)

// ---- Firebase imports ----
import {
  doc, setDoc, serverTimestamp, runTransaction,
  collection, addDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc,
  where, limit, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

import { auth, db } from './firebase.js';

// Wrap in IIFE to avoid leaking globals
(() => {
  // ---------- DOM HOOKS ----------
  const homeView = document.getElementById("home-view");
  const allView = document.getElementById("all-anime-view");

// don’t crash the whole site if HTML ids/classes changed
const cardContainer =
  (allView && allView.querySelector(".card-container")) ||
  document.querySelector(".card-container");

if (!homeView || !allView || !cardContainer) {
  console.error(
    "❌ Missing required containers. Expected: #home-view, #all-anime-view, and .card-container (inside all-anime-view)."
  );
}
// Show current version in the Update Log
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("changelog-version");
  if (el && window.APP_VERSION) el.textContent = `v${window.APP_VERSION}`;
});


  const spotlightRoot = document.getElementById("spotlight-carousel");
  const top10Prev = document.getElementById("top10-prev");
  const top10Next = document.getElementById("top10-next");
  const top10Counter = document.getElementById("top10-counter");
  const recommendedRow = document.getElementById("recommended-row");
  const genreShuffleBtn = document.getElementById("genreShuffleBtn");
  const featuredDrop = document.getElementById("featured-drop");
  const featuredDropCard = document.getElementById("featured-drop-card");


  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("anime-modal");
  const modalContent = modal.querySelector(".modal-content");

  const homeBtn = document.getElementById("home-button");
  const viewAllBtn = document.getElementById("view-all-btn");
  const randomBtn = document.getElementById("random-btn");

  const headerEl = document.querySelector('header');


  // ===== Auth UI hooks =====
  const authOpenBtn   = document.getElementById('auth-open');
  const signOutBtn    = document.getElementById('signout-btn');
  // ===== Notifications (header) =====
  const notifBtn  = document.getElementById('notif-btn');
  const notifDot  = document.getElementById('notif-dot');
  const notifMenu = document.getElementById('notif-menu');

  const authOverlay   = document.getElementById('auth-overlay');
  const authModal     = document.getElementById('auth-modal');
  const authTitleEl   = document.getElementById('auth-title');
  const authForm      = document.getElementById('auth-form');
  const rowUsername   = document.getElementById('row-username');
  const userInput     = document.getElementById('auth-username');
  const emailInput    = document.getElementById('auth-email');
  const passInput     = document.getElementById('auth-password');
  const switchRow     = document.getElementById('auth-switch');
  const resetLink     = document.getElementById('reset-link');
  const authError     = document.getElementById('auth-error');

    // Profile modal hooks
  const profileOverlay = document.getElementById('profile-overlay');
  const profileModal   = document.getElementById('profile-modal');
  const profileForm    = document.getElementById('profile-form');
  const profEmail      = document.getElementById('prof-email');
  const profName       = document.getElementById('prof-name');
  const profPhoto      = document.getElementById('prof-photo');
  const profAvatarPrev = document.getElementById('prof-avatar-preview');
  const profErr        = document.getElementById('profile-error');
  const profOK         = document.getElementById('profile-success');
  const profSaveBtn    = document.getElementById('profile-save');
  const emailVerifyMsg = document.getElementById('email-verify-msg');


  // === keep page scroll locked if ANY modal is open
function updateScrollLock() {
  const anyOpen =
    (modal && modal.classList.contains('active')) ||
    (authModal && authModal.classList.contains('active')) ||
    (profileModal && profileModal.classList.contains('active')) ||
    !!document.querySelector('.confirm-overlay.active');

  // Lock both body + html (Firefox can scroll html even if body is locked)
  document.body.classList.toggle('modal-open', anyOpen);
  document.documentElement.classList.toggle('modal-open', anyOpen);

  // Extra explicit lock for the root scroller
  document.documentElement.style.overflow = anyOpen ? 'hidden' : '';
}



  // Search
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("site-search");
  const clearSearchBtn = document.getElementById("clear-search");

  // Filter
  const filterBtn = document.getElementById("filter-btn");
  const filterPanel = document.getElementById("filter-panel");
  const filterForm = document.getElementById("filter-form");
  const genreListEl = document.getElementById("genre-list");
  const tagListEl = document.getElementById("tag-list");
  const studioListEl = document.getElementById("studio-list");
  const filterClearBtn = document.getElementById("filter-clear");
  const filterApplyBtn = document.getElementById("filter-apply");
  const summaryEl = document.getElementById("filter-summary");
  

  // ---------- STATE ----------
  let authMode = 'signin'; // 'signin' | 'signup'
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HAS_HOVER = window.matchMedia("(hover: hover)").matches;
  const SHOULD_CYCLE = !REDUCED_MOTION;
  const CYCLE_MS = 6000;
  const MANUAL_SPOTLIGHT_MS = 360;
  let spotlightIndex = 0;
  let top10Count = 0;
  let spotlightTimer = null;
  let spotlightManualTimer = null;
  let isSpotlightHovered = false;
  let lastSpotlightChangeAt = 0;
  let railsControllers = [];
  let genreRotationTimerIds = [];
  let lastGenres = [];
  let genreShuffleLocked = false;
  let genreShuffleUnlockTimer = null;
  let inSearchMode = false;
  let lastRandomIdx = -1;
  let activeCommentsUnsub = null; 
  let activeReviewsUnsub = null; 
  let activeOfficialUnsub = null; // unsubscribe official (Blake) review votes

 // === Saved state (Firestore): favorites + watchlist ===
let unsubFavorites = null;
let unsubWatchlist = null;

const favoritesSet = new Set();
const watchlistSet = new Set();
let favoritesInit = false;
let watchlistInit = false;
let savesLoadErrorShown = false;


function cssEscape(str) {
  if (window.CSS && CSS.escape) return CSS.escape(str);
  return String(str).replace(/["\\]/g, "\\$&");
}

function jiggle(el) {
  if (!el) return;
  el.classList.remove("jiggle");
  void el.offsetWidth; // restart animation
  el.classList.add("jiggle");
  setTimeout(() => el.classList.remove("jiggle"), 380);
}

function secureRandomInt(max) {
  const n = Number(max);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const range = Math.floor(n);

  // Prefer crypto for "real" randomness
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);

    // Rejection sampling to avoid modulo bias
    const maxUint32 = 0xFFFFFFFF;
    const limit = Math.floor((maxUint32 + 1) / range) * range;

    let x;
    do {
      window.crypto.getRandomValues(arr);
      x = arr[0];
    } while (x >= limit);

    return x % range;
  }

  // Fallback
  return Math.floor(Math.random() * range);
}


function applySavedStateToCard(card, animeId) {
  const favBtn = card.querySelector(".fav-btn");
  const watchBtn = card.querySelector(".watch-btn");

  const isFav = favoritesSet.has(animeId);
  const isWatch = watchlistSet.has(animeId);

  if (favBtn) {
    favBtn.classList.toggle("is-on", isFav);
    favBtn.setAttribute("aria-pressed", String(isFav));
  }
  if (watchBtn) {
    watchBtn.classList.toggle("is-on", isWatch);
    watchBtn.setAttribute("aria-pressed", String(isWatch));
  }

  card.classList.toggle("has-saved", isFav || isWatch);
}

function syncAllSavedUI() {
  document.querySelectorAll(".card[data-animeid]").forEach((card) => {
    applySavedStateToCard(card, card.dataset.animeid);
  });
}

function syncSavedUIForAnime(animeId) {
  const esc = cssEscape(animeId);
  document.querySelectorAll(`.card[data-animeid="${esc}"]`).forEach((card) => {
    applySavedStateToCard(card, animeId);
  });
}

function clearSaveSubscriptions() {
  if (unsubFavorites) { try { unsubFavorites(); } catch (_) {} unsubFavorites = null; }
  if (unsubWatchlist) { try { unsubWatchlist(); } catch (_) {} unsubWatchlist = null; }
}

function subscribeSavesForUser(user) {
  clearSaveSubscriptions();
  favoritesSet.clear();
  watchlistSet.clear();

  if (!user) {
    syncAllSavedUI();
    return;
  }

  const favQ = query(collection(db, "users", user.uid, "favorites"), orderBy("updatedAt", "desc"));
  const watchQ = query(collection(db, "users", user.uid, "watchlist"), orderBy("updatedAt", "desc"));

  unsubFavorites = onSnapshot(favQ, (snap) => {
    favoritesSet.clear();
    snap.forEach((d) => favoritesSet.add(d.id));
    syncAllSavedUI();
  });

  unsubWatchlist = onSnapshot(watchQ, (snap) => {
    watchlistSet.clear();
    snap.forEach((d) => watchlistSet.add(d.id));
    syncAllSavedUI();
  });
}

async function setSave(kind, uid, animeId, title, turnOn) {
  const ref = doc(db, "users", uid, kind, animeId);
  if (turnOn) {
    await setDoc(ref, { animeId, title, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await deleteDoc(ref);
  }
}



  // ---------- UTIL ----------
  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  // v1.6.8 — Look up a related-anime node from AniList against the local catalog.
  // Returns the matching animeData entry, or null if not in catalog.
  // Detection order:
  //   1. AniListId exact match (future-proof — v1.7.0 backfill populates this for existing entries)
  //   2. slug-match against node.title.english
  //   3. slug-match against node.title.romaji
  // Today (pre-backfill): slug-match is the primary path.
  function findInCatalog(node) {
    if (!node) return null;
    const wantId = node.id;
    const wantSlugs = [
      node.title?.english && slug(node.title.english),
      node.title?.romaji && slug(node.title.romaji),
    ].filter(Boolean);
    for (const a of animeData) {
      if (a.AniListId && a.AniListId === wantId) return a;
      if (a.Title && wantSlugs.includes(slug(a.Title))) return a;
    }
    return null;
  }

  const safeArray = (v) => (Array.isArray(v) ? v : []);
  const norm = (v) => (v || "").toString().toLowerCase();

  // ============================================================================
  // v1.6.8 — More Info panel: AniList relations fetch + cache + renderer
  // ============================================================================
  // Public-modal counterpart to admin/new-anime.js's aggregateFranchise().
  // Lazily fetches relations on tab click (gate 5 wires this), caches per
  // session, renders four states (loading / success / empty / error→empty).
  // No DOM injection here — gate 5 wires the tab markup and click handlers.
  // ============================================================================

  // Mirrors admin/new-anime.js:18 — duplicated literal because script.js is a
  // non-module script and admin/new-anime.js is an ES module. Worth extracting
  // to a shared module in a future refactor.
  const ANILIST_ENDPOINT_PUBLIC = 'https://graphql.anilist.co';

  // v1.6.8 gate 5b — split into two queries to mirror the admin form's
  // by-search and by-id pattern. AniList's `Media(search, id)` field doesn't
  // ignore a null-valued constraint — passing one null in a combined query
  // returns HTTP 404 + Media: null. Two queries, each with a single var,
  // avoids the trap.
  // v1.6.8 gate 5c — by-search now uses Page(media:, sort:[POPULARITY_DESC,
  // SCORE_DESC]) + perPage:1, mirroring admin/new-anime.js. Plain Media(search:)
  // returns the first text-match (no relevance ranking), so an ambiguous short
  // title like "Demon slayer" matched "Onigiri" (id 21612, zero relations)
  // instead of Kimetsu no Yaiba. Popularity-sort fixes that. by-id stays a
  // direct Media(id:) lookup — IDs are unambiguous.
  const MORE_INFO_QUERY_BY_SEARCH = `
query ($search: String) {
  Page(page: 1, perPage: 1) {
    media(search: $search, type: ANIME, sort: [POPULARITY_DESC, SCORE_DESC]) {
      id
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
      streamingEpisodes {
        title
      }
      recommendations(perPage: 5, sort: [RATING_DESC]) {
        nodes {
          rating
          mediaRecommendation {
            id
            title { romaji english }
            coverImage { large }
            format
          }
        }
      }
      staff(perPage: 25, sort: [RELEVANCE]) {
        edges {
          role
          node {
            id
            name { full }
          }
        }
      }
    }
  }
}`;

  const MORE_INFO_QUERY_BY_ID = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
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
    streamingEpisodes {
      title
    }
    recommendations(perPage: 5, sort: [RATING_DESC]) {
      nodes {
        rating
        mediaRecommendation {
          id
          title { romaji english }
          coverImage { large }
          format
        }
      }
    }
    staff(perPage: 25, sort: [RELEVANCE]) {
      edges {
        role
        node {
          id
          name { full }
        }
      }
    }
  }
}`;

  // v1.6.8 — Build a relations-edge-shaped node from a local animeData entry.
  // Many AniList fields are unavailable from local catalog data (romaji, year,
  // episodes, format); renderer omits these gracefully. v1.7.0 backfill will
  // populate AniListId enabling a future upgrade that pulls the source's own
  // canon from AniList to fill the gaps.
  function buildMainNode(anime, sourceId) {
    const studioNames = (anime.Studio || '').split(',').map(s => s.trim()).filter(Boolean);
    return {
      id: anime.AniListId || sourceId || null,
      title: { english: anime.Title || '', romaji: null },
      format: null,
      episodes: null,
      seasonYear: null,
      type: 'ANIME',
      studios: { nodes: studioNames.map(name => ({ name, isAnimationStudio: true })) },
      averageScore: anime.AniListScore || null,
      coverImage: { large: 'assets/' + (anime.image || 'placeholder.png') },
    };
  }

  // v1.6.8 — Fetch relations from AniList. Uses AniListId when populated
  // (exact Media(id:) lookup), falls back to popularity-sorted Page(media:)
  // search (the common path today — 0/44 entries have AniListId pre-v1.7.0).
  // v1.6.9 — return shape extended to { sourceId, edges, streamingEpisodes,
  // recommendations, staff }: streamingEpisodes raw (renderer sorts/parses by
  // the "Episode N -" prefix); recommendations = the recommendation nodes'
  // mediaRecommendation, nulls dropped, filtered to anime formats (gate-1
  // anime-format filter); staff raw (renderer applies the role whitelist).
  // All five default to null/[] on any failure (HTTP non-200, GraphQL errors,
  // no Media match, network throw) — no throw, the public modal degrades
  // gracefully.
  async function fetchRelationsFromAniList(anime) {
    const useId = !!anime.AniListId;
    const query = useId ? MORE_INFO_QUERY_BY_ID : MORE_INFO_QUERY_BY_SEARCH;
    const variables = useId ? { id: anime.AniListId } : { search: anime.Title || '' };
    try {
      const res = await fetch(ANILIST_ENDPOINT_PUBLIC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) return { sourceId: null, edges: [], streamingEpisodes: [], recommendations: [], staff: [] };
      const body = await res.json();
      if (body.errors?.length) return { sourceId: null, edges: [], streamingEpisodes: [], recommendations: [], staff: [] };
      const media = useId ? body.data?.Media : body.data?.Page?.media?.[0];
      if (!media) return { sourceId: null, edges: [], streamingEpisodes: [], recommendations: [], staff: [] };
      return {
        sourceId: media.id || null,
        edges: media.relations?.edges || [],
        streamingEpisodes: media.streamingEpisodes || [],
        recommendations: (media.recommendations?.nodes || [])
          .map(n => n.mediaRecommendation)
          .filter(Boolean)
          .filter(m => ['TV', 'TV_SHORT', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'].includes(m.format)),
        staff: media.staff?.edges || [],
      };
    } catch (_) {
      return { sourceId: null, edges: [], streamingEpisodes: [], recommendations: [], staff: [] };
    }
  }

  // v1.6.8 — In-memory cache keyed by AniListId (when populated) or title slug.
  // Cleared on page reload. Empty results are cached so failed fetches don't
  // hammer AniList on every re-open of the same modal in the same session.
  // v1.6.9 — caches/returns the extended { sourceId, edges, streamingEpisodes,
  // recommendations, staff } shape verbatim; cache passthrough unchanged.
  const moreInfoCache = new Map();

  async function fetchRelationsForModal(anime) {
    const cacheKey = anime.AniListId || (anime.Title && slug(anime.Title));
    if (!cacheKey) return { sourceId: null, edges: [], streamingEpisodes: [], recommendations: [], staff: [] };
    if (moreInfoCache.has(cacheKey)) return moreInfoCache.get(cacheKey);
    const result = await fetchRelationsFromAniList(anime);
    moreInfoCache.set(cacheKey, result);
    return result;
  }

  // v1.6.8 — Pure renderer: returns an HTML string, never touches the DOM.
  // States: 'loading' / 'success' / 'empty' / 'error' (error routes to 'empty'
  // for v1.6.8 — single friendly fallback message). Success-state logic mirrors
  // admin/new-anime.js's aggregateFranchise():
  //   - keep only ANIME-type nodes with relationType ∈ PREQUEL/PARENT/SEQUEL
  //   - inject source as synthetic MAIN via buildMainNode(), dedupe by node.id
  //   - sort by seasonYear ascending, TYPE_ORDER tiebreaker (same formula:
  //     missing year → 0, so MAIN with null year sorts to top — acceptable
  //     until v1.7.0 backfill enables source-canon fetch)
  function renderMoreInfoPanel(state, sourceAnime, result) {
    if (state === 'loading') {
      return '<div class="more-info-loading">Loading…</div>';
    }
    if (state === 'empty' || state === 'error') {
      return '<div class="more-info-empty">No franchise info available yet.</div>';
    }

    const sourceId = result?.sourceId || null;
    const edges = result?.edges || [];
    const streamingEpisodes = result?.streamingEpisodes || [];
    const recommendations = result?.recommendations || [];
    const staffEdges = result?.staff || [];

    const MAIN_RELATIONS = ['PREQUEL', 'PARENT', 'SEQUEL'];
    const TYPE_ORDER = { PREQUEL: 0, PARENT: 1, MAIN: 2, SEQUEL: 3 };

    const main = buildMainNode(sourceAnime, sourceId);
    const seenIds = new Set();
    if (main.id) seenIds.add(main.id);

    const entries = [{ ...main, relationType: 'MAIN' }];
    for (const edge of edges) {
      if (!MAIN_RELATIONS.includes(edge.relationType)) continue;
      if (edge.node?.type !== 'ANIME') continue;
      if (edge.node?.id && seenIds.has(edge.node.id)) continue;
      if (edge.node?.id) seenIds.add(edge.node.id);
      entries.push({ ...edge.node, relationType: edge.relationType });
    }

    if (entries.length <= 1 && !main.id) {
      return '<div class="more-info-empty">No franchise info available yet.</div>';
    }

    entries.sort((a, b) => {
      const yearDelta = (a.seasonYear || 0) - (b.seasonYear || 0);
      if (yearDelta !== 0) return yearDelta;
      return (TYPE_ORDER[a.relationType] ?? 99) - (TYPE_ORDER[b.relationType] ?? 99);
    });

    const rows = entries.map(node => renderMoreInfoEntry(node)).join('');
    return `<div class="more-info-list">${rows}</div>`
      + renderEpisodeList(streamingEpisodes, sourceAnime)
      + renderRecommendations(recommendations)
      + renderStaffCredits(staffEdges);
  }

  // v1.6.8 — Render one entry row. Every entry with an AniList id is clickable
  // (gate 5c — opens anilist.co/anime/{id} in a new tab for the season's full
  // info, including MAIN which is just season 1). MAIN keeps the --current
  // highlight but is also clickable. Click listeners attached by openModal's
  // delegation handler.
  function renderMoreInfoEntry(node) {
    const cover = node.coverImage?.large || '';
    const english = node.title?.english || node.title?.romaji || '(untitled)';
    const romaji = (node.title?.romaji && node.title.romaji !== english) ? node.title.romaji : '';
    const year = node.seasonYear || '';
    const eps = node.episodes ? `${node.episodes} eps` : '';
    const studios = Array.from(new Set(
      (node.studios?.nodes || [])
        .filter(s => s.isAnimationStudio !== false)
        .map(s => s.name)
        .filter(Boolean)
    )).join(', ');
    const metaParts = [year, eps, studios].filter(Boolean);

    let entryClass = 'more-info-entry';
    let clickAttrs = '';
    if (node.relationType === 'MAIN') {
      entryClass += ' more-info-entry--current';
    }
    if (node.id) {
      entryClass += ' more-info-entry--clickable';
      clickAttrs = ` data-anilist-id="${escapeHtml(String(node.id))}"`;
    }

    const coverHtml = cover
      ? `<img class="more-info-cover" src="${escapeHtml(cover)}" alt="" loading="lazy">`
      : '<div class="more-info-cover more-info-cover--placeholder"></div>';
    const scoreHtml = node.averageScore
      ? `<span class="more-info-score-badge">${escapeHtml(String(node.averageScore))}</span>`
      : '';
    const romajiHtml = romaji ? `<div class="more-info-romaji">${escapeHtml(romaji)}</div>` : '';
    // v1.6.10 — format pill at the start of the meta line. Reuses
    // .more-info-rec-format-badge for visual parity with recommendation cards;
    // inline position:static override prevents it from absolute-positioning to
    // the corner where .more-info-score-badge already sits.
    const fmtBadgeHtml = node.format
      ? `<span class="more-info-rec-format-badge" style="position: static;">${escapeHtml(node.format)}</span>`
      : '';
    const metaTextHtml = metaParts.length ? escapeHtml(metaParts.join(' · ')) : '';
    const metaInner = fmtBadgeHtml && metaTextHtml
      ? `${fmtBadgeHtml} ${metaTextHtml}`
      : (fmtBadgeHtml || metaTextHtml);
    const metaHtml = metaInner
      ? `<div class="more-info-meta">${metaInner}</div>`
      : '';

    return `<div class="${entryClass}"${clickAttrs}>
    ${coverHtml}
    <div class="more-info-body">
      <span class="more-info-relation">${escapeHtml(node.relationType)}</span>
      <div class="more-info-english">${escapeHtml(english)}</div>
      ${romajiHtml}
      ${metaHtml}
    </div>
    ${scoreHtml}
  </div>`;
  }

  // v1.6.9 — Render the source anime's per-episode list (AniList streamingEpisodes,
  // title-only — no thumbnails/links per gate-1). Sorted by the episode number
  // parsed from each "Episode N -" title prefix; titles without that prefix (OAD,
  // specials) sort to the end in AniList's order. Collapsed behind <details> when
  // > 8 episodes. Returns '' when AniList has no episode data (coverage isn't 100%).
  function renderEpisodeList(streamingEpisodes, sourceAnime) {
    if (!streamingEpisodes || streamingEpisodes.length === 0) return '';
    const sorted = streamingEpisodes
      .map((e, i) => {
        const title = (e && e.title) || '';
        const m = title.match(/^Episode\s+(\d+)\s*[-–—]/i);
        return { title, epNum: m ? parseInt(m[1], 10) : null, origIndex: i };
      })
      .sort((a, b) => {
        if (a.epNum === null && b.epNum === null) return a.origIndex - b.origIndex;
        if (a.epNum === null) return 1;
        if (b.epNum === null) return -1;
        return a.epNum - b.epNum;
      });
    const rowHtml = sorted
      .map(r => `<div class="more-info-episode-row">${escapeHtml(r.title || '(untitled episode)')}</div>`)
      .join('');
    const header = `<div class="more-info-section-header">EPISODES — ${escapeHtml((sourceAnime && sourceAnime.Title) || '')}</div>`;
    const body = streamingEpisodes.length > 8
      ? `<details class="more-info-episodes-details"><summary>Show all ${streamingEpisodes.length} episodes</summary>${rowHtml}</details>`
      : rowHtml;
    return `<div class="more-info-episodes">${header}${body}</div>`;
  }

  // v1.6.9 — Render the "ALSO LIKED" recommendations cluster. Cards reuse v1.6.8's
  // .more-info-entry--clickable + data-anilist-id pattern so the existing modal
  // click-delegation opens anilist.co/anime/{id} in a new tab. Already filtered to
  // anime formats (nulls dropped) by fetchRelationsFromAniList. Returns '' when empty.
  function renderRecommendations(recs) {
    if (!recs || recs.length === 0) return '';
    const cards = recs.map(m => {
      const id = m && m.id;
      const english = (m && m.title && (m.title.english || m.title.romaji)) || '(untitled)';
      const cover = (m && m.coverImage && m.coverImage.large) || '';
      const fmt = (m && m.format) || '';
      const coverHtml = cover
        ? `<img class="more-info-cover" src="${escapeHtml(cover)}" alt="" loading="lazy">`
        : '<div class="more-info-cover more-info-cover--placeholder"></div>';
      const fmtHtml = fmt ? `<span class="more-info-rec-format-badge">${escapeHtml(fmt)}</span>` : '';
      const clickAttrs = id ? ` data-anilist-id="${escapeHtml(String(id))}"` : '';
      const entryClass = id ? 'more-info-entry more-info-entry--clickable' : 'more-info-entry';
      return `<div class="${entryClass}"${clickAttrs}>
    ${coverHtml}
    <div class="more-info-body">
      <div class="more-info-english">${escapeHtml(english)}</div>
    </div>
    ${fmtHtml}
  </div>`;
    }).join('');
    return `<div class="more-info-recommendations"><div class="more-info-section-header">ALSO LIKED</div><div class="more-info-list">${cards}</div></div>`;
  }

  // v1.6.9 — Render the STAFF cluster: 4-6 key roles, names non-clickable (per
  // gate-1 — per-staff page deferred). Filters AniList's staff edges to a role
  // whitelist (first edge per role); falls back to the top ~4 non-Original-Creator/
  // Assistance roles by RELEVANCE when no whitelist role is present. Returns '' when
  // nothing usable.
  function renderStaffCredits(staffEdges) {
    if (!staffEdges || staffEdges.length === 0) return '';
    const WHITELIST = ['Director', 'Series Composition', 'Music', 'Character Design'];
    const picked = [];
    for (const role of WHITELIST) {
      const edge = staffEdges.find(e => e && e.role === role && e.node && e.node.name && e.node.name.full);
      if (edge) picked.push({ role, name: edge.node.name.full });
    }
    if (picked.length === 0) {
      const EXCLUDE = new Set(['Original Creator', 'Assistance']);
      for (const e of staffEdges) {
        if (picked.length >= 6) break;
        if (!e || !e.role || EXCLUDE.has(e.role)) continue;
        if (!e.node || !e.node.name || !e.node.name.full) continue;
        picked.push({ role: e.role, name: e.node.name.full });
      }
    }
    if (picked.length === 0) return '';
    const rowHtml = picked
      .map(p => `<div class="more-info-staff-row">${escapeHtml(p.role)} — ${escapeHtml(p.name)}</div>`)
      .join('');
    return `<div class="more-info-staff"><div class="more-info-section-header">STAFF</div>${rowHtml}</div>`;
  }

  function toYouTubeEmbedSrc(trailerStr) {
    if (!trailerStr) return null;
    if (trailerStr.includes("/embed/")) return trailerStr.trim();
    try {
      const url = new URL(trailerStr);
      if (url.hostname.includes("youtu.be")) {
        return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
      }
      if (url.hostname.includes("youtube.com")) {
        const v = url.searchParams.get("v");
        if (v) return `https://www.youtube.com/embed/${v}`;
      }
    } catch (_) {}
    return trailerStr.trim();
  }
  function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function nl2br(s) { return String(s ?? "").replace(/\n/g, "<br>"); }
function toMillis(ts) { return ts?.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : Date.now()); }
function stripAccidentalPaste(s) {
  const text = String(s ?? "");

  // If someone accidentally saved a chunk of dev instructions/code into the review,
  // cut the body off at the first marker.
  const markers = [
    "// restore open state",
    "captureOpenState(",
    "openIds.has(",
    "detail.removeAttribute(",
    "toggle.setAttribute("
  ];

  let cutAt = -1;
  for (const m of markers) {
    const idx = text.indexOf(m);
    if (idx !== -1) cutAt = (cutAt === -1) ? idx : Math.min(cutAt, idx);
  }

  return (cutAt === -1 ? text : text.slice(0, cutAt)).trimEnd();
}


  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function splitGenres(s) {
    if (!s) return [];
    if (Array.isArray(s)) return s.flatMap(splitGenres);
    return String(s)
      .split(/[\/,|·•]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  function getGenres(a) {
    const src = a?.Genre ?? a?.Genres ?? a?.genre ?? a?.genres ?? null;
    return splitGenres(src);
  }
  function splitStudios(s) {
    if (!s) return [];
    return String(s).split(/[,/&]| and /i).map((x) => x.trim()).filter(Boolean);
  }

  // ---------- AUTH MODAL ----------
  function openAuth(mode = 'signin') {
    authMode = mode;
    authTitleEl.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    rowUsername.style.display = mode === 'signup' ? '' : 'none';
    authError.textContent = '';
    emailInput.value = '';
    passInput.value = '';
    userInput.value = '';
    authOverlay.classList.add('active');
    authModal.classList.add('active');
    updateScrollLock();
  }

  function closeAuth() {
    authOverlay.classList.remove('active');
    authModal.classList.remove('active');
    updateScrollLock();
  }

  function prettyAuthError(err, context = 'signin') {
  const code = (err && err.code) ? err.code : '';

  // Sign-in: hide Firebase jargon
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Incorrect email or password.';
  }

  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  if (code === 'auth/email-already-in-use') return 'That email is already in use. Try signing in instead.';
  if (code === 'auth/weak-password') return 'Password is too weak. Use at least 6 characters.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again in a bit.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';

  // Password reset special case (optional nicer wording)
  if (context === 'reset' && code === 'auth/user-not-found') {
    return 'No account found for that email.';
  }

  // Fallback
  return 'Something went wrong. Please try again.';
}

  // Confirm modal (replaces native window.confirm)
let _confirmState = {
  overlay: null,
  modal: null,
  titleEl: null,
  messageEl: null,
  okBtn: null,
  cancelBtn: null,
  resolve: null
};

function _ensureConfirmModal() {
  if (_confirmState.overlay) return;

  const overlay = document.createElement('div');
  overlay.id = 'confirm-overlay';
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-modal" role="dialog" aria-modal="true"
         aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div class="confirm-head">
        <div class="confirm-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 9v5m0 4h.01M10.29 3.86l-7.5 13A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.73-3l-7.5-13a2 2 0 0 0-3.46 0Z"/>
          </svg>
        </div>
        <div>
          <p class="confirm-title" id="confirm-title">Confirm</p>
          <p class="confirm-message" id="confirm-message">Are you sure?</p>
        </div>
      </div>
      <div class="confirm-actions">
        <button class="confirm-btn" type="button" id="confirm-cancel">Cancel</button>
        <button class="confirm-btn primary danger" type="button" id="confirm-ok">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  _confirmState.overlay = overlay;
  _confirmState.modal = overlay.querySelector('.confirm-modal');
  _confirmState.titleEl = overlay.querySelector('#confirm-title');
  _confirmState.messageEl = overlay.querySelector('#confirm-message');
  _confirmState.okBtn = overlay.querySelector('#confirm-ok');
  _confirmState.cancelBtn = overlay.querySelector('#confirm-cancel');

  const close = (result) => {
    overlay.classList.remove('active');
    updateScrollLock();
    const r = _confirmState.resolve;
    _confirmState.resolve = null;
    if (r) r(result);
  };

  _confirmState.okBtn.addEventListener('click', () => close(true));
  _confirmState.cancelBtn.addEventListener('click', () => close(false));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) close(false);
  });
}

function confirmDialog({
  title = 'Confirm',
  message = 'Are you sure?',
  okText = 'OK',
  cancelText = 'Cancel',
  danger = false
} = {}) {
  _ensureConfirmModal();

  _confirmState.titleEl.textContent = title;
  _confirmState.messageEl.textContent = message;
  _confirmState.okBtn.textContent = okText;
  _confirmState.cancelBtn.textContent = cancelText;

  _confirmState.okBtn.classList.toggle('danger', !!danger);

  _confirmState.overlay.classList.add('active');
  updateScrollLock();

  setTimeout(() => _confirmState.okBtn.focus(), 0);

  return new Promise((resolve) => {
    _confirmState.resolve = resolve;
  });
}

  authOverlay.addEventListener('click', closeAuth);
  const authCloseBtn = authModal.querySelector('.close-button');
  authCloseBtn?.addEventListener('click', (e) => { e.preventDefault(); closeAuth(); });

    authOpenBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!auth.currentUser) {
    openAuth('signin');               // same modal you already have
  } else {
    window.location.href = 'account.html';
  }
});
// ===== Notifications dropdown (functional) =====
let notifOpen = false;

let unsubNotifs = null;
let lastNotifs  = [];

// Keep notifications small so the dropdown + Firestore don't grow forever
const NOTIF_KEEP  = 10;   // show/keep newest 10
const NOTIF_FETCH = 50;   // fetch extra so we can delete the old ones
let notifCleanupInFlight = false;

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


function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function timeAgoMs(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

function renderNotifShell() {
  if (!notifMenu) return;
  notifMenu.innerHTML = `
    <div class="notif-head">
      <div class="notif-title">Notifications</div>
      <div class="notif-sub">No notifications yet.</div>
    </div>
    <div class="notif-divider"></div>
    <div class="notif-list">
      <div class="notif-empty">
        <div class="notif-line">No notifications yet.</div>
      </div>
    </div>
  `;
}

function updateNotifDot(notifs) {
  if (!notifDot) return;
  const hasUnread = (notifs || []).some(n => n.read !== true);
  notifDot.hidden = !hasUnread;
}

function renderNotifications(notifs) {
  if (!notifMenu) return;

  const unreadCount = (notifs || []).filter(n => n.read !== true).length;
  const subline = unreadCount ? `${unreadCount} unread` : `All caught up`;

  const rows = (notifs || []).map((n) => {
    const name = n.fromDisplayName || 'Someone';
    const verb = (n.value === -1) ? 'disliked' : 'liked';
    const what = (n.type === 'review_vote') ? 'your review' : 'your comment';
    const title = n.animeTitle || n.animeId || 'an anime';

    const ms = n.createdAt?.toMillis ? n.createdAt.toMillis()
      : (typeof n.createdAt === 'number' ? n.createdAt : Date.now());

    const avatar = n.fromPhotoURL
      ? `<img src="${esc(n.fromPhotoURL)}" alt="">`
      : `<span>${esc(String(name).trim().slice(0,1).toUpperCase() || '?')}</span>`;

    return `
      <div class="notif-row" data-id="${esc(n.id)}" data-animeid="${esc(n.animeId)}">
        <div class="notif-avatar">${avatar}</div>
        <div class="notif-text">
          <div class="notif-line">${esc(name)} ${esc(verb)} ${esc(what)}</div>
          <div class="notif-meta">${esc(title)} · ${esc(timeAgoMs(ms))}</div>
        </div>
      </div>
    `;
  }).join('');

  const empty = `
    <div class="notif-empty">
      <div class="notif-line">No notifications yet.</div>
    </div>
  `;

  notifMenu.innerHTML = `
    <div class="notif-head">
      <div class="notif-title">Notifications</div>
      <div class="notif-sub">${esc(subline)}</div>
    </div>
    <div class="notif-divider"></div>
    <div class="notif-list">
      ${rows || empty}
    </div>
  `;
}

async function markVisibleNotifsRead() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;

  const unreadIds = (lastNotifs || [])
    .filter(n => n.read !== true)
    .map(n => n.id);

  if (!unreadIds.length) return;

  await Promise.all(unreadIds.map((id) =>
    updateDoc(doc(db, 'users', uid, 'notifications', id), {
      read: true,
      readAt: serverTimestamp()
    }).catch(() => {})
  ));
}

function subscribeNotifications(user) {
  if (unsubNotifs) { try { unsubNotifs(); } catch(_) {} unsubNotifs = null; }
  lastNotifs = [];
  renderNotifShell();
  updateNotifDot([]);

  if (!user) return;

  const q = query(
  collection(db, 'users', user.uid, 'notifications'),
  orderBy('createdAt', 'desc'),
  limit(NOTIF_FETCH)
);

unsubNotifs = onSnapshot(q, (snap) => {
  // delete old ones (anything after newest 10)
  cleanupOldNotifications(user.uid, snap.docs);

  // only show the newest 10 in the UI
  const shownDocs = snap.docs.slice(0, NOTIF_KEEP);
  lastNotifs = shownDocs.map(d => ({ id: d.id, ...d.data() }));

  renderNotifications(lastNotifs);
  updateNotifDot(lastNotifs);
}, (err) => {
  console.warn('Notifications listen failed:', err);
});

}

function closeNotifMenu() {
  if (!notifMenu || !notifBtn) return;
  notifOpen = false;
  notifMenu.hidden = true;
  notifBtn.setAttribute('aria-expanded', 'false');
}

function toggleNotifMenu() {
  if (!notifMenu || !notifBtn) return;

  // Logged out: clicking does nothing (per your spec)
  if (!auth.currentUser) return;

  notifOpen = !notifOpen;
  notifMenu.hidden = !notifOpen;
  notifBtn.setAttribute('aria-expanded', String(notifOpen));
  if (notifOpen) markVisibleNotifsRead();
}

function openAnimeFromId(animeId) {
  if (!animeId) return;

  const list =
    (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData :
    (Array.isArray(window.animeData) ? window.animeData : []);

  const makeId =
    (typeof animeSlug === 'function') ? (t) => animeSlug({ Title: t }) :
    (typeof slug === 'function') ? (t) => slug(t) :
    (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

  const found = list.find(a => makeId(a.Title) === animeId);
  if (!found) return;

  // open modal using whatever your project calls it
  if (typeof openModal === 'function') openModal(found);
  else if (typeof openAnimeModal === 'function') openAnimeModal(found);
  else if (typeof showModal === 'function') showModal(found);
}

renderNotifShell();
closeNotifMenu();

notifBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleNotifMenu();
});

notifMenu?.addEventListener('click', (e) => {
  const row = e.target.closest('.notif-row');
  if (!row) return;

  closeNotifMenu();
  openAnimeFromId(row.dataset.animeid);
});

// click outside closes
document.addEventListener('click', (e) => {
  if (!notifOpen) return;
  if (notifBtn?.contains(e.target)) return;
  if (notifMenu?.contains(e.target)) return;
  closeNotifMenu();
});

// ESC closes
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNotifMenu();
});


  switchRow.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-mode]');
    if (!a) return;
    e.preventDefault();
    openAuth(a.dataset.mode);
  });

  resetLink.addEventListener('click', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const email = emailInput.value.trim();
    if (!email) { authError.textContent = 'Enter your email first.'; return; }
    try {
      await sendPasswordResetEmail(auth, email);
      authError.textContent = 'Password reset email sent.';
    } catch (err) {
      authError.textContent = prettyAuthError(err, 'reset');
    }
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    const uname = userInput.value.trim();

    const submitBtn = document.getElementById('auth-submit');
    submitBtn.disabled = true;

    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: uname || email.split('@')[0] });
        await setDoc(doc(db, 'users', cred.user.uid), {
          username: cred.user.displayName,
          email: cred.user.email,
          createdAt: serverTimestamp()
        }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
      closeAuth();
    } catch (err) {
      authError.textContent = prettyAuthError(err, authMode);
    } finally {
      submitBtn.disabled = false;
    }
  });

  signOutBtn?.addEventListener('click', async () => {
  try { await signOut(auth); } catch (_) {}
});


  onAuthStateChanged(auth, (user) => {
  const signedIn = !!user;
  authOpenBtn.textContent = 'My Account';
  if (signOutBtn) signOutBtn.style.display = signedIn ? '' : 'none';

  // NEW: keep favorites/watchlist synced
  subscribeSavesForUser(user);
  subscribeNotifications(user);
});


  // ---------- SEARCH ----------
  function matchesSearch(anime, q) {
    const needle = norm(q);
    if (!needle) return true;
    return (
      norm(anime.Title).includes(needle) ||
      norm(anime.Genre).includes(needle) ||
      norm(anime.Studio).includes(needle) ||
      safeArray(anime.Tags).some((t) => norm(t).includes(needle))
    );
  }

  // ---------- FILTERS ----------
  function collectFacets() {
    const genres = new Set();
    const tags = new Set();
    const studios = new Set();
    (animeData || []).forEach((a) => {
      getGenres(a).forEach((g) => genres.add(g));
      safeArray(a.Tags).forEach((t) => t && tags.add(t));
      splitStudios(a.Studio).forEach((s) => studios.add(s));
    });
    const sortIns = (arr) => arr.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return {
      genres: sortIns([...genres]),
      tags: sortIns([...tags]),
      studios: sortIns([...studios]),
    };
  }

  function renderFacetList(container, values, groupName) {
    if (!container) return;
    container.innerHTML = "";
    values.forEach((val) => {
      const id = `${groupName}-${slug(val)}`;
      const wrap = document.createElement("div");
      wrap.className = "filter-item";
      wrap.innerHTML =
        '<input type="checkbox" id="' + id + '" name="' + groupName + '" value="' + val + '">' +
        '<label for="' + id + '">' + val + "</label>";
      container.appendChild(wrap);
    });
  }

  function buildFilterUI() {
    const { genres, tags, studios } = collectFacets();
    renderFacetList(genreListEl, genres, "genre");
    renderFacetList(tagListEl, tags, "tag");
    renderFacetList(studioListEl, studios, "studio");
  }

  function getCheckedValues(name) {
    const nodes = filterForm?.querySelectorAll('input[name="' + name + '"]:checked') || [];
    return [...nodes].map((n) => n.value);
  }

  // Applied filters only change when Confirm is pressed
let appliedFilters = { genres: new Set(), tags: new Set(), studios: new Set(), hasAny: false };

function readFiltersFromForm() {
  const low = (arr) => arr.map((v) => v.toLowerCase());
  const genres = new Set(low(getCheckedValues("genre")));
  const tags = new Set(low(getCheckedValues("tag")));
  const studios = new Set(low(getCheckedValues("studio")));
  const hasAny = genres.size || tags.size || studios.size;
  return { genres, tags, studios, hasAny };
}

// Anything that renders uses APPLIED filters (not the live checkbox state)
function readFilters() {
  return appliedFilters;
}

function setAppliedFilters(next) {
  appliedFilters = {
    genres: new Set(next.genres),
    tags: new Set(next.tags),
    studios: new Set(next.studios),
    hasAny: !!next.hasAny
  };
}

function clearAppliedFilters() {
  setAppliedFilters({ genres: new Set(), tags: new Set(), studios: new Set(), hasAny: false });
}

// When opening the panel, show the currently applied filters in the checkboxes
function syncFilterFormToApplied() {
  if (!filterForm) return;

  const syncGroup = (name, set) => {
    filterForm.querySelectorAll(`input[name="${name}"]`).forEach((cb) => {
      const v = (cb.value || "").toLowerCase();
      cb.checked = set.has(v);
    });
  };

  syncGroup("genre", appliedFilters.genres);
  syncGroup("tag", appliedFilters.tags);
  syncGroup("studio", appliedFilters.studios);

  updateFilterUI();
}


  function matchesFilters(anime, f) {
    if (!f.hasAny) return true;
    if (f.genres.size) {
      const gset = new Set(getGenres(anime).map((x) => x.toLowerCase()));
      if (![...f.genres].some((g) => gset.has(g))) return false;
    }
    if (f.tags.size) {
      const tset = new Set(safeArray(anime.Tags).map((x) => (x || "").toLowerCase()));
      if (![...f.tags].some((t) => tset.has(t))) return false;
    }
    if (f.studios.size) {
      const sset = new Set(splitStudios(anime.Studio).map((x) => x.toLowerCase()));
      if (![...f.studios].some((s) => sset.has(s))) return false;
    }
    return true;
  }

  function updateFilterUI() {
  if (!summaryEl) return;

  const g = (filterForm?.querySelectorAll('input[name="genre"]:checked') || []).length || 0;
  const t = (filterForm?.querySelectorAll('input[name="tag"]:checked') || []).length || 0;
  const s = (filterForm?.querySelectorAll('input[name="studio"]:checked') || []).length || 0;

  const parts = [];
  if (g) parts.push(`Genres ${g}`);
  if (t) parts.push(`Tags ${t}`);
  if (s) parts.push(`Studios ${s}`);

  summaryEl.textContent = parts.length ? parts.join(" • ") : "No filters applied";
  summaryEl.classList.toggle("is-active", parts.length > 0);
}


  function clearAllFilters() {
    if (!filterForm) return;
    filterForm.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
    updateFilterUI();
  }

  // ---------- GRID + CARDS ----------
  // The renderAnimeCardMarkup function lives in card-render.js (loaded as a
  // classic <script> before this file) so both the homepage AND the admin
  // form can use it. See docs/SHIP-OUTPUT.md gate 5b for the why. Call via
  // window.renderAnimeCardMarkup since the function isn't in this closure.

  function createCard(anime) {
  const animeId = slug(anime.Title);
  const card = window.renderAnimeCardMarkup(anime, { animeId });

  // Open modal when the card itself is clicked
  card.addEventListener("click", () => openModal(anime));

  // Initial icon state (from Firestore snapshots if already loaded)
  applySavedStateToCard(card, animeId);

  async function handleToggle(kind, btn) {
    const user = auth.currentUser;
    if (!user) {
      jiggle(btn);
      return;
    }

    const setRef = (kind === "favorites") ? favoritesSet : watchlistSet;

    const turnOn = !btn.classList.contains("is-on");

    // optimistic UI
    if (turnOn) setRef.add(animeId);
    else setRef.delete(animeId);
    syncSavedUIForAnime(animeId);

    btn.disabled = true;
    try {
      await setSave(kind, user.uid, animeId, anime.Title, turnOn);
    } catch (err) {
      // rollback
      if (turnOn) setRef.delete(animeId);
      else setRef.add(animeId);
      syncSavedUIForAnime(animeId);
      alert("Failed to save: " + (err.message || String(err)));
    } finally {
      btn.disabled = false;
    }
  }

  const favBtn = card.querySelector(".fav-btn");
  const watchBtn = card.querySelector(".watch-btn");

  favBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleToggle("favorites", favBtn);
  }, { passive: false });

  watchBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleToggle("watchlist", watchBtn);
  }, { passive: false });

  return card;
}

// ---------- FEATURED (Latest Review) ----------
function buildFeaturedDrop() {
  if (!featuredDrop || !featuredDropCard) return;
  if (!Array.isArray(animeData) || !animeData.length) return;

  // “Latest” = last entry in animeData (matches your current workflow)
  const a = animeData[animeData.length - 1];

  featuredDropCard.innerHTML = `
    <img class="featured-thumb" src="assets/${escapeHtml(a.image || '')}"
      alt="${escapeHtml(a.Title || '')}"
      loading="lazy" decoding="async"
      onerror="this.onerror=null;this.src='assets/placeholder.png';" />

    <div class="featured-name">${escapeHtml(a.Title || '')}</div>
    <div class="featured-genre">${escapeHtml(a.Genre || '')}</div>
    <div class="featured-rating">${escapeHtml(a.Rating || '')}</div>
  `;

  featuredDropCard.onclick = () => openModal(a);
}
// Align Featured panel next to the ACTIVE Top 10 card and keep it FIXED
function positionFeaturedDrop() {
  if (!featuredDrop) return;

  // Keep it inside #home-view so it disappears when Home is hidden (View All).
  if (homeView && featuredDrop.parentElement !== homeView) {
    homeView.insertBefore(featuredDrop, homeView.firstElementChild);
  }

  // Kill any old “pinned” inline styles from previous attempts.
  featuredDrop.style.removeProperty('position');
  featuredDrop.style.removeProperty('top');
  featuredDrop.style.removeProperty('left');
  featuredDrop.style.removeProperty('right');
  featuredDrop.style.removeProperty('z-index');
}





  function renderGrid(list = animeData) {
    cardContainer.innerHTML = "";
    list.forEach((anime) => cardContainer.appendChild(createCard(anime)));
  }

  // ---------- SPOTLIGHT (Top 10) ----------
  function updateTop10Counter() {
    if (!top10Counter) return;
    if (top10Count <= 1) {
      top10Counter.textContent = "";
      return;
    }
    top10Counter.textContent = `${spotlightIndex + 1}/${top10Count}`;
  }

  function setTop10ControlsState() {
    const canNavigate = top10Count > 1;
    if (top10Prev) top10Prev.disabled = !canNavigate;
    if (top10Next) top10Next.disabled = !canNavigate;
    if (!canNavigate && top10Counter) top10Counter.textContent = "";
    if (canNavigate) updateTop10Counter();
  }

  function pulseManualSpotlightNav() {
    if (!spotlightRoot) return;
    spotlightRoot.classList.add("manual-nav");
    if (spotlightManualTimer) clearTimeout(spotlightManualTimer);
    spotlightManualTimer = setTimeout(() => {
      spotlightRoot.classList.remove("manual-nav");
      spotlightManualTimer = null;
    }, MANUAL_SPOTLIGHT_MS);
  }

  function setActiveSpotlightByIndex(nextIndex, opts = {}) {
    const { isManual = false, restartCycle = true } = opts;
    const all = spotlightRoot ? spotlightRoot.querySelectorAll(".card") : [];
    if (!all.length) {
      spotlightIndex = 0;
      updateTop10Counter();
      return;
    }

    const wrapped = ((Number(nextIndex) % all.length) + all.length) % all.length;
    all.forEach((c) => c.classList.remove("active"));
    all[wrapped].classList.add("active");
    spotlightIndex = wrapped;
    lastSpotlightChangeAt = Date.now();
    updateTop10Counter();

    if (isManual) pulseManualSpotlightNav();
    if (restartCycle && SHOULD_CYCLE && top10Count > 1) {
      scheduleNextAdvance();
    }
  }

  function stepSpotlight(delta) {
    if (top10Count <= 1) return;
    setActiveSpotlightByIndex(spotlightIndex + delta, { isManual: true, restartCycle: true });
  }

  function bindTop10Controls() {
    top10Prev?.addEventListener("click", () => stepSpotlight(-1));
    top10Next?.addEventListener("click", () => stepSpotlight(1));
    spotlightRoot?.addEventListener("mouseenter", () => {
      if (!HAS_HOVER) return;
      isSpotlightHovered = true;
      stopSpotlightCycle();
    });
    spotlightRoot?.addEventListener("mouseleave", () => {
      if (!HAS_HOVER) return;
      isSpotlightHovered = false;
      if (SHOULD_CYCLE && top10Count > 1 && homeView.style.display !== "none") {
        startSpotlightCycle();
      }
    });
    spotlightRoot?.addEventListener("touchend", () => {
      isSpotlightHovered = false;
      if (
        SHOULD_CYCLE &&
        top10Count > 1 &&
        homeView.style.display !== "none" &&
        !overlay?.classList.contains("active")
      ) {
        startSpotlightCycle();
      }
    }, { passive: true });
  }

  function buildSpotlight() {
    stopSpotlightCycle();
    spotlightRoot.innerHTML = "";
    const top10 = (animeData || [])
      .filter((a) => typeof a.Top10Rank === "number" && !Number.isNaN(a.Top10Rank))
      .sort((a, b) => a.Top10Rank - b.Top10Rank);
    top10Count = top10.length;

    top10.forEach((anime, i) => {
      const card = createCard(anime);
      card.classList.add("top10-card");
      const badge = document.createElement("div");
      badge.className = "rank-badge";
      badge.textContent = `#${anime.Top10Rank}`;
      card.appendChild(badge);
      if (i === 0) card.classList.add("active");
      spotlightRoot.appendChild(card);
    });

    spotlightIndex = 0;
    lastSpotlightChangeAt = Date.now();
    setTop10ControlsState();
    updateTop10Counter();
    if (top10Count > 1 && SHOULD_CYCLE) startSpotlightCycle();
  }

  function scheduleNextAdvance(delayMs = CYCLE_MS) {
    if (top10Count <= 1) {
      stopSpotlightCycle();
      return;
    }
    if (spotlightTimer) {
      clearTimeout(spotlightTimer);
      spotlightTimer = null;
    }
    spotlightTimer = setTimeout(() => {
      if (document.hidden || homeView.style.display === "none") {
        scheduleNextAdvance();
        return;
      }
      if (isSpotlightHovered) {
        // Recheck quickly while hovered so we don't "sleep" another full 6s window.
        scheduleNextAdvance(250);
        return;
      }
      const elapsed = Date.now() - (lastSpotlightChangeAt || 0);
      if (elapsed < CYCLE_MS) {
        scheduleNextAdvance(CYCLE_MS - elapsed);
        return;
      }
      const all = spotlightRoot.querySelectorAll(".card");
      if (!all.length) {
        scheduleNextAdvance();
        return;
      }
      setActiveSpotlightByIndex(spotlightIndex + 1, { restartCycle: false });
      scheduleNextAdvance();
    }, Math.max(0, delayMs));
  }
  function startSpotlightCycle() {
    if (top10Count <= 1) return;
    stopSpotlightCycle();
    scheduleNextAdvance();
  }
  function stopSpotlightCycle() {
    if (spotlightTimer) {
      clearTimeout(spotlightTimer);
      spotlightTimer = null;
    }
    if (spotlightManualTimer) {
      clearTimeout(spotlightManualTimer);
      spotlightManualTimer = null;
    }
    spotlightRoot?.classList.remove("manual-nav");
  }

  // ---------- RECOMMENDED RAIL ----------
  const VISIBLE_CARDS = 3;
  const SPEED_PX_S = 30;
  const RAIL_COUNT = 1;
  const RAIL_TICK_MS = 1000 / 60;
  const GENRE_SHUFFLE_LOCK_MS = 420;

  function clearGenreRotationTimers() {
    if (!genreRotationTimerIds.length) return;
    genreRotationTimerIds.forEach((id) => clearInterval(id));
    genreRotationTimerIds = [];
  }

  function pickGenresForRails(last = [], count = RAIL_COUNT, minTitles = 4) {
    const counts = new Map();
    (animeData || []).forEach((a) =>
      getGenres(a).forEach((g) => {
        const k = (g || "").toLowerCase();
        counts.set(k, (counts.get(k) || 0) + 1);
      })
    );
    let pool = [...counts.entries()].filter(([, n]) => n >= minTitles).map(([k]) => k);
    if (!pool.length) return ["popular"];

    pool = shuffle(pool);
    const take = Math.max(1, Math.min(count, pool.length));
    let picked = pool.slice(0, take);
    if (
      picked.length > 1 &&
      last.length === picked.length &&
      picked.every((g, i) => g === last[i])
    ) {
      picked = [...picked.slice(1), picked[0]];
    }
    if (picked.length === 1 && last[0] && picked[0] === last[0] && pool.length > 1) {
      picked[0] = pool.find((g) => g !== picked[0]) || picked[0];
    }
    return picked;
  }

  function itemsForGenre(genre, max = 12) {
    const list = (animeData || []).filter((a) =>
      getGenres(a).some((g) => g.toLowerCase() === String(genre).toLowerCase())
    );
    if (!list.length) return shuffle(animeData).slice(0, max);
    return shuffle(list).slice(0, Math.max(max, VISIBLE_CARDS * 2));
  }

  function createRailDOM(genre) {
    const rail = document.createElement("div");
    rail.className = "rail";
    const header = document.createElement("div");
    header.className = "rail-header";
    header.innerHTML = `<span class="rail-title">${genre}</span>`;
    const viewport = document.createElement("div");
    viewport.className = "rail-viewport";
    const track = document.createElement("div");
    track.className = "rail-track";
    viewport.appendChild(track);
    rail.appendChild(header);
    rail.appendChild(viewport);
    return { rail, viewport, track };
  }

  function mountRail(genre, direction = -1) {
    const { rail, viewport, track } = createRailDOM(genre);
    const items = itemsForGenre(genre, 12);
    items.forEach((a) => track.appendChild(createCard(a)));
    items.forEach((a) => track.appendChild(createCard(a)));

    let setWidth = 0;
    let offsetX = 0;
    let paused = false;
    let rotationTimerId = null;

    function isVisible() {
      return (
        viewport &&
        viewport.isConnected &&
        viewport.getBoundingClientRect().width > 0 &&
        viewport.offsetParent !== null
      );
    }
    function getGapPx() {
      const cs = getComputedStyle(track);
      const g = parseFloat(cs.gap || cs.columnGap || "0");
      return Number.isFinite(g) ? g : 0;
    }
    let lastValidSetWidth = 0;

    function measure(force = false) {
      if (!isVisible()) {
        if (force && lastValidSetWidth > 0) setWidth = lastValidSetWidth;
        return;
      }
      const children = [...track.children].slice(0, items.length);
      const gap = getGapPx();
      let w = 0;
      children.forEach((node, idx) => {
        w += node.getBoundingClientRect().width;
        if (idx < children.length - 1) w += gap;
      });
      setWidth = Math.max(1, w);
      lastValidSetWidth = setWidth;
    }

    function tick() {
      if (paused || REDUCED_MOTION) return;
      const delta = SPEED_PX_S * (RAIL_TICK_MS / 1000) * direction;
      offsetX += delta;
      if (direction === 1 && offsetX >= setWidth) offsetX -= setWidth;
      if (direction === -1 && offsetX <= -setWidth) offsetX += setWidth;
      track.style.transform = `translate3d(${offsetX}px,0,0)`;
    }

    function start() {
      if (REDUCED_MOTION) return;
      paused = false;
      measure(true);
      if (rotationTimerId !== null) return;
      rotationTimerId = window.setInterval(tick, RAIL_TICK_MS);
      genreRotationTimerIds.push(rotationTimerId);
    }
    function stop() {
      if (rotationTimerId !== null) {
        clearInterval(rotationTimerId);
        genreRotationTimerIds = genreRotationTimerIds.filter((id) => id !== rotationTimerId);
        rotationTimerId = null;
      }
      paused = false;
    }
    function pause() {
      paused = true;
    }
    function resume() {
      paused = false;
    }
    
    const onResize = () => {
      measure(true);
      if (setWidth > 0) {
        if (offsetX > setWidth) offsetX = offsetX % setWidth;
        if (-offsetX > setWidth) offsetX = -((-offsetX) % setWidth);
      }
    };
    viewport.addEventListener("mouseenter", pause);
    viewport.addEventListener("mouseleave", resume);
    window.addEventListener("resize", onResize);

    function destroy() {
      stop();
      viewport.removeEventListener("mouseenter", pause);
      viewport.removeEventListener("mouseleave", resume);
      window.removeEventListener("resize", onResize);
    }

    return { rail, start, stop, pause, resume, destroy };
  }

  function rebuildGenreSection() {
    if (!recommendedRow) return;
    railsControllers.forEach((r) => {
      if (typeof r.destroy === "function") r.destroy();
      else r.stop();
    });
    railsControllers = [];
    clearGenreRotationTimers();
    recommendedRow.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.id = "genre-rails";

    const genres = pickGenresForRails(lastGenres, RAIL_COUNT);
    lastGenres = [...genres];
    const nextControllers = genres.map((genre, idx) => {
      const direction = idx % 2 === 0 ? -1 : 1;
      const controller = mountRail(genre || "popular", direction);
      wrap.appendChild(controller.rail);
      return controller;
    });

    recommendedRow.appendChild(wrap);
    railsControllers = nextControllers;
    railsControllers.forEach((r) => r.start());
  }

  function buildGenreRails() {
    rebuildGenreSection();
  }

  function showGenreRails() {
    if (recommendedRow) recommendedRow.style.display = "";
    railsControllers.forEach((r) => r.start());
  }
  function hideGenreRails() {
    railsControllers.forEach((r) => r.stop());
    if (recommendedRow) recommendedRow.style.display = "none";
  }

  function bindGenreShuffleButton() {
    if (!genreShuffleBtn) return;
    genreShuffleBtn.addEventListener("click", () => {
      if (genreShuffleLocked) return;
      genreShuffleLocked = true;
      genreShuffleBtn.disabled = true;
      genreShuffleBtn.classList.add("is-spinning");

      rebuildGenreSection();
      const wrap = recommendedRow ? recommendedRow.querySelector("#genre-rails") : null;
      wrap?.classList.add("is-shuffling");

      if (genreShuffleUnlockTimer) clearTimeout(genreShuffleUnlockTimer);
      genreShuffleUnlockTimer = setTimeout(() => {
        wrap?.classList.remove("is-shuffling");
        genreShuffleBtn.classList.remove("is-spinning");
        genreShuffleBtn.disabled = false;
        genreShuffleLocked = false;
        genreShuffleUnlockTimer = null;
      }, GENRE_SHUFFLE_LOCK_MS);
    });
  }

// If redirected here with ?signin=1, open the auth modal once.
(function maybeOpenAuthFromQuery(){
  try {
    const usp = new URLSearchParams(location.search);
    if (usp.get('signin') === '1') {
      // remove the param from the address bar
      history.replaceState({}, '', location.pathname);
      openAuth('signin');
    }
  } catch(_) {}
})();

  // ---------- COMMENTS ----------
  function animeSlug(anime) {
    return slug((anime && anime.Title) ? anime.Title : "anime");
  }

  function commentsMarkup(anime) {
  const s = animeSlug(anime);
  return [
    '<section class="comments-section" id="comments-' + s + '">',
    '  <div class="comments-header">',
    '    <h3>Comments <span class="comments-count" id="comments-count-' + s + '">0</span></h3>',
    '    <div class="comments-controls">',
    '      <label class="sort">',
    '        <span>Sort</span>',
    '        <select id="comments-sort-' + s + '">',
    '          <option value="newest">Newest</option>',
    '          <option value="oldest">Oldest</option>',
    '          <option value="most-liked">Most liked</option>',
    '        </select>',
    '      </label>',
    '    </div>',
    '  </div>',
    '',
    '  <div class="comment-composer">',
    '    <div class="avatar" aria-hidden="true">&#9733;</div>',
    '    <div class="composer-body">',
    '      <textarea id="composer-input-' + s + '" placeholder="Leave a comment…" maxlength="500"></textarea>',
    '      <div class="composer-actions">',
    '        <span class="char-count"><span id="composer-count-' + s + '">0</span>/500</span>',
    '        <button class="btn" id="composer-post-' + s + '" disabled>Post</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '',
    '  <ul class="comments-list" id="comments-list-' + s + '"></ul>',
    '</section>'
  ].join('\n');
}

  function officialVotesMarkup(anime) {
  const s = animeSlug(anime);
  return [
    `<div class="official-votes-bar" id="official-votes-${s}">`,
    `  <span class="label">Agree with my Rating?</span>`,
    `  <div class="official-votes">`,
    `    <button type="button" class="vote-btn like" data-action="like" aria-label="Like Blake's rating">`,
    `      ▲ <span class="vcount">0</span>`,
    `    </button>`,
    `    <button type="button" class="vote-btn dislike" data-action="dislike" aria-label="Dislike Blake's rating">`,
    `      ▼ <span class="vcount">0</span>`,
    `    </button>`,
    `  </div>`,
    `</div>`
  ].join('\n');
}

  function timeAgo(ts) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); return `${d}d ago`;
  }

  function commentItemEl({ id, uid, displayName, photoURL, text, createdAt, likesCount = 0, dislikesCount = 0 }) {
  const li = document.createElement('li'); li.className = 'comment-item';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  if (photoURL) {
    avatar.innerHTML = `<img src="${escapeHtml(photoURL)}" alt="">`;
  } else {
    avatar.textContent = (displayName || '?').toString().trim().charAt(0).toUpperCase() || '?';
  }

  const bubble = document.createElement('div'); bubble.className = 'bubble';

  const meta = document.createElement('div'); meta.className = 'meta';
  const nameEl = document.createElement('span'); nameEl.className = 'name'; nameEl.textContent = displayName || 'User';
  const sepTxt = document.createTextNode(' · ');
  const millis = createdAt?.toMillis ? createdAt.toMillis() : (typeof createdAt === 'number' ? createdAt : Date.now());
  const timeEl = document.createElement('time'); timeEl.textContent = timeAgo(millis);
  meta.appendChild(nameEl); meta.appendChild(sepTxt); meta.appendChild(timeEl);

  const p = document.createElement('p'); p.textContent = text || '';

  bubble.appendChild(meta);
  bubble.appendChild(p);

  // Votes (like / dislike)
  const votes = document.createElement('div');
  votes.className = 'votes';
  votes.innerHTML = `
    <button type="button" class="vote-btn like" data-action="like" data-id="${id}" aria-label="Like comment">
      ▲ <span class="vcount">${likesCount}</span>
    </button>
    <button type="button" class="vote-btn dislike" data-action="dislike" data-id="${id}" aria-label="Dislike comment">
      ▼ <span class="vcount">${dislikesCount}</span>
    </button>
  `;
  bubble.appendChild(votes);

  // author-only actions (Edit/Delete)
  const user = auth.currentUser;
  if (user && user.uid === uid) {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'action-btn edit';
    editBtn.textContent = 'Edit';
    editBtn.dataset.action = 'edit';
    editBtn.dataset.id = id;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'action-btn delete';
    delBtn.textContent = 'Delete';
    delBtn.dataset.action = 'delete';
    delBtn.dataset.id = id;

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    meta.appendChild(actions);
  }

  li.appendChild(avatar);
  li.appendChild(bubble);

  // default vote state (not selected)
  setVoteUI(li, 0);

  return li;
}
function setVoteUI(li, value) {
  const likeBtn = li.querySelector('.vote-btn.like');
  const disBtn  = li.querySelector('.vote-btn.dislike');
  if (likeBtn) likeBtn.classList.toggle('active', value === 1);
  if (disBtn)  disBtn.classList.toggle('active', value === -1);
}


  function subscribeComments(anime) {
  const s = animeSlug(anime);
  const listEl  = document.getElementById(`comments-list-${s}`);
  const countEl = document.getElementById(`comments-count-${s}`);
  const sortEl  = document.getElementById(`comments-sort-${s}`);
  if (!listEl) return () => {};

  const qref = query(collection(db, 'comments', s, 'items'), orderBy('createdAt', 'desc'));

  if (!subscribeComments._authorUnsubs) subscribeComments._authorUnsubs = [];
  if (!subscribeComments._voteUnsubs) subscribeComments._voteUnsubs = [];

  let lastRows = [];

  function renderRows(rows) {
    const mode = (sortEl?.value || 'newest');
    const sorted = rows.slice();

    if (mode === 'oldest') {
      sorted.sort((a, b) => a.createdAtMillis - b.createdAtMillis);
    } else if (mode === 'most-liked') {
      sorted.sort((a, b) => (b.likesCount - a.likesCount) || (b.createdAtMillis - a.createdAtMillis));
    } else {
      sorted.sort((a, b) => b.createdAtMillis - a.createdAtMillis);
    }

    listEl.innerHTML = '';
    sorted.forEach(r => listEl.appendChild(r.li));
  }

  const onSortChange = () => {
  renderRows(lastRows);
  // prevent sticky "focused" styling after choosing an option
  try { sortEl.blur(); } catch(_) {}
};
sortEl?.addEventListener('change', onSortChange);


  const unsubMain = onSnapshot(qref, (snap) => {
    // stop previous per-author listeners
    try { subscribeComments._authorUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    subscribeComments._authorUnsubs = [];

    // stop previous per-vote listeners
    try { subscribeComments._voteUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    subscribeComments._voteUnsubs = [];

    const rows = [];
    let n = 0;

    const user = auth.currentUser;

    snap.forEach((docSnap) => {
      n++;
      const d = docSnap.data();

      const createdAtMillis = d.createdAt?.toMillis
        ? d.createdAt.toMillis()
        : (typeof d.createdAt === 'number' ? d.createdAt : Date.now());

      const likesCount    = (typeof d.likesCount === 'number') ? d.likesCount : 0;
      const dislikesCount = (typeof d.dislikesCount === 'number') ? d.dislikesCount : 0;

      const li = commentItemEl({
        id: docSnap.id,
        uid: d.uid,
        displayName: d.displayName || 'User',
        photoURL: d.photoURL || null,
        text: d.text || '',
        createdAt: d.createdAt,
        likesCount,
        dislikesCount
      });

      // live author profile subscription
      if (d && d.uid) {
        const uref = doc(db, 'users', d.uid);
        const unsubAuthor = onSnapshot(uref, (us) => {
          const u = us.data(); if (!u) return;

          const nameEl = li.querySelector('.name');
          if (nameEl && u.username && nameEl.textContent !== u.username) {
            nameEl.textContent = u.username;
          }

          const av = li.querySelector('.avatar');
          if (av) {
            if (u.photoURL) {
              av.innerHTML = `<img src="${escapeHtml(u.photoURL)}" alt="">`;
            } else {
              const initial = (u.username || d.displayName || '?').toString().trim().charAt(0).toUpperCase() || '?';
              av.textContent = initial;
            }
          }
        });
        subscribeComments._authorUnsubs.push(unsubAuthor);
      }

      // live vote state (current user only)
      setVoteUI(li, 0);
      if (user && user.uid) {
        const vref = doc(db, 'comments', s, 'items', docSnap.id, 'votes', user.uid);
        const unsubVote = onSnapshot(vref, (vs) => {
          const val = (vs.exists() && typeof vs.data()?.value === 'number') ? vs.data().value : 0;
          setVoteUI(li, val);
        });
        subscribeComments._voteUnsubs.push(unsubVote);
      }

      rows.push({ li, createdAtMillis, likesCount, dislikesCount });
    });

    lastRows = rows;
    renderRows(lastRows);

    if (countEl) countEl.textContent = String(n);
  });

  return () => {
    try { unsubMain(); } catch (_) {}
    try { sortEl && sortEl.removeEventListener('change', onSortChange); } catch (_) {}
    try { subscribeComments._authorUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    try { subscribeComments._voteUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    subscribeComments._authorUnsubs = [];
    subscribeComments._voteUnsubs = [];
  };
}


// COPY-PASTE ABOVE "// Post handler" inside wireComments(anime)
let lastPostAt = 0;
function canPostNow() {
  return (Date.now() - lastPostAt) >= 4000;
}
function markPostedNow() {
  lastPostAt = Date.now();
}

  function wireComments(anime) {
    const s = animeSlug(anime);
    const input   = document.getElementById(`composer-input-${s}`);
    const counter = document.getElementById(`composer-count-${s}`);
    const postBtn = document.getElementById(`composer-post-${s}`);
    const listEl  = document.getElementById(`comments-list-${s}`);
    if (!input || !counter || !postBtn || !listEl) return () => {};

    function ensureAuthOrOpen(e) {
      if (!auth.currentUser) {
        e?.preventDefault();
        openAuth('signin');
        return false;
      }
      return true;
    }

    function syncAuthUI(u) {
      const authed = !!u;
      input.readOnly = !authed;
      input.placeholder = authed ? "Leave a comment…" : "Sign in to comment";
      postBtn.textContent = authed ? "Post" : "Sign in";

      const n = input.value.length;
      const okText = n > 0 && n <= 500 && input.value.trim().length > 0;
      postBtn.disabled = !(authed && okText);
      counter.textContent = String(n);
    }

    input.addEventListener('focus', (e) => { ensureAuthOrOpen(e); });
    input.addEventListener('input', () => { syncAuthUI(auth.currentUser); });

    onAuthStateChanged(auth, (u) => { syncAuthUI(u); });
    syncAuthUI(auth.currentUser);

    let posting = false;

postBtn.addEventListener('click', async (e) => {
  if (!ensureAuthOrOpen(e)) return;
  if (posting) return;
  if (!canPostNow()) { alert('Easy there—please wait a moment before posting again.'); return; }

  const u = auth.currentUser;
  if (!u) return;

  const text = input.value.trim();
  if (!text || text.length > 500) return;

  // define these locally (THIS is what was breaking your code)
  const displayName = u.displayName || (u.email ? u.email.split('@')[0] : 'User');
  const photoURL = u.photoURL || null;

  const itemsRef = collection(db, 'comments', s, 'items');

  // optimistic row (insert ONCE)
  const pending = commentItemEl({
    id: `pending-${Date.now()}`,
    uid: u.uid,
    displayName,
    photoURL,
    text,
    createdAt: Date.now(),
    likesCount: 0,
    dislikesCount: 0
  });
  pending.classList.add('is-pending');
  listEl.prepend(pending);

  posting = true;
  postBtn.disabled = true;

  try {
    const payload = {
      uid: u.uid,
      displayName,
      photoURL,
      text,
      createdAt: serverTimestamp(),
      likesCount: 0,
      dislikesCount: 0
    };

    await addDoc(itemsRef, payload);

    // only mark cooldown AFTER success
    markPostedNow();

    input.value = '';
  } catch (err) {
    pending.remove();
    alert('Failed to post: ' + err.message);
  } finally {
    posting = false;
    postBtn.disabled = false;
    syncAuthUI(auth.currentUser);
  }
});




    const unsubscribe = subscribeComments(anime);

    // Inline edit UI (no browser prompt)
function openInlineCommentEditor(editBtn, itemRef) {
  const bubble = editBtn.closest('.bubble');
  if (!bubble) return;

  // don't allow editing optimistic "pending" items
  const id = editBtn.dataset.id || '';
  if (id.startsWith('pending-')) return;

  // close any other open comment editor
  document.querySelectorAll('.comment-item .inline-edit').forEach((wrap) => {
    const b = wrap.closest('.bubble');
    const p = b?.querySelector('p');
    const actions = b?.querySelector('.actions');
    if (p) p.hidden = false;
    if (actions) actions.style.display = '';
    wrap.remove();
    if (b) delete b.dataset.editing;
  });

  if (bubble.querySelector('.inline-edit')) return;

  const p = bubble.querySelector('p');
  const actions = bubble.querySelector('.actions');
  if (!p) return;

  bubble.dataset.editing = '1';
  p.hidden = true;
  if (actions) actions.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'inline-edit';
  wrap.innerHTML = `
    <textarea class="inline-editor" maxlength="500"></textarea>
    <div class="inline-actions">
      <span class="char-count"><span class="inline-count">0</span>/500</span>
      <div class="inline-buttons">
        <button type="button" class="action-btn cancel">Cancel</button>
        <button type="button" class="action-btn save">Save</button>
      </div>
    </div>
  `;

  // put editor above vote buttons (votes stay visible below)
  const votes = bubble.querySelector('.votes');
  bubble.insertBefore(wrap, votes || null);

  const ta = wrap.querySelector('.inline-editor');
  const count = wrap.querySelector('.inline-count');
  const saveBtn = wrap.querySelector('.action-btn.save');
  const cancelBtn = wrap.querySelector('.action-btn.cancel');

  ta.value = (p.textContent || '').trim();

  const sync = () => {
    const n = ta.value.length;
    count.textContent = String(n);
    const ok = ta.value.trim().length > 0 && n <= 500;
    saveBtn.disabled = !ok;
  };
  ta.addEventListener('input', sync);
  sync();
  setTimeout(() => ta.focus(), 0);

  cancelBtn.addEventListener('click', () => {
    wrap.remove();
    p.hidden = false;
    if (actions) actions.style.display = '';
    delete bubble.dataset.editing;
  });

  saveBtn.addEventListener('click', async () => {
    const next = ta.value.trim();
    if (!next || next.length > 500) return;

    saveBtn.disabled = true;
    try {
      await updateDoc(itemRef, { text: next, editedAt: serverTimestamp() });
      p.textContent = next; // immediate UI update
    } catch (err) {
      alert('Failed to edit: ' + err.message);
    } finally {
      wrap.remove();
      p.hidden = false;
      if (actions) actions.style.display = '';
      delete bubble.dataset.editing;
    }
  });
}


    listEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const u = auth.currentUser;
      if (!u) return;

      const id = btn.dataset.id;
      const itemRef = doc(db, 'comments', s, 'items', id);

      const action = btn.dataset.action;

// Voting (like / dislike)
if (action === 'like' || action === 'dislike') {
  if (!ensureAuthOrOpen(e)) return;
  if (!id || id.startsWith('pending-')) return;

  const commentRef = doc(db, 'comments', s, 'items', id);
  const voteRef    = doc(db, 'comments', s, 'items', id, 'votes', auth.currentUser.uid);

  try {
    await runTransaction(db, async (tx) => {
      const cSnap = await tx.get(commentRef);
      if (!cSnap.exists()) return;

      const vSnap = await tx.get(voteRef);

      const c = cSnap.data() || {};
      const prev = vSnap.exists() ? (vSnap.data()?.value || 0) : 0;

      let next = 0;
      if (action === 'like') next = (prev === 1) ? 0 : 1;
      if (action === 'dislike') next = (prev === -1) ? 0 : -1;

      let likes = (typeof c.likesCount === 'number') ? c.likesCount : 0;
      let dislikes = (typeof c.dislikesCount === 'number') ? c.dislikesCount : 0;

      // remove previous vote
      if (prev === 1) likes--;
      if (prev === -1) dislikes--;

      // apply next vote
      if (next === 1) likes++;
      if (next === -1) dislikes++;

      if (likes < 0) likes = 0;
      if (dislikes < 0) dislikes = 0;

      tx.update(commentRef, { likesCount: likes, dislikesCount: dislikes });
      // create notification for comment owner (no self-notify, no unvote notify)
const authorUid = c.uid;
if (next !== 0 && authorUid && authorUid !== auth.currentUser.uid) {
  const me = auth.currentUser;
  const notifRef = doc(collection(db, 'users', authorUid, 'notifications'));

  tx.set(notifRef, {
    toUid: authorUid,
    fromUid: me.uid,
    fromDisplayName: me.displayName || (me.email ? me.email.split('@')[0] : 'Someone'),
    fromPhotoURL: me.photoURL || null,
    type: 'comment_vote',
    value: next,              // 1 = like, -1 = dislike
    animeId: s,               // slug
    animeTitle: anime.Title || '',
    targetId: id,             // commentId
    createdAt: serverTimestamp()
  });
}


      if (next === 0) {
        if (vSnap.exists()) tx.delete(voteRef);
      } else {
        tx.set(voteRef, { uid: auth.currentUser.uid, value: next, updatedAt: serverTimestamp() }, { merge: true });
      }
    });
  } catch (err) {
    alert('Vote failed: ' + err.message);
  }
  return;
}


      if (btn.dataset.action === 'delete') {
        const ok = await confirmDialog({
      title: 'Delete comment?',
      message: 'This will permanently remove this comment.',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true
});
if (ok) await deleteDoc(itemRef);

      } else if (btn.dataset.action === 'edit') {
      openInlineCommentEditor(btn, itemRef);
      }
    });

    return unsubscribe;
  }
  // ============================
// COMMUNITY (right sheet)
// ============================
function communityMarkup(anime) {
  const s = animeSlug(anime);
  return [
    '<span class="close-button" aria-label="Close">&times;</span>',
    '<div class="community-header">',
    '  <h2>COMMUNITY TAB</h2>',
    '  <div class="community-right">',
    `    <div class="community-avg"><span id="comm-avg-${s}">—</span><small id="comm-count-${s}">(0)</small></div>`,
    '  </div>',
    '</div>',
    '',
    `<form class="review-composer" id="rev-form-${s}">`,
    `  <input id="rev-title-${s}" type="text" placeholder="Review title" maxlength="80">`,
    '  <div class="number-wrap">',
    `    <input id="rev-rating-${s}" type="text" inputmode="decimal" pattern="^\\d*(?:\\.\\d)?$" placeholder="Rating 1-10">`,
    '    <button type="button" class="step dec" aria-label="Decrease rating">-</button>',
    '    <button type="button" class="step inc" aria-label="Increase rating">+</button>',
    '  </div>',
    `  <textarea id="rev-body-${s}" placeholder="Write your review…" maxlength="2000"></textarea>`,
    '  <div class="composer-actions">',
    `    <span class="char-count"><span id="rev-count-${s}">0</span>/2000</span>`,
    `    <button type="submit" class="btn" id="rev-publish-${s}" disabled>Publish</button>`,
    '  </div>',
    `  <p class="signin-hint" id="rev-hint-${s}" style="display:none;">Sign in to post a review.</p>`,
    '</form>',
    '',
    `<div class="comm-sort-row"><label class="comm-sort"><span>Sort</span><select id="comm-sort-${s}"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="most-liked">Most liked</option></select></label></div>`,
    `<ul class="review-list" id="comm-list-${s}"></ul>`
  ].join('\n');
}

function setReviewVoteUI(li, value) {
  const likeBtn = li.querySelector('.vote-btn.like');
  const disBtn  = li.querySelector('.vote-btn.dislike');
  if (likeBtn) likeBtn.classList.toggle('active', value === 1);
  if (disBtn)  disBtn.classList.toggle('active', value === -1);
}


function subscribeReviews(anime) {
  const s = animeSlug(anime);
  const listEl  = document.getElementById(`comm-list-${s}`);
  const avgEl   = document.getElementById(`comm-avg-${s}`);
  const countEl = document.getElementById(`comm-count-${s}`);
  const sortEl  = document.getElementById(`comm-sort-${s}`);
  if (!listEl) return () => {};

  const qref = query(collection(db, 'reviews', s, 'items'), orderBy('createdAt', 'desc'));

  if (!subscribeReviews._authorUnsubs) subscribeReviews._authorUnsubs = [];
  if (!subscribeReviews._voteUnsubs) subscribeReviews._voteUnsubs = [];
  if (!subscribeReviews._threadUnsubs) subscribeReviews._threadUnsubs = [];

  let lastRows = [];
  let openReviewIds = new Set();
  let openThreadIds = new Set();

  // Inline edit UI for THREAD comments (duplicate of the left-side comment editor)
  function openInlineThreadEditor(editBtn, itemRef) {
    const bubble = editBtn.closest('.bubble');
    if (!bubble) return;

    const id = editBtn.dataset.id || '';
    if (id.startsWith('pending-')) return;

    // close any other open editor
    document.querySelectorAll('.comment-item .inline-edit').forEach((wrap) => {
      const b = wrap.closest('.bubble');
      const p = b?.querySelector('p');
      const actions = b?.querySelector('.actions');
      if (p) p.hidden = false;
      if (actions) actions.style.display = '';
      wrap.remove();
      if (b) delete b.dataset.editing;
    });

    if (bubble.querySelector('.inline-edit')) return;

    const p = bubble.querySelector('p');
    const actions = bubble.querySelector('.actions');
    if (!p) return;

    bubble.dataset.editing = '1';
    p.hidden = true;
    if (actions) actions.style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'inline-edit';
    wrap.innerHTML = `
      <textarea class="inline-editor" maxlength="500"></textarea>
      <div class="inline-actions">
        <span class="char-count"><span class="inline-count">0</span>/500</span>
        <div class="inline-buttons">
          <button type="button" class="action-btn cancel">Cancel</button>
          <button type="button" class="action-btn save">Save</button>
        </div>
      </div>
    `;

    const votes = bubble.querySelector('.votes');
    bubble.insertBefore(wrap, votes || null);

    const ta = wrap.querySelector('.inline-editor');
    const count = wrap.querySelector('.inline-count');
    const saveBtn = wrap.querySelector('.action-btn.save');
    const cancelBtn = wrap.querySelector('.action-btn.cancel');

    ta.value = (p.textContent || '').trim();

    const sync = () => {
      const n = ta.value.length;
      count.textContent = String(n);
      const ok = ta.value.trim().length > 0 && n <= 500;
      saveBtn.disabled = !ok;
    };
    ta.addEventListener('input', sync);
    sync();
    setTimeout(() => ta.focus(), 0);

    cancelBtn.addEventListener('click', () => {
      wrap.remove();
      p.hidden = false;
      if (actions) actions.style.display = '';
      delete bubble.dataset.editing;
    });

    saveBtn.addEventListener('click', async () => {
      const next = ta.value.trim();
      if (!next || next.length > 500) return;

      saveBtn.disabled = true;
      try {
        await updateDoc(itemRef, { text: next, editedAt: serverTimestamp() });
        p.textContent = next;
      } catch (err) {
        alert('Failed to edit: ' + err.message);
      } finally {
        wrap.remove();
        p.hidden = false;
        if (actions) actions.style.display = '';
        delete bubble.dataset.editing;
      }
    });
  }

  function renderRows(rows) {
    const mode = (sortEl?.value || 'newest');
    const sorted = rows.slice();

    if (mode === 'oldest') {
      sorted.sort((a,b) => a.createdAtMillis - b.createdAtMillis);
    } else if (mode === 'most-liked') {
      // score = likes - dislikes
      sorted.sort((a,b) => (b.score - a.score) || (b.createdAtMillis - a.createdAtMillis));
    } else {
      sorted.sort((a,b) => b.createdAtMillis - a.createdAtMillis);
    }

    listEl.innerHTML = '';
    sorted.forEach(r => listEl.appendChild(r.li));
  }

  const onSortChange = () => {
    renderRows(lastRows);

    // kill the native "stuck hover" look after selecting an option
    sortEl.classList.add('nohover');
    setTimeout(() => sortEl.classList.remove('nohover'), 250);

    // remove focus so focus styles don’t stick either
    setTimeout(() => { try { sortEl.blur(); } catch(_) {} }, 0);
  };

  if (sortEl) sortEl.addEventListener('change', onSortChange);

  const unsubMain = onSnapshot(qref, (snap) => {
    try { subscribeReviews._authorUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    subscribeReviews._authorUnsubs = [];
    try { subscribeReviews._voteUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    subscribeReviews._voteUnsubs = [];
    try { subscribeReviews._threadUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    subscribeReviews._threadUnsubs = [];

    listEl.innerHTML = '';
    let total = 0, n = 0;

    const user = auth.currentUser;
    const rows = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const reviewKey = (typeof d.reviewKey === 'string' && d.reviewKey.trim())
      ? d.reviewKey
      : null;
      const rating = parseFloat(d.rating);

      if (!Number.isNaN(rating)) { total += rating; n++; }

      const createdAtMillis =
        d.createdAt?.toMillis ? d.createdAt.toMillis() :
        (typeof d.createdAt === 'number' ? d.createdAt : Date.now());

      const likesCount    = (typeof d.likesCount === 'number') ? d.likesCount : 0;
      const dislikesCount = (typeof d.dislikesCount === 'number') ? d.dislikesCount : 0;
      const score = likesCount - dislikesCount;

      const li = document.createElement('li');
      li.className = 'review-row';
      li.dataset.id = docSnap.id;

      const avatarHtml = d.photoURL
        ? `<span class="row-avatar avatar"><img src="${escapeHtml(d.photoURL)}" alt=""></span>`
        : `<span class="row-avatar avatar">${(d.displayName||'?').trim().charAt(0).toUpperCase()||'?'}</span>`;

      li.innerHTML = `
        <button type="button" class="row-toggle" aria-expanded="false">
          ${avatarHtml}
          <span class="row-title">${escapeHtml(d.title || '—')}</span>
          <span class="row-rating">${Number.isFinite(rating) ? rating.toFixed(1) : '—'}/10</span>
        </button>

        <div class="row-detail" hidden>
          <div class="row-meta">by <span class="author-name">${escapeHtml(d.displayName || 'User')}</span> · ${timeAgo(toMillis(d.createdAt))}</div>
          <p class="row-body">${nl2br(escapeHtml(stripAccidentalPaste(d.body)))}</p>
         
          <div class="row-actions">
            <div class="review-votes">
              <button type="button" class="vote-btn like" data-action="like" data-id="${docSnap.id}">
                ▲ <span class="vcount">${likesCount}</span>
              </button>
              <button type="button" class="vote-btn dislike" data-action="dislike" data-id="${docSnap.id}">
                ▼ <span class="vcount">${dislikesCount}</span>
              </button>
            </div>

            ${auth.currentUser && auth.currentUser.uid === d.uid ? `
              <button class="action-btn edit" data-action="edit" data-id="${docSnap.id}">Edit</button>
              <button class="action-btn delete" data-action="delete" data-id="${docSnap.id}">Delete</button>
            ` : ''}
          </div>
      `;

      // toggle open/close (preserve open state across live re-renders)
      const toggle = li.querySelector('.row-toggle');
      const detail = li.querySelector('.row-detail');

      // restore if it was open before
      if (openReviewIds.has(docSnap.id)) {
        detail.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      }

      toggle.addEventListener('click', () => {
        const open = !detail.hasAttribute('hidden');

        if (open) {
          detail.setAttribute('hidden','');
          toggle.setAttribute('aria-expanded','false');
          openReviewIds.delete(docSnap.id);
        } else {
          detail.removeAttribute('hidden');
          toggle.setAttribute('aria-expanded','true');
          openReviewIds.add(docSnap.id);
        }
      });

      // ------------------------------
      // REVIEW DISCUSSION (thread comments under this review)
      // Path: reviews/{animeSlug}/items/{reviewDocId}/threads/{threadId}
      // ------------------------------
            const threadHost = document.createElement('section');
      threadHost.className = 'comments-section review-thread';
      threadHost.innerHTML = `
        <div class="comments-header thread-header">
          <h3>Discussion <span class="comments-count thread-pill">0</span></h3>
          <div class="comments-controls">
            <button type="button" class="action-btn thread-toggle" aria-expanded="false">Open</button>
          </div>
        </div>

        <div class="thread-panel" hidden>
          <div class="comment-composer" aria-disabled="true">
            <div class="avatar" aria-hidden="true">&#9733;</div>
            <div class="composer-body">
              <textarea class="thread-input" placeholder="Leave a comment…" maxlength="500"></textarea>
              <div class="composer-actions">
                <span class="char-count"><span class="thread-count">0</span>/500</span>
                <button type="button" class="btn thread-post" disabled>Post</button>
              </div>
            </div>
          </div>
          <ul class="comments-list thread-list"></ul>
        </div>
      `;
      detail.appendChild(threadHost);

      const threadToggle   = threadHost.querySelector('.thread-toggle');
      const threadPill     = threadHost.querySelector('.thread-pill');
      const threadPanel    = threadHost.querySelector('.thread-panel');
      const threadComposer = threadHost.querySelector('.comment-composer');
      const threadInput    = threadHost.querySelector('.thread-input');
      const threadPost     = threadHost.querySelector('.thread-post');
      const threadCount    = threadHost.querySelector('.thread-count');
      const threadList     = threadHost.querySelector('.thread-list');

      // Initial thread count (so the pill is correct even before opening)
(async () => {
  try {
    const baseCol = collection(db, 'reviews', s, 'items', docSnap.id, 'threads');
    const qCount = reviewKey
      ? query(baseCol, where('reviewKey', '==', reviewKey))
      : query(baseCol);

    const cSnap = await getCountFromServer(qCount);
    const data = cSnap.data ? cSnap.data() : null;
    const c = (data && typeof data.count === 'number') ? data.count : 0;
    if (threadPill) threadPill.textContent = String(c);
  } catch (_) {
    // If this fails, the count will still become correct once the thread is opened
  }
})();




      let threadUnsub = null;
      let threadVoteUnsubs = [];
      let threadAuthorUnsubs = [];

            function syncThreadComposer() {
        const u = auth.currentUser;
        const authed = !!u;

        const n = threadInput.value.length;
        const okText = n > 0 && n <= 500 && threadInput.value.trim().length > 0;

        threadCount.textContent = String(n);

        if (!authed) {
          threadInput.readOnly = true;
          threadInput.placeholder = 'Sign in to comment';
          threadPost.textContent = 'Sign in';
          threadPost.disabled = true;
          if (threadComposer) threadComposer.setAttribute('aria-disabled', 'true');
          return;
        }

        threadInput.readOnly = false;
        threadInput.placeholder = 'Leave a comment…';
        threadPost.textContent = 'Post';
        threadPost.disabled = !okText;
        if (threadComposer) threadComposer.setAttribute('aria-disabled', 'false');
      }


      function ensureAuthOrOpen(e) {
        if (!auth.currentUser) {
          e?.preventDefault();
          openAuth('signin');
          return false;
        }
        return true;
      }

      function stopThreadSub() {
        try { threadAuthorUnsubs.forEach(fn => fn && fn()); } catch(_) {}
        threadAuthorUnsubs = [];
        try { threadVoteUnsubs.forEach(fn => fn && fn()); } catch(_) {}
        threadVoteUnsubs = [];
        if (typeof threadUnsub === 'function') {
          try { threadUnsub(); } catch(_) {}
        }
        threadUnsub = null;
      }

      function startThreadSub() {
        if (threadUnsub) return;

        const tRef = query(
          collection(db, 'reviews', s, 'items', docSnap.id, 'threads'),
          orderBy('createdAt', 'asc')
        );

        threadUnsub = onSnapshot(tRef, (tsnap) => {
          try { threadAuthorUnsubs.forEach(fn => fn && fn()); } catch(_) {}
          threadAuthorUnsubs = [];
          try { threadVoteUnsubs.forEach(fn => fn && fn()); } catch(_) {}
          threadVoteUnsubs = [];

          threadList.innerHTML = '';

          const userNow = auth.currentUser;
          let count = 0;

          tsnap.forEach((tDoc) => {
            const td = tDoc.data() || {};
            if (reviewKey && td.reviewKey !== reviewKey) return;
            count++;

            const likesCountT    = (typeof td.likesCount === 'number') ? td.likesCount : 0;
            const dislikesCountT = (typeof td.dislikesCount === 'number') ? td.dislikesCount : 0;

            const item = commentItemEl({
              id: tDoc.id,
              uid: td.uid,
              displayName: td.displayName || 'User',
              photoURL: td.photoURL || null,
              text: td.text || '',
              createdAt: td.createdAt,
              likesCount: likesCountT,
              dislikesCount: dislikesCountT
            });

            // live author profile subscription
            if (td && td.uid) {
              const uref = doc(db, 'users', td.uid);
              const unsubAuthor = onSnapshot(uref, (us) => {
                const u = us.data(); if (!u) return;

                const nameEl = item.querySelector('.name');
                if (nameEl && u.username && nameEl.textContent !== u.username) {
                  nameEl.textContent = u.username;
                }

                const av = item.querySelector('.avatar');
                if (av) {
                  if (u.photoURL) {
                    av.innerHTML = `<img src="${escapeHtml(u.photoURL)}" alt="">`;
                  } else {
                    const initial = (u.username || td.displayName || '?').toString().trim().charAt(0).toUpperCase() || '?';
                    av.textContent = initial;
                  }
                }
              });
              threadAuthorUnsubs.push(unsubAuthor);
            }

            // live vote state (current user only)
            setVoteUI(item, 0);
            if (userNow && userNow.uid) {
              const vref = doc(db, 'reviews', s, 'items', docSnap.id, 'threads', tDoc.id, 'votes', userNow.uid);
              const unsubVote = onSnapshot(vref, (vs) => {
                const val = (vs.exists() && typeof vs.data()?.value === 'number') ? vs.data().value : 0;
                setVoteUI(item, val);
              });
              threadVoteUnsubs.push(unsubVote);
            }

            threadList.appendChild(item);
          });

          if (threadPill) threadPill.textContent = String(count);
        });
      }

      // toggle Discussion panel
      function setThreadOpen(open) {
        if (!threadPanel || !threadToggle) return;
        if (open) {
          threadPanel.removeAttribute('hidden');
          threadToggle.setAttribute('aria-expanded', 'true');
          threadToggle.textContent = 'Close';
          openThreadIds.add(docSnap.id);
          syncThreadComposer();
          startThreadSub();
        } else {
          threadPanel.setAttribute('hidden','');
          threadToggle.setAttribute('aria-expanded', 'false');
          threadToggle.textContent = 'Open';
          openThreadIds.delete(docSnap.id);
          stopThreadSub();
        }
      }

      // restore thread open state
      if (openThreadIds.has(docSnap.id)) {
        setThreadOpen(true);
      } else {
        setThreadOpen(false);
      }

      threadToggle?.addEventListener('click', () => {
        const open = !threadPanel.hasAttribute('hidden');
        setThreadOpen(!open);
      });

      // composer wiring
      threadInput?.addEventListener('focus', (e) => {
        if (!ensureAuthOrOpen(e)) return;
        syncThreadComposer();
      });
      threadInput?.addEventListener('input', () => {
        syncThreadComposer();
      });
      syncThreadComposer();

      let posting = false;

      threadPost?.addEventListener('click', async (e) => {
        if (!ensureAuthOrOpen(e)) return;
        if (posting) return;
        if (!canPostNow()) { alert('Easy there—please wait a moment before posting again.'); return; }

        const u = auth.currentUser;
        if (!u) return;

        const text = threadInput.value.trim();
        if (!text || text.length > 500) return;

        const displayName = u.displayName || (u.email ? u.email.split('@')[0] : 'User');
        const photoURL = u.photoURL || null;

        const itemsRef = collection(db, 'reviews', s, 'items', docSnap.id, 'threads');

        // optimistic row (append, because this list is oldest -> newest)
        const pending = commentItemEl({
          id: `pending-${Date.now()}`,
          uid: u.uid,
          displayName,
          photoURL,
          text,
          createdAt: Date.now(),
          likesCount: 0,
          dislikesCount: 0
        });
        pending.classList.add('is-pending');
        threadList.appendChild(pending);

        posting = true;
        threadPost.disabled = true;

        try {
          const payload = {
            uid: u.uid,
            displayName,
            photoURL,
            text: stripAccidentalPaste(text),
            createdAt: serverTimestamp(),
            likesCount: 0,
            dislikesCount: 0
          };

          if (reviewKey) payload.reviewKey = reviewKey;


          await addDoc(itemsRef, payload);
          markPostedNow();
          threadInput.value = '';
        } catch (err) {
          pending.remove();
          alert('Failed to post: ' + err.message);
        } finally {
          posting = false;
          syncThreadComposer();
        }
      });

      // actions inside thread list
      threadList?.addEventListener('click', async (e) => {
          e.stopPropagation();
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        if (!ensureAuthOrOpen(e)) return;

        const tid = btn.dataset.id;
        const action = btn.dataset.action;
        if (!tid) return;

        // block actions on optimistic items
        if (tid.startsWith('pending-')) return;

        const threadRef = doc(db, 'reviews', s, 'items', docSnap.id, 'threads', tid);

        if (action === 'like' || action === 'dislike') {
          const voteRef = doc(db, 'reviews', s, 'items', docSnap.id, 'threads', tid, 'votes', auth.currentUser.uid);

          try {
            await runTransaction(db, async (tx) => {
              const cSnap = await tx.get(threadRef);
              if (!cSnap.exists()) return;

              const vSnap = await tx.get(voteRef);
              const c = cSnap.data() || {};
              const prev = vSnap.exists() ? (vSnap.data()?.value || 0) : 0;

              let next = 0;
              if (action === 'like') next = (prev === 1) ? 0 : 1;
              if (action === 'dislike') next = (prev === -1) ? 0 : -1;

              let likes = (typeof c.likesCount === 'number') ? c.likesCount : 0;
              let dislikes = (typeof c.dislikesCount === 'number') ? c.dislikesCount : 0;

              if (prev === 1) likes--;
              if (prev === -1) dislikes--;
              if (next === 1) likes++;
              if (next === -1) dislikes++;

              if (likes < 0) likes = 0;
              if (dislikes < 0) dislikes = 0;

              tx.update(threadRef, { likesCount: likes, dislikesCount: dislikes });

              // NO notifications for thread votes (per your spec)
              if (next === 0) {
                if (vSnap.exists()) tx.delete(voteRef);
              } else {
                tx.set(voteRef, { uid: auth.currentUser.uid, value: next, updatedAt: serverTimestamp() }, { merge: true });
              }
            });
          } catch (err) {
            alert('Vote failed: ' + err.message);
          }
          return;
        }

        if (action === 'delete') {
          const ok = await confirmDialog({
            title: 'Delete comment?',
            message: 'This will permanently remove this comment.',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true
          });
          if (ok) await deleteDoc(threadRef);
          return;
        }

        if (action === 'edit') {
          openInlineThreadEditor(btn, threadRef);
          return;
        }
      });

      // make sure we cleanup this row's thread listeners on re-render/unmount
      subscribeReviews._threadUnsubs.push(() => {
        stopThreadSub();
      });

      // live author profile subscription
      if (d && d.uid) {
        const uref = doc(db, 'users', d.uid);
        const unsubAuthor = onSnapshot(uref, (us) => {
          const u = us.data(); if (!u) return;

          const nameEl = li.querySelector('.author-name');
          if (nameEl && u.username && nameEl.textContent !== u.username) {
            nameEl.textContent = u.username;
          }

          const av = li.querySelector('.row-avatar');
          if (av) {
            if (u.photoURL) av.innerHTML = `<img src="${escapeHtml(u.photoURL)}" alt="">`;
            else av.textContent = (u.username || d.displayName || '?').toString().trim().charAt(0).toUpperCase() || '?';
          }
        });
        subscribeReviews._authorUnsubs.push(unsubAuthor);
      }

      // live vote state for current user
      setReviewVoteUI(li, 0);
      if (user && user.uid) {
        const vref = doc(db, 'reviews', s, 'items', docSnap.id, 'votes', user.uid);
        const unsubVote = onSnapshot(vref, (vs) => {
          const val = (vs.exists() && typeof vs.data()?.value === 'number') ? vs.data().value : 0;
          setReviewVoteUI(li, val);
        });
        subscribeReviews._voteUnsubs.push(unsubVote);
      }

      rows.push({ li, createdAtMillis, score });
    });

    lastRows = rows;
    renderRows(lastRows);

    avgEl.textContent = n ? (total / n).toFixed(1) : '—';
    countEl.textContent = `(${n})`;
    avgEl?.parentElement?.classList.toggle('has-value', n > 0);
  });

  return () => {
    try { unsubMain(); } catch(_) {}
    try { sortEl?.removeEventListener('change', onSortChange); } catch(_) {}
    try { subscribeReviews._authorUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    try { subscribeReviews._voteUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    try { subscribeReviews._threadUnsubs.forEach(fn => fn && fn()); } catch(_) {}
    subscribeReviews._authorUnsubs = [];
    subscribeReviews._voteUnsubs = [];
    subscribeReviews._threadUnsubs = [];
  };
}




function wireCommunity(anime) {
  const s = animeSlug(anime);
  const form    = document.getElementById(`rev-form-${s}`);
  const titleEl = document.getElementById(`rev-title-${s}`);
  const rateEl  = document.getElementById(`rev-rating-${s}`);
  const bodyEl  = document.getElementById(`rev-body-${s}`);
  const cntEl   = document.getElementById(`rev-count-${s}`);
  const pubBtn  = document.getElementById(`rev-publish-${s}`);
  const hintEl  = document.getElementById(`rev-hint-${s}`);
  const listEl  = document.getElementById(`comm-list-${s}`);
  if (!form || !titleEl || !rateEl || !bodyEl || !cntEl || !pubBtn || !listEl) return () => {};

  // ----- pretty stepper wiring -----
  const wrap   = form.querySelector('.number-wrap');
  const incBtn = wrap?.querySelector('.step.inc');
  const decBtn = wrap?.querySelector('.step.dec');

  const clamp = (v) => Math.min(10, Math.max(1, Math.round(v * 10) / 10));
  function bump(delta) {
    const x = parseFloat(rateEl.value);
    const base = Number.isFinite(x) ? x : 5;
    rateEl.value = clamp(base + delta).toFixed(1);
    sync();
  }
  incBtn?.addEventListener('click', () => bump(+0.1));
  decBtn?.addEventListener('click', () => bump(-0.1));
  // ----- end stepper wiring -----

  let myReviewUnsub = null; // live check for "already posted"
  let hasMyReview = false;

  function setLockedState(hasOne) {
    hasMyReview = !!hasOne;
    if (hasMyReview) {
      titleEl.readOnly = rateEl.readOnly = bodyEl.readOnly = true;
      pubBtn.disabled = true;
      pubBtn.textContent = 'You already posted';
      hintEl.style.display = '';
      hintEl.textContent = 'You have already posted a review for this anime. You can edit or delete it below.';
    } else {
      hintEl.style.display = 'none';
      pubBtn.textContent = 'Publish';
      titleEl.readOnly = rateEl.readOnly = bodyEl.readOnly = false;
      sync(); // re-evaluate enabled state
    }
  }

  function sync() {
    const u = auth.currentUser;
    const authed = !!u;

    if (!authed) {
      hintEl.style.display = '';
      hintEl.textContent = 'Sign in to post a review.';
      titleEl.readOnly = rateEl.readOnly = bodyEl.readOnly = true;
      pubBtn.disabled = true;
    } else if (!hasMyReview) {
      hintEl.style.display = 'none';
      titleEl.readOnly = rateEl.readOnly = bodyEl.readOnly = false;

      const titleOk = titleEl.value.trim().length >= 3;
      const r = parseFloat(rateEl.value);
      const ratingOk = Number.isFinite(r) && r >= 1 && r <= 10;
      const bodyLen = bodyEl.value.trim().length;
      const bodyOk = bodyLen >= 20 && bodyLen <= 2000;

      cntEl.textContent = String(bodyEl.value.length);
      pubBtn.disabled = !(authed && titleOk && ratingOk && bodyOk);
    }

    // keep the counter accurate even when locked
    cntEl.textContent = String(bodyEl.value.length);
  }

  ['input','change'].forEach(evt => {
    titleEl.addEventListener(evt, sync);
    rateEl.addEventListener(evt, sync);
    bodyEl.addEventListener(evt, sync);
  });
  onAuthStateChanged(auth, (u) => {
    // (re)subscribe to "my review" doc
    if (myReviewUnsub) { try { myReviewUnsub(); } catch(_){} myReviewUnsub = null; }
    if (u) {
      // listen for a doc where uid == me (limit 1)
      const qref = query(collection(db, 'reviews', s, 'items'), where('uid','==',u.uid), limit(1));
      myReviewUnsub = onSnapshot(qref, (snap) => {
        setLockedState(!snap.empty);
      });
    } else {
      setLockedState(false);
    }
    sync();
  });
  sync();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.currentUser) { openAuth('signin'); return; }
    if (hasMyReview) return; // extra guard

    const data = {
  uid: auth.currentUser.uid,
  displayName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
  title: stripAccidentalPaste(titleEl.value).trim(),
  rating: clamp(parseFloat(rateEl.value || '')),
  body: stripAccidentalPaste(bodyEl.value).trim(),

  // IMPORTANT: ties discussion comments to this specific "version" of the review
  reviewKey: (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  likesCount: 0,
  dislikesCount: 0,
};

const purl = auth.currentUser.photoURL;
if (purl) data.photoURL = purl;

    if (!data.title || !data.body || !Number.isFinite(data.rating) || data.rating < 1 || data.rating > 10) return;

    pubBtn.disabled = true;
    try {
      // ONE-PER-USER: write to doc id = uid (upserts only their slot)
      await setDoc(doc(db, 'reviews', s, 'items', auth.currentUser.uid), data);
      titleEl.value = ''; rateEl.value = ''; bodyEl.value = '';
    } catch (err) {
      alert('Failed to publish: ' + err.message);
    } finally {
      sync();
    }
  });

  // Author actions already work; doc id will be the uid now.
  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (!auth.currentUser) return;
      // IMPORTANT: thread (discussion comment) buttons live inside the review row,
    // but they should NOT trigger review edit/delete logic.
    if (btn.closest('.review-thread')) return;


    const id  = btn.dataset.id;
    const ref = doc(db, 'reviews', s, 'items', id);
    const action = btn.dataset.action;

if (action === 'like' || action === 'dislike') {
  if (!auth.currentUser) { openAuth('signin'); return; }

  const reviewRef = doc(db, 'reviews', s, 'items', id);
  const voteRef   = doc(db, 'reviews', s, 'items', id, 'votes', auth.currentUser.uid);

  try {
    await runTransaction(db, async (tx) => {
      const rSnap = await tx.get(reviewRef);
      if (!rSnap.exists()) return;

      const vSnap = await tx.get(voteRef);
      const prev = vSnap.exists() ? (vSnap.data()?.value || 0) : 0;

      let next = 0;
      if (action === 'like') next = (prev === 1) ? 0 : 1;
      if (action === 'dislike') next = (prev === -1) ? 0 : -1;

      const r = rSnap.data() || {};
      let likes = (typeof r.likesCount === 'number') ? r.likesCount : 0;
      let dislikes = (typeof r.dislikesCount === 'number') ? r.dislikesCount : 0;

      if (prev === 1) likes--;
      if (prev === -1) dislikes--;

      if (next === 1) likes++;
      if (next === -1) dislikes++;

      if (likes < 0) likes = 0;
      if (dislikes < 0) dislikes = 0;

      tx.update(reviewRef, { likesCount: likes, dislikesCount: dislikes });
      // create notification for review owner (no self-notify, no unvote notify)
const authorUid = r.uid;
if (next !== 0 && authorUid && authorUid !== auth.currentUser.uid) {
  const me = auth.currentUser;
  const notifRef = doc(collection(db, 'users', authorUid, 'notifications'));

  tx.set(notifRef, {
    toUid: authorUid,
    fromUid: me.uid,
    fromDisplayName: me.displayName || (me.email ? me.email.split('@')[0] : 'Someone'),
    fromPhotoURL: me.photoURL || null,
    type: 'review_vote',
    value: next,             // 1 = like, -1 = dislike
    animeId: s,              // slug
    animeTitle: anime.Title || '',
    targetId: id,            // review docId (author uid)
    createdAt: serverTimestamp()
  });
}


      if (next === 0) {
        if (vSnap.exists()) tx.delete(voteRef);
      } else {
        tx.set(voteRef, { uid: auth.currentUser.uid, value: next, updatedAt: serverTimestamp() }, { merge: true });
      }
    });
  } catch (err) {
    alert('Vote failed: ' + err.message);
  }
  return;
}


    if (btn.dataset.action === 'delete') {
  const ok = await confirmDialog({
    title: 'Delete review?',
    message: 'This will permanently remove your review.',
    okText: 'Delete',
    cancelText: 'Cancel',
    danger: true
  });

  if (ok) {
    await deleteDoc(ref);
  }

} else if (btn.dataset.action === 'edit') {
  const row = btn.closest('.review-row');
  if (!row) return;

  // open the row if it's closed
  const toggle = row.querySelector('.row-toggle');
  const detail = row.querySelector('.row-detail');
  if (detail && detail.hasAttribute('hidden')) {
    detail.removeAttribute('hidden');
    toggle?.setAttribute('aria-expanded', 'true');
  }

  // close any other open review editor
  document.querySelectorAll('.review-edit-form').forEach((f) => {
    const r = f.closest('.review-row');
    const body = r?.querySelector('.row-body');
    if (body) body.hidden = false;
    f.remove();
    r?.classList.remove('is-editing');
  });

  if (row.querySelector('.review-edit-form')) return;

  const titleSpan = row.querySelector('.row-title');
  const ratingSpan = row.querySelector('.row-rating');
  const bodyP = row.querySelector('.row-body');

  const currentTitle = (titleSpan?.textContent || '').trim();
  const currentRating = parseFloat(((ratingSpan?.textContent || '').split('/')[0] || '').trim());
  const currentBody = (bodyP?.textContent || '').trim();

  if (bodyP) bodyP.hidden = true;
  row.classList.add('is-editing');

  const form = document.createElement('div');
  form.className = 'review-edit-form';
  form.innerHTML = `
    <input type="text" class="review-edit-title" maxlength="80" placeholder="Edit title">
    <input type="text" class="review-edit-rating" inputmode="decimal" placeholder="Rating 1-10">
    <textarea class="review-edit-body" maxlength="2000" placeholder="Edit your review…"></textarea>
    <div class="review-edit-actions">
      <span class="char-count"><span class="review-edit-count">0</span>/2000</span>
      <div class="inline-buttons">
        <button type="button" class="action-btn cancel">Cancel</button>
        <button type="button" class="action-btn save">Save</button>
      </div>
    </div>
  `;

  const metaEl = detail?.querySelector('.row-meta');
  if (metaEl) metaEl.insertAdjacentElement('afterend', form);
  else detail?.prepend(form);

  const tIn = form.querySelector('.review-edit-title');
  const rIn = form.querySelector('.review-edit-rating');
  const bIn = form.querySelector('.review-edit-body');
  const count = form.querySelector('.review-edit-count');
  const saveBtn = form.querySelector('.action-btn.save');
  const cancelBtn = form.querySelector('.action-btn.cancel');

  tIn.value = currentTitle;
  rIn.value = Number.isFinite(currentRating) ? currentRating.toFixed(1) : '5.0';
  bIn.value = currentBody;

  const sync = () => {
    count.textContent = String(bIn.value.length);

    const titleOk = tIn.value.trim().length >= 3;
    const r = parseFloat(rIn.value);
    const ratingOk = Number.isFinite(r) && r >= 1 && r <= 10;
    const bodyOk = bIn.value.trim().length > 0;

    saveBtn.disabled = !(titleOk && ratingOk && bodyOk);
  };

  tIn.addEventListener('input', sync);
  rIn.addEventListener('input', sync);
  bIn.addEventListener('input', sync);
  sync();

  cancelBtn.addEventListener('click', () => {
    form.remove();
    if (bodyP) bodyP.hidden = false;
    row.classList.remove('is-editing');
  });

  saveBtn.addEventListener('click', async () => {
    const title = tIn.value.trim();
    const rRaw = parseFloat(rIn.value);
    const rating = clamp(rRaw);
    const body = bIn.value.trim();

    if (!title || !body || !Number.isFinite(rating) || rating < 1 || rating > 10) return;

    saveBtn.disabled = true;
    try {
      await updateDoc(ref, { title, rating, body, updatedAt: serverTimestamp() });

      // immediate UI update (snapshot will also refresh)
      if (titleSpan) titleSpan.textContent = title;
      if (ratingSpan) ratingSpan.textContent = `${rating.toFixed(1)}/10`;
      if (bodyP) bodyP.innerHTML = nl2br(escapeHtml(stripAccidentalPaste(body)));
    } catch (err) {
      alert('Failed to edit: ' + err.message);
    } finally {
      form.remove();
      if (bodyP) bodyP.hidden = false;
      row.classList.remove('is-editing');
    }
  });

  setTimeout(() => tIn.focus(), 0);
}

  });

  // Live updates
  return subscribeReviews(anime);
}

function wireOfficialVotes(anime) {
  const s = animeSlug(anime);
  const host = document.getElementById(`official-votes-${s}`);
  if (!host) return () => {};

  const likeBtn = host.querySelector('.vote-btn.like');
  const disBtn  = host.querySelector('.vote-btn.dislike');

  const likeCountEl = likeBtn ? likeBtn.querySelector('.vcount') : null;
  const disCountEl  = disBtn  ? disBtn.querySelector('.vcount')  : null;

  const aggRef = doc(db, 'official', s);

  let myVal = 0;
  let unsubAgg = null;
  let unsubVote = null;
  let unsubAuth = null;

  function setMyUI() {
    if (likeBtn) likeBtn.classList.toggle('active', myVal === 1);
    if (disBtn)  disBtn.classList.toggle('active', myVal === -1);
  }

  // live aggregate counts
  unsubAgg = onSnapshot(aggRef, (snap) => {
    const d = snap.exists() ? (snap.data() || {}) : {};
    const likes = (typeof d.likesCount === 'number') ? d.likesCount : 0;
    const dislikes = (typeof d.dislikesCount === 'number') ? d.dislikesCount : 0;

    if (likeCountEl) likeCountEl.textContent = String(likes);
    if (disCountEl)  disCountEl.textContent  = String(dislikes);
  }, (err) => {
    console.warn('Official votes read failed:', err);
  });

  function resubVote() {
    if (unsubVote) { try { unsubVote(); } catch(_) {} unsubVote = null; }
    myVal = 0;
    setMyUI();

    const u = auth.currentUser;
    if (!u) return;

    const vRef = doc(db, 'official', s, 'votes', u.uid);
    unsubVote = onSnapshot(vRef, (vs) => {
      myVal = (vs.exists() && typeof vs.data()?.value === 'number') ? vs.data().value : 0;
      setMyUI();
    });
  }

  unsubAuth = onAuthStateChanged(auth, () => { resubVote(); });
  resubVote();

  async function doVote(action, e) {
    e?.preventDefault();
    e?.stopPropagation();

    if (!auth.currentUser) {
      jiggle(host);
      openAuth('signin');
      return;
    }

    const u = auth.currentUser;
    const voteRef = doc(db, 'official', s, 'votes', u.uid);

    try {
      await runTransaction(db, async (tx) => {
        const aSnap = await tx.get(aggRef);
        const vSnap = await tx.get(voteRef);

        const a = aSnap.exists() ? (aSnap.data() || {}) : {};
        const prev = vSnap.exists() ? (vSnap.data()?.value || 0) : 0;

        let next = 0;
        if (action === 'like') next = (prev === 1) ? 0 : 1;
        if (action === 'dislike') next = (prev === -1) ? 0 : -1;

        let likes = (typeof a.likesCount === 'number') ? a.likesCount : 0;
        let dislikes = (typeof a.dislikesCount === 'number') ? a.dislikesCount : 0;

        if (prev === 1) likes--;
        if (prev === -1) dislikes--;
        if (next === 1) likes++;
        if (next === -1) dislikes++;

        if (likes < 0) likes = 0;
        if (dislikes < 0) dislikes = 0;

        tx.set(aggRef, {
          animeId: s,
          likesCount: likes,
          dislikesCount: dislikes,
          updatedAt: serverTimestamp()
        }, { merge: true });

        if (next === 0) {
          if (vSnap.exists()) tx.delete(voteRef);
        } else {
          tx.set(voteRef, {
            uid: u.uid,
            value: next,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      });
    } catch (err) {
      alert('Vote failed: ' + err.message);
    }
  }

  const onLike = (e) => doVote('like', e);
  const onDis  = (e) => doVote('dislike', e);

  likeBtn?.addEventListener('click', onLike);
  disBtn?.addEventListener('click', onDis);

  return () => {
    try { likeBtn?.removeEventListener('click', onLike); } catch(_) {}
    try { disBtn?.removeEventListener('click', onDis); } catch(_) {}
    if (unsubAgg) { try { unsubAgg(); } catch(_) {} }
    if (unsubVote) { try { unsubVote(); } catch(_) {} }
    if (unsubAuth) { try { unsubAuth(); } catch(_) {} }
  };
}


 // ---------- MODAL ----------
function openModal(anime) {
  // Prevent background spotlight motion while modal is open.
  stopSpotlightCycle();
  isSpotlightHovered = false;

  const tags = safeArray(anime.Tags);
  const platforms = safeArray(anime.Platforms)
    .flatMap((p) => String(p || "").split(/[,\uFF0C\u3001;|/\\\n\r]+/))
    .map((p) => p.trim())
    .filter(Boolean);
  const trailerSrc = toYouTubeEmbedSrc(anime.Trailer);

  const seasonsVal =
    anime.Seasons ?? anime.seasons ?? anime.Season ?? anime.season ?? null;

  const ratingHtml =
    '<p class="meta-line rating-line"><strong>Rating:</strong> <span class="rating-badge">' +
    (anime.Rating || '') +
    '</span></p>';

  const genreHtml =
  '<p class="meta-line"><strong>Genre:</strong> <span class="genre-chip">' +
  (anime.Genre || '') +
  '</span></p>';
  const seasonsHtml = seasonsVal
    ? '<p class="meta-line seasons-line"><strong>Seasons:</strong> <span class="season-chip">' +
      seasonsVal + '</span></p>'
    : '';

  const studioHtml = anime.Studio
    ? '<p class="meta-line studio-line"><strong>Studio:</strong> <span class="studio-name">' +
      anime.Studio + '</span></p>'
    : '';

  const tagsHtml = tags.length
    ? '<p class="meta-line"><strong>Tags:</strong> ' +
      tags.map((t) => '<span class="tag">' + t + '</span>').join(' ') +
      '</p>'
    : '';

  const platformsHtml = platforms.length
    ? '<p class="meta-line platforms-line"><strong>Platforms:</strong> <span class="platforms-text">' +
      platforms
        .map((p) => '<span class="platform-chip">' + escapeHtml(String(p)) + '</span>')
        .join('') +
      '</span></p>'
    : '';

  const trailerBlock = trailerSrc
    ? '<div class="trailer-container"><iframe src="' +
      trailerSrc +
      '" title="Trailer for ' + escapeHtml(anime.Title) +
      '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'
    : '';

  const descBlock = anime.Description
    ? '<div class="modal-description"><p><strong>Description:</strong></p><p>' +
      anime.Description + '</p></div>'
    : '';

  const reviewBlock = anime.Review
    ? '<div class="modal-review"><p><strong>Review:</strong></p><p>' +
      anime.Review + '</p></div>'
    : '';

  // LEFT sheet markup (details + comments)
  const leftHTML =
    '<span class="close-button" aria-label="Close">&times;</span>' +
    trailerBlock +
    '<h2 class="modal-title">' + anime.Title + '</h2>' +
    officialVotesMarkup(anime) +
    '<div class="modal-meta">' +
    ratingHtml + genreHtml + seasonsHtml + studioHtml + tagsHtml + platformsHtml +
    '</div>' +
    descBlock + reviewBlock +
    commentsMarkup(anime);

  // RIGHT sheet markup (community)
  const rightHTML = communityMarkup(anime);

  // Build duo stage
  modal.classList.add('duo');
  modalContent.innerHTML =
    // v1.6.8 — More Info container (collapsed tab + expanded panel)
    '<div class="more-info-container" data-state="collapsed">' +
      '<button class="more-info-tab" type="button" aria-label="Show more anime information">' +
        '<span class="more-info-tab-icon">▶</span>' +
        '<span class="more-info-tab-label">Click for More Info</span>' +
      '</button>' +
      '<aside class="more-info-panel" aria-hidden="true">' +
        '<button class="more-info-close" type="button" aria-label="Close more info panel">×</button>' +
        '<div class="more-info-header">' +
          '<h3 class="more-info-title">MORE INFO</h3>' +
          '<span class="jp-mini">詳細情報</span>' +
        '</div>' +
        '<div class="more-info-content"></div>' +
      '</aside>' +
    '</div>' +
    '<div class="sheet sheet--left">' + leftHTML + '</div>' +
    '<aside class="sheet sheet--right">' + rightHTML + '</aside>';

  // Safety normalizer: if platforms ever render as one comma-joined string,
  // convert them to individual chips so wrapping never "cuts" a pill.
  const platformsEl = modalContent.querySelector('.platforms-text');
  if (platformsEl && !platformsEl.querySelector('.platform-chip')) {
    const raw = (platformsEl.textContent || '').trim();
    if (raw) {
      const chips = raw
        .split(/[,\uFF0C\u3001;|/\\\n\r]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => `<span class="platform-chip">${escapeHtml(s)}</span>`)
        .join('');
      platformsEl.innerHTML = chips;
    }
  }

  // show stage
  overlay.classList.add('active');
  modal.classList.add('active');
  updateScrollLock();

  // v1.6.8 — More Info panel wiring: tab opens + fetches, X closes, card-click navigates
  const moreInfoContainer = modalContent.querySelector('.more-info-container');
  const moreInfoTab = moreInfoContainer.querySelector('.more-info-tab');
  const moreInfoPanel = moreInfoContainer.querySelector('.more-info-panel');
  const moreInfoContent = moreInfoContainer.querySelector('.more-info-content');
  const moreInfoClose = moreInfoContainer.querySelector('.more-info-close');

  moreInfoTab.addEventListener('click', async () => {
    moreInfoContainer.setAttribute('data-state', 'expanded');
    moreInfoPanel.setAttribute('aria-hidden', 'false');
    moreInfoContent.innerHTML = renderMoreInfoPanel('loading', anime);

    const result = await fetchRelationsForModal(anime);
    // Visitor may have collapsed during the fetch — re-check state before injecting.
    if (moreInfoContainer.getAttribute('data-state') !== 'expanded') return;
    const hasContent = (result.edges && result.edges.length > 0) || !!result.sourceId;
    const state = hasContent ? 'success' : 'empty';
    moreInfoContent.innerHTML = renderMoreInfoPanel(state, anime, result);
  });

  moreInfoClose.addEventListener('click', () => {
    moreInfoContainer.setAttribute('data-state', 'collapsed');
    moreInfoPanel.setAttribute('aria-hidden', 'true');
  });

  moreInfoContent.addEventListener('click', (e) => {
    const card = e.target.closest('.more-info-entry--clickable');
    if (!card) return;
    const anilistId = card.dataset.anilistId;
    if (!anilistId) return;
    window.open(`https://anilist.co/anime/${anilistId}/`, '_blank', 'noopener');
  });

  // wire close buttons in both sheets
  modal.querySelectorAll('.sheet .close-button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  });

  // (re)wire live comments
  if (typeof activeCommentsUnsub === 'function') {
    try { activeCommentsUnsub(); } catch (_) {}
    activeCommentsUnsub = null;
  }
  activeCommentsUnsub = wireComments(anime);

  // (re)wire community reviews
  if (typeof activeReviewsUnsub === 'function') {
    try { activeReviewsUnsub(); } catch (_) {}
    activeReviewsUnsub = null;
  }
  activeReviewsUnsub = wireCommunity(anime);
  if (typeof activeOfficialUnsub === 'function') {
  try { activeOfficialUnsub(); } catch (_) {}
  activeOfficialUnsub = null;
}
activeOfficialUnsub = wireOfficialVotes(anime);
}

function closeModal() {
  overlay.classList.remove('active');
  modal.classList.remove('active');
  modal.classList.remove('duo');
  updateScrollLock();
  isSpotlightHovered = false;

  // clear contents to avoid lingering listeners
  modalContent.innerHTML = '';

  // unsubscribe live listeners
  if (typeof activeCommentsUnsub === 'function') {
    try { activeCommentsUnsub(); } catch (_) {}
    activeCommentsUnsub = null;
  }
  if (typeof activeReviewsUnsub === 'function') {
    try { activeReviewsUnsub(); } catch (_) {}
    activeReviewsUnsub = null;
  }
  if (typeof activeOfficialUnsub === 'function') {
    try { activeOfficialUnsub(); } catch (_) {}
    activeOfficialUnsub = null;
  }

  // Ensure Top 10 auto-cycle resumes after closing modal on Home view.
  if (SHOULD_CYCLE && top10Count > 1 && homeView.style.display !== "none") {
    startSpotlightCycle();
  }
}


// keep these listeners
overlay.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target.classList.contains('close-button')) closeModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeAuth();
  }
});
  function avatarHTML(url, name) {
    if (url) return `<img src="${escapeHtml(url)}" alt="">`;
    const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return letter;
  }
  // --- Preset avatars for the Profile modal (pick any filenames you add in /assets/avatars) ---
const AVATAR_CHOICES = [
  'assets/avatars/avatar-01.png',
  'assets/avatars/avatar-02.png',
  'assets/avatars/avatar-03.png',
  'assets/avatars/avatar-04.png',
  'assets/avatars/avatar-05.png',
  'assets/avatars/avatar-06.png',
  'assets/avatars/avatar-07.png',
  'assets/avatars/avatar-08.png',
  'assets/avatars/avatar-09.png',
  'assets/avatars/avatar-10.png',
  'assets/avatars/avatar-11.png',
  'assets/avatars/avatar-12.png'
];


function renderAvatarGridIntoModal(gridEl, currentUrl){
  if (!gridEl) return;              // safe if modal doesn't include the grid
  gridEl.innerHTML = '';
  AVATAR_CHOICES.forEach(src => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'avatar-option' + (currentUrl === src ? ' is-selected' : '');
    b.innerHTML = `<img src="${src}" alt="">`;
    b.addEventListener('click', () => {
      [...gridEl.children].forEach(c => c.classList.remove('is-selected'));
      b.classList.add('is-selected');
      profPhoto.value = src;                        // reuse your existing avatar URL input
      profAvatarPrev.innerHTML = avatarHTML(src, profName.value);
    });
    gridEl.appendChild(b);
  });
}


  function openProfile() {
    const u = auth.currentUser;
    if (!u) { openAuth('signin'); return; }

    profErr.textContent = '';
    profOK.style.display = 'none';

    profEmail.value = u.email || '';
    profName.value  = u.displayName || (u.email ? u.email.split('@')[0] : '');
    profPhoto.value = u.photoURL || '';

    emailVerifyMsg.textContent = (u.emailVerified ? 'Email verified' : 'Email not verified');
    emailVerifyMsg.style.color = u.emailVerified ? '#b7ffbf' : '#ffdf96';

    profAvatarPrev.innerHTML = avatarHTML(u.photoURL, profName.value);
     const gridModal = document.getElementById('preset-avatars-modal');
    renderAvatarGridIntoModal(gridModal, u.photoURL || '');
    
    profileOverlay.classList.add('active');
    profileModal.classList.add('active');
    updateScrollLock();
  }

  function closeProfile() {
    profileOverlay.classList.remove('active');
    profileModal.classList.remove('active');
    updateScrollLock();
  }

  // overlay & X button close
  profileOverlay?.addEventListener('click', closeProfile);
  profileModal?.querySelector('.close-button')?.addEventListener('click', (e) => {
    e.preventDefault(); closeProfile();
  });

  // live avatar preview
  profName?.addEventListener('input', () => {
    if (!profPhoto.value.trim()) profAvatarPrev.innerHTML = avatarHTML('', profName.value);
  });
  profPhoto?.addEventListener('input', () => {
    const url = profPhoto.value.trim();
    profAvatarPrev.innerHTML = avatarHTML(url || '', profName.value);
  });

  // Save handler
  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    profErr.textContent = '';
    profOK.style.display = 'none';

    const u = auth.currentUser;
    if (!u) { openAuth('signin'); return; }

    const name  = profName.value.trim();
    const photo = profPhoto.value.trim();

    if (name.length < 1 || name.length > 40) {
      profErr.textContent = 'Display name must be 1–40 characters.'; return;
    }
    if (photo && !/^https?:\/\//i.test(photo)) {
      profErr.textContent = 'Avatar must be a valid http(s) URL.'; return;
    }

    profSaveBtn.disabled = true;
    try {
      // 1) Auth profile
      await updateProfile(u, { displayName: name, photoURL: photo || null });

      // 2) Mirror into users/{uid} for future features
      await setDoc(doc(db, 'users', u.uid), {
        username: name,
        photoURL: photo || null
      }, { merge: true });

      profOK.style.display = '';
      // reflect new avatar immediately
      profAvatarPrev.innerHTML = avatarHTML(photo, name);
    } catch (err) {
      profErr.textContent = err.message || String(err);
    } finally {
      profSaveBtn.disabled = false;
    }
  });

  // ESC closes it (add to your existing keydown)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfile();
  });


  // ---------- VIEWS ----------
  function currentQuery() {
    return (searchInput?.value || "").trim();
  }

  function rerenderAll() {
    const f = readFilters();
    let base = (animeData || []).filter((a) => matchesFilters(a, f));
    const q = currentQuery();
    if (q) base = base.filter((a) => matchesSearch(a, q));

    if (!base.length) {
      cardContainer.innerHTML = "";
      const msg = document.createElement("div");
      msg.className = "empty-msg";
      msg.textContent = q
        ? `No results for "${q}" with current filters.`
        : `No matches for current filters.`;
      cardContainer.appendChild(msg);
      return;
    }
    renderGrid(shuffle(base));
  }

  function showHome() {
    homeView.style.display = "block";
    allView.style.display = "none";
    if (SHOULD_CYCLE && top10Count > 1 && !spotlightTimer && !isSpotlightHovered) {
      startSpotlightCycle();
    }
    showGenreRails();
  }

  function showAll() {
    filterPanel?.classList.remove('open');
    document.body.classList.remove('filter-open');

    homeView.style.display = "none";
    allView.style.display = "block";

    stopSpotlightCycle();
    hideGenreRails();

    const f = readFilters();
    if (!f.hasAny && !currentQuery()) {
      renderGrid(shuffle(animeData));
    } else {
      rerenderAll();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    headerEl?.classList.remove('header--hidden');
  }

  function resetToHome() {
    clearAllFilters();
    clearAppliedFilters();
    if (searchInput) searchInput.value = "";
    inSearchMode = false;
    filterPanel?.classList.remove("open");
    document.body.classList.remove("filter-open");
    showHome();
  }

  // ---------- WIRES ----------
  viewAllBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showAll();
  });
  
  // Logo/title should ALWAYS take you back to Home (even if you arrived via #all / #open=...)
// Logo/title should hard-refresh the page and return to Home (never stuck on #all)
homeBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  // remove any hash routes like #all / #open= / #anime=
  history.replaceState({}, '', location.pathname + location.search);

  // force a full reload
  window.location.reload();
});

randomBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  // If filter panel is open, close it
  filterPanel?.classList.remove("open");
  document.body.classList.remove("filter-open");
  filterBtn?.setAttribute("aria-expanded", "false");

  if (!Array.isArray(animeData) || animeData.length === 0) return;

  let idx = secureRandomInt(animeData.length);

  // Avoid picking the exact same one twice in a row (feels less broken)
  if (animeData.length > 1 && idx === lastRandomIdx) {
    let tries = 0;
    while (idx === lastRandomIdx && tries < 5) {
      idx = secureRandomInt(animeData.length);
      tries++;
    }
  }
  lastRandomIdx = idx;

  // Tiny “roll” feel
  if (!REDUCED_MOTION) {
    randomBtn.classList.add("rolling");
    setTimeout(() => randomBtn.classList.remove("rolling"), 380);
  }

  openModal(animeData[idx]);
});





  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = searchInput.value;
      showAll();
      rerenderAll();
      inSearchMode = !!val.trim();
    });
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (searchInput.value.trim() === "" && inSearchMode) {
        inSearchMode = false;
        cardContainer.innerHTML = "";
        showHome();
      }
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      inSearchMode = false;
      searchInput.value = "";
      cardContainer.innerHTML = "";
      showHome();
    });
  }

  if (filterBtn && filterPanel) {
    const setFilterOpen = (open) => {
  filterPanel.classList.toggle("open", open);
  filterBtn.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("filter-open", open);

  if (open) syncFilterFormToApplied();
};

    filterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setFilterOpen(!filterPanel.classList.contains("open"));
    });
    document.addEventListener("click", (e) => {
      if (!filterPanel.contains(e.target) && e.target !== filterBtn) {
        setFilterOpen(false);
      }
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setFilterOpen(false);
    });
  }

  if (filterForm) {
    filterForm.addEventListener("change", () => {
      updateFilterUI();
    });
    filterForm.addEventListener("submit", (e) => e.preventDefault());
  }

  if (filterClearBtn) {
    filterClearBtn.addEventListener("click", () => {
      clearAllFilters();
    });
  }
  if (filterApplyBtn) {
  filterApplyBtn.addEventListener("click", () => {
    setAppliedFilters(readFiltersFromForm());

    // close panel
    filterPanel?.classList.remove("open");
    document.body.classList.remove("filter-open");
    filterBtn?.setAttribute("aria-expanded", "false");

    const onHome = allView.style.display === "none";

    if (onHome) {
      // Only jump to All view if something is actually being applied
      if (appliedFilters.hasAny || currentQuery()) showAll();
    } else {
      // already on All view: rerender based on applied filters
      if (!appliedFilters.hasAny && !currentQuery()) renderGrid(shuffle(animeData));
      else rerenderAll();
    }
  });
}


    /* ===== Hide-on-scroll / show-on-scroll-up header ===== */
let lastY = window.scrollY;
const PIN_THRESHOLD = 40;   // start pinning once user scrolls past this
const DELTA = 8;            // minimum movement to consider a direction change
let pinned = false;

function pinHeader() {
  if (pinned) return;
  pinned = true;
  document.body.classList.add('has-fixed-header');
  headerEl.classList.add('is-fixed');
  headerEl.classList.remove('is-hidden');
}

function unpinHeader() {
  if (!pinned) return;
  pinned = false;
  document.body.classList.remove('has-fixed-header');
  headerEl.classList.remove('is-fixed', 'is-hidden');
}

function showHeader() {
  if (!pinned) return;
  headerEl.classList.remove('is-hidden');
}

function hideHeader() {
  if (!pinned) return;
  headerEl.classList.add('is-hidden');
}

function onScrollHeader() {
  const y = window.scrollY;

  // If a modal or the filter panel is open, keep header visible
  if (document.body.classList.contains('modal-open') ||
      document.body.classList.contains('filter-open')) {
    // ensure it's pinned & shown
    if (!pinned) pinHeader();
    showHeader();
    lastY = y;
    return;
  }

  // Pin when we leave the very top; unpin again at the very top
  if (y > PIN_THRESHOLD && !pinned) pinHeader();
  else if (y <= PIN_THRESHOLD && pinned) unpinHeader();

  if (pinned) {
    // Direction detection with small threshold to avoid jitter
    if (y > lastY + DELTA) {
      hideHeader();  // scrolling down -> tuck away
    } else if (y < lastY - DELTA) {
      showHeader();  // scrolling up -> reveal immediately
    }
  }

  lastY = y;
}

  // ---------- INIT ----------
  function validateData(list) {
    if (!Array.isArray(list)) {
      console.error("animeData must be an array");
      return;
    }
    const seenTitles = new Set();
    const usedRanks = new Map();
    list.forEach((a, i) => {
      const label = a?.Title || `#${i}`;
      if (!a || typeof a !== "object") console.warn(`[${label}] Entry is not an object`);
      if (!a?.Title || typeof a.Title !== "string") console.warn(`[${label}] Missing/invalid Title`);
      if (!a?.image || typeof a.image !== "string") console.warn(`[${label}] Missing/invalid image (e.g., "frieren.png")`);
      if (a?.Platforms !== undefined && !Array.isArray(a.Platforms)) console.warn(`[${label}] Platforms must be an array of strings`);
      if (Array.isArray(a?.Platforms) && a.Platforms.length === 1 && typeof a.Platforms[0] === "string" && a.Platforms[0].includes(","))
        console.warn(`[${label}] Platforms appears comma-joined — split into ["A","B","C"]`);
      if (a?.Tags !== undefined && !Array.isArray(a.Tags)) console.warn(`[${label}] Tags must be an array of strings`);
      if (a?.Trailer && typeof a.Trailer !== "string") console.warn(`[${label}] Trailer should be a YouTube URL string`);
      if (a?.Top10Rank !== undefined && a.Top10Rank !== null) {
        if (!Number.isInteger(a.Top10Rank) || a.Top10Rank < 1 || a.Top10Rank > 10) {
          console.warn(`[${label}] Top10Rank must be an integer 1..10 or omitted`);
        } else if (usedRanks.has(a.Top10Rank)) {
          console.warn(`[${label}] Duplicate Top10Rank ${a.Top10Rank} (already used by ${usedRanks.get(a.Top10Rank)})`);
        } else {
          usedRanks.set(a.Top10Rank, label);
        }
      }
      if (a?.Title && seenTitles.has(a.Title)) console.warn(`[${label}] Duplicate Title`);
      seenTitles.add(a.Title);
    });
  }

  function init() {
    if (typeof animeData === "undefined") {
      console.error("animeData.js not loaded. Include it before script.js.");
      return;
    }
    bindTop10Controls();
    buildSpotlight();
    buildFeaturedDrop();
    requestAnimationFrame(positionFeaturedDrop);
    window.addEventListener('resize', () => requestAnimationFrame(positionFeaturedDrop));
    window.addEventListener('load', () => requestAnimationFrame(positionFeaturedDrop));
    buildGenreRails();
    bindGenreShuffleButton();
    showHome();
    if ((location.hash || '') === '#all') {
    showAll();
    }

    validateData(animeData);
    buildFilterUI();
    updateFilterUI();
    filterPanel?.classList.remove("open");

    // Query routes:
    // - ?open=<animeId> -> open modal (sent from account page)
    try {
      const usp = new URLSearchParams(location.search);
      const openId = usp.get('open');
      if (openId) {
        // clean URL
        history.replaceState({}, '', location.pathname);

        const found = (animeData || []).find(a => slug(a.Title) === openId);
        if (found) {
          showAll();
          openModal(found);
        }
      }
    } catch (_) {}


    // Hash routes:
// - index.html#all                -> show All Anime view
// - index.html#open=<animeId>     -> open modal (internal from account) then normalize to #all
// - index.html#anime=<animeId>    -> open modal (shareable link) and keep hash
try {
  const h = location.hash || '';

  if (h === '#all') {
    if (typeof showAll === 'function') showAll();
  } else if (h.startsWith('#open=') || h.startsWith('#anime=')) {
    const isOpen = h.startsWith('#open=');
    const animeId = decodeURIComponent(h.slice(isOpen ? 6 : 7));

    if (typeof showAll === 'function') showAll();

    const list =
      (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData :
      (Array.isArray(window.animeData) ? window.animeData : []);

    const makeId =
      (typeof animeSlug === 'function') ? (t) => animeSlug({ Title: t }) :
      (typeof slug === 'function') ? (t) => slug(t) :
      (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

    const found = list.find(a => makeId(a.Title) === animeId);

    if (found) {
      if (typeof openModal === 'function') openModal(found);
      else if (typeof openAnimeModal === 'function') openAnimeModal(found);
      else if (typeof showModal === 'function') showModal(found);
    }

    // Internal account links should not re-open forever on refresh
    if (isOpen) {
      history.replaceState({}, '', location.pathname + location.search + '#all');
    }
  }
} catch (e) {
  console.warn('Hash route failed:', e);
}


  }
// ===== Fix: native <select> can keep the :hover brightness after choosing an option =====
// We add a temporary .nohover class (CSS already handles it for comments + community).
if (!window.__RAR_SELECT_HOVER_FIX__) {
  window.__RAR_SELECT_HOVER_FIX__ = true;

  function isSortSelect(el) {
    return el
      && el.tagName === 'SELECT'
      && (el.closest('.comments-controls .sort') || el.closest('.comm-sort'));
  }

  function applyNoHoverFix(sel) {
    sel.classList.add('nohover');
    try { sel.blur(); } catch (_) {}

    const clear = () => {
      sel.classList.remove('nohover');
      window.removeEventListener('pointermove', clear, true);
      window.removeEventListener('mousemove', clear, true);
      window.removeEventListener('touchstart', clear, true);
      window.removeEventListener('keydown', clear, true);
    };

    // Clear as soon as the user does ANY real input again
    window.addEventListener('pointermove', clear, true);
    window.addEventListener('mousemove', clear, true);
    window.addEventListener('touchstart', clear, true);
    window.addEventListener('keydown', clear, true);

    // Safety fallback (in case none of the above fires)
    setTimeout(clear, 500);
  }

  document.addEventListener('change', (e) => {
    const sel = e.target;
    if (!isSortSelect(sel)) return;
    applyNoHoverFix(sel);
  }, true);
}

  document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopSpotlightCycle();
    railsControllers.forEach((r) => r.stop());
  } else if (homeView.style.display !== "none") {
    if (SHOULD_CYCLE && !isSpotlightHovered) startSpotlightCycle();
    railsControllers.forEach((r) => r.start());
  }
});


  // start
  init();
})();
