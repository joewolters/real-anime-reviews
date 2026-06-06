'use strict';

// Pure, dependency-free: should a vote landing at `afterValue` notify the
// content author? Only on an actual up/down vote (NOT an unvote/removal), and
// never self-notify. The server (not the client) decides this.
function shouldNotify(voterUid, authorUid, afterValue) {
  return (afterValue === 1 || afterValue === -1)
    && !!voterUid
    && !!authorUid
    && voterUid !== authorUid;
}

// Pure: is `type` muted in this recipient's notifPrefs doc data (or null)?
// Mutes are honored at the SOURCE — the CF doesn't even write the doc.
function isMuted(prefsData, type) {
  return !!(prefsData && prefsData.muted && prefsData.muted[type] === true);
}

module.exports = { shouldNotify, isMuted };
