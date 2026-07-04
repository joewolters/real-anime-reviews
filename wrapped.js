// wrapped.js (ES module) — mega-run milestone C3: CONSTELLATION WRAPPED.
// <!-- author: Code | date: 2026-07-02 -->
// A member's year in the Den drawn as a PURPLE star map on the site's own
// constellation vocabulary (the veil's #c9a4ff/#b388ff/#e3c9ff strokes).
// TRUTHFUL stats only: reviews / avg rating / comments / replies / threads /
// posts / saves / member-since / shelf genres. NEVER watch-time, votes, or
// anything the client can't actually query (don't fabricate delight).
// THE HEART: exactly ONE gold star may ever appear on this member surface —
// the day they joined (the site's mark on their sky). Everything else purple.
// Self-contained lane: account.js calls initWrapped(user, { friendlyError });
// the pure model rides window.wrappedModel so Playwright can pin it.
import { db } from './firebase.js';
import {
  getDocs, collection, query, orderBy, where, limit, collectionGroup
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

// ---------------------------------------------------------------------------
// pure model (no DOM, no Firebase — Playwright pins these via window.wrappedModel)
// ---------------------------------------------------------------------------

// FNV-1a 32-bit — deterministic star jitter (no Math.random: positions must be
// stable across repaints, cacheable, and reproducible in specs).
function hash32(str) {
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}
// map a hash into [lo, hi) using decorrelated bit windows per salt
function hashRange(h, salt, lo, hi) {
  const x = (((h >>> (salt % 13)) ^ (h << (salt % 7))) >>> 0) % 10000;
  return lo + (x / 10000) * (hi - lo);
}

function yearOf(ms) { return new Date(ms).getFullYear(); }

// raw = { items:[{path,createdAtMs,rating,removed}], replies:[{path,createdAtMs}],
//         threads:[{path,createdAtMs}], posts:[{path,createdAtMs}],
//         saves:[{animeId,ms,title}], caps:{items,replies,threads,posts} }
// genresByAnimeId = Map(slug -> "Shonen/Action") from the catalog (shelf genres
// are ALL-TIME by design — a shelf is timeless state, the map is the year).
function computeWrapped(raw, year, joinMs, genresByAnimeId, seedKey) {
  const inYear = (ms) => typeof ms === 'number' && ms > 0 && yearOf(ms) === year;
  const stars = [];

  let reviews = 0, ratingSum = 0, ratingN = 0, comments = 0;
  (raw.items || []).forEach((it) => {
    if (it.removed || !inYear(it.createdAtMs)) return;
    const root = String(it.path || '').split('/')[0];
    if (root === 'reviews') {
      reviews++;
      const r = (typeof it.rating === 'number') ? it.rating : null;
      if (r !== null) { ratingSum += r; ratingN++; }
      stars.push({ kind: 'review', ms: it.createdAtMs, id: it.path, rating: r, label: it.animeTitle || '' });
    } else if (root === 'comments') {
      comments++;
      stars.push({ kind: 'comment', ms: it.createdAtMs, id: it.path });
    }
  });

  let replies = 0;
  (raw.replies || []).forEach((it) => {
    if (it.removed || !inYear(it.createdAtMs)) return;
    replies++;
    stars.push({ kind: 'reply', ms: it.createdAtMs, id: it.path });
  });

  // review-discussion comments (reviews/{id}/items/{uid}/threads/{tid}) — the
  // activity feed calls these "Discussion comments"; they star like comments.
  let discussions = 0;
  (raw.discussions || []).forEach((it) => {
    if (it.removed || !inYear(it.createdAtMs)) return;
    discussions++;
    stars.push({ kind: 'comment', ms: it.createdAtMs, id: it.path });
  });

  // Tavern threads — the FLAT forum collection (authorUid), NOT a
  // collectionGroup: CG('threads') matches the review-discussion subcollection
  // instead (the account activity feed is the precedent for both).
  let threads = 0;
  (raw.threads || []).forEach((it) => {
    if (it.removed || !inYear(it.createdAtMs)) return;
    threads++;
    stars.push({ kind: 'thread', ms: it.createdAtMs, id: it.path });
  });

  let posts = 0;
  (raw.posts || []).forEach((it) => {
    if (it.removed || !inYear(it.createdAtMs)) return;
    posts++;
    stars.push({ kind: 'post', ms: it.createdAtMs, id: it.path });
  });

  let saves = 0;
  (raw.saves || []).forEach((s) => {
    if (!inYear(s.ms)) return;
    saves++;
    stars.push({ kind: 'save', ms: s.ms, id: 'save:' + s.animeId });
  });

  // shelf genres — from EVERYTHING saved (timeless), catalog titles only (the
  // AniList saves carry no genre data; counting only what we truly know).
  const genreCounts = new Map();
  (raw.saves || []).forEach((s) => {
    const g = genresByAnimeId && genresByAnimeId.get(s.animeId);
    if (!g) return;
    String(g).split(/[/,&]+/).forEach((part) => {
      const name = part.trim();
      if (!name) return;
      genreCounts.set(name, (genreCounts.get(name) || 0) + 1);
    });
  });
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);

  // THE ONE GOLD STAR: the join day — only when it truthfully lives in this
  // year's sky. An earlier join renders as the gold "sky began" caption, never
  // as a star plotted into a year it doesn't belong to.
  const gold = (typeof joinMs === 'number' && joinMs > 0 && yearOf(joinMs) === year)
    ? { kind: 'gold-join', ms: joinMs, id: 'gold:join' } : null;
  const skyBegan = (typeof joinMs === 'number' && joinMs > 0 && yearOf(joinMs) < year) ? joinMs : null;

  const clipped = !!(raw.caps && (raw.caps.items || raw.caps.replies || raw.caps.discussions || raw.caps.threads || raw.caps.posts));

  return {
    year,
    seed: hash32(`${seedKey || ''}:${year}`),   // ambient-dust seed — each sky subtly its own
    stats: {
      reviews,
      avgRating: ratingN ? Math.round((ratingSum / ratingN) * 10) / 10 : null,
      comments, discussions, replies, threads, posts, saves, topGenres,
      joinMs: (typeof joinMs === 'number' && joinMs > 0) ? joinMs : null
    },
    stars, gold, skyBegan, clipped,
    empty: (reviews + comments + discussions + replies + threads + posts + saves) === 0
  };
}

// Deterministic sky layout. x = real time axis (month + day fraction);
// y = a per-kind band with hash jitter, so the sky is honest about WHEN and
// painterly about WHERE.
const SKY = { w: 1200, h: 520, padL: 70, padR: 30, plotTop: 55, labelY: 490 };
const BANDS = {
  review:  [70, 250],
  thread:  [90, 290],
  comment: [190, 340],
  post:    [230, 360],
  reply:   [250, 380],
  save:    [320, 420],
  'gold-join': [120, 210]
};
function layoutStars(model) {
  const plotW = SKY.w - SKY.padL - SKY.padR;
  const place = (star) => {
    const d = new Date(star.ms);
    const month = d.getMonth();
    const frac = Math.min(1, (d.getDate() - 1) / 31);
    const h = hash32(star.id);
    const band = BANDS[star.kind] || [100, 400];
    return {
      ...star,
      x: Math.round((SKY.padL + ((month + frac) / 12) * plotW) * 10) / 10,
      y: Math.round(hashRange(h, 3, band[0], band[1]) * 10) / 10,
      h
    };
  };
  const placed = (model.stars || []).map(place);
  if (model.gold) placed.push(place(model.gold));
  // the member's own constellation: review stars joined chronologically,
  // the same round-capped purple line the veil draws with.
  const path = placed.filter((s) => s.kind === 'review').sort((a, b) => a.ms - b.ms);
  return { placed, reviewLine: path.map((s) => `${s.x},${s.y}`).join(' ') };
}

// ---------------------------------------------------------------------------
// DOM layer
// ---------------------------------------------------------------------------

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function starSvg(s) {
  const title = s.kind === 'gold-join'
    ? `<title>The day you joined — ${esc(new Date(s.ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))}</title>`
    : (s.kind === 'review' && s.label)
      ? `<title>${esc(s.label)}${typeof s.rating === 'number' ? ` — your ${esc(s.rating)}/10` : ''}</title>`
      : '';
  const tw = (s.h % 3 === 0) ? ' wr-tw' : '';
  const delay = ` style="animation-delay:-${(s.h % 4200)}ms"`;
  if (s.kind === 'gold-join') {
    // the ONE gold star — a four-point sparkle with a soft halo
    const p = `M ${s.x} ${s.y - 9} L ${s.x + 2.6} ${s.y - 2.6} L ${s.x + 9} ${s.y} L ${s.x + 2.6} ${s.y + 2.6} L ${s.x} ${s.y + 9} L ${s.x - 2.6} ${s.y + 2.6} L ${s.x - 9} ${s.y} L ${s.x - 2.6} ${s.y - 2.6} Z`;
    return `<g class="wr-star wr-gold" data-kind="gold-join">${title}` +
      `<circle cx="${s.x}" cy="${s.y}" r="16" fill="rgba(255,213,74,0.18)"/>` +
      `<path d="${p}" fill="#ffe082"/></g>`;
  }
  if (s.kind === 'review') {
    const r = typeof s.rating === 'number' ? (2.8 + s.rating * 0.38) : 4;
    const op = typeof s.rating === 'number' ? Math.min(1, 0.5 + s.rating * 0.05) : 0.75;
    return `<g class="wr-star" data-kind="review">${title}` +
      `<circle cx="${s.x}" cy="${s.y}" r="${(r * 2.4).toFixed(1)}" fill="rgba(216,180,254,0.14)"/>` +
      `<circle class="wr-core${tw}"${tw ? delay : ''} cx="${s.x}" cy="${s.y}" r="${r.toFixed(1)}" fill="#e3c9ff" opacity="${op.toFixed(2)}"/></g>`;
  }
  if (s.kind === 'thread') {
    const d = 5;
    return `<g class="wr-star" data-kind="thread"><path class="wr-core${tw}"${tw ? delay : ''} d="M ${s.x} ${s.y - d} L ${s.x + d} ${s.y} L ${s.x} ${s.y + d} L ${s.x - d} ${s.y} Z" fill="#d8b4fe" opacity="0.85"/></g>`;
  }
  const spec = {
    comment: { r: 1.7, fill: '#c9a4ff', op: 0.75 },
    post:    { r: 1.5, fill: '#c9a4ff', op: 0.65 },
    reply:   { r: 1.3, fill: '#b388ff', op: 0.6 },
    save:    { r: 1.1, fill: '#b388ff', op: 0.45 }
  }[s.kind] || { r: 1.4, fill: '#b388ff', op: 0.6 };
  return `<g class="wr-star" data-kind="${esc(s.kind)}"><circle class="wr-core${tw}"${tw ? delay : ''} cx="${s.x}" cy="${s.y}" r="${spec.r}" fill="${spec.fill}" opacity="${spec.op}"/></g>`;
}

// ambient dust — deterministic hash-scattered points, seeded per member+year.
// Pure texture: NO data-kind (star counts stay data-pure), always dimmer and
// smaller than the smallest data star (save: r 1.1, op .45). Never animates.
function dustSvg(seed) {
  const out = [];
  for (let i = 0; i < 110; i++) {
    const h = hash32(`dust:${seed}:${i}`);
    const x = hashRange(h, 2, 20, SKY.w - 20).toFixed(1);
    const y = hashRange(h, 5, 20, SKY.h - 60).toFixed(1);
    const r = hashRange(h, 8, 0.5, 1.0).toFixed(2);     // save stars (r 1.1) stay the floor
    const op = hashRange(h, 11, 0.08, 0.22).toFixed(2); // save stars (op .45) stay the floor
    out.push(`<circle class="wr-dust" cx="${x}" cy="${y}" r="${r}" fill="#c9a4ff" opacity="${op}"/>`);
  }
  return `<g aria-hidden="true">${out.join('')}</g>`;
}

function skySvg(model) {
  const { placed, reviewLine } = layoutStars(model);
  const plotW = SKY.w - SKY.padL - SKY.padR;
  const labels = MONTHS.map((m, i) =>
    `<text x="${(SKY.padL + ((i + 0.5) / 12) * plotW).toFixed(0)}" y="${SKY.labelY}" class="wr-month">${m}</text>`).join('');
  const line = reviewLine && reviewLine.indexOf(' ') !== -1
    ? `<polyline points="${reviewLine}" fill="none" stroke="#b388ff" stroke-width="1" stroke-linecap="round" opacity="0.18"/>` : '';
  return `<svg class="wr-sky" viewBox="0 0 ${SKY.w} ${SKY.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(skyAria(model))}">` +
    `${dustSvg(model.seed || 0)}${line}${placed.map(starSvg).join('')}${labels}</svg>`;
}

// C-panel (MED, fixed): the accessible name tells the SAME story the visual
// branch tells — non-zero counts only (a fresh member must never hear the
// zeros-parade the no-chips branch exists to avoid), and the comment count
// matches the visible chip (discussions included).
function skyAria(model) {
  const st = model.stats;
  const parts = [];
  if (st.reviews) parts.push(`${st.reviews} review${st.reviews === 1 ? '' : 's'}`);
  const talk = st.comments + st.discussions + st.replies;
  if (talk) parts.push(`${talk} comment${talk === 1 ? '' : 's'} and repl${talk === 1 ? 'y' : 'ies'}`);
  const tavern = st.threads + st.posts;
  if (tavern) parts.push(`${tavern} Tavern thread${tavern === 1 ? '' : 's'} and post${tavern === 1 ? '' : 's'}`);
  if (st.saves) parts.push(`${st.saves} save${st.saves === 1 ? '' : 's'}`);
  if (model.gold) parts.push('the gold star of the day you joined');
  if (!parts.length) return `Your ${model.year} sky — clear so far, yours to light.`;
  return `Your ${model.year} constellation — ${parts.join(', ')}.`;
}

function statChip(big, small) {
  return `<div class="wr-chip"><div class="wr-chip-big">${big}</div><div class="wr-chip-small">${small}</div></div>`;
}

function statsHtml(model) {
  const st = model.stats;
  const chips = [];
  // C-panel (MED, fixed): a chip renders ONLY when its count is non-zero — a
  // one-comment member must not read "0 reviews written · 0 saves" (the
  // no-zeros discipline holds chip-by-chip, not just on the empty branch).
  if (st.reviews) chips.push(statChip(esc(st.reviews), (st.reviews === 1 ? 'review written' : 'reviews written') +
    (st.avgRating !== null ? ` · averaging ${esc(st.avgRating)}/10` : '')));
  const talk = st.comments + st.discussions + st.replies;
  if (talk) chips.push(statChip(esc(talk), talk === 1 ? 'comment or reply' : 'comments &amp; replies'));
  const tavern = st.threads + st.posts;
  if (tavern) chips.push(statChip(esc(tavern), tavern === 1 ? 'Tavern thread or post' : 'Tavern threads &amp; posts'));
  if (st.saves) chips.push(statChip(esc(st.saves), st.saves === 1 ? 'title saved this year' : 'titles saved this year'));
  if (st.topGenres.length) {
    chips.push(statChip(st.topGenres.map(esc).join(' · '), 'where your shelf leans'));
  }
  if (st.joinMs) {
    chips.push(statChip(esc(new Date(st.joinMs).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })), 'here since'));
  }
  return `<div class="wr-chips">${chips.join('')}</div>`;
}

// ---------------------------------------------------------------------------
// data fetch (one-shot, bounded — a wrapped is a snapshot, not a live feed)
// ---------------------------------------------------------------------------
const toMs = (ts) => (ts && typeof ts.toMillis === 'function') ? ts.toMillis() : 0;
const LIMITS = { items: 200, replies: 100, discussions: 100, threads: 50, posts: 100 };

async function fetchRaw(uid) {
  // the account activity feed's exact query shapes (its indexes already exist):
  // CG items = reviews+comments · CG replies · CG threads = review DISCUSSIONS
  // · flat forum (authorUid) = Tavern threads · CG posts = Tavern replies.
  const [itemsSnap, repliesSnap, discussionsSnap, threadsSnap, postsSnap, watchSnap, favSnap] = await Promise.all([
    getDocs(query(collectionGroup(db, 'items'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(LIMITS.items))),
    getDocs(query(collectionGroup(db, 'replies'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(LIMITS.replies))),
    getDocs(query(collectionGroup(db, 'threads'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(LIMITS.discussions))),
    getDocs(query(collection(db, 'forum'), where('authorUid', '==', uid), orderBy('createdAt', 'desc'), limit(LIMITS.threads))),
    getDocs(query(collectionGroup(db, 'posts'), where('authorUid', '==', uid), orderBy('createdAt', 'desc'), limit(LIMITS.posts))),
    getDocs(collection(db, 'users', uid, 'watchlist')),
    getDocs(collection(db, 'users', uid, 'favorites'))
  ]);
  const rows = (snap, extra) => {
    const out = [];
    snap.forEach((d) => {
      const v = d.data() || {};
      out.push({
        path: d.ref.path,
        createdAtMs: toMs(v.createdAt),
        removed: !!v.removed,
        ...(extra ? extra(d, v) : null)
      });
    });
    return out;
  };
  // C-panel (MED, fixed): dedupe by animeId — a title on BOTH shelves is one
  // saved title, not two (account.js's savedTotal Set-union precedent). Keep
  // the EARLIEST timestamp: the first save is the honest datum. This also
  // stops the genre tally double-weighting dual-shelf titles.
  const savesById = new Map();
  const saveRow = (d) => {
    const v = d.data() || {};
    const ms = toMs(v.savedAt || v.createdAt || v.updatedAt);
    const prev = savesById.get(d.id);
    if (!prev || (ms > 0 && (prev.ms === 0 || ms < prev.ms))) {
      savesById.set(d.id, { animeId: d.id, ms, title: (prev && prev.title) || v.title || d.id });
    }
  };
  watchSnap.forEach(saveRow); favSnap.forEach(saveRow);
  const saves = Array.from(savesById.values());
  return {
    items: rows(itemsSnap, (d, v) => ({ rating: (typeof v.rating === 'number') ? v.rating : null })),
    replies: rows(repliesSnap),
    discussions: rows(discussionsSnap),
    threads: rows(threadsSnap),
    posts: rows(postsSnap),
    saves,
    caps: {
      items: itemsSnap.size >= LIMITS.items,
      replies: repliesSnap.size >= LIMITS.replies,
      discussions: discussionsSnap.size >= LIMITS.discussions,
      threads: threadsSnap.size >= LIMITS.threads,
      posts: postsSnap.size >= LIMITS.posts
    }
  };
}

// catalog genre + title lookups off the classic-script bridge (account.html
// sets window.__ANIME_DATA__ — the lexical-const trap means we read the
// bridge, never the bare global).
function catalogMaps() {
  const arr = (window.__ANIME_DATA__ && Array.isArray(window.__ANIME_DATA__)) ? window.__ANIME_DATA__ : [];
  const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const genres = new Map(), titles = new Map();
  arr.forEach((a) => {
    const id = slug(a && a.Title);
    if (!id) return;
    if (a.Genre) genres.set(id, String(a.Genre));
    titles.set(id, String(a.Title));
  });
  return { genres, titles };
}

// ---------------------------------------------------------------------------
// init (idempotent per uid; 1h localStorage cache per user per year)
// ---------------------------------------------------------------------------
const CACHE_TTL = 60 * 60 * 1000;
const cacheKey = (uid, year) => `rar:wrapped:v1:${uid}:${year}`;

let bootedFor = null;

export function initWrapped(user, helpers) {
  if (!user || bootedFor === user.uid) return;
  bootedFor = user.uid;
  const host = document.getElementById('wrapped-host');
  const statusEl = document.getElementById('wrapped-status');
  if (!host) return;

  const year = new Date().getFullYear();
  const joinMs = (user.metadata && user.metadata.creationTime) ? Date.parse(user.metadata.creationTime) : 0;
  const say = (msg) => { if (statusEl) statusEl.textContent = msg || ''; };

  const render = (model) => {
    const nowYear = new Date().getFullYear();
    const soFar = model.year === nowYear ? ' — so far' : '';
    let html = '';
    if (model.empty && !model.gold) {
      // nothing this year, joined an earlier year — pure invitation, no map
      html = `<div class="wr-empty">` +
        `<p class="wr-empty-line">Nothing's lit this year yet.</p>` +
        `<p class="wr-empty-sub muted">Drop a review, say something in a room, start a thread in the Tavern — your first star lands the moment you do.</p>` +
        (model.skyBegan ? `<p class="wr-began">✦ Your sky began ${esc(new Date(model.skyBegan).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }))}.</p>` : '') +
        `</div>`;
    } else if (model.empty && model.gold) {
      // a fresh member: the join star IS the story — no zero-count chips ever
      // (zeros-as-achievements is a lie the heart doesn't tell).
      html = `<p class="wr-lede">Your ${esc(model.year)}${soFar}, drawn in stars.</p>` +
        skySvg(model) +
        `<p class="wr-legend muted"><span class="wr-legend-gold">The gold star is the day you joined.</span> The rest of this sky is yours to light — a review, a comment, a thread all land here.</p>`;
    } else {
      // Milestone F (Blake B2: "kinda confused on what different things are
      // supposed to be — maybe some kind of quick guide") — a proper key.
      // Swatches are tiny inline SVGs in the sky's own purples; the join-day
      // row explains the gold star in TEXT (no gold ink may live in the
      // stylesheet, and the star itself stays the surface's only gold).
      const key = `<div class="wr-key" role="group" aria-label="Star map key">` +
        `<span class="wr-key-item"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="rgba(216,180,254,0.16)"/><circle cx="8" cy="8" r="3.4" fill="#e3c9ff"/></svg>a review — bigger &amp; brighter, the higher you rated it</span>` +
        `<span class="wr-key-item"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2 12.8 8 8 12.8 3.2 8Z" fill="#d8b4fe"/></svg>a Tavern thread you started</span>` +
        `<span class="wr-key-item"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2" fill="#c9a4ff"/></svg>a comment or reply</span>` +
        `<span class="wr-key-item"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="1.4" fill="#b388ff" opacity="0.7"/></svg>a title you saved</span>` +
        (model.gold ? `<span class="wr-key-item"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="none" stroke="#e3c9ff" stroke-width="1.2"/></svg><span class="wr-legend-gold">the one gold star — the day you joined</span></span>` : '') +
        `</div>`;
      html = `<p class="wr-lede">Your ${esc(model.year)}${soFar}, drawn in stars.</p>` +
        skySvg(model) +
        key +
        (model.skyBegan ? `<p class="wr-began">✦ Your sky began ${esc(new Date(model.skyBegan).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }))}.</p>` : '') +
        statsHtml(model) +
        (model.clipped ? `<p class="wr-clip muted">Showing your newest stars — the busiest skies are drawn from your latest ${LIMITS.items} entries.</p>` : '');
    }
    host.innerHTML = html;
    // twinkle only when the visitor allows motion (the veil-pulse discipline:
    // JS grants the class, CSS carries a reduced-motion backstop anyway).
    const sky = host.querySelector('.wr-sky');
    if (sky && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sky.classList.add('wr-live');
    }
    say('');
  };

  // fresh cache → instant paint, no reads
  try {
    const hit = JSON.parse(localStorage.getItem(cacheKey(user.uid, year)) || 'null');
    if (hit && hit.t && (Date.now() - hit.t) < CACHE_TTL && hit.model) {
      render(hit.model);
      return;
    }
  } catch (_) { /* cold */ }

  say('Charting your sky…');
  fetchRaw(user.uid).then((raw) => {
    const maps = catalogMaps();
    // review stars carry their anime's title for the hover <title>
    raw.items.forEach((it) => {
      const root = it.path.split('/')[0];
      if (root !== 'reviews') return;
      const key = it.path.split('/')[1] || '';
      it.animeTitle = maps.titles.get(key) || (key.indexOf('al:') === 0 ? 'a season beyond the shelf' : key.replace(/-/g, ' '));
    });
    const model = computeWrapped(raw, year, joinMs, maps.genres, user.uid);
    try { localStorage.setItem(cacheKey(user.uid, year), JSON.stringify({ t: Date.now(), model })); } catch (_) { /* full */ }
    render(model);
  }).catch((err) => {
    console.warn('Wrapped fetch failed:', err);
    bootedFor = null;   // let a re-open retry
    const friendly = helpers && typeof helpers.friendlyError === 'function' ? helpers.friendlyError(err) : '';
    say(friendly || 'The stars aren’t answering right now. Give it a beat and open this tab again.');
  });
}

// the durable adversarial check: the pure model, pinnable from Playwright
// (skySvg/statsHtml ride along — string-pure, so specs can pin the render
// vocabulary without a signed-in walk; the lanternModel precedent).
window.wrappedModel = { hash32, hashRange, yearOf, computeWrapped, layoutStars, skySvg, skyAria, statsHtml, SKY, BANDS };
