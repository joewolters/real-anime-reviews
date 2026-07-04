// markdown.js
// <!-- author: Code | date: 2026-06-04 -->
// v1.7.4 (gate 3b) — SINGLE-SOURCE whitelist-safe markdown → HTML renderer.
// Extracted from script.js so the homepage modal (Review/Description + per-season
// review), the admin season-review editor, and the admin new-anime Review preview
// ALL share ONE renderer. Classic script → exposes window.renderMarkdown +
// window.renderMarkdownInline (and module.exports for Node tests). Self-contained.
//
// ALL input is HTML-escaped FIRST, then a small subset is applied: # / ## / ###
// headers (→ h4/h5/h6, beneath a section's h3), - / * lists, **bold**, *italic*,
// `code`, [text](http(s) link), and ||spoiler|| (v1.10.0 gate 11 — a click-to-
// reveal span; the reveal listener lives in script.js, the admin queue
// auto-reveals via CSS). No raw HTML survives → XSS-safe even for
// visitor-fetched markdown files.
(function (root) {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // LAST CALL A5 — bare-URL autolink ("people should just be able to copy
  // paste like a normal site"). Runs LAST, on already-escaped/processed HTML:
  // the string is split on existing <a> elements so an explicit [text](url)
  // link (or its visible text) is never double-wrapped, and only https?://
  // survives (the same scheme gate as the explicit-link pass). Trailing
  // sentence punctuation stays outside the link. Input is fully escaped, so
  // the href can only ever contain entities — no attribute breakout exists.
  function linkifyBareUrls(html) {
    // (code spans stay inert — the live editor's own CODE-is-inert rule)
    return html.split(/(<a [^>]*>[\s\S]*?<\/a>|<code>[\s\S]*?<\/code>)/g).map(function (seg, i) {
      if (i % 2 === 1) return seg;   // an existing anchor — untouched
      return seg.replace(/(^|[\s>])(https?:\/\/[^\s<]+?)([.,;:!?)\]]*)(?=[\s<]|$)/g,
        function (_m, pre, url, trail) {
          return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' + trail;
        });
    }).join('');
  }

  function renderMarkdownInline(t) {
    return linkifyBareUrls(escapeHtml(t)
      // v1.10.0 gate 11 — ||spoiler||: hidden until clicked (the span is the
      // button; reveal wiring is the consumer's job). Runs FIRST so the inner
      // text still gets bold/italic/code/links applied by the passes below.
      // Content may not contain a pipe (a v1 simplification, documented).
      .replace(/\|\|([^|\n]+)\|\|/g, '<span class="rar-spoiler" data-spoiler role="button" tabindex="0" aria-label="Spoiler — click to reveal" title="Spoiler — click to reveal">$1</span>')
      // v1.10.0 image overhaul — [img:N] (N 1-4) emits an EMPTY placeholder slot.
      // markdown.js knows nothing about Storage: the consumer (script.js
      // resolveImageSlots) swaps the slot for the doc's Nth imageRef figure —
      // so the body text never carries a path/URL (nothing to inject) and a
      // token with no matching ref simply renders nothing.
      .replace(/\[img:([1-4])\]/g, '<span class="rar-img-slot" data-img-slot="$1" hidden></span>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // v1.7.5 (gate 3) — AniList bios use __double-underscore__ for bold. Run it
      // after the ** pass and before the single-* italic pass. _single-underscore_
      // italic is deliberately NOT supported: it collides with snake_case words and
      // underscores inside the [text](url) link targets handled below.
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'));
  }

  // v1.8.2 — anchorable heading ids for the structured-review jump-pills. Returns a
  // fresh per-document id-maker: slug is derived STRICTLY from [a-z0-9] runs (so no
  // markup can ever leak into an id, regardless of input), prefixed `rsec-`, empty
  // slugs (e.g. a CJK-only heading) fall back to `rsec-section`, and collisions get a
  // `-2`/`-3` counter. renderMarkdown + extractSections each make their own and call
  // it for EVERY heading in document order, so the ids they produce match exactly.
  function makeHeadingId() {
    const used = Object.create(null);
    return function (text) {
      let base = 'rsec-' + String(text == null ? '' : text).toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (base === 'rsec-') base = 'rsec-section';
      let id = base, n = 2;
      while (used[id]) { id = base + '-' + n; n++; }
      used[id] = true;
      return id;
    };
  }

  function renderMarkdown(md) {
    if (!md) return '';
    const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [];
    let list = null;
    const headingId = makeHeadingId();
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(renderMarkdownInline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('<ul>' + list.map(li => '<li>' + renderMarkdownInline(li) + '</li>').join('') + '</ul>'); list = null; } };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const h = /^(#{1,3})\s+(.*)$/.exec(line);
      const li = /^[-*]\s+(.*)$/.exec(line);
      if (h) { flushPara(); flushList(); const lvl = h[1].length + 3; const id = headingId(h[2]); out.push('<h' + lvl + ' id="' + id + '" class="md-h">' + renderMarkdownInline(h[2]) + '</h' + lvl + '>'); continue; }
      if (li) { flushPara(); (list = list || []).push(li[1]); continue; }
      if (line.trim() === '') { flushPara(); flushList(); continue; }
      flushList(); para.push(line);
    }
    flushPara(); flushList();
    return out.join('');
  }

  // v1.8.2 — the section list for the jump-pills: level-2 (`##`) headings only, in
  // document order, with ids that MATCH renderMarkdown's (it advances the same
  // id-maker for every heading level so the counter stays in sync). `label` is the
  // raw heading text (the pill builder escapes it). Heading-less input → [].
  function extractSections(md) {
    if (!md) return [];
    const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    const headingId = makeHeadingId();
    const out = [];
    for (const raw of lines) {
      const h = /^(#{1,3})\s+(.*)$/.exec(raw.replace(/\s+$/, ''));
      if (!h) continue;
      const id = headingId(h[2]);            // advance for EVERY heading to mirror renderMarkdown
      if (h[1].length === 2) out.push({ id: id, label: h[2].trim(), level: 2 });
    }
    return out;
  }

  // v1.8.2 — the 9-section skeleton the "Insert template" buttons drop in (one storage
  // format: `##` headings through this same renderer). Blank line under each heading
  // so the author types prose beneath it.
  var REVIEW_TEMPLATE =
    ['Intro', 'Animation', 'Story', 'Characters', 'Design', 'Music', 'Feel', 'Extra Thoughts', 'Overall']
      .map(function (s) { return '## ' + s + '\n'; }).join('\n') + '\n';

  // v1.8.2 (gate 3b) — the section-aware editor's lossless round-trip core. The split
  // key is EXACTLY the renderer's level-2 heading test (`^##` then whitespace — `#`,
  // `###`+, and `##nospace` all fall through), so a section boundary is precisely what
  // renders as a section. Everything that isn't a `## ` line — intro prose, `###`
  // sub-headings, lists, bold, links, blank lines — is carried as OPAQUE verbatim text.
  // Therefore render(compile(parse(x))) === render(x): no content is lost or reshaped,
  // only inter-block whitespace is normalized (which the renderer ignores).
  function parseReviewSections(md) {
    const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    const trimBlank = (s) => s.replace(/^\n+/, '').replace(/\s+$/, '');
    const intro = [];
    const sections = [];
    let cur = null;   // { title, body: [lines] }
    const flush = () => { if (cur) sections.push({ title: cur.title, body: trimBlank(cur.body.join('\n')) }); };
    for (const line of lines) {
      const h = /^##\s+(.*)$/.exec(line);   // level-2 ONLY (mirrors renderMarkdown)
      if (h) { flush(); cur = { title: h[1].trim(), body: [] }; }
      else if (cur) cur.body.push(line);
      else intro.push(line);
    }
    flush();
    return { intro: trimBlank(intro.join('\n')), sections };
  }

  function compileReviewSections(model) {
    model = model || {};
    const trimBlank = (s) => String(s == null ? '' : s).replace(/^\n+/, '').replace(/\s+$/, '');
    const parts = [];
    const intro = trimBlank(model.intro);
    if (intro) parts.push(intro);
    (model.sections || []).forEach((s) => {
      const title = String(s && s.title != null ? s.title : '').trim();
      const body = trimBlank(s && s.body);
      parts.push(body ? ('## ' + title + '\n' + body) : ('## ' + title));
    });
    return parts.join('\n\n');
  }

  if (root) {
    root.renderMarkdown = renderMarkdown;
    root.renderMarkdownInline = renderMarkdownInline;
    root.extractSections = extractSections;
    root.REVIEW_TEMPLATE = REVIEW_TEMPLATE;
    root.parseReviewSections = parseReviewSections;
    root.compileReviewSections = compileReviewSections;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { renderMarkdown, renderMarkdownInline, extractSections, REVIEW_TEMPLATE, parseReviewSections, compileReviewSections, escapeHtml };
})(typeof window !== 'undefined' ? window : this);
