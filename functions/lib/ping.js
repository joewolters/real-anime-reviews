'use strict';

// Pure, dependency-free payload builder for the `ping` health-check function.
// Deliberately kept OUT of index.js so it can be unit-tested with `node --test`
// WITHOUT the Firebase runtime (no Admin SDK, no emulator, no Blaze) — this is
// the "pure logic unit" layer described in docs/DATA-MODEL.md § Test plan, where
// most of the real CF bug surface should live (cheap, milliseconds, no emulator).
//
// `now` is injected so the output is deterministic in tests; production callers
// pass nothing and get the real current time.
function pingPayload(now) {
  const at = now instanceof Date ? now : new Date();
  return {
    ok: true,
    service: 'real-anime-reviews-functions',
    message: 'pong',
    at: at.toISOString(),
  };
}

module.exports = { pingPayload };
