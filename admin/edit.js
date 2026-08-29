// admin/edit.js — Admin "Edit a Review" page.
// <!-- author: Code | date: 2026-08-13 -->
// Lists every catalog review (cover + title, searchable) → an editable form loaded
// straight from animeData.js. v2.3.1: SAVING GOES TO THE CLOUD. It used to PUT to
// the Mode 1 desktop server, which the cloud migration retired — so editing a
// review had the same dead end as adding one.
//
// ⚠️ THE DOCUMENT ID IS NOT slugify(). This page's slugify() strips apostrophes
// (it had to match the old server's row lookup); catalog ids turn them into a
// dash. For "An Archdemon's Dilemma" that is `an-archdemons-...` vs
// `an-archdemon-s-...` — a silent miss on 8 titles, and the id is also the key
// every live comment room hangs off. The id therefore comes from the SHARED
// RarCatalogModel.slug, and slugify() stays ONLY as this page's internal list key.
import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const ADMIN_UID = 'G2jGRa14u8bzGAmeBTkvXy8PKmr1';
const $ = (id) => document.getElementById(id);

// This page's INTERNAL list key only. It is NOT the catalog document id — see the
// warning at the top of this file. catalogIdFor() below is what addresses a doc.
function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// ---- State -----------------------------------------------------------------
let catalog = [];          // [{ slug, anime }]
let currentSlug = null;
let currentAnime = null;
// watched-set tree (ported from new-anime.js)
let watchedEntries = [];
let watchedChecked = new Set();
let watchedSourceId = null;
// gate-4 adds
let chat = null;            // shared ✨ ASK drawer controller (window.RarChatDrawer)
let fixProposed = null;     // last "fix platforms" proposal awaiting Apply
// gate-4b adds
let formOrigin = 'list';            // 'modal' (came from the site's ✎) | 'list'
let initialWatchedChecked = null;   // snapshot of the loaded watched set, for Revert
// gate-3b (v1.8.2) — the section-aware Review editor (window.RarSectionEditor)
let reviewEditor = null;
// The editor's canonical value of the CURRENTLY-loaded review, captured at load time.
// The change-diff compares this against the live editor value, so any normalization the
// editor applies on load (whitespace, known-title casing) never reads as a real change.
let loadedReviewMd = '';

function getCatalog() {
  const list = (window.animeData && Array.isArray(window.animeData)) ? window.animeData : [];
  return list
    .filter(a => a && a.Title)
    .map(a => ({ slug: slugify(a.Title), anime: a }))
    .sort((x, y) => x.anime.Title.toLowerCase().localeCompare(y.anime.Title.toLowerCase()));
}

// v2.3.1 — the desktop-server probe is gone: saving writes to the catalog in the
// cloud, so there is nothing to be up or down. The "start the local server"
// banner it drove is hidden for good.
function hideLegacyServerBanner() {
  const banner = $('edit-server-banner');
  if (banner) banner.hidden = true;
}

// ---- List ------------------------------------------------------------------
// v2.3.1 — the one true document id for a catalog row.
function catalogIdFor(anime) {
  const M = window.RarCatalogModel;
  if (!M || typeof M.slug !== 'function') return null;
  return M.slug(anime && anime.Title ? anime.Title : '');
}

function renderList() {
  const q = ($('edit-search').value || '').trim().toLowerCase();
  const root = $('edit-list');
  root.innerHTML = '';
  const rows = catalog.filter(c => !q || c.anime.Title.toLowerCase().includes(q));
  $('edit-stats').textContent = `${rows.length} of ${catalog.length} review${catalog.length === 1 ? '' : 's'}`;
  if (!rows.length) { root.innerHTML = '<li class="edit-list-empty">No reviews match that search.</li>'; return; }
  rows.forEach(c => {
    const li = document.createElement('li');
    li.className = 'edit-list-item';
    li.dataset.slug = c.slug;
    const cover = c.anime.image
      ? `<img class="edit-list-cover" src="../assets/${escapeHtml(c.anime.image)}" alt="" loading="lazy">`
      : '<span class="edit-list-cover edit-list-cover--ph"></span>';
    li.innerHTML =
      cover +
      `<span class="edit-list-title">${escapeHtml(c.anime.Title)}</span>` +
      `<span class="edit-list-meta">${escapeHtml(c.anime.Rating || '')}</span>` +
      '<span class="edit-list-go">Edit →</span>';
    root.appendChild(li);
  });
}

// ---- Form ------------------------------------------------------------------
function tagsToInput(tags) {
  if (!Array.isArray(tags) || !tags.length) return '';
  return tags.map(t => '#' + t).join(' ');
}
function platformsToInput(p) { return Array.isArray(p) ? p.join(', ') : (p || ''); }

// Fill the header + every form field from a row (no view toggles / no tree fetch) —
// shared by openForm and Revert.
function setFieldValues(a) {
  $('edit-form-cover').src = a.image ? `../assets/${a.image}` : '';
  $('edit-form-cover').style.display = a.image ? '' : 'none';
  $('edit-form-title').textContent = a.Title;
  $('edit-form-slug').textContent = currentSlug;
  $('f-title').value = a.Title || '';
  $('f-rating').value = a.Rating || '';
  $('f-seasons').value = a.Seasons || '';
  $('f-top10').value = (a.Top10Rank != null) ? a.Top10Rank : '';
  $('f-genre').value = a.Genre || '';
  $('f-studio').value = a.Studio || '';
  $('f-platforms').value = platformsToInput(a.Platforms);
  $('f-trailer').value = a.Trailer || '';
  $('f-tags').value = tagsToInput(a.Tags);
  $('f-description').value = a.Description || '';
  if (reviewEditor) reviewEditor.load(a.Review || '');
  loadedReviewMd = reviewEditor ? reviewEditor.value().trim() : String(a.Review || '').trim();
  updateReviewPreview();
}

function openForm(slug) {
  const entry = catalog.find(c => c.slug === slug);
  if (!entry) return;
  currentSlug = slug;
  currentAnime = entry.anime;
  setFieldValues(entry.anime);
  // watched-set tree — interactive, pre-checked from the row's current set (async).
  loadWatchedTree(entry.anime.AniListId, entry.anime.WatchedAniListIds);
  $('edit-status').textContent = '';
  $('edit-fix-panel').hidden = true; fixProposed = null;
  if (chat) chat.setAnime();          // re-key the ✨ ASK drawer to this anime
  updateBackLink();                   // origin-aware label
  $('edit-list-view').hidden = true;
  $('edit-form-view').hidden = false;
  window.scrollTo(0, 0);
}

// Origin-aware return: deep-linked from the site's ✎ → back to that anime's modal;
// opened from the edit list → back to the list.
function updateBackLink() {
  $('edit-back-link').textContent = (formOrigin === 'modal') ? '← Back to site' : '← All reviews';
}
function returnToOrigin() {
  if (formOrigin === 'modal' && currentSlug) {
    location.href = '../index.html#anime=' + encodeURIComponent(currentSlug);
    return;
  }
  closeForm();
}

function closeForm() {
  currentSlug = null;
  currentAnime = null;
  if (chat) chat.setAnime();          // disable + close the drawer (no anime loaded)
  $('edit-form-view').hidden = true;
  $('edit-list-view').hidden = false;
}

// ---- Revert (discard unsaved edits → reload the saved row) ------------------
function openRevertConfirm() { if (currentSlug) $('edit-revert-confirm').hidden = false; }
function closeRevertConfirm() { $('edit-revert-confirm').hidden = true; }
function revertForm() {
  closeRevertConfirm();
  if (!currentAnime) return;
  setFieldValues(currentAnime);
  if (initialWatchedChecked) { watchedChecked = new Set(initialWatchedChecked); renderWatchedRows(); }
  $('edit-fix-panel').hidden = true; fixProposed = null;
  $('edit-status').textContent = 'Reverted to saved values.';
}

// ---- Top-10 stepper (branded ▲/▼ — native number spinners aren't cross-engine) ----
function stepTop10(delta) {
  const el = $('f-top10');
  let v = parseInt(el.value, 10);
  if (isNaN(v)) v = (delta > 0) ? 1 : 10;   // first press from blank picks an end
  else v += delta;
  el.value = String(Math.max(1, Math.min(10, v)));
}

function updateReviewPreview() {
  const md = reviewEditor ? reviewEditor.value() : '';
  $('f-review-preview').innerHTML = (md && md.trim())
    ? (window.RarSectionEditor ? window.RarSectionEditor.previewHtml(md)
      : (window.renderMarkdown ? window.renderMarkdown(md) : escapeHtml(md)))
    : '<p class="edit-preview-empty">Nothing to preview yet.</p>';
}

// ---- Watched-set tree (ported from new-anime.js — same traversal/defaults/toolbar/chip) -
function watchedTitleOf(n) { return (n.title && (n.title.english || n.title.romaji)) || '(untitled)'; }
function watchedMeta(n) {
  const studio = Array.from(new Set((n.studios?.nodes || []).filter(s => s.isAnimationStudio).map(s => s.name))).join(', ');
  const parts = [n.format, n.episodes ? `${n.episodes} ep` : '', n.seasonYear || ''].filter(Boolean);
  const meta = parts.join(' · ');
  return studio ? (meta ? `${meta} · ${studio}` : studio) : meta;
}
function watchedStatusLabel(s) {
  if (s === 'NOT_YET_RELEASED') return 'UPCOMING';
  if (s === 'RELEASING') return 'AIRING';
  return s || '';
}

// Load the franchise tree for the row's primary id and pre-check from its CURRENT
// WatchedAniListIds (the existing saved set — NOT new-anime's FINISHED auto-default,
// since this is an edit). The source id is always force-included.
async function loadWatchedTree(primaryId, currentWatchedIds) {
  const panel = $('franchise-info-panel');
  const ul = $('franchise-entries');
  if (!panel || !ul) return;
  const sourceId = Number(primaryId) || null;
  watchedSourceId = sourceId;
  watchedEntries = [];
  watchedChecked = new Set();
  initialWatchedChecked = null;       // reset the Revert snapshot for this row
  panel.hidden = false;
  ul.innerHTML = '<li class="watched-loading">Loading franchise…</li>';
  updateWatchedCount();

  let tree = null;
  try {
    if (window.franchiseFetch && window.franchiseFetch.traverseFranchise) {
      tree = await window.franchiseFetch.traverseFranchise(sourceId);
    }
  } catch (_) { tree = null; }
  // bail if the visitor switched rows while this resolved
  if (watchedSourceId !== sourceId) return;

  const hasTree = tree && (tree.spine.length || Object.keys(tree.groups).length);
  if (!hasTree) { panel.hidden = true; return; }   // single-entry: source is force-included on save

  const entries = [];
  const seen = new Set();
  const pushNode = (n, group, isSource) => {
    if (!n || !n.id || seen.has(n.id)) return;
    seen.add(n.id);
    entries.push({ id: n.id, title: watchedTitleOf(n), status: n.status || null, meta: watchedMeta(n), cover: (n.coverImage && n.coverImage.large) || '', group, isSource: !!isSource });
  };
  tree.spine.forEach(n => pushNode(n, 'SPINE', n.isSource));
  for (const [rt, nodes] of Object.entries(tree.groups)) nodes.forEach(n => pushNode(n, rt, false));

  watchedEntries = entries;
  // pre-check from the row's existing WatchedAniListIds + the source (forced)
  const pre = new Set((Array.isArray(currentWatchedIds) ? currentWatchedIds : []).map(Number));
  for (const e of entries) { if (e.isSource || pre.has(e.id)) watchedChecked.add(e.id); }
  if (sourceId) watchedChecked.add(sourceId);
  renderWatchedRows();
  initialWatchedChecked = new Set(watchedChecked);   // snapshot for Revert
}

function renderWatchedRows() {
  const ul = $('franchise-entries');
  if (!ul) return;
  ul.innerHTML = (watchedEntries || []).map(e => {
    const checked = watchedChecked.has(e.id) ? ' checked' : '';
    const disabled = e.isSource ? ' disabled' : '';
    const tag = e.isSource
      ? '<span class="entry-relation entry-relation--main">MAIN</span>'
      : `<span class="entry-relation">${escapeHtml(e.group)}</span>`;
    const cover = e.cover
      ? `<img class="watched-cover" src="${escapeHtml(e.cover)}" alt="" loading="lazy">`
      : '<span class="watched-cover watched-cover--ph" aria-hidden="true"></span>';
    const statusTag = (e.status && e.status !== 'FINISHED')
      ? `<span class="watched-status">${escapeHtml(watchedStatusLabel(e.status))}</span>` : '';
    return `<li class="watched-row${e.isSource ? ' is-source' : ''}">
      <label class="watched-check"${e.isSource ? ' title="The main entry is always included"' : ''}>
        <input type="checkbox" data-watched-id="${escapeHtml(String(e.id))}"${checked}${disabled}>
        <span class="watched-box" aria-hidden="true"></span>
      </label>
      ${cover}
      <span class="watched-body">
        ${tag}
        <span class="entry-title">${escapeHtml(e.title)} ${statusTag}</span>
        <span class="entry-meta">${escapeHtml(e.meta)}</span>
      </span>
    </li>`;
  }).join('');
  updateWatchedCount();
}

function updateWatchedCount() {
  const el = $('watched-count');
  if (!el) return;
  const total = (watchedEntries || []).length;
  const sel = watchedChecked ? watchedChecked.size : 0;
  el.textContent = total ? `${sel} of ${total} selected` : '—';
}

// The watched value for save: the checked set (+ source) when the tree is active;
// otherwise (single-entry/offline/no-tree) preserve the row's existing value.
function watchedFieldValue() {
  const panel = $('franchise-info-panel');
  if (panel && !panel.hidden && watchedEntries.length) {
    const set = new Set(Array.from(watchedChecked).map(Number));
    if (watchedSourceId) set.add(Number(watchedSourceId));
    return Array.from(set).join(',');
  }
  return Array.isArray(currentAnime && currentAnime.WatchedAniListIds) ? currentAnime.WatchedAniListIds.join(',') : '';
}

// Build the header-keyed fields payload (matches the Excel column names + sync's
// expected formats). Title/AniList fields/KnownAniListIds are NOT sent (server-side
// allowlist also blocks them — KnownAniListIds is left exactly as new-anime persists it).
function collectFields() {
  return {
    Rating: $('f-rating').value.trim(),
    Seasons: $('f-seasons').value.trim(),
    Genre: $('f-genre').value.trim(),
    Studio: $('f-studio').value.trim(),
    Watch: $('f-platforms').value.trim(),         // sync: split on comma
    Trailer: $('f-trailer').value.trim(),
    Tags: $('f-tags').value.trim(),               // sync: split on '#'
    Description: $('f-description').value.trim(),
    Review: (reviewEditor ? reviewEditor.value() : '').trim(),
    Top10Rank: $('f-top10').value.trim(),         // blank → cell cleared
    WatchedAniListIds: watchedFieldValue(),       // from the interactive tree
  };
}

// v2.3.1 — the write goes to the catalog in Firestore. Throws on failure.
// ⚠️ update(), not set-with-merge: set-with-merge CREATES a document that is not
// there, so a wrong id would silently mint a ghost anime instead of failing. This
// project has been bitten by exactly that (see CLAUDE.md, redactAuthored). An
// edit must only ever modify a row that already exists.
async function doSave() {
  const M = window.RarCatalogModel;
  if (!M) throw new Error('The catalog model did not load — reload the page.');
  const id = catalogIdFor(currentAnime);
  if (!id) throw new Error('Could not work out which catalog row this is.');

  const raw = collectFields();
  const fields = {
    Title: raw.Title !== undefined ? raw.Title : currentAnime.Title,
    Genre: raw.Genre, Rating: raw.Rating, Seasons: raw.Seasons,
    Description: raw.Description, Review: raw.Review,
    Studio: raw.Studio, Trailer: M.normalizeTrailer(raw.Trailer || ''),
    Tags: M.normalizeTags(raw.Tags || ''),
    Platforms: M.normalizePlatforms(raw.Platforms || raw.Watch || ''),
  };
  Object.keys(fields).forEach((k) => { if (fields[k] === undefined) delete fields[k]; });

  // Top10Rank: blank clears it rather than storing an empty string.
  const top = String(raw.Top10Rank || '').trim();
  if (top) fields.Top10Rank = Number(top);

  // the watched set drives the "REVIEWED" badge across the site
  const watched = String(raw.WatchedAniListIds || '').trim();
  if (watched) fields.WatchedAniListIds = watched.split(',').map(Number).filter(Boolean);

  const problems = (typeof M.validate === 'function') ? M.validate(fields) : null;
  if (problems && problems.length) throw new Error(problems.join(' · '));

  const ref = doc(db, 'catalog', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('No catalog entry with the id "' + id + '" — nothing was changed.');
  }
  await updateDoc(ref, { ...fields, updatedAt: serverTimestamp() });
  return { ok: true, id };
}

// ---- Change diff (before → after, platforms-backfill dry-run vocabulary) ----
const DIFF_FIELDS = [
  { key: 'Rating', label: 'Rating' },
  { key: 'Seasons', label: 'Seasons' },
  { key: 'Top10Rank', label: 'Top 10 rank' },
  { key: 'Genre', label: 'Genre' },
  { key: 'Studio', label: 'Studio' },
  { key: 'Watch', label: 'Where to watch' },
  { key: 'Trailer', label: 'Trailer' },
  { key: 'Tags', label: 'Tags' },
  { key: 'Description', label: 'Description' },
  { key: 'Review', label: 'Review' },
];

// The row's CURRENT values, formatted exactly like collectFields() so an untouched
// field compares equal (no false diffs).
function beforeFields() {
  const a = currentAnime || {};
  return {
    Rating: String(a.Rating || '').trim(),
    Seasons: String(a.Seasons || '').trim(),
    Genre: String(a.Genre || '').trim(),
    Studio: String(a.Studio || '').trim(),
    Watch: platformsToInput(a.Platforms).trim(),
    Trailer: String(a.Trailer || '').trim(),
    Tags: tagsToInput(a.Tags).trim(),
    Description: String(a.Description || '').trim(),
    Review: loadedReviewMd,   // the editor's value at load — no normalization noise in the diff
    Top10Rank: (a.Top10Rank != null) ? String(a.Top10Rank) : '',
  };
}
function watchedIdsBefore() {
  const a = currentAnime || {};
  return new Set((Array.isArray(a.WatchedAniListIds) ? a.WatchedAniListIds : []).map(Number).filter(n => !isNaN(n)));
}
function watchedIdsAfter() {
  return new Set(String(watchedFieldValue() || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)));
}

// The list of changed fields (each { label, before, after }).
function computeChanges() {
  const before = beforeFields();
  const after = collectFields();
  const out = [];
  for (const f of DIFF_FIELDS) {
    const b = String(before[f.key] || '');
    const a2 = String(after[f.key] || '');
    if (b !== a2) out.push({ label: f.label, before: b, after: a2 });
  }
  const wb = watchedIdsBefore(), wa = watchedIdsAfter();
  const sameSet = wb.size === wa.size && [...wb].every(x => wa.has(x));
  if (!sameSet) {
    const added = [...wa].filter(x => !wb.has(x)).length;
    const removed = [...wb].filter(x => !wa.has(x)).length;
    out.push({ label: 'Watched set', before: `${wb.size} entries`, after: `${wa.size} entries (+${added} / −${removed})` });
  }
  return out;
}

function renderDiff(el, changes) {
  if (!el) return;
  if (!changes.length) { el.innerHTML = '<p class="edit-diff-none">No field changes — this re-publishes the current data.</p>'; return; }
  // Full text (no truncation) — long fields scroll within their cell (see edit.css).
  const cell = (s) => s ? escapeHtml(String(s)) : '<em>empty</em>';
  el.innerHTML = '<div class="edit-diff-head"><span>Field</span><span>Before</span><span>After</span></div>' +
    changes.map(c => `<div class="edit-diff-row">
      <span class="edit-diff-field">${escapeHtml(c.label)}</span>
      <span class="edit-diff-before">${cell(c.before)}</span>
      <span class="edit-diff-after">${cell(c.after)}</span>
    </div>`).join('');
}

// Keep the in-memory row in sync after a save so a later diff reflects the saved
// state (animeData.js isn't reloaded into the page without a refresh).
function syncCurrentAnimeFromForm() {
  const a = currentAnime;
  if (!a) return;
  a.Rating = $('f-rating').value.trim();
  a.Seasons = $('f-seasons').value.trim();
  a.Genre = $('f-genre').value.trim();
  a.Studio = $('f-studio').value.trim();
  a.Trailer = $('f-trailer').value.trim();
  a.Description = $('f-description').value.trim();
  a.Review = (reviewEditor ? reviewEditor.value() : '').trim();
  loadedReviewMd = a.Review;   // saved state becomes the new diff baseline
  const t = $('f-top10').value.trim();
  a.Top10Rank = t === '' ? null : parseInt(t, 10);
  a.Platforms = $('f-platforms').value.split(',').map(s => s.trim()).filter(Boolean);
  a.Tags = $('f-tags').value.split('#').map(s => s.trim()).filter(Boolean);
  a.WatchedAniListIds = String(watchedFieldValue() || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

// ---- Save (Tier-1) — change-diff confirm gates the write ----
function save() {
  if (!currentSlug) return;
  const changes = computeChanges();
  if (!changes.length) { $('edit-status').textContent = 'No changes to save.'; return; }
  renderDiff($('edit-save-diff'), changes);
  $('edit-save-confirm').hidden = false;
}
function closeSaveConfirm() { $('edit-save-confirm').hidden = true; }

async function confirmedSave() {
  closeSaveConfirm();
  $('edit-save').disabled = true;
  $('edit-status').textContent = 'Saving…';
  try {
    const j = await doSave();
    syncCurrentAnimeFromForm();
    $('edit-status').textContent = `Saved ✓ (${(j.changed || []).length} field${(j.changed || []).length === 1 ? '' : 's'} → animeData.js regenerated)`;
  } catch (err) {
    $('edit-status').textContent = 'Save failed: ' + err.message;
  } finally {
    $('edit-save').disabled = false;
  }
}

// ---- Fix platforms (one-click — reuses backfill-platforms mapping via the server) ----
// The panel ALWAYS opens with visible feedback: an inline message (offline / no-id /
// error) or the current → proposed result. No silent no-op.
function showFixMsg(text) {
  $('edit-fix-result').hidden = true;
  $('edit-fix-apply').hidden = true;
  const m = $('edit-fix-msg');
  m.textContent = text; m.hidden = false;
  $('edit-fix-panel').hidden = false;
}

// Premium flag rows (the backfill lib's CLI-style strings → kicker + text chips).
function fixFlagRow(kicker, text, kind) {
  return `<span class="edit-fix-flag edit-fix-flag--${kind}">` +
    `<span class="edit-fix-flag-kicker">${escapeHtml(kicker)}</span>` +
    `<span class="edit-fix-flag-text">${escapeHtml(text)}</span></span>`;
}
function fixFlagHtml(flag) {
  let m = /^excluded\(([^)]*)\):\s*(.+)$/.exec(flag);          // "excluded(regional/defunct): Bilibili TV"
  if (m) return fixFlagRow('NOT CARRIED · ' + m[1], m[2], 'warn');
  m = /^UNMAPPED \([^)]*\):\s*(.+)$/.exec(flag);               // "UNMAPPED (Blake's eye): SomeSite"
  if (m) return fixFlagRow('UNMAPPED', m[1], 'warn');
  return fixFlagRow('NOTE', flag, 'note');                     // manual override / no-links etc.
}
async function fixPlatforms() {
  if (!currentAnime || !currentSlug) return;
  const id = Number(currentAnime.AniListId) || null;
  fixProposed = null;
  if (!id) { showFixMsg("This row has no AniList id, so platforms can't be auto-suggested."); return; }
  // v2.3.1 — this used to POST to the Mode 1 server. It now runs HERE, on the
  // SAME allowlist/override module the backfill CLI uses (admin/platform-map.js,
  // moved out of scripts/ so a page can load it). One set of rules, so the
  // suggestion here can never drift from what the CLI would do.
  const PM = window.RarPlatformMap;
  const ff = window.franchiseFetch;
  if (!PM || !ff || typeof ff.fetchMediaDetail !== 'function') {
    showFixMsg('The platform rules did not load — reload the page and try again.');
    return;
  }
  const btn = $('edit-fix-platforms');
  btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Checking AniList…';
  try {
    const detail = await ff.fetchMediaDetail(id);
    if (!detail) throw new Error('AniList did not answer — try again in a moment.');
    const j = PM.proposePlatformsForRow(
      currentAnime.Title || '', detail.externalLinks, $('f-platforms').value.trim());
    j.current = String($('f-platforms').value.trim() || '');
    fixProposed = j.proposed || '';
    $('edit-fix-current').textContent = j.current || '(blank)';
    $('edit-fix-proposed').textContent = j.proposed || '(blank)';
    const flagsEl = $('edit-fix-flags');
    if (Array.isArray(j.flags) && j.flags.length) { flagsEl.innerHTML = j.flags.map(fixFlagHtml).join(''); flagsEl.hidden = false; }
    else { flagsEl.innerHTML = ''; flagsEl.hidden = true; }
    $('edit-fix-msg').hidden = true;
    $('edit-fix-result').hidden = false;
    const noChange = (j.action === 'SAME') || !j.proposed || (j.proposed === $('f-platforms').value.trim());
    const applyBtn = $('edit-fix-apply');
    applyBtn.hidden = false;
    applyBtn.disabled = noChange;
    applyBtn.textContent = noChange ? 'Already matches ✓' : 'Apply to field';
    $('edit-fix-panel').hidden = false;
  } catch (err) {
    showFixMsg('Fix platforms failed: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = prev;
  }
}
function applyFixPlatforms() {
  if (fixProposed != null) $('f-platforms').value = fixProposed;
  $('edit-fix-panel').hidden = true;
}
function dismissFixPlatforms() { $('edit-fix-panel').hidden = true; }

// ---- v2.3.1 - the Tier-2 'Ship' flow was REMOVED. It streamed a git commit
//      and a deploy out of the Mode 1 desktop server, which no longer exists.
//      Publishing is now a deliberate step taken from the machine, exactly as
//      it is for Add Anime: the page's job is to get the change into the
//      catalog safely, not to push the site.

// ---- Live preview (the REAL homepage modal stack via #anime=<slug>) ---------
function openPreview() {
  if (!currentSlug) return;
  $('edit-preview-title').textContent = (currentAnime && currentAnime.Title) || currentSlug;
  // Fresh src each open forces a reload, so the preview reflects the latest SAVED
  // animeData.js (Tier-1 save regenerates it). Unsaved form edits are NOT shown.
  $('edit-preview-frame').src = '../index.html#anime=' + encodeURIComponent(currentSlug);
  $('edit-preview-overlay').hidden = false;
}
function closePreview() {
  $('edit-preview-overlay').hidden = true;
  $('edit-preview-frame').src = 'about:blank';   // stop the iframe + free resources
}

// ---- Wire-up ---------------------------------------------------------------
function init() {
  catalog = getCatalog();
  renderList();

  // ✨ ASK drawer — shared controller (admin/chat-drawer.js). Context comes from the
  // loaded animeData row; per-anime history via rar:chat:<aniListId>, same /api/chat.
  if (window.RarChatDrawer) {
    chat = window.RarChatDrawer.mount({
      getSession: () => {
        if (!currentAnime) return null;
        const id = Number(currentAnime.AniListId) || null;
        if (!id) return null;
        return {
          id,
          context: {
            title: currentAnime.Title || '',
            romaji: currentAnime.TitleRomaji || '',
            year: currentAnime.SeasonYear || '',
            format: '',
            studios: currentAnime.Studio ? [currentAnime.Studio] : [],
            genres: String(currentAnime.Genre || '').split(/[\/,]/).map(s => s.trim()).filter(Boolean),
            description: currentAnime.Description || '',
          },
        };
      },
    });
  }

  $('edit-search').addEventListener('input', renderList);
  $('edit-list').addEventListener('click', (e) => {
    const li = e.target.closest('.edit-list-item');
    if (li) { formOrigin = 'list'; openForm(li.dataset.slug); }   // list-opened → list-origin
  });
  $('edit-back-link').addEventListener('click', returnToOrigin);
  $('edit-cancel').addEventListener('click', returnToOrigin);
  $('edit-revert').addEventListener('click', openRevertConfirm);
  $('edit-revert-cancel').addEventListener('click', closeRevertConfirm);
  $('edit-revert-go').addEventListener('click', revertForm);
  $('edit-save').addEventListener('click', save);
  $('edit-save-cancel').addEventListener('click', closeSaveConfirm);
  $('edit-save-confirm-go').addEventListener('click', confirmedSave);
  $('edit-fix-platforms').addEventListener('click', fixPlatforms);
  $('edit-fix-apply').addEventListener('click', applyFixPlatforms);
  $('edit-fix-dismiss').addEventListener('click', dismissFixPlatforms);
  $('f-top10-up').addEventListener('click', () => stepTop10(1));
  $('f-top10-down').addEventListener('click', () => stepTop10(-1));
  // v2.3.1 - the Ship buttons went with the deploy pipeline they drove.
  $('edit-preview-btn').addEventListener('click', openPreview);
  $('edit-preview-close').addEventListener('click', closePreview);
  // Section-aware Review editor — its onChange drives the live preview.
  if (window.RarSectionEditor) {
    reviewEditor = window.RarSectionEditor.mount($('f-review-editor'), { onChange: updateReviewPreview });
  }

  // watched-set tree: checkbox toggles + select-all/none/spine (same as new-anime)
  const fp = $('franchise-info-panel');
  if (fp) {
    fp.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-watched-id]');
      if (!cb || !watchedChecked) return;
      const id = Number(cb.dataset.watchedId);
      if (cb.checked) watchedChecked.add(id); else watchedChecked.delete(id);
      updateWatchedCount();
    });
    fp.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-watched-toggle]');
      if (!btn || !watchedChecked) return;
      const mode = btn.dataset.watchedToggle;
      if (mode === 'all') watchedEntries.forEach(en => watchedChecked.add(en.id));
      else if (mode === 'none') { watchedChecked.clear(); watchedEntries.forEach(en => { if (en.isSource) watchedChecked.add(en.id); }); }
      else if (mode === 'spine') { watchedChecked.clear(); watchedEntries.forEach(en => { if (en.group === 'SPINE') watchedChecked.add(en.id); }); }
      if (watchedSourceId) watchedChecked.add(Number(watchedSourceId));
      renderWatchedRows();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (chat && chat.isOpen && chat.isOpen()) { chat.close(); return; }
    if (!$('edit-save-confirm').hidden) { closeSaveConfirm(); return; }
    if (!$('edit-revert-confirm').hidden) { closeRevertConfirm(); return; }
    if (!$('edit-preview-overlay').hidden) { closePreview(); return; }
    if (!$('edit-form-view').hidden) returnToOrigin();
  });

  hideLegacyServerBanner();
  Promise.resolve().then(() => {
    // Deep-link: edit.html?slug=<slug>&from=modal (the inline ✎ on the site modal).
    // `from=modal` makes Cancel/back return to that anime's modal, not the list.
    try {
      const params = new URLSearchParams(location.search);
      const qs = params.get('slug');
      formOrigin = (params.get('from') === 'modal') ? 'modal' : 'list';
      if (qs && catalog.some(c => c.slug === qs)) openForm(qs);
    } catch (_) {}
  });
}

// ---- Auth gate -------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== ADMIN_UID) { location.href = '../index.html'; return; }
  $('admin-gate').hidden = true;
  $('admin-main').hidden = false;
  init();
});
