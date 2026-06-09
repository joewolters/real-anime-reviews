'use strict';

// Pure, dependency-free forum hotScore math (unit-tested without the emulator).
// A thread's "hot" rank blends its net votes + post activity against its age, so
// a fresh, well-voted, busy thread floats to the top and decays as it ages.
//
//   hotScore = (likes - dislikes + 0.5*postCount) / (ageHours + 2)^1.5
//   ageHours = max(0, (nowMs - createdAtMs) / 3600000)
//
// The +2 floor keeps a brand-new thread (ageHours ~ 0) from exploding toward
// infinity; the 1.5 exponent makes older threads fall off faster than linearly.
// All inputs are coerced to finite numbers (missing / NaN -> 0) so a partial
// thread doc never yields NaN.
function num(x) {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

function hotScore({ likes, dislikes, postCount, createdAtMs, nowMs } = {}) {
  const l = num(likes);
  const d = num(dislikes);
  const pc = num(postCount);
  const created = num(createdAtMs);
  const now = num(nowMs);
  const ageHours = Math.max(0, (now - created) / 3600000);
  const numerator = l - d + 0.5 * pc;
  return numerator / Math.pow(ageHours + 2, 1.5);
}

module.exports = { hotScore };
