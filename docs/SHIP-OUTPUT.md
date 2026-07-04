<!-- author: Code | date: 2026-07-04 -->
# THE MEGA-RUN — Report 8 (THE FINALE): **MILESTONE F COMPLETE — the Curator Studio, your fix list, the renames, THE STRESS PASS. Ready for humans.** Your short smoke 2 below, then the one go.

**Design vision.** The Studio is your workshop wearing the site's own night: search the whole anime world, track anything, and keep notes *in the same nine sections a review uses* — so the day you hit "Publish this one," the review has already written itself and Add Anime opens pre-filled. Statuses dress the public cards (your 44) and feed one quiet line in The Den — "Blake is currently watching: PLUTO" — the site breathing with your actual season. Everything else this gate did was finishing work: your four smoke fixes, the two renames swept site-wide, the old admin Inbox retired now that people can properly DM you, and one last full-surface stress pass before strangers get the keys.

## PART A — the Curator Studio (walked end-to-end in the sandbox, twice)
- **The full cycle, live:** signed in as you → searched "Pluto" (not in your catalog) → Track → set "Currently watching" via the branded dropdown → wrote into 2 of the 9 sections → added a "Season 1" note → quick note → Save → reloaded the page → the row shows title/status/✎ → Edit restores every field → **Publish landed on Add Anime with your notes pre-filled in the review editor and the title filled** (the draft is one-shot; it clears on read). Firestore verified raw: `animeStatus/al:99088 {status:'watching', title:'PLUTO'}` + `curatorNotes/al:99088 {notesMd…}`.
- **Catalog anime route also walked** (Frieren — it IS one of your 44): the studio files it under the catalog slug, so its status dresses the public card, exactly as Curate Cards does.
- **The ✨ ASK drawer:** the missing CSS is in (dark-purple drawer, sampled pixels rgb(21,8,40)); the empty-state quickstarts show and hide correctly; with Mode 1 down it answers with the friendly "double-click MODE 1" bubble + Retry. I also found the header ✨ button was UNREACHABLE while the editor sheet covered it — there's now an **✨ Ask button inside the editor head** (ask mid-note, the whole point), and Esc closes drawer-then-editor in layers.
- **Private stays private:** curatorNotes is admin-only in rules (200 rules tests green, including the 2 new widening tests — both allow and deny sides).

## PART B — your four fixes (your numbering)
1. **Search bar:** it was a side-effect (the 901–1200 band had no rule, so the bar fell back huge). Now 165px in that band — measured live at 1000px and 1201px, pinned in the suite forever.
2. **Constellation guide:** the legend/key renders beside the sky (swatch chips: what a star, the gold join-day, dust mean) — still zero gold ink in wrapped.css, pinned.
3. **Hidden Gems:** moved to the BOTTOM of Discover as its own rail, off the homepage, standard card proportions (measured 0.36 vs 0.33 for its neighbors — no more elongation). One honest note: under Discover's "Reviewed" lens every rail empties (gems included — they're unreviewed by nature); that's the lens's existing site-wide behavior, uniform across all four rails, banked as a polish question.
4. **The door line → The Den:** `#den-watching` sits under the Den folio date line, purple, absent when you're between shows. **Copy staged for your approval:** *"Blake is currently watching: One punch man"* / *"Blake is rewatching: …"* — catalog titles first, then anything you track in the Studio (that's the PLUTO demo in your smoke). Screenshot: `tmp-walk-f-denline.png`.
5. **(Smoke-#4 debt)** The member-side gold DM row is PROVEN: mika messaged you, you replied, and on mika's side your row renders `is-blake` with the 🏮 lantern painting gold (sampled rgb(246,143,58)) above the plain purple member rows. Screenshot: `tmp-b5-goldrow.png`.

## PART C — renames + removals (grep-proven)
1. **Nav "Blake's Den" → "The Den"** on both pages. Site-wide count: 7→**5** survivors, all sanctioned — the section wordmark aria-label, 2 code comments, and 2 changelog-widget history bullets (history stays true).
2. **"Reviewed by Blake" → "Reviewed":** live renders 13→**0** — the 8 remaining hits are all code comments. The sticker vocabulary matches the curator labels.
3. Both counts pinned in tests/g33-finale.spec.js (regex-proof against title="/text renders).
4. **Admin Inbox is gone:** 3 files deleted, page 404s, FAB entry removed, its 6 bump targets retired, and Suggestions "reply" now routes to your real account Inbox (`account.html#inbox/new/<uid>`). Zero orphaned references (comments only).

## THE ADVERSARIAL PANEL (5 lenses, per-finding skeptics — 19 agents)
14 raw findings → 14 confirmed, 0 refuted → **9 distinct defects: 8 FIXED, 1 formally accepted.** The record holds — it caught a real HIGH again:
- **HIGH (fixed):** if the editor's saved-notes load ever failed (an offline blip), the editor opened EMPTY with Save armed — one click would have destroyed up to 40k chars of your private notes behind a "Saved ✓". Save/Publish now stay dead until your docs actually load, with honest copy when they don't.
- **MED (fixed):** the studio's escaper didn't escape quotes inside `src="…"` — an attribute-injection XSS lane from AniList cover data (admin origin). Quotes escaped + covers scheme-gated to https, matching the site's own hubSafeCover discipline.
- **MED (fixed):** switching anime fast could load the FIRST anime's notes into the SECOND's editor and save them under the wrong key — an identity guard now discards stale loads (the search-abort pattern).
- **MED (fixed):** closing the ✨ drawer unlocked page scroll under the still-open editor — `#studio-editor` joined modal-scroll-lock's watch list; one owner for the lock now.
- **MED (fixed):** the parity lane had deleted curation.css's option-readability rule but **Curate Cards was the one admin page never brandified** — its 44 native selects were still visible. Finished properly: every row now wears the branded dropdown (hidden value-store underneath, saved values sync on load, menu paints rgb(18,5,38) dark — pixel-sampled), and the readability rule is restored for the degraded fallback.
- **MED (fixed):** the bump script missed studio.js's internal versioned import (the thrice-bitten stale-TARGETS class) — added, plus curation.js's same pre-existing gap; `--check` now reports all 92 strings agreeing.
- **LOW ×3 (fixed):** reopening the editor within 240ms could blank it (uncancelled hide timer); keyboard focus fell back to the white UA outline inside the editor/drawer (branded ring added); the editor now takes and returns focus like a proper dialog. Catalog covers also resolve correctly from /admin/ now (were 404ing).
- **ACCEPTED (deliberate call, recorded):** if brand-select.js itself ever fails to load, the studio/season-reviews/curation status controls fall back to a native select rather than dying — resilience over purity in a degraded mode that a normal load can never hit.

## PART D — THE STRESS PASS
| Area | Evidence | Verdict |
|---|---|---|
| Full test tracks | Playwright **274** · rules **200** · functions **77** · triggers **78** · e2e **21** — all floors up, zero flakes this session | **PASS** |
| Curator Studio cycle | Walked twice (catalog + outside anime), 36 checks incl. Firestore raw docs + publish pre-fill | **PASS** |
| Concurrency: simultaneous DMs | mika + ren sent at the same instant — both letters landed on both sides | **PASS** |
| Concurrency: racing group adds | two back-to-back adds, no settle wait — 3 participants, none lost | **PASS** |
| Concurrency: vote race | two members hit Helpful simultaneously — count went exactly +2 (14→16), no lost update | **PASS** |
| Letters / requests / decline-silent / groups / sealed images | the 5 e2e cycles green (incl. the real send-to-Blake) | **PASS** |
| Member-side gold DM row (your smoke-#4 debt) | `tmp-b5-goldrow.png` + sampled gold pixels | **PASS** |
| Responsive | one-band header at 375/1000/1201/1440 · zero clipped grid cards · zero horizontal overflow · B1 band verified live · drawer toggle ≤1200 | **PASS** |
| Discover: gems rail + lens | rail at the bottom, 12 cards, standard proportions; "Reviewed" lens empties all rails uniformly (pre-existing, banked) | **PASS** |
| Den line | catalog-first and Studio-tracked fallback both walked live | **PASS** |
| Admin parity | zero visible native selects on studio AND curation (pixel-sampled menus) · zero live alert() calls · branded notices in reports/suggestions | **PASS** |
| Constellation + key | wr-key pinned, zero gold ink in wrapped.css | **PASS** |

**Ready for humans: YES.** Every area of the v2.0 surface re-proven this session, the panel's findings fixed and pinned, and the concurrency seams (the ones strangers will actually hit) held under deliberate races.

## Green (the new floors)
Playwright **274** (+8 g33 finale pins) · rules **200** (+2 studio widening) · functions **77** · triggers **78** · e2e **21**. Six adversarial panels across the run now; every confirmed finding fixed or formally accepted, 0 refuted this round.

## YOUR SHORT SMOKE 2 (~8 minutes — only what's new; practice is running)
Open `http://127.0.0.1:8765/?emu=1` · you = `blake@practice.test` / `practice123`.
1. **The Studio:** admin FAB → **Curator Studio 工房** → search any anime you're actually watching → Track → set a status, write a line into a section or two, add a season note → Save → reload → Edit (everything's back) → **Publish this one →** lands on Add Anime with your notes already in the editor.
2. **✨ mid-note:** with the editor open, hit the ✨ Ask in the sheet's head — the drawer slides over your notes.
3. **The renames:** the nav says **The Den**; any reviewed card's sticker says **Reviewed**.
4. **The Den line (copy approval):** The Den's masthead shows *"Blake is currently watching: …"* fed by what you just tracked. **Approve or reword the line.**
5. **Hidden Gems:** Discover → scroll to the bottom → the HIDDEN GEMS rail, normal card shapes.
6. **Curate Cards:** the status dropdowns are the site's purple ones now (no white OS menus anywhere).

## THE CUTOVER (restated — nothing moves until your word)
**v2.0.0.** Order: bump + CHANGELOG + widget bullets + commit → deploy **only** `functions:backfillProfiles` → run `await window.__rarBackfillProfiles()` in the console as you (I guide, we verify minted+existing==total) → **indexes → hosting → firestore rules → storage rules → functions** — verified at each step, rollback per step. After: the close-out checklist + a live prod smoke (one vote, one letter, one card pill, one studio save).

## One-liner reply
Milestone F is verified and stress-passed end to end — the Curator Studio cycle works live from search to the publish button that pre-fills Add Anime, your four fixes and both renames are in with zero stragglers, the admin Inbox is retired, the panel caught and I fixed a genuine HIGH (a failed load could have let one Save destroy your private notes) plus seven more, every floor is up at 274/200/77/78/21 with the concurrency races held, and the whole thing is ready for humans — your ~8-minute smoke above, your word on the Den line copy, then the single go for the v2.0.0 cutover.
