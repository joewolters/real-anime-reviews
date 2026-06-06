'use strict';

// Pure, dependency-free: given notification doc ids sorted NEWEST-FIRST, return
// the ids to delete so only the newest `keep` remain. Replaces the old client-
// side prune (which only ran when the recipient happened to open a page).
function notifsToPrune(idsNewestFirst, keep) {
  const k = typeof keep === 'number' && keep >= 0 ? keep : 10;
  if (!Array.isArray(idsNewestFirst) || idsNewestFirst.length <= k) return [];
  return idsNewestFirst.slice(k);
}

module.exports = { notifsToPrune };
