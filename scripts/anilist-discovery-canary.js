#!/usr/bin/env node
// scripts/anilist-discovery-canary.js
// <!-- author: Code | date: 2026-06-05 -->
// v1.8.4 (gate 1) — LIVE canary for the 3 new flat discovery queries in
// franchise-fetch.js (SEARCH / TRENDING / AIRING). The flat Page(media:) shape
// is inherently safe vs the query-complexity trap (gotcha #8), but the 101922
// (Demon Slayer) canary stays the gate — it 500s any over-nested query, so a
// green run proves these lists are complexity-safe AND shaped right.
//
// Run:  node scripts/anilist-discovery-canary.js
// Exits 0 on all-green, 1 on any failure. Hits AniList live (Node-18+ fetch).
'use strict';

const ff = require('../franchise-fetch.js');

const DEMON_SLAYER = 101922; // the complexity canary id

let failures = 0;
function check(name, ok, detail) {
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}
function title(m) {
  return (m && m.title && (m.title.english || m.title.romaji)) || '(untitled)';
}

(async () => {
  console.log('=== v1.8.4 discovery canary (live AniList, id 101922 gate) ===\n');

  // 1. SEARCH "demon slayer" must surface 101922 (proves search shape + sort).
  const search = await ff.searchMediaList('demon slayer', 20);
  check('SEARCH returns a non-empty list', Array.isArray(search) && search.length > 0,
    `${search.length} results`);
  const hit = search.find(m => m.id === DEMON_SLAYER);
  check('SEARCH "demon slayer" includes 101922 (canary, no 500)', !!hit,
    hit ? `"${title(hit)}" rank ${search.indexOf(hit) + 1}` : 'NOT FOUND');
  if (search[0]) check('SEARCH result is card-shaped',
    'coverImage' in search[0] && 'averageScore' in search[0] && Array.isArray(search[0].genres),
    `top: "${title(search[0])}" (${search[0].format}, ${search[0].seasonYear})`);

  // 2. TRENDING must return a deep, non-empty pool with no 500.
  const trending = await ff.fetchTrendingList(50);
  check('TRENDING returns a deep pool (no 500)', Array.isArray(trending) && trending.length >= 10,
    `${trending.length} results, top: "${title(trending[0])}"`);

  // 3. AIRING (no genre) must return currently-releasing titles, no 500.
  const airing = await ff.fetchAiringList(50, null);
  check('AIRING (all) returns releasing titles (no 500)', Array.isArray(airing) && airing.length > 0,
    `${airing.length} results, top: "${title(airing[0])}"`);
  if (airing.length) check('AIRING items are status RELEASING',
    airing.every(m => m.status === 'RELEASING'),
    `${airing.filter(m => m.status === 'RELEASING').length}/${airing.length} RELEASING`);

  // 4. AIRING by genre must apply the filter (optional $genre is honored, no 500).
  const airingAction = await ff.fetchAiringList(50, 'Action');
  check('AIRING genre:"Action" returns a filtered list (no 500)',
    Array.isArray(airingAction) && airingAction.length > 0,
    `${airingAction.length} results`);
  if (airingAction.length) check('AIRING genre filter is applied',
    airingAction.every(m => m.genres.includes('Action')),
    `${airingAction.filter(m => m.genres.includes('Action')).length}/${airingAction.length} include Action`);

  console.log(`\n=== ${failures === 0 ? 'ALL GREEN' : failures + ' FAILURE(S)'} ===`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('CANARY CRASHED:', e); process.exit(1); });
