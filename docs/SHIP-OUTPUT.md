<!-- author: Code | date: 2026-08-30 -->
# SHIP-OUTPUT — v2.3.4: publishing is one step, and a shared review shows the review

**🚀 LIVE.** Deployed 2026-08-30 on Blake's go, functions FIRST then hosting.

**Prod-verified, not assumed.** The live `/anime/<slug>` returns per-anime tags
(`og:title` = the review's title, `og:image` = its cover, `twitter:card` = `summary`);
an unknown slug returns **200**, not a 404. The live `animeData.js` carries
`RAR_CATALOG_PUBLISHED_AT` and all 22 shipped field names; the live `script.js` carries
`catalogTopUp` and `card-render.js` carries `data-fallback`. A real browser load of the
home page shows 45 entries, the correct Latest Drop and **zero console errors** — the
top-up ran and correctly found nothing. And the query itself was proven end-to-end
against production over the public REST API, unauthenticated: with an early `since` it
returns rows, so the rules permit it and the shape is right; with the real stamp it
returns none, which is the zero-work normal case.

## What Blake asked for

Three things, from two messages:

> "Can we fix both those issues." — (1) publishing always takes two steps; (2) the
> publish script never checks the cover art exists.

> "I posted a link with a review. Can the thumbnail of the review show up instead of
> the entire page?"

## 1. Publishing is one step — the live top-up

The site loads a generated `animeData.js`. Firestore is the authoring store. So a
saved review was invisible until someone regenerated that file and deployed.

**The boundary I had to respect.** `docs/CLOUD-MIGRATION-STUDY.md` §3 chose static
publish over live reads deliberately, and the table is emphatic — live reads mean
"44 doc reads **per visitor**", an "extra round-trip before first paint", ~20
catalog-coupled specs reworked, and "a boot-path rewrite on a live site with real
members" as HIGH risk. That decision stands. Blake picked the option that keeps it.

**What ships instead.** The static file still boots the site, unchanged. AFTER first
paint, one query asks Firestore *"anything changed since this file was built?"* —
`where('updatedAt', '>', RAR_CATALOG_PUBLISHED_AT)`. On a normal visit that is a
single empty result; it is only ever non-empty between a publish and the next
rebuild. It is not awaited and swallows its own errors, so a blocked or slow query
leaves the page exactly as it is today. Rules needed no change: `firestore.rules:569`
is already `allow get, list: if true` on `catalog`.

### ⚠️ THE TRAP THAT WOULD HAVE SHIPPED A HALF-WORKING FEATURE

My first design was "put the extended catalog on `window.animeData`". The study
killed it, and this is worth inheriting:

> `animeData` is a top-level `const` in a CLASSIC script — a global **lexical**
> binding, **not** `window.animeData`, which is `undefined` on index.html.

Worse, script.js has **8 dual-source read sites with inconsistent precedence** — five
check `window.animeData` first, three (including `openAnimeFromId`, the primary
id→modal opener) check the bare const first — plus ~25 that read the bare const with
no fallback at all. A second array would have produced a **split-brain catalog**: the
grid showing 45 while the deep-link router showed 46. Half-working, and silent.

The fix is that the binding is const but the **array is not**. `catalogTopUp` mutates
the ONE array in place (`push` for new, `Object.assign` for edits), so every reader
agrees by identity. It then drops the three memoized maps (`_catalogBySlug`,
`_primaryIdToSlug`, `_watchedIds` — all memoized, all would keep answering from the
pre-merge array) and re-runs only the catalog-derived renders. `renderGrid`,
`buildSpotlight` and `buildGenreRails` were each checked for listener binding first:
none bind, so re-running is idempotent. None of it runs on a normal visit.

The generated file now also ships **its own schema**: `RAR_CATALOG_PUBLISHED_AT` (what
"since" means) and `RAR_CATALOG_FIELDS` (the exact emitted field list, from the same
`ALWAYS`/`OPTIONAL` the renderer uses), so the top-up copies a live doc by the same
names a rebuild would. Both sit before the `const animeData = [` marker, so
`splitAnimeDataFile` puts them in the header and the byte-exact round-trip is untouched.

## 2. Cover art fails loudly

- **`catalog-publish.js` gained a cover tripwire**, in the shrink tripwire's voice and
  honouring the same `--force`. A missing file **with** an `AniListCover` is a warning
  (the card renders correctly, just remotely); a missing file with **no** fallback
  refuses the publish.
- **`AniListCover` is stored at publish time** and appended LAST to `OPTIONAL` so no
  existing entry's bytes move.
- **Cards fall back in two steps** — local file → AniList cover → placeholder — via a
  `data-fallback` attribute and a `data-fb` latch that makes it loop-proof. This
  matters *because* of item 1: a review is live seconds after publishing, but its art
  is not deployed yet, and that is exactly when it is most likely to be looked at.
- **The Add Anime page now looks** instead of asserting: it probes `assets/<file>` and
  reports which of the three situations he is in.

## 3. A shared review shows the review

The cause was not a bad tag. The link was `/#anime=<slug>`, and **everything after a
`#` is never sent to the server** — Discord requested `/` and correctly got the
homepage's card. No tag edit can fix a fragment.

`/anime/<slug>` is now a real path: a hosting rewrite to a new `animePreview`
function that reads the catalog doc live (so a review published seconds ago already
previews) and returns per-anime `og:*` / `twitter:*` tags, then bounces humans into
the app. Crawlers do not run JS, so they keep the tags; `<noscript>` covers people
without it. An unknown slug returns the site card at **200, never a 404** — a stale
shared link should land someone on the site.

Card type is `summary`, not `summary_large_image`: an anime cover is a 2:3 portrait
and the large card letterboxes to 1.91:1, which would slice the top and bottom off
every cover. Blake asked for "the thumbnail", which is also the correct answer.

**The part that actually delivers it:** a **Copy share link** button on every review
modal. The address bar still shows `#anime=`, so without this he would keep pasting
the un-previewable form and nothing would have changed for him.

## Gates

| Suite | Result |
|---|---|
| `tests/v234-publish-once.spec.js` | **11 passed** (new) |
| `npm test` | see the gate-log line |
| rules 222 / cf 94 | `firestore.rules` unchanged. `functions/index.js` gained one HTTPS function; the cf suites do not cover it. |

⚠️ **Two test traps hit while writing this, both recorded in the spec:** the deep-link
route runs at LOAD ONLY (there is no `hashchange` listener), and `page.goto('/#x')`
from `/` is a SAME-DOCUMENT navigation that never reloads — so the route never fires
and the test fails while the app is fine. The spec forces a real load with a query param.

## Deploy order (NOT interchangeable)

1. `npm run deploy:functions` — the rewrite target must exist first.
2. `npx firebase deploy --only hosting`.

---

<!-- author: Code | date: 2026-08-29 -->
# SHIP-OUTPUT — v2.3.3: the review is on the site, and LATEST DROP means latest

**🚀 LIVE.** Deployed 2026-08-29 on Blake's go ("deploy it once the tests pass"), hosting
only — no rules changed. **Prod-verified in a real browser, not assumed:** the live
`animeData.js` carries 45 entries with the new review last; the cover returns 200 at
94,704 bytes and decodes 400×600; the live `pickFeaturedAnime()` body is the two-line
tail version; and the rendered LATEST DROP panel's accessibility tree reads
*I Made Friends with the Second Prettiest Girl in My Class* / *Class de 2-banme ni
Kawaii Onnanoko to Tomodachi ni Natta* / Comedy / Romance / 7.5/10. Clicking it opens
the modal at `#anime=i-made-friends-with-the-second-prettiest-girl-in-my-class` (the
shared-model slug, so the comment room is the right one) with all 2,631 characters of
the review, the studio and the platform.

⚠️ Note for whoever verifies next: the in-app browser pane returns a BLANK WHITE
screenshot of this site whenever the page is scrolled (the fixed background layers do
not composite into its capture). The page is fine — do not chase it. Verify through the
DOM / accessibility tree instead, as was done here.

## What Blake said

> "okay well I posted it but I don't see it on the website? and when it does I need it
> to show up on latest drop."

Two separate things, and both were real.

## 1. The review saved. The site had not been rebuilt.

His press of **Publish to catalog** worked — the v2.3.2 fix held. Confirmed read-only
against production before touching anything:

```
node scripts/catalog-publish.js --from=rest      # dry run
CATALOG: 45 entries
shrink tripwire: 22406 -> 24102 chars (+1696)
  · new entry: "I Made Friends with the Second Prettiest Girl in My Class"
```

The site does **not** read Firestore live — by design (cloud-migration study §3: static
publish, not live reads). It loads a generated `animeData.js`. So a saved review is
invisible until that file is regenerated and deployed. Nothing was broken; the second
half of the publish had not been run yet.

Done: `catalog-publish --from=rest --write` (45 entries, backup taken), cover art
fetched from AniList (id 169580) to
`assets/i-made-friends-with-the-second-prettiest-girl-in-my-class.png` — 400×600 PNG,
92KB, matching the other 44 covers exactly.

## 2. LATEST DROP was not showing the latest — for him

**This is the part he could not have known, and it would have wasted his evening.**
The publish alone would NOT have put the review in that slot for him.

`pickFeaturedAnime()` (`script.js`) had two behaviours:

| Who | What the slot showed |
|---|---|
| signed out | `animeData[animeData.length - 1]` — the newest review ✅ |
| **signed in** | most-recent **favorite** → watchlist → recent history → *then* newest ❌ |

v1.8.4 gate 4 personalized it. But the widget is labelled **"LATEST DROP 最新 / Now
Featuring"**, so for every signed-in member the label described something the slot was
not doing. Blake is signed in as admin, his most-recent favorite is Black Clover, and
that is exactly what his screenshot showed. A brand-new review could go up and never
appear in the one panel on the page that promises new things.

**Asked, not assumed.** He chose: always show the newest review, for everyone.
`pickFeaturedAnime()` is now unconditionally the catalog tail. The personalized picks
stay on the surfaces that are actually about the member — FOR YOU and Continue.

`animeData` is emitted sorted by the catalog `order` field and a new anime takes the
highest order, so the tail IS the newest review. Verified on the real file: entry 45 is
the new one.

## 3. Small tidy

`admin/catalog.html` said **"Import 44 anime"** on the one-time seed. It counted, so it
went stale the moment there were 45. It no longer names a number.

## The new test — `tests/v233-latest-drop-is-latest.spec.js` (4 tests)

⚠️ **One trap avoided, and worth recording.** The obvious test is "stuff
`window.favoritesSet` with a decoy and re-pick". That proves **nothing**: `favoritesSet`
is module-scoped (`script.js:229`) and never exported, so the mutation silently does
nothing and the assertion passes against the OLD code too — the same green-over-nothing
that hid the dead Publish button one version ago. The spec instead reads the **live**
function via `Function.prototype.toString()` (stronger than fetching the file, because
it is what is actually running) and asserts the body never names `favoritesSet`,
`watchlistSet`, `readContinue`, `currentUser` or `catalogBySlug`. It also asserts those
sets are genuinely unreachable, so nobody "improves" the test later into a fake one.
Verified against the pre-change function body: it contains those names, so this fails on
the old code.

Plus: the pick equals the tail, it does not drift across calls, and the rendered widget
shows the newest title with a real `assets/` cover.

## Gates

| Suite | Result |
|---|---|
| `npm test` | see the gate log line below |
| `npm run test:webkit` | 24 — floor |
| `npm run test:functions` | 94 — floor |
| rules 222 / cf 94 | **not run.** No `firestore.rules` and no `functions/` code changed. |

Checked and clean: **no test hard-codes a catalog count** (grepped for 44/45 and
`animeData.length` assertions), so growing to 45 breaks nothing.

---

<!-- author: Code | date: 2026-08-29 -->
# SHIP-OUTPUT — v2.3.2: the Publish button was dead

**🚀 LIVE.** Deployed 2026-08-29 on Blake's go-signal (hosting only — no rules changed). Prod-verified, not assumed: the live `/admin/new-anime` serves `APP_VERSION 2.3.2`, its kicker reads **ADD ANIME**, and the live `new-anime.js` contains `function validateBeforeGenerate`.

## What Blake said

> "When I go to publish a new review nothing happens."

He was pressing **Publish to catalog** on `/admin/new-anime` with the finished
*I Made Friends with the Second Prettiest Girl in My Class* review loaded, exactly as
the v2.3.1 handoff told him to. Nothing saved, nothing errored, nothing moved.

## The cause — one line, one missing name

`admin/new-anime.js:1125` called `validateBeforeGenerate()`. **v2.3.0 deleted that
function** along with the Mode 1 Excel pipeline and **left the call behind.** It is
the FIRST statement in the click handler, so every press threw

```
ReferenceError: validateBeforeGenerate is not defined
```

before `publishToCatalog()` ran and before the error box was ever touched. An
uncaught throw in a listener goes to the console and nowhere else. From the chair:
nothing happens. Exactly what he reported, and exactly what it was.

**It was NOT** the rules, the network, the slug, the auth gate, the model or the
cloud. The cloud path shipped in v2.3.0 is correct and was never reached.

## Why the v2.3.0 suite was green over it

`tests/v230-add-anime-cloud.spec.js` reads the button's **label**, asserts the Mode 1
DOM is gone, and asserts the page boots without errors. **It never clicks.** A dead
button passes all three at rest. That is the real lesson here, and the new test is
built around it.

## The fix

- **`validateBeforeGenerate()` restored** — but thinner than the original. The
  overlapping rules (Title/Rating/Genre/Description/Review/Tags/Platforms/Trailer/
  Top10Rank) now defer to `RarCatalogModel.validate`, so this page, the Cloud editor
  and the old sync cannot drift. Only what the model cannot see stays local: the
  AniList fetch, `Seasons`, `Studio`, and the image-filename override.
- **`collectCoreFields(M)` added** — ONE reader of the form. The pre-flight check and
  the write now read it identically; a field can no longer be validated in one shape
  and saved in another.
- **The page stopped calling itself MODE 1.** The kicker said `MODE 1 モード1` on the one
  page whose Mode 1 workflow was retired — the same stale label that misled him last
  time. Now `ADD ANIME 追加`. The cloud notice under it is unchanged.

## The new test — `tests/v232-publish-button-alive.spec.js` (3 tests)

Guards the **call graph**, not the label: it parses `new-anime.js` (blanking comments,
strings and regex literals so prose does not read as code), then asserts every helper
named inside the Publish click handler and inside `publishToCatalog()` is actually
declared in the file. **Verified against the pre-fix file: it reports
`validateBeforeGenerate` undeclared, so it would have caught this.** Plus: validation
goes through the shared model, and the MODE 1 label stays gone.

## Site-wide sweep — was anything else calling a deleted name?

The same parser was run over **every** `.js` on the site (root + `admin/`). After
discounting callback parameters, object methods, cross-file globals and the two
`typeof x === 'function'`-guarded optional hooks in `script.js`, **the Publish button
was the only real one.** Nothing else reaches for a name that is not there.

## Is the site itself in sync with the cloud?

Checked, read-only, against production over the public REST read:

```
node scripts/catalog-publish.js --from=rest      # dry run
CATALOG: 44 entries
body: identical to what is live
```

The shipped `animeData.js` **matches the cloud catalog exactly** — 44 entries, no
drift, no pending publish. Nothing is stale. The only thing missing from the site is
the new review, and that is missing because the button was dead.

## Gates

| Suite | Result |
|---|---|
| `npm test` | **418 passed**, 2 flake-class reds — both PASS isolated (`stats-admin` 360px, `v231` edit-slug). Total is 420 = the 417 floor + 3 new. |
| `npm run test:webkit` | **24 passed** — floor held |
| `npm run test:functions` | **94 passed** — floor held |
| rules 222 / cf 94 | **not run.** No `firestore.rules` and no `functions/` code changed — nothing in either suite's path was touched. Said plainly rather than claimed. |

## What is still true from before

Unchanged and still honest: Safari + DuckDuckGo sign-in (start from `?authcheck=1`,
do not guess a third hypothesis) · the ✨ASK drawer still wants `/api/chat`, the one
deliberate hold-out · the intermittent deep-link highlight, never reproduced · MODE 2
still banked, its seven decisions locked.

---

<!-- author: Code | date: 2026-08-29 -->
# SHIP-OUTPUT — v2.3.0 + v2.3.1: the admin side leaves the old desktop server

**🚀 BOTH ARE LIVE.** v2.3.0 shipped 2026-08-13 (hosting only), v2.3.1 on 2026-08-29 (rules **then** hosting). Prod-verified, not assumed.

## What started it

Blake sat down with a finished review — *I Made Friends with the Second Prettiest Girl in My Class* — and could not post it. His words: *"the website posting anime admin section thinks we need mode 1 to publish the excel role to update to the anime. We have moved onto the cloud."*

He was right, and it was worse than the stale banner he was looking at.

## What was actually wrong

**Adding an anime had been impossible since v2.0.1.** The Add page could only finish in two ways: hand the review to a desktop program running on one machine, or print a spreadsheet row to paste by hand. The cloud migration retired both — the catalogue in the database became the source of truth, and the spreadsheet became an export the site refuses to be rebuilt from. Nothing announced that. The page simply told him to start a program that no longer does anything, and the only button left produced a row for a file nobody reads. **He was the first person to try since the migration**, which is why it had sat undiscovered.

**Season reviews had never worked at all.** Not "broken recently" — never. The index shipped `count: 0` because writing one required that same machine. The site has always had zero season reviews and the reason was invisible.

**Editing a review and the door quotes** ended in the same dead end.

## What it does now

| Page | Was | Is |
|---|---|---|
| Add Anime | Mode 1 server / Excel row | writes `catalog/{animeId}` |
| Edit a Review | `PUT /api/anime/:slug` | writes `catalog/{animeId}` |
| Quotes | `PUT /api/quotes` | writes `siteContent/quotes` |
| Season Reviews | `/api/season-review` CRUD | `seasonReviews/{id}` + a `content/body` child |

All four work from any device. **No desktop program is involved anywhere on the admin side.**

Season reviews are split in two on purpose: a light record per season (id, title, rating) that the site lists to know which seasons carry a review, and the prose in a child fetched only when that season is opened. One cheap read however long the reviews get, and no index file to regenerate or drift out of date.

## The trap caught before it shipped

The Edit page carried its own name-maker that **strips apostrophes** — it had to, to match the old server's row lookup. Catalogue entries turn an apostrophe into a dash. For *An Archdemon's Dilemma* that is `an-archdemons-…` against the real `an-archdemon-s-…`.

That is a silent miss on **8 titles**, and that name is also the key every live comment thread hangs off. The id now comes from the one shared function, and the write refuses outright if the entry does not exist rather than quietly creating a duplicate.

## Security

Two new collections needed new rules. They were deployed **before** the site, deliberately, so there was never a window in which the new pages asked for something not yet permitted. Then proven against the live public API rather than trusted:

- season reviews readable → **200** (the site needs it)
- quotes cannot be enumerated → **403**
- member data → **403**, unchanged

Four new rules tests cover the hostile paths. Rules floor **218 → 222**.

## What Blake should do

1. **Admin → Add Anime.** The Studio draft pre-fills it. Press **Publish to catalog**.
2. Tell Code. The site is built from a generated file, so a rebuild + deploy is what makes it public — including fetching the cover art.
3. **Season Reviews** is worth a look: it has never been usable before.

## Test floors

| track | floor | result |
|---|---|---|
| `npm test` | **417** | 416 pass + 1 known flake, green isolated |
| `test:rules` | 218 → **222** | **222 pass** |
| `test:webkit` | 24 | 24 pass |
| `test:functions` | 94 | not affected |
| `test:cf` | 94 | not affected |

## Still open, honestly labelled

- **The ✨ASK drawer still calls `/api/chat`.** It genuinely needs a server holding a key, so it is the one deliberate hold-out. **Not claimed as done.**
- **Safari and DuckDuckGo still will not sign Blake in on his phone.** Two hypotheses have already failed. `?authcheck=1` exists so the third attempt starts from facts, not another guess.
- The intermittent review-deep-link highlight report has never been reproduced.
- **Mode 2 is the only banked item left.** Seven decisions locked 2026-08-09; Blake wants to clarify things first.

## One-liner reply
Adding an anime had been impossible since the cloud migration and season reviews had never worked at all — the whole admin side now writes to the cloud, from any device, with no desktop program involved.
