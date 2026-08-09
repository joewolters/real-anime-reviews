#!/usr/bin/env node
/**
 * CLOUD MIGRATION — PHASE 1c: import the catalog documents into Firestore.
 * ============================================================================
 * SAFETY POSTURE (deliberate, and load-bearing):
 *   - DRY RUN by default. Writes nothing unless --write is passed.
 *   - EMULATOR by default. Production requires BOTH --prod and --blake-said-go.
 *   - ADDITIVE ONLY. Creates catalog/{animeId} docs. Never deletes, never
 *     touches any other collection, never touches Excel or animeData.js.
 *   - REFUSES TO RUN unless catalog-verify.js has passed for this stamp.
 *   - Reads back every doc afterwards and re-proves byte-equality.
 *
 * Rollback: the whole phase is undone by deleting the catalog collection.
 * Nothing else in the system points at it yet.
 *
 * Usage (from Current Version/):
 *   node scripts/catalog-import.js <stamp>                      # dry run, emulator
 *   node scripts/catalog-import.js <stamp> --write              # write to EMULATOR
 *   node scripts/catalog-import.js <stamp> --write --prod --blake-said-go
 *
 * Authored: Code, 2026-08-09.  Docs: docs/CLOUD-MIGRATION-STUDY.md
 * ============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const CV = path.resolve(__dirname, '..');
const ML = path.resolve(CV, '..', 'Master List');
const admin = require(path.join(CV, 'functions', 'node_modules', 'firebase-admin'));

const args = process.argv.slice(2);
const stamp = args.find((a) => !a.startsWith('--'));
const WRITE = args.includes('--write');
const PROD = args.includes('--prod');
const GO = args.includes('--blake-said-go');

if (!stamp) { console.error('usage: node scripts/catalog-import.js <stamp> [--write] [--prod --blake-said-go]'); process.exit(3); }
const DIR = path.join(ML, `_migration_${stamp}`);
const DOCS = path.join(DIR, 'catalog-docs.json');
if (!fs.existsSync(DOCS)) { console.error('no catalog-docs.json — run catalog-export.js first'); process.exit(2); }

// ---- Refuse to run unless the proof passed ------------------------------
console.log('Re-running the verification gate before touching anything...');
try {
  cp.execFileSync(process.execPath, [path.join(__dirname, 'catalog-verify.js'), stamp], { cwd: CV, stdio: 'inherit' });
} catch (e) {
  console.error('\n\x1b[31mABORT:\x1b[0m catalog-verify.js did not pass. Nothing was written.');
  process.exit(1);
}

// ---- Target selection ----------------------------------------------------
if (PROD && !GO) {
  console.error('\n\x1b[31mREFUSED:\x1b[0m --prod requires --blake-said-go. Production is gated on Blake\'s explicit word.');
  process.exit(1);
}
if (!PROD) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  console.log(`\nTARGET: EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}`);
} else {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  console.log('\n\x1b[33mTARGET: *** PRODUCTION *** (real-anime-reviews)\x1b[0m');
}
console.log(WRITE ? 'MODE:   WRITE' : 'MODE:   DRY RUN (nothing will be written)');

const docs = JSON.parse(fs.readFileSync(DOCS, 'utf8'));
console.log(`DOCS:   ${docs.length} catalog documents\n`);

if (!WRITE) {
  console.log('Dry run — would create:');
  for (const d of docs.slice(0, 3)) console.log(`  catalog/${d.animeId}  (order ${d.order}, ${String(d.Review || '').length} review chars)`);
  console.log(`  … and ${docs.length - 3} more`);
  console.log('\nPass --write to apply.');
  process.exit(0);
}

(async () => {
  admin.initializeApp({ projectId: PROD ? 'real-anime-reviews' : (process.env.GCLOUD_PROJECT || 'demo-rar') });
  const db = admin.firestore();

  // ADDITIVE GUARD: refuse if the collection already has documents, so a
  // re-run can never half-overwrite an edited catalog.
  const existing = await db.collection('catalog').limit(1).get();
  if (!existing.empty) {
    console.error('\x1b[31mABORT:\x1b[0m catalog/ is not empty. Phase 1 is a first-time import only.');
    console.error('       Delete the collection first if you intend to re-seed.');
    process.exit(1);
  }

  let n = 0;
  let batch = db.batch();
  for (const d of docs) {
    const ref = db.collection('catalog').doc(d.animeId);
    const payload = { ...d, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    batch.set(ref, payload);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`Wrote ${n} documents to catalog/.`);

  // ---- Read back and re-prove ------------------------------------------
  const snap = await db.collection('catalog').orderBy('order').get();
  console.log(`Read back ${snap.size} documents.`);
  const back = snap.docs.map((s) => s.data());

  let bad = 0;
  for (let i = 0; i < docs.length; i++) {
    const a = docs[i], b = back[i];
    if (!b) { console.error(`  MISSING at order ${i}: ${a.animeId}`); bad++; continue; }
    for (const k of Object.keys(a)) {
      if (k === 'updatedAt') continue;
      const av = JSON.stringify(a[k]), bv = JSON.stringify(b[k]);
      if (av !== bv) { console.error(`  DRIFT ${a.animeId}.${k}: ${av} != ${bv}`); bad++; }
    }
  }
  if (bad) {
    console.error(`\n\x1b[31m❌ ${bad} field(s) drifted on read-back.\x1b[0m Roll back: delete the catalog collection.`);
    process.exit(1);
  }
  console.log('\n\x1b[32m✅ Read-back verified — every field of every document matches the source exactly.\x1b[0m');
  process.exit(0);
})().catch((e) => { console.error('IMPORT FAILED:', e && e.message); process.exit(1); });
