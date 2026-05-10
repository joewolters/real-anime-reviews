# Real Anime Reviews

> A real working site for strangers looking for anime recommendations from an actual normal person.

**Live at:** [realanimereviews.com](https://realanimereviews.com) &nbsp;·&nbsp; **Firebase fallback:** [real-anime-reviews.web.app](https://real-anime-reviews.web.app)

## What this is

A static anime review site I built as a pet project. I rate every anime I watch and write up my real take on it — no professional reviewer voice, just what I actually thought. People can sign in to favorite, watchlist, comment, post their own community reviews, and vote on stuff. If you're tired of clickbait listicles and want a friend's honest opinion on whether to watch something, that's the goal.

## Tech stack

Vanilla HTML, CSS, and JavaScript — no framework. Firebase handles the backend: Auth for sign-in, Firestore for user-generated content (comments, reviews, votes, notifications), Storage for avatar uploads, and Hosting for the deploy. The custom domain points at Firebase Hosting via Namecheap DNS. Everything ships as a static site, deployed with the Firebase CLI.

## Project structure

```
Current Version/
├── index.html          Main page — cards, modal, comments, community reviews
├── account.html        Account page — profile, favorites/watchlist, activity, notifications
├── 404.html            Hosting fallback
├── style.css           Desktop styles
├── mobile.css          Mobile overrides (≤ 900px)
├── animeData.js        Anime database — every entry I've reviewed
├── script.js           Main page logic (cards, search, filters, comments, voting)
├── account.js          Account page logic
├── firebase.js         Firebase init + exports
├── firebase.json       Firebase Hosting config
├── .firebaserc         Firebase project mapping
├── assets/             Anime cover art + icons
├── UpdateLog/          Working notes
├── README.md           This file
├── CHANGELOG.md        Version history, newest first
├── ROADMAP.md          What's planned + big-vision ideas
├── PERSONAL.md         Local-only secrets (gitignored — never committed)
└── docs/
    ├── ARCHITECTURE.md  Code structure, Firestore schema, data flow
    └── DEPLOYMENT.md    Local dev, preview channels, production deploy, DNS
```

## Quick start (local dev)

```
git clone https://github.com/joewolters/real-anime-reviews.git
cd "real-anime-reviews"
```

Then open the folder in VS Code, right-click `index.html` → **Open with Live Server** (extension required). The site runs at `http://127.0.0.1:5500/index.html`.

For sign-in to work locally, `localhost` and `127.0.0.1` need to be in Firebase Auth's authorized domains list. They are — verified. Full list lives in `PERSONAL.md`.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for preview channels and production deploys.

## About me

Hey people, I'm Blake and this has been a pet project of mine for a couple months now and I'm super happy that it's finally out. This originally started off as a place where I would "just leave my reviews" for my friends and family to look at so they know which anime they should keep an eye on. As you can see it quickly grew out of hand and before I knew it, I was praying for ChatGPT to practically vibe code the entire website for me. All that aside I'm SUPER happy with how this turned out. If any information is wrong feel free to reach out to me via Instagram. I plan to continue updating this little site and I hope to see y'all around.

## Design philosophy

The site's visual identity is intentionally inspired by *Call of the Night*. The deep navy-purple night sky over the silhouetted city skyline, the scattered window glow through the dark buildings, the cool mood with warm accent pops — that's the show's atmosphere translated into a website. The illuminated panels (Update Log, Top 10, Latest Drop) are meant to feel like apartment windows in the cityscape, glowing against the dark backdrop.

When making design decisions, the guiding question is: *would this fit in Call of the Night?* If no, it's probably not the right move for this site.

## Credits

A big thank you to Jax and Jayce — my little cousins who I enslaved for a lil bit.

## Contact

- Instagram: [@wolters.blake](https://www.instagram.com/wolters.blake)

## More docs

- **[CHANGELOG.md](CHANGELOG.md)** — what shipped in each version
- **[ROADMAP.md](ROADMAP.md)** — what's coming next, plus big-vision ideas
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the code is organized
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — local dev → preview → production