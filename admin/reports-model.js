// admin/reports-model.js — PURE helpers for the admin reports queue (v1.10.0 gate 4).
// No imports, no DOM/Firebase deps, so this loads as a classic <script> AND is
// require()-able in Node for the spec (mirrors markdown.js's dual-export shape).
//
// Author: Code | v1.10.0 gate 4 — admin reports queue.

(function () {
  'use strict';

  // Escape-first HTML escape — the floor for rendering attacker-controlled report
  // text (the reporter snapshot + note). In the browser, reports.js prefers
  // window.renderMarkdownInline (richer + ALSO escape-first); this is the fallback
  // and the Node-testable XSS guarantee.
  function escapeReportText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Render a short snapshot safely: prefer the shared markdown inline renderer
  // (escape-first; covered by markdown-bold.spec), else fall back to plain escape.
  // Either way the output is escape-first — never raw attacker HTML.
  function reportSnapshotHtml(s) {
    if (typeof window !== 'undefined' && typeof window.renderMarkdownInline === 'function') {
      return window.renderMarkdownInline(s == null ? '' : String(s));
    }
    return escapeReportText(s);
  }

  // Normalize a timestamp (ms number | Firestore Timestamp | {seconds} | Date | ISO).
  function toMillis(ts) {
    if (ts == null) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds != null) return ts.seconds * 1000;
    const t = new Date(ts).getTime();
    return isNaN(t) ? 0 : t;
  }

  // Dedupe reports by targetPath: collapse N reports of one target into ONE row
  // carrying reportCount + the distinct reporters + the distinct reasons + the
  // newest representative (so the admin sees "reported ×N", not N rows). Sorted by
  // reportCount desc, then most-recent first.
  //   each report: { id, reporterUid, reason, targetType, targetPath, targetUid,
  //                  targetAnimeId, snapshotText, note?, createdAt }
  function dedupeReportsByTarget(reports) {
    const groups = new Map();
    (reports || []).forEach((r) => {
      if (!r) return;
      const key = r.targetPath || ('__id:' + (r.id || ''));   // fall back to id if no path
      let g = groups.get(key);
      if (!g) {
        g = {
          targetPath: r.targetPath || '',
          targetType: r.targetType || '',
          targetUid: r.targetUid || '',
          targetAnimeId: r.targetAnimeId || '',
          reportCount: 0,
          reporters: [],
          reasons: [],
          ids: [],
          latestMs: 0,
          latest: null,
        };
        groups.set(key, g);
      }
      const ms = toMillis(r.createdAt);
      g.reportCount += 1;
      if (r.reporterUid && g.reporters.indexOf(r.reporterUid) === -1) g.reporters.push(r.reporterUid);
      if (r.reason && g.reasons.indexOf(r.reason) === -1) g.reasons.push(r.reason);
      if (r.id) g.ids.push(r.id);
      if (ms >= g.latestMs) { g.latestMs = ms; g.latest = r; }
    });
    const rows = Array.from(groups.values());
    rows.sort((a, b) => (b.reportCount - a.reportCount) || (b.latestMs - a.latestMs));
    return rows;
  }

  const api = { escapeReportText, reportSnapshotHtml, dedupeReportsByTarget, toMillis };
  if (typeof window !== 'undefined') {
    window.dedupeReportsByTarget = dedupeReportsByTarget;
    window.reportSnapshotHtml = reportSnapshotHtml;
    window.escapeReportText = escapeReportText;
    window.RarReportsModel = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
