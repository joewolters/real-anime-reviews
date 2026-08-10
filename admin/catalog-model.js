// admin/catalog-model.js — Cloud Admin editor logic (cloud migration phase 3).
// <!-- author: Code | date: 2026-08-09 -->
// ---------------------------------------------------------------------------
// PURE logic, no DOM and no Firestore, so it is node-requirable and unit
// tested (same shape as admin/reports-model.js). The page is thin glue.
//
// What lives here:
//   - EDITABLE            which catalog fields the editor may write
//   - normalizeTags/Platforms/Trailer   mirror scripts/sync-excel-to-js.js so
//                         what Blake types is exactly what would ship
//   - validate            the sync's own rules, applied BEFORE a save
//   - diffFields/isDirty  what actually changed
//   - draftState          the phone <-> desktop hand-off decision
//
// Exported as CommonJS (tests) AND window.RarCatalogModel (the page).
// ---------------------------------------------------------------------------
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RarCatalogModel = api;
}(typeof self !== 'undefined' ? self : null, function () {
  'use strict';

  // Fields the Cloud Admin editor may write. Deliberately excludes identity
  // (animeId/slug/order — immutable, and slug is the live comment-room key),
  // the AniList-derived facts, and `image` (rule #9: images are Blake-initiated
  // through Mode 1, never edited incidentally here).
  const EDITABLE = [
    'Title', 'Genre', 'Rating', 'Seasons', 'Description', 'Review',
    'Tags', 'Studio', 'Platforms', 'Trailer', 'Top10Rank',
  ];
  const ARRAY_FIELDS = ['Tags', 'Platforms'];

  // --- normalisers: identical rules to the Excel sync ----------------------
  function normalizeTags(raw) {
    if (Array.isArray(raw)) raw = raw.join(', ');
    if (!raw) return [];
    return String(raw)
      .split(/[#,]/)
      .map((s) => s.trim().replace(/[,;、.]+$/g, ''))
      .filter(Boolean)
      .map((s) => s.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, ''));
  }

  function normalizePlatforms(raw) {
    if (Array.isArray(raw)) raw = raw.join(', ');
    if (!raw) return [];
    return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  }

  function normalizeTrailer(raw) {
    if (!raw) return '';
    const url = String(raw).trim();
    let m = url.match(/youtube\.com\/embed\/([\w-]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/youtu\.be\/([\w-]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/youtube\.com\/watch\?v=([\w-]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    return url;
  }

  /** Coerce a raw form object into the shape the catalog stores. */
  function normalizeFields(fields) {
    const out = Object.assign({}, fields);
    if ('Tags' in out) out.Tags = normalizeTags(out.Tags);
    if ('Platforms' in out) out.Platforms = normalizePlatforms(out.Platforms);
    if ('Trailer' in out) out.Trailer = normalizeTrailer(out.Trailer);
    if ('Top10Rank' in out) {
      const v = out.Top10Rank;
      if (v === '' || v == null) delete out.Top10Rank;
      else {
        const n = parseInt(v, 10);
        out.Top10Rank = (!isNaN(n) && n >= 1 && n <= 10) ? n : v;
      }
    }
    for (const k of ['Title', 'Genre', 'Rating', 'Seasons', 'Description', 'Review', 'Studio']) {
      if (k in out && typeof out[k] === 'string') out[k] = out[k].trim();
    }
    return out;
  }

  /**
   * The sync's own validation, run BEFORE anything is stored — so the editor
   * can never put a row into the catalog that would later fail `npm run sync`
   * or ship broken. Returns [] when clean.
   */
  function validate(fields) {
    const f = normalizeFields(fields);
    const errs = [];
    if (!f.Title) errs.push('Title can’t be empty.');
    // NB /^\d+(\.\d+)?\/10$/ intentionally allows Attack on Titan's "15/10" —
    // that is Blake's deliberate hyperbole and is spec-pinned. Don't "fix" it.
    if (!f.Rating || !/^\d+(\.\d+)?\/10$/.test(f.Rating)) errs.push('Rating must look like 9/10 or 9.5/10.');
    if (!f.Genre) errs.push('Genre can’t be empty.');
    if (!f.Description) errs.push('Description can’t be empty.');
    if (!f.Review) errs.push('Review can’t be empty.');
    if (!f.Tags || !f.Tags.length) errs.push('Add at least one tag.');
    if (!f.Platforms || !f.Platforms.length) errs.push('Add at least one place to watch.');
    if (!f.Trailer || !/^https:\/\/www\.youtube\.com\/embed\/[\w-]+$/.test(f.Trailer)) {
      errs.push('Trailer must be a YouTube link.');
    }
    if ('Top10Rank' in f && f.Top10Rank !== undefined) {
      const n = f.Top10Rank;
      if (!(Number.isInteger(n) && n >= 1 && n <= 10)) errs.push('Top 10 rank must be a whole number from 1 to 10.');
    }
    return errs;
  }

  const sameValue = (a, b) => (Array.isArray(a) || Array.isArray(b))
    ? JSON.stringify(a || []) === JSON.stringify(b || [])
    : (a == null ? '' : a) === (b == null ? '' : b);

  /** Which EDITABLE fields differ between the stored doc and the edited form. */
  function diffFields(base, edited) {
    const e = normalizeFields(edited);
    const changed = [];
    for (const k of EDITABLE) {
      if (!(k in e)) continue;
      if (!sameValue(base ? base[k] : undefined, e[k])) changed.push(k);
    }
    return changed;
  }

  const isDirty = (base, edited) => diffFields(base, edited).length > 0;

  /**
   * THE PHONE <-> DESKTOP HAND-OFF (Blake's decision: "phone and desktop
   * should be asynchronous" — neither device is the real one, and work
   * carries between them).
   *
   * Given the stored draft and who/what this device is, decide what to show:
   *   'none'      no draft — edit the published values
   *   'mine'      this device's own draft — restore it silently
   *   'other'     a draft from ANOTHER device — offer it, never auto-clobber
   *   'stale'     a draft that no longer differs from the published doc
   */
  function draftState(draft, doc, thisDeviceId) {
    if (!draft || !draft.fields) return { kind: 'none' };
    if (!isDirty(doc, draft.fields)) return { kind: 'stale' };
    const from = draft.deviceId || null;
    if (from && thisDeviceId && from !== thisDeviceId) {
      return { kind: 'other', deviceLabel: draft.deviceLabel || 'another device', at: draft.updatedAt || null };
    }
    return { kind: 'mine', at: draft.updatedAt || null };
  }

  /** Human label for a draft banner. */
  function describeDraft(state) {
    if (!state) return '';
    if (state.kind === 'other') return `Unsaved changes from ${state.deviceLabel}.`;
    if (state.kind === 'mine') return 'Unsaved changes restored.';
    return '';
  }

  /** Coarse device label — enough to say "your phone" vs "your desktop". */
  function deviceLabelFrom(ua, width) {
    const s = String(ua || '');
    if (/iPad|Tablet/i.test(s) || (width && width >= 768 && width < 1024 && /Mobi|Android/i.test(s))) return 'your tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(s)) return 'your phone';
    return 'your desktop';
  }

  // =========================================================================
  // PHASE 4 — HISTORY + UNDO
  // -------------------------------------------------------------------------
  // A revision doc is { at, by, device, fields: { before, after } } holding
  // ONLY the fields that changed. Revisions are append-only in the rules
  // (update and delete are hard-denied), so UNDO is a FORWARD operation: it
  // writes the old values back as a NEW revision. Same discipline as the git
  // rule — fix forward, never rewrite history. Nothing is ever erasable.
  // =========================================================================

  /** Field names a revision touched. */
  function revisionFields(rev) {
    const after = (rev && rev.fields && rev.fields.after) || {};
    return Object.keys(after);
  }

  /** Short human summary: 'Review and Rating changed'. */
  function summarizeRevision(rev) {
    const ks = revisionFields(rev);
    if (!ks.length) return 'No changes recorded';
    const pretty = ks.map((k) => (k === 'Platforms' ? 'Where to watch' : k === 'Top10Rank' ? 'Top 10 rank' : k));
    if (pretty.length === 1) return `${pretty[0]} changed`;
    const last = pretty.pop();
    return `${pretty.join(', ')} and ${last} changed`;
  }

  /** Readable one-line rendering of a stored field value. */
  function formatValue(v) {
    if (v == null || v === '') return '(empty)';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '(empty)';
    return String(v);
  }

  /** Character delta for a field, for the "−501 chars" style hint. */
  function lengthDelta(before, after) {
    const len = (v) => (Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v)).length;
    return len(after) - len(before);
  }

  /**
   * The patch that undoes a revision: its `before` values.
   * A `null` means the field did not exist then — the caller deletes it.
   */
  function revisionUndoPatch(rev) {
    const before = (rev && rev.fields && rev.fields.before) || {};
    const patch = {};
    for (const k of revisionFields(rev)) patch[k] = (k in before) ? before[k] : null;
    return patch;
  }

  /**
   * Has the catalog moved on since this revision? If a field no longer holds
   * what this revision set, a later edit superseded it — undoing would also
   * discard that newer work, so the UI must say so out loud.
   */
  function undoConflicts(rev, doc) {
    const after = (rev && rev.fields && rev.fields.after) || {};
    const out = [];
    for (const k of Object.keys(after)) {
      if (!sameValue(doc ? doc[k] : undefined, after[k])) out.push(k);
    }
    return out;
  }

  /**
   * Undo is only safe if the restored row still passes the same validation a
   * save would. Returns { ok, patch, errors, conflicts }.
   */
  function planUndo(rev, doc) {
    const patch = revisionUndoPatch(rev);
    const applied = Object.assign({}, doc);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete applied[k];
      else applied[k] = v;
    }
    const errors = validate(applied);
    return { ok: errors.length === 0, patch, errors, conflicts: undoConflicts(rev, doc), applied };
  }

  return {
    EDITABLE, ARRAY_FIELDS,
    normalizeTags, normalizePlatforms, normalizeTrailer, normalizeFields,
    validate, diffFields, isDirty, draftState, describeDraft, deviceLabelFrom,
    revisionFields, summarizeRevision, formatValue, lengthDelta,
    revisionUndoPatch, undoConflicts, planUndo,
  };
}));
