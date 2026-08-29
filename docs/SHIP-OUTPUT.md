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
