'use strict';
// PART A item 6 — the member-stats window math.
// <!-- author: Code | date: 2026-08-10 -->
// The whole page is these numbers, so the numbers are proved here with no
// emulator: a tile that is quietly wrong is worse than a tile that is missing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../lib/stats');

const AUG_15 = Date.UTC(2026, 7, 15, 12, 0, 0); // 2026-08-15T12:00Z
const DAY = 86400000;

// ---- toMillis: every timestamp shape actually stored in this tree ----
test('toMillis reads every shape the tree stores, and refuses the rest', () => {
  assert.equal(S.toMillis(1700000000000), 1700000000000);
  assert.equal(S.toMillis(new Date(1700000000000)), 1700000000000);
  assert.equal(S.toMillis({ toMillis: () => 1700000000000 }), 1700000000000); // Firestore Timestamp
  assert.equal(S.toMillis({ seconds: 1700000000 }), 1700000000000);           // wire shape
  assert.equal(S.toMillis({ _seconds: 1700000000 }), 1700000000000);
  // An undated / malformed doc must never be able to land inside a window.
  assert.equal(S.toMillis(null), null);
  assert.equal(S.toMillis(undefined), null);
  assert.equal(S.toMillis('yesterday'), null);
  assert.equal(S.toMillis(NaN), null);
  assert.equal(S.toMillis({}), null);
});

// ---- statsWindow ----
test('statsWindow pins the month to UTC and prints the month it used', () => {
  const w = S.statsWindow(AUG_15);
  assert.equal(w.monthStartMs, Date.UTC(2026, 7, 1));
  assert.equal(w.monthLabel, 'August 2026');
  assert.equal(w.windowDays, 30);
  assert.equal(w.recentCutoffMs, AUG_15 - 30 * DAY);
});

test('statsWindow rolls the year at the January boundary', () => {
  const w = S.statsWindow(Date.UTC(2027, 0, 3));
  assert.equal(w.monthStartMs, Date.UTC(2027, 0, 1));
  assert.equal(w.monthLabel, 'January 2027');
  // the 30-day window reaches back into the previous year — it is not a month
  assert.ok(w.recentCutoffMs < Date.UTC(2027, 0, 1));
});

// ---- tallyMembers ----
test('tallyMembers separates this-month from the rolling 30 days', () => {
  const w = S.statsWindow(AUG_15);
  const out = S.tallyMembers([
    { joinedAt: Date.UTC(2026, 7, 14) },  // this month AND last 30d
    { joinedAt: Date.UTC(2026, 7, 1) },   // this month (exactly the boundary)
    { joinedAt: Date.UTC(2026, 6, 25) },  // last 30d but LAST month
    { joinedAt: Date.UTC(2026, 0, 4) },   // veteran
  ], w);
  assert.equal(out.total, 4);
  assert.equal(out.joinedThisMonth, 2);
  assert.equal(out.joinedRecent, 3);
});

test('a member with no joinedAt is still a member, and inflates no window', () => {
  // The backfill deliberately OMITS joinedAt rather than lying about a
  // veteran's join date — that member must not read as "joined today".
  const w = S.statsWindow(AUG_15);
  const out = S.tallyMembers([{}, { joinedAt: null }, { joinedAt: AUG_15 }], w);
  assert.equal(out.total, 3);
  assert.equal(out.joinedThisMonth, 1);
  assert.equal(out.joinedRecent, 1);
});

test('appreciates sum, and a negative or junk likesCount can never subtract', () => {
  const w = S.statsWindow(AUG_15);
  const out = S.tallyMembers([
    { likesCount: 5 }, { likesCount: 3 }, { likesCount: -9 },
    { likesCount: '4' }, { likesCount: NaN }, {},
  ], w);
  assert.equal(out.appreciates, 8);
});

test('banned members are counted as members, and counted as banned', () => {
  const w = S.statsWindow(AUG_15);
  const out = S.tallyMembers([{ isBanned: true }, { isBanned: false }, {}], w);
  assert.equal(out.total, 3);
  assert.equal(out.banned, 1);
});

// ---- tallyAuthored ----
test('tombstoned docs are counted as tombstones, never as live content', () => {
  const w = S.statsWindow(AUG_15);
  const out = S.tallyAuthored([
    { uid: 'a', createdAt: AUG_15 - DAY },
    { uid: 'b', createdAt: AUG_15 - DAY, removed: true },        // ban cascade
    { uid: 'c', createdAt: AUG_15 - DAY, authorDeleted: true },  // item 7 tombstone
  ], w);
  assert.equal(out.total, 3);
  assert.equal(out.live, 1);
  assert.equal(out.tombstoned, 2);
});

test('a tombstoned write still proves its author was active', () => {
  // The words are gone; the fact that they wrote in the window is not a claim
  // about content, and pretending otherwise would understate activity.
  const w = S.statsWindow(AUG_15);
  const out = S.tallyAuthored([{ uid: 'gone', createdAt: AUG_15 - DAY, removed: true }], w);
  assert.deepEqual([...out.activeUids], ['gone']);
});

test('activity is windowed, and an undated doc counts toward nothing recent', () => {
  const w = S.statsWindow(AUG_15);
  const out = S.tallyAuthored([
    { uid: 'fresh', createdAt: AUG_15 - DAY },
    { uid: 'stale', createdAt: AUG_15 - 40 * DAY },
    { uid: 'undated' },
  ], w);
  assert.equal(out.total, 3);
  assert.equal(out.recent, 1);
  assert.deepEqual([...out.activeUids], ['fresh']);
});

// ---- buildStats ----
function authoredFixture() {
  return {
    comments: [
      { uid: 'a', createdAt: AUG_15 - DAY },
      { uid: 'b', createdAt: AUG_15 - 90 * DAY },
      { uid: 'a', createdAt: AUG_15 - 2 * DAY, removed: true },
    ],
    reviews: [{ uid: 'c', createdAt: AUG_15 - 3 * DAY }],
    forumThreads: [{ uid: 'a', createdAt: AUG_15 - 200 * DAY }],
    forumPosts: [{ uid: 'd', createdAt: AUG_15 - 5 * DAY }],
    commentReplies: [],
    reviewReplies: [],
  };
}

test('buildStats counts one member once, however many surfaces they wrote on', () => {
  const s = S.buildStats([{ joinedAt: AUG_15 - DAY }], authoredFixture(), {}, AUG_15);
  // a (comment + tombstoned comment), c (review), d (post) = 3 distinct people
  assert.equal(s.members.active, 3);
});

test('buildStats totals live content and recent content separately', () => {
  const s = S.buildStats([], authoredFixture(), {}, AUG_15);
  assert.equal(s.content.comments, 2);      // one of three is a tombstone
  assert.equal(s.recent.comments, 2);       // the fresh one + the tombstoned one
  assert.equal(s.content.total, 2 + 1 + 1 + 1);
  assert.equal(s.recent.total, 2 + 1 + 0 + 1);
  assert.equal(s.tombstones, 1);
});

test('buildStats carries the DM counts through untouched and adds nothing else', () => {
  const s = S.buildStats([], authoredFixture(), { conversations: 4, messages: 91 }, AUG_15);
  assert.deepEqual(s.dms, { conversations: 4, messages: 91 });
  // the vow: the payload has a dms block of exactly two numbers, and no more
  assert.deepEqual(Object.keys(s.dms).sort(), ['conversations', 'messages']);
});

test('missing DM data reads as 0, never as undefined on the page', () => {
  const s = S.buildStats([], authoredFixture(), null, AUG_15);
  assert.deepEqual(s.dms, { conversations: 0, messages: 0 });
});

test('an empty site produces zeros, not a broken payload', () => {
  const s = S.buildStats([], {}, {}, AUG_15);
  assert.equal(s.members.total, 0);
  assert.equal(s.members.active, 0);
  assert.equal(s.content.total, 0);
  assert.equal(s.recent.total, 0);
  assert.equal(s.appreciates, 0);
  assert.equal(s.monthLabel, 'August 2026');
});

test('every SURFACE key gets a content row and a recent row', () => {
  // Guards the client table: a surface added to SURFACES with no counterpart
  // here would render a blank column instead of a number.
  const s = S.buildStats([], {}, {}, AUG_15);
  for (const surface of S.SURFACES) {
    assert.equal(typeof s.content[surface.key], 'number', surface.key + ' content');
    assert.equal(typeof s.recent[surface.key], 'number', surface.key + ' recent');
  }
});

test('comments and reviews are separate surfaces even though both live under items/', () => {
  const items = S.SURFACES.filter((s) => s.group === 'items');
  assert.deepEqual(items.map((s) => s.parent).sort(), ['comments', 'reviews']);
  // they must be told apart by PATH, never by shape
  assert.ok(items.every((s) => typeof s.parent === 'string'));
});
