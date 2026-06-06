<!-- author: Code | date: 2026-06-06 -->
# v1.9.0 — GATE 2: the CF core (notify + counts + prune) ✓ (APPLIED — emulator-verified; NOT deployed)

> **Gate 2 done.** Built the two day-1 Cloud Functions against the `DATA-MODEL.md` contract, with all decision logic extracted to pure, unit-tested helpers. **Tests: `test:functions` 18/18 (pure units) · `test:cf` 5/5 (functions+firestore emulator) · `test:rules` still 35/35.** JDK 21 is now a **permanent** install (out of temp, persistent user env). ⚠️ **Deploy-timing call: these CFs stay emulator-only until the gate-6 cutover** — deploying them now would double Blake's bell + double counts against the still-live client path (the duplicate-ping risk, addressed below). Only `ping` remains live. **Production rules + data untouched; nothing deployed this gate; nothing committed** (the first checkpoint commit lands after Gate 3).

## 0 — JDK 21 made permanent ✓
Moved the gate-1 portable JDK out of the temp dir to **`C:\Users\Owner\jdk-21.0.11+10`** and set persistent **user** `JAVA_HOME` + prepended its `bin` to the user `PATH` (survives reboot; no elevation needed). Verified `java -version` = Temurin 21.0.11, and **re-ran `npm run test:rules` against it → 35/35 pass**. (Blake can alternatively use a winget/MSI JDK install; this portable+env approach is a valid permanent setup.)

## 1 — The CF core (plain English, for Blake)
Two functions, both built but **not switched on live yet**:

- **`onCommentVote` / `onReviewVote`** — fire automatically whenever someone likes/dislikes a comment or a community review. They do two jobs the browser used to do unsafely: **(a)** keep the like/dislike **count exact** by adding/subtracting on the server (so two people voting at the same instant can't clobber the tally — the old browser code could), and **(b)** send the author a **"someone liked your…" notification whose name + photo come from the server** (read from the voter's profile), so nobody can forge a notification that looks like it's "from Blake." They skip self-votes and unvotes, and if the recipient muted that kind of ping, **no notification is even written** (mute at the source, not just hidden). Each run is **idempotent** — if Google delivers the same event twice, a one-time marker (`cfProcessed/{eventId}`) makes the second run a no-op, so counts never double.
- **`pruneNotificationsOnCreate`** — the moment a new notification lands, it trims that person's inbox to the **newest 10** on the server (the old code only trimmed when the person happened to open a page, so inboxes grew forever). Every notification also gets a 90-day **auto-expiry** field for long-term cleanup.

**Pure-logic extraction** (the `lib/ping.js` discipline): the tricky bits live in dependency-free, unit-tested helpers — `lib/votecounts.js` (`voteCountDeltas`), `lib/notify.js` (`shouldNotify` + `isMuted`), `lib/prune.js` (`notifsToPrune`). Most of the real bug surface (off-by-one prune, self-notify, count math on a like→dislike flip) is caught there in milliseconds without an emulator.

## 2 — Verification (all green)
| Track | Command | Result |
|---|---|---|
| Pure units (no emulator) | `npm run test:functions` | **18 pass / 0 fail** (ping 2 · votecounts 6 · notify 6 · prune 4) |
| CF trigger wiring (functions+firestore emulator) | `npm run test:cf` | **5 pass / 0 fail** |
| Rules (firestore emulator) | `npm run test:rules` | **35 pass / 0 fail** (re-confirmed) |

The 5 emulator integration tests prove, against the real trigger runtime: ✔ a vote's notification uses the **server-sourced** name even when the vote doc carries a **forged** `fromDisplayName: "FORGED Blake"` (it's ignored) + the count increments; ✔ **five concurrent likes → count is exactly 5** (the increment-race fix); ✔ an **11th notification prunes the oldest** (cap holds at 10); ✔ a **muted** type writes **no** notification while the count still updates; ✔ an **unvote decrements** the count back to 0.

## 3 — Deploy-timing call (mine, explicit) + the duplicate-ping handling
**Decision: do NOT deploy these CFs this gate. They deploy at the gate-6 cutover, atomically with deleting the client write-paths and flipping the staged rules.** Only `ping` is live.

**Why — the duplicate-ping/double-count risk is real and I'm not risking Blake's bell:** production today still runs the OLD rules + OLD client code, which writes the notification **and** increments the count itself (inside the vote transaction at `script.js:4429-4447` / `5360-5378`). If I deployed `onCommentVote`/`onReviewVote` now, every vote would trigger the CF to write a **second** notification and a **second** count increment → Blake's bell rings twice and tallies double. The generic "mint in parallel, then confirm" migration step does **not** apply cleanly here because the CF and the client write the **same** notification + **same** counter (parallel = duplicates, not redundancy).

The clean alternative I'm taking: the CF becomes the **sole** writer of counts + notifications in **one** switch at gate 6 — that single change (a) deletes the two client notification-write blocks, (b) deletes the client count increment, (c) deploys these CFs, (d) flips the staged `firestore.rules` (H1/H3) to prod. No window where both writers run. The CFs are fully emulator-proven now, so the gate-6 deploy is low-risk.

> If Blake ever wants a "deploy proof in prod" before gate 6, the available (heavier) option is a kill-switch flag doc the CF reads — deployed-but-dormant until flipped. I'm **not** recommending it: it's extra plumbing for marginal value when the emulator already proves the wiring. Noted as the fallback, not the plan.

## DATA-MODEL.md — flagged additions (not silent drift)
Two implementation details now folded into the contract:
1. **`cfProcessed/{eventId}`** — a NEW internal idempotency-marker collection (the vote CF `.create()`s it per event). **CF-only by default-deny** (no rules match it → clients can't touch it; Admin SDK bypasses). Self-expires via `expiresAt` (+7 days).
2. **CF notification shape** — the CF sets server-sourced `fromDisplayName`/`fromPhotoURL` + `type`/`value`/`verb`/`animeId`/`targetPath`/`read`/`createdAt`/`expiresAt`, but **not `animeTitle`** (the CF has no catalog access; the gate-6 notification center resolves the title from `animeId`). Mutes read `users/{uid}/notifPrefs/prefs`.

Neither changes any existing collection; both are documented in `DATA-MODEL.md` so later gates build against the real shape.

## Production untouched + working tree (for the Gate 3 prompt)
- **No `firebase deploy` of any kind ran this gate** — only local/emulator commands (`test:functions`, `test:cf`, `test:rules`). Production rules + the live site are byte-for-byte unchanged; the staged `firestore.rules` still leads prod and ships only at the gate-6 cutover (the file's top banner enforces it).
- **Working tree (all uncommitted — checkpoint commit is after Gate 3):** new `functions/` (now incl. `lib/{votecounts,notify,prune}.js`, `test/{votecounts,notify,prune}.test.js`, `cf-tests/cf-integration.spec.js`, the extended `index.js`); `package.json` (+`test:cf`); the staged `firestore.rules` / `firestore.indexes.json` / `firebase.json`; the rolling/Cowork docs + `docs/DATA-MODEL.md`. `functions/node_modules` is git-ignored (confirmed).
- **Gate 3** = cascade deletes (incl. day-1 `onUserDelete`), the `enforceRateLimit` callable, and `aggregateSuggestionCounts` — built against this contract, emulator-tested, still no deploy — **then the first checkpoint commit** (P0→3 as one Blake-authored commit, the 7 Cowork excludes restore-staged out, zero trailers, NO deploy).

## Phantom-drift audit
- **VERIFIED, not trusted:** JDK 21 permanent path works (`java -version` from the new location) + `test:rules` 35/35 against it; `test:functions` 18/18; `test:cf` 5/5 against the real functions+firestore emulators (the forged-name, concurrent-count, prune, mute, and unvote behaviors are emulator-proven, not asserted); `node --check` passes on `index.js` + all libs; git ignores `functions/node_modules`; no deploy ran (only local commands).
- **Honest risk note:** the idempotency marker is created-first (atomic create-if-absent); a crash *between* the marker and the work could drop a count/notification (eventual, cosmetic) — chosen over the double-write risk of the reverse order. Documented.
- **Discipline:** ADMIN_UID symbolic in docs; no provider names; surgical edits; contract additions flagged (not silently drifted); production untouched; no commit (per the checkpoint strategy); stopped after Gate 2.

## One-liner reply
**v1.9.0 Gate 2 is done and fully emulator-verified — nothing deployed, nothing committed, production untouched:** I made JDK 21 a permanent install (and re-confirmed `test:rules` 35/35 on it), then built the two day-1 Cloud Functions against the contract — `onCommentVote`/`onReviewVote` keep like/dislike counts exact via atomic server-side increments (fixing the old race) and send the author a notification whose name+photo are **server-sourced** so a forged "from Blake" name can't survive, skipping self-votes/unvotes and honoring mutes at the source, all made idempotent by a `cfProcessed/{eventId}` marker so a double-delivered event never double-counts; and `pruneNotificationsOnCreate` trims each inbox to the newest 10 server-side (plus a 90-day auto-expiry) — with the tricky logic extracted to pure, unit-tested helpers (`votecounts`/`notify`/`prune`); verification is green across all three tracks (**pure units 18/18, CF emulator integration 5/5 — proving server-sourced-name-beats-forgery, 5-concurrent-votes-equals-exactly-5, 11th-prunes-oldest, mute-writes-nothing, unvote-decrements — and rules 35/35**); my explicit deploy-timing call is to **keep these CFs emulator-only until the gate-6 cutover** because the live client still writes the same notification+count, so deploying now would ring Blake's bell twice and double the tallies — instead the CF becomes the sole writer in one atomic gate-6 switch (delete client writes + deploy CFs + flip the staged rules), with a kill-switch-flag noted only as a fallback I'm not recommending; two contract additions are flagged in DATA-MODEL.md (the internal `cfProcessed` marker collection and the CF notification shape that sets `animeId` but leaves title-resolution to the gate-6 render); **Gate 3 (cascade deletes incl. `onUserDelete` + rate-limit + suggestionCounts) is next, and the first checkpoint commit lands after it** — stopped after Gate 2.
