'use strict';

// Pure, dependency-free rolling-window rate decision (unit-tested without the
// emulator). Given the prior per-user state {windowStart, count}, the current
// time, the window length, and the limit: return whether THIS new write is over
// the limit + the next state to persist. The CF uses "detect-and-undo" — if
// overLimit, it deletes the offending doc (it doesn't change the client write
// path). The callable pre-block stays the documented escalation (gate-0 §5).
function rateDecision(state, nowMs, windowMs, limit) {
  let windowStart = state && typeof state.windowStart === 'number' ? state.windowStart : nowMs;
  let count = state && typeof state.count === 'number' ? state.count : 0;
  if (nowMs - windowStart > windowMs) { windowStart = nowMs; count = 0; } // window rolled over
  count += 1;
  return { overLimit: count > limit, nextState: { windowStart, count } };
}

module.exports = { rateDecision };
