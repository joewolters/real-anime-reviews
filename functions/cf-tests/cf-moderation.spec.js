'use strict';

// =============================================================================
// v1.10.0 GATE 2 — moderation spine CF integration tests (functions+firestore emu).
// Drives the cores in functions/lib/moderation.js against the emulator (the same
// logic the acceptRules/setBanState callables wrap), and uses @firebase/rules-unit-
// testing (CLIENT contexts, rules-enforced — the SAME firestore emulator on 8080)
// for the load-bearing cross-track proof: a fresh user is DENIED by the gate-1
// rules, acceptRules mints the moderationGate doc, and the user is then ALLOWED.
// Run via npm run test:cf. (Each spec file runs in its own process — admin init is
// guarded so it doesn't collide with the other cf-test files.)
// =============================================================================

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { readFileSync } = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
const moderation = require('../lib/moderation');

const PROJECT = 'demo-rar';
const ADMIN = moderation.ADMIN_UID;
const VERSION = moderation.CURRENT_RULES_VERSION;
const FV = admin.firestore.FieldValue;
const TS = admin.firestore.Timestamp;

let db, env;
before(async () => {
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
  db = admin.firestore();
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { if (env) await env.cleanup(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, { timeout = 20000, interval = 400 } = {}) {
  const start = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - start > timeout) return null; await sleep(interval); }
}
async function clearDb() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}
beforeEach(clearDb);

const asClient = (uid) => env.authenticatedContext(uid).firestore();
const newComment = (uid) => ({ uid, text: 'hello', displayName: 'U', createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0 });

// 1) THE LOAD-BEARING PROOF: fresh user DENIED -> acceptRules mints the gate doc -> ALLOWED.
test('acceptRules: a fresh user is denied, then ALLOWED after the CF mints the gate doc', async () => {
  // 'newuser' has no moderationGate doc -> gate-1 rules DENY a community write.
  await assertFails(setDoc(doc(asClient('newuser'), 'comments/x/items/c1'), newComment('newuser')));
  // acceptRules (the CF core) writes moderationGate + rulesConsent SERVER-SIDE.
  const res = await moderation.applyAcceptRules(db, FV, 'newuser', VERSION);
  assert.equal(res.ok, true);
  assert.equal((await db.doc('moderationGate/newuser').get()).data().consentVersion, VERSION, 'consentVersion minted');
  assert.equal((await db.doc('rulesConsent/newuser').get()).data().version, VERSION, 'consent record written');
  // the SAME write the rules denied before is now ALLOWED.
  await assertSucceeds(setDoc(doc(asClient('newuser'), 'comments/x/items/c1'), newComment('newuser')));
});

// 2) acceptRules validation — no backdating / future-pinning the version; auth required.
test('acceptRules rejects a version != CURRENT_RULES_VERSION (mints nothing)', async () => {
  await assert.rejects(() => moderation.applyAcceptRules(db, FV, 'u', 999), /version/i);
  assert.equal((await db.doc('moderationGate/u').get()).exists, false);
});
test('acceptRules rejects an unauthenticated caller', async () => {
  await assert.rejects(() => moderation.applyAcceptRules(db, FV, null, VERSION), /sign in/i);
});

// 3) setBanState authorization — non-admin caller rejected; admin can't be banned.
test('setBanState rejects a NON-admin caller (writes nothing)', async () => {
  await assert.rejects(() => moderation.applySetBanState(db, FV, null, 'not-admin', 'victim', true, null), /admin/i);
  assert.equal((await db.doc('moderationGate/victim').get()).exists, false);
  assert.equal((await db.doc('banned/victim').get()).exists, false);
});
test('setBanState refuses to ban the admin account', async () => {
  await assert.rejects(() => moderation.applySetBanState(db, FV, null, ADMIN, ADMIN, true, null), /admin account/i);
});

// 4) setBanState(ban) -> the user is denied on a write path (cross-check the gate-1 rules).
test('setBanState bans -> the banned user is then DENIED a community write', async () => {
  // give 'bad' a consented gate first, so the ONLY reason the post-ban write fails is the ban.
  await moderation.applyAcceptRules(db, FV, 'bad', VERSION);
  await assertSucceeds(setDoc(doc(asClient('bad'), 'comments/x/items/pre'), newComment('bad')));
  const res = await moderation.applySetBanState(db, FV, null, ADMIN, 'bad', true, 'spam');
  assert.equal(res.banned, true);
  assert.equal((await db.doc('moderationGate/bad').get()).data().banned, true);
  assert.equal((await db.doc('banned/bad').get()).exists, true);
  await assertFails(setDoc(doc(asClient('bad'), 'comments/x/items/post'), newComment('bad')));
});

// 5) unban reverses the ban docs (content stays redacted — ban is a content-loss event).
test('setBanState unban deletes banned/{uid} + clears moderationGate.banned', async () => {
  await moderation.applySetBanState(db, FV, null, ADMIN, 'temp', true, null);
  await waitFor(async () => { const d = await db.doc('banned/temp').get(); return d.exists && d.data().cascadeCursor === 'done' ? true : null; });
  await moderation.applySetBanState(db, FV, null, ADMIN, 'temp', false, null);
  assert.equal((await db.doc('banned/temp').get()).exists, false);
  assert.equal((await db.doc('moderationGate/temp').get()).data().banned, false);
});

// 6) onBanCascade (trigger) -> H5-redacts all authored content + locks the user's DMs.
test('onBanCascade redacts authored content (removed:true + emptied) and locks conversations', async () => {
  const U = 'prolific';
  await db.doc('comments/a/items/cU').set({ uid: U, text: 'my comment', displayName: 'P', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('reviews/b/items/' + U).set({ uid: U, title: 'My review', body: 'body text', rating: 8, displayName: 'P', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('forum/tU').set({ authorUid: U, title: 'My thread', body: 'thread body', tag: 'general', postCount: 0, reportCount: 0, pinned: false, locked: false, removed: false, createdAt: TS.now(), lastPostAt: TS.now() });
  await db.doc('comments/a/items/cParent/replies/rU').set({ uid: U, text: 'my reply', displayName: 'P', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('conversations/cv').set({ participants: [U, ADMIN], kind: 'admin', state: 'open', createdAt: TS.now() });

  // trigger: write the ban audit doc exactly as setBanState would -> onBanCascade fires.
  await db.doc('banned/' + U).set({ by: ADMIN, at: TS.now(), reason: 'abuse', cascadeCursor: 'pending' });

  const done = await waitFor(async () => {
    const c = await db.doc('comments/a/items/cU').get();
    const r = await db.doc('reviews/b/items/' + U).get();
    const t = await db.doc('forum/tU').get();
    const rp = await db.doc('comments/a/items/cParent/replies/rU').get();
    const cv = await db.doc('conversations/cv').get();
    const b = await db.doc('banned/' + U).get();
    const ok = c.data().removed === true && c.data().text === ''
      && r.data().removed === true && r.data().title === '' && r.data().body === ''
      && t.data().removed === true && t.data().title === '' && t.data().body === ''
      && rp.data().removed === true && rp.data().text === ''
      && cv.data().state === 'locked'
      && b.data().cascadeCursor === 'done';
    return ok ? true : null;
  });
  assert.ok(done, 'all authored content redacted, the DM locked, cascadeCursor done');
});

// 7) setBanState mirrors the PUBLIC ban signal onto profiles/{uid}.isBanned —
//    gate-16 profile tombstones read it (moderationGate is owner/admin-read-only;
//    profiles is world-readable). Mirrors BOTH ways: ban -> true, unban -> false.
test('setBanState mirrors profiles/{uid}.isBanned (ban -> true, unban -> false)', async () => {
  await db.doc('profiles/mirrored').set({ displayName: 'Mirrored', photoURL: null });
  await moderation.applySetBanState(db, FV, null, ADMIN, 'mirrored', true, null);
  assert.equal((await db.doc('profiles/mirrored').get()).data().isBanned, true, 'ban mirrors isBanned:true onto the public profile');
  assert.equal((await db.doc('profiles/mirrored').get()).data().displayName, 'Mirrored', 'merge write — the rest of the profile survives');
  // let the cascade settle before unbanning (same discipline as the unban test above).
  await waitFor(async () => { const d = await db.doc('banned/mirrored').get(); return d.exists && d.data().cascadeCursor === 'done' ? true : null; });
  await moderation.applySetBanState(db, FV, null, ADMIN, 'mirrored', false, null);
  assert.equal((await db.doc('profiles/mirrored').get()).data().isBanned, false, 'unban mirrors isBanned:false (both ways)');
});

// 8) onBanCascade is idempotent — re-running over already-redacted content is a safe no-op.
test('onBanCascade is idempotent (a re-run does not error and leaves content redacted)', async () => {
  const U = 'idem';
  await db.doc('comments/a/items/cI').set({ uid: U, text: 'x', displayName: 'I', likesCount: 0, dislikesCount: 0, createdAt: TS.now() });
  await db.doc('banned/' + U).set({ by: ADMIN, at: TS.now(), cascadeCursor: 'pending' });
  await waitFor(async () => { const d = await db.doc('banned/' + U).get(); return d.data().cascadeCursor === 'done' ? true : null; });
  await moderation.runBanCascade(db, FV, U); // run again directly
  const c = await db.doc('comments/a/items/cI').get();
  assert.equal(c.data().removed, true);
  assert.equal(c.data().text, '');
});
