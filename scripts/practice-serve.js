'use strict';

// =============================================================================
// PRACTICE MODE — Blake's gate-4 smoke sandbox.
//   Run:  npm run practice
//   (= firebase emulators:exec --only auth,firestore,functions,storage "node scripts/practice-serve.js")
//
// It seeds the LOCAL emulators with fake users + comments/replies, then serves
// the real site on http://127.0.0.1:8765 . Blake opens
//   http://127.0.0.1:8765/?emu=1
// and the site talks to the local emulators (NEVER production). The staged
// v1.9.0 firestore.rules + the gate-2/3 Cloud Functions are live in the emulator,
// so this is the real end-state behavior. Ctrl-C stops everything.
// =============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
// firebase-admin lives in functions/node_modules (the CF workspace) — resolve it
// there so this script needs no root install.
const _adminPath = path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin');
const admin = require(fs.existsSync(_adminPath) ? _adminPath : 'firebase-admin');

const ROOT = path.resolve(__dirname, '..');     // the Current Version dir
const PORT = 8765;
const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const ADMIN_EMAIL = 'blake@practice.test';
const PRAC_PW = 'practice123';

admin.initializeApp({ projectId: 'real-anime-reviews' });
const db = admin.firestore();
const auth = admin.auth();
const TS = admin.firestore.Timestamp;

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function loadAnime() {
  try {
    const code = fs.readFileSync(path.join(ROOT, 'animeData.js'), 'utf8');
    const arr = new Function('window', 'module', 'exports',
      code + '\n;return (typeof animeData !== "undefined") ? animeData : [];')({}, { exports: {} }, {});
    return Array.isArray(arr) ? arr : [];
  } catch (e) { console.warn('could not load animeData.js:', e.message); return []; }
}

async function ensureUser(uid, email, displayName) {
  // gate 12 — emailVerified:true so the practice accounts pass the storage.rules
  // email-verified upload gate (Blake smokes uploads without a real inbox).
  try { await auth.createUser({ uid, email, password: PRAC_PW, displayName, emailVerified: true }); }
  catch (e) { if (e.code !== 'auth/uid-already-exists' && e.code !== 'auth/email-already-exists') throw e; }
  await db.doc('users/' + uid).set({ username: displayName, photoURL: null }, { merge: true });
  await db.doc('profiles/' + uid).set({ uid, displayName, photoURL: null }, { merge: true });
}

async function seed() {
  await ensureUser(ADMIN_UID, ADMIN_EMAIL, 'Blake');
  const fakes = [{ uid: 'prac-mika', name: 'Mika' }, { uid: 'prac-ren', name: 'Ren' }, { uid: 'prac-yuki', name: 'Yuki' },
                 { uid: 'prac-aki', name: 'Aki' }, { uid: 'prac-sora', name: 'Sora' },
                 // v1.10.0 gate 3 — two extra accounts with NO seeded content, for the consent smoke:
                 { uid: 'prac-newbie', name: 'Kana' },   // fresh: no moderationGate doc -> sees the consent modal
                 { uid: 'prac-banned', name: 'Toru' }];  // banned: moderationGate.banned -> sees the suspended state
  for (const f of fakes) await ensureUser(f.uid, f.uid + '@practice.test', f.name);

  // v1.10.0 gate 3 — seed the moderationGate docs the consent gate reads. These are
  // CF-only in prod (acceptRules/setBanState write them); the Admin SDK bypasses the
  // rules here, so we set them directly — same shape setBanState/acceptRules produce.
  //   • content authors = already-consented members (no modal on their writes)
  //   • prac-newbie gets NO doc (a fresh user -> the consent modal fires on first post)
  //   • prac-banned is banned (-> the branded suspended state). Only moderationGate.banned
  //     is set (the field the client reads); the banned/{uid} audit doc is intentionally
  //     NOT written, so the gate-2 onBanCascade trigger stays out of this gate-3 smoke.
  for (const uid of ['prac-mika', 'prac-ren', 'prac-yuki', 'prac-aki', 'prac-sora']) {
    await db.doc('moderationGate/' + uid).set({ consentVersion: 1 }, { merge: true });
  }
  await db.doc('moderationGate/prac-banned').set({ banned: true }, { merge: true });

  const animeData = loadAnime();
  const picks = animeData.slice(0, 2);
  const titles = [];
  for (const a of picks) {
    if (!a || !a.Title) continue;
    const key = slug(a.Title);
    titles.push(a.Title);
    const items = db.collection('comments/' + key + '/items');
    // varying net votes so "Top" sort visibly reorders (Yuki +12, Mika +6, Ren -2)
    const seeds = [
      { uid: 'prac-mika', name: 'Mika', text: 'This one **stuck with me** for days. The back half goes hard.', likes: 7, dislikes: 1 },
      { uid: 'prac-ren', name: 'Ren', text: 'Solid but a *little* overhyped imo. Still worth a watch.', likes: 2, dislikes: 4 },
      { uid: 'prac-yuki', name: 'Yuki', text: 'The soundtrack alone earns the rating. Check [the OP](https://example.com).', likes: 12, dislikes: 0 },
    ];
    for (let i = 0; i < seeds.length; i++) {
      const c = seeds[i];
      const ref = items.doc('seed-' + i);
      await ref.set({
        uid: c.uid, displayName: c.name, photoURL: null, text: c.text,
        createdAt: TS.fromMillis(Date.now() - (i + 1) * 3600000),
        likesCount: c.likes, dislikesCount: c.dislikes, pinned: false,
      });
      if (i === 0) {
        await ref.collection('replies').doc('r0').set({ uid: 'prac-ren', displayName: 'Ren', photoURL: null, text: 'Agreed — episode 18 especially.', createdAt: TS.fromMillis(Date.now() - 1800000), likesCount: 0, dislikesCount: 0 });
        await ref.collection('replies').doc('r1').set({ uid: 'prac-yuki', displayName: 'Yuki', photoURL: null, text: 'Rewatched it twice already.', createdAt: TS.fromMillis(Date.now() - 900000), likesCount: 0, dislikesCount: 0 });
      }
    }

    // community reviews — varied ratings (histogram spread), helpful votes, one
    // long markdown review. Counts set directly (Admin SDK bypasses the CF). Blake
    // (admin) gets NO seeded review, so he can post one during smoke.
    const reviews = [
      { uid: 'prac-yuki', name: 'Yuki', title: 'A near-perfect ride', rating: 9.5, likes: 14, dislikes: 1,
        body: "## What works\nThe **animation** in the back half is unreal — every fight lands.\n\n## What doesn't\nThe pacing dips in the middle, but it earns the payoff.\n\n## Verdict\nWatch it. Then watch it again." },
      { uid: 'prac-mika', name: 'Mika', title: 'Great, with caveats', rating: 8.0, likes: 9, dislikes: 2,
        body: "Genuinely one of my favorites this year. The character work is the standout — I cared about everyone by the end." },
      { uid: 'prac-ren', name: 'Ren', title: 'Solid but overhyped', rating: 7.2, likes: 4, dislikes: 5,
        body: "Good, not great. The hype set my expectations too high. Still worth it if the genre is your thing." },
      { uid: 'prac-aki', name: 'Aki', title: 'Mid for me', rating: 5.5, likes: 2, dislikes: 1,
        body: "A few great moments buried in a lot of filler. I dropped it twice before finishing." },
      { uid: 'prac-sora', name: 'Sora', title: 'Not my thing', rating: 3.0, likes: 1, dislikes: 3,
        body: "I wanted to like it — the premise is great, but the execution lost me by episode 5." },
    ];
    const rcol = db.collection('reviews/' + key + '/items');
    for (let i = 0; i < reviews.length; i++) {
      const r = reviews[i];
      const when = TS.fromMillis(Date.now() - (i + 1) * 7200000);
      await rcol.doc(r.uid).set({
        uid: r.uid, displayName: r.name, photoURL: null,
        title: r.title, rating: r.rating, body: r.body, reviewKey: 'seed-' + r.uid,
        createdAt: when, updatedAt: when, likesCount: r.likes, dislikesCount: r.dislikes,
      });
    }

    // v1.10.0 gate 4 — seed reports so Blake can smoke the admin reports queue +
    // the ban flow. THREE reporters flag the SAME comment (seed-0) => the queue
    // dedupes to ONE row reading "reported ×3"; one report flags Ren's review (×1).
    // Doc ids use the client's deterministic format (reporterUid__targetPath).
    const reportSeeds = [
      { reporter: 'prac-ren',  reason: 'harassment', type: 'comment', path: 'comments/' + key + '/items/seed-0', uid: 'prac-mika', snap: 'This one **stuck with me** for days. The back half goes hard.' },
      { reporter: 'prac-yuki', reason: 'spam',       type: 'comment', path: 'comments/' + key + '/items/seed-0', uid: 'prac-mika', snap: 'This one stuck with me for days.' },
      { reporter: 'prac-aki',  reason: 'offtopic',   type: 'comment', path: 'comments/' + key + '/items/seed-0', uid: 'prac-mika', snap: 'This one stuck with me for days.' },
      { reporter: 'prac-mika', reason: 'other',      type: 'review',  path: 'reviews/' + key + '/items/prac-ren', uid: 'prac-ren',  snap: 'Solid but overhyped' },
    ];
    for (let i = 0; i < reportSeeds.length; i++) {
      const rp = reportSeeds[i];
      const rid = rp.reporter + '__' + rp.path.replace(/\//g, '~');
      await db.doc('reports/' + rid).set({
        reporterUid: rp.reporter, reason: rp.reason, status: 'new',
        targetType: rp.type, targetPath: rp.path, targetUid: rp.uid, targetAnimeId: key,
        snapshotText: rp.snap, createdAt: TS.fromMillis(Date.now() - (i + 1) * 600000),
      });
    }
  }

  // v1.10.0 gates 6-8 — seed forum threads + replies so Blake can smoke the Hub:
  // an anime-tagged (+ pinned) thread drives Blake's verdict rail; varied ages /
  // lastPostAt / postCount make Hot / New / Top visibly reorder; free-tag threads
  // exercise the tag filter. Authors = the seeded prac-* users (Admin SDK bypasses rules).
  const nowMs = Date.now();
  const animeSlug0 = picks[0] ? slug(picks[0].Title) : 'one-punch-man';
  const fthreads = [
    { id: 'th-opm',  author: 'prac-yuki', title: (picks[0] ? picks[0].Title : 'One Punch Man') + ' — does the back half hold up?', body: "Rewatched it and the second cour still lands for me. The fights are unreal. Where does everyone land?", tag: 'anime:' + animeSlug0, ageH: 30, lastH: 1, pinned: true, animeTitle: (picks[0] ? picks[0].Title : 'One Punch Man'), cover: (picks[0] && picks[0].image ? 'assets/' + picks[0].image : '') },
    { id: 'th-recs', author: 'prac-mika', title: 'Cozy slice-of-life recs for a rainy week?', body: "Looking for something gentle — comfort shows only. Hit me.", tag: 'recommend', postCount: 6, ageH: 50, lastH: 3 },
    { id: 'th-hot',  author: 'prac-ren',  title: 'Hot take: the subs-vs-dubs debate is dead', body: "Watch it however you enjoy it. That's the whole post.", tag: 'general', postCount: 9, ageH: 12, lastH: 0.5 },
    { id: 'th-new',  author: 'prac-aki',  title: 'Just finished my first seasonal binge — what now?', body: "New to following things weekly. How do you keep up without burning out?", tag: 'general', postCount: 1, ageH: 2, lastH: 2 },
    { id: 'th-off',  author: 'prac-sora', title: 'Best snacks for a marathon? (off-topic, sorry)', body: "Mine is popcorn + an unreasonable amount of tea.", tag: 'offtopic', postCount: 2, ageH: 70, lastH: 20 },
  ];
  for (const t of fthreads) {
    const tdoc = {
      authorUid: t.author, title: t.title, body: t.body, tag: t.tag,
      createdAt: TS.fromMillis(nowMs - t.ageH * 3600000),
      lastPostAt: TS.fromMillis(nowMs - t.lastH * 3600000),
      postCount: 0, reportCount: 0, hotScore: 0,   // gate 9 CFs compute postCount + hotScore from the seeded posts
      pinned: !!t.pinned, locked: false, removed: false,
    };
    if (t.cover) tdoc.coverImage = t.cover;        // gate 8d — attached-anime cover
    if (t.animeTitle) tdoc.animeTitle = t.animeTitle;
    await db.doc('forum/' + t.id).set(tdoc);
  }
  // gate 8b "The Tavern": a reply-to-reply CHAIN on the pinned thread (p1 -> p2 -> p3)
  // so Blake's smoke shows real nesting + the 2-level indent clamp + the OP tag.
  const freplies = [
    { tid: 'th-opm',  id: 'p0', author: 'prac-mika', body: 'The animation spike in the big fight still goes hard.', likes: 3, ageH: 3 },
    { tid: 'th-opm',  id: 'p1', author: 'prac-ren',  body: 'Disagree a little — the filler dragged for me.', likes: 1, ageH: 2 },
    { tid: 'th-opm',  id: 'p2', author: 'prac-aki',  body: "Fair, but the back half earns it — Blake's verdict feels right honestly.", likes: 5, ageH: 1, parent: 'p1' },
    { tid: 'th-opm',  id: 'p3', author: 'prac-yuki', body: 'Agreed with that — the payoff is worth the slower middle.', likes: 0, ageH: 0.5, parent: 'p2' },
    { tid: 'th-recs', id: 'p0', author: 'prac-yuki', body: 'The one about the angel next door is pure comfort.', likes: 2, ageH: 4 },
    // th-hot gets recent activity so the gate-9 hotScore lifts it up the Rising rail
    { tid: 'th-hot',  id: 'p0', author: 'prac-mika', body: 'Hard agree. Gatekeeping how people watch is exhausting.', likes: 4, ageH: 6 },
    { tid: 'th-hot',  id: 'p1', author: 'prac-aki',  body: 'Dubs have come a long way too, honestly.', likes: 2, ageH: 5 },
    { tid: 'th-hot',  id: 'p2', author: 'prac-sora', body: 'Subs for me but I get it.', likes: 1, ageH: 3 },
  ];
  for (const r of freplies) {
    const pdoc = {
      authorUid: r.author, body: r.body, createdAt: TS.fromMillis(nowMs - r.ageH * 3600000),
      likesCount: r.likes, reportCount: 0, removed: false,
    };
    if (r.parent) pdoc.parentId = r.parent;   // write-once at create (edit/delete rules never touch it)
    await db.doc('forum/' + r.tid + '/posts/' + r.id).set(pdoc);
  }
  // gate 9 — seed a few post VOTE docs so onForumPostVote populates the thread aggregate
  // (likes/dislikes) that hotScore + the Rising rail read (a post's own likesCount doesn't feed it).
  const fvotes = [
    { tid: 'th-opm', pid: 'p0', voter: 'prac-ren',  value: 1 },
    { tid: 'th-opm', pid: 'p2', voter: 'prac-yuki', value: 1 },
    { tid: 'th-hot', pid: 'p0', voter: 'prac-mika', value: 1 },
    { tid: 'th-hot', pid: 'p1', voter: 'prac-aki',  value: 1 },
  ];
  for (const v of fvotes) {
    await db.doc('forum/' + v.tid + '/posts/' + v.pid + '/votes/' + v.voter).set({ uid: v.voter, value: v.value, updatedAt: TS.fromMillis(nowMs - 3600000) });
  }

  // gates 12-14 + the image overhaul — seed images so Blake smokes render /
  // INLINE placement / the card thumbnail / report / atomic-remove without
  // uploading first. cfProcessed metadata keeps the pipeline CF from
  // re-encoding seeds. Bucket name MUST be the pinned UPLOADS_BUCKET
  // (functions/index.js) — the trigger listens there.
  try {
    const bucket = admin.storage().bucket('real-anime-reviews.firebasestorage.app');
    // a real 1×1 purple PNG (valid magic bytes, so a manual re-process also passes)
    const seedPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADgQF/e5IkGQAAAABJRU5ErkJggg==', 'base64');
    // (1) an INLINE image on the th-opm reply — the [img:1] token sits mid-prose
    const imgPath = 'uploads/prac-mika/p0/seed-img1';
    await bucket.file(imgPath).save(seedPng, {
      resumable: false, metadata: { contentType: 'image/png', metadata: { cfProcessed: 'true' } },
    });
    await db.doc('forum/th-opm/posts/p0').set({
      body: 'The animation spike in the big fight still goes hard — exhibit A: [img:1] — frame-perfect.',
      imageRefs: [imgPath],
    }, { merge: true });
    // (2) a user-chosen THUMBNAIL on the text-only th-new thread (its author's prefix)
    const thumbPath = 'uploads/prac-aki/th-new/seed-thumb1';
    await bucket.file(thumbPath).save(seedPng, {
      resumable: false, metadata: { contentType: 'image/png', metadata: { cfProcessed: 'true' } },
    });
    await db.doc('forum/th-new').set({ imageRefs: [thumbPath], thumbImage: thumbPath }, { merge: true });
    console.log('✓ Seeded practice images: inline on th-opm/p0 + a card thumbnail on th-new.');
  } catch (e) { console.warn('storage seed skipped:', e.message); }

  // seed a full notification inbox for MIKA so Blake can smoke the Lantern (every
  // type + a Blake-origin GOLD ping that sorts first + votes that roll up + a muted
  // type). Written via Admin SDK (bypasses the CF-only create rule).
  const now = Date.now();
  const notifs = [
    { type: 'blake_message', fromUid: ADMIN_UID, fromDisplayName: 'Blake', verb: 'sent you a message', targetPath: 'conversations/seed', createdAt: now - 60000 },
    { type: 'reply', fromUid: 'prac-ren', fromDisplayName: 'Ren', verb: 'replied to your comment', animeId: 'one-punch-man', targetPath: 'comments/one-punch-man/items/seed-0', createdAt: now - 300000 },
    { type: 'dm', fromUid: 'prac-yuki', fromDisplayName: 'Yuki', verb: 'sent you a message', targetPath: 'conversations/seed2', createdAt: now - 1800000 },
    { type: 'suggestion_accepted', fromUid: ADMIN_UID, fromDisplayName: 'Blake', verb: 'reviewed an anime you suggested', animeId: 'one-punch-man', createdAt: now - 7200000 },
    { type: 'new_season', fromUid: ADMIN_UID, fromDisplayName: 'Blake', verb: 'a new season dropped', animeId: 'one-punch-man', createdAt: now - 10800000 },
    // gate 6g: vote notifications MUST carry the same targetPath the real CF writes
    // (parentRef.path) so the who-liked drill-down rows deep-link to the exact
    // comment/review. Mika's comment = seed-0; Mika's review doc id = her uid.
    { type: 'comment_vote', fromUid: 'prac-aki', fromDisplayName: 'Aki', value: 1, verb: 'liked your comment', animeId: 'one-punch-man', targetPath: 'comments/one-punch-man/items/seed-0', createdAt: now - 900000 },
    { type: 'comment_vote', fromUid: 'prac-sora', fromDisplayName: 'Sora', value: 1, verb: 'liked your comment', animeId: 'one-punch-man', targetPath: 'comments/one-punch-man/items/seed-0', createdAt: now - 1000000 },
    { type: 'review_vote', fromUid: 'prac-ren', fromDisplayName: 'Ren', value: 1, verb: 'found your review helpful', animeId: 'one-punch-man', targetPath: 'reviews/one-punch-man/items/prac-mika', createdAt: now - 1100000 },
  ];
  const NCOL = db.collection('users/prac-mika/notifications');
  for (let i = 0; i < notifs.length; i++) {
    const n = notifs[i];
    await NCOL.doc('seed-n' + i).set({ toUid: 'prac-mika', read: false, ...n, createdAt: TS.fromMillis(n.createdAt) });
  }
  // a muted type so the mute toggle visibly reads ON (live silence = mute it, then
  // have a fake user trigger that type — the CF won't write a notification).
  await db.doc('users/prac-mika/notifPrefs/prefs').set({ muted: { new_season: true } }, { merge: true });

  return titles;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

function serve() {
  http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';
    const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^([/\\])+/, ''));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found: ' + urlPath); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  }).listen(PORT, '127.0.0.1', () => {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  PRACTICE MODE READY  (local emulators — NOT production)');
    console.log('  Open:   http://127.0.0.1:' + PORT + '/?emu=1');
    console.log('  Admin (Blake):    ' + ADMIN_EMAIL + '   /   ' + PRAC_PW);
    console.log('  Consented user:   prac-mika@practice.test    /   ' + PRAC_PW + '   (no modal — already agreed)');
    console.log('  Fresh user:       prac-newbie@practice.test  /   ' + PRAC_PW + '   (sees the consent modal on first post)');
    console.log('  Banned user:      prac-banned@practice.test  /   ' + PRAC_PW + '   (sees the suspended state)');
    console.log('  Reports queue:    sign in as Blake -> admin pill -> Reports  (or /admin/reports.html) — a comment reported ×3 + a review ×1');
    console.log('  Stop: Ctrl-C');
    console.log('══════════════════════════════════════════════════════════════\n');
  });
}

(async () => {
  try {
    const titles = await seed();
    console.log('✓ Seeded practice data. Open this anime to see comments: ' + (titles[0] || '(none)'));
    if (titles[1]) console.log('  (also seeded: ' + titles[1] + ')');
  } catch (e) { console.error('seed failed:', e); }
  serve();
})();
