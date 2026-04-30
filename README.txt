REAL ANIME REVIEWS — PROJECT README (CURRENT)
Version: 1.x (Firebase + Firestore + Custom Domain live)

Live URLs
- Production: https://realanimereviews.com
- Firebase default: https://real-anime-reviews.web.app

What this site is
- A static (no framework) anime review site: HTML/CSS/vanilla JS.
- You (Blake) publish “official” anime ratings/reviews via animeData.js.
- Users can sign in, favorite/watchlist anime, post comments, post 1 community review per anime, discuss under reviews (threads), and vote (like/dislike) on content.
- Firebase is used for: Auth, Firestore (data), Storage (avatars), Hosting (deployment), + custom domain.

How this project is worked on (IMPORTANT workflow)
- We do “surgical edits” only:
  1) Identify the exact file
  2) Search for an exact anchor line/string
  3) Paste a specific block ABOVE/BELOW that anchor OR replace a specific section
  4) Test locally, then preview deploy, then production deploy
- No “rewrite everything” unless absolutely necessary.
- If moving to another GPT: give it the latest project folder/zip AND this README. Tell it to never assume file contents.

------------------------------------------------------------
FILE / FOLDER STRUCTURE (CORE)
- index.html        → main page UI (header, cards, modal, comments, official review, etc.)
- account.html      → account page UI (profile, favorites, watchlist, activity, notifications)
- style.css         → all styling (layout, cards, modal, activity panel, notification panel, etc.)
- animeData.js      → the “official” anime database (your reviews, tags, images, trailer links)
- script.js         → main app logic for index.html (render cards/modals, filters/search, comments/reviews, votes)
- account.js        → account page logic (profile, activity feed, notifications UI, favorites/watchlist listing)
- firebase.js       → Firebase init + exports (auth/db/storage + helpers)
- assets/           → images (card art, backgrounds, icons, preview image, etc.)
- 404.html          → hosting fallback page
- firebase.json     → Firebase Hosting config (public dir, ignores, redirects/rewrites if any)
- .firebaserc       → Firebase project mapping (project id: real-anime-reviews)
- README.txt        → this file

Local dev tool
- VS Code + Live Server (or any static server).
- IMPORTANT: Firebase Auth “Authorized domains” must include:
  - localhost
  - 127.0.0.1
  - realanimereviews.com
  - real-anime-reviews.web.app

------------------------------------------------------------
DATA SOURCES (2 TYPES)

A) OFFICIAL DATA (your content)
- Stored in animeData.js.
- This is what generates the cards and the “official” modal content (your rating + your review text).
- Image paths must match assets/ filenames exactly.

B) USER-GENERATED DATA (Firestore)
Stored in Cloud Firestore. Main paths used:

1) User Profiles + Lists
- /users/{uid}                       (profile doc)
- /users/{uid}/favorites/{animeId}   (favorite docs)
- /users/{uid}/watchlist/{animeId}   (watchlist docs)
- /users/{uid}/notifications/{notifId} (notifications)

2) Comments (under the official anime modal)
- /comments/{animeId}/items/{commentId}
- /comments/{animeId}/items/{commentId}/votes/{voterUid}

3) Community Reviews (1 per user per anime)
- /reviews/{animeId}/items/{uid}   (doc id == reviewer uid)
- /reviews/{animeId}/items/{uid}/votes/{voterUid}

4) Review Discussion Threads (comments under a community review)
- /reviews/{animeId}/items/{uid}/threads/{tid}
- /reviews/{animeId}/items/{uid}/threads/{tid}/votes/{voterUid}

5) OFFICIAL REVIEW VOTES (Agree with my Rating?)
- /official/{animeId}                    (aggregate doc: likesCount, dislikesCount)
- /official/{animeId}/votes/{voterUid}   (each user’s vote: value = 1 or -1)

Notes
- Official votes do NOT create notifications and do NOT appear in user activity (by design).
- Activity feed uses collection-group reads on:
  - items (community reviews)
  - threads (review discussion threads)

------------------------------------------------------------
FIREBASE SETUP (WHAT’S ENABLED)
- Firebase Authentication: sign-in system for users.
- Firestore Database: stores all user content (comments/reviews/votes/notifications/etc.)
- Firebase Storage: user avatars (photoURL), if enabled in code.
- Firebase Hosting: deploys the static site.
- Custom domain: realanimereviews.com mapped to Firebase Hosting.

App Hosting vs Hosting
- Use Firebase “Hosting” (NOT “App Hosting”) because this is a static vanilla site.
- App Hosting is for full-stack SSR frameworks (Next.js/Angular/etc.). Not needed here.

------------------------------------------------------------
FIRESTORE RULES + INDEXES (REALITY CHECK)

Rules
- Rules live in Firebase Console → Firestore Database → Rules.
- The project has custom rules that:
  - lock down user subcollections to their owner
  - allow public reads for comments/reviews (so everyone can see them)
  - allow signed-in users to create their own content
  - allow vote count updates safely (likesCount/dislikesCount >= 0)
  - allow vote docs under /votes/ only by the voter
  - allow activity collection-group reads only for the signed-in user (uid match)
  - allow official votes under /official/{animeId} (aggregate + per-user vote docs)

Indexes (IMPORTANT)
- If console says “query requires an index”, CLICK the provided link.
- You already created collection group indexes for activity feed:
  - Collection ID: items (collection group)
  - Collection ID: threads (collection group)
  - Typical fields: uid + createdAt + __name__ (Firebase auto-suggests exact combo)
- If activity feed breaks, it’s almost always:
  1) missing index, OR
  2) rules deny reading that collection group, OR
  3) the queried docs don’t have uid/createdAt the way the query expects.

------------------------------------------------------------
NOTIFICATIONS SYSTEM (AND LIMITS)

What notifications are
- Stored per user at: /users/{uid}/notifications/{notifId}
- They are generated when OTHER users like/dislike your comment or your community review (depending on your logic).
- Official review votes should NOT generate notifications.

How to prevent infinite growth
There are two “limits” you can enforce:

1) UI limit (always do this)
- The notifications panel should have a fixed max height, show ~3–4 items, and scroll.
- The UI should only render the newest N (ex: 15).

2) Database pruning (recommended)
- Keep only newest 15 notification docs and delete older ones.
- If you want this guaranteed, the “correct” way is a Cloud Function trigger.
- If you don’t want backend functions, you can do client-side cleanup:
  - On login OR when opening notifications:
    - query notifications ordered by createdAt desc
    - keep first 15
    - delete the rest
  - This is “good enough” for small scale.

My Activity feed limit
- Same idea: render only newest 15 activity items, so users don’t scroll forever.
- You can ALSO prune old activity items, but usually activity is derived from actual content (reviews/threads), so pruning is optional.

------------------------------------------------------------
LOCAL TESTING (SAFE CHECKLIST)

Before deploying ANY change:
1) Run locally with Live Server.
2) Test these flows:
   - open index, render cards
   - open modal for anime
   - comments: post/edit/delete
   - comment vote works + counts update
   - community review: create/edit/delete (1 per anime per user)
   - discussion thread: post/edit/delete
   - thread vote works + counts update
   - official rating vote works (Agree with my Rating?)
   - account page loads:
     - profile shows correct user
     - favorites/watchlist show correctly
     - my activity loads (no permission/index errors)
     - notifications panel opens, scrolls, shows newest first
3) Check console for:
   - “Missing or insufficient permissions” (rules)
   - “query requires an index” (index)
   - 404 asset errors (wrong file path)

------------------------------------------------------------
DEPLOYMENT (HOW YOU UPDATE THE LIVE SITE)

You already have Firebase CLI working.
You deploy from the project folder that contains firebase.json.

A) Fast production deploy (updates site for everyone)
1) Open terminal at your project root
2) Run:
   firebase deploy --only hosting

B) SAFE testing before production: Preview Channels (DO THIS for risky changes)
1) Deploy a preview URL:
   firebase hosting:channel:deploy test-1
   (it prints a preview URL)
2) Open that preview URL and test everything.
3) If it’s good, deploy to production:
   firebase deploy --only hosting

Notes
- Preview channels are temporary “staging links.”
- You can make multiple: test-ui, test-firestore, etc.
- If something breaks in production:
  - Firebase Console → Hosting → Releases → “Roll back” to a previous release.

------------------------------------------------------------
CUSTOM DOMAIN (WHAT HAPPENED + HOW IT WORKS)

You bought:
- realanimereviews.com (Namecheap)

Firebase Hosting needs proof you own the domain + DNS pointing.
That’s why Firebase showed DNS records.

DNS records = “phonebook entries” that tell the internet where your domain should go.

Common records used here:
- A record: points a domain to an IP address
- CNAME record: points a subdomain (like www) to another hostname
- TXT record: a verification text entry (Firebase uses this to confirm ownership)

What you did in Namecheap → Advanced DNS:
1) A Record
   - Host: @
   - Value: (Firebase gave you an IP — commonly 199.36.158.100 for Firebase Hosting)
2) CNAME Record
   - Host: www
   - Value: ghs.googlehosted.com
3) TXT Record
   - Host: @
   - Value: (Firebase gave you something like hosting-site=real-anime-reviews)

Then in Firebase Console → Hosting → Custom domains:
- you clicked Verify, Firebase checked the TXT record, then linked the domain.
- DNS can take minutes up to ~24 hours to fully propagate.
- VPN does NOT break DNS setup. It can sometimes confuse your own caching while testing, but it doesn’t change your records.

------------------------------------------------------------
DISCORD / SOCIAL PREVIEW (so your link doesn’t look sketchy)

Discord builds link previews from “Open Graph” meta tags in <head> of your page.

Add these to index.html inside <head> (example — update values to your site):

<meta property="og:title" content="Real Anime Reviews" />
<meta property="og:description" content="Real ratings from a normal guy. Browse reviews, comments, and community takes." />
<meta property="og:url" content="https://realanimereviews.com/" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://realanimereviews.com/assets/preview.png" />
<meta property="og:site_name" content="Real Anime Reviews" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Real Anime Reviews" />
<meta name="twitter:description" content="Real ratings from a normal guy." />
<meta name="twitter:image" content="https://realanimereviews.com/assets/preview.png" />

Important rules for the preview image:
- Must be publicly accessible (https)
- Best size: 1200x630 (or similar)
- Put it in /assets/preview.png and deploy

Discord cache tip:
- Discord caches previews hard. If it won’t update, paste:
  https://realanimereviews.com/?v=2
  (a new query string forces refresh)

------------------------------------------------------------
ADDING / EDITING ANIME (OFFICIAL CONTENT)

Add a new anime:
1) Add its image to /assets/
2) Add an entry in animeData.js:
   - Title, Genre, Rating, Seasons, Studio, Tags, Platforms, Description, Review, image, trailer url (if used)
3) Refresh locally and confirm the card + modal renders.

Do NOT:
- rename asset files without updating animeData.js
- mismatch image filenames (case-sensitive on hosting)

------------------------------------------------------------
COMMON FAILURES + WHAT THEY MEAN

“Missing or insufficient permissions”
- Your Firestore rules blocked the read/write.
- Fix: adjust rules OR confirm your code writes exactly the fields rules require.

“The query requires an index”
- You need a Firestore composite index.
- Fix: click the link in console error → create index → wait until “Enabled”.

Things appear “instantly” under a new review
- Usually you are re-using the same review doc path (reviews/{animeId}/items/{uid}) and your threads are still under that same review doc path.
- If you delete and recreate the review with the same uid (same doc id), the threads subcollection can still exist unless your delete code also deletes subcollections.
- Firestore does NOT automatically delete subcollections when deleting a parent doc in client code.
- If you truly want threads wiped when deleting a review:
  - you must explicitly delete the threads subcollection docs too, OR use a backend function.

------------------------------------------------------------
HANDOFF NOTES FOR ANOTHER GPT (so it can pick up fast)

When you move this project to another GPT:
- Give it:
  - your full latest project folder/zip
  - your current Firestore rules (copy/paste)
  - screenshots of Firestore indexes if needed
  - the current live URL
- Tell it:
  - do surgical edits only (file + exact anchor + paste block)
  - never guess “where to put it” — always specify the exact location by search string
  - preserve the current data model paths exactly (comments/reviews/threads/official/notifications)
  - official votes do NOT trigger notifications or activity
  - activity feed uses collection-group queries and needs indexes

------------------------------------------------------------
QUICK COMMANDS (THE ONLY ONES YOU REALLY NEED)

Production deploy:
- firebase deploy --only hosting

Preview deploy:
- firebase hosting:channel:deploy test-1

See what project you’re on:
- firebase projects:list

(You’re already logged in as: godzillagamerplace@gmail.com)

------------------------------------------------------------
NEXT OPTIONAL IMPROVEMENTS (if you want “polish” after launch)
- Add a proper favicon + apple touch icons
- Add a nicer /assets/preview.png for Discord previews
- Add a basic privacy note (because accounts + content)
- Add Cloud Function pruning for notifications if you expect big scale
- Add Cloud Function deletes for cascading deletes (reviews → threads cleanup)


Version naming 

Use SemVer: MAJOR.MINOR.PATCH

Example: v1.0.1

1 = MAJOR: big milestone / structural shift (new major feature era)

0 = MINOR: feature set count inside v2 (new features that don’t “break” the site)

1 = PATCH: small fixes / tiny changes (typos, UI tweaks, bug fixes)

So in practice for you:

v1.0.1 = “first tiny patch after the v1 launch”

v1.1.0 = “new feature drop”

v1.1.1 = “bugfix after that feature drop”

END README












FIXES:
* ADDED FEATURED ANIME IN MAIN PAGE


*FUTURE ADDITIONS:
Ability to tag users in comments/discussions to prompt a conversation and for the tagged user to get an notification update that they have been tagged in something

Create a "Most Community Favorited Anime" List on the main page that showcases the most favorited anime by community users in some fancy way 

Ability to change genre with a "switch genre" arrow or something by the genre description on the main page 

Add a "Find a random anime" notification to the left on the search bar. 

Add more detailed reviews to the lackluster reviews 

Add a suggestion box near the bottom (right of bio) for specific anime reviews, bugs, inaccurate information, etc 

Figure out a way to address update changes etc: Is version 1.00.00 or how we will name them? what's a way to standardize fixes versus actual additions or do we need to have different number jumps from fixes, additions, or added anime cards. Pretty much standardizing the overall update system. 

Fix The index.html bug in web browser search and account/html stuff (might not be a bug since its actually the page in VS)

Fix when comments are deleted the notification for a user that that comment was liked should be deleted as well

Possibly fix search bar not finding the right titles / might keep since it unintendedly searches for genres and tags  

Fix when comments are deleted the notification bell doesn't continue notifying the user their comment/discussion post was liked











FUTURE ROADMAP:

roadmap + Versioning (for next GPT)
Current state (as of latest)

Site is live on Firebase Hosting (static site) and deployed from the project folder where index.html lives.

Firebase project id: real-anime-reviews (see .firebaserc).

Hosting config currently minimal in firebase.json (public: ".").

Custom domain is owned + connected: realanimereviews.com.

Staging/preview is done with Firebase Hosting preview channels:

Command: firebase hosting:channel:deploy <channel-name>

Produces a URL like: https://real-anime-reviews--<channel>.web.app

Local testing: VS Code + Live Server (fast UI checks).
Staging testing: preview channel (real Firebase environment).

Decisions / answers you MUST know

Community Top 5 Favorites panel

We chose the recommended approach (aggregate counts), not “scan every user’s favorites”.

This does not change the UI except adding the new widget. The aggregation work happens in the backend (Cloud Function and/or controlled writes).

Goal: reliably compute “Top 5 most favorited anime” from heart icon favorites.

@mentions autocomplete privacy

Usernames should be searchable ONLY by signed-in users (not public).

Admin identity (for admin-only features like suggestions viewer)

Admin UID: G2jGRa14u8bzGAmeBTkvXy8PKmr1

Any “admin-only viewer” checks should key off this UID (or a future users/{uid}.role == "admin" field if we add it later).

Planned Releases (Slow + Safe)
v1.0.1 (PATCH) — “Looks official”

Goal: make the site look legit when shared + remove ugly URLs.

Fix URL weirdness so it’s clean:

Use Hosting config to support / instead of /index.html

Use Hosting config to support /account instead of /account.html

Add redirects so old links still work

Add Discord/Twitter-friendly previews:

OpenGraph + Twitter meta tags on index.html and account.html

Canonical links

Ensure og:image points to a stable hosted image (in /assets/)

This update is mostly config + <head> tags (low risk).

v1.0.2 (PATCH) — “Content corrections only”

Goal: no new features, just polish.

Misspellings, inaccurate platforms/tags/ratings

Tiny CSS tweaks only (safe / minimal)

v1.1.0 (MINOR) — Community Top 5 Favorites panel

Goal: add a new community widget (different look than the other panels).

Display top 5 most favorited anime (global)

Requires aggregate favorite counts (recommended approach)

Must be visually clean + match purple theme (not repetitive)

v1.2.0 (MINOR) — Random anime button

Goal: Dice button opens a truly random anime modal

Must be genuinely random across all anime

Keep styling consistent (dice icon + “Random”)

v1.3.0 (MINOR) — “Anime by Genre” shuffle control

Goal: shuffle the displayed genres WITHOUT page refresh

Clean button near the “Anime by Genre” header

Only affects that section

v1.4.0 (MINOR) — Suggestion box + admin-only viewer

Goal: anyone can submit suggestions, only admin can view.

Submit options:

Specific Anime Request

Website Addition

Inaccurate Information in a Card

Report a bug

Tell Blake how awesome he is

Other

Submissions allowed signed-in OR not

Admin-only viewer visible only to admin UID (above)

v1.5.0 (MINOR) — @mentions

Goal: type @name → autocomplete → tag user → notification

Search/autocomplete list only available to signed-in users

Tagged user gets notification type like mention

v1.5.1 (PATCH) — Notification cleanup (backend)

Goal: remove stale notifications when target content is deleted

If a comment/review/thread is deleted, delete notifications referencing it

Best implemented with a Cloud Function triggered on deletes

Safe deployment workflow (do this every update)

Local test (fast)

Run Live Server

Click through: login/logout, favorites, watchlist, modals, community tab, notifications, voting

Preview channel test (real staging)

In project folder terminal:

firebase hosting:channel:deploy vX-Y-Z

Open the generated preview URL and re-test (especially auth + firestore writes)

Production deploy

Only after preview looks correct:

firebase deploy --only hosting

Rollback strategy

Keep a known-good local zip backup before each change

If prod breaks: redeploy the last known-good commit/folder state
















