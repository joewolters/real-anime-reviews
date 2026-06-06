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
  const continueSection = document.getElementById("continue-section");
  const continueRow = document.getElementById("continue-row");
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
  // v1.8.3 gate 4 — filter redesign hooks (live-narrow, Saved quick-filter, counts)
  const filterSavedBtn   = document.getElementById("filter-saved");
  const filterSavedCount = document.getElementById("filter-saved-count");
  const filterNarrowInput = document.getElementById("filter-narrow");
  const filterNarrowClear = document.getElementById("filter-narrow-clear");
  const filterNoOpts     = document.getElementById("filter-noopts");
  const filterApplyCount = document.getElementById("filter-apply-count");
  // v1.8.4 gate 2 — the 3-way review-status segment (All / Reviewed / Unreviewed).
  const filterReviewedSeg = document.getElementById("filter-reviewed");
  // v1.8.4 gate 3 — Discover surface refs.
  const discoverBtn = document.getElementById("discover-btn");
  const discoverView = document.getElementById("discover-view");
  const discoverLens = document.getElementById("discover-reviewed");
  const discoverSearchForm = document.getElementById("discover-search-form");
  const discoverSearchInput = document.getElementById("discover-search");
  const discoverSearchClear = document.getElementById("discover-search-clear");
  const discoverSearchResults = document.getElementById("discover-search-results");
  const discoverSectionsEl = document.getElementById("discover-sections");
  const discoverAiringEl = document.getElementById("discover-airing");
  const discoverGenreChipsEl = document.getElementById("discover-genre-chips");
  const discoverGenreRailEl = document.getElementById("discover-genre-rail");
  const discoverTrendingEl = document.getElementById("discover-trending");
  // v1.8.4 gate 4 — For You surface refs (provisional entry; G5 makes it nav).
  const foryouBtn = document.getElementById("foryou-btn");
  const foryouView = document.getElementById("for-you-view");
  const foryouLens = document.getElementById("foryou-lens");
  const foryouSectionsEl = document.getElementById("foryou-sections");
  // v1.8.4 gate 5 — real nav: the Den place button + the sliding "you are here" marker,
  // plus the two home hole-fill strips.
  const denBtn = document.getElementById("den-btn");
  const navPlaces = document.querySelector(".nav-places");
  const placeMarker = document.querySelector(".place-marker");
  const homeAiringBlock = document.getElementById("home-airing-block");
  const homeAiringRail = document.getElementById("home-airing");
  const homeForyouBlock = document.getElementById("home-foryou-block");
  const homeForyouRail = document.getElementById("home-foryou");


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
    onForYouSavesChanged();   // v1.8.4 gate 4 — signed-out featured + For You
    return;
  }

  const favQ = query(collection(db, "users", user.uid, "favorites"), orderBy("updatedAt", "desc"));
  const watchQ = query(collection(db, "users", user.uid, "watchlist"), orderBy("updatedAt", "desc"));

  unsubFavorites = onSnapshot(favQ, (snap) => {
    favoritesSet.clear();
    snap.forEach((d) => favoritesSet.add(d.id));
    syncAllSavedUI();
    onForYouSavesChanged();   // v1.8.4 gate 4 — re-personalize on save change
  });

  unsubWatchlist = onSnapshot(watchQ, (snap) => {
    watchlistSet.clear();
    snap.forEach((d) => watchlistSet.add(d.id));
    syncAllSavedUI();
    onForYouSavesChanged();   // v1.8.4 gate 4 — re-personalize on save change
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

// v1.7.5 (gate 1) — non-catalog (AniList) save. Same watchlist/favorites
// collections, doc id `al:<aniListId>` (the prefix can't collide with kebab-case
// catalog slugs, so the homepage's whole-collection snapshots carry these for
// free). A cover/format/year snapshot is stored at write-time so the account
// page (gate 2) paints with no per-row network. The slug-keyed catalog path in
// setSave() above is deliberately left untouched.
function anilistSaveId(aniListId) { return 'al:' + Number(aniListId); }

async function setSaveAnilist(kind, uid, aniListId, snapshot, turnOn) {
  const id = Number(aniListId);
  if (!id) return;
  const ref = doc(db, "users", uid, kind, anilistSaveId(id));
  if (turnOn) {
    await setDoc(ref, {
      type: 'anilist',
      aniListId: id,
      title: (snapshot && snapshot.title) || '',
      coverImage: (snapshot && snapshot.coverImage) || '',
      format: (snapshot && snapshot.format) || '',
      year: (snapshot && snapshot.year) || null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
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

  // v1.7.3 (gate 1a) — MORE_INFO_QUERY_NODE + the multi-fetch traversal moved
  // to franchise-fetch.js (window.franchiseFetch). See that file.

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

  // v1.7.3 (gate 1a) — The multi-fetch data layer (sleep / fetchMediaById /
  // fetchBatch / SPINE_RELATIONS / caps / traverseFranchise) moved to
  // franchise-fetch.js. script.js consumes it via window.franchiseFetch and
  // keeps only the caches (franchiseTreeCache + localStorage L2) below.

  // ── L2 localStorage cache (24h TTL, APP_VERSION-keyed, prefix-swept) ──
  // L1 is a dedicated in-memory Map (NOT the legacy moreInfoCache, whose value
  // shape differs — keeping them separate avoids a shape collision during the
  // gate1->gate2 gap). All localStorage access is try/caught: disabled storage
  // or a quota error degrades silently to memory-only.
  const franchiseTreeCache = new Map();
  const FRANCHISE_CACHE_PREFIX = 'rar:moreinfo:';
  const FRANCHISE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  let franchiseCacheSwept = false;

  function franchiseCacheVerKey() {
    return FRANCHISE_CACHE_PREFIX + 'v' + (window.APP_VERSION || '0') + ':';
  }
  function franchiseCacheKey(aniListId) {
    return franchiseCacheVerKey() + aniListId;
  }

  // Drop any cache entries from a previous APP_VERSION (once per session).
  function sweepFranchiseCache() {
    if (franchiseCacheSwept) return;
    franchiseCacheSwept = true;
    try {
      const keepPrefix = franchiseCacheVerKey();
      const stale = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(FRANCHISE_CACHE_PREFIX) === 0 && k.indexOf(keepPrefix) !== 0) {
          stale.push(k);
        }
      }
      stale.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
    } catch (_) {}
  }

  function readFranchiseCache(aniListId) {
    try {
      const raw = localStorage.getItem(franchiseCacheKey(aniListId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.ts !== 'number' || !parsed.tree) return null;
      if (Date.now() - parsed.ts > FRANCHISE_CACHE_TTL_MS) return null;
      return parsed.tree;
    } catch (_) { return null; }
  }

  function writeFranchiseCache(aniListId, tree) {
    sweepFranchiseCache();
    try {
      localStorage.setItem(franchiseCacheKey(aniListId), JSON.stringify({ ts: Date.now(), tree }));
    } catch (_) {}
  }

  // v1.7.2 — Cached entry point Gate 2's render layer will call. Backwards compat
  // (item 7): entries without AniListId return null so the caller falls back to
  // the legacy single-hop fetchRelationsForModal/title-search path. Lookup order:
  // L1 memory -> L2 localStorage -> network traverse (then fill both tiers).
  async function traverseFranchiseForModal(anime, forceRefresh) {
    if (!anime || !anime.AniListId) return null;
    const id = anime.AniListId;
    if (!forceRefresh) {
      if (franchiseTreeCache.has(id)) return franchiseTreeCache.get(id);
      const cached = readFranchiseCache(id);
      if (cached) { franchiseTreeCache.set(id, cached); return cached; }
    }
    const tree = await window.franchiseFetch.traverseFranchise(id);
    franchiseTreeCache.set(id, tree);
    writeFranchiseCache(id, tree);
    return tree;
  }

  // ── v1.7.4 (gate 2) — per-anime DETAIL cache for the secondary modal ──
  // Mirrors franchiseTreeCache exactly (L1 Map -> L2 localStorage, 24h TTL,
  // APP_VERSION-keyed `rar:anime:vX.Y.Z:{id}`, once-per-session prefix sweep,
  // every storage access try/caught). The network call lives in the shared
  // franchise-fetch.js (fetchMediaDetail); caching stays here, consistent with
  // that module's stated design ("caching deliberately stays in script.js").
  const animeDetailCache = new Map();
  const ANIME_DETAIL_PREFIX = 'rar:anime:';
  const ANIME_DETAIL_TTL_MS = 24 * 60 * 60 * 1000;
  let animeDetailSwept = false;

  function animeDetailVerKey() {
    return ANIME_DETAIL_PREFIX + 'v' + (window.APP_VERSION || '0') + ':';
  }
  function animeDetailKey(id) {
    return animeDetailVerKey() + id;
  }
  function sweepAnimeDetailCache() {
    if (animeDetailSwept) return;
    animeDetailSwept = true;
    try {
      const keepPrefix = animeDetailVerKey();
      const stale = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(ANIME_DETAIL_PREFIX) === 0 && k.indexOf(keepPrefix) !== 0) stale.push(k);
      }
      stale.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
    } catch (_) {}
  }
  function readAnimeDetailCache(id) {
    try {
      const raw = localStorage.getItem(animeDetailKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.ts !== 'number' || !parsed.detail) return null;
      if (Date.now() - parsed.ts > ANIME_DETAIL_TTL_MS) return null;
      return parsed.detail;
    } catch (_) { return null; }
  }
  function writeAnimeDetailCache(id, detail) {
    sweepAnimeDetailCache();
    try {
      localStorage.setItem(animeDetailKey(id), JSON.stringify({ ts: Date.now(), detail }));
    } catch (_) {}
  }
  // L1 memory -> L2 localStorage -> network (then fill both tiers). Returns the
  // normalized detail object or null; a null (failed) fetch is NOT cached.
  async function fetchAnimeDetailCached(id, forceRefresh) {
    if (!id) return null;
    const key = Number(id);
    if (!forceRefresh) {
      if (animeDetailCache.has(key)) return animeDetailCache.get(key);
      const cached = readAnimeDetailCache(key);
      if (cached) { animeDetailCache.set(key, cached); return cached; }
    }
    const detail = await window.franchiseFetch.fetchMediaDetail(key);
    if (detail) { animeDetailCache.set(key, detail); writeAnimeDetailCache(key, detail); }
    return detail;
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

    // v1.7.2 — franchise (multi-hop) branch: consumes the traverseFranchise tree
    // { spine, groups, episodesBySeason, failedCount } (+ source recommendations/
    // staff merged in by the call-site). The legacy 1-hop branch below is
    // untouched and still serves no-AniListId fallback entries.
    if (state === 'franchise') {
      return renderFranchisePanel(sourceAnime, result);
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

    _deepDiveHintPlaced = false;   // v1.8.4 gate 8 — reset before the legacy 1-hop rows
    const rows = entries.map(node => renderMoreInfoEntry(node)).join('');
    return `<div class="more-info-list">${rows}</div>`
      + renderEpisodeList(streamingEpisodes, sourceAnime)
      + renderRecommendations(recommendations)
      + renderStaffCredits(staffEdges);
  }

  // ──────────────────────────────────────────────────────────────────────
  // v1.7.2 — FRANCHISE (multi-hop) RENDER LAYER (Gate 2)
  // Consumes the traverseFranchise tree: spine chain (year-ordered, connector
  // line, --current source) -> grouped non-spine sections (relationType, "show
  // all N" when >6, in-catalog pill) -> per-season collapsible episodes (source
  // season open) -> source recommendations + staff -> partial-fail notice (+
  // retry). No service name in any interrupting copy.
  // ──────────────────────────────────────────────────────────────────────

  // v1.7.4 (gate 3, Surface 2) — catalog id maps, built lazily once.
  //   _primaryIdToSlug : ONLY each entry's PRIMARY AniListId → slug. These rows
  //                      open Blake's MAIN franchise modal (openModal).
  //   _watchedIds      : EVERY id Blake marked watched (primary + the rest of the
  //                      WatchedAniListIds set). Drives the green ✓ REVIEWED pill.
  // Routing: primary → main modal; watched-but-not-primary → SECONDARY modal (with
  // the per-season review section); non-watched non-catalog → secondary, no review.
  let _primaryIdToSlug = null;
  let _watchedIds = null;
  function _buildCatalogMaps() {
    if (_primaryIdToSlug) return;
    _primaryIdToSlug = new Map();
    _watchedIds = new Set();
    try {
      const list = (typeof window !== 'undefined' && Array.isArray(window.animeData))
        ? window.animeData
        : (Array.isArray(animeData) ? animeData : []);
      list.forEach(a => {
        if (!a) return;
        const s = slug(a.Title || '');
        if (a.AniListId) { _primaryIdToSlug.set(Number(a.AniListId), s); _watchedIds.add(Number(a.AniListId)); }
        if (Array.isArray(a.WatchedAniListIds)) {
          a.WatchedAniListIds.forEach(id => { if (id) _watchedIds.add(Number(id)); });
        }
      });
    } catch (_) {}
  }
  // slug only when `id` is an entry's PRIMARY AniListId (else null).
  function primarySlugForAniListId(aniListId) {
    if (!aniListId) return null;
    _buildCatalogMaps();
    return _primaryIdToSlug.get(Number(aniListId)) || null;
  }
  // true when `id` is in ANY entry's watched set (primary or otherwise).
  function isWatchedAniListId(aniListId) {
    if (!aniListId) return false;
    _buildCatalogMaps();
    return _watchedIds.has(Number(aniListId));
  }

  // Friendly section labels for non-spine relation groups + their display order.
  const FRANCHISE_GROUP_LABELS = {
    SIDE_STORY: 'SIDE STORIES',
    ALTERNATIVE: 'ALTERNATIVE VERSIONS',
    SPIN_OFF: 'SPIN-OFFS',
    SUMMARY: 'RECAPS',
    PARENT: 'PARENT STORY',
    CHARACTER: 'SHARED CHARACTERS',
    OTHER: 'OTHER',
  };
  const FRANCHISE_GROUP_ORDER = ['SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY', 'PARENT', 'CHARACTER', 'OTHER'];
  const FRANCHISE_GROUP_COMPACT = 6;

  function franchiseGroupLabel(relationType) {
    if (FRANCHISE_GROUP_LABELS[relationType]) return FRANCHISE_GROUP_LABELS[relationType];
    return String(relationType || 'OTHER').replace(/_/g, ' ').toUpperCase();
  }

  // v1.8.4 gate 8 — the once-per-visitor "deep dive" hint. A quiet brand-voice aside placed
  // under the FIRST clickable More-Info row, teaching that the rows open the richer secondary
  // modal ("WAY more information"). localStorage-gated so it shows ONCE and never nags re-
  // renders (episode-toggle / retry within an open modal) or returning visitors. Its own
  // class never matches the delegated .more-info-entry--clickable handler, so it can't
  // swallow a row click. _deepDiveHintPlaced is reset per panel render (one hint per panel).
  const DEEP_DIVE_HINT_KEY = 'rar:moreinfo:deepdiveHintShown';
  let _deepDiveHintPlaced = false;
  function deepDiveHintTaught() {
    try { return localStorage.getItem(DEEP_DIVE_HINT_KEY) === '1'; } catch (_) { return false; }
  }
  // The hint HTML for the first clickable row of a panel, else ''. Writing the flag on the
  // first emit means any same-visit re-render reads '1' and stays silent. NOTE: this is a
  // deliberately impure renderer — it sets the once-shown flag here (single-impression by
  // design for a low-stakes nudge), unlike the surrounding pure HTML builders. Neutral
  // wording ("a title") so the one shared string fits the franchise AND legacy 1-hop panels.
  function deepDiveHintFor(entryClass) {
    if (_deepDiveHintPlaced) return '';
    if (!String(entryClass).includes('more-info-entry--clickable')) return '';
    if (deepDiveHintTaught()) return '';
    _deepDiveHintPlaced = true;
    try { localStorage.setItem(DEEP_DIVE_HINT_KEY, '1'); } catch (_) {}
    return '<div class="more-info-deepdive-hint" aria-hidden="true">'
      + '<span class="mi-hint-pill"><span class="jp-mini">その先へ</span> tap a title to slip behind the door '
      + '<span class="mi-hint-arrow">↑</span></span></div>';
  }

  // One franchise row (spine or group). isSource -> --current highlight; rows in
  // Blake's catalog get the "Reviewed" pill + data-catalog-slug (click opens the
  // internal modal); others get data-anilist-id (click opens the external page).
  function renderFranchiseEntry(node, kicker) {
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

    // v1.7.4 (gate 3, Surface 2 + gate 3c) — routing:
    //   • SOURCE (currently-viewing) row → SECONDARY modal for its OWN season
    //     (data-anilist-id) so the source gets a per-season review surface,
    //     distinct from the franchise-wide review already open in the main modal.
    //   • other primary id → main franchise modal (data-catalog-slug).
    //   • watched-not-primary OR non-catalog → secondary modal (data-anilist-id).
    const primarySlug = primarySlugForAniListId(node.id);
    const watched = isWatchedAniListId(node.id);
    let entryClass = 'more-info-entry';
    if (node.isSource) entryClass += ' more-info-entry--current';
    let clickAttrs = '';
    if (node.isSource && node.id) {
      entryClass += ' more-info-entry--clickable';
      clickAttrs = ` data-anilist-id="${escapeHtml(String(node.id))}"`;
    } else if (primarySlug) {
      entryClass += ' more-info-entry--clickable';
      clickAttrs = ` data-catalog-slug="${escapeHtml(primarySlug)}"`;
    } else if (node.id) {
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
    const fmtBadgeHtml = node.format
      ? `<span class="more-info-rec-format-badge" style="position: static;">${escapeHtml(node.format)}</span>`
      : '';
    const metaTextHtml = metaParts.length ? escapeHtml(metaParts.join(' · ')) : '';
    const metaInner = fmtBadgeHtml && metaTextHtml
      ? `${fmtBadgeHtml} ${metaTextHtml}`
      : (fmtBadgeHtml || metaTextHtml);
    const metaHtml = metaInner ? `<div class="more-info-meta">${metaInner}</div>` : '';
    // v1.7.2 gate 3d — undated / unreleased entries get an UPCOMING kicker
    // (uses the already-fetched `status` field; source always wins the kicker slot).
    const isUpcoming = !node.seasonYear || node.status === 'NOT_YET_RELEASED';
    const kickerText = node.isSource
      ? 'CURRENTLY VIEWING'
      : (isUpcoming ? 'UPCOMING' : (kicker || ''));
    const kickerClass = kickerText === 'UPCOMING'
      ? 'more-info-relation more-info-relation--upcoming'
      : 'more-info-relation';
    const kickerHtml = kickerText ? `<span class="${kickerClass}">${escapeHtml(kickerText)}</span>` : '';
    // v1.7.4 (gate 2/3, Decision 5) — WATCHED ids (primary + watched-set) get the
    // green ✓ Reviewed pill; non-watched clickable rows get the amber "not reviewed
    // yet" dot (source row exempt — it carries the CURRENTLY VIEWING kicker).
    const pillHtml = watched
      ? '<span class="more-info-catalog-pill">✓ Reviewed</span>'
      : ((node.id && !node.isSource)
          ? '<span class="more-info-unreviewed-dot" title="Not reviewed yet — opens details" aria-label="Not reviewed yet"></span>'
          : '');

    return `<div class="${entryClass}"${clickAttrs}>
    ${coverHtml}
    <div class="more-info-body">
      ${kickerHtml}
      <div class="more-info-english">${escapeHtml(english)}${pillHtml}</div>
      ${romajiHtml}
      ${metaHtml}
    </div>
    ${scoreHtml}
  </div>${deepDiveHintFor(entryClass)}`;
  }

  // v1.7.2 gate 3d — shared season comparator. Undated entries (null/0/non-number
  // seasonYear) sort to the BOTTOM (treated as +Infinity); id tiebreak avoids the
  // Infinity - Infinity = NaN trap. Render-layer only — traverseFranchise's own
  // pre-sorts stay untouched (render overrides them).
  function compareSeason(a, b) {
    const ya = (a && typeof a.seasonYear === 'number' && a.seasonYear > 0) ? a.seasonYear : Infinity;
    const yb = (b && typeof b.seasonYear === 'number' && b.seasonYear > 0) ? b.seasonYear : Infinity;
    if (ya === Infinity && yb === Infinity) return ((a && a.id) || 0) - ((b && b.id) || 0);
    if (ya === Infinity) return 1;
    if (yb === Infinity) return -1;
    return (ya - yb) || (((a && a.id) || 0) - ((b && b.id) || 0));
  }

  // Spine chain — year-ordered (undated to bottom), connector line between rows (CSS).
  function renderFranchiseSpine(spine) {
    if (!spine || !spine.length) return '';
    const rows = spine.slice().sort(compareSeason).map(n => renderFranchiseEntry(n)).join('');
    return `<div class="more-info-list more-info-spine">${rows}</div>`;
  }

  // Grouped non-spine sections. Within a group: sort by year. >6 entries ->
  // first 6 shown + the remainder behind a <details> "Show all N entries".
  function renderFranchiseGroups(groups) {
    if (!groups) return '';
    const keys = Object.keys(groups);
    if (!keys.length) return '';
    const ordered = keys.slice().sort((a, b) => {
      const ia = FRANCHISE_GROUP_ORDER.indexOf(a);
      const ib = FRANCHISE_GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
    let html = '';
    for (const key of ordered) {
      const nodes = (groups[key] || []).slice().sort(compareSeason);
      if (!nodes.length) continue;
      const header = `<div class="more-info-section-header">${escapeHtml(franchiseGroupLabel(key))}</div>`;
      let body;
      if (nodes.length > FRANCHISE_GROUP_COMPACT) {
        const head = nodes.slice(0, FRANCHISE_GROUP_COMPACT).map(n => renderFranchiseEntry(n)).join('');
        const rest = nodes.slice(FRANCHISE_GROUP_COMPACT).map(n => renderFranchiseEntry(n)).join('');
        body = `<div class="more-info-list">${head}</div>`
          + `<details class="more-info-episodes-details more-info-group-details">`
          + `<summary>Show all ${nodes.length} entries</summary>`
          + `<div class="more-info-list">${rest}</div></details>`;
      } else {
        body = `<div class="more-info-list">${nodes.map(n => renderFranchiseEntry(n)).join('')}</div>`;
      }
      html += `<div class="more-info-group">${header}${body}</div>`;
    }
    return html;
  }

  // v1.7.2 gate 3b — episode-numbering mode persists to localStorage
  // (PER SEASON default; CONTINUOUS = running count across de-duplicated seasons).
  const EP_NUMBERING_KEY = 'rar:episodeNumbering';
  function getEpisodeNumberingMode() {
    try {
      return localStorage.getItem(EP_NUMBERING_KEY) === 'continuous' ? 'continuous' : 'perSeason';
    } catch (_) { return 'perSeason'; }
  }
  function setEpisodeNumberingMode(mode) {
    try {
      localStorage.setItem(EP_NUMBERING_KEY, mode === 'continuous' ? 'continuous' : 'perSeason');
    } catch (_) {}
  }

  // EPISODES section header + the PER SEASON / CONTINUOUS segmented control.
  function renderEpisodesHeader(mode) {
    const perActive = mode !== 'continuous';
    return `<div class="more-info-episodes-head">`
      + `<div class="more-info-section-header">EPISODES</div>`
      + `<div class="more-info-ep-toggle" role="group" aria-label="Episode numbering" data-mode="${perActive ? 'perSeason' : 'continuous'}">`
      + `<span class="more-info-ep-toggle-indicator" aria-hidden="true"></span>`
      + `<button type="button" class="more-info-ep-mode${perActive ? ' is-active' : ''}" data-ep-mode="perSeason" aria-pressed="${perActive}">Per Season</button>`
      + `<button type="button" class="more-info-ep-mode${perActive ? '' : ' is-active'}" data-ep-mode="continuous" aria-pressed="${!perActive}">Continuous</button>`
      + `</div></div>`;
  }

  // v1.7.2 gate 3b — Per-season collapsible episodes (ALL closed by default).
  //   Bug 1: signature-dedup — skip any season whose episode-title set already
  //          rendered (AniList returns identical streamingEpisodes for some
  //          franchises, e.g. Re:Zero's Director's-Cut listing on every entry).
  //   Bug 2: strip the "Episode N -" prefix and renumber by sorted position
  //          (the list arrives descending); empty stripped title -> "Episode {n}".
  //   Toggle: PER SEASON numbers each season 1..n; CONTINUOUS keeps a running
  //          counter across the de-duplicated, spine-ordered seasons.
  //   Bug 3: handled by the caller (renderFranchisePanel) via sourceEpisodeCount.
  function renderEpisodesBySeason(episodesBySeason, sourceId, mode) {
    if (!episodesBySeason || !episodesBySeason.length) return '';
    const continuous = mode === 'continuous';
    const seenSignatures = new Set();
    let runningCount = 0;
    const sections = [];

    for (const season of episodesBySeason.slice().sort(compareSeason)) {
      const eps = (season.episodes || [])
        .map((e, i) => {
          const title = (e && e.title) || '';
          const m = title.match(/^Episode\s+(\d+)\s*[-–—]\s*/i);
          return {
            raw: title,
            stripped: title.replace(/^Episode\s+\d+\s*[-–—]\s*/i, '').trim(),
            epNum: m ? parseInt(m[1], 10) : null,
            origIndex: i,
          };
        })
        .sort((a, b) => {
          if (a.epNum === null && b.epNum === null) return a.origIndex - b.origIndex;
          if (a.epNum === null) return 1;
          if (b.epNum === null) return -1;
          return a.epNum - b.epNum;
        });
      if (!eps.length) continue;

      // Bug 1 — skip seasons whose episode-title set already rendered this panel.
      const signature = JSON.stringify(eps.map(e => e.raw).slice().sort());
      if (seenSignatures.has(signature)) continue;
      seenSignatures.add(signature);

      const rowHtml = eps.map((e, idx) => {
        const num = continuous ? runningCount + idx + 1 : idx + 1;
        const label = e.stripped ? `${num} · ${e.stripped}` : `Episode ${num}`;
        return `<div class="more-info-episode-row">${escapeHtml(label)}</div>`;
      }).join('');
      runningCount += eps.length;

      const summaryLabel = (season.title || 'Season') + ' — ' + eps.length + (eps.length === 1 ? ' episode' : ' episodes');
      sections.push(`<details class="more-info-episodes-details more-info-season">`
        + `<summary>${escapeHtml(summaryLabel)}</summary>${rowHtml}</details>`);
    }

    if (!sections.length) return '';
    return `<div class="more-info-episodes">${renderEpisodesHeader(continuous ? 'continuous' : 'perSeason')}${sections.join('')}</div>`;
  }

  // Subtle partial-fail notice + progressive retry. No service name in the copy.
  function renderPartialFail(failedCount) {
    if (!failedCount || failedCount <= 0) return '';
    return `<div class="more-info-partial-fail">Some related entries couldn't load right now. `
      + `<button type="button" class="more-info-retry">Retry</button></div>`;
  }

  // Assemble the full franchise panel from the tree (+ source recs/staff).
  function renderFranchisePanel(sourceAnime, tree) {
    _deepDiveHintPlaced = false;   // v1.8.4 gate 8 — one deep-dive hint per panel render
    const spine = tree?.spine || [];
    const groups = tree?.groups || {};
    const episodesBySeason = tree?.episodesBySeason || [];
    const failedCount = tree?.failedCount || 0;
    const recommendations = tree?.recommendations || [];
    const staffEdges = tree?.staff || [];
    const sourceId = sourceAnime?.AniListId || null;
    const mode = getEpisodeNumberingMode();

    if (!spine.length && !Object.keys(groups).length && !episodesBySeason.length) {
      return '<div class="more-info-empty">No franchise info available yet.</div>';
    }

    // Bug 3 — graceful empty-state: the source claims episodes (metadata) but the
    // franchise returned none. Movies / 0-episode-metadata entries stay clean.
    let episodesHtml = renderEpisodesBySeason(episodesBySeason, sourceId, mode);
    if (!episodesHtml) {
      const sourceNode = spine.find(n => n.isSource);
      const sourceEpisodeCount = (sourceNode && sourceNode.episodes) || 0;
      if (sourceEpisodeCount > 0) {
        episodesHtml = '<div class="more-info-episodes">'
          + '<div class="more-info-section-header">EPISODES</div>'
          + '<div class="more-info-empty-sub">Episode list not available for this title.</div></div>';
      }
    }

    return renderFranchiseSpine(spine)
      + renderFranchiseGroups(groups)
      + episodesHtml
      + renderRecommendations(recommendations)
      + renderStaffCredits(staffEdges)
      + renderPartialFail(failedCount);
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
  </div>${deepDiveHintFor(entryClass)}`;
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
      // v1.7.4 (gate 2/3, Surface 2) — primary id → main modal + green pill;
      // watched-but-not-primary → secondary modal + green pill; non-watched →
      // secondary modal + amber "not reviewed yet" dot.
      const primarySlug = id ? primarySlugForAniListId(id) : null;
      const watched = id ? isWatchedAniListId(id) : false;
      let clickAttrs = '';
      let entryClass = 'more-info-entry';
      let pillHtml = '';
      if (primarySlug) {
        clickAttrs = ` data-catalog-slug="${escapeHtml(primarySlug)}"`;
        entryClass += ' more-info-entry--clickable';
        pillHtml = '<span class="more-info-catalog-pill">✓ Reviewed</span>';
      } else if (id) {
        clickAttrs = ` data-anilist-id="${escapeHtml(String(id))}"`;
        entryClass += ' more-info-entry--clickable';
        pillHtml = watched
          ? '<span class="more-info-catalog-pill">✓ Reviewed</span>'
          : '<span class="more-info-unreviewed-dot" title="Not reviewed yet — opens details" aria-label="Not reviewed yet"></span>';
      }
      return `<div class="${entryClass}"${clickAttrs}>
    ${coverHtml}
    <div class="more-info-body">
      <div class="more-info-english">${escapeHtml(english)}${pillHtml}</div>
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
    const WHITELIST = ['Director', 'Series Director', 'Series Composition', 'Music', 'Sound Director', 'Character Design'];
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

// v1.7.1 — keep a per-anime AniListColor readable as kicker text on the dark
// modal: very dark colors (e.g. Chainsaw Man's #6b1a1a) get lightened toward a
// readable band; everything mid/light passes through. Returns rgb() or null.
function readableAccent(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;   // 0-255 perceived
  if (lum < 110) {
    const t = ((110 - lum) / 110) * 0.7;              // mix toward white
    r = Math.round(r + (255 - r) * t);
    g = Math.round(g + (255 - g) * t);
    b = Math.round(b + (255 - b) * t);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

// v1.7.1 gate 1f — subtitle resolver: prefer Romaji when meaningfully different
// from English, else fall back to the native Japanese title (.is-native → Noto
// Sans JP). Duplicated in card-render.js — keep the two in sync.
// gate 1g — normalize (strip non-alphanumerics + lowercase) before comparing so
// romaji that matches English bar punctuation/case (e.g. "One Punch Man" vs
// "One-Punch Man") is treated as identical → fall through to the native title.
function normSub(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function pickSubtitle(anime) {
  const eng = String(anime.TitleEnglish || anime.Title || '').trim();
  const rom = String(anime.TitleRomaji || '').trim();
  const nat = String(anime.TitleNative || '').trim();
  if (rom && normSub(rom) !== normSub(eng)) return { text: rom, kind: 'romaji' };
  if (nat) return { text: nat, kind: 'native' };
  return null;
}
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
  // v1.8.3 gate 4 — studio dedup key (the v1.6.10 More-Info dedup, hardened for the
  // filter's real-world variants): strips a leading "Studio " then all non-alphanum,
  // so "A1 Pictures"/"A-1 Pictures", "Studio Deen"/"Studio DEEN", "Madhouse"/"Studio
  // Madhouse", and "Zero-G"/"ZERO - G" collapse to one option. Display canonicalization
  // (which spelling to show) happens in collectFacets.
  function studioKey(s) {
    return String(s || "").toLowerCase().replace(/^\s*studio\s+/, "").replace(/[^a-z0-9]/g, "");
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
    const studioFreq = new Map();   // raw display spelling -> occurrence count
    (animeData || []).forEach((a) => {
      getGenres(a).forEach((g) => genres.add(g));
      safeArray(a.Tags).forEach((t) => t && tags.add(t));
      splitStudios(a.Studio).forEach((s) => studioFreq.set(s, (studioFreq.get(s) || 0) + 1));
    });
    // dedup studios by studioKey; for each key pick the canonical spelling: most
    // frequent in the data, tie-broken toward proper casing (most lowercase letters)
    // then alphabetical — yields "A-1 Pictures", "Madhouse", "Studio Deen", "Zero-G".
    const byKey = new Map();
    [...studioFreq.keys()].forEach((d) => {
      const k = studioKey(d);
      if (!k) return;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(d);
    });
    const studios = [...byKey.values()].map((variants) =>
      variants.slice().sort((a, b) => {
        const fa = studioFreq.get(a) || 0, fb = studioFreq.get(b) || 0;
        if (fb !== fa) return fb - fa;
        const la = (a.match(/[a-z]/g) || []).length, lb = (b.match(/[a-z]/g) || []).length;
        if (lb !== la) return lb - la;
        return a.localeCompare(b);
      })[0]
    );
    const sortIns = (arr) => arr.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return {
      genres: sortIns([...genres]),
      tags: sortIns([...tags]),
      studios: sortIns(studios),
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
    applyFilterNarrow("");   // seed the per-group option counts
  }

  // v1.8.3 gate 4 — live-narrow the filter options as you type. Visual only (hidden
  // items keep their checked state), hides empty groups, updates per-group counts,
  // and shows a "no options" line when nothing matches.
  function applyFilterNarrow(qRaw) {
    const q = (qRaw || "").trim().toLowerCase();
    const groups = filterForm ? filterForm.querySelectorAll(".filter-group") : [];
    let totalVisible = 0;
    groups.forEach((group) => {
      let vis = 0;
      group.querySelectorAll(".filter-item").forEach((item) => {
        const label = (item.querySelector("label")?.textContent || "").toLowerCase();
        const show = !q || label.includes(q);
        item.hidden = !show;
        if (show) vis++;
      });
      totalVisible += vis;
      const countEl = group.querySelector(".fg-count");
      if (countEl) countEl.textContent = q ? String(vis) : (vis ? String(vis) : "");
      // v1.8.3 gate 5b — the group (its HEADER + count) STAYS visible while narrowing
      // even at 0 matches, so the panel keeps its structure instead of collapsing to a
      // near-empty box (the "Typhoon Graphics blanks the panel" report — narrowing to a
      // single studio used to hide the other two groups entirely). A 0-match group shows
      // a faint "no matches" line in place of its chips.
      group.classList.toggle("is-empty", q !== "" && vis === 0);
    });
    if (filterNoOpts) filterNoOpts.hidden = totalVisible !== 0;
    if (filterNarrowClear) filterNarrowClear.hidden = !q;
  }

  function getCheckedValues(name) {
    const nodes = filterForm?.querySelectorAll('input[name="' + name + '"]:checked') || [];
    return [...nodes].map((n) => n.value);
  }

  // Applied filters only change when Confirm is pressed
let appliedFilters = { genres: new Set(), tags: new Set(), studios: new Set(), savedOnly: false, reviewed: 'all', hasAny: false };

// v1.8.4 gate 2 — which review-status segment is active in the form ('all' is the
// neutral default). Reads the pressed segment button.
function readReviewedSeg() {
  const active = filterReviewedSeg && filterReviewedSeg.querySelector('.fr-seg.is-active');
  const v = active && active.getAttribute('data-reviewed');
  return (v === 'reviewed' || v === 'notyet') ? v : 'all';
}

// Visually select a review-status segment ('all' | 'reviewed' | 'notyet'). If the
// requested segment is disabled (e.g. 'notyet' on a catalog-only view), fall back
// to 'all' so the form never sits on an unreachable state.
function setReviewedSeg(which) {
  if (!filterReviewedSeg) return;
  let target = (which === 'reviewed' || which === 'notyet') ? which : 'all';
  const targetBtn = filterReviewedSeg.querySelector(`.fr-seg[data-reviewed="${target}"]`);
  if (targetBtn && targetBtn.disabled) target = 'all';
  filterReviewedSeg.querySelectorAll('.fr-seg').forEach((btn) => {
    const on = btn.getAttribute('data-reviewed') === target;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

// v1.8.4 gate 2 — "Not yet" is only meaningful where outside cards exist (G3+).
// On catalog-only surfaces it's present but DISABLED with a hint (honest, not
// hidden). A discovery surface calls this(true) when it renders outside cards.
let filterHasOutsideCards = false;
function setFilterHasOutsideCards(on) {
  filterHasOutsideCards = !!on;
  if (!filterReviewedSeg) return;
  const notYet = filterReviewedSeg.querySelector('.fr-seg[data-reviewed="notyet"]');
  if (notYet) {
    notYet.disabled = !filterHasOutsideCards;
    notYet.title = filterHasOutsideCards ? '' : 'Available on For You and Discover';
  }
  // If "Not yet" just got disabled while selected, drop back to "All".
  if (!filterHasOutsideCards && readReviewedSeg() === 'notyet') setReviewedSeg('all');
}

// Wire the segment buttons: clicking sets the pending segment + refreshes the
// live match-count (applied only on Confirm, same as the checkboxes).
function wireReviewedSeg() {
  if (!filterReviewedSeg) return;
  filterReviewedSeg.querySelectorAll('.fr-seg').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      setReviewedSeg(btn.getAttribute('data-reviewed'));
      updateFilterUI();
    });
  });
}

function readFiltersFromForm() {
  const low = (arr) => arr.map((v) => v.toLowerCase());
  const genres = new Set(low(getCheckedValues("genre")));
  const tags = new Set(low(getCheckedValues("tag")));
  // studios stored as dedup keys so a selected canonical spelling still matches an
  // anime that carries a variant spelling (e.g. picked "A-1 Pictures" matches "A1 Pictures")
  const studios = new Set(getCheckedValues("studio").map(studioKey));
  const savedOnly = !!(filterSavedBtn && filterSavedBtn.getAttribute("aria-pressed") === "true");
  const reviewed = readReviewedSeg();
  const hasAny = !!(genres.size || tags.size || studios.size || savedOnly || reviewed !== 'all');
  return { genres, tags, studios, savedOnly, reviewed, hasAny };
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
    savedOnly: !!next.savedOnly,
    reviewed: (next.reviewed === 'reviewed' || next.reviewed === 'notyet') ? next.reviewed : 'all',
    hasAny: !!next.hasAny
  };
}

function clearAppliedFilters() {
  setAppliedFilters({ genres: new Set(), tags: new Set(), studios: new Set(), savedOnly: false, reviewed: 'all', hasAny: false });
}

// v1.8.3 gate 4 — remember the last applied filter across reloads (localStorage).
const FILTER_MEMORY_KEY = "rar:filter:v1";
function saveFilterMemory() {
  try {
    localStorage.setItem(FILTER_MEMORY_KEY, JSON.stringify({
      genres: [...appliedFilters.genres],
      tags: [...appliedFilters.tags],
      studios: [...appliedFilters.studios],   // stored as dedup keys
      savedOnly: !!appliedFilters.savedOnly,
      reviewed: appliedFilters.reviewed || 'all'
    }));
  } catch (_) {}
}
function loadFilterMemory() {
  let raw = null;
  try { raw = localStorage.getItem(FILTER_MEMORY_KEY); } catch (_) {}
  if (!raw) return;
  let obj; try { obj = JSON.parse(raw); } catch (_) { return; }
  if (!obj || typeof obj !== "object") return;
  const genres = new Set((obj.genres || []).map((v) => String(v).toLowerCase()));
  const tags = new Set((obj.tags || []).map((v) => String(v).toLowerCase()));
  const studios = new Set((obj.studios || []).map((v) => String(v)));
  const savedOnly = !!obj.savedOnly;
  // Coerce a persisted 'notyet' back to 'all' on load: a fresh page is catalog-
  // only (no outside cards), so restoring 'notyet' would render an empty grid.
  const reviewed = obj.reviewed === 'reviewed' ? 'reviewed' : 'all';
  const hasAny = !!(genres.size || tags.size || studios.size || savedOnly || reviewed !== 'all');
  setAppliedFilters({ genres, tags, studios, savedOnly, reviewed, hasAny });
}

// When opening the panel, show the currently applied filters in the checkboxes
function syncFilterFormToApplied() {
  if (!filterForm) return;

  const syncGroup = (name, set, keyer) => {
    filterForm.querySelectorAll(`input[name="${name}"]`).forEach((cb) => {
      const v = keyer ? keyer(cb.value) : (cb.value || "").toLowerCase();
      cb.checked = set.has(v);
    });
  };

  syncGroup("genre", appliedFilters.genres);
  syncGroup("tag", appliedFilters.tags);
  syncGroup("studio", appliedFilters.studios, studioKey);

  if (filterSavedBtn) filterSavedBtn.setAttribute("aria-pressed", String(!!appliedFilters.savedOnly));
  setReviewedSeg(appliedFilters.reviewed);

  updateFilterUI();
}


  function matchesFilters(anime, f) {
    if (!f.hasAny) return true;
    // v1.8.4 gate 2 — review-status axis. Catalog entries (Blake's 44) have no
    // `__reviewed` flag, so they are reviewed by default; discovery/outside cards
    // (G3+) carry __reviewed:false. 'all' is a no-op on every surface.
    if (f.reviewed === 'reviewed' && anime.__reviewed === false) return false;
    if (f.reviewed === 'notyet'   && anime.__reviewed !== false) return false;
    if (f.savedOnly) {
      const id = slug(anime.Title);
      if (!favoritesSet.has(id) && !watchlistSet.has(id)) return false;
    }
    if (f.genres.size) {
      const gset = new Set(getGenres(anime).map((x) => x.toLowerCase()));
      if (![...f.genres].some((g) => gset.has(g))) return false;
    }
    if (f.tags.size) {
      const tset = new Set(safeArray(anime.Tags).map((x) => (x || "").toLowerCase()));
      if (![...f.tags].some((t) => tset.has(t))) return false;
    }
    if (f.studios.size) {
      const sset = new Set(splitStudios(anime.Studio).map(studioKey));   // compare by dedup key
      if (![...f.studios].some((s) => sset.has(s))) return false;
    }
    return true;
  }

  function updateFilterUI() {
  if (!summaryEl) return;

  const g = (filterForm?.querySelectorAll('input[name="genre"]:checked') || []).length || 0;
  const t = (filterForm?.querySelectorAll('input[name="tag"]:checked') || []).length || 0;
  const s = (filterForm?.querySelectorAll('input[name="studio"]:checked') || []).length || 0;
  const savedOn = filterSavedBtn && filterSavedBtn.getAttribute("aria-pressed") === "true";

  const seg = readReviewedSeg();
  const parts = [];
  if (seg === 'reviewed') parts.push("Reviewed");
  else if (seg === 'notyet') parts.push("Unreviewed");
  if (savedOn) parts.push("Saved");
  if (g) parts.push(`Genres ${g}`);
  if (t) parts.push(`Tags ${t}`);
  if (s) parts.push(`Studios ${s}`);

  summaryEl.textContent = parts.length ? parts.join(" • ") : "No filters applied";
  summaryEl.classList.toggle("is-active", parts.length > 0);

  // v1.8.3 gate 4 — live preview of how many anime the PENDING (form) filters match,
  // so you see the result size before pressing Confirm. Also keeps the Saved count
  // fresh. Combined with any active search query for an honest number.
  const pending = readFiltersFromForm();
  const q = currentQuery();
  let count = 0;
  (animeData || []).forEach((a) => {
    if (matchesFilters(a, pending) && (!q || matchesSearch(a, q))) count++;
  });
  if (filterApplyCount) filterApplyCount.textContent = pending.hasAny || q ? ` (${count})` : "";
  if (filterApplyBtn) filterApplyBtn.classList.toggle("is-zero", (pending.hasAny || q) && count === 0);

  if (filterSavedCount) {
    const savedTotal = new Set([...favoritesSet, ...watchlistSet]).size;
    filterSavedCount.textContent = savedTotal ? ` ${savedTotal}` : "";
  }
}


  function clearAllFilters() {
    if (!filterForm) return;
    filterForm.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
    if (filterSavedBtn) filterSavedBtn.setAttribute("aria-pressed", "false");
    setReviewedSeg('all');
    if (filterNarrowInput) filterNarrowInput.value = "";
    applyFilterNarrow("");
    updateFilterUI();
  }

  // ---------- GRID + CARDS ----------
  // The renderAnimeCardMarkup function lives in card-render.js (loaded as a
  // classic <script> before this file) so both the homepage AND the admin
  // form can use it. See docs/SHIP-OUTPUT.md gate 5b for the why. Call via
  // window.renderAnimeCardMarkup since the function isn't in this closure.

  // v1.8.4 gate 5 — shared save-button wiring for ANY card (catalog or discovery
  // outside card). animeId is the save doc id: slug(Title) for catalog, al:<id> for
  // an outside AniList title. Signed-out click opens the branded sign-in modal.
  // Single source so createCard and createDiscoveryCard never drift.
  function wireCardSaveButtons(card, animeId, title) {
    applySavedStateToCard(card, animeId);
    const favBtn = card.querySelector(".fav-btn");
    const watchBtn = card.querySelector(".watch-btn");
    async function handleToggle(kind, btn) {
      const user = auth.currentUser;
      if (!user) { openAuth('signin'); return; }   // site-wide: signed-out save -> sign in
      const setRef = (kind === "favorites") ? favoritesSet : watchlistSet;
      const turnOn = !btn.classList.contains("is-on");
      if (turnOn) setRef.add(animeId); else setRef.delete(animeId);   // optimistic
      syncSavedUIForAnime(animeId);
      btn.disabled = true;
      try {
        await setSave(kind, user.uid, animeId, title, turnOn);
      } catch (err) {
        if (turnOn) setRef.delete(animeId); else setRef.add(animeId);   // rollback
        syncSavedUIForAnime(animeId);
        alert("Failed to save: " + (err.message || String(err)));
      } finally {
        btn.disabled = false;
      }
    }
    favBtn?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); handleToggle("favorites", favBtn); }, { passive: false });
    watchBtn?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); handleToggle("watchlist", watchBtn); }, { passive: false });
  }

  function createCard(anime, opts = {}) {
  const animeId = slug(anime.Title);
  // v1.8.4 gate 2 — `pinned`/`newlyReviewed` only matter when a CATALOG card is
  // surfaced on a discovery surface (the per-card blend + the upgrade shimmer).
  // On Blake's own surfaces opts is empty, so this is byte-identical to before.
  const card = window.renderAnimeCardMarkup(anime, {
    animeId, pinned: !!opts.pinned, newlyReviewed: !!opts.newlyReviewed,
  });

  // Open modal when the card itself is clicked
  card.addEventListener("click", () => openModal(anime));
  // a11y — keyboard activation (the card is role=button, tabindex=0). Enter/Space
  // reuse the click action; only when the CARD itself is focused (not a nested
  // fav/watch button, whose own keys fire their button + stopPropagation).
  card.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " " || e.key === "Spacebar") && e.target === card) {
      e.preventDefault();   // Space would otherwise scroll the page
      card.click();
    }
  });

  // Initial icon state + fav/watch wiring (shared with discovery outside cards).
  wireCardSaveButtons(card, animeId, anime.Title);

  return card;
}

// ════════════════════════════════════════════════════════════════════════
// v1.8.4 (gate 2) — DISCOVERY / OUTSIDE CARDS (the per-card blend)
// One shell (renderAnimeCardMarkup), two reads:
//   - an AniList title that is NOT in Blake's 44  -> outside card (NOT REVIEWED
//     sticker, community score only, click -> the FREE openSecondaryModal path).
//   - an AniList title that IS one of his 44      -> the REAL reviewed catalog
//     card (gold rating, main modal) + the "Reviewed by Blake" pin. That upgrade
//     is the standout blend pitch: the wider world lights up where he's been.
// These builders are G2 infra: WIRED to the page in G3 (Discover) / G4 (For You).
// ════════════════════════════════════════════════════════════════════════

// Pick the best display title from a normalizeListMedia node.
function bestMediaTitle(m) {
  const t = (m && m.title) || {};
  return t.english || t.romaji || t.native || 'Untitled';
}

// Map a normalizeListMedia node -> the `anime`-shaped props renderAnimeCardMarkup
// consumes. ⚠️ AniList strings are UNTRUSTED — escape every one here (the card
// renderer interpolates raw, by design, since catalog data is trusted). The cover
// is a full https URL, so we pass assetBase:'' at the call site (not 'assets/').
function mediaToCardProps(m) {
  const t = (m && m.title) || {};
  // v1.8.4 gate 3c (item 8) — a null/0 AniList score shows an explicit, quiet "N/A"
  // chip (score-none tier => slate) instead of a blank, so it reads "no score".
  const score = (typeof m.averageScore === 'number' && m.averageScore > 0) ? m.averageScore + '%' : 'N/A';
  return {
    Title: escapeHtml(bestMediaTitle(m)),
    TitleEnglish: escapeHtml(t.english || ''),
    TitleRomaji: escapeHtml(t.romaji || ''),
    TitleNative: escapeHtml(t.native || ''),
    image: escapeHtml((m.coverImage && m.coverImage.large) || ''),
    // v1.8.4 gate 3b (item 8c) — cap at the top-2 genres PER CARD (AniList orders
    // genres by relevance), e.g. "Action, Adventure, Comedy" -> "Action, Adventure".
    Genre: escapeHtml((Array.isArray(m.genres) ? m.genres : []).slice(0, 2).join(', ')),
    Rating: score,                 // community score (digits + %), distinct from Blake's gold "N/10"
    AniListId: m.id,
  };
}

// v1.8.4 gate 3b (item 8b) — score tier for the community-score chip color.
// AniList averageScore is 0-100. Breakpoints: >=78 high (green/gold), 65-77 mid
// (neutral purple), 1-64 low (muted red), 0/none -> no tier (plain chip).
function scoreTier(averageScore) {
  const n = Number(averageScore);
  if (!Number.isFinite(n) || n <= 0) return 'none';
  if (n >= 78) return 'high';
  if (n >= 65) return 'mid';
  return 'low';
}

// ── Newly-reviewed shimmer seen-state (the "upgrade moment" scaffold) ──
// The shimmer should fire ONLY when a title the user previously met as
// NOT-REVIEWED has since joined the catalog — not on every first-ever pin. So we
// track two localStorage sets: ids seen as outside cards, and ids we've already
// shimmered. A pinned (reviewed) discovery card shimmers once iff it was seen
// outside before AND hasn't shimmered yet.
const NOT_REVIEWED_SEEN_KEY = 'rar:nrseen:v1';
const NEWLY_REVIEWED_SHOWN_KEY = 'rar:nrshown:v1';
function loadIdSet(key) { try { return new Set((JSON.parse(localStorage.getItem(key) || '[]') || []).map(Number)); } catch (_) { return new Set(); } }
function saveIdSet(key, set) { try { localStorage.setItem(key, JSON.stringify([...set])); } catch (_) {} }
let notReviewedSeen = loadIdSet(NOT_REVIEWED_SEEN_KEY);
let newlyReviewedShown = loadIdSet(NEWLY_REVIEWED_SHOWN_KEY);
function recordSeenOutside(id) {
  id = Number(id); if (!id || notReviewedSeen.has(id)) return;
  notReviewedSeen.add(id); saveIdSet(NOT_REVIEWED_SEEN_KEY, notReviewedSeen);
}
function isNewlyReviewed(id) {
  id = Number(id); if (!id) return false;
  return notReviewedSeen.has(id) && !newlyReviewedShown.has(id);
}
function markNewlyReviewedShown(id) {
  id = Number(id); if (!id || newlyReviewedShown.has(id)) return;
  newlyReviewedShown.add(id); saveIdSet(NEWLY_REVIEWED_SHOWN_KEY, newlyReviewedShown);
}

// Build a discovery card from a normalizeListMedia node. Returns the upgrade
// (pinned catalog) card when the id is one of Blake's 44, else an outside card.
function createDiscoveryCard(media) {
  if (!media || !media.id) return null;
  const catalog = findInCatalog(media);
  if (catalog) {
    // The per-card blend: render his real reviewed card + the pin. If this title
    // was previously seen as NOT-REVIEWED, give it the one-time upgrade shimmer.
    const shimmer = isNewlyReviewed(media.id);
    const card = createCard(catalog, { pinned: true, newlyReviewed: shimmer });
    if (shimmer) markNewlyReviewedShown(media.id);
    return card;
  }
  // Outside card: not one of his 44.
  recordSeenOutside(media.id);
  const props = mediaToCardProps(media);
  // v1.8.4 gate 5 carry-over #2 — the save doc id is the al:<id> discriminator (the
  // SAME id the secondary modal saves under), so saving here and from the modal are
  // one and the same, and applySavedStateToCard reflects favoritesSet/watchlistSet.
  const saveId = anilistSaveId(media.id);
  const card = window.renderAnimeCardMarkup(props, {
    animeId: saveId, assetBase: '', reviewed: false,
  });
  card.dataset.anilistId = String(media.id);
  // v1.8.4 gate 3b (item 8b) — tint the community-score chip by rating tier.
  card.classList.add('score-' + scoreTier(media.averageScore));
  // The FREE NOT-REVIEWED path: the v1.7.4 secondary modal renders any AniList id
  // as "NOT REVIEWED YET" + a Request pill, with no moreInfo context needed.
  card.addEventListener('click', () => openSecondaryModal(Number(media.id), null, null));
  // v1.8.4 gate 5 carry-over #2 — outside cards now save too (CSS stacks the icons
  // vertically on the right, clear of the NOT-REVIEWED badge). Same shared wiring as
  // catalog cards; the AniList title is stored as the save's display title.
  wireCardSaveButtons(card, saveId, bestMediaTitle(media));
  // a11y — keyboard activation (the card is role=button, tabindex=0). Guard on
  // e.target === card so Enter/Space on a nested fav/watch button fires only the
  // button (not also the card's open-modal action).
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') && e.target === card) {
      e.preventDefault();
      card.click();
    }
  });
  return card;
}

// ════════════════════════════════════════════════════════════════════════
// v1.8.4 (gate 3) — DISCOVER SURFACE (the wider world)
// Live AniList search (Blake's 44 pinned first) + airing Top-10 + airing-by-
// genre + community "Popular right now". LAZY: nothing hits AniList until the
// surface is first opened, so the home's first paint stays fully local. Rails
// are SIMPLE horizontal scrollers (no auto-marquee, no scroll-linked paint) —
// the Gecko-safe choice while live data + the freshness shuffle are both new
// this ship (stage each for the Profiler, per the v1.8.0 lessons).
// ════════════════════════════════════════════════════════════════════════

// Curated genre chooser — the ~16 mainstream AniList genres (NOT the tag
// firehose). This is Discover's only "browse" filter; everything else is search.
const DISCOVER_GENRES = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller'];

// Per-session freshness seed: stable within a login, new each login, so the
// shuffled pools show a different face per visit without churning mid-session.
function freshSeed() {
  try {
    let s = sessionStorage.getItem('rar:freshseed');
    if (!s) { s = String((secureRandomInt(2147483647) >>> 0) || 1); sessionStorage.setItem('rar:freshseed', s); }
    return (parseInt(s, 10) >>> 0) || 1;
  } catch (_) { return 1; }
}
// mulberry32 — tiny deterministic PRNG. Same seed => same order (the whole point).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seed) {
  const a = arr.slice();
  const rnd = mulberry32(seed >>> 0);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let discoverBuilt = false;
let discoverSearchDebounce = null;
let discoverSearchAbort = null;
let discoverGenreToken = 0;
let discoverLastSearchTerm = '';

// ── v1.8.4 gate 3b — branded async-state helpers ──
// Loading SKELETON: a true card silhouette (zero layout shift), one shared
// transform-translated sweep (CSS .disc-skel::after — no per-card JS timers).
function railSkeleton(n) {
  let html = '';
  for (let i = 0; i < (n || 5); i++) {
    html += '<div class="disc-skel" aria-hidden="true"><div class="ds-poster"></div>'
      + '<div class="ds-info"><span class="ds-line"></span><span class="ds-line short"></span><span class="ds-chip"></span></div></div>';
  }
  return html;
}
function setRailLoading(el) { if (el) el.innerHTML = railSkeleton(5); }

// Branded empty/error state — the v1.7.1 .search-empty-card vocabulary, scoped
// .is-discover (telescope glyph, bilingual kicker, optional CTA). Returns a node
// so the CTA handler attaches directly. The body is the one live-string surface —
// escaped here. No provider names.
function discoverEmptyCard(opts = {}) {
  const mode = opts.mode === 'error' ? 'error' : 'empty';
  const el = document.createElement('div');
  el.className = 'search-empty-card is-discover' + (mode === 'error' ? ' is-error' : '');
  const kicker = mode === 'error' ? 'LOST THE SIGNAL' : (opts.kicker || 'NOTHING OUT THERE');
  const jp = mode === 'error' ? '接続エラー' : (opts.jp || '該当なし');
  const body = opts.body || (mode === 'error' ? "Couldn't reach the wider world just now." : 'Nothing surfaced here right now.');
  let html = '<div class="se-glyph" aria-hidden="true">&#128301;</div>'   // telescope
    + '<div class="se-kicker">' + escapeHtml(kicker) + ' <span class="jp-mini">' + escapeHtml(jp) + '</span></div>'
    + '<p class="se-body">' + escapeHtml(body) + '</p>';
  if (opts.cta) html += '<button type="button" class="se-cta">' + escapeHtml(opts.cta) + ' <span class="se-arrow" aria-hidden="true">&rarr;</span></button>';
  el.innerHTML = html;
  if (opts.cta && typeof opts.onCta === 'function') {
    const btn = el.querySelector('.se-cta');
    if (btn) btn.addEventListener('click', opts.onCta);
  }
  return el;
}

// Pre-decode the first screenful of a rail's covers so the first auto-advance
// doesn't hitch on a mid-scroll decode (perf vet D). Bounded + error-swallowed.
function predecodeRail(el, count) {
  if (!el) return;
  [...el.querySelectorAll('img')].slice(0, count || 8).forEach((img) => {
    try { if (img.decode) img.decode().catch(() => {}); } catch (_) {}
  });
}

// ════════════════════════════════════════════════════════════════════════
// v1.8.4 gate 3b (item 6) — RAIL AUTO-ADVANCE.
// ONE shared rAF + ONE shared IntersectionObserver drive ALL rails. A rail only
// moves while it's on-screen AND the tab is visible; native manual scroll is
// preserved (we only WRITE scrollLeft, never read it in a hot path); pauses on
// any manual interaction and resumes after idle; reduced-motion => never starts
// (plain native scroller). No will-change, no scroll listeners. dt-normalized so
// every refresh rate moves at the same gentle visual rate. This honors the gate's
// SPIRIT (cheap, compositor-friendly, reduced-motion-static) while keeping manual
// scroll — which a pure transform marquee cannot. Stage for Blake's Profiler.
// ════════════════════════════════════════════════════════════════════════
const discoverRails = new Map();        // el -> { pos, dir, max, paused, visible, resumeTimer }
let discoverRafId = null;
let discoverLastTs = 0;
let _discoverIO = null;
const DISCOVER_SPEED = 0.018;           // px per ms (~18 px/s — genuinely gentle)

function recomputeRailMax(el, st) {
  st.max = Math.max(0, el.scrollWidth - el.clientWidth);
  if (st.pos > st.max) st.pos = st.max; // re-clamp after a re-render/resize (fixes ping-pong overshoot)
}
function discoverRailTick(ts) {
  discoverRafId = null;
  if (document.hidden) { discoverLastTs = 0; return; }   // tab hidden -> idle, restart on visibility
  const dt = discoverLastTs ? Math.min(64, ts - discoverLastTs) : 16;
  discoverLastTs = ts;
  let anyActive = false;
  discoverRails.forEach((st, el) => {
    if (st.paused || !st.visible || st.max <= 2) return;
    anyActive = true;
    st.pos += DISCOVER_SPEED * dt * st.dir;
    if (st.pos >= st.max) { st.pos = st.max; st.dir = -1; }
    else if (st.pos <= 0) { st.pos = 0; st.dir = 1; }
    el.scrollLeft = st.pos;             // write-only — no per-frame layout read
  });
  if (anyActive) discoverRafId = requestAnimationFrame(discoverRailTick);
  else discoverLastTs = 0;             // nothing active -> let the loop idle
}
function ensureDiscoverRaf() {
  if (REDUCED_MOTION) return;
  if (discoverRafId == null) { discoverLastTs = 0; discoverRafId = requestAnimationFrame(discoverRailTick); }
}
function discoverRailObserver() {
  if (_discoverIO) return _discoverIO;
  _discoverIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const st = discoverRails.get(e.target);
      if (!st) return;
      st.visible = e.isIntersecting;
      if (st.visible) { recomputeRailMax(e.target, st); ensureDiscoverRaf(); }
    });
  }, { threshold: 0.01 });
  return _discoverIO;
}
// Mount the shared gentle auto-advance on a native-scroll element. Used by BOTH
// the Discover rails AND (gate 3c, item 9) the Den "Anime By Genre" rails — one
// motion language site-wide. opts.dir sets the initial drift direction (alternate
// the Den rails for variety). Handlers are stored so destroyDiscoverCarousel can
// remove them cleanly on teardown/rebuild.
function mountDiscoverCarousel(el, opts = {}) {
  if (!el || REDUCED_MOTION) return;    // reduced-motion: leave it a plain native scroller
  if (discoverRails.has(el)) { recomputeRailMax(el, discoverRails.get(el)); return; }
  const st = { pos: el.scrollLeft || 0, dir: opts.dir === -1 ? -1 : 1, max: 0, paused: false, visible: false, resumeTimer: null, handlers: null };
  recomputeRailMax(el, st);
  const pause = () => { st.paused = true; };
  const resumeSoon = () => {
    clearTimeout(st.resumeTimer);
    st.resumeTimer = setTimeout(() => { st.pos = el.scrollLeft; recomputeRailMax(el, st); st.paused = false; ensureDiscoverRaf(); }, 1600);
  };
  const onWheel = () => { pause(); resumeSoon(); };
  const onDown = () => { pause(); resumeSoon(); };
  st.handlers = { pause, resumeSoon, onWheel, onDown };
  el.addEventListener('pointerenter', pause);
  el.addEventListener('pointerleave', resumeSoon);
  el.addEventListener('focusin', pause);
  el.addEventListener('focusout', resumeSoon);
  el.addEventListener('touchstart', pause, { passive: true });
  el.addEventListener('touchend', resumeSoon, { passive: true });
  el.addEventListener('wheel', onWheel, { passive: true });
  el.addEventListener('pointerdown', onDown);
  discoverRails.set(el, st);
  discoverRailObserver().observe(el);
}
// Fully tear down a rail's auto-advance (remove listeners, unobserve, clear timer,
// drop from the Map). Used by the Den rail rebuild/shuffle.
function destroyDiscoverCarousel(el) {
  const st = el && discoverRails.get(el);
  if (!st) return;
  clearTimeout(st.resumeTimer);
  const h = st.handlers || {};
  el.removeEventListener('pointerenter', h.pause);
  el.removeEventListener('pointerleave', h.resumeSoon);
  el.removeEventListener('focusin', h.pause);
  el.removeEventListener('focusout', h.resumeSoon);
  el.removeEventListener('touchstart', h.pause);
  el.removeEventListener('touchend', h.resumeSoon);
  el.removeEventListener('wheel', h.onWheel);
  el.removeEventListener('pointerdown', h.onDown);
  try { if (_discoverIO) _discoverIO.unobserve(el); } catch (_) {}
  discoverRails.delete(el);
}
// Call after a rail (re-)renders cards: pre-decode the screenful, mount/refresh the
// carousel, recompute max after layout settles.
function refreshDiscoverCarousel(el) {
  if (!el) return;
  predecodeRail(el, 8);
  if (REDUCED_MOTION) return;
  mountDiscoverCarousel(el);
  requestAnimationFrame(() => {
    const st = discoverRails.get(el);
    if (st) { recomputeRailMax(el, st); }
    ensureDiscoverRaf();
  });
}

// A small bilingual dateline per rail (honest data already in hand). No motion.
function seasonLabel(list) {
  const m = (Array.isArray(list) ? list : []).find((x) => x && x.season && x.seasonYear);
  if (!m) return '';
  const jp = ({ WINTER: '冬', SPRING: '春', SUMMER: '夏', FALL: '秋' })[m.season] || '';
  const en = m.season.charAt(0) + m.season.slice(1).toLowerCase();
  return en + ' ' + m.seasonYear + (jp ? ' · ' + jp : '');
}
function setRailMeta(blockId, text) {
  const block = document.getElementById(blockId);
  if (!block) return;
  // v1.8.4 gate 3e (item 6) — the dateline pill lives on the RIGHT of the subrow
  // (the descriptive tagline is on the left, under the heading). Create the subrow
  // if the block doesn't have one (so it works even without a static tagline).
  let row = block.querySelector('.discover-subrow');
  if (!row) {
    row = document.createElement('div');
    row.className = 'discover-subrow';
    const head = block.querySelector('.discover-block-head');
    if (head) head.insertAdjacentElement('afterend', row);
    else block.insertBefore(row, block.firstChild);
  }
  let pill = row.querySelector('.drm-pill');
  if (!text) { if (pill) pill.remove(); return; }
  if (!pill) { pill = document.createElement('span'); pill.className = 'drm-pill'; row.appendChild(pill); }
  pill.textContent = text;   // textContent => no XSS
}

// Render media nodes into a rail/grid as discovery cards. Honest async states:
// null list => branded error card; empty list => branded empty card; else cards
// (+ mount the auto-advance carousel when opts.carousel). No provider names.
function renderDiscoverInto(el, list, opts = {}) {
  if (!el) return;
  el.innerHTML = '';
  if (!Array.isArray(list)) {
    el.appendChild(discoverEmptyCard({ mode: 'error', cta: opts.onRetry ? 'Try again' : null, onCta: opts.onRetry }));
    return;
  }
  if (!list.length) {
    el.appendChild(discoverEmptyCard({ mode: 'empty', body: opts.empty || 'Nothing to show here right now.' }));
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach((m) => { const c = window.rarDiscovery.createDiscoveryCard(m); if (c) frag.appendChild(c); });
  el.appendChild(frag);
  // v1.8.4 gate 3d (item 4) — center a rail ONLY when its cards actually FIT (no
  // overflow). The G3c bug: a count threshold (<=4) left a 5-7 card rail that fit
  // the width left-hugging. Cards are fixed-width (CSS), so scrollWidth is accurate
  // synchronously here. Overflowing rails stay flex-start so the carousel can scroll.
  el.classList.toggle('is-sparse', el.scrollWidth <= el.clientWidth + 1);
  if (opts.carousel) refreshDiscoverCarousel(el);
}

// Build the default sections (airing / by-genre / community). Lazy + L2-cached.
async function buildDiscoverSections() {
  const seed = freshSeed();

  // 1) Airing Top 10 — the ACTUAL ranked top of currently-airing (no shuffle: a
  //    "Top 10" that reshuffles isn't a top 10). Trending-sorted by the query.
  setRailLoading(discoverAiringEl);
  const airing = await window.rarDiscovery.fetchAiringCached('all');
  renderDiscoverInto(discoverAiringEl, Array.isArray(airing) ? airing.slice(0, 10) : null,
    { empty: 'Nothing airing surfaced right now.', carousel: true, onRetry: buildDiscoverSections });
  setRailMeta('discover-airing-block', seasonLabel(airing));

  // 2) Community picks — seeded shuffle of the DEEP trending pool (fresh per login).
  setRailLoading(discoverTrendingEl);
  const trending = await window.rarDiscovery.fetchTrendingCached();
  renderDiscoverInto(discoverTrendingEl,
    Array.isArray(trending) ? seededShuffle(trending, seed).slice(0, 18) : null,
    { empty: "Couldn't load popular titles right now.", carousel: true, onRetry: buildDiscoverSections });
  setRailMeta('discover-trending-block', (Array.isArray(trending) && trending.length) ? 'Refreshed this visit' : '');

  // 3) Airing-by-genre chips + the first genre's rail.
  buildDiscoverGenreChips();
  selectDiscoverGenre(DISCOVER_GENRES[0]);
}

function buildDiscoverGenreChips() {
  if (!discoverGenreChipsEl || discoverGenreChipsEl.childElementCount) return;
  const frag = document.createDocumentFragment();
  DISCOVER_GENRES.forEach((g, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'discover-genre-chip' + (i === 0 ? ' is-active' : '');
    btn.textContent = g;                       // textContent => no XSS risk
    btn.setAttribute('data-genre', g);
    btn.addEventListener('click', () => selectDiscoverGenre(g));
    frag.appendChild(btn);
  });
  discoverGenreChipsEl.appendChild(frag);
}

async function selectDiscoverGenre(genre) {
  if (!discoverGenreRailEl) return;
  if (discoverGenreChipsEl) {
    discoverGenreChipsEl.querySelectorAll('.discover-genre-chip').forEach((c) =>
      c.classList.toggle('is-active', c.getAttribute('data-genre') === genre));
  }
  const token = ++discoverGenreToken;          // ignore a stale fetch if a newer chip wins
  setRailLoading(discoverGenreRailEl);
  const list = await window.rarDiscovery.fetchAiringCached(genre);
  if (token !== discoverGenreToken) return;
  const seeded = Array.isArray(list) ? seededShuffle(list, freshSeed()).slice(0, 18) : null;
  renderDiscoverInto(discoverGenreRailEl, seeded,
    { empty: `Nothing airing in ${genre} right now — try another genre.`, carousel: true, onRetry: () => selectDiscoverGenre(genre) });
}

// ── Live search: pin his 44 first, then an exact-title BOOST over AniList's
//    messy SEARCH_MATCH order (the G1 "demon slayer ranked a short #1" finding),
//    a "From the wider world" divider, then outside cards. ──
function discoverTitleScore(m, qWords, full) {
  const t = (bestMediaTitle(m) || '').toLowerCase();
  let s = 0;
  if (t === full) s += 100;
  else if (t.startsWith(full)) s += 50;
  if (t.includes(full)) s += 8;
  s += qWords.filter((w) => t.includes(w)).length * 10;   // word coverage
  return s;
}
// Partition AniList search results into Blake's 44 (pinned) vs the wider world,
// each ordered by the exact-title boost over AniList's raw SEARCH_MATCH order
// (the G1 "demon slayer ranked a short #1" fix). Pure — single source for the
// renderer + the spec + (later) For-You. Returns { pinned:[], outside:[] }.
function rankDiscoverResults(results, term) {
  const list = Array.isArray(results) ? results : [];
  const qWords = String(term || '').toLowerCase().split(/\s+/).filter(Boolean);
  const full = qWords.join(' ');
  const pinned = [], outside = [];
  list.forEach((m, i) => { (findInCatalog(m) ? pinned : outside).push({ m, i }); });
  const byRelevance = (arr) => arr
    .map((x) => ({ m: x.m, i: x.i, s: discoverTitleScore(x.m, qWords, full) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map((x) => x.m);
  return { pinned: byRelevance(pinned), outside: byRelevance(outside) };
}
function runDiscoverSearch(q) {
  const term = String(q || '').trim();
  if (discoverSearchClear) discoverSearchClear.hidden = !term;
  if (!term) {
    if (discoverSearchResults) { discoverSearchResults.hidden = true; discoverSearchResults.innerHTML = ''; }
    if (discoverSectionsEl) discoverSectionsEl.hidden = false;
    if (discoverSearchAbort) { discoverSearchAbort.abort(); discoverSearchAbort = null; }
    return;
  }
  discoverLastSearchTerm = term;
  if (discoverSectionsEl) discoverSectionsEl.hidden = true;
  if (discoverSearchResults) {
    discoverSearchResults.hidden = false;
    discoverSearchResults.innerHTML = `<div class="discover-results-grid">${railSkeleton(6)}</div>`;
  }
  if (discoverSearchAbort) discoverSearchAbort.abort();   // abort the in-flight request
  const ctrl = new AbortController();
  discoverSearchAbort = ctrl;
  window.rarDiscovery.searchDiscover(term, ctrl.signal).then((results) => {
    if (ctrl.signal.aborted || ctrl !== discoverSearchAbort) return;
    renderDiscoverSearchResults(results, term);
  }).catch(() => {
    if (ctrl === discoverSearchAbort) renderDiscoverSearchResults(null, term);
  });
}
function renderDiscoverSearchResults(results, term) {
  if (!discoverSearchResults) return;
  discoverSearchResults.innerHTML = '';
  if (!Array.isArray(results)) {
    discoverSearchResults.appendChild(discoverEmptyCard({
      mode: 'error', cta: 'Try again', onCta: () => runDiscoverSearch(term),
    }));
    return;
  }
  const { pinned: pinnedSorted, outside: outsideSorted } = rankDiscoverResults(results, term);
  if (!pinnedSorted.length && !outsideSorted.length) {
    discoverSearchResults.appendChild(discoverEmptyCard({
      body: `No matches for "${term}" — try a different title.`,
      cta: 'Clear search',
      onCta: () => {
        if (discoverSearchInput) { discoverSearchInput.value = ''; discoverSearchInput.focus(); }
        runDiscoverSearch('');
      },
    }));
    return;
  }
  const grid = (list) => {
    const g = document.createElement('div');
    g.className = 'discover-results-grid';
    list.forEach((m) => { const c = window.rarDiscovery.createDiscoveryCard(m); if (c) g.appendChild(c); });
    return g;
  };
  // The "Reviewed by Blake" hero shelf — the per-card blend's centerpiece. A gold
  // VIP slab with a real header row (static labels — no XSS surface). Wraps the
  // pinned grid; the wider-world divider below reads as a distinct second shelf.
  if (pinnedSorted.length) {
    const shelf = document.createElement('section');
    shelf.className = 'discover-blake-shelf';
    shelf.innerHTML =
      '<div class="dbs-head"><span class="dbs-seal" aria-hidden="true">&#9733;</span>'
      + '<span class="dbs-kicker">REVIEWED BY BLAKE <span class="jp-mini">監修</span></span></div>'
      + '<p class="dbs-sub">Titles he’s actually sat down with</p>';
    shelf.appendChild(grid(pinnedSorted));
    discoverSearchResults.appendChild(shelf);
  }
  if (outsideSorted.length) {
    const head = document.createElement('div');
    head.className = 'discover-results-divider';
    head.textContent = 'From the wider world';
    discoverSearchResults.appendChild(head);
    discoverSearchResults.appendChild(grid(outsideSorted));
  }
}

// The Discover 3-way lens — CSS-only filtering of already-rendered cards (no
// refetch, no re-render): toggles a class on #discover-view; CSS hides the
// non-matching cards. Fast + Gecko-safe.
function setDiscoverLens(which) {
  const target = (which === 'reviewed' || which === 'notyet') ? which : 'all';
  if (discoverLens) {
    discoverLens.querySelectorAll('.fr-seg').forEach((b) => {
      const on = b.getAttribute('data-reviewed') === target;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  if (discoverView) {
    discoverView.classList.remove('lens-all', 'lens-reviewed', 'lens-notyet');
    discoverView.classList.add('lens-' + target);
  }
}
function wireDiscoverLens() {
  if (!discoverLens) return;
  discoverLens.querySelectorAll('.fr-seg').forEach((b) => {
    b.addEventListener('click', () => setDiscoverLens(b.getAttribute('data-reviewed')));
  });
}

function showDiscover() {
  if (!discoverView) return;
  filterPanel?.classList.remove('open');
  document.body.classList.remove('filter-open');
  homeView.style.display = 'none';
  allView.style.display = 'none';
  if (foryouView) foryouView.style.display = 'none';   // v1.8.4 gate 4 — one surface at a time
  discoverView.style.display = 'block';
  stopSpotlightCycle();
  hideGenreRails();
  setFilterHasOutsideCards(true);     // the panel's 3-way "Unreviewed" enables here too
  setDiscoverLens('all');
  if (!discoverBuilt) { discoverBuilt = true; buildDiscoverSections(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  headerEl?.classList.remove('header--hidden');
  setActivePlace(discoverBtn);        // light Discover, slide the marker
}
function hideDiscover() {
  if (discoverView) discoverView.style.display = 'none';
  discoverBtn?.classList.remove('is-active');
  setFilterHasOutsideCards(false);
  // Idle the auto-advance immediately (the IO also fires not-intersecting on
  // display:none, but flip the flag now so the rAF loop stops this frame). Clear
  // any pending resume timers too, so they don't accumulate across show/hide cycles.
  discoverRails.forEach((st) => { clearTimeout(st.resumeTimer); st.resumeTimer = null; st.visible = false; });
}

// ════════════════════════════════════════════════════════════════════════
// v1.8.4 (gate 4) — FOR YOU SURFACE (his shelf, pulled near you)
// His picks NEAR the user's taste. Taste = top genres of the user's saved
// CATALOG entries (his 44 only — al:<id> outside saves carry no vocabulary),
// weighted favorites > watchlist > recent. Each "MORE {genre}" rail LEADS with
// his gold pinned cards, then a slim boundary, then the wider world as the
// supporting cast — so the heart is the entrance, never buried. Rails are minted
// ONLY from genres he reviewed, so a gold-less ("generic feed") rail is
// structurally impossible. Reuses the Discover native-scroll auto-drift language,
// NOT the Den marquee. LAZY: nothing hits AniList until For You opens; the L2
// caches (12h airing / 24h trending) back the pools. No provider names.
// ════════════════════════════════════════════════════════════════════════

// Signal weights per saved CATALOG entry, summed ADDITIVELY across buckets (a
// favorited title you also recently opened scores 3+1=4 — a true love floats up).
const TASTE_WEIGHTS = { favorite: 3, watchlist: 2, recent: 1 };
const TASTE_RAIL_CAP = 3;       // fewer, richer rails => highest gold density per screen
const TASTE_FLOOR = 4;          // a genre needs >= this summed weight to earn a rail
const TASTE_LEAD_CAP = 6;       // max his-gold lead cards per rail
const TASTE_WORLD_CAP = 12;     // max wider-world cards per rail
let foryouBuildToken = 0;       // aborts a stale async build when saves/auth change

// His Genre vocabulary isn't AniList's 16 (DISCOVER_GENRES), and fetchAiringCached
// passes ONE genre String to AniList. Map his tokens -> a fetchable AniList genre.
// Demographic tokens (Shonen/Seinen/…) DROP — they aren't AniList genres and their
// weight already lands on co-genres. Unmapped tokens drop from rail candidacy.
const TASTE_GENRE_MAP = {
  'shonen': null, 'shounen': null, 'seinen': null, 'shoujo': null, 'shojo': null, 'josei': null,
  'isekai': 'Fantasy', 'studio ghibli': 'Fantasy',
  'idol': 'Music', 'musical': 'Music',
  'slice of life': 'Slice of Life', 'sol': 'Slice of Life',
};
// Per-genre JP glyph for the rail head (matches Discover's bilingual block-heads).
const GENRE_JP = {
  'Action': 'アクション', 'Adventure': '冒険', 'Comedy': 'コメディ', 'Drama': 'ドラマ',
  'Fantasy': 'ファンタジー', 'Horror': 'ホラー', 'Mecha': 'メカ', 'Music': '音楽',
  'Mystery': 'ミステリー', 'Psychological': '心理', 'Romance': '恋愛', 'Sci-Fi': 'SF',
  'Slice of Life': '日常', 'Sports': 'スポーツ', 'Supernatural': '超自然', 'Thriller': 'スリラー',
};
function mapTasteGenre(token) {
  const k = String(token || '').trim().toLowerCase();
  if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(TASTE_GENRE_MAP, k)) return TASTE_GENRE_MAP[k];
  const hit = DISCOVER_GENRES.find((g) => g.toLowerCase() === k);
  return hit || null;
}
let _catalogBySlug = null;
function catalogBySlug() {
  if (!_catalogBySlug) _catalogBySlug = new Map((animeData || []).map((a) => [slug(a.Title), a]));
  return _catalogBySlug;
}
function parseRating(a) {
  const m = String((a && a.Rating) || '').match(/([\d.]+)/);   // his catalog Rating is "N/10"
  return m ? (parseFloat(m[1]) || 0) : 0;
}
// His 44 whose Genre maps into the AniList genre g (the cards a g-rail can lead with).
function hisCatalogInGenre(g) {
  return (animeData || []).filter((a) => getGenres(a).some((tok) => mapTasteGenre(tok) === g));
}

// PURE core (exposed for tests): given saved doc-id arrays (each most-recent-first),
// compute the taste profile + the ranked/floored/capped rail genres. Depends only on
// the constant animeData + the args, so it's deterministic and Firestore-free.
function computeTasteProfile(saves) {
  const favorites = (saves && saves.favorites) || [];
  const watchlist = (saves && saves.watchlist) || [];
  const recent = (saves && saves.recent) || [];
  const bySlug = catalogBySlug();

  // Per distinct catalog entry, sum the bucket weights (additive). al:<id> / unknown
  // ids resolve to no catalog entry and are skipped — only his 44 carry his vocab.
  const entryWeight = new Map();          // slug -> weight
  const bump = (ids, w) => (ids || []).forEach((id) => {
    if (!bySlug.has(id)) return;
    entryWeight.set(id, (entryWeight.get(id) || 0) + w);
  });
  bump(favorites, TASTE_WEIGHTS.favorite);
  bump(watchlist, TASTE_WEIGHTS.watchlist);
  bump(recent.slice(0, 6), TASTE_WEIGHTS.recent);

  const genreScore = new Map();           // aniListGenre -> weight
  const genreEntries = new Map();         // aniListGenre -> [{slug, weight, anime}] (this user's saves in g)
  const tagScore = new Map();             // tag -> weight (ranking/copy flavor only; never mints a rail)
  entryWeight.forEach((w, s) => {
    const a = bySlug.get(s);
    const mappedSeen = new Set();         // count each entry once per distinct mapped genre
    getGenres(a).forEach((tok) => {
      const g = mapTasteGenre(tok);
      if (!g || mappedSeen.has(g)) return;
      mappedSeen.add(g);
      genreScore.set(g, (genreScore.get(g) || 0) + w);
      if (!genreEntries.has(g)) genreEntries.set(g, []);
      genreEntries.get(g).push({ slug: s, weight: w, anime: a });
    });
    safeArray(a.Tags).forEach((t) => {
      const k = String(t || '').toLowerCase();
      if (k) tagScore.set(k, (tagScore.get(k) || 0) + w);
    });
  });

  const ranked = [...genreScore.entries()].map(([g, score]) => {
    const hisIn = hisCatalogInGenre(g);
    return {
      genre: g,
      score,
      distinct: (genreEntries.get(g) || []).length,
      catalogCount: hisIn.length,
      catalogRating: hisIn.reduce((sum, a) => sum + parseRating(a), 0),
      savedEntries: (genreEntries.get(g) || []).slice().sort((x, y) => y.weight - x.weight),
    };
  })
  .filter((r) => r.score >= TASTE_FLOOR && r.catalogCount > 0)   // hard rule: no gold lead, no rail
  .sort((a, b) =>
    (b.score - a.score) ||
    (b.distinct - a.distinct) ||
    (b.catalogCount - a.catalogCount) ||
    (b.catalogRating - a.catalogRating) ||
    (DISCOVER_GENRES.indexOf(a.genre) - DISCOVER_GENRES.indexOf(b.genre)));

  const rails = ranked.slice(0, TASTE_RAIL_CAP);
  const qualifies = entryWeight.size >= 2 && rails.length >= 1;
  return { totalScored: entryWeight.size, qualifies, thin: qualifies && ranked.length === 1, rails, tagScore };
}

function currentSaves() {
  return { favorites: [...favoritesSet], watchlist: [...watchlistSet], recent: readContinue() };
}

// The Editor's Note — a per-rail first-person byline that frames the rail as Blake
// reasoning about your shelf (the opposite of a recommendation row). Rotated by rail
// index so 3 rails don't read the same. textContent at the call site => XSS-safe.
// v1.8.4 gate 5 carry-over #1 — the copy must stay HONEST: only the gold leads are
// titles he's watched; the world band is unwatched. So "I've sat down with" attaches
// to his picks, and the world is "from around the world" — never a claim he watched
// the whole rail.
const FORYOU_NOTE_VARIANTS = [
  (t, g) => `Because you saved ${t} — my own ${g} reviews up front, then more from around the world.`,
  (t, g) => `You saved ${t}. The ${g} ones I've actually sat down with lead; the rest is from around the world.`,
  (t, g) => `Saw you grabbed ${t} — good taste. My ${g} picks first, then ${g} from the wider world.`,
];
function editorsNote(railInfo, idx) {
  const g = railInfo.genre.toLowerCase();
  const top = railInfo.savedEntries[0] && railInfo.savedEntries[0].anime;
  if (!top) return `My ${g} reviews up front, then more ${g} from around the world.`;
  return FORYOU_NOTE_VARIANTS[idx % FORYOU_NOTE_VARIANTS.length](top.Title, g);
}

// Build one "MORE {genre}" rail, hand-rolled (NOT renderDiscoverInto — that loops
// createDiscoveryCard over the list and silently drops any non-AniList-node child,
// so a createCard gold lead or the boundary element would vanish). Three bands:
// his gold leads -> a slim boundary -> the wider world (outside cards only).
async function buildForYouRail(railInfo, idx, shownIds, token) {
  if (!foryouSectionsEl) return;
  const g = railInfo.genre;
  const blockId = 'foryou-block-' + idx;

  const block = document.createElement('section');
  block.className = 'discover-block foryou-block';
  block.id = blockId;
  const head = document.createElement('h3');
  head.className = 'discover-block-head';
  const jp = GENRE_JP[g];
  head.textContent = 'MORE ' + g.toUpperCase();
  if (jp) { const sp = document.createElement('span'); sp.className = 'jp-mini'; sp.textContent = jp; head.appendChild(document.createTextNode(' ')); head.appendChild(sp); }
  block.appendChild(head);
  const subrow = document.createElement('div');
  subrow.className = 'discover-subrow';
  const note = document.createElement('p');
  note.className = 'discover-block-sub';
  note.textContent = editorsNote(railInfo, idx);   // trusted catalog title, textContent => safe
  subrow.appendChild(note);
  block.appendChild(subrow);
  const rail = document.createElement('div');
  rail.className = 'discover-rail foryou-rail';
  rail.id = 'foryou-rail-' + idx;
  block.appendChild(rail);
  foryouSectionsEl.appendChild(block);

  await fillForYouRailBands(rail, railInfo, shownIds, () => token !== foryouBuildToken);
  setRailMeta(blockId, 'Refreshed this visit');
}

// Fill the three blend bands (his gold leads -> gold-star seam -> the wider world) into
// a rail element. SHARED by the For You SURFACE rails and the compact For-You-on-home
// rail (which passes smaller caps). isStale() lets each caller use its OWN build token
// (the surface and the home teaser have independent lifecycles). Bails before mounting
// the drift if superseded during the async pool fetch.
async function fillForYouRailBands(railEl, railInfo, shownIds, isStale, opts = {}) {
  if (!railEl) return;
  const g = railInfo.genre;
  const leadCap = opts.leadCap || TASTE_LEAD_CAP;
  const worldCap = opts.worldCap || TASTE_WORLD_CAP;
  // BAND 1 — his gold leads (createCard pinned = the real gold "Reviewed by Blake"
  // card): the user's saved entries in g first (by weight), then his remaining 44 in g
  // by Rating.
  const savedSlugs = new Set(railInfo.savedEntries.map((e) => e.slug));
  const more = hisCatalogInGenre(g)
    .filter((a) => !savedSlugs.has(slug(a.Title)))
    .sort((x, y) => parseRating(y) - parseRating(x));
  const leadEntries = [...railInfo.savedEntries.map((e) => e.anime), ...more].slice(0, leadCap);
  leadEntries.forEach((a) => railEl.appendChild(createCard(a, { pinned: true })));

  // BAND 3 — the wider world (outside cards only; his picks already lead). Airing pool
  // for g, backfilled from trending filtered to g when thin. findInCatalog drops any of
  // his 44 (they lead, never the world band). shownIds dedups across rails.
  let pool = await window.rarDiscovery.fetchAiringCached(g);
  pool = Array.isArray(pool) ? pool : [];
  if (pool.length < 8) {
    const tr = await window.rarDiscovery.fetchTrendingCached();
    pool = pool.concat((Array.isArray(tr) ? tr : []).filter((m) => Array.isArray(m.genres) && m.genres.includes(g)));
  }
  if (typeof isStale === 'function' && isStale()) return;   // a newer build superseded us
  const seen = new Set();
  const world = seededShuffle(pool, freshSeed()).filter((m) => {
    if (!m || !m.id) return false;
    const key = 'al:' + String(m.id);
    if (seen.has(key)) return false; seen.add(key);
    if (findInCatalog(m)) return false;         // his picks lead; never in the world band
    if (shownIds.has(key)) return false;        // already shown on an earlier rail
    return true;
  }).slice(0, worldCap);

  if (world.length) {
    const sep = document.createElement('div');
    sep.className = 'foryou-rail-sep';
    sep.setAttribute('aria-hidden', 'true');
    railEl.appendChild(sep);
    world.forEach((m) => {
      const c = window.rarDiscovery.createDiscoveryCard(m);
      if (c) { railEl.appendChild(c); shownIds.add('al:' + String(m.id)); }
    });
  }
  // Same finish renderDiscoverInto does: center when it fits, mount the auto-drift.
  railEl.classList.toggle('is-sparse', railEl.scrollWidth <= railEl.clientWidth + 1);
  refreshDiscoverCarousel(railEl);
}

// Thin-taste fallback (qualified but only one genre cleared the floor): the one real
// rail, then a non-personalized but still all-his "Blake's table" so the page never
// looks half-printed. Framed as the editor's own shelf, never as "yours."
function buildBlakesTableRail() {
  if (!foryouSectionsEl) return;
  const block = document.createElement('section');
  block.className = 'discover-block foryou-block';
  block.id = 'foryou-blakes-table';
  const head = document.createElement('h3');
  head.className = 'discover-block-head';
  head.textContent = "BLAKE'S TABLE";
  const sp = document.createElement('span'); sp.className = 'jp-mini'; sp.textContent = '十八番';
  head.appendChild(document.createTextNode(' ')); head.appendChild(sp);
  block.appendChild(head);
  const subrow = document.createElement('div'); subrow.className = 'discover-subrow';
  const note = document.createElement('p'); note.className = 'discover-block-sub';
  note.textContent = "Save a few more and this fills in around you. Until then — the ones I'd put on the table first.";
  subrow.appendChild(note); block.appendChild(subrow);
  const rail = document.createElement('div'); rail.className = 'discover-rail foryou-rail'; rail.id = 'foryou-rail-table';
  block.appendChild(rail);
  foryouSectionsEl.appendChild(block);
  const top = (animeData || []).slice().sort((a, b) => parseRating(b) - parseRating(a)).slice(0, 14);
  seededShuffle(top, freshSeed()).forEach((a) => rail.appendChild(createCard(a, { pinned: true })));
  rail.classList.toggle('is-sparse', rail.scrollWidth <= rail.clientWidth + 1);
  refreshDiscoverCarousel(rail);
}

// The gift state — a brand-new signed-in user with no saves yet. Blake's voice; an
// invitation, not a sad blank. Routes them to Discover to start saving.
function buildForYouGift() {
  if (!foryouSectionsEl) return;
  foryouSectionsEl.appendChild(discoverEmptyCard({
    mode: 'empty', kicker: 'NEW HERE', jp: '始めよう',
    body: "Hey — welcome in. This is the page where I pull my picks right up next to your taste. Thing is, I can't read a shelf that's empty yet. Go heart a few in the catalog, drop the maybes on your watchlist, wander Discover and tap the gold ones. Save three or four and come back — this whole page rebuilds itself around what you're into, my reviews lined up next to the wider world they live in. Promise it's worth it. — Blake",
    cta: 'Go find something to save',
    onCta: () => showDiscover(),
  }));
}

// Signed out — one honest "Trending right now" rail (no fake personalization) + a
// branded sign-in nudge explaining what For You becomes.
async function buildForYouSignedOut(token) {
  if (!foryouSectionsEl) return;
  const block = document.createElement('section');
  block.className = 'discover-block foryou-block';
  block.id = 'foryou-trending-block';
  const head = document.createElement('h3'); head.className = 'discover-block-head';
  head.textContent = 'TRENDING RIGHT NOW';
  const sp = document.createElement('span'); sp.className = 'jp-mini'; sp.textContent = '人気';
  head.appendChild(document.createTextNode(' ')); head.appendChild(sp);
  block.appendChild(head);
  const subrow = document.createElement('div'); subrow.className = 'discover-subrow';
  const note = document.createElement('p'); note.className = 'discover-block-sub';
  note.textContent = "What the whole world's watching — no fake guessing until you're in.";
  subrow.appendChild(note); block.appendChild(subrow);
  const rail = document.createElement('div'); rail.className = 'discover-rail foryou-rail'; rail.id = 'foryou-trending-rail';
  block.appendChild(rail);
  foryouSectionsEl.appendChild(block);
  foryouSectionsEl.appendChild(discoverEmptyCard({
    mode: 'empty', kicker: 'WHAT THIS BECOMES', jp: 'サインイン',
    body: "Right now you're seeing what the whole world is watching — no fake guessing. Sign in and For You becomes mine-meets-yours: I take the titles you save and stand my own reviewed picks right beside the wider world, gold-pinned so you always know which ones I've actually sat through. Make an account and let's build your shelf. — Blake",
    cta: 'Sign in to build your shelf',
    onCta: () => openAuth('signin'),
  }));
  setRailLoading(rail);                      // branded skeleton while the pool fetches (cold cache)
  const trending = await window.rarDiscovery.fetchTrendingCached();
  if (token !== foryouBuildToken) return;   // buildForYou owns the token; bail if superseded
  renderDiscoverInto(rail, Array.isArray(trending) ? seededShuffle(trending, freshSeed()).slice(0, 18) : null,
    { empty: "Couldn't load what's trending right now.", carousel: true, onRetry: buildForYou });
}

// Build (or rebuild) the For You surface from current auth + saves. Idempotent —
// re-runnable on open and on any auth/save change while the surface is mounted.
async function buildForYou() {
  if (!foryouSectionsEl) return;
  const token = ++foryouBuildToken;
  // Tear down the previous rails' auto-advance (listeners + IntersectionObserver +
  // timers in the shared discoverRails Map) BEFORE detaching them — innerHTML='' alone
  // leaks them (this surface rebuilds on every save change). Mirrors the Den's
  // rebuildGenreSection destroy-before-clear pattern.
  foryouSectionsEl.querySelectorAll('.discover-rail').forEach((el) => destroyDiscoverCarousel(el));
  foryouSectionsEl.innerHTML = '';
  if (foryouLens) foryouLens.hidden = true;   // no lens on the signed-out / gift states
  setForYouLens('all');

  if (!auth.currentUser) { await buildForYouSignedOut(token); return; }

  const profile = computeTasteProfile(currentSaves());
  if (!profile.qualifies) { buildForYouGift(); return; }

  const shownIds = new Set();
  for (let i = 0; i < profile.rails.length; i++) {
    if (token !== foryouBuildToken) return;   // a newer build superseded this one
    await buildForYouRail(profile.rails[i], i, shownIds, token);
  }
  if (token !== foryouBuildToken) return;
  if (profile.thin) buildBlakesTableRail();
  if (foryouLens) foryouLens.hidden = false;  // mount the lens now that >=1 rail rendered
  setForYouLens('all');
}

// The For-You lens — same CSS-only mechanism as Discover (toggles lens-* on the view
// root; CSS hides the non-matching cards). Relabeled to a curator's lens in the HTML.
function setForYouLens(which) {
  const target = (which === 'reviewed' || which === 'notyet') ? which : 'all';
  if (foryouLens) {
    foryouLens.querySelectorAll('.fr-seg').forEach((b) => {
      const on = b.getAttribute('data-reviewed') === target;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  if (foryouView) {
    foryouView.classList.remove('lens-all', 'lens-reviewed', 'lens-notyet');
    foryouView.classList.add('lens-' + target);
  }
}
function wireForYouLens() {
  if (!foryouLens) return;
  foryouLens.querySelectorAll('.fr-seg').forEach((b) => {
    b.addEventListener('click', () => setForYouLens(b.getAttribute('data-reviewed')));
  });
}

// v1.8.4 gate 5 — the three SURFACES are a mutually-exclusive "place" radio set. One
// helper lights exactly one (or none, for the View All tool view) + slides the gold
// marker. Den is lit on first paint (home is default). reuses .inline-header-btn.is-active.
function setActivePlace(activeBtn) {
  [denBtn, foryouBtn, discoverBtn].forEach((b) => {
    if (!b) return;
    const on = b === activeBtn;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  moveMarker(activeBtn);
  // v1.8.4 gate 6 — the Constellation veil's "you are here": this single funnel (every
  // surface + View All's null route through it) flips data-surface on <html>; CSS
  // crossfades the per-surface veil density (~450ms). null (View All) = the 'tool' room.
  document.documentElement.dataset.surface =
    activeBtn === denBtn      ? 'den'      :
    activeBtn === foryouBtn   ? 'foryou'   :
    activeBtn === discoverBtn ? 'discover' : 'tool';
}
// Slide the gold ink-bar under the active place. Measured in a rAF (after the class +
// any font swap settles). The static .place-btn.is-active::after underbar is the no-JS
// floor; once we position the marker we add .has-marker so only the slider shows.
function moveMarker(btn) {
  if (!placeMarker || !navPlaces) return;
  if (!btn) { placeMarker.style.opacity = '0'; navPlaces.classList.remove('has-marker'); return; }
  requestAnimationFrame(() => {
    if (!btn.classList.contains('is-active')) return;
    const r = btn.getBoundingClientRect();
    const p = navPlaces.getBoundingClientRect();
    // Not laid out (hidden), OR the nav wrapped to 2+ rows (narrow widths) — the marker's
    // bottom is pinned to nav-places, so on a multi-row wrap it can't track a top-row
    // button. Fall back to the static per-button underbar (correct at any width).
    if (!r.width || p.height > r.height * 1.6) {
      placeMarker.style.opacity = '0';
      navPlaces.classList.remove('has-marker');
      return;
    }
    navPlaces.classList.add('has-marker');
    placeMarker.style.opacity = '1';
    placeMarker.style.width = (r.width - 24) + 'px';
    placeMarker.style.transform = 'translateX(' + (r.left - p.left + 12) + 'px)';
  });
}

function showForYou() {
  if (!foryouView) return;
  filterPanel?.classList.remove('open');
  document.body.classList.remove('filter-open');
  homeView.style.display = 'none';
  allView.style.display = 'none';
  if (discoverView) discoverView.style.display = 'none';
  foryouView.style.display = 'block';
  stopSpotlightCycle();
  hideGenreRails();
  setFilterHasOutsideCards(true);     // the panel's 3-way "Unreviewed" enables here too
  buildForYou();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  headerEl?.classList.remove('header--hidden');
  setActivePlace(foryouBtn);          // light For You, slide the marker
}
function hideForYou() {
  if (foryouView) foryouView.style.display = 'none';
  foryouBtn?.classList.remove('is-active');
  // Fully tear down the For-You rails (listeners + IO + timers in the shared
  // discoverRails Map) when navigating away — they rebuild on re-open. Leaves the
  // Discover rails untouched (only For-You's live under #foryou-sections).
  if (foryouSectionsEl) foryouSectionsEl.querySelectorAll('.discover-rail').forEach((el) => destroyDiscoverCarousel(el));
}

// Re-personalize on any auth/save change: the Den featured slot always; the For You
// surface only when it's the active view; the compact For-You-on-home only when home
// is the active view (lazy — no work when it's not on screen).
function onForYouSavesChanged() {
  try { buildFeaturedDrop(); requestAnimationFrame(positionFeaturedDrop); } catch (_) {}
  try { if (foryouView && foryouView.style.display !== 'none') buildForYou(); } catch (_) {}
  try { if (homeView && homeView.style.display !== 'none' && homeForyouBuilt) buildHomeForYou(); } catch (_) {}
}

// ════════════════════════════════════════════════════════════════════════
// v1.8.4 (gate 5) — HOME HOLE-FILL: the two strips below the masthead. Both fetch
// LAZILY (one-shot IntersectionObserver) so the home's first paint makes ZERO AniList
// calls (the Den/folio/Top 10 are all local). Discover native-scroll drift, NOT the
// Den marquee. The strips live in #home-view, so leaving home (display:none) idles
// their drift via the shared rail IO automatically.
// ════════════════════════════════════════════════════════════════════════
let homeForyouBuildToken = 0;
let homeForyouBuilt = false;

// Set a strip head to "EN <jp-mini>JP</jp-mini>" without raw interpolation.
function setStripHead(headEl, en, jp) {
  if (!headEl) return;
  headEl.textContent = en + ' ';
  const sp = document.createElement('span');
  sp.className = 'jp-mini';
  sp.textContent = jp;
  headEl.appendChild(sp);
}

// AIRING NOW — the wider-world threshold band. renderDiscoverInto auto-blends (his 44
// that are airing pin gold; the rest are outside cards). Lazy-called.
async function fillHomeAiring() {
  if (!homeAiringRail) return;
  setRailLoading(homeAiringRail);
  const airing = await window.rarDiscovery.fetchAiringCached('all');
  renderDiscoverInto(homeAiringRail, Array.isArray(airing) ? airing.slice(0, 12) : null,
    { empty: 'Nothing airing surfaced right now.', carousel: true, onRetry: fillHomeAiring });
  setRailMeta('home-airing-block', seasonLabel(Array.isArray(airing) ? airing : []));
}

// FOR YOU on home — chrome (head/sub/more by auth) + the rail. Signed in: a teaser of
// the top taste rail (reuses fillForYouRailBands with smaller caps). Signed in + no
// saves: the gift card. Signed out: an honest trending taster relabelled "FROM HIS
// SHELF". Lazy-called; rebuilds on auth/save change while home is visible.
async function buildHomeForYou() {
  if (!homeForyouRail || !homeForyouBlock) return;
  homeForyouBuilt = true;
  const token = ++homeForyouBuildToken;
  destroyDiscoverCarousel(homeForyouRail);
  homeForyouRail.innerHTML = '';
  homeForyouRail.classList.remove('is-sparse');
  const headEl = document.getElementById('home-foryou-head');
  const subEl = document.getElementById('home-foryou-sub');
  const moreEl = document.getElementById('home-foryou-more');
  const setMore = (text, fn) => {
    if (!moreEl) return;
    moreEl.hidden = false;
    moreEl.textContent = text + ' ';
    const a = document.createElement('span'); a.setAttribute('aria-hidden', 'true'); a.textContent = '→';
    moreEl.appendChild(a);
    moreEl.onclick = (e) => { e.preventDefault(); fn(); };
  };
  const hideMore = () => { if (moreEl) { moreEl.hidden = true; moreEl.onclick = null; } };

  if (!auth.currentUser) {
    // Signed out — an honest trending taster (NOT a sign-in wall on the home), relabelled
    // so impersonal trending never sits under a personalization promise.
    setStripHead(headEl, 'FROM HIS SHELF', '十八番');
    if (subEl) subEl.textContent = "Not signed in yet — here's what the wider world's loving, with the ones Blake's reviewed lit gold.";
    setMore('Sign in to make this yours · For You', () => showForYou());
    setRailMeta('home-foryou-block', 'The wider world · 世界');
    setRailLoading(homeForyouRail);
    const trending = await window.rarDiscovery.fetchTrendingCached();
    if (token !== homeForyouBuildToken) return;
    renderDiscoverInto(homeForyouRail, Array.isArray(trending) ? seededShuffle(trending, freshSeed()).slice(0, 12) : null,
      { empty: "Couldn't load what's trending right now.", carousel: true, onRetry: buildHomeForYou });
    return;
  }

  const profile = computeTasteProfile(currentSaves());
  if (!profile.qualifies) {
    // Signed in, no saves yet — the gift (never an empty rail).
    setStripHead(headEl, 'FOR YOU', '君へ');
    if (subEl) subEl.textContent = 'Save a few you love and this whole shelf rebuilds around your taste.';
    hideMore();
    setRailMeta('home-foryou-block', '');
    homeForyouRail.classList.add('is-sparse');
    homeForyouRail.appendChild(discoverEmptyCard({
      mode: 'empty', kicker: 'FOR YOU', jp: '始めよう',
      body: "Save a few you love and this whole shelf rebuilds around your taste. — Blake",
      cta: 'Go find something to save', onCta: () => showDiscover(),
    }));
    return;
  }

  // Signed in, qualifies — a teaser of the user's TOP taste rail.
  const top = profile.rails[0];
  setStripHead(headEl, 'FOR YOU', '君へ');
  if (subEl) subEl.textContent = 'More of the ' + top.genre + " I'd vouch for — leading with the ones I sat down with.";
  setMore('See all · For You', () => showForYou());
  setRailMeta('home-foryou-block', 'Tuned to your shelf · 君へ');
  await fillForYouRailBands(homeForyouRail, top, new Set(), () => token !== homeForyouBuildToken, { leadCap: 4, worldCap: 8 });
}

// One-shot lazy fill: fetch + render a home strip only when it nears the viewport, so
// the first paint is API-free. rootMargin pre-warms it ~300px before it's on screen.
function lazyFillOnView(blockEl, fillFn) {
  if (!blockEl) return;
  // fully swallow any rejection so a flaky AniList fetch can never surface as a page
  // error (the fills are fire-and-forget; their content isn't depended on).
  const run = () => { try { Promise.resolve(fillFn()).catch(() => {}); } catch (_) {} };
  if (typeof IntersectionObserver === 'undefined') { run(); return; }   // no IO -> fill now
  const io = new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); run(); }
  }, { rootMargin: '300px 0px' });
  io.observe(blockEl);
}

// The dated folio line — today's date (front-page masthead convention; always honest).
function setFolioDate() {
  const el = document.getElementById('folio-date');
  if (!el) return;
  try { el.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch (_) {}
}

// ---------- FEATURED (Latest Review) ----------
// v1.8.4 gate 4 — the featured pick: signed-in => most-recent favorite, else most-
// recent watchlist, else a recent his-card from history; signed-out => latest drop.
// Catalog entries only (al:<id> outside saves have no local card to feature).
function pickFeaturedAnime() {
  if (!Array.isArray(animeData) || !animeData.length) return null;
  if (auth.currentUser) {
    const bySlug = catalogBySlug();
    const firstCatalog = (ids) => { for (const id of (ids || [])) { const a = bySlug.get(id); if (a) return a; } return null; };
    return firstCatalog([...favoritesSet]) || firstCatalog([...watchlistSet]) || firstCatalog(readContinue()) || animeData[animeData.length - 1];
  }
  return animeData[animeData.length - 1];
}
function buildFeaturedDrop() {
  if (!featuredDrop || !featuredDropCard) return;
  if (!Array.isArray(animeData) || !animeData.length) return;

  // v1.8.4 gate 4 — the featured slot adapts to the signed-in user (most-recent
  // favorite > watchlist > recent his-card); signed-out keeps the latest drop.
  const a = pickFeaturedAnime();
  if (!a) return;

  // v1.7.1 gate 1g — romaji/native subtitle, same resolver + markup as the cards.
  const fSub = pickSubtitle(a);
  const fRomaji = fSub
    ? `<p class="title-romaji${fSub.kind === 'native' ? ' is-native' : ''}"><i class="rb">「</i>${escapeHtml(fSub.text)}<i class="rb">」</i></p>`
    : '';

  featuredDropCard.innerHTML = `
    <img class="featured-thumb" src="assets/${escapeHtml(a.image || '')}"
      alt="${escapeHtml(a.Title || '')}"
      loading="lazy" decoding="async"
      onerror="this.onerror=null;this.src='assets/placeholder.png';" />

    <div class="featured-name">${escapeHtml(a.Title || '')}</div>
    ${fRomaji}
    <div class="featured-genre">${escapeHtml(a.Genre || '')}</div>
    <div class="featured-rating">${escapeHtml(a.Rating || '')}</div>
  `;

  featuredDropCard.onclick = () => openModal(a);
}
// Align Featured panel next to the ACTIVE Top 10 card and keep it FIXED
function positionFeaturedDrop() {
  if (!featuredDrop) return;

  // Keep it inside #home-view so it disappears when Home is hidden (View All).
  // v1.8.3 (gate 3 fix): the card now lives nested inside .blakes-den, so test
  // CONTAINMENT — not direct-childhood. The old `parentElement !== homeView`
  // guard was true for the nested card and yanked it back out of the Den on
  // every init/resize/load. `contains()` keeps the original "stay in home-view"
  // intent without disturbing its place in the Den.
  if (homeView && !homeView.contains(featuredDrop)) {
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
    // v1.8.3 gate 4 — 1–3 matches center instead of left-hugging the 4-col track
    cardContainer.classList.toggle("is-sparse", list.length > 0 && list.length <= 3);
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
  const RAIL_COUNT = 1;
  const GENRE_SHUFFLE_LOCK_MS = 420;
  // v1.8.4 gate 3c — the old transform-marquee speed/tick consts + the rotation-
  // timer machinery were removed when the Den rails moved to the shared Discover
  // carousel (no setInterval-driven timers anymore).

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

  // ════════════════════════════════════════════════════════════════════════
  // v1.8.4 gate 3d (item 5) — Den "Anime By Genre" INFINITE one-direction
  // transform marquee (REVERTED from G3c's native-scroll, per Blake). Transform
  // gets the FREE GPU-compositor path (the layer just translates — NO per-frame
  // scroll repaint of newly-exposed edges), so this is a PERF WIN over G3c's
  // native-scroll auto-advance and resolves the G3c Den Profiler-watch. Items are
  // rendered TWICE for a seamless wrap; the track is translated by one set-width
  // then snapped back. ONE shared rAF + ONE IntersectionObserver (off-screen rails
  // do zero work), pauses on hover, reduced-motion => static + the viewport falls
  // back to a manual scroller (CSS) so the cards are still reachable. NOT manually
  // scrollable while animating (by design — Den only; Discover rails stay native-
  // scroll). One direction always (no ping-pong reversal).
  // ════════════════════════════════════════════════════════════════════════
  const denMarquees = new Map();   // viewport -> { track, pos, dir, setWidth, paused, visible, handlers }
  let denRafId = null;
  let denLastTs = 0;
  let _denIO = null;
  const DEN_SPEED = 0.03;          // px per ms (~30 px/s)
  function measureDenSet(st) {
    const kids = st.track.children;
    const half = Math.floor(kids.length / 2);   // items are duplicated -> one set = half
    if (half <= 0) { st.setWidth = 0; return; }
    const cs = getComputedStyle(st.track);
    const gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
    let w = 0;
    for (let i = 0; i < half; i++) { w += kids[i].getBoundingClientRect().width; w += gap; }
    st.setWidth = Math.max(1, w);   // includes the gap between set 1 and set 2 (seamless)
  }
  function denMarqueeTick(ts) {
    denRafId = null;
    if (document.hidden) { denLastTs = 0; return; }
    const dt = denLastTs ? Math.min(64, ts - denLastTs) : 16;
    denLastTs = ts;
    let any = false;
    denMarquees.forEach((st) => {
      if (st.paused || !st.visible || st.setWidth <= 1) return;
      any = true;
      st.pos += DEN_SPEED * dt * st.dir;
      if (st.dir < 0 && st.pos <= -st.setWidth) st.pos += st.setWidth;
      else if (st.dir > 0 && st.pos >= st.setWidth) st.pos -= st.setWidth;
      st.track.style.transform = `translate3d(${st.pos}px,0,0)`;   // composited — no repaint
    });
    if (any) denRafId = requestAnimationFrame(denMarqueeTick); else denLastTs = 0;
  }
  function ensureDenRaf() { if (REDUCED_MOTION) return; if (denRafId == null) { denLastTs = 0; denRafId = requestAnimationFrame(denMarqueeTick); } }
  function denMarqueeObserver() {
    if (_denIO) return _denIO;
    _denIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const st = denMarquees.get(e.target);
        if (!st) return;
        st.visible = e.isIntersecting;
        if (st.visible) { measureDenSet(st); ensureDenRaf(); }
      });
    }, { threshold: 0.01 });
    return _denIO;
  }
  function mountDenMarquee(viewport, track, direction) {
    if (!viewport || !track || REDUCED_MOTION) return;   // reduced-motion: CSS makes it a manual scroller
    if (denMarquees.has(viewport)) { measureDenSet(denMarquees.get(viewport)); return; }
    const st = { track, pos: 0, dir: direction < 0 ? -1 : 1, setWidth: 0, paused: false, visible: false, handlers: null };
    measureDenSet(st);
    const onEnter = () => { st.paused = true; };
    const onLeave = () => { st.paused = false; ensureDenRaf(); };
    const onResize = () => measureDenSet(st);
    st.handlers = { onEnter, onLeave, onResize };
    viewport.addEventListener('pointerenter', onEnter);
    viewport.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);
    denMarquees.set(viewport, st);
    denMarqueeObserver().observe(viewport);
  }
  function destroyDenMarquee(viewport) {
    const st = viewport && denMarquees.get(viewport);
    if (!st) return;
    const h = st.handlers || {};
    viewport.removeEventListener('pointerenter', h.onEnter);
    viewport.removeEventListener('pointerleave', h.onLeave);
    window.removeEventListener('resize', h.onResize);
    try { if (_denIO) _denIO.unobserve(viewport); } catch (_) {}
    denMarquees.delete(viewport);
  }

  function mountRail(genre, direction = -1) {
    const { rail, viewport, track } = createRailDOM(genre);
    const items = itemsForGenre(genre, 12);
    items.forEach((a) => track.appendChild(createCard(a)));
    // Duplicate the set for the seamless infinite loop — but only when animating;
    // under reduced-motion the viewport becomes a manual scroller, so a single set
    // (no dupes) is what's reachable.
    if (!REDUCED_MOTION) items.forEach((a) => track.appendChild(createCard(a)));

    function start() {
      mountDenMarquee(viewport, track, direction);
      const st = denMarquees.get(viewport);
      if (st) st.paused = false;     // showGenreRails after stop() re-runs start()
      ensureDenRaf();
    }
    function stop() { const st = denMarquees.get(viewport); if (st) st.paused = true; }
    function pause() { stop(); }
    function resume() { const st = denMarquees.get(viewport); if (st) { st.paused = false; ensureDenRaf(); } }
    function destroy() { destroyDenMarquee(viewport); }

    return { rail, viewport, start, stop, pause, resume, destroy };
  }

  function rebuildGenreSection() {
    if (!recommendedRow) return;
    railsControllers.forEach((r) => {
      if (typeof r.destroy === "function") r.destroy();
      else r.stop();
    });
    railsControllers = [];
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

  // ===== Continue where you left off (v1.8.3 gate 5) — pure-local recent history =====
  // Records the slugs of anime the visitor opens (most-recent-first, deduped, capped),
  // and renders a small rail on the homepage. localStorage only — no account needed.
  const CONTINUE_KEY = 'rar:continue';
  const CONTINUE_MAX = 10;       // how many we remember
  const CONTINUE_VISIBLE = 6;    // v1.8.3 gate 5b — how many show before old ones rotate out
  function readContinue() {
    try {
      const arr = JSON.parse(localStorage.getItem(CONTINUE_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch (_) { return []; }
  }
  function recordContinue(animeId) {
    if (!animeId) return;
    try {
      let arr = readContinue().filter((id) => id !== animeId);
      arr.unshift(animeId);
      localStorage.setItem(CONTINUE_KEY, JSON.stringify(arr.slice(0, CONTINUE_MAX)));
    } catch (_) {}
  }
  function buildContinueRail() {
    if (!continueSection || !continueRow) return;
    const bySlug = new Map((animeData || []).map((a) => [slug(a.Title), a]));
    const items = readContinue().map((id) => bySlug.get(id)).filter(Boolean).slice(0, CONTINUE_VISIBLE);
    continueRow.innerHTML = '';
    if (!items.length) { continueSection.hidden = true; return; }
    items.forEach((a) => continueRow.appendChild(createCard(a)));
    continueSection.hidden = false;
    // v1.8.4 gate 3d (item 6) — overflowing => left-start + scroll; fits => center.
    continueRow.classList.toggle('is-overflowing', continueRow.scrollWidth > continueRow.clientWidth + 1);
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


 // ---------- Structured-review jump nav (v1.8.2) ----------
// Direction A "Kicker Rail": a sticky pill row built from the review's `##` sections
// (window.extractSections, markdown.js). Pills scroll their matching heading into the
// modal's OWN scroll container (scrollIntoView walks to the nearest scrollable
// ancestor; sticky-nav overlap is handled by scroll-margin-top on .md-h in CSS), and
// an IntersectionObserver highlights the active pill (scroll-spy). Heading-less /
// single-section reviews render no nav (legacy prose is pixel-identical to before).
const REVIEW_SECTION_JP = {
  'intro': '序章', 'animation': '作画', 'story': '物語', 'characters': '登場人物',
  'design': '設定', 'music': '音楽', 'feel': '雰囲気', 'extra thoughts': '余談', 'overall': '総評',
};
function buildReviewNav(md) {
  const sections = (typeof window !== 'undefined' && window.extractSections) ? window.extractSections(md) : [];
  if (sections.length < 2) return '';   // 0–1 sections need no jump nav
  const pills = sections.map(function (s) {
    const key = String(s.label || '').toLowerCase();
    const jp = REVIEW_SECTION_JP[key] ? '<span class="review-pill-jp">' + REVIEW_SECTION_JP[key] + '</span>' : '';
    const overall = (key === 'overall') ? ' review-pill--overall' : '';
    return '<button type="button" class="review-pill' + overall + '" data-target="' + escapeHtml(s.id) + '">' +
      '<span class="review-pill-label">' + escapeHtml(s.label) + '</span>' + jp + '</button>';
  }).join('');
  return '<nav class="review-nav" aria-label="Jump to review section">' + pills + '</nav>';
}
// Nearest scrollable ancestor (the modal's own scroller — no single hardcodable
// container: the duo panels scroll independently, the secondary body scrolls, and
// <900px restacks). Returns null → viewport.
function nearestScrollable(el) {
  let n = el && el.parentElement;
  while (n && n !== document.body && n !== document.documentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 4) return n;
    n = n.parentElement;
  }
  return null;
}
function wireReviewNav(scope) {
  if (!scope) return;
  if (scope.__reviewObs) { scope.__reviewObs.forEach(function (o) { o.disconnect(); }); }
  scope.__reviewObs = [];
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  scope.querySelectorAll('.review-nav').forEach(function (nav) {
    const container = nav.parentElement;   // .modal-review / .secondary-review
    if (!container) return;
    const pills = Array.from(nav.querySelectorAll('.review-pill'));
    const headings = {};
    pills.forEach(function (p) {
      const h = container.querySelector('[id="' + p.dataset.target + '"]');   // scoped → safe vs duplicate ids across the two open modals
      if (h) headings[p.dataset.target] = h;
    });
    nav.addEventListener('click', function (e) {
      const pill = e.target.closest('.review-pill');
      if (!pill) return;
      const h = headings[pill.dataset.target];
      if (h) h.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    });
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        const id = en.target.getAttribute('id');
        pills.forEach(function (p) { p.classList.toggle('is-active', p.dataset.target === id); });
      });
    }, { root: nearestScrollable(container), rootMargin: '0px 0px -70% 0px', threshold: 0 });
    Object.keys(headings).forEach(function (id) { obs.observe(headings[id]); });
    scope.__reviewObs.push(obs);
  });
}

 // ---------- MODAL ----------
function openModal(anime) {
  // Prevent background spotlight motion while modal is open.
  stopSpotlightCycle();
  isSpotlightHovered = false;

  // v1.8.3 gate 5 — remember this open for the "Continue where you left off" rail.
  try { recordContinue(slug(anime.Title)); buildContinueRail(); } catch (_) {}

  const tags = safeArray(anime.Tags);
  const platforms = safeArray(anime.Platforms)
    .flatMap((p) => String(p || "").split(/[,\uFF0C\u3001;|/\\\n\r]+/))
    .map((p) => p.trim())
    .filter(Boolean);
  const trailerSrc = toYouTubeEmbedSrc(anime.Trailer);

  const seasonsVal =
    anime.Seasons ?? anime.seasons ?? anime.Season ?? anime.season ?? null;

  // v1.7.0 (gate 1b) — AniList community score as an inline badge with an
  // ANILIST kicker (data attribution, allowed), sitting on the same row as
  // Blake's rating. Bare score (no /10) — the kicker supplies the context.
  // Omitted entirely when AniListScore is null (no hidden-toggle → no [hidden]
  // symmetry rule needed). Reads the static backfilled field; no API call.
  // v1.7.1 — per-anime accent from the backfilled AniListColor: the raw hex
  // drives the border + gradient (extremes are harmless there), while a
  // luminance-guarded variant keeps the kicker text readable. Falls back to
  // brand purple (CSS defaults) when the anime has no color.
  const aniColor = anime.AniListColor || null;
  const aniKicker = readableAccent(aniColor);
  const aniBadgeStyle = aniColor
    ? ' style="--anilist-color: ' + escapeHtml(aniColor) + '; --anilist-kicker: ' + (aniKicker || aniColor) + '"'
    : '';
  const aniListBadgeHtml = (anime.AniListScore != null && anime.AniListScore !== '')
    ? '<span class="anilist-badge"' + aniBadgeStyle + '>' +
        '<span class="anilist-badge-kicker">ANILIST</span>' +
        '<span class="anilist-badge-divider">·</span>' +
        '<span class="anilist-badge-score">' + (Number(anime.AniListScore) / 10).toFixed(1) + '</span>' +
      '</span>'
    : '';

  // v1.7.0 (gate 1c) — RATING badge is now the gold twin of the ANILIST badge:
  // same kicker/divider/score structure, no external "Rating:" label, bare score
  // (strip a trailing /10 — the kicker supplies the scale, same as the AniList badge).
  const ratingScore = String(anime.Rating || '').replace(/\/\s*10\s*$/, '').trim();
  // v1.8.1 (gate 2b) — admin-only "✎ Edit review" deep-link, right-aligned in the
  // empty space on the RATING/ANILIST badge row (Blake's circled spot). UID gate via
  // window.__rarIsAdmin (admin-fab.js); visitors never see it.
  const adminEditBadge = (typeof window !== 'undefined' && window.__rarIsAdmin)
    ? '<a class="modal-admin-edit" href="admin/edit.html?slug=' + encodeURIComponent(animeSlug(anime)) + '&from=modal" title="Edit this review (admin)"><span aria-hidden="true">✎</span> Edit review</a>'
    : '';
  // v1.8.3 gate 5c/5d — the admin ✎ Edit pill moved OFF the badge row to sit under the
  // "Agree with my Rating?" vote bar (Blake's spot). Admin-only. In admin mode it shares
  // ONE row with the provenance line (built as `underVoteBar` near leftHTML below);
  // visitors see only the centered provenance. Visitor view otherwise unchanged.
  const ratingHtml =
    '<p class="meta-line meta-line-rating">' +
      '<span class="rating-badge">' +
        '<span class="rating-badge-kicker">RATING</span>' +
        '<span class="rating-badge-divider">·</span>' +
        '<span class="rating-badge-score">' + ratingScore + '</span>' +
      '</span>' +
      aniListBadgeHtml +
    '</p>';

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
      '" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>'
    : '';

  // v1.7.4 gate-3b — render Description + Review through the shared markdown parser
  // (same one season reviews use). XSS-safe (escapes first); plain-text reviews are
  // unchanged except newlines now become real line breaks. renderMarkdown emits its
  // own block tags (<p>/<ul>/…), so no surrounding <p> wrapper.
  const descBlock = anime.Description
    ? '<div class="modal-description"><p><strong>Description:</strong></p>' +
      window.renderMarkdown(anime.Description) + '</div>'
    : '';

  const reviewBlock = anime.Review
    ? '<div class="modal-review"><p><strong>Review:</strong></p>' +
      buildReviewNav(anime.Review) +
      window.renderMarkdown(anime.Review) + '</div>'
    : '';

  // v1.7.1 — romaji subtitle under the modal title, shown only when it differs
  // from the displayed (English) title (e.g. "Sousou no Frieren"; skipped for
  // identical-romaji titles like "Chainsaw Man").
  const modalSub = pickSubtitle(anime);
  const modalRomaji = modalSub
    ? '<p class="modal-romaji' + (modalSub.kind === 'native' ? ' is-native' : '') + '"><i class="rb">「</i>' + modalSub.text + '<i class="rb">」</i></p>'
    : '';

  // v1.8.3 gate 5b — "Blake watched N seasons" provenance, moved off the cards into the
  // modal and seated right under the "Agree with my Rating?" vote bar: it substantiates
  // his rating (here's how much of the franchise he actually watched) at the exact moment
  // you're deciding whether you agree. From WatchedAniListIds (the ids watched in-franchise).
  const modalWatchedN = Array.isArray(anime.WatchedAniListIds) ? anime.WatchedAniListIds.length : 0;
  const provenanceHtml = modalWatchedN > 0
    ? '<p class="modal-provenance"><span class="mp-eye" aria-hidden="true">&#128065;</span> Blake watched <strong>' +
      modalWatchedN + '</strong> season' + (modalWatchedN === 1 ? '' : 's') + ' of this franchise</p>'
    : '';
  // v1.8.3 gate 5d — admin: provenance + ✎ Edit pill share ONE row under the vote bar;
  // visitor: just the (centered) provenance line, no Edit pill, no odd gap.
  const underVoteBar = adminEditBadge
    ? '<div class="modal-admin-edit-row">' + provenanceHtml + adminEditBadge + '</div>'
    : provenanceHtml;

  // LEFT sheet markup (details + comments)
  const leftHTML =
    '<span class="close-button" aria-label="Close">&times;</span>' +
    trailerBlock +
    '<h2 class="modal-title">' + anime.Title + '</h2>' +
    modalRomaji +
    officialVotesMarkup(anime) +
    underVoteBar +
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
    // v1.7.4 — More Info panel is always-visible (the v1.6.8 collapse tab +
    // close button were removed; it's now a permanent 3rd column).
    '<div class="more-info-container">' +
      '<aside class="more-info-panel">' +
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
  wireReviewNav(modalContent);   // v1.8.2 — structured-review jump pills + scroll-spy

  // v1.7.4 — More Info panel wiring: renders immediately on open (no tab/close);
  // card-click navigates.
  const moreInfoContent = modalContent.querySelector('.more-info-content');

  // v1.7.2 — renders the More Info panel. AniListId entries use the franchise
  // multi-hop path (traverseFranchiseForModal) + the source's recs/staff from
  // the cached legacy fetch; no-AniListId entries fall back to the legacy 1-hop
  // render. forceRefresh bypasses both cache tiers (the partial-fail retry).
  // lastFranchisePanelData lets the episode-numbering toggle re-render instantly
  // from the already-fetched tree (no loading flash, no refetch).
  let lastFranchisePanelData = null;
  async function runMoreInfo(forceRefresh) {
    moreInfoContent.innerHTML = renderMoreInfoPanel('loading', anime);

    if (anime.AniListId) {
      const [tree, legacy] = await Promise.all([
        traverseFranchiseForModal(anime, forceRefresh),
        fetchRelationsForModal(anime),
      ]);
      const hasTree = tree && (tree.spine.length || Object.keys(tree.groups).length || tree.episodesBySeason.length);
      if (hasTree) {
        const panelData = Object.assign({}, tree, {
          recommendations: legacy ? legacy.recommendations : [],
          staff: legacy ? legacy.staff : [],
        });
        lastFranchisePanelData = panelData;
        moreInfoContent.innerHTML = renderMoreInfoPanel('franchise', anime, panelData);
        return;
      }
      // Traversal yielded nothing usable — fall back to the legacy 1-hop render.
      const okLegacy = legacy && ((legacy.edges && legacy.edges.length > 0) || !!legacy.sourceId);
      moreInfoContent.innerHTML = renderMoreInfoPanel(okLegacy ? 'success' : 'empty', anime, legacy);
      return;
    }

    // Legacy path (no AniListId) — unchanged 1-hop title-search render.
    const result = await fetchRelationsForModal(anime);
    const hasContent = (result.edges && result.edges.length > 0) || !!result.sourceId;
    moreInfoContent.innerHTML = renderMoreInfoPanel(hasContent ? 'success' : 'empty', anime, result);
  }

  // v1.7.4 — render the panel immediately on modal open (was tab-gated).
  runMoreInfo(false);

  moreInfoContent.addEventListener('click', (e) => {
    // Episode-numbering toggle — persist + instant re-render from the cached tree.
    const modeBtn = e.target.closest('.more-info-ep-mode');
    if (modeBtn) {
      e.preventDefault();
      setEpisodeNumberingMode(modeBtn.dataset.epMode === 'continuous' ? 'continuous' : 'perSeason');
      if (lastFranchisePanelData) {
        moreInfoContent.innerHTML = renderMoreInfoPanel('franchise', anime, lastFranchisePanelData);
      }
      return;
    }

    // Partial-fail retry — cache-bypassing re-render.
    const retryBtn = e.target.closest('.more-info-retry');
    if (retryBtn) { e.preventDefault(); runMoreInfo(true); return; }

    const card = e.target.closest('.more-info-entry--clickable');
    if (!card) return;
    // In-catalog rows open Blake's own modal; everything else opens the in-site
    // secondary "deep dive" modal (v1.7.4 — was window.open(anilist.co)).
    const catalogSlug = card.dataset.catalogSlug;
    if (catalogSlug) {
      const list = Array.isArray(window.animeData) ? window.animeData : (Array.isArray(animeData) ? animeData : []);
      const target = list.find(a => a && slug(a.Title || '') === catalogSlug);
      if (target) { openModal(target); return; }
    }
    const anilistId = card.dataset.anilistId;
    if (!anilistId) return;
    openSecondaryModal(Number(anilistId), anime, moreInfoContent);
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

// ════════════════════════════════════════════════════════════════════════
// v1.7.4 (gate 2) — SECONDARY "DEEP DIVE" MODAL
// In-site replacement for the old window.open(anilist.co). A LARGE layer that
// slides in from the right over a dimmed+blurred primary modal (which stays
// MOUNTED underneath — Back just hides this layer, so the primary's scroll/tab
// state is preserved for free). Shows the rich single-anime detail the primary's
// franchise tree lacks: banner + cover, synopsis, genres/tags, characters, staff,
// trailer, links, and a "more like this" strip that swaps content in place
// (replace-content; no deeper stacks). Fed by fetchAnimeDetailCached (24h cache).
// ════════════════════════════════════════════════════════════════════════

  // ── v1.7.4 (gate 3, Surface 1) — per-season review (markdown) layer ──
  // The index (which AniListIds have a written review) is a static JSON the sync
  // emits; the .md files are static too (production has no server). Session-memory
  // cache only — Blake's edits appear on the next page load, not 24h later.
  let _seasonReviewIndex = null;          // Set<number>
  let _seasonReviewIndexPromise = null;
  const _seasonReviewCache = new Map();   // id -> { meta, body } | null

  function getSeasonReviewIndex() {
    if (_seasonReviewIndex) return Promise.resolve(_seasonReviewIndex);
    if (_seasonReviewIndexPromise) return _seasonReviewIndexPromise;
    _seasonReviewIndexPromise = fetch('/season-reviews/index.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { _seasonReviewIndex = new Set(((j && j.ids) || []).map(Number)); return _seasonReviewIndex; })
      .catch(() => { _seasonReviewIndex = new Set(); return _seasonReviewIndex; });
    return _seasonReviewIndexPromise;
  }
  function hasSeasonReview(id) { return !!(_seasonReviewIndex && _seasonReviewIndex.has(Number(id))); }

  async function fetchSeasonReview(id) {
    const key = Number(id);
    if (_seasonReviewCache.has(key)) return _seasonReviewCache.get(key);
    let parsed = null;
    try {
      const r = await fetch('/season-reviews/' + key + '.md', { cache: 'no-cache' });
      if (r.ok) parsed = parseSeasonReviewText(await r.text());
    } catch (_) {}
    _seasonReviewCache.set(key, parsed);
    return parsed;
  }

  // Split `---\n frontmatter \n---\n body` (mirror of scripts/lib/season-review-index.js).
  function parseSeasonReviewText(text) {
    const s = String(text || '');
    const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(s);
    if (!m) return { meta: {}, body: s };
    const meta = {};
    m[1].split('\n').forEach(line => {
      const i = line.indexOf(':');
      if (i === -1) return;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k) meta[k] = v;
    });
    return { meta, body: m[2] };
  }

  // v1.7.4 (gate 3b) — the markdown renderer was extracted to the shared
  // markdown.js (classic script loaded before this module). Use window.renderMarkdown
  // everywhere — single source of truth across visitor + admin surfaces.

  let secondaryEl = null;          // the lazily-built layer (backdrop + modal)
  let secondaryScrollEl = null;    // inner scroll container that holds the content
  let secondaryCtx = null;         // { sourceTitle, moreInfoContent, currentId }
  let secondaryViewingRow = null;  // row in the primary More Info panel we highlighted
  // v1.7.4 (gate 2b) — replace-content navigation history: [{ id, title }] in the
  // order visited. Back steps BACKWARD one entry; emptying it returns to primary.
  let secondaryHistory = [];

  function ensureSecondaryEl() {
    if (secondaryEl) return;
    secondaryEl = document.createElement('div');
    secondaryEl.className = 'secondary-layer';
    secondaryEl.hidden = true;
    secondaryEl.innerHTML =
      '<div class="secondary-backdrop"></div>' +
      '<div class="secondary-modal" role="dialog" aria-modal="true" aria-label="Anime details" tabindex="-1">' +
        '<div class="secondary-scroll"></div>' +
      '</div>';
    document.body.appendChild(secondaryEl);
    secondaryScrollEl = secondaryEl.querySelector('.secondary-scroll');
    secondaryEl.querySelector('.secondary-backdrop').addEventListener('click', secondaryBack);
    secondaryEl.addEventListener('click', onSecondaryClick);
  }

  function onSecondaryKeydown(e) {
    // When the tertiary detail layer is open it owns Esc (its own handler closes
    // it); bail so we don't step the secondary back underneath it.
    if (tertiaryEl && !tertiaryEl.hidden) return;
    // Esc steps BACK one history entry (gate 2b — consistent with the Back chip
    // and backdrop). stopPropagation keeps the window-level handler (closeModal)
    // from also tearing down the primary modal beneath.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); secondaryBack(); }
  }

  function onSecondaryClick(e) {
    // Back chip + backdrop step back one history entry; the × closes the whole
    // layer regardless of depth (the explicit "I'm done" affordance).
    if (e.target.closest('.secondary-close')) { e.preventDefault(); closeSecondaryModal(); return; }
    if (e.target.closest('.secondary-back')) { e.preventDefault(); secondaryBack(); return; }
    // v1.7.5 (gate 1) — Watchlist / Favorite save pills.
    const saveBtn = e.target.closest('.secondary-save[data-save-kind]');
    if (saveBtn) { e.preventDefault(); handleSecondarySave(saveBtn); return; }
    // v1.7.5 (gate 3) — per-episode in-row expand. The ↗ link lives in the sibling
    // detail (not inside .secondary-ep), so a link click falls through to navigate.
    const epBtn = e.target.closest('.secondary-ep');
    if (epBtn && !epBtn.classList.contains('secondary-ep--bare')) {
      e.preventDefault();
      const row = epBtn.closest('.secondary-ep-row');
      const det = row && row.querySelector('.secondary-ep-detail');
      if (det) {
        const opening = det.hasAttribute('hidden');
        det.toggleAttribute('hidden', !opening);
        epBtn.setAttribute('aria-expanded', String(opening));
        epBtn.classList.toggle('is-open', opening);
      }
      return;
    }
    const retry = e.target.closest('.secondary-retry');
    if (retry) { e.preventDefault(); if (secondaryCtx) loadSecondary(secondaryCtx.currentId, true); return; }
    const more = e.target.closest('.secondary-readmore');
    if (more) {
      e.preventDefault();
      const sec = more.closest('.secondary-desc');
      if (sec) {
        const open = sec.classList.toggle('is-open');
        more.textContent = open ? 'Show less' : 'Read more';
      }
      return;
    }
    // v1.7.4 (gate 3, Surface 3) — character / staff card → tertiary detail layer.
    const charCard = e.target.closest('.secondary-char[data-character-id]');
    if (charCard && charCard.dataset.characterId) { e.preventDefault(); openTertiary('character', Number(charCard.dataset.characterId)); return; }
    const staffRow = e.target.closest('.secondary-staff-row[data-staff-id]');
    if (staffRow && staffRow.dataset.staffId) { e.preventDefault(); openTertiary('staff', Number(staffRow.dataset.staffId)); return; }
    const rec = e.target.closest('.secondary-rec');
    if (rec) {
      e.preventDefault();
      const cslug = rec.dataset.catalogSlug;
      if (cslug) {
        // A "more like this" card that IS in Blake's catalog → open his own
        // review modal (close this layer first so we don't stack two modals).
        const list = Array.isArray(window.animeData) ? window.animeData : (Array.isArray(animeData) ? animeData : []);
        const target = list.find(a => a && slug(a.Title || '') === cslug);
        closeSecondaryModal();
        if (target) openModal(target);
        return;
      }
      const id = Number(rec.dataset.anilistId);
      if (id) {
        const titleEl = rec.querySelector('.secondary-rec-title');
        pushSecondary(id, titleEl ? titleEl.textContent : '');   // replace-content + history push
      }
      return;
    }
  }

  // v1.7.5 (gate 1) — update a save pill's glyph/label/state in place (optimistic
  // toggle + rollback both route through here).
  function applySecondarySaveBtn(btn, kind, on) {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    const icon = btn.querySelector('.secondary-save-icon');
    const label = btn.querySelector('.secondary-save-label');
    if (kind === 'favorites') {
      if (icon) icon.textContent = on ? '♥' : '♡';
      if (label) label.textContent = on ? 'Favorited' : 'Favorite';
      btn.title = on ? 'Remove from favorites' : 'Add to favorites';
    } else {
      if (icon) icon.textContent = on ? '✓' : '+';
      if (label) label.textContent = on ? 'Watchlisted' : 'Watchlist';
      btn.title = on ? 'Remove from watchlist' : 'Add to watchlist';
    }
  }

  // One-shot branded tooltip under the header action row (signed-out save prompt
  // + save-error message). No native alert() per the standing constraint.
  let secondarySaveTipTimer = null;
  function showSecondarySaveTooltip(btn, msg) {
    if (!secondaryEl) return;
    const row = btn.closest('.secondary-header-actions') || secondaryEl;
    let tip = row.querySelector('.secondary-save-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'secondary-save-tip';
      tip.setAttribute('role', 'status');
      row.appendChild(tip);
    }
    tip.textContent = msg || 'Sign in to save';
    void tip.offsetWidth;                 // reflow so the fade-in transition runs
    tip.classList.add('is-visible');
    if (secondarySaveTipTimer) clearTimeout(secondarySaveTipTimer);
    secondarySaveTipTimer = setTimeout(() => { if (tip) tip.classList.remove('is-visible'); }, 2400);
  }

  // Optimistic toggle mirroring the per-card handleToggle: flip the visual + the
  // shared set first, persist, roll back on failure. Snapshot title/cover/format/
  // year off the loaded detail so the account page can paint with no fetch.
  async function handleSecondarySave(btn) {
    const kind = btn.dataset.saveKind;                       // 'watchlist' | 'favorites'
    const d = secondaryCtx && secondaryCtx.currentDetail;
    if (!d || !d.id) return;
    const user = auth.currentUser;
    // v1.7.5 (gate 3b) — signed-out save → open the branded Sign in modal (the
    // tooltip is retired on this path; it stays only for the save-error case below).
    if (!user) { openAuth('signin'); return; }

    const setRef = (kind === 'favorites') ? favoritesSet : watchlistSet;
    const savedId = anilistSaveId(d.id);
    const turnOn = !btn.classList.contains('is-on');

    // optimistic UI + shared-set update
    if (turnOn) setRef.add(savedId); else setRef.delete(savedId);
    applySecondarySaveBtn(btn, kind, turnOn);

    btn.disabled = true;
    try {
      const snapshot = {
        title: d.title.english || d.title.romaji || '',
        coverImage: (d.coverImage && (d.coverImage.extraLarge || d.coverImage.large)) || '',
        format: d.format || '',
        year: d.seasonYear || null,
      };
      await setSaveAnilist(kind, user.uid, d.id, snapshot, turnOn);
    } catch (err) {
      // rollback
      if (turnOn) setRef.delete(savedId); else setRef.add(savedId);
      applySecondarySaveBtn(btn, kind, !turnOn);
      showSecondarySaveTooltip(btn, 'Couldn’t save — try again');
    } finally {
      btn.disabled = false;
    }
  }

  // Entry point — replaces the window.open hook. sourceAnime + moreInfoContent
  // come from the primary modal's open closure (for the Back label + the
  // currently-viewing highlight).
  function openSecondaryModal(aniListId, sourceAnime, moreInfoContent) {
    const id = Number(aniListId);
    if (!id) return;
    ensureSecondaryEl();
    secondaryCtx = {
      sourceTitle: (sourceAnime && sourceAnime.Title) || '',
      moreInfoContent: moreInfoContent || null,
      currentId: id,
    };
    secondaryEl.hidden = false;
    void secondaryEl.offsetWidth;            // reflow so the slide-in transition runs
    secondaryEl.classList.add('active');
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', onSecondaryKeydown);
    secondaryHistory = [{ id, title: null }];   // seed the navigation history
    loadSecondary(id);
  }

  // Navigate to a related anime WITHIN the layer (replace-content) + push onto
  // the history so Back steps back to where we came from.
  function pushSecondary(aniListId, title) {
    const id = Number(aniListId);
    if (!id) return;
    secondaryHistory.push({ id, title: (title || '').trim() || null });
    loadSecondary(id);
  }

  // Back: pop the current entry; render the previous one if any, else return to
  // the primary modal. (Cache is per-anime, so a replay is instant when warm.)
  function secondaryBack() {
    if (!secondaryEl || secondaryEl.hidden) return;
    if (secondaryHistory.length > 1) {
      secondaryHistory.pop();
      loadSecondary(secondaryHistory[secondaryHistory.length - 1].id);
    } else {
      closeSecondaryModal();
    }
  }

  // The "Back to X" target = the PREVIOUS history entry's title (one step back),
  // or Blake's source review title when we're at the originally-opened anime.
  function secondaryBackTitle() {
    if (secondaryHistory.length > 1) {
      return secondaryHistory[secondaryHistory.length - 2].title || '';
    }
    return secondaryCtx ? secondaryCtx.sourceTitle : '';
  }

  async function loadSecondary(aniListId, forceRefresh) {
    const id = Number(aniListId);
    if (!id || !secondaryEl) return;
    if (secondaryCtx) secondaryCtx.currentId = id;
    secondaryScrollEl.scrollTop = 0;
    const sourceTitle = secondaryCtx ? secondaryCtx.sourceTitle : '';
    secondaryScrollEl.innerHTML = renderSecondaryModal('loading', null, { backTitle: secondaryBackTitle() });
    applyViewingHighlight(id);
    // Detail + the season-review index in parallel (index resolves once, cached).
    const [detail] = await Promise.all([fetchAnimeDetailCached(id, forceRefresh), getSeasonReviewIndex()]);
    if (!secondaryEl || secondaryEl.hidden) return;   // user backed out mid-fetch
    // Lazy-fetch Blake's written season review for this id (if the index says so).
    let seasonReview = null;
    if (detail && hasSeasonReview(id)) {
      seasonReview = await fetchSeasonReview(id);
      if (!secondaryEl || secondaryEl.hidden) return;
    }
    // Backfill the current history entry's title (so future Back labels are right).
    const top = secondaryHistory[secondaryHistory.length - 1];
    if (detail && top && top.id === id && !top.title) {
      top.title = detail.title.english || detail.title.romaji || null;
    }
    // Stash the loaded detail so the save pills (gate 1) can snapshot title/cover/
    // format/year at click-time without a re-fetch.
    if (secondaryCtx) secondaryCtx.currentDetail = detail || null;
    const meta = { sourceTitle, backTitle: secondaryBackTitle(), inFranchise: !!secondaryViewingRow, seasonReview };
    secondaryScrollEl.innerHTML = renderSecondaryModal(detail ? 'success' : 'error', detail, meta);
    secondaryScrollEl.scrollTop = 0;
    wireReviewNav(secondaryScrollEl);   // v1.8.2 — jump pills + scroll-spy on BLAKE'S REVIEW
  }

  function closeSecondaryModal() {
    if (!secondaryEl || secondaryEl.hidden) return;
    secondaryEl.classList.remove('active');
    document.removeEventListener('keydown', onSecondaryKeydown);
    restoreViewingHighlight();
    secondaryHistory = [];
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const done = () => { if (!secondaryEl) return; secondaryEl.hidden = true; secondaryScrollEl.innerHTML = ''; };
    if (reduce) done(); else setTimeout(done, 280);
    // Primary modal is still mounted underneath → keep the scroll lock if it's open.
    document.documentElement.style.overflow = (modal && modal.classList.contains('active')) ? 'hidden' : '';
    secondaryCtx = null;
  }

  // Move the primary More Info panel's CURRENTLY VIEWING highlight to the row the
  // secondary modal is showing (200ms fade via CSS). No-op if the id isn't in the
  // visible tree. restoreViewingHighlight() puts it back on Back.
  function applyViewingHighlight(aniListId) {
    restoreViewingHighlight();
    const c = secondaryCtx && secondaryCtx.moreInfoContent;
    if (!c) return;
    // Secondary modal only opens for data-anilist-id rows (watched-not-primary or
    // non-catalog); primary ids open the main modal, so anilist-id is the match.
    const row = c.querySelector('.more-info-entry[data-anilist-id="' + aniListId + '"]');
    if (!row) return;
    c.classList.add('more-info--viewing-active');
    row.classList.add('more-info-entry--viewing');
    secondaryViewingRow = row;
  }
  function restoreViewingHighlight() {
    if (secondaryViewingRow) {
      secondaryViewingRow.classList.remove('more-info-entry--viewing');
      secondaryViewingRow = null;
    }
    const c = secondaryCtx && secondaryCtx.moreInfoContent;
    if (c) c.classList.remove('more-info--viewing-active');
  }

  // AniList descriptions ship as HTML — convert to safe text with line breaks.
  function stripAniListHtml(html) {
    if (!html) return '';
    return String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
      .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  function prettyEnum(s) {
    return String(s || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  function prettyStatus(s) {
    const MAP = { FINISHED: 'Finished', RELEASING: 'Airing', NOT_YET_RELEASED: 'Upcoming', CANCELLED: 'Cancelled', HIATUS: 'Hiatus' };
    return MAP[s] || prettyEnum(s);
  }
  // Key staff: whitelist roles first (in order), then fill to 6 by the API's
  // relevance order (mirrors renderStaffCredits's intent for the deep-dive).
  function pickKeyStaff(staff) {
    if (!staff || !staff.length) return [];
    const WHITELIST = ['Director', 'Original Creator', 'Original Story', 'Series Composition', 'Character Design', 'Music'];
    const picked = [];
    const usedNames = new Set();
    for (const role of WHITELIST) {
      const e = staff.find(s => s.role === role && !usedNames.has(s.name));
      if (e) { picked.push(e); usedNames.add(e.name); }
    }
    for (const s of staff) {
      if (picked.length >= 6) break;
      if (usedNames.has(s.name)) continue;
      picked.push(s); usedNames.add(s.name);
    }
    return picked.slice(0, 6);
  }

  // v1.7.5 (gate 3) — per-episode "thin" expand for the secondary modal. Fed by
  // detail.streamingEpisodes (MEDIA_DETAIL_QUERY: title + thumbnail + url + site).
  // Each row is a <button> (keyboard-accessible) that toggles an inline detail
  // panel (thumbnail + full title + ↗ {site} link). Rows whose payload lacks any
  // expandable data (e.g. a pre-gate-3 cached entry without url/thumbnail) render
  // as a non-interactive title line — graceful degrade. Collapsed behind a
  // <details> past 8 episodes, matching the More Info panel's episode list.
  function renderSecondaryEpisodes(streamingEpisodes, externalLinks) {
    if (!streamingEpisodes || !streamingEpisodes.length) return '';
    // v1.7.5 (gate 3b) — series-level official streaming destinations (AniList
    // externalLinks type STREAMING), deduped by platform. Shown per-episode
    // alongside the episode-specific link, minus the episode's own platform.
    const seriesStreams = [];
    const seenSites = new Set();
    (Array.isArray(externalLinks) ? externalLinks : []).forEach(l => {
      if (!l || l.type !== 'STREAMING' || !l.url || !l.site) return;
      const key = l.site.toLowerCase();
      if (seenSites.has(key)) return;
      seenSites.add(key);
      seriesStreams.push({ site: l.site, url: l.url });
    });
    const epStreamPill = (url, site) =>
      '<a class="secondary-ep-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">↗ ' + escapeHtml(site) + '</a>';
    const sorted = streamingEpisodes
      .map((e, i) => {
        const title = (e && e.title) || '';
        const m = title.match(/^Episode\s+(\d+)\s*[-–—]/i);
        return {
          title,
          thumbnail: (e && e.thumbnail) || '',
          url: (e && e.url) || '',
          site: (e && e.site) || '',
          epNum: m ? parseInt(m[1], 10) : null,
          origIndex: i,
        };
      })
      .sort((a, b) => {
        if (a.epNum === null && b.epNum === null) return a.origIndex - b.origIndex;
        if (a.epNum === null) return 1;
        if (b.epNum === null) return -1;
        return a.epNum - b.epNum;
      });
    const rows = sorted.map(r => {
      const titleSpan = '<span class="secondary-ep-title">' + escapeHtml(r.title || '(untitled episode)') + '</span>';
      // v1.7.5 (gate 3c) — all official platforms get EQUAL weight + no privileged
      // position (Blake: don't auto-highlight Crunchyroll). Merge the episode-direct
      // platform (its deep-link URL wins for that platform) with the series-level
      // streaming platforms, dedupe by site, render uniform pills sorted A→Z.
      const platforms = new Map();   // lowercased site -> { site, url }
      if (r.url && r.site) platforms.set(r.site.toLowerCase(), { site: r.site, url: r.url });
      seriesStreams.forEach(s => { const k = s.site.toLowerCase(); if (!platforms.has(k)) platforms.set(k, { site: s.site, url: s.url }); });
      const platformList = Array.from(platforms.values())
        .sort((a, b) => a.site.toLowerCase().localeCompare(b.site.toLowerCase()));
      const hasLinks = platformList.length > 0;
      const canExpand = !!(r.thumbnail || hasLinks);
      if (!canExpand) {
        return '<div class="secondary-ep-row"><div class="secondary-ep secondary-ep--bare">' + titleSpan + '</div></div>';
      }
      const linkPills = platformList.map(p => epStreamPill(p.url, p.site)).join('');
      const linksBlock = hasLinks
        ? '<div class="secondary-ep-links">' + linkPills + '</div>'
        : '<p class="secondary-ep-empty">No official stream listed for this episode.</p>';
      const detailInner =
        (r.thumbnail ? '<img class="secondary-ep-thumb" src="' + escapeHtml(r.thumbnail) + '" alt="" loading="lazy">' : '') +
        linksBlock;
      return '<div class="secondary-ep-row">' +
          '<button type="button" class="secondary-ep" aria-expanded="false">' +
            titleSpan + '<span class="secondary-ep-caret" aria-hidden="true">▸</span>' +
          '</button>' +
          '<div class="secondary-ep-detail" hidden>' + detailInner + '</div>' +
        '</div>';
    }).join('');
    const header = '<h3 class="secondary-section-title">EPISODES</h3>';
    const body = sorted.length > 8
      ? '<details class="secondary-ep-list-details"><summary>Show all ' + sorted.length + ' episodes</summary>' + rows + '</details>'
      : rows;
    return '<section class="secondary-section secondary-episodes">' + header + body + '</section>';
  }

  // v1.7.5 (gate 3e) — WHERE TO WATCH section: every official streaming platform
  // for this anime (detail.externalLinks type STREAMING, deduped by site, A→Z,
  // equal-weight pills per the gate-3c parity rule). Each pill → the platform's
  // series page. Omitted entirely when there are no streaming links (premium-clean;
  // the LINKS section still carries AniList + the official site).
  function renderSecondaryPlatforms(externalLinks) {
    const seen = new Set();
    const list = [];
    (Array.isArray(externalLinks) ? externalLinks : []).forEach(l => {
      if (!l || l.type !== 'STREAMING' || !l.url || !l.site) return;
      const k = l.site.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      list.push({ site: l.site, url: l.url });
    });
    if (!list.length) return '';
    list.sort((a, b) => a.site.toLowerCase().localeCompare(b.site.toLowerCase()));
    const pills = list.map(p =>
      '<a class="secondary-platform" href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener noreferrer">↗ ' + escapeHtml(p.site) + '</a>'
    ).join('');
    return '<section class="secondary-section secondary-platforms">' +
        '<h3 class="secondary-section-title">WHERE TO WATCH</h3>' +
        '<div class="secondary-platform-list">' + pills + '</div>' +
      '</section>';
  }

  // Pure renderer → HTML string. states: 'loading' | 'success' | 'error'.
  function renderSecondaryModal(state, detail, meta) {
    meta = meta || {};
    const backLabel = meta.backTitle ? ('← Back to ' + escapeHtml(meta.backTitle)) : '← Back';
    // v1.8.2 — one deliberate top bar: back chip on the left, the action cluster on
    // the right (space-between, single non-wrapping row). The cluster holds (optional)
    // ✎ Edit + Request + Watchlist/Favorite, then the × close as its terminal member —
    // so it reads as part of the composed header, not a floating stray. Drops to
    // uniform icon circles <900px. Both admin (✎ present) and visitor (absent) states
    // stay tidy — flex just closes the gap, no reserved slot.
    const buildHeaderBar = (actionsInner) =>
      '<div class="secondary-header-bar">' +
        '<button type="button" class="secondary-back">' + backLabel + '</button>' +
        '<div class="secondary-header-actions">' +
          (actionsInner || '') +
          '<button type="button" class="secondary-close" aria-label="Close details">×</button>' +
        '</div>' +
      '</div>';

    if (state === 'loading') {
      return '<div class="secondary-header secondary-header--bare">' +
          buildHeaderBar('') +
        '</div>' +
        '<div class="secondary-loading"><div class="secondary-spinner" aria-hidden="true"></div><span>Loading details…</span></div>';
    }
    if (state === 'error' || !detail) {
      return '<div class="secondary-header secondary-header--bare">' +
          buildHeaderBar('') +
        '</div>' +
        '<div class="secondary-empty">Couldn’t load these details right now.' +
          ' <button type="button" class="secondary-retry">Try again</button></div>';
    }

    // ── success ──
    const accent = (detail.coverImage && detail.coverImage.color) || '';
    const banner = detail.bannerImage || (detail.coverImage && detail.coverImage.extraLarge) || '';
    const cover = (detail.coverImage && (detail.coverImage.extraLarge || detail.coverImage.large)) || '';
    const english = detail.title.english || detail.title.romaji || '(untitled)';
    const romaji = (detail.title.romaji && detail.title.romaji !== english) ? detail.title.romaji : (detail.title.native || '');

    const animStudios = (detail.studios || []).filter(s => s.isAnimationStudio).map(s => s.name);
    const allStudios = (detail.studios || []).map(s => s.name);
    const studioStr = Array.from(new Set(animStudios.length ? animStudios : allStudios)).slice(0, 2).join(', ');
    const seasonYear = [detail.season ? prettyEnum(detail.season) : '', detail.seasonYear || ''].filter(Boolean).join(' ');
    const metaStr = [
      detail.format ? prettyEnum(detail.format).toUpperCase() : '',
      seasonYear,
      detail.episodes ? (detail.episodes + ' eps') : '',
      detail.duration ? (detail.duration + ' min') : '',
      prettyStatus(detail.status),
      studioStr,
    ].filter(Boolean).join('  ·  ');

    const avgBadge = detail.averageScore
      ? '<span class="anilist-badge"><span class="anilist-badge-kicker">ANILIST</span><span class="anilist-badge-divider">·</span><span class="anilist-badge-score">' + (detail.averageScore / 10).toFixed(1) + '</span></span>'
      : '';
    // v1.7.4 (gate 3, Surface 2) — "watched" = this id is in Blake's watched set
    // (he's seen + endorsed it), distinct from whether a written season review
    // exists yet. The secondary only ever shows watched-not-primary or non-catalog
    // ids (primary ids open the main modal).
    const isWatched = isWatchedAniListId(detail.id);
    const reviewKicker = isWatched
      ? '<span class="secondary-reviewed-kicker">✓ REVIEWED</span>'
      : '<span class="secondary-unreviewed-kicker">NOT REVIEWED YET</span>';

    // v1.7.4 (gate 2b) — "Request this anime" pill, non-watched only (a watched
    // entry is already on Blake's radar). Links to /suggest with title + anilistId.
    const requestBtn = isWatched
      ? ''
      : '<a class="secondary-request" href="/suggest?title=' + encodeURIComponent(english) + '&anilistId=' + encodeURIComponent(String(detail.id)) + '" title="Request this anime from Blake">' +
          '<span class="secondary-request-icon" aria-hidden="true">📝</span>' +
          '<span class="secondary-request-label">Request this anime</span></a>';

    // v1.7.4 (gate 3, Surface 1) — inline "Edit season review" link, admin only
    // (the UID gate lives in admin-fab.js → window.__rarIsAdmin). Routes to the
    // dedicated admin panel pre-targeting this id.
    const editReviewBtn = (typeof window !== 'undefined' && window.__rarIsAdmin)
      ? '<a class="secondary-edit-review" href="admin/season-reviews.html?id=' + encodeURIComponent(String(detail.id)) + '" title="Edit this season review">' +
          '<span class="secondary-edit-icon" aria-hidden="true">✎</span>' +
          '<span class="secondary-edit-label">Edit review</span></a>'
      : '';

    // v1.7.5 (gate 1) — Watchlist + Favorite save pills. State is read FREE from
    // the homepage's existing watchlistSet/favoritesSet via the `al:` doc-id (no
    // new listener). The click handler (onSecondaryClick → handleSecondarySave)
    // reads the loaded detail off secondaryCtx for the save snapshot.
    const savedId = anilistSaveId(detail.id);
    const inWatch = watchlistSet.has(savedId);
    const inFav = favoritesSet.has(savedId);
    const saveBtns =
      '<button type="button" class="secondary-save secondary-save--watch' + (inWatch ? ' is-on' : '') + '"' +
        ' data-save-kind="watchlist" aria-pressed="' + (inWatch ? 'true' : 'false') + '"' +
        ' title="' + (inWatch ? 'Remove from watchlist' : 'Add to watchlist') + '">' +
        '<span class="secondary-save-icon" aria-hidden="true">' + (inWatch ? '✓' : '+') + '</span>' +
        '<span class="secondary-save-label">' + (inWatch ? 'Watchlisted' : 'Watchlist') + '</span></button>' +
      '<button type="button" class="secondary-save secondary-save--fav' + (inFav ? ' is-on' : '') + '"' +
        ' data-save-kind="favorites" aria-pressed="' + (inFav ? 'true' : 'false') + '"' +
        ' title="' + (inFav ? 'Remove from favorites' : 'Add to favorites') + '">' +
        '<span class="secondary-save-icon" aria-hidden="true">' + (inFav ? '♥' : '♡') + '</span>' +
        '<span class="secondary-save-label">' + (inFav ? 'Favorited' : 'Favorite') + '</span></button>';

    const header =
      '<div class="secondary-header"' + (accent ? ' style="--accent:' + escapeHtml(accent) + '"' : '') + '>' +
        '<div class="secondary-banner"' + (banner ? ' style="background-image:url(\'' + escapeHtml(banner) + '\')"' : '') + '></div>' +
        '<div class="secondary-banner-scrim"></div>' +
        buildHeaderBar(editReviewBtn + requestBtn + saveBtns) +
        '<div class="secondary-header-body">' +
          (cover ? '<img class="secondary-cover" src="' + escapeHtml(cover) + '" alt="" loading="lazy">' : '<div class="secondary-cover secondary-cover--ph"></div>') +
          '<div class="secondary-titleblock">' +
            '<div class="secondary-kickers">' + reviewKicker + '</div>' +
            '<h2 class="secondary-title">' + escapeHtml(english) + '</h2>' +
            (romaji ? '<p class="secondary-romaji">' + escapeHtml(romaji) + '</p>' : '') +
            '<div class="secondary-badges">' + avgBadge + (metaStr ? '<span class="secondary-meta">' + escapeHtml(metaStr) + '</span>' : '') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    const context = meta.inFranchise
      ? '<div class="secondary-context">Currently viewing within <strong>' + escapeHtml(meta.sourceTitle) + '</strong>’s franchise</div>'
      : (meta.sourceTitle ? '<div class="secondary-context secondary-context--discover">Discovered from <strong>' + escapeHtml(meta.sourceTitle) + '</strong></div>' : '');

    // v1.7.4 (gate 3, Surface 1) — BLAKE'S REVIEW section (the per-season prose),
    // the primary content above the AniList synopsis. Rendered markdown when Blake
    // has written one; a placeholder for a watched id without one yet; nothing for
    // a non-watched entry (synopsis is the body there).
    let reviewHtml = '';
    if (meta.seasonReview && meta.seasonReview.body && meta.seasonReview.body.trim()) {
      const fmRating = meta.seasonReview.meta && meta.seasonReview.meta.rating;
      const ratingBadge = fmRating
        ? '<span class="secondary-review-rating"><span class="secondary-review-rating-kicker">RATING</span><span class="secondary-review-rating-divider">·</span><span class="secondary-review-rating-score">' + escapeHtml(fmRating) + '</span></span>'
        : '';
      reviewHtml = '<section class="secondary-section secondary-review">' +
          '<div class="secondary-review-head"><h3 class="secondary-section-title secondary-review-title">BLAKE’S REVIEW</h3>' + ratingBadge + '</div>' +
          buildReviewNav(meta.seasonReview.body) +
          '<div class="secondary-review-body">' + window.renderMarkdown(meta.seasonReview.body) + '</div>' +
        '</section>';
    } else if (isWatched) {
      reviewHtml = '<section class="secondary-section secondary-review secondary-review--empty">' +
          '<h3 class="secondary-section-title secondary-review-title">BLAKE’S REVIEW</h3>' +
          '<p class="secondary-review-placeholder">No specific review for this season yet — Blake watched it; notes are on the way.</p>' +
        '</section>';
    }

    // synopsis (collapsible past ~420 chars)
    const descText = stripAniListHtml(detail.description);
    let descHtml = '';
    if (descText) {
      const long = descText.length > 420;
      const para = '<p>' + escapeHtml(descText).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
      descHtml = '<section class="secondary-section secondary-desc' + (long ? ' is-collapsible' : '') + '">' +
          '<h3 class="secondary-section-title">SYNOPSIS</h3>' +
          '<div class="secondary-desc-body">' + para + '</div>' +
          (long ? '<button type="button" class="secondary-readmore">Read more</button>' : '') +
        '</section>';
    }

    const genresHtml = detail.genres.length
      ? '<section class="secondary-section"><h3 class="secondary-section-title">GENRES</h3><div class="secondary-pills">' +
          detail.genres.map(g => '<span class="secondary-pill">' + escapeHtml(g) + '</span>').join('') +
        '</div></section>'
      : '';
    const topTags = detail.tags.slice(0, 10);
    const tagsHtml = topTags.length
      ? '<section class="secondary-section"><h3 class="secondary-section-title">TAGS</h3><div class="secondary-pills">' +
          topTags.map(t => '<span class="secondary-pill secondary-pill--tag">' + escapeHtml(t.name) + '</span>').join('') +
        '</div></section>'
      : '';

    const yt = (detail.trailer && detail.trailer.site === 'youtube' && detail.trailer.id) ? detail.trailer.id : null;
    const trailerHtml = yt
      ? '<section class="secondary-section"><h3 class="secondary-section-title">TRAILER</h3>' +
          '<div class="secondary-trailer"><iframe src="https://www.youtube.com/embed/' + escapeHtml(yt) + '" title="Trailer" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>' +
        '</section>'
      : '';

    // v1.7.4 (gate 3, Surface 3) — character/staff cards are clickable (data-*-id)
    // → open the tertiary detail layer.
    const charsHtml = detail.characters.length
      ? '<section class="secondary-section"><h3 class="secondary-section-title">CHARACTERS</h3><div class="secondary-char-grid">' +
          detail.characters.map(c =>
            '<button type="button" class="secondary-char" data-character-id="' + escapeHtml(String(c.id || '')) + '">' +
              (c.image ? '<img class="secondary-char-img" src="' + escapeHtml(c.image) + '" alt="" loading="lazy">' : '<div class="secondary-char-img secondary-char-img--ph"></div>') +
              '<div class="secondary-char-name">' + escapeHtml(c.name) + '</div>' +
              (c.role ? '<div class="secondary-char-role">' + escapeHtml(prettyEnum(c.role)) + '</div>' : '') +
            '</button>'
          ).join('') +
        '</div></section>'
      : '';

    const staffPicked = pickKeyStaff(detail.staff);
    const staffHtml = staffPicked.length
      ? '<section class="secondary-section"><h3 class="secondary-section-title">STAFF</h3><div class="secondary-staff-list">' +
          staffPicked.map(s =>
            '<button type="button" class="secondary-staff-row" data-staff-id="' + escapeHtml(String(s.id || '')) + '">' +
              (s.image ? '<img class="secondary-staff-img" src="' + escapeHtml(s.image) + '" alt="" loading="lazy">' : '<div class="secondary-staff-img secondary-staff-img--ph"></div>') +
              '<div class="secondary-staff-meta"><span class="secondary-staff-role">' + escapeHtml(s.role) + '</span><span class="secondary-staff-name">' + escapeHtml(s.name) + '</span></div>' +
            '</button>'
          ).join('') +
        '</div></section>'
      : '';

    // links — AniList canonical + official/info links, kept subtle. v1.7.5 (gate 3e):
    // STREAMING links now live in the dedicated WHERE TO WATCH section, so LINKS skips
    // them (no in-modal duplication) and keeps AniList + Official Site + YouTube.
    const linkOut = [{ label: 'AniList', url: 'https://anilist.co/anime/' + detail.id }];
    const LINK_OK = new Set(['Official Site', 'YouTube']);
    (detail.externalLinks || []).forEach(l => {
      if (linkOut.length >= 6) return;
      if (l.type === 'STREAMING') return;
      if (LINK_OK.has(l.site)) linkOut.push({ label: l.site, url: l.url });
    });
    const linksHtml = '<section class="secondary-section"><h3 class="secondary-section-title">LINKS</h3><div class="secondary-links">' +
        linkOut.slice(0, 6).map(l => '<a class="secondary-link" href="' + escapeHtml(l.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(l.label) + '</a>').join('') +
      '</div></section>';

    const recs = detail.recommendations || [];
    const recsHtml = recs.length
      ? '<div class="secondary-recs-block"><h3 class="secondary-section-title">MORE LIKE THIS</h3><div class="secondary-recs">' +
          recs.map(r => {
            const t = r.title.english || r.title.romaji || '(untitled)';
            // primary id → main modal (data-catalog-slug); watched/non-catalog →
            // secondary replace-content (data-anilist-id). Green ✓ if watched.
            const pslug = primarySlugForAniListId(r.id);
            const rwatched = isWatchedAniListId(r.id);
            const attr = pslug ? ' data-catalog-slug="' + escapeHtml(pslug) + '"' : ' data-anilist-id="' + escapeHtml(String(r.id)) + '"';
            const rcover = (r.coverImage && r.coverImage.large) || '';
            const badge = rwatched
              ? '<span class="secondary-rec-pill">✓</span>'
              : '<span class="secondary-rec-dot" aria-label="Not reviewed yet"></span>';
            return '<button type="button" class="secondary-rec"' + attr + '>' +
                (rcover ? '<img class="secondary-rec-cover" src="' + escapeHtml(rcover) + '" alt="" loading="lazy">' : '<div class="secondary-rec-cover secondary-rec-cover--ph"></div>') +
                badge +
                '<div class="secondary-rec-title">' + escapeHtml(t) + '</div>' +
              '</button>';
          }).join('') +
        '</div></div>'
      : '';

    // v1.7.5 (gate 3/3b) — per-episode list w/ in-row expand (thumbnail + episode-
    // direct link + series-level official streaming platforms).
    const episodesHtml = renderSecondaryEpisodes(detail.streamingEpisodes, detail.externalLinks);

    // v1.7.5 (gate 3e) — WHERE TO WATCH leads the side column (actionable, high-value).
    const whereToWatchHtml = renderSecondaryPlatforms(detail.externalLinks);

    const body =
      '<div class="secondary-body">' +
        '<div class="secondary-col secondary-col--main">' + reviewHtml + descHtml + episodesHtml + genresHtml + tagsHtml + trailerHtml + '</div>' +
        '<div class="secondary-col secondary-col--side">' + whereToWatchHtml + charsHtml + staffHtml + linksHtml + '</div>' +
      '</div>';

    return header + context + body + recsHtml;
  }

  // ════════════════════════════════════════════════════════════════════════
  // v1.7.4 (gate 3, Surface 3) — TERTIARY character / staff detail layer.
  // A third drill-down layer (z-index above the secondary) opened by clicking a
  // character or staff card. Recommended treatment (a): a tertiary modal that
  // slides in over the dimmed secondary; Back/Esc/backdrop/× return to the
  // secondary. Cross-nav (clicking a VA / a staff member's character / an anime
  // appearance) swaps content in place; appearances jump the SECONDARY to that
  // anime. Fed by rar:character: / rar:staff: 24h caches (mirror rar:anime:).
  // ════════════════════════════════════════════════════════════════════════

  // Generic 24h L1+L2 cache factory (DRY — mirrors fetchAnimeDetailCached).
  function makeDetailCache(prefix, fetchFn) {
    const mem = new Map();
    let swept = false;
    const verKey = () => prefix + 'v' + (window.APP_VERSION || '0') + ':';
    const keyFor = (id) => verKey() + id;
    const sweep = () => {
      if (swept) return; swept = true;
      try {
        const keep = verKey(); const stale = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(prefix) === 0 && k.indexOf(keep) !== 0) stale.push(k);
        }
        stale.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
      } catch (_) {}
    };
    const read = (id) => {
      try {
        const raw = localStorage.getItem(keyFor(id));
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || typeof p.ts !== 'number' || !p.data) return null;
        if (Date.now() - p.ts > 24 * 60 * 60 * 1000) return null;
        return p.data;
      } catch (_) { return null; }
    };
    const write = (id, data) => { sweep(); try { localStorage.setItem(keyFor(id), JSON.stringify({ ts: Date.now(), data })); } catch (_) {} };
    return async (id, force) => {
      const k = Number(id); if (!k) return null;
      if (!force) { if (mem.has(k)) return mem.get(k); const c = read(k); if (c) { mem.set(k, c); return c; } }
      const data = await fetchFn(k);
      if (data) { mem.set(k, data); write(k, data); }
      return data;
    };
  }
  const fetchCharacterCached = makeDetailCache('rar:character:', (id) => window.franchiseFetch.fetchCharacterDetail(id));
  const fetchStaffCached = makeDetailCache('rar:staff:', (id) => window.franchiseFetch.fetchStaffDetail(id));

  // ── v1.8.4 (gate 1) — Discovery list caches (trending / airing) ──────────
  // Sibling to makeDetailCache: the discovery surfaces fetch FLAT card lists,
  // not a single record by numeric id. So the slot key is a STRING ('all' or a
  // genre name), the TTL is per-cache (trending 24h, airing 12h — airing churns
  // faster), and an EMPTY/failed fetch is NOT written (one bad call can't blank a
  // surface for hours). Otherwise identical discipline to every other rar: cache:
  // L1 Map -> L2 localStorage, APP_VERSION-keyed `rar:<kind>:vX.Y.Z:<slot>`,
  // once-per-session stale-prefix sweep, every storage access try/caught. The
  // network calls live in franchise-fetch.js; caching stays here (the module's
  // stated design). Search is deliberately NOT cached — queries vary and the G3
  // debounce+AbortController owns in-flight; it stays a pass-through.
  // ⚠️ These three are G1 infra: defined now, WIRED to UI in G3 (Discover) / G4
  // (For You). Unused until then by design — don't prune.
  function makeListCache(prefix, ttlMs, fetchFn) {
    const mem = new Map();
    let swept = false;
    const verKey = () => prefix + 'v' + (window.APP_VERSION || '0') + ':';
    const keyFor = (slot) => verKey() + slot;
    const sweep = () => {
      if (swept) return; swept = true;
      try {
        const keep = verKey(); const stale = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(prefix) === 0 && k.indexOf(keep) !== 0) stale.push(k);
        }
        stale.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
      } catch (_) {}
    };
    const read = (slot) => {
      try {
        const raw = localStorage.getItem(keyFor(slot));
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || typeof p.ts !== 'number' || !Array.isArray(p.list)) return null;
        if (Date.now() - p.ts > ttlMs) return null;
        return p.list;
      } catch (_) { return null; }
    };
    const write = (slot, list) => { sweep(); try { localStorage.setItem(keyFor(slot), JSON.stringify({ ts: Date.now(), list })); } catch (_) {} };
    return async (slot, force) => {
      const key = String(slot || 'all');
      if (!force) { if (mem.has(key)) return mem.get(key); const c = read(key); if (c) { mem.set(key, c); return c; } }
      const list = await fetchFn(key === 'all' ? null : key);
      if (Array.isArray(list) && list.length) { mem.set(key, list); write(key, list); }
      return Array.isArray(list) ? list : [];
    };
  }
  const fetchTrendingCached = makeListCache('rar:trending:', 24 * 60 * 60 * 1000, () => window.franchiseFetch.fetchTrendingList(50));
  const fetchAiringCached = makeListCache('rar:airing:', 12 * 60 * 60 * 1000, (genre) => window.franchiseFetch.fetchAiringList(50, genre));
  // Pass-through (no cache by design): the G3 search box owns debounce + abort.
  function searchDiscover(q, signal) { return window.franchiseFetch.searchMediaList(q, 20, signal); }
  // Expose the G1 discovery data layer for the G3/G4 UI + the Playwright canary
  // spec (the surfaces themselves wire in next gate). Kept off the hot path.
  window.rarDiscovery = {
    fetchTrendingCached, fetchAiringCached, searchDiscover,
    // gate 2 — card builders + the AniList->card mapper (G3/G4 render with these).
    createDiscoveryCard, mediaToCardProps, isNewlyReviewed,
    // gate 2 — let a discovery surface enable the "Unreviewed" filter segment.
    setFilterHasOutsideCards,
    // gate 3 — Discover surface: search ranking (pin his 44 + boost) + the
    // freshness-seeded shuffle + the view switcher (handy for tests/G5 nav).
    rankDiscoverResults, seededShuffle, freshSeed, showDiscover,
    // gate 4 — For You: the pure taste engine + the surface switcher (test surface).
    computeTasteProfile, pickFeaturedAnime, showForYou,
  };

  let tertiaryEl = null;
  let tertiaryScrollEl = null;

  function ensureTertiaryEl() {
    if (tertiaryEl) return;
    tertiaryEl = document.createElement('div');
    tertiaryEl.className = 'tertiary-layer';
    tertiaryEl.hidden = true;
    tertiaryEl.innerHTML =
      '<div class="tertiary-backdrop"></div>' +
      '<div class="tertiary-modal" role="dialog" aria-modal="true" aria-label="Profile" tabindex="-1">' +
        '<div class="tertiary-scroll"></div>' +
      '</div>';
    document.body.appendChild(tertiaryEl);
    tertiaryScrollEl = tertiaryEl.querySelector('.tertiary-scroll');
    tertiaryEl.querySelector('.tertiary-backdrop').addEventListener('click', closeTertiary);
    tertiaryEl.addEventListener('click', onTertiaryClick);
  }

  function onTertiaryKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTertiary(); }
  }

  function onTertiaryClick(e) {
    if (e.target.closest('.tertiary-back') || e.target.closest('.tertiary-close')) { e.preventDefault(); closeTertiary(); return; }
    const more = e.target.closest('.tertiary-readmore');
    if (more) {
      e.preventDefault();
      const sec = more.closest('.tertiary-bio');
      if (sec) { const open = sec.classList.toggle('is-open'); more.textContent = open ? 'Show less' : 'Read more'; }
      return;
    }
    // An anime appearance/credit → jump the SECONDARY layer to that anime, close tertiary.
    const media = e.target.closest('.tertiary-media[data-anilist-id]');
    if (media) {
      e.preventDefault();
      const id = Number(media.dataset.anilistId);
      const titleEl = media.querySelector('.tertiary-media-title');
      closeTertiary();
      if (id) pushSecondary(id, titleEl ? titleEl.textContent : '');
      return;
    }
    // A related person (VA / staff's character) → swap tertiary content in place.
    const person = e.target.closest('.tertiary-person[data-character-id], .tertiary-person[data-staff-id]');
    if (person) {
      e.preventDefault();
      if (person.dataset.characterId) openTertiary('character', Number(person.dataset.characterId));
      else if (person.dataset.staffId) openTertiary('staff', Number(person.dataset.staffId));
    }
  }

  function openTertiary(kind, id) {
    if (!id) return;
    ensureTertiaryEl();
    tertiaryEl.hidden = false;
    void tertiaryEl.offsetWidth;
    tertiaryEl.classList.add('active');
    document.addEventListener('keydown', onTertiaryKeydown);
    loadTertiary(kind, id);
  }

  async function loadTertiary(kind, id) {
    tertiaryScrollEl.scrollTop = 0;
    tertiaryScrollEl.innerHTML = renderTertiary('loading', kind, null);
    const data = kind === 'character' ? await fetchCharacterCached(id) : await fetchStaffCached(id);
    if (!tertiaryEl || tertiaryEl.hidden) return;
    tertiaryScrollEl.innerHTML = renderTertiary(data ? 'success' : 'error', kind, data);
    tertiaryScrollEl.scrollTop = 0;
  }

  function closeTertiary() {
    if (!tertiaryEl || tertiaryEl.hidden) return;
    tertiaryEl.classList.remove('active');
    document.removeEventListener('keydown', onTertiaryKeydown);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const done = () => { if (!tertiaryEl) return; tertiaryEl.hidden = true; tertiaryScrollEl.innerHTML = ''; };
    if (reduce) done(); else setTimeout(done, 260);
  }

  function tertiaryHeader(backText) {
    return '<div class="tertiary-header-bar">' +
        '<button type="button" class="tertiary-back">' + escapeHtml(backText || '← Back') + '</button>' +
        '<button type="button" class="tertiary-close" aria-label="Close">×</button>' +
      '</div>';
  }
  function tertiaryMediaCard(m) {
    return '<button type="button" class="tertiary-media" data-anilist-id="' + escapeHtml(String(m.id)) + '">' +
        (m.cover ? '<img class="tertiary-media-cover" src="' + escapeHtml(m.cover) + '" alt="" loading="lazy">' : '<span class="tertiary-media-cover tertiary-media-cover--ph"></span>') +
        '<span class="tertiary-media-title">' + escapeHtml(m.title || '') + '</span>' +
        (m.role ? '<span class="tertiary-media-role">' + escapeHtml(prettyEnum(m.role)) + '</span>' : '') +
      '</button>';
  }
  function tertiaryPersonCard(p, kind) {
    const attr = kind === 'character' ? ' data-character-id="' + escapeHtml(String(p.id)) + '"' : ' data-staff-id="' + escapeHtml(String(p.id)) + '"';
    return '<button type="button" class="tertiary-person"' + attr + '>' +
        (p.image ? '<img class="tertiary-person-img" src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : '<span class="tertiary-person-img tertiary-person-img--ph"></span>') +
        '<span class="tertiary-person-name">' + escapeHtml(p.name || '') + '</span>' +
      '</button>';
  }

  function renderTertiary(state, kind, data) {
    if (state === 'loading') {
      return tertiaryHeader('← Back') + '<div class="tertiary-loading"><div class="secondary-spinner" aria-hidden="true"></div><span>Loading…</span></div>';
    }
    if (state === 'error' || !data) {
      return tertiaryHeader('← Back') + '<div class="tertiary-empty">Couldn’t load this profile right now.</div>';
    }
    const isChar = kind === 'character';
    // bio (AniList description → HTML stripped to text, then run through the shared
    // markdown renderer so [Twitter](url) / AniList links / **bold** etc. render as
    // real <a>/<strong> — XSS-safe, links open target=_blank rel=noopener). v1.7.4 gate-3c.
    const bioText = stripAniListHtml(data.description);
    let bioHtml = '';
    if (bioText) {
      const long = bioText.length > 360;
      const para = window.renderMarkdown(bioText);
      bioHtml = '<section class="tertiary-section tertiary-bio' + (long ? ' is-collapsible' : '') + '">' +
          '<div class="tertiary-bio-body">' + para + '</div>' +
          (long ? '<button type="button" class="tertiary-readmore">Read more</button>' : '') +
        '</section>';
    }
    const factBits = [
      data.native ? escapeHtml(data.native) : '',
      data.age ? ('Age ' + escapeHtml(String(data.age))) : '',
      data.gender ? escapeHtml(data.gender) : '',
      data.dateOfBirth ? escapeHtml(data.dateOfBirth) : '',
      (!isChar && data.homeTown) ? escapeHtml(data.homeTown) : '',
    ].filter(Boolean);
    const kicker = isChar ? 'CHARACTER' : ((data.occupations && data.occupations.length) ? escapeHtml(data.occupations.join(' · ').toUpperCase()) : 'STAFF');

    const hero =
      '<div class="tertiary-hero">' +
        (data.image ? '<img class="tertiary-hero-img" src="' + escapeHtml(data.image) + '" alt="" loading="lazy">' : '<div class="tertiary-hero-img tertiary-hero-img--ph"></div>') +
        '<div class="tertiary-hero-meta">' +
          '<div class="tertiary-kicker">' + kicker + '</div>' +
          '<h2 class="tertiary-name">' + escapeHtml(data.name) + '</h2>' +
          (factBits.length ? '<div class="tertiary-facts">' + factBits.join('<span class="tertiary-fact-sep">·</span>') + '</div>' : '') +
        '</div>' +
      '</div>';

    // character: VAs + appearances; staff: characters + media credits
    let people = '';
    if (isChar && data.voiceActors && data.voiceActors.length) {
      people = '<section class="tertiary-section"><h3 class="tertiary-section-title">VOICE (JP)</h3><div class="tertiary-person-row">' +
        data.voiceActors.map(v => tertiaryPersonCard(v, 'staff')).join('') + '</div></section>';
    } else if (!isChar && data.characters && data.characters.length) {
      people = '<section class="tertiary-section"><h3 class="tertiary-section-title">CHARACTERS</h3><div class="tertiary-person-row">' +
        data.characters.map(c => tertiaryPersonCard(c, 'character')).join('') + '</div></section>';
    }
    const credits = isChar ? (data.appearances || []) : (data.staffMedia || []);
    const creditsHtml = credits.length
      ? '<section class="tertiary-section"><h3 class="tertiary-section-title">' + (isChar ? 'APPEARS IN' : 'KNOWN FOR') + '</h3><div class="tertiary-media-grid">' +
          credits.map(tertiaryMediaCard).join('') + '</div></section>'
      : '';

    return tertiaryHeader('← Back') + hero + bioHtml + people + creditsHtml;
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

  // v1.8.3 gate 4 — stable relevance order for live search: exact title, then
  // title-prefix, then title-substring, then facet-only matches; alpha tie-break.
  function rankBySearch(list, q) {
    const needle = norm(q);
    const score = (a) => {
      const title = norm(a.Title);
      if (title === needle) return 0;
      if (title.startsWith(needle)) return 1;
      if (title.includes(needle)) return 2;
      return 3;
    };
    return list.slice().sort((a, b) => {
      const d = score(a) - score(b);
      return d !== 0 ? d : String(a.Title).localeCompare(String(b.Title));
    });
  }

  function rerenderAll() {
    const f = readFilters();
    let base = (animeData || []).filter((a) => matchesFilters(a, f));
    const q = currentQuery();
    if (q) base = base.filter((a) => matchesSearch(a, q));

    if (!base.length) {
      cardContainer.classList.remove("is-sparse");
      // v1.7.1 — branded "no results" card (mirrors the suggestions-empty-card
      // vocabulary) replacing the bare text line. SUGGEST ONE always shows —
      // it's a valid action whether the dead-end came from search or filters.
      const body = q
        ? `No anime match "${escapeHtml(q)}" with your current filters.`
        : `No anime match your current filters.`;
      cardContainer.innerHTML =
        '<div class="search-empty-card">' +
          '<div class="se-glyph" aria-hidden="true">🔍</div>' +
          '<div class="se-kicker">NO MATCHES <span class="jp-mini">該当なし</span></div>' +
          '<p class="se-body">' + body + '</p>' +
          '<a class="se-cta" href="/suggest">SUGGEST ONE <span class="se-arrow" aria-hidden="true">→</span></a>' +
        '</div>';
      return;
    }
    // stable order while searching (no reshuffle per keystroke); shuffle for filter-only
    renderGrid(q ? rankBySearch(base, q) : shuffle(base));
  }

  function showHome() {
    hideDiscover();                          // v1.8.4 gate 3 — leave Discover if active
    hideForYou();                            // v1.8.4 gate 4 — leave For You if active
    setActivePlace(denBtn);                  // v1.8.4 gate 5 — Den is the active place at home
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
    hideDiscover();                          // v1.8.4 gate 3 — leave Discover if active
    hideForYou();                            // v1.8.4 gate 4 — leave For You if active

    homeView.style.display = "none";
    allView.style.display = "block";
    setActivePlace(null);                     // v1.8.4 gate 5 — View All is a tool view; no place lit

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
    saveFilterMemory();
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
    // v1.8.3 gate 4b — "View All Animes" means ALL: clear active filters + search
    // (and the stored memory) so it's a true reset, not a lingering filtered view.
    clearAllFilters();
    clearAppliedFilters();
    saveFilterMemory();
    if (searchInput) searchInput.value = "";
    inSearchMode = false;
    showAll();
  });
  
  // Logo/title should ALWAYS take you back to Home (even if you arrived via #all / #open=...)
// Logo/title should hard-refresh the page and return to Home (never stuck on #all)
homeBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  // v1.8.3 gate 4b — the wordmark resets to a CLEAN home: clear filters + their
  // stored memory so the reload doesn't restore them. (Reloading mid-browse WITHOUT
  // clicking the wordmark still restores — the memory feature stays for that flow.)
  clearAppliedFilters();
  saveFilterMemory();

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
    // v1.8.3 gate 4 — live results as you type (debounced). Empty → back home.
    let searchDebounce = null;
    searchInput.addEventListener("input", () => {
      const val = searchInput.value.trim();
      if (val === "") {
        if (searchDebounce) { clearTimeout(searchDebounce); searchDebounce = null; }
        inSearchMode = false;
        cardContainer.innerHTML = "";
        cardContainer.classList.remove("is-sparse");
        showHome();
        return;
      }
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchDebounce = null;
        inSearchMode = true;
        if (allView.style.display === "none") showAll();   // first keystroke: enter All view (+ one scroll)
        else rerenderAll();                                 // subsequent: just re-render in place
      }, 180);
    });
  }
  // v1.8.3 gate 4b — the search ✕ button was removed (Blake's call): clearing the
  // field text (or blurring) already cancels search via the input handler above.

  if (filterBtn && filterPanel) {
    const setFilterOpen = (open) => {
  filterPanel.classList.toggle("open", open);
  filterBtn.setAttribute("aria-expanded", String(open));
  filterBtn.classList.toggle("is-active", open);   // v1.8.4 gate 3b — consistent active state
  document.body.classList.toggle("filter-open", open);

  if (open) {
    if (filterNarrowInput) filterNarrowInput.value = "";
    applyFilterNarrow("");          // start every open with all options visible
    syncFilterFormToApplied();
    if (filterNarrowInput) setTimeout(() => { try { filterNarrowInput.focus({ preventScroll: true }); } catch (_) {} }, 30);
  }
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
  if (filterSavedBtn) {
    filterSavedBtn.addEventListener("click", () => {
      const on = filterSavedBtn.getAttribute("aria-pressed") === "true";
      filterSavedBtn.setAttribute("aria-pressed", String(!on));
      updateFilterUI();
    });
  }
  if (filterNarrowInput) {
    filterNarrowInput.addEventListener("input", () => applyFilterNarrow(filterNarrowInput.value));
    // keep Enter inside the narrow box from submitting / leaking to search
    filterNarrowInput.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
  }
  if (filterNarrowClear) {
    filterNarrowClear.addEventListener("click", () => {
      if (filterNarrowInput) { filterNarrowInput.value = ""; filterNarrowInput.focus(); }
      applyFilterNarrow("");
    });
  }
  // v1.8.4 gate 2 — review-status segment. Default-disable "Unreviewed" (catalog-
  // only until a discovery surface enables it via setFilterHasOutsideCards).
  wireReviewedSeg();
  setFilterHasOutsideCards(false);

  // v1.8.4 gate 3 — Discover surface wiring (provisional entry; G5 makes it nav).
  discoverBtn?.addEventListener("click", (e) => { e.preventDefault(); showDiscover(); });
  wireDiscoverLens();
  // v1.8.4 gate 4 — For You surface wiring (provisional entry; G5 makes it nav).
  foryouBtn?.addEventListener("click", (e) => { e.preventDefault(); showForYou(); });
  wireForYouLens();
  // v1.8.4 gate 5 — the Den place button is the SOFT in-page glide home (the logo
  // #home-button keeps its HARD reload as the clean-reset escape hatch). Re-measure the
  // sliding marker on resize since the active place can reflow.
  denBtn?.addEventListener("click", (e) => { e.preventDefault(); showHome(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('resize', () => {
    const active = [denBtn, foryouBtn, discoverBtn].find((b) => b && b.classList.contains('is-active'));
    moveMarker(active || null);
  });
  if (discoverSearchInput) {
    discoverSearchInput.addEventListener("input", () => {
      const v = discoverSearchInput.value;
      if (discoverSearchDebounce) clearTimeout(discoverSearchDebounce);
      discoverSearchDebounce = setTimeout(() => runDiscoverSearch(v), 350);
    });
  }
  discoverSearchForm?.addEventListener("submit", (e) => e.preventDefault());
  discoverSearchClear?.addEventListener("click", () => {
    if (discoverSearchInput) { discoverSearchInput.value = ""; discoverSearchInput.focus(); }
    if (discoverSearchDebounce) { clearTimeout(discoverSearchDebounce); discoverSearchDebounce = null; }
    runDiscoverSearch("");
  });
  // Restart the rail auto-advance loop when the tab becomes visible again (the
  // tick early-returns + idles while document.hidden).
  document.addEventListener("visibilitychange", () => { if (!document.hidden) ensureDiscoverRaf(); });

  if (filterApplyBtn) {
  filterApplyBtn.addEventListener("click", () => {
    setAppliedFilters(readFiltersFromForm());
    saveFilterMemory();   // remember across reloads

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

  // ===== Welcome door — ambient anime quotes (v1.8.3 gate 4b; v1.8.4 gate 8) =====
  // The LIVE quote list now lives in the public /quotes.json, managed from the admin Quotes
  // page (admin/quotes.html). The array below is only the OFFLINE FALLBACK — if quotes.json
  // can't be fetched, the door still shows these so it never goes quoteless. WELCOME_QUOTES is
  // pre-seeded with the fallback and swapped to the live list when the fetch resolves (see the
  // fetch in initWelcome). The door renders quote text via .textContent, so the JSON is escaped.
  const WELCOME_QUOTES_FALLBACK = [
    { quote: "Throughout heaven and earth, I alone am the honored one.", source: "Gojo — Jujutsu Kaisen" },
    { quote: "I'm just a hero for fun.", source: "Saitama — One Punch Man" },
    { quote: "Set your heart ablaze.", source: "Rengoku — Demon Slayer" },
    { quote: "If you don't fight, you can't win.", source: "Eren — Attack on Titan" },
    { quote: "The journey is what gives the destination its meaning.", source: "Frieren — Frieren: Beyond Journey's End" },
    { quote: "No matter how many times it takes, I'll save you.", source: "Subaru — Re:Zero" }
  ];
  let WELCOME_QUOTES = WELCOME_QUOTES_FALLBACK.slice();

  // ===== Den-door welcome splash (v1.8.3 gate 3) =====
  // Shown once per BROWSER SESSION (v1.8.3 gate 5b — sessionStorage, not localStorage):
  // close the tab → reopen = the door shows again, but in-site navigation within the same
  // tab (incl. the wordmark reload, which keeps the session) does NOT re-show it. Deferred
  // until after first paint; banner src lazy; Esc/Enter/backdrop dismiss; reduced-motion →
  // instant. Own z-tier (CSS 7900).
  const WELCOME_KEY = 'rar:welcomed';
  function initWelcome() {
    const splash = document.getElementById('welcome-splash');
    if (!splash) return;
    const enterBtn  = document.getElementById('welcome-enter');
    const bannerImg = document.getElementById('welcome-banner-img');
    const quotesLayer = document.getElementById('welcome-quotes');

    // v1.8.4 gate 6 — re-home the Update Log INTO the door (Blake: it "looked out of place"
    // on the homepage + collided with the strips). Move the LIVE node (data path + version
    // chip intact — it's a re-home, not a rebuild) under the Enter button; swap the gutter-
    // float classes (.side-widget/.changelog-drop) for the door-integrated .welcome-changelog.
    // Runs whether or not the door shows this session, so it's never on the home flow.
    const logEl = document.getElementById('changelog-drop');
    const cardEl = splash.querySelector('.welcome-card');
    if (logEl && cardEl) {
      logEl.classList.remove('side-widget', 'changelog-drop');
      logEl.classList.add('welcome-changelog');
      cardEl.appendChild(logEl);
      logEl.hidden = false;   // it started hidden in the home DOM to avoid a pre-JS flash
    }
    let lastFocus = null;
    let quoteIdx = 0;
    let quoteTimer = null;
    const quotePool = [];

    // v1.8.4 gate 8 — pull the live quote list from the public /quotes.json (managed from the
    // admin Quotes page). Fire-and-forget + NON-blocking: the door already runs on the pre-
    // seeded fallback, so it never waits on the network and never goes quoteless. If/when this
    // resolves, later bubbles pick up the live list (launchQuote re-reads WELCOME_QUOTES). The
    // door renders via .textContent, so quotes.json content is escaped (XSS-safe).
    fetch('/quotes.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(list => {
        const arr = Array.isArray(list) ? list : (list && Array.isArray(list.quotes) ? list.quotes : null);
        const clean = (arr || [])
          .filter(q => q && typeof q.quote === 'string' && q.quote.trim())
          .map(q => ({ quote: q.quote, source: typeof q.source === 'string' ? q.source : '' }));
        if (clean.length) {
          WELCOME_QUOTES = clean;
          // The reduced-motion path shows ONE static bubble, seeded from the fallback at open
          // (the animated path re-reads on its interval) — refresh it to the live list now.
          if (REDUCED_MOTION && quotePool[0]) fillBubble(quotePool[0], WELCOME_QUOTES[0]);
        }
      })
      .catch(() => {});

    // Quote bubbles (v1.8.3 gate 5c): outline-only comic speech bubbles (transparent, the
    // door art shows through; purple text) that fade in at a random OUTER spot, drift up
    // VERY SLOWLY ("the page is in space"), and fade out at a random time — they need not
    // reach the top. A center-exclusion keeps them off the banner/wordmark/Enter. A JS
    // stagger timer only LAUNCHES bubbles; one CSS animation per bubble does the rise (no
    // per-frame JS). Each bubble gets a random LIFETIME → constant slow speed → random rise
    // distance (set as CSS vars). Reduced-motion → one static bubble.
    const QUOTE_MAX = 4;            // max bubbles alive at once
    const QUOTE_FLOOR = 2;         // v1.8.4 gate 3e — keep >= this many on screen always
    const QUOTE_INTERVAL = 6500;   // ms between launches
    const QUOTE_SPEED = 2.0;       // vh per second — slow drift
    const QUOTE_LIFE_MIN = 16;     // s
    const QUOTE_LIFE_VAR = 18;     // + up to this many s (random lifetime)
    const QUOTE_GAP_PX = 22;       // gate 3e — min vertical gap between same-side bubbles

    function makeQuoteBubble() {
      const fig = document.createElement('figure');
      fig.className = 'welcome-quote-bubble';
      fig.innerHTML = '<blockquote class="wq-text"></blockquote><figcaption class="wq-src"></figcaption>';
      fig.dataset.busy = '0';
      quotesLayer.appendChild(fig);
      return fig;
    }
    function fillBubble(fig, q) {
      fig.querySelector('.wq-text').textContent = '“' + q.quote + '”';
      fig.querySelector('.wq-src').textContent = q.source || '';
    }
    function liveQuoteCount() {
      return quotePool.reduce((n, b) => n + (b.dataset.busy === '1' ? 1 : 0), 0);
    }
    // v1.8.4 gate 3e (item 1b) — collision avoidance. Bubbles on the same outer side
    // share a column; since they all rise at the SAME speed the vertical gap between
    // any two is CONSTANT, so a non-overlap at spawn (checked against the LIVE bubbles'
    // current rects) holds for their whole life. Returns a free bottom-vh, or null if
    // the side is too crowded to fit another without overlap.
    function pickQuoteSlot(side) {
      const vh = window.innerHeight / 100;
      const estH = 0.13 * window.innerHeight;        // generous bubble-height estimate
      const live = quotePool.filter((b) => b.dataset.busy === '1' && b.dataset.side === side);
      for (let tries = 0; tries < 12; tries++) {
        const bottomVh = secureRandomInt(88) - 4;    // -4..83
        const botPx = window.innerHeight - bottomVh * vh;   // candidate bottom edge (px from top)
        const topPx = botPx - estH;
        let clear = true;
        for (const b of live) {
          const r = b.getBoundingClientRect();
          if (botPx + QUOTE_GAP_PX > r.top && topPx - QUOTE_GAP_PX < r.bottom) { clear = false; break; }
        }
        if (clear) return bottomVh;
      }
      return null;
    }
    function launchQuote() {
      if (!quotesLayer || !WELCOME_QUOTES.length) return false;
      if (liveQuoteCount() >= QUOTE_MAX) return false;   // at the cap → skip
      // Spawn on the LESS-crowded side, then find a non-overlapping slot.
      const lLive = quotePool.filter((b) => b.dataset.busy === '1' && b.dataset.side === 'L').length;
      const rLive = quotePool.filter((b) => b.dataset.busy === '1' && b.dataset.side === 'R').length;
      let side = lLive < rLive ? 'L' : (rLive < lLive ? 'R' : (secureRandomInt(2) === 0 ? 'L' : 'R'));
      let bottomVh = pickQuoteSlot(side);
      if (bottomVh == null) { side = side === 'L' ? 'R' : 'L'; bottomVh = pickQuoteSlot(side); }
      if (bottomVh == null) return false;            // both sides crowded → skip (retried later)

      let fig = quotePool.find((b) => b.dataset.busy === '0');
      if (!fig) { fig = makeQuoteBubble(); quotePool.push(fig); }
      fillBubble(fig, WELCOME_QUOTES[quoteIdx % WELCOME_QUOTES.length]);
      quoteIdx++;
      // CENTER EXCLUSION — outer band only (the card/banner/copy live in the middle).
      const pct = side === 'L' ? (3 + secureRandomInt(20)) : (77 + secureRandomInt(20));
      fig.style.left = pct + '%';
      fig.dataset.side = side;
      fig.style.bottom = bottomVh + 'vh';
      // random lifetime → constant slow speed → random rise distance (may not reach top)
      const life = QUOTE_LIFE_MIN + secureRandomInt(QUOTE_LIFE_VAR + 1);
      fig.style.setProperty('--q-dur', life + 's');
      fig.style.setProperty('--q-dist', '-' + Math.round(life * QUOTE_SPEED) + 'vh');
      fig.dataset.busy = '1';
      fig.classList.remove('is-rising');
      void fig.offsetWidth;                          // reflow so the rise restarts
      fig.classList.add('is-rising');
      let finished = false;
      const done = () => {
        if (finished) return; finished = true;
        fig.dataset.busy = '0';
        fig.classList.remove('is-rising');
        fig.removeEventListener('animationend', done);
        // item 1a — keep the concurrency FLOOR: refill if we dropped below it.
        while (liveQuoteCount() < QUOTE_FLOOR) { if (!launchQuote()) break; }
      };
      fig.addEventListener('animationend', done);
      setTimeout(done, (life * 1000) + 800);         // fallback if animationend misses
      return true;
    }
    function startQuotes() {
      if (!quotesLayer || !WELCOME_QUOTES.length) return;
      quoteIdx = 0;
      if (REDUCED_MOTION) {                          // one static bubble (outer spot), no motion
        const fig = quotePool[0] || makeQuoteBubble();
        if (!quotePool.length) quotePool.push(fig);
        fillBubble(fig, WELCOME_QUOTES[0]);
        fig.dataset.side = 'L';
        fig.classList.add('is-static');
        return;
      }
      if (quoteTimer) { clearTimeout(quoteTimer); clearInterval(quoteTimer); }
      // item 2 — first bubbles appear IMMEDIATELY (no 4s delay); item 1a — seed the floor.
      for (let i = 0; i < QUOTE_FLOOR; i++) launchQuote();
      quoteTimer = setInterval(launchQuote, QUOTE_INTERVAL);
    }
    function stopQuotes() {
      if (quoteTimer) { clearTimeout(quoteTimer); clearInterval(quoteTimer); quoteTimer = null; }
      quotePool.forEach((b) => { b.dataset.busy = '0'; b.classList.remove('is-rising'); });
    }

    function openWelcome() {
      if (bannerImg && !bannerImg.getAttribute('src') && bannerImg.dataset.src) {
        bannerImg.src = bannerImg.dataset.src;   // lazy: fetch art only when shown
      }
      startQuotes();
      lastFocus = document.activeElement;
      splash.hidden = false;
      splash.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.remove('rar-welcome-pending');   // door is up → lift the pre-paint curtain
      document.documentElement.style.overflow = 'hidden';   // lock scroll while open
      if (!REDUCED_MOTION) {
        splash.classList.remove('is-out');
        requestAnimationFrame(() => splash.classList.add('is-in'));
      }
      document.addEventListener('keydown', onWelcomeKey, true);
      // v1.8.4 gate 3e (item 4) — focus the DIALOG CONTAINER, not the Enter button.
      // VERIFIED root cause (Firefox): a programmatic enterBtn.focus() makes the
      // button match :focus-visible in Firefox (its heuristic treats script-focus as
      // keyboard-focus), so the :focus-visible ring painted on auto-open — G3b's
      // outline removal didn't help because the ring is the :focus-visible one.
      // Focusing the splash (tabindex=-1, no ring) keeps the modal trapped + screen-
      // reader-announced; Esc/Enter still work via the document keydown listener, and
      // a keyboard Tab still lands on Enter with a proper :focus-visible ring.
      requestAnimationFrame(() => { try { splash.focus({ preventScroll: true }); } catch (_) {} });
    }

    function closeWelcome() {
      try { sessionStorage.setItem(WELCOME_KEY, '1'); } catch (_) {}
      document.removeEventListener('keydown', onWelcomeKey, true);
      const finish = () => {
        splash.hidden = true;
        splash.setAttribute('aria-hidden', 'true');
        splash.classList.remove('is-in', 'is-out');
        document.documentElement.style.overflow = '';
        stopQuotes();
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (_) {} }
      };
      if (REDUCED_MOTION) { finish(); return; }
      splash.classList.remove('is-in');
      splash.classList.add('is-out');
      let done = false;
      const once = () => { if (done) return; done = true; splash.removeEventListener('animationend', once); finish(); };
      splash.addEventListener('animationend', once);
      setTimeout(once, 560);   // fallback if animationend doesn't fire (exit is ~460ms)
    }

    function onWelcomeKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeWelcome(); }
    }

    if (enterBtn) enterBtn.addEventListener('click', closeWelcome);
    // v1.8.4 gate 3b — entry is ONLY via the Enter button (+ Esc/Enter keys). A
    // stray backdrop click no longer dismisses the door (removed the
    // click-on-backdrop -> closeWelcome handler per Blake).

    let welcomed = '0';
    try { welcomed = sessionStorage.getItem(WELCOME_KEY) || '0'; } catch (_) {}
    if (welcomed !== '1') {
      // two rAFs → let the site paint first, so the splash never blocks first render
      requestAnimationFrame(() => requestAnimationFrame(openWelcome));
    }
  }

  // ===== Scroll-reveal (v1.8.3 gate 3) — reveal-once, compositor-only =====
  // Adds .reveal-on to <html> (which arms the CSS hide) ONLY when IntersectionObserver
  // is supported AND motion is allowed, then reveals each .reveal section once as it
  // enters. No-JS / unsupported / reduced-motion all skip the arm → fully visible.
  function initScrollReveal() {
    const els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!els.length) return;
    if (REDUCED_MOTION || typeof IntersectionObserver === 'undefined') return;
    document.documentElement.classList.add('reveal-on');
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);   // reveal-once — never re-hides
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((el) => io.observe(el));
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
    buildContinueRail();   // v1.8.3 gate 5 — recent-history rail (hidden if empty)
    bindGenreShuffleButton();
    // v1.8.4 gate 5 — home hole-fill: dated folio + the two lazy strips (IO-gated so the
    // first paint stays API-free) + the airing strip's "See more in Discover" hand-off.
    setFolioDate();
    lazyFillOnView(homeAiringBlock, fillHomeAiring);
    lazyFillOnView(homeForyouBlock, buildHomeForYou);
    document.getElementById('home-airing-more')?.addEventListener('click', (e) => { e.preventDefault(); showDiscover(); });
    showHome();
    initScrollReveal();   // v1.8.3 gate 3 — reveal-once home sections
    initWelcome();        // v1.8.3 gate 3 — first-visit "den door" splash
    // v1.8.4 gate 8 — the animated veil pulse: gate the faint baseline + the sweep behind
    // html.veil-pulse-active ONLY when the pulse element exists AND motion is allowed, so
    // no-JS / reduced-motion keeps the static LIT veil. Pause the ring when the tab hides.
    (function initVeilPulse() {
      const vp = document.getElementById('veil-pulse');
      if (!vp) return;
      const glow = vp.querySelector('.vp-glow');
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const apply = () => document.documentElement.classList.toggle('veil-pulse-active', !mq.matches);
      apply();
      if (mq.addEventListener) mq.addEventListener('change', apply);
      else if (mq.addListener) mq.addListener(apply);   // legacy (Safari < 14)
      const syncPlay = () => { if (glow) glow.style.animationPlayState = document.hidden ? 'paused' : 'running'; };
      syncPlay();   // prime once (a tab opened in the background starts paused)
      document.addEventListener('visibilitychange', syncPlay);
    })();
    // v1.8.4 gate 7 — the #all hash route is handled once, below, by the comprehensive
    // hash-routing block (after filters load). The early duplicate check here was firing
    // showAll() a second time on index.html#all — removed.

    validateData(animeData);
    buildFilterUI();
    loadFilterMemory();          // v1.8.3 gate 4 — restore last applied filter
    syncFilterFormToApplied();   // reflect it in the form + summary/counts
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
  } else if (h.startsWith('#secondary=')) {
    // v1.7.5 (gate 2) — in-site deep-link to the secondary "deep dive" modal by
    // AniList id (the account page's non-catalog rows route here). No source row
    // / moreInfoContent → the Back chip falls back to "← Back" and closing returns
    // to the homepage. Normalized to #all after open so a refresh doesn't re-fire.
    const aniListId = Number(decodeURIComponent(h.slice('#secondary='.length)));
    if (typeof showAll === 'function') showAll();
    // v1.7.6 — a saved id that is an entry's PRIMARY AniListId opens the MAIN
    // franchise modal (with Blake's review), mirroring renderRecommendations'
    // routing split; watched-not-primary + non-catalog fall through to the secondary.
    let openedPrimary = false;
    const primarySlug = (aniListId && typeof primarySlugForAniListId === 'function') ? primarySlugForAniListId(aniListId) : null;
    if (primarySlug) {
      const list = (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData
        : (Array.isArray(window.animeData) ? window.animeData : []);
      const mk = (typeof slug === 'function') ? (t) => slug(t)
        : (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const found = list.find(a => mk(a.Title) === primarySlug);
      if (found && typeof openModal === 'function') { openModal(found); openedPrimary = true; }
    }
    if (!openedPrimary && aniListId && typeof openSecondaryModal === 'function') {
      openSecondaryModal(aniListId, null, null);
    }
    history.replaceState({}, '', location.pathname + location.search + '#all');
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
