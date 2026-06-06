<!-- author: Cowork | date: 2026-06-06 -->
# v1.8.4 — THE SWEEP (docs cascade → bump ×47 → audits → commit → preview — FAST-TRACK, STOP before prod)

G8b smoke passed (update log approved as-is — Blake retracted his restructure note). Two tiny tidy-ups ride as item 0, then the full close-out of the 10-gate ship. **Do NOT deploy to production — that waits for Blake's explicit "ship it" in chat. He has not said it.**

## 0. Two tidy-ups (Blake, final smoke)
- **(a) Quotes admin description** — trim the page's intro blurb: drop the technical detail (the `quotes.json` runtime mention etc.). Keep one short plain line about what the page does.
- **(b) The hint pill** — the arrow should point **up** (↑) instead of sideways, and the Japanese text currently wraps onto two lines (his screenshot: その先 / へ split) — size/extend it so the JP reads on one line.

## The cascade
1. **CHANGELOG.md** — v1.8.4 MINOR (arguably the biggest visitor ship yet — if your honest read says the lead warrants *Overhaul* phrasing, write it that way; the widget tier will then derive "Big Update" honestly). The visitor story: the For You + Discover surfaces, the blended catalog (NOT-REVIEWED stickers, gold pins, request path, saves everywhere), the real nav + composed homepage, the constellation veil + pulse, the door's update log + quotes. Admin: the Quotes page. Author marker per convention.
2. **Widget** — visitor-first per the skill **including the new `.vs-head`/`data-tier` authoring shape** (the skill doc has the template — Cowork updated it). This ship is rich; bullets accordingly, no provider names anywhere.
3. **`bump-version 1.8.4`** — expect **47**, `--check` all agree.
4. **ROADMAP.md + NEXT.md** — v1.8.4 ✅ shipped (scoped as built, G1→G8b incl. the pivots), "Live at" → v1.8.4, next pointer → **v1.9.0 Community/Account overhaul** (the design-study ship; Blake: "asap"). **Bank the deferred knobs** in NEXT: the For-You title alternates · the veil-pulse tuning knobs + the account/suggest pulse extension · the showcase bottom-align knob · the "N people requested" v1.9.0 Cloud-Function plan · the "Blake's Constellation" static-SVG polish idea.
5. **Audits** — `npm test` (84 floor; item 0 may touch a hint/quotes spec — report final), gitignore↔firebase mirror (quotes.json + admin/quotes.* are public BY DESIGN), smart-quote sweep, **full `git diff` review** (10 gates of changes — watch for stray debug/junk; `animeData.js` should be untouched this ship).
6. **Commit + push** — ONE Blake-authored commit (`--author="Blake Wolters <196413457+joewolters@users.noreply.github.com>"`), ZERO trailers, the 7 Cowork excludes restore-staged out (`COWORK-STYLE.md` stays untracked), rolling docs ride in. Verify author + trailers post-commit.
7. **Preview deploy** — verify on the channel: APP_VERSION **1.8.4**, `admin/quotes.html` + `quotes.json` **200**, leak checks **404** (SHIP docs, CODE-HANDOFF, HANDOFF, tests/, .env), and spot-check the veil + door render on the channel.

Report: the sweep table + preview URL + Blake's preview smoke steps. Then STOP and wait — no prod.
