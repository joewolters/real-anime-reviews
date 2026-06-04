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

  const api = {
    traverseFranchise,
    fetchMediaById,
    fetchBatch,
    sleep,
    MORE_INFO_QUERY_NODE,
    SPINE_RELATIONS,
    TRAVERSE_NODE_CAP,
    TRAVERSE_DEPTH_CAP,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.franchiseFetch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
