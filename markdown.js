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
// `code`, and [text](http(s) link). No raw HTML survives → XSS-safe even for
// visitor-fetched markdown files.
(function (root) {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderMarkdownInline(t) {
    return escapeHtml(t)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function renderMarkdown(md) {
    if (!md) return '';
    const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(renderMarkdownInline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('<ul>' + list.map(li => '<li>' + renderMarkdownInline(li) + '</li>').join('') + '</ul>'); list = null; } };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const h = /^(#{1,3})\s+(.*)$/.exec(line);
      const li = /^[-*]\s+(.*)$/.exec(line);
      if (h) { flushPara(); flushList(); const lvl = h[1].length + 3; out.push('<h' + lvl + '>' + renderMarkdownInline(h[2]) + '</h' + lvl + '>'); continue; }
      if (li) { flushPara(); (list = list || []).push(li[1]); continue; }
      if (line.trim() === '') { flushPara(); flushList(); continue; }
      flushList(); para.push(line);
    }
    flushPara(); flushList();
    return out.join('');
  }

  if (root) { root.renderMarkdown = renderMarkdown; root.renderMarkdownInline = renderMarkdownInline; }
  if (typeof module !== 'undefined' && module.exports) module.exports = { renderMarkdown, renderMarkdownInline, escapeHtml };
})(typeof window !== 'undefined' ? window : this);
