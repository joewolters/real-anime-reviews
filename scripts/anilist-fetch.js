#!/usr/bin/env node
/**
 * Real Anime Reviews — AniList fetch script
 * ============================================================================
 *
 * What this does
 * --------------
 * Hits the AniList GraphQL API for one anime by title (or a search) and prints
 * every field that's useful for this project. Building block for Mode 1.
 *
 * Three uses:
 *   1. Blake runs it manually to see what AniList has for an anime ("does
 *      this title even exist? what data is available?") before adding it.
 *   2. Other scripts (and eventually Mode 1) import the `fetchAniListAnime`
 *      function to pull data programmatically.
 *   3. Verifies the claims in `docs/anilist-spike.md` work against the live
 *      API. If AniList ever changes shape, this script will fail in a
 *      diagnostic way.
 *
 * Usage
 * -----
 *   node scripts/anilist-fetch.js "Charlotte"
 *      Human-readable output for one anime by exact title
 *
 *   node scripts/anilist-fetch.js "Charlotte" --json
 *      Machine-readable JSON output (for piping into other scripts)
 *
 *   node scripts/anilist-fetch.js --search "char" --top 5
 *      Search mode — returns top 5 matches for a partial title (powers the
 *      v1.6.1 "live preview as you type" dropdown)
 *
 *   node scripts/anilist-fetch.js --help
 *      This help
 *
 * Exit codes
 * ----------
 *   0 = success
 *   1 = no match found
 *   2 = API error (network, GraphQL error, malformed response)
 *   3 = bad arguments
 *
 * Authored by Code per Phase A pre-work + Mode 1 building-block plan.
 * Date: 2026-05-09. See `docs/anilist-spike.md` for field reference.
 * ============================================================================
 */

'use strict';

// ---- Constants -------------------------------------------------------------
const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const USER_AGENT = 'RealAnimeReviews/1.4.3 (https://realanimereviews.com)';

// ---- ANSI color codes ------------------------------------------------------
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ---- The full-detail query (for one anime) --------------------------------
const FULL_QUERY = `
query ($search: String!) {
  Media(search: $search, type: ANIME) {
    id
    idMal
    title { romaji english native userPreferred }
    description(asHtml: false)
    episodes
    duration
    seasonYear
    season
    format
    status
    countryOfOrigin
    isAdult
    genres
    tags { name rank isMediaSpoiler }
    studios { nodes { name isAnimationStudio } }
    coverImage { large extraLarge color }
    bannerImage
    averageScore
    meanScore
    popularity
    favourites
    trailer { id site thumbnail }
    externalLinks { site url type language }
    relations {
      edges {
        relationType
        node { id title { romaji } format }
      }
    }
    nextAiringEpisode { episode airingAt }
    siteUrl
    updatedAt
  }
}`;

// ---- The search query (for the top N matches) -----------------------------
const SEARCH_QUERY = `
query ($search: String!, $perPage: Int!) {
  Page(perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title { romaji english }
      coverImage { medium }
      seasonYear
      format
      averageScore
    }
  }
}`;

// ---- The actual fetch ------------------------------------------------------
async function callAniList(query, variables) {
  let response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    throw new Error(`Network error reaching AniList: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`AniList HTTP ${response.status} ${response.statusText}`);
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error(`AniList returned non-JSON: ${err.message}`);
  }

  if (body.errors && body.errors.length > 0) {
    const messages = body.errors.map((e) => e.message).join('; ');
    throw new Error(`AniList GraphQL error: ${messages}`);
  }

  return body.data;
}

// ---- Public API (importable by other scripts) -----------------------------

/**
 * Fetch full data for one anime by title.
 * @param {string} title - search term
 * @returns {Promise<object|null>} the Media object, or null if not found
 */
async function fetchAniListAnime(title) {
  const data = await callAniList(FULL_QUERY, { search: title });
  return data.Media || null;
}

/**
 * Search for the top N matches for a partial title.
 * @param {string} term - partial title
 * @param {number} top - max results (default 5)
 * @returns {Promise<Array>} array of match objects (possibly empty)
 */
async function searchAniList(term, top = 5) {
  const data = await callAniList(SEARCH_QUERY, { search: term, perPage: top });
  return (data.Page && data.Page.media) || [];
}

// ---- Pretty-printing helpers ----------------------------------------------

function formatScore(score) {
  if (score == null) return `${C.gray}n/a${C.reset}`;
  // AniList uses 0-100; convert to /10 for display consistency with the site
  return `${(score / 10).toFixed(1)}/10 ${C.gray}(${score}/100)${C.reset}`;
}

function formatStatus(status) {
  const label = {
    FINISHED: `${C.green}FINISHED${C.reset}`,
    RELEASING: `${C.yellow}RELEASING${C.reset}`,
    NOT_YET_RELEASED: `${C.cyan}NOT_YET_RELEASED${C.reset}`,
    CANCELLED: `${C.red}CANCELLED${C.reset}`,
    HIATUS: `${C.yellow}HIATUS${C.reset}`,
  };
  return label[status] || status || `${C.gray}n/a${C.reset}`;
}

function formatTags(tags) {
  if (!tags || tags.length === 0) return `${C.gray}none${C.reset}`;
  // Filter to high-rank, non-spoiler tags (per spike doc recommendation)
  const useful = tags
    .filter((t) => t.rank >= 60 && !t.isMediaSpoiler)
    .map((t) => `${t.name}${C.gray}(${t.rank})${C.reset}`)
    .slice(0, 12);
  if (useful.length === 0) return `${C.gray}(no tags above rank 60)${C.reset}`;
  return useful.join(', ');
}

function formatStudios(studios) {
  if (!studios || !studios.nodes || studios.nodes.length === 0) return `${C.gray}n/a${C.reset}`;
  return studios.nodes
    .filter((s) => s.isAnimationStudio)
    .map((s) => s.name)
    .join(', ') || studios.nodes.map((s) => s.name).join(', ');
}

function formatStreaming(externalLinks) {
  if (!externalLinks || externalLinks.length === 0) return `${C.gray}none listed${C.reset}`;
  const streaming = externalLinks.filter((l) => l.type === 'STREAMING');
  if (streaming.length === 0) return `${C.gray}no STREAMING-type links${C.reset}`;
  return streaming.map((l) => `${l.site}${l.language ? ` ${C.gray}[${l.language}]${C.reset}` : ''}`).join(', ');
}

function formatRelations(relations) {
  if (!relations || !relations.edges || relations.edges.length === 0) return `${C.gray}none${C.reset}`;
  const summary = {};
  for (const edge of relations.edges) {
    summary[edge.relationType] = (summary[edge.relationType] || 0) + 1;
  }
  return Object.entries(summary)
    .map(([type, count]) => `${type}:${count}`)
    .join(', ');
}

function printAnimeFull(anime) {
  if (!anime) {
    console.error(`${C.red}NO MATCH:${C.reset} AniList returned no anime for that title.`);
    return;
  }
  console.log('');
  console.log(`${C.bold}${anime.title.romaji}${C.reset}`);
  if (anime.title.english && anime.title.english !== anime.title.romaji) {
    console.log(`${C.gray}English:${C.reset}  ${anime.title.english}`);
  }
  if (anime.title.native) console.log(`${C.gray}Native:${C.reset}   ${anime.title.native}`);
  console.log('');
  console.log(`${C.bold}Identity${C.reset}`);
  console.log(`  AniList ID:  ${anime.id}`);
  console.log(`  MAL ID:      ${anime.idMal || `${C.gray}n/a${C.reset}`}`);
  console.log(`  AniList URL: ${anime.siteUrl}`);
  console.log('');
  console.log(`${C.bold}Core${C.reset}`);
  console.log(`  Format:      ${anime.format || `${C.gray}n/a${C.reset}`}`);
  console.log(`  Status:      ${formatStatus(anime.status)}`);
  console.log(`  Episodes:    ${anime.episodes || `${C.gray}n/a${C.reset}`}`);
  console.log(`  Duration:    ${anime.duration ? `${anime.duration} min` : `${C.gray}n/a${C.reset}`}`);
  const aired = `${anime.season || ''} ${anime.seasonYear || ''}`.trim() || `${C.gray}n/a${C.reset}`;
  console.log(`  Aired:       ${aired}`);
  console.log(`  Origin:      ${anime.countryOfOrigin || `${C.gray}n/a${C.reset}`}`);
  console.log(`  Adult:       ${anime.isAdult ? `${C.red}YES${C.reset}` : 'no'}`);
  console.log('');
  console.log(`${C.bold}Scores${C.reset}`);
  console.log(`  AniList avg: ${formatScore(anime.averageScore)}`);
  console.log(`  Mean:        ${formatScore(anime.meanScore)}`);
  console.log(`  Popularity:  ${anime.popularity?.toLocaleString() || '0'} users`);
  console.log(`  Favourites:  ${anime.favourites?.toLocaleString() || '0'} users`);
  console.log('');
  console.log(`${C.bold}Genre & Tags${C.reset}`);
  console.log(`  Genres:      ${anime.genres?.join(', ') || `${C.gray}none${C.reset}`}`);
  console.log(`  Top tags:    ${formatTags(anime.tags)}`);
  console.log('');
  console.log(`${C.bold}Studios${C.reset}`);
  console.log(`  ${formatStudios(anime.studios)}`);
  console.log('');
  console.log(`${C.bold}Image${C.reset}`);
  console.log(`  Cover URL:   ${anime.coverImage?.extraLarge || `${C.gray}n/a${C.reset}`}`);
  console.log(`  Color hint:  ${anime.coverImage?.color ? `${C.cyan}${anime.coverImage.color}${C.reset}` : `${C.gray}n/a${C.reset}`}`);
  console.log(`  Banner:      ${anime.bannerImage || `${C.gray}n/a${C.reset}`}`);
  console.log('');
  console.log(`${C.bold}Trailer${C.reset}`);
  if (anime.trailer && anime.trailer.id) {
    const embed = anime.trailer.site === 'youtube'
      ? `https://www.youtube.com/embed/${anime.trailer.id}`
      : `${anime.trailer.site}:${anime.trailer.id}`;
    console.log(`  Site:        ${anime.trailer.site}`);
    console.log(`  ID:          ${anime.trailer.id}`);
    console.log(`  Embed URL:   ${embed}`);
  } else {
    console.log(`  ${C.gray}none${C.reset}`);
  }
  console.log('');
  console.log(`${C.bold}Streaming (where to watch)${C.reset}`);
  console.log(`  ${formatStreaming(anime.externalLinks)}`);
  console.log('');
  console.log(`${C.bold}Relations${C.reset}`);
  console.log(`  ${formatRelations(anime.relations)}`);
  console.log('');
  console.log(`${C.bold}Description${C.reset}`);
  if (anime.description) {
    const wrapped = anime.description.replace(/(.{80,120}\s)/g, '$1\n  ').trim();
    console.log(`  ${wrapped}`);
  } else {
    console.log(`  ${C.gray}n/a${C.reset}`);
  }
  console.log('');
}

function printSearchResults(results, term) {
  if (results.length === 0) {
    console.error(`${C.red}NO MATCHES${C.reset} for "${term}"`);
    return;
  }
  console.log('');
  console.log(`${C.bold}Top ${results.length} matches for "${term}"${C.reset}`);
  console.log('');
  for (const m of results) {
    const score = m.averageScore != null ? `${(m.averageScore / 10).toFixed(1)}/10` : 'n/a';
    const year = m.seasonYear || '?';
    const fmt = m.format || '?';
    console.log(`  ${C.bold}${m.title.romaji}${C.reset} ${C.gray}(${year}, ${fmt}, score ${score}, AniList ID ${m.id})${C.reset}`);
    if (m.title.english && m.title.english !== m.title.romaji) {
      console.log(`    ${C.gray}English:${C.reset} ${m.title.english}`);
    }
  }
  console.log('');
}

// ---- CLI -------------------------------------------------------------------

function printHelp() {
  console.log(`
${C.bold}Real Anime Reviews — AniList fetch${C.reset}

  ${C.bold}Usage:${C.reset}
    node scripts/anilist-fetch.js ${C.green}"Charlotte"${C.reset}                  ${C.gray}# full detail, human-readable${C.reset}
    node scripts/anilist-fetch.js ${C.green}"Charlotte"${C.reset} --json           ${C.gray}# full detail, JSON for piping${C.reset}
    node scripts/anilist-fetch.js --search ${C.green}"char"${C.reset} --top 5      ${C.gray}# top N search matches${C.reset}
    node scripts/anilist-fetch.js --help

  ${C.bold}Examples:${C.reset}
    node scripts/anilist-fetch.js "Hell's Paradise"
    node scripts/anilist-fetch.js "Eminence in Shadow" --json > eminence.json
    node scripts/anilist-fetch.js --search "att" --top 8

  ${C.bold}For programmatic use:${C.reset}
    const { fetchAniListAnime, searchAniList } = require('./scripts/anilist-fetch.js');
    const anime = await fetchAniListAnime("Charlotte");
    const matches = await searchAniList("char", 5);

  ${C.bold}Schema reference:${C.reset} docs/anilist-spike.md
`);
}

async function mainCli() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(args.length === 0 ? 3 : 0);
  }

  const wantsJson = args.includes('--json');
  const isSearch = args.includes('--search');

  try {
    if (isSearch) {
      const searchIdx = args.indexOf('--search');
      const term = args[searchIdx + 1];
      const topIdx = args.indexOf('--top');
      const top = topIdx !== -1 ? parseInt(args[topIdx + 1], 10) : 5;

      if (!term || term.startsWith('--')) {
        console.error(`${C.red}ERROR:${C.reset} --search requires a term: --search "char"`);
        process.exit(3);
      }

      const results = await searchAniList(term, top);
      if (wantsJson) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        printSearchResults(results, term);
      }
      process.exit(results.length === 0 ? 1 : 0);
    } else {
      const title = args.find((a) => !a.startsWith('--'));
      if (!title) {
        console.error(`${C.red}ERROR:${C.reset} no title provided.`);
        process.exit(3);
      }

      const anime = await fetchAniListAnime(title);
      if (wantsJson) {
        console.log(JSON.stringify(anime, null, 2));
      } else {
        printAnimeFull(anime);
      }
      process.exit(anime ? 0 : 1);
    }
  } catch (err) {
    console.error(`${C.red}API ERROR:${C.reset} ${err.message}`);
    process.exit(2);
  }
}

// ---- Module exports + CLI dispatch ----------------------------------------
// v1.7.0 — callAniList exported so scripts/anilist-backfill.js can POST its own
// dedicated query (it needs idMal + episodes + coverImage.color, which
// searchAniList's SEARCH_QUERY doesn't return) without duplicating the fetch.
module.exports = { fetchAniListAnime, searchAniList, callAniList, ANILIST_ENDPOINT, USER_AGENT };

if (require.main === module) {
  mainCli();
}
