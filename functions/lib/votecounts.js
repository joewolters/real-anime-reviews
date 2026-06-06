'use strict';

// Pure, dependency-free vote-count math (unit-tested without the emulator).
// A vote write is an onWrite (create / update / delete). Given the previous and
// next vote values (1 = like, -1 = dislike, anything else = none), return the
// deltas to apply to the parent's likesCount / dislikesCount via increment().
// This replaces the old racy client transaction (recon HIGH risk #3 / H1).
function voteCountDeltas(before, after) {
  const b = before === 1 || before === -1 ? before : 0;
  const a = after === 1 || after === -1 ? after : 0;
  return {
    likesDelta: (a === 1 ? 1 : 0) - (b === 1 ? 1 : 0),
    dislikesDelta: (a === -1 ? 1 : 0) - (b === -1 ? 1 : 0),
  };
}

module.exports = { voteCountDeltas };
