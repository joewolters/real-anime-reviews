// card-render.js — homepage anime-card markup, shared between the homepage
// (script.js) and the admin form's live preview slot (admin/new-anime.js).
//
// Loaded as a CLASSIC script (not a module) before any module scripts so that
// `window.renderAnimeCardMarkup` is defined by the time anything else runs.
// This file MUST stay framework-free and DOM-only — no imports, no behavior
// wiring, no Firebase/Auth dependencies. Pure presentation.
//
// Author: Code | first shipped 2026-05-11 in v1.6.5 (extracted from script.js
// to fix Bug A: window.renderAnimeCardMarkup wasn't reaching the admin form
// because script.js was never loaded there).
//
// ============================================================================
// Visual byte-equivalence requirement:
//   The DOM produced by renderAnimeCardMarkup(anime) MUST match what the
//   homepage's createCard used to produce inline (before v1.6.5). Tested by
//   the Playwright homepage flows + manual visual diff vs production.
//
// Why the slug() function is duplicated here instead of imported:
//   script.js's slug is a closure-scoped const used in 6+ places (genre/tag
//   filter IDs, deep-link matching, anime URL generation). Moving it would
//   require either window-attaching it (pollutes global) or refactoring every
//   call site. card-render.js's slug() is a small, identical copy — drift
//   risk is bounded because both implementations are 5 lines. If a future
//   change makes slug() significantly more complex, consolidate then.
// ============================================================================

(function () {
  'use strict';

  function slug(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // v1.7.1 gate 1f — choose the subtitle under the title: prefer Romaji when it's
  // meaningfully different from the English title; otherwise fall back to the
  // native Japanese title (rendered in Noto Sans JP via the .is-native class).
  // Duplicated in script.js (modal render) — keep the two in sync.
  // gate 1g — normalize before comparing so romaji that's the same as English
  // bar punctuation/case (e.g. "One Punch Man" vs "One-Punch Man") is treated as
  // identical and we fall through to the native Japanese title instead.
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function pickSubtitle(anime) {
    const eng = String(anime.TitleEnglish || anime.Title || '').trim();
    const rom = String(anime.TitleRomaji || '').trim();
    const nat = String(anime.TitleNative || '').trim();
    if (rom && norm(rom) !== norm(eng)) return { text: rom, kind: 'romaji' };
    if (nat) return { text: nat, kind: 'native' };
    return null;
  }

  function renderAnimeCardMarkup(anime, { animeId, assetBase = 'assets/' } = {}) {
    animeId = animeId || slug(anime.Title);
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.animeid = animeId;
    // v1.7.1 — romaji subtitle under the title, only when it differs from the
    // displayed title (skips identical-romaji titles like "Chainsaw Man").
    // gate 1d — Japanese 「」brackets are LITERAL inline <i class="rb"> chars so
    // they wrap with the text under -webkit-line-clamp. <i> (not <span>) avoids
    // the `.card .info span` gold-text + Top-10 gold-pill cascade.
    // gate 1f — pickSubtitle resolves Romaji-or-native; .is-native swaps the font.
    const sub = pickSubtitle(anime);
    const romaji = sub
      ? `<p class="title-romaji${sub.kind === 'native' ? ' is-native' : ''}"><i class="rb">「</i>${sub.text}<i class="rb">」</i></p>` : '';
    card.innerHTML = `
  <div class="icon-row">
    <button class="icon-btn fav-btn" type="button" data-action="fav" aria-label="Favorite" aria-pressed="false">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                 2 6.01 4.01 4 6.5 4
                 c1.74 0 3.41 1.01 4.13 2.44
                 C11.09 5.01 12.76 4 14.5 4
                 16.99 4 19 6.01 19 8.5
                 c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    </button>
    <button class="icon-btn watch-btn" type="button" data-action="watch" aria-label="Add to watchlist" aria-pressed="false">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4a2 2 0 0 1 2-2z"/>
      </svg>
    </button>
  </div>

  <img src="${assetBase}${anime.image}" alt="${anime.Title}" loading="lazy"
       decoding="async" width="400" height="600"
       onerror="this.onerror=null;this.src='${assetBase}placeholder.png';" />

  <div class="info">
    <h3 class="title-text">${anime.Title}</h3>
    ${romaji}
    <p>${anime.Genre || ""}</p>
    <span>${anime.Rating || ""}</span>
  </div>
`;
    return card;
  }

  window.renderAnimeCardMarkup = renderAnimeCardMarkup;
})();
