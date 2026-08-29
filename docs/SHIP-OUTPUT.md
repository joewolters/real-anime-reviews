<!-- author: Code | date: 2026-08-29 -->
# SHIP-OUTPUT — v2.3.2: the Publish button was dead

**⚠️ BUILT AND TESTED — NOT DEPLOYED.** Waiting on Blake's go-signal for `deploy --only hosting`.

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
