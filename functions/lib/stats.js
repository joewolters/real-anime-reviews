'use strict';

// =============================================================================
// PART A item 6 — MEMBER STATS (the admin-only numbers page).
// <!-- author: Code | date: 2026-08-10 -->
// -----------------------------------------------------------------------------
// Blake: "track member stats included joined this month, active users, comments,
// reviews posted etc etc". This is the recompute behind `adminStats/current`.
//
// WHY A SCHEDULED RECOMPUTE AND NOT CLIENT count() OR TRIGGER COUNTERS:
//   1. Two metrics are IMPOSSIBLE from a client at any price — `users` list is
//      owner-only and `conversations`/`messages` list is participant-only with
//      no collection-group rule. Once a CF is required for two tiles, running
//      every tile here costs nothing extra and keeps ONE code path.
//   2. count() bills per 1000 index entries on EVERY page open. A daily
//      recompute + a 1-doc read means the page costs exactly 1 read per open.
//   3. Trigger-maintained counters drift: the delete surface here is huge
//      (onUserDelete, onBanCascade, the soft-removes) and one missed decrement
//      corrupts a number permanently with no self-heal. There is already proof
//      in this tree — `forum.postCount` increments in onForumPostCreate and
//      NOTHING ever decrements it. A recompute overwrites with ground truth, so
//      that whole drift class cannot exist here.
//
// PRIVACY — counts only, never content. Every read is `.select()`-projected to
// the exact fields the math needs. DM messages are read with a FIELDLESS
// select(), so a message body is never even transferred to this function, let
// alone stored. Nothing written into adminStats/current identifies a member.
//
// Shape follows lib/sweep.js: the judgment is PURE and provable offline; the
// db-injected half is thin, so cf-tests can drive it without the scheduler.
// =============================================================================

const DAY_MS = 86400000;
// The activity window. 30 days is the honest "is this place alive right now"
// question; the page states the definition next to the number so the tile can
// never quietly mean something else than it says.
const ACTIVE_WINDOW_DAYS = 30;

// The authored surfaces, and the field each one carries its author on. Comments
// and reviews BOTH live under an `items` subcollection (that is why onUserDelete
// sweeps them with one collection-group query) — they are told apart by their
// grandparent collection, never by shape.
const SURFACES = [
  { key: 'comments',      group: 'items',   authorField: 'uid',       parent: 'comments' },
  { key: 'reviews',       group: 'items',   authorField: 'uid',       parent: 'reviews' },
  { key: 'forumThreads',  root:  'forum',   authorField: 'authorUid' },
  { key: 'forumPosts',    group: 'posts',   authorField: 'authorUid' },
  { key: 'commentReplies',group: 'replies', authorField: 'uid' },
  { key: 'reviewReplies', group: 'threads', authorField: 'uid' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ---------------------------------------------------------------------------
// PURE
// ---------------------------------------------------------------------------

// toMillis — every timestamp shape this project stores, or null. Firestore
// Timestamps, Dates, raw millis, and the {seconds} wire shape all appear in the
// tree (backfilled joinedAt came through the Admin SDK, client createdAt through
// serverTimestamp()). Anything else is null, and null NEVER counts toward a
// window — an undated doc must not be able to inflate "this month".
function toMillis(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === 'function') { const n = v.toMillis(); return Number.isFinite(n) ? n : null; }
  if (v instanceof Date) { const n = v.getTime(); return Number.isFinite(n) ? n : null; }
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return null;
}

// statsWindow — the two boundaries every count is measured against. UTC on
// purpose: a scheduled job has no user timezone, and a deterministic boundary is
// worth more here than being right to the hour about "this month" (the page
// prints the month name it used, so the number is never ambiguous).
function statsWindow(nowMs) {
  const now = new Date(nowMs);
  const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return {
    nowMs,
    monthStartMs,
    monthLabel: MONTHS[now.getUTCMonth()] + ' ' + now.getUTCFullYear(),
    windowDays: ACTIVE_WINDOW_DAYS,
    recentCutoffMs: nowMs - ACTIVE_WINDOW_DAYS * DAY_MS,
  };
}

// tallyMembers — PURE. profiles carry the join date and the appreciate count.
// A profile with no joinedAt is a real member (the backfill deliberately OMITS
// joinedAt rather than lying about a veteran's join date) — it counts toward the
// total and toward neither window.
function tallyMembers(profiles, w) {
  let total = 0, banned = 0, joinedThisMonth = 0, joinedRecent = 0, appreciates = 0;
  for (const p of profiles) {
    total++;
    if (p && p.isBanned === true) banned++;
    const likes = p && typeof p.likesCount === 'number' && Number.isFinite(p.likesCount) ? p.likesCount : 0;
    appreciates += likes > 0 ? likes : 0;
    const joined = toMillis(p && p.joinedAt);
    if (joined == null) continue;
    if (joined >= w.monthStartMs) joinedThisMonth++;
    if (joined >= w.recentCutoffMs) joinedRecent++;
  }
  return { total, banned, joinedThisMonth, joinedRecent, appreciates };
}

// tallyAuthored — PURE. One surface's records -> its counts + the set of uids
// that wrote inside the window. `removed` is the ban-cascade / self-deletion
// tombstone: the doc still holds its slot in the thread but its content is gone,
// so it counts as a tombstone rather than as live content. authorDeleted is the
// PART A item 7 tombstone and reads the same way.
function tallyAuthored(records, w) {
  let total = 0, live = 0, tombstoned = 0, recent = 0;
  const activeUids = new Set();
  for (const r of records) {
    total++;
    const dead = !!(r && (r.removed === true || r.authorDeleted === true));
    if (dead) tombstoned++; else live++;
    const created = toMillis(r && r.createdAt);
    if (created == null || created < w.recentCutoffMs) continue;
    recent++;
    // A tombstoned doc still proves its author was active — the write happened.
    if (r && typeof r.uid === 'string' && r.uid) activeUids.add(r.uid);
  }
  return { total, live, tombstoned, recent, activeUids };
}

// buildStats — PURE. Assembles the whole stats payload from already-read data,
// so every number on the page is provable in a unit test with no emulator.
//   membersRaw : [{ joinedAt, likesCount, isBanned }]
//   authored   : { <surfaceKey>: [{ uid, createdAt, removed, authorDeleted }] }
//   dms        : { conversations, messages }
function buildStats(membersRaw, authored, dms, nowMs) {
  const w = statsWindow(nowMs);
  const members = tallyMembers(membersRaw || [], w);

  const content = {};
  const recent = {};
  const active = new Set();
  let tombstones = 0;
  for (const s of SURFACES) {
    const t = tallyAuthored((authored && authored[s.key]) || [], w);
    content[s.key] = t.live;
    recent[s.key] = t.recent;
    tombstones += t.tombstoned;
    t.activeUids.forEach((u) => active.add(u));
  }
  content.total = SURFACES.reduce((n, s) => n + content[s.key], 0);
  recent.total = SURFACES.reduce((n, s) => n + recent[s.key], 0);

  return {
    windowDays: w.windowDays,
    monthLabel: w.monthLabel,
    members: {
      total: members.total,
      banned: members.banned,
      joinedThisMonth: members.joinedThisMonth,
      joinedRecent: members.joinedRecent,
      // ACTIVE = wrote at least one comment / review / reply / forum post in the
      // window. Deliberately excludes votes (a vote is not a contribution) and
      // DMs (we never read who sent a letter). The page prints this sentence.
      active: active.size,
    },
    content,
    recent,
    tombstones,
    appreciates: members.appreciates,
    dms: {
      conversations: (dms && dms.conversations) || 0,
      messages: (dms && dms.messages) || 0,
    },
  };
}

// ---------------------------------------------------------------------------
// DB-INJECTED
// ---------------------------------------------------------------------------

// projectDocs — read a query with ONLY the named fields on the wire. Every read
// in this file goes through here so "counts only, never content" is a property
// of the code, not a promise in a comment: to read a body you would have to name
// it, and no caller does.
async function projectDocs(query, fields) {
  const snap = await (fields && fields.length ? query.select(...fields) : query.select()).get();
  return snap;
}

// readAuthored — one surface's records, author + timestamp + tombstone flags
// only. The comments/reviews split is done on the doc PATH: for a doc at
// comments/{anime}/items/{cid}, ref.parent.parent.parent.id is 'comments'.
async function readAuthored(db, surface) {
  const q = surface.root ? db.collection(surface.root) : db.collectionGroup(surface.group);
  const snap = await projectDocs(q, [surface.authorField, 'createdAt', 'removed', 'authorDeleted']);
  const out = [];
  snap.forEach((d) => {
    if (surface.parent) {
      const grandparent = d.ref.parent.parent && d.ref.parent.parent.parent;
      if (!grandparent || grandparent.id !== surface.parent) return;
    }
    const x = d.data() || {};
    out.push({
      uid: x[surface.authorField],
      createdAt: x.createdAt,
      removed: x.removed,
      authorDeleted: x.authorDeleted,
    });
  });
  return out;
}

// computeStats — the whole recompute, ground truth every time. A full pass (not
// incremental) is the entire point: whatever drifted since yesterday is simply
// overwritten. Surfaces are read in parallel; the DM lane reads NO fields at all.
async function computeStats(db, opts) {
  const nowMs = opts && Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();

  const [profilesSnap, convosSnap, messagesSnap, ...authoredLists] = await Promise.all([
    projectDocs(db.collection('profiles'), ['joinedAt', 'likesCount', 'isBanned']),
    projectDocs(db.collection('conversations'), []),
    projectDocs(db.collectionGroup('messages'), []),
    ...SURFACES.map((s) => readAuthored(db, s)),
  ]);

  const membersRaw = [];
  profilesSnap.forEach((d) => membersRaw.push(d.data() || {}));

  const authored = {};
  SURFACES.forEach((s, i) => { authored[s.key] = authoredLists[i]; });

  return buildStats(membersRaw, authored, {
    conversations: convosSnap.size,
    messages: messagesSnap.size,
  }, nowMs);
}

// writeStats — recompute + persist to the ONE admin-read-only doc. `source`
// records whether this run was the daily schedule or Blake's Refresh button, so
// a stale-looking number can always be explained.
async function writeStats(db, FieldValue, opts) {
  const stats = await computeStats(db, opts);
  const payload = Object.assign({}, stats, {
    source: (opts && opts.source) || 'schedule',
    generatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
  });
  await db.doc('adminStats/current').set(payload);
  return stats;
}

module.exports = {
  DAY_MS, ACTIVE_WINDOW_DAYS, SURFACES,
  toMillis, statsWindow, tallyMembers, tallyAuthored, buildStats,
  readAuthored, computeStats, writeStats,
};
