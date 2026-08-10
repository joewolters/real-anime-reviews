#!/usr/bin/env node
/**
 * CLOUD MIGRATION — PHASE 2: PUBLISH.
 * ============================================================================
 * Regenerates animeData.js FROM the catalog store, so the database — not the
 * spreadsheet — becomes what the site is built from.
 *
 * The site keeps loading a static animeData.js (study §3: static publish, NOT
 * live reads). This is the step that produces it.
 *
 * SAFETY:
 *   - DRY RUN by default; --write to apply.
 *   - THE SHRINK TRIPWIRE runs before every write. If review text materially
 *     shrinks, the publish is REFUSED. This is the alarm that was missing when
 *     four reviews were silently overwritten in May 2026 (Part 0).
 *   - Renders through the SAME renderBody() the Excel sync uses, so both paths
 *     provably emit identical output.
 *   - A timestamped backup of animeData.js is written before any overwrite.
 *
 * SOURCES:
 *   --from=json      (default) the exported catalog-docs.json — offline, no cloud
 *   --from=emulator  the local Firestore emulator (127.0.0.1:8080)
 *   --from=rest      production, over the PUBLIC REST read — no credentials
 *   --from=prod      production via the Admin SDK  [requires --blake-said-go]
 *
 * `rest` exists because the catalog is world-readable by design (it IS the
 * public catalog), so publishing needs no service-account key on disk — which
 * keeps the highest-risk file in this project from ever existing.
 *
 * Usage (from Current Version/):
 *   node scripts/catalog-publish.js --from=json --stamp=2026-08-09
 *   node scripts/catalog-publish.js --from=json --stamp=2026-08-09 --write
 *   node scripts/catalog-publish.js --from=emulator --write
 *
 * Authored: Code, 2026-08-09.  Docs: docs/CLOUD-MIGRATION-STUDY.md
 * ============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CV = path.resolve(__dirname, '..');
const ML = path.resolve(CV, '..', 'Master List');
const ANIMEDATA = path.join(CV, 'animeData.js');
const { parseAnimeData, renderBody, checkShrink } = require('./lib/catalog-model');

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const has = (n) => args.includes(`--${n}`);

const FROM = flag('from', 'json');
const STAMP = flag('stamp', '');
const WRITE = has('write');
const FORCE = has('force');
const GO = has('blake-said-go');

const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[90m', x: '\x1b[0m', b: '\x1b[1m' };

(async () => {
  // ---- load the catalog from the chosen source --------------------------
  let docs;
  if (FROM === 'json') {
    if (!STAMP) { console.error('--from=json needs --stamp=<migration stamp>'); process.exit(3); }
    const p = path.join(ML, `_migration_${STAMP}`, 'catalog-docs.json');
    if (!fs.existsSync(p)) { console.error('not found:', p); process.exit(2); }
    docs = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`SOURCE: ${p}`);
  } else if (FROM === 'rest') {
    // Public REST read of the production catalog — no credentials, no SDK.
    console.log('SOURCE: PRODUCTION (public REST read)');
    const https = require('https');
    const url = 'https://firestore.googleapis.com/v1/projects/real-anime-reviews/databases/(default)/documents/catalog?pageSize=300';
    // Collect BUFFERS and decode once. Concatenating chunks as strings splits
    // multi-byte UTF-8 across chunk boundaries and corrupts it — caught by the
    // byte-equality gate below, which turned バニーガール into バ���ーガール.
    const body = await new Promise((res, rej) => {
      https.get(url, (r) => {
        const chunks = [];
        r.on('data', (d) => chunks.push(d));
        r.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
      }).on('error', rej);
    });
    const parsed = JSON.parse(body);
    if (!parsed.documents || !parsed.documents.length) {
      console.error(`${C.r}ABORT:${C.x} the production catalog is empty.`); process.exit(1);
    }
    if (parsed.nextPageToken) {
      console.error(`${C.r}ABORT:${C.x} the catalog paginated — refusing to publish a partial catalog.`); process.exit(1);
    }
    // Firestore REST wraps every value in a type tag; unwrap to plain JS.
    const unwrap = (v) => {
      if (v == null) return null;
      if ('stringValue' in v) return v.stringValue;
      if ('integerValue' in v) return parseInt(v.integerValue, 10);
      if ('doubleValue' in v) return v.doubleValue;
      if ('booleanValue' in v) return v.booleanValue;
      if ('nullValue' in v) return null;
      if ('timestampValue' in v) return v.timestampValue;
      if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrap);
      if ('mapValue' in v) {
        const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = unwrap(x); return o;
      }
      return null;
    };
    docs = parsed.documents.map((d) => {
      const o = {};
      for (const [k, v] of Object.entries(d.fields || {})) o[k] = unwrap(v);
      return o;
    });
  } else if (FROM === 'emulator' || FROM === 'prod') {
    if (FROM === 'prod' && !GO) {
      console.error(`${C.r}REFUSED:${C.x} --from=prod requires --blake-said-go.`);
      process.exit(1);
    }
    const admin = require(path.join(CV, 'functions', 'node_modules', 'firebase-admin'));
    if (FROM === 'emulator') {
      process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
      console.log(`SOURCE: EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}`);
    } else {
      delete process.env.FIRESTORE_EMULATOR_HOST;
      console.log(`SOURCE: ${C.y}*** PRODUCTION Firestore ***${C.x}`);
    }
    admin.initializeApp({ projectId: FROM === 'prod' ? 'real-anime-reviews' : (process.env.GCLOUD_PROJECT || 'demo-rar') });
    const snap = await admin.firestore().collection('catalog').orderBy('order').get();
    if (snap.empty) { console.error(`${C.r}ABORT:${C.x} the catalog collection is empty — nothing to publish.`); process.exit(1); }
    docs = snap.docs.map((d) => d.data());
  } else {
    console.error('--from must be json | rest | emulator | prod'); process.exit(3);
  }

  docs = [...docs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  console.log(`CATALOG: ${docs.length} entries\n`);

  // ---- THE SHRINK TRIPWIRE ----------------------------------------------
  const liveText = fs.readFileSync(ANIMEDATA, 'utf8');
  const live = parseAnimeData(liveText);
  const guard = checkShrink(live, docs);

  console.log(`${C.b}Shrink tripwire${C.x}`);
  console.log(`  review text: ${guard.totals.liveTotal} → ${guard.totals.nextTotal} chars ` +
    `(${guard.totals.delta >= 0 ? '+' : ''}${guard.totals.delta})`);
  for (const n of guard.notes.slice(0, 6)) console.log(`  ${C.d}· ${n}${C.x}`);
  if (!guard.ok) {
    console.log(`\n${C.r}${C.b}⛔ PUBLISH REFUSED — review text would be lost:${C.x}`);
    for (const v of guard.violations) console.log(`  ${C.r}✗${C.x} ${v}`);
    if (!FORCE) {
      console.log(`\n${C.d}This is the alarm that was missing in May 2026. If the shrink is`);
      console.log(`intentional, re-run with --force (it will be logged loudly).${C.x}`);
      process.exit(1);
    }
    console.log(`\n${C.y}--force given: proceeding despite ${guard.violations.length} violation(s).${C.x}`);
  } else {
    console.log(`  ${C.g}✓ no material shrink${C.x}`);
  }

  // ---- render -----------------------------------------------------------
  const header = [
    '// AUTO-GENERATED by scripts/catalog-publish.js — do not edit by hand.',
    '// Source of truth: the catalog store (Firestore)',
    '// Last publish: ' + new Date().toISOString(),
    '',
  ].join('\n') + '\n';
  const body = renderBody(docs);
  const next = header + body;

  const { body: liveBody } = require('./lib/catalog-model').splitAnimeDataFile(liveText);
  // Compare line-ending-normalised. On Windows, git's autocrlf checks the file
  // out as CRLF while every generator here writes LF, so a raw compare reports
  // a phantom "changed" on a file whose data is identical (~1 byte per line).
  const nl = (s) => s.replace(/\r\n/g, '\n');
  const bodyIdentical = nl(body) === nl(liveBody);
  const crlfOnly = !(body === liveBody) && bodyIdentical;

  console.log(`\n${C.b}Diff${C.x}`);
  console.log(`  entries:   ${live.length} → ${docs.length}`);
  console.log(`  file size: ${Buffer.byteLength(liveText, 'utf8')} → ${Buffer.byteLength(next, 'utf8')} bytes` +
    (crlfOnly ? ` ${C.d}(live copy is CRLF; output is LF — data unaffected)${C.x}` : ''));
  console.log(`  body:      ${bodyIdentical ? `${C.g}identical to what is live${C.x}` : `${C.y}CHANGED${C.x}`}`);

  if (!bodyIdentical) {
    const a = nl(liveBody).split('\n'), b = nl(body).split('\n');
    let shown = 0;
    for (let i = 0; i < Math.max(a.length, b.length) && shown < 3; i++) {
      if (a[i] !== b[i]) {
        console.log(`  ${C.d}line ${i + 1}: live ${JSON.stringify((a[i] || '').slice(0, 90))}${C.x}`);
        console.log(`  ${C.d}         new  ${JSON.stringify((b[i] || '').slice(0, 90))}${C.x}`);
        shown++;
      }
    }
  }

  if (!WRITE) {
    console.log(`\n${C.y}DRY RUN${C.x} — nothing written. Pass --write to publish.`);
    process.exit(0);
  }

  // ---- backup, then write ----------------------------------------------
  const bakDir = path.join(ML, '_publish-backups');
  fs.mkdirSync(bakDir, { recursive: true });
  const bak = path.join(bakDir, `animeData.${new Date().toISOString().replace(/[:.]/g, '-')}.js`);
  fs.writeFileSync(bak, liveText, 'utf8');
  fs.writeFileSync(ANIMEDATA, next, 'utf8');
  console.log(`\n${C.g}PUBLISHED${C.x} → animeData.js (${Buffer.byteLength(next, 'utf8')} bytes)`);
  console.log(`  backup: ${path.relative(CV, bak)}`);
  console.log(`\n${C.b}Next:${C.x} git diff animeData.js · npm test · then deploy ONLY on Blake's go.`);
})().catch((e) => { console.error('PUBLISH FAILED:', e && e.message); process.exit(1); });
