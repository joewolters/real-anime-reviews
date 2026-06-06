// franchise-fetch.js
// <!-- author: Code | date: 2026-06-03 -->
// v1.7.3 (gate 1a) — Shared multi-fetch + BFS franchise traversal.
// Extracted verbatim from script.js's IIFE (the v1.7.2 data layer) so ONE
// implementation serves all three consumers instead of three copies:
//   - script.js              (homepage More Info modal, v1.7.2)
//   - admin/new-anime.js     (watched-set checkbox tree, v1.7.3)
//   - scripts/backfill-watched.js (Node CLI, v1.7.3)
// Classic-script-safe: exposes window.franchiseFetch for browser consumers +
// module.exports for the Node CLI. Relies on the global `fetch` (browsers +
// Node 18+). Caching (in-memory L1 + localStorage L2) deliberately stays in
// script.js — only the network-traversal code lives here.
(function (root) {
  'use strict';

  const ANILIST_ENDPOINT_PUBLIC = 'https://graphql.anilist.co';

  // Per-node query: the node's own display fields + streamingEpisodes + ONE
  // level of relation edges (edges carry FULL display fields — proven
  // complexity-safe, the live shape). Deliberately does NOT nest relations-
  // within-relations (that mega-query 500s on Demon Slayer); multi-hop depth
  // comes from re-fetching each spine node by id, not from query nesting.
  const MORE_INFO_QUERY_NODE = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
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
    streamingEpisodes { title }
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

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms | 0)));
  }

  // Single Media(id:) fetch via MORE_INFO_QUERY_NODE. Honors a 429 with ONE
  // retry that respects the Retry-After header (seconds; falls back to 1000ms).
  // Returns { node, relationEdges, streamingEpisodes } or null on any failure.
  async function fetchMediaById(id, _retried) {
    if (!id) return null;
    try {
      const res = await fetch(ANILIST_ENDPOINT_PUBLIC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: MORE_INFO_QUERY_NODE, variables: { id } }),
      });
      if (res.status === 429 && !_retried) {
        const raHeader = parseInt(res.headers.get('Retry-After') || '', 10);
        const waitMs = Number.isFinite(raHeader) ? raHeader * 1000 : 1000;
        await sleep(waitMs);
        return fetchMediaById(id, true);
      }
      if (!res.ok) return null;
      const body = await res.json();
      if (body.errors?.length) return null;
      const media = body.data?.Media;
      if (!media || !media.id) return null;
      return {
        node: {
          id: media.id,
          title: media.title || { romaji: null, english: null },
          format: media.format || null,
          episodes: media.episodes || null,
          seasonYear: media.seasonYear || null,
          type: media.type || null,
          status: media.status || null,
          studios: media.studios || { nodes: [] },
          averageScore: media.averageScore || null,
          coverImage: media.coverImage || { large: '' },
        },
        relationEdges: media.relations?.edges || [],
        streamingEpisodes: media.streamingEpisodes || [],
      };
    } catch (_) {
      return null;
    }
  }

  // Fetch many ids in chunks of <=4 via Promise.all, 250ms between chunks to
  // stay under AniList's rate budget. Returns an array index-aligned to `ids`
  // (null where that id's fetch failed).
  async function fetchBatch(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 4) {
      const chunk = ids.slice(i, i + 4);
      const settled = await Promise.all(chunk.map(id => fetchMediaById(id)));
      for (const r of settled) out.push(r);
      if (i + 4 < ids.length) await sleep(250);
    }
    return out;
  }

  // Spine relation types we recurse through; every other ANIME relation is
  // collected one hop out and grouped (no recursion). Caps past the seen-set:
  // 30 nodes / 10 hops (belt-and-suspenders — the seen-set is the real cycle
  // guard; caps only fire on pathological graphs).
  const SPINE_RELATIONS = ['PREQUEL', 'PARENT', 'SEQUEL'];
  const TRAVERSE_NODE_CAP = 30;
  const TRAVERSE_DEPTH_CAP = 10;

  // BFS the franchise from startId. Recurses spine edges (PREQUEL/PARENT/SEQUEL,
  // TYPE=ANIME); collects non-spine ANIME neighbours one hop out into `groups`
  // keyed by relationType (display taken straight from the edge node — no extra
  // fetch). Aggregates each spine season's streamingEpisodes. Returns:
  //   { spine:            [ { ...displayNode, isSource } ]  (year-sorted),
  //     groups:           { RELATION_TYPE: [ { ...displayNode, relationType } ] },
  //     episodesBySeason: [ { id, title, seasonYear, episodes:[{title}] } ],
  //     failedCount:      int (sub-fetches that returned null) }
  async function traverseFranchise(startId) {
    const empty = { spine: [], groups: {}, episodesBySeason: [], failedCount: 0 };
    if (!startId) return empty;

    const seen = new Set([startId]);   // every id ever spine-enqueued (cycle guard)
    const grouped = new Set();         // ids already placed in a group (dedupe)
    const spineNodesById = new Map();  // id -> display node
    const groups = {};
    const episodesBySeason = [];
    let failedCount = 0;
    let depth = 0;
    let frontier = [startId];

    while (frontier.length && depth < TRAVERSE_DEPTH_CAP && spineNodesById.size < TRAVERSE_NODE_CAP) {
      // never fetch more than the remaining node-cap room this hop
      const room = TRAVERSE_NODE_CAP - spineNodesById.size;
      const batchIds = frontier.slice(0, room);
      const results = await fetchBatch(batchIds);
      const nextFrontier = [];

      results.forEach((r, i) => {
        const id = batchIds[i];
        if (!r || !r.node) { failedCount++; return; }
        spineNodesById.set(id, r.node);

        if (r.streamingEpisodes && r.streamingEpisodes.length) {
          episodesBySeason.push({
            id,
            title: (r.node.title && (r.node.title.english || r.node.title.romaji)) || '',
            seasonYear: r.node.seasonYear || null,
            episodes: r.streamingEpisodes,
          });
        }

        for (const edge of (r.relationEdges || [])) {
          const n = edge && edge.node;
          if (!n || n.type !== 'ANIME' || !n.id) continue;
          if (SPINE_RELATIONS.includes(edge.relationType)) {
            if (!seen.has(n.id)) { seen.add(n.id); nextFrontier.push(n.id); }
          } else if (!grouped.has(n.id) && !seen.has(n.id)) {
            grouped.add(n.id);
            (groups[edge.relationType] = groups[edge.relationType] || [])
              .push({ ...n, relationType: edge.relationType });
          }
        }
      });

      frontier = nextFrontier;
      depth++;
    }

    const spine = Array.from(spineNodesById.entries())
      .map(([id, node]) => ({ ...node, isSource: id === startId }))
      .sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0) || (a.id - b.id));
    episodesBySeason.sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0) || (a.id - b.id));

    return { spine, groups, episodesBySeason, failedCount };
  }

  // ──────────────────────────────────────────────────────────────────────
  // v1.7.4 (gate 2) — SIBLING detail query for the in-site secondary modal.
  // ADDITIVE: this does NOT touch MORE_INFO_QUERY_NODE or the traversal above
  // (those drive the load-bearing homepage franchise tree). It returns the
  // richer single-anime fields the secondary "deep dive" needs — description,
  // genres, tags, characters, staff, banner, trailer, links — that the lean
  // per-node query deliberately omits. Single Media(id:) fetch, one hop only,
  // no relations-within-relations (query-complexity gotcha #8). Caching is the
  // CALLER's job (script.js, mirroring the franchiseTreeCache pattern) — this
  // module stays pure-network + Node-CLI-safe (no localStorage / APP_VERSION).
  // ──────────────────────────────────────────────────────────────────────
  const MEDIA_DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    description
    genres
    tags { name rank isGeneralSpoiler isMediaSpoiler }
    bannerImage
    coverImage { extraLarge large color }
    averageScore
    meanScore
    season
    seasonYear
    episodes
    duration
    format
    status
    studios { nodes { name isAnimationStudio } }
    externalLinks { site url type }
    trailer { id site thumbnail }
    streamingEpisodes { title thumbnail url site }
    characters(sort: [ROLE, RELEVANCE], perPage: 12) {
      edges { role node { id name { full } image { medium } } }
    }
    staff(sort: RELEVANCE, perPage: 8) {
      edges { role node { id name { full } image { medium } } }
    }
    recommendations(sort: RATING_DESC, perPage: 8) {
      nodes { mediaRecommendation { id type title { romaji english } format coverImage { large } averageScore } }
    }
  }
}`;

  // Fetch ONE anime's rich detail by id. Same 429/Retry-After single-retry as
  // fetchMediaById. Returns a normalized object or null on any failure. The raw
  // AniList `description` (HTML) is returned verbatim — the caller strips it on
  // render ("HTML strip on read").
  async function fetchMediaDetail(id, _retried) {
    if (!id) return null;
    try {
      const res = await fetch(ANILIST_ENDPOINT_PUBLIC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: MEDIA_DETAIL_QUERY, variables: { id } }),
      });
      if (res.status === 429 && !_retried) {
        const raHeader = parseInt(res.headers.get('Retry-After') || '', 10);
        const waitMs = Number.isFinite(raHeader) ? raHeader * 1000 : 1000;
        await sleep(waitMs);
        return fetchMediaDetail(id, true);
      }
      if (!res.ok) return null;
      const body = await res.json();
      if (body.errors?.length) return null;
      const m = body.data?.Media;
      if (!m || !m.id) return null;

      const charEdges = (m.characters && m.characters.edges) || [];
      const staffEdges = (m.staff && m.staff.edges) || [];
      return {
        id: m.id,
        title: m.title || { romaji: null, english: null, native: null },
        description: m.description || '',
        genres: Array.isArray(m.genres) ? m.genres : [],
        // Drop spoiler tags; keep the strongest by rank.
        tags: (Array.isArray(m.tags) ? m.tags : [])
          .filter(t => t && t.name && !t.isGeneralSpoiler && !t.isMediaSpoiler)
          .sort((a, b) => (b.rank || 0) - (a.rank || 0))
          .map(t => ({ name: t.name, rank: t.rank || 0 })),
        bannerImage: m.bannerImage || null,
        coverImage: m.coverImage || { extraLarge: '', large: '', color: null },
        averageScore: m.averageScore || null,
        meanScore: m.meanScore || null,
        season: m.season || null,
        seasonYear: m.seasonYear || null,
        episodes: m.episodes || null,
        duration: m.duration || null,
        format: m.format || null,
        status: m.status || null,
        studios: ((m.studios && m.studios.nodes) || [])
          .filter(s => s && s.name).map(s => ({ name: s.name, isAnimationStudio: s.isAnimationStudio !== false })),
        externalLinks: (Array.isArray(m.externalLinks) ? m.externalLinks : [])
          .filter(l => l && l.url && l.site).map(l => ({ site: l.site, url: l.url, type: l.type || null })),
        trailer: (m.trailer && m.trailer.id) ? { id: m.trailer.id, site: m.trailer.site || null, thumbnail: m.trailer.thumbnail || null } : null,
        streamingEpisodes: (Array.isArray(m.streamingEpisodes) ? m.streamingEpisodes : [])
          .map(e => ({
            title: (e && e.title) || '',
            thumbnail: (e && e.thumbnail) || null,
            // v1.7.5 (gate 3) — url + site for the per-episode in-row expand
            // (attribution carve-out covers the site name on the ↗ link).
            url: (e && e.url) || null,
            site: (e && e.site) || null,
          })),
        characters: charEdges
          .filter(e => e && e.node && e.node.name && e.node.name.full)
          .map(e => ({ id: e.node.id, name: e.node.name.full, image: (e.node.image && e.node.image.medium) || null, role: e.role || null })),
        staff: staffEdges
          .filter(e => e && e.node && e.node.name && e.node.name.full && e.role)
          .map(e => ({ id: e.node.id, name: e.node.name.full, image: (e.node.image && e.node.image.medium) || null, role: e.role })),
        recommendations: (((m.recommendations && m.recommendations.nodes) || [])
          .map(n => n && n.mediaRecommendation)
          .filter(r => r && r.id && r.type === 'ANIME')
          .map(r => ({
            id: r.id,
            title: r.title || { romaji: null, english: null },
            format: r.format || null,
            coverImage: r.coverImage || { large: '' },
            averageScore: r.averageScore || null,
          }))),
      };
    } catch (_) {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // v1.7.4 (gate 3, Surface 3) — CHARACTER + STAFF detail queries for the
  // tertiary "deep dive" layer. ADDITIVE — independent of MEDIA_DETAIL_QUERY and
  // the traversal. Character/Staff queries are far lighter than Media (no
  // complexity risk). Caching is the caller's job (script.js rar:character/rar:staff).
  // ──────────────────────────────────────────────────────────────────────
  const CHARACTER_DETAIL_QUERY = `
query ($id: Int) {
  Character(id: $id) {
    id
    name { full native }
    image { large }
    description
    age
    gender
    dateOfBirth { year month day }
    media(sort: POPULARITY_DESC, perPage: 8) {
      edges {
        characterRole
        voiceActors(language: JAPANESE, sort: RELEVANCE) { id name { full } image { medium } }
        node { id type title { romaji english } coverImage { large } }
      }
    }
  }
}`;

  const STAFF_DETAIL_QUERY = `
query ($id: Int) {
  Staff(id: $id) {
    id
    name { full native }
    image { large }
    description
    age
    gender
    dateOfBirth { year month day }
    primaryOccupations
    homeTown
    characters(sort: FAVOURITES_DESC, perPage: 8) {
      nodes { id name { full } image { medium } }
    }
    staffMedia(sort: POPULARITY_DESC, perPage: 8) {
      edges { staffRole node { id type title { romaji english } coverImage { large } } }
    }
  }
}`;

  function fmtDob(d) {
    if (!d || !d.year) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mo = (d.month >= 1 && d.month <= 12) ? months[d.month - 1] : '';
    return [mo, d.day, d.year].filter(Boolean).join(' ');
  }

  // Fetch one character's detail by id. Same 429/Retry-After single retry.
  async function fetchCharacterDetail(id, _retried) {
    if (!id) return null;
    try {
      const res = await fetch(ANILIST_ENDPOINT_PUBLIC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: CHARACTER_DETAIL_QUERY, variables: { id } }),
      });
      if (res.status === 429 && !_retried) {
        const ra = parseInt(res.headers.get('Retry-After') || '', 10);
        await sleep(Number.isFinite(ra) ? ra * 1000 : 1000);
        return fetchCharacterDetail(id, true);
      }
      if (!res.ok) return null;
      const body = await res.json();
      if (body.errors?.length) return null;
      const c = body.data?.Character;
      if (!c || !c.id) return null;
      const edges = (c.media && c.media.edges) || [];
      const vaMap = new Map();
      edges.forEach(e => (e.voiceActors || []).forEach(v => { if (v && v.id && !vaMap.has(v.id)) vaMap.set(v.id, { id: v.id, name: (v.name && v.name.full) || '', image: (v.image && v.image.medium) || null }); }));
      return {
        id: c.id,
        name: (c.name && c.name.full) || '',
        native: (c.name && c.name.native) || null,
        image: (c.image && c.image.large) || null,
        description: c.description || '',
        age: c.age || null,
        gender: c.gender || null,
        dateOfBirth: fmtDob(c.dateOfBirth),
        voiceActors: Array.from(vaMap.values()).slice(0, 6),
        appearances: edges
          .filter(e => e && e.node && e.node.id && e.node.type === 'ANIME')
          .map(e => ({ id: e.node.id, title: (e.node.title && (e.node.title.english || e.node.title.romaji)) || '', cover: (e.node.coverImage && e.node.coverImage.large) || null, role: e.characterRole || null }))
          .slice(0, 8),
      };
    } catch (_) { return null; }
  }

  // Fetch one staff member's detail by id.
  async function fetchStaffDetail(id, _retried) {
    if (!id) return null;
    try {
      const res = await fetch(ANILIST_ENDPOINT_PUBLIC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: STAFF_DETAIL_QUERY, variables: { id } }),
      });
      if (res.status === 429 && !_retried) {
        const ra = parseInt(res.headers.get('Retry-After') || '', 10);
        await sleep(Number.isFinite(ra) ? ra * 1000 : 1000);
        return fetchStaffDetail(id, true);
      }
      if (!res.ok) return null;
      const body = await res.json();
      if (body.errors?.length) return null;
      const s = body.data?.Staff;
      if (!s || !s.id) return null;
      const charNodes = (s.characters && s.characters.nodes) || [];
      const mediaEdges = (s.staffMedia && s.staffMedia.edges) || [];
      return {
        id: s.id,
        name: (s.name && s.name.full) || '',
        native: (s.name && s.name.native) || null,
        image: (s.image && s.image.large) || null,
        description: s.description || '',
        age: s.age || null,
        gender: s.gender || null,
        dateOfBirth: fmtDob(s.dateOfBirth),
        occupations: Array.isArray(s.primaryOccupations) ? s.primaryOccupations : [],
        homeTown: s.homeTown || null,
        characters: charNodes
          .filter(n => n && n.id && n.name && n.name.full)
          .map(n => ({ id: n.id, name: n.name.full, image: (n.image && n.image.medium) || null }))
          .slice(0, 8),
        staffMedia: mediaEdges
          .filter(e => e && e.node && e.node.id && e.node.type === 'ANIME')
          .map(e => ({ id: e.node.id, title: (e.node.title && (e.node.title.english || e.node.title.romaji)) || '', cover: (e.node.coverImage && e.node.coverImage.large) || null, role: e.staffRole || null }))
          .slice(0, 8),
      };
    } catch (_) { return null; }
  }

  // ──────────────────────────────────────────────────────────────────────
  // v1.8.4 (gate 1) — DISCOVERY list queries for the For You / Discover
  // surfaces. ADDITIVE — independent of every query above (those drive the
  // load-bearing catalog modal). These are FLAT Page(media:) lists with NO
  // nested relations, so they are inherently safe vs the query-complexity trap
  // (gotcha #8 — the canary still gates them). They feed cards, so they return
  // the lean card-shaped fields only (id/title/cover/score/genres/year/format/
  // status) — the rich per-anime detail still comes from fetchMediaDetail when a
  // card is opened. Caching is the CALLER's job (script.js makeListCache),
  // consistent with this module staying pure-network + Node-CLI-safe.
  //
  // Shared field set across all three (kept identical so one normalizer + one
  // card mapper serve every discovery surface):
  const DISCOVERY_MEDIA_FIELDS = `
    id
    title { romaji english native }
    coverImage { large color }
    bannerImage
    averageScore
    genres
    season
    seasonYear
    format
    status
    episodes`;

  // Live search (Discover). sort SEARCH_MATCH so the best title match leads.
  const SEARCH_QUERY = `
query ($search: String, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {${DISCOVERY_MEDIA_FIELDS}
    }
  }
}`;

  // Trending now (For-You signed-out fallback + community "Popular right now").
  const TRENDING_QUERY = `
query ($perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {${DISCOVERY_MEDIA_FIELDS}
    }
  }
}`;

  // Currently airing (the Top-10 airing hero + airing-by-genre). genre is
  // OPTIONAL — a null $genre is ignored by AniList (no filter), so the same
  // query serves both "all airing" and "airing in {genre}".
  const AIRING_QUERY = `
query ($perPage: Int, $genre: String) {
  Page(page: 1, perPage: $perPage) {
    media(type: ANIME, status: RELEASING, sort: TRENDING_DESC, genre: $genre, isAdult: false) {${DISCOVERY_MEDIA_FIELDS}
    }
  }
}`;

  // Normalize one Page.media node into the lean card shape (same defensive
  // defaulting as fetchMediaDetail). Returns null for a junk node.
  function normalizeListMedia(m) {
    if (!m || !m.id) return null;
    return {
      id: m.id,
      title: m.title || { romaji: null, english: null, native: null },
      coverImage: m.coverImage || { large: '', color: null },
      bannerImage: m.bannerImage || null,
      averageScore: m.averageScore || null,
      genres: Array.isArray(m.genres) ? m.genres : [],
      season: m.season || null,
      seasonYear: m.seasonYear || null,
      format: m.format || null,
      status: m.status || null,
      episodes: m.episodes || null,
    };
  }

  // Generic Page(media:) fetch shared by all three discovery queries. Same
  // 429/Retry-After single-retry as the detail fetchers. Returns an ARRAY (not
  // null) — [] on ANY failure (network, !ok, GraphQL errors, abort) so callers
  // render an empty state, never crash. An optional AbortSignal lets the search
  // call site abort an in-flight request (the /suggest debounce pattern) — an
  // abort lands in the catch and resolves to [].
  async function fetchMediaPage(query, variables, signal, _retried) {
    try {
      const res = await fetch(ANILIST_ENDPOINT_PUBLIC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: signal || undefined,
      });
      if (res.status === 429 && !_retried) {
        const ra = parseInt(res.headers.get('Retry-After') || '', 10);
        await sleep(Number.isFinite(ra) ? ra * 1000 : 1000);
        return fetchMediaPage(query, variables, signal, true);
      }
      if (!res.ok) return [];
      const body = await res.json();
      if (body.errors?.length) return [];
      const media = body.data?.Page?.media;
      if (!Array.isArray(media)) return [];
      return media.map(normalizeListMedia).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  // Discover live search. Empty/whitespace query short-circuits to [] (no call).
  function searchMediaList(q, perPage, signal) {
    const term = String(q || '').trim();
    if (!term) return Promise.resolve([]);
    return fetchMediaPage(SEARCH_QUERY, { search: term, perPage: perPage || 20 }, signal);
  }

  // Trending now. perPage defaults to a DEEP pool (50) so the freshness seed
  // (script.js, sessionStorage) has room to surface a different window per login.
  function fetchTrendingList(perPage) {
    return fetchMediaPage(TRENDING_QUERY, { perPage: perPage || 50 }, null);
  }

  // Currently airing, optionally filtered to one genre (null/'' => all airing).
  function fetchAiringList(perPage, genre) {
    const g = (genre && String(genre).trim()) ? String(genre).trim() : null;
    return fetchMediaPage(AIRING_QUERY, { perPage: perPage || 50, genre: g }, null);
  }

  const api = {
    traverseFranchise,
    fetchMediaById,
    fetchMediaDetail,
    fetchCharacterDetail,
    fetchStaffDetail,
    fetchBatch,
    sleep,
    // v1.8.4 discovery layer
    searchMediaList,
    fetchTrendingList,
    fetchAiringList,
    normalizeListMedia,
    MORE_INFO_QUERY_NODE,
    MEDIA_DETAIL_QUERY,
    CHARACTER_DETAIL_QUERY,
    STAFF_DETAIL_QUERY,
    SEARCH_QUERY,
    TRENDING_QUERY,
    AIRING_QUERY,
    SPINE_RELATIONS,
    TRAVERSE_NODE_CAP,
    TRAVERSE_DEPTH_CAP,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.franchiseFetch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
