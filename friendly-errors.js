// friendly-errors.js (ES module) — the ONE branded-error implementation,
// shared by index (script.js) and account (account.js).
// =============================================================================
// v1.10.1 HOTFIX: Blake's prod verify surfaced a RAW Firebase Storage error
// string rendered in the Tavern composer (provider name + an internal
// uploads/ path, visitor-facing) and a background-upload failure copy that
// blamed the consent gate for what was actually a Storage-side denial.
// House rules: branded human copy ONLY — no provider names, no internal
// paths, no SDK codes in any visitor UI, ever. The raw error belongs in the
// console (the CALLER logs it; this module stays pure so the g28 spec can
// feed it hostile inputs directly).
//
// friendlyError(err, opts) → a SAFE, human, truthful message string.
//   err  — anything: an SDK error, a string, undefined.
//   opts.user — the current Auth user (or null); drives the verify-email copy.
//   opts.kind — 'upload' | 'post' | 'save' (tunes the verb; default 'post').
// =============================================================================

export function friendlyError(err, opts) {
  const o = opts || {};
  const kind = o.kind || 'post';
  const raw = String((err && (err.code || '') + ' ' + (err.message || '')) || err || '').toLowerCase();

  const denied = /storage\/unauthorized|permission|unauthorized|403|insufficient/.test(raw);
  if (denied) {
    // the ONE truthful split: an unverified email is the user's to fix; any
    // other denial is the site's problem — never tell them to retry forever.
    if (o.user && o.user.emailVerified === false) {
      return 'Verify your email to upload images — check your inbox for the verification link, then try again.';
    }
    if (kind === 'upload') {
      return 'Uploads are locked on the site right now — this one’s on us, not you. Tell the Creator if it keeps up.';
    }
    return 'That didn’t go through — the site said no. Tell the Creator if it keeps up.';
  }
  if (/quota|too.?large|payload/.test(raw)) {
    return 'That image didn’t fit — try a smaller file (up to 5 MB).';
  }
  if (/network|offline|unavailable|timeout|retry-limit/.test(raw)) {
    return 'The connection hiccuped — check your internet and try again.';
  }
  if (kind === 'upload') return 'The upload didn’t go through — try again in a moment.';
  if (kind === 'save') return 'The save didn’t go through — try again in a moment.';
  return 'That didn’t go through — try again in a moment.';
}

// =============================================================================
// LAST CALL Part C — showNotice(msg): the BRANDED toast that retired the last
// native alert() dialogs on the visitor pages (the "no native dialogs
// anywhere" rule, finally level everywhere). One quiet purple card, bottom
// center, aria-live polite, auto-dismisses, ✕-dismissible, stacks up to 3.
// Styles live in style.css (.rar-notice*); reduced-motion covered there.
// =============================================================================
export function showNotice(msg) {
  try {
    let host = document.getElementById('rar-notice-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'rar-notice-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    while (host.children.length >= 3) host.removeChild(host.firstChild);
    const card = document.createElement('div');
    card.className = 'rar-notice';
    const txt = document.createElement('span');
    txt.className = 'rar-notice-text';
    txt.textContent = String(msg == null ? '' : msg);
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'rar-notice-x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '×';
    const kill = () => { try { card.remove(); } catch (_) {} };
    x.addEventListener('click', kill);
    card.appendChild(txt); card.appendChild(x);
    host.appendChild(card);
    setTimeout(kill, 6500);
  } catch (_) { /* a notice must never throw over the action it reports */ }
}

// exposed for the g28 spec (the coverClamp/lanternModel precedent)
if (typeof window !== 'undefined') window.friendlyErrorModel = { friendlyError };
