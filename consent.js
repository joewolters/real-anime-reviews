// consent.js (ES module) — the ONE community-rules consent implementation,
// shared by index (script.js) and account (account.js).
// =============================================================================
// EXTRACTED from script.js's gate-3 block in the account-overhaul round 2: the
// account page needs the same branded "I agree" flow (Blake: "its dumb for
// users to have to go comment to accept the terms"), and round 1's adversarial
// HIGH was precisely a fix landing in one of two DUPLICATE implementations
// (the lantern's avatar gate) — so the consent UI lives here ONCE instead of
// growing a twin. The MODAL MARKUP + COPY are verbatim (g3-consent.spec.js
// pins them; the rules list is Blake's approved consent record, version 1).
//
// ⚠️ CURRENT_RULES_VERSION MUST equal firestore.rules rulesVersion() AND
// functions/lib/moderation.js CURRENT_RULES_VERSION (all 1 today). Bump all
// THREE together (plus this one) to re-prompt everyone on their next post.
// (NOTE: like lantern.js, this file is a bare import — not ?v= cache-busted.
// Fine while staged/new; the post-cutover version-busting item covers both.)
// =============================================================================
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js';

export const CURRENT_RULES_VERSION = 1;

let _consentOkUid = null; // uid confirmed consented THIS session (skip the re-read)

// PURE — the gate decision from the moderationGate doc data (no I/O). Exposed on
// window (by script.js) for the Playwright spec.
//   gate = the moderationGate doc data, or null when the doc doesn't exist.
//   returns 'suspended' | 'consent' | 'ok'.
export function consentGateDecision(gate, version) {
  if (gate && gate.banned === true) return 'suspended';
  const v = (gate && typeof gate.consentVersion === 'number') ? gate.consentVersion : 0;
  return v >= version ? 'ok' : 'consent';
}

// The branded consent modal (NO native dialog). Resolves true after acceptRules
// succeeds, false on cancel/Esc/backdrop. COPY is Blake's verbatim numbered list
// (2026-06-08); the CONTAINER carries the brand (jp-mini kicker, purple — never
// gold, this is a community surface). The "I agree" calls the acceptRules
// CALLABLE — consent is CF-minted server-side, never self-attested.
export function showConsentModal(functions) {
  return new Promise((resolve) => {
    document.querySelectorAll('.rar-consent-overlay').forEach((n) => n.remove());
    const overlay = document.createElement('div');
    overlay.className = 'rar-consent-overlay';
    overlay.innerHTML = `
      <div class="rar-consent-modal" role="dialog" aria-modal="true" aria-label="Community rules">
        <h3 class="rar-consent-title">Community Rules <span class="jp-mini">規約</span></h3>
        <p class="rar-consent-sub">By posting, you agree to the following:</p>
        <ol class="rar-consent-rules">
          <li>No harassment, hate speech, or personal attacks.</li>
          <li>Mark spoilers with the spoiler tag.</li>
          <li>No illegal content. No sexually explicit or graphic images.</li>
          <li>No spam, advertising, or impersonation.</li>
          <li>Post only content you have the right to share.</li>
          <li>Violations may result in content removal or a permanent account ban, at the moderator's discretion.</li>
        </ol>
        <p class="rar-consent-error" role="alert"></p>
        <div class="rar-consent-actions">
          <button type="button" class="action-btn rar-consent-cancel">Cancel</button>
          <button type="button" class="action-btn rar-consent-agree">I agree</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let settled = false;
    const done = (val) => {
      if (settled) return; settled = true;
      document.removeEventListener('keydown', onEsc);
      try { overlay.remove(); } catch (_) {}
      resolve(val);
    };
    // stopPropagation: the anime-modal Esc handler lives on `window` (bubble
    // phase); without this, Esc here would also close the underlying anime modal.
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    document.addEventListener('keydown', onEsc);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
    overlay.querySelector('.rar-consent-cancel').addEventListener('click', () => done(false));

    const agreeBtn = overlay.querySelector('.rar-consent-agree');
    const errEl = overlay.querySelector('.rar-consent-error');
    agreeBtn.addEventListener('click', async () => {
      agreeBtn.disabled = true; errEl.textContent = '';
      try {
        await httpsCallable(functions, 'acceptRules')({ version: CURRENT_RULES_VERSION });
        done(true);
      } catch (err) {
        agreeBtn.disabled = false;
        errEl.textContent = "Couldn't save that — check your connection and try again.";
      }
    });
  });
}

// The branded suspended state (NO native alert) for a banned user who tries to
// participate.
export function showSuspendedModal() {
  document.querySelectorAll('.rar-consent-overlay').forEach((n) => n.remove());
  const overlay = document.createElement('div');
  overlay.className = 'rar-consent-overlay';
  overlay.innerHTML = `
    <div class="rar-consent-modal rar-suspended-modal" role="dialog" aria-modal="true" aria-label="Account suspended">
      <h3 class="rar-consent-title">Account suspended <span class="jp-mini">停止</span></h3>
      <p class="rar-consent-sub">Your account is suspended. You can't post, reply, or review here while it's suspended.</p>
      <div class="rar-consent-actions">
        <button type="button" class="action-btn rar-consent-cancel">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => { document.removeEventListener('keydown', onEsc); try { overlay.remove(); } catch (_) {} };
  // stopPropagation so Esc doesn't also close the underlying anime modal (window-level handler).
  const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onEsc);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.rar-consent-cancel').addEventListener('click', close);
}

// Reads the caller's own moderationGate doc and walks the decision:
// 'ok' | 'cancelled' | 'suspended'. ⚠️ This is the WRITE gate, so it ALWAYS
// re-reads (round-2 adversarial MED: a session-cache hit skipped the suspended
// branch for a user banned MID-session — the rules still denied the write, but
// the suspended modal never showed and the failure message lied). The session
// cache only softens a transient READ error: a previously-confirmed user
// degrades to 'ok' (let the write surface the truth) instead of being walled
// out by a network blip. peekConsent (below) keeps the cache for cheap UI.
export async function ensureConsent(user, db, functions, opts) {
  const o = opts || {};
  if (!user) return 'signed-out';
  if (o.adminUid && user.uid === o.adminUid) return 'ok';   // admin bypasses (mirrors rules isAdmin())

  let gate = null;
  try {
    const snap = await getDoc(doc(db, 'moderationGate', user.uid));
    gate = snap.exists() ? snap.data() : null;
  } catch (_e) {
    // The owner can read their own gate doc, so this only trips on a transient
    // network error — degrade to letting the write attempt surface the real error.
    return 'ok';
  }

  const decision = consentGateDecision(gate, CURRENT_RULES_VERSION);
  if (decision === 'suspended') { showSuspendedModal(); return 'suspended'; }
  if (decision === 'ok') { _consentOkUid = user.uid; return 'ok'; }

  const agreed = await showConsentModal(functions);         // decision === 'consent'
  if (agreed) { _consentOkUid = user.uid; return 'ok'; }
  return 'cancelled';
}

// Peek without any modal — for "should the unlock banner show?" UI states.
// Returns 'ok' | 'consent' | 'suspended' | 'unknown'.
export async function peekConsent(user, db, opts) {
  const o = opts || {};
  if (!user) return 'unknown';
  if (o.adminUid && user.uid === o.adminUid) return 'ok';
  if (_consentOkUid === user.uid) return 'ok';
  try {
    const snap = await getDoc(doc(db, 'moderationGate', user.uid));
    const gate = snap.exists() ? snap.data() : null;
    const d = consentGateDecision(gate, CURRENT_RULES_VERSION);
    if (d === 'ok') _consentOkUid = user.uid;
    return d;
  } catch (_e) { return 'unknown'; }
}
