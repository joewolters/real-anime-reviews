# Deployment

How to take changes from your laptop to https://realanimereviews.com — safely.

## The deploy ladder

Three stages, in order. Skipping stages saves time but eats reliability.

```
local dev → preview channel → production
```

- **Local dev** — instant feedback, no Firebase deploy
- **Preview channel** — real Firebase environment, real auth + Firestore, isolated URL only people with the link can see
- **Production** — visible to everyone at `realanimereviews.com`

For anything more than a typo fix, run all three.

---

## Local dev (VS Code + Live Server)

1. Open `Current Version/` in VS Code
2. Install the Live Server extension (Ritwick Dey)
3. Right-click `index.html` → **Open with Live Server**

The site runs at `http://127.0.0.1:5500/index.html`.

**Important:** Firebase Auth requires the local dev origin to be in the Authorized Domains list, or sign-in silently fails. The full list lives in `PERSONAL.md` — `localhost` and `127.0.0.1` are both there, so sign-in works locally out of the box.

**What to test locally before any deploy:**

- Cards render, search and filter work, modals open and close
- Sign in / sign out
- Favorite + watchlist icons toggle and persist on reload
- Comments — post / edit / delete / vote
- Community review — create / edit / delete (one per anime per user)
- Discussion threads under a review — post / vote
- Official rating votes ("Agree with my Rating?")
- Account page — profile, favorites/watchlist list, activity feed, notifications
- Browser console clean (no permission errors, no 404s)

---

## Preview channels (staging URLs)

Preview channels deploy local changes to a temporary Firebase URL that only people with the link can see. Same Firestore project as production, so user data and rules behave identically — you're testing the actual deployed runtime, not a mock.

**Deploy to a preview channel:**

```bash
firebase hosting:channel:deploy <channel-name>
```

Example:

```bash
firebase hosting:channel:deploy v1-4-0-test
```

The CLI prints a URL like:

```
https://real-anime-reviews--v1-4-0-test-XXXXXXXX.web.app
```

That URL has a default 7-day TTL. Open it, walk through the local-test checklist above, and only proceed to production if everything passes.

**Manage existing channels:**

```bash
firebase hosting:channel:list           # show all channels
firebase hosting:channel:open <name>    # open a channel URL in browser
firebase hosting:channel:delete <name>  # delete one
```

**Channel-naming convention:**

- Use kebab-case (`v1-4-0-test`, `auth-fix`, `ui-only`) to be safe — some special characters can cause issues.
- One channel per logical change. Don't reuse channels across unrelated tests — Firebase caches headers per channel.

---

## Production deploy

**One command, from `Current Version/`:**

```bash
firebase deploy --only hosting
```

This:

1. Uploads everything in the public dir (defined by `firebase.json`)
2. Atomically swaps the live release at `realanimereviews.com` and `real-anime-reviews.web.app`
3. Prints a "Hosting URL" line confirming the swap

CDN propagation is usually under a minute. Hard-refresh in incognito (Ctrl+Shift+R) to bypass your local cache when verifying.

**Confirm the right Firebase project before deploying:**

```bash
firebase projects:list      # all projects you have access to
firebase use                # which project is currently active
```

The active project should be `real-anime-reviews`. The CLI account that should be logged in is documented in `PERSONAL.md`; verify with:

```bash
firebase login:list
```

If the active project or account looks wrong, **stop and fix before deploying** — `firebase deploy` is irreversible from the CLI side (you would need a rollback, see below).

---

<!-- author: Code | date: 2026-06-06 -->
## Cloud Functions (v1.9.0+) — the first server surface

Before v1.9.0 this project was static hosting only. v1.9.0 introduces **Cloud Functions** (gen-2, in `functions/`). They are a **separate deploy surface** from hosting and have their own rules.

### ⚠️ Two separate deploy verbs — never mix them
```bash
firebase deploy --only hosting     # the static site (unchanged — this is the routine deploy)
firebase deploy --only functions   # the Cloud Functions  (npm run deploy:functions)
```
**NEVER run a bare `firebase deploy` once functions exist** — it would redeploy functions on every routine static change (slow, and it can disturb live functions). Hosting and functions ship independently. `functions/**` is in the hosting `ignore` array, so server code never lands on the public static site (the `.gitignore`↔`firebase.json` mirror rule, applied to a new dir).

### ⚠️ Blaze plan is required — and the upgrade is BLAKE's billing action
Cloud Functions do not run on the free Spark plan. The first `firebase deploy --only functions` will fail until the project is on **Blaze (pay-as-you-go)**. For a single-curator site the real cost is realistically a few cents to a couple dollars a month — the danger isn't the baseline, it's a runaway bug/loop. So we arm guardrails first.

**Blaze upgrade (Blake does this in the console — Code cannot and must not):**
1. Open the [Firebase Console](https://console.firebase.google.com/) and select the **real-anime-reviews** project.
2. Bottom-left of the sidebar, click the plan badge (**"Spark / Upgrade"**).
3. Choose **Blaze (Pay as you go)** → **Continue**.
4. Select or create a **Cloud Billing account** (a card is required; Google's free monthly allotment still applies before any charge).
5. When prompted, **set a budget** (next step) and **Confirm**.

**Budget alert (do this in the same flow, or anytime after):**
1. The Blaze upgrade screen offers "Set a budget" — set, e.g., **$5/month**. (Or later: GCP Console → **Billing → Budgets & alerts → Create budget**, scope to the project.)
2. Set alert thresholds at **50% / 90% / 100%**.
3. Confirm the alert emails go to Blake's address.
> A budget alert does **not** cap spend — it emails a warning. The hard cap is `maxInstances` in code (below). Use both.

### Billing guardrail in code
`functions/index.js` sets a global `maxInstances` cap via `setGlobalOptions({ maxInstances: 10 })`, so no function — including a future buggy or loop-triggered one — can scale to the Blaze ceiling. Tune per-function as real functions land. Also: no trigger may write to a path it watches (self-retrigger loop), and counter/fan-out functions dedupe on `context.eventId` (see `docs/DATA-MODEL.md`).

### Local development + tests
```bash
cd functions && npm install        # one-time: installs firebase-admin + firebase-functions
npm run test:functions             # pure-logic CF unit tests (node --test) — no emulator, no Java
npm run emulators                  # firebase emulators:start --only functions,firestore,auth
```
- **`npm run test:functions`** is the fast unit layer (most CF bug surface). It needs no emulator.
- **The full emulator suite needs a JDK 21+ installed** — the Firestore + Auth emulators are Java processes, and current `firebase-tools` **requires Java 21 or newer** (it rejects Java < 21). The **functions-only** emulator (`firebase emulators:exec --only functions …`) is Node-only and runs without Java (that's how `ping` was verified at gate P1). If `npm run emulators` / `npm run test:rules` errors with a Java-version message, install a JDK 21+ (e.g., Eclipse Temurin 21) and retry.
- **`npm run test:rules`** runs the `firestore.rules` security tests in the Firestore emulator (`@firebase/rules-unit-testing`). Needs Java 21+. This is how rule changes are verified before the cutover deploy.
- Keep `npm test` (Playwright/DOM) and `npm run test:functions` (server) separate — a CSS change must never force an emulator boot.

### The `ping` health-check
`functions/index.js` ships a no-op `ping` function whose only job is to prove the deploy path end-to-end. After Blaze is enabled: `npm run deploy:functions`, then open the printed `…/ping` URL (or curl it) and confirm `{"message":"pong",…}`.

---

## Custom domain (Namecheap → Firebase)

`realanimereviews.com` is registered at Namecheap. DNS records point at Firebase Hosting; Firebase verifies ownership via a TXT record, then provisions SSL automatically.

**Three DNS records configured at Namecheap → Advanced DNS:**

| Type | Host | Purpose |
|---|---|---|
| A | `@` | Apex domain → Firebase Hosting IP |
| CNAME | `www` | `www` subdomain → Firebase |
| TXT | `@` | Firebase domain ownership verification |

**Actual values live in `PERSONAL.md`** — they are per-Firebase-project and there is no reason to publish them.

After DNS records are in place, in **Firebase Console → Hosting → Custom domains**, click Verify. Firebase reads the TXT record, confirms ownership, then provisions SSL automatically. DNS propagation takes minutes to ~24 hours; SSL cert provisioning typically completes within an hour after verification.

**If `realanimereviews.com` ever stops resolving:**

1. Check Namecheap → Advanced DNS — confirm all 3 records are still present and unchanged
2. `https://real-anime-reviews.web.app` should always work (Firebase default URL, doesn't depend on Namecheap)
3. If only the custom domain is broken, the issue is DNS or registrar-side, not Firebase

---

## Social previews (Open Graph + Twitter Card)

Discord, Slack, iMessage, Twitter, etc. all read Open Graph and Twitter Card meta tags from the page `<head>` to build link previews. Without them, your link looks sketchy.

**Currently set in `index.html` and `account.html`:**

```html
<meta property="og:title" content="Real Anime Reviews">
<meta property="og:description" content="...">
<meta property="og:url" content="https://realanimereviews.com/">
<meta property="og:type" content="website">
<meta property="og:image" content="https://realanimereviews.com/assets/preview.jpg">
<meta property="og:site_name" content="Real Anime Reviews">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Real Anime Reviews">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="https://realanimereviews.com/assets/preview.jpg">
```

**Preview image requirements:**

- Lives at `/assets/preview.jpg` (publicly accessible from the deployed site)
- Recommended size: 1200×630 pixels
- The actual deployed file is `preview.jpg` — older internal docs reference `preview.png`, that was wrong

**Force a Discord preview refresh** (Discord caches link previews aggressively):

Append a unique query string to the URL once:

```
https://realanimereviews.com/?v=2
```

Discord treats it as a new URL and re-fetches the OG tags.

---

## Rollback strategy

Two paths if production breaks.

### Path 1 — Firebase Console (fastest)

**Firebase Console → Hosting → Releases → Roll back** to the most recent known-good release. Sub-minute. No CLI required.

### Path 2 — Git revert + redeploy

If the bad change was a commit you have already pushed:

```bash
git log --oneline -10                        # find the last good commit hash
git checkout <good-commit-hash>              # detach HEAD to that snapshot
firebase deploy --only hosting               # deploy that older state
git checkout main                            # back to your branch
```

Then make a new commit on `main` that fixes the issue properly.

**What you DO NOT do:** force-push or rewrite history on `main`. The bad commit stays in history as evidence of what happened — fix it forward.

---

## Common deploy failures and fixes

### "Missing or insufficient permissions" in browser console

Firestore rules blocked a read or write the new code is making. Either:

- Adjust the rules in Firebase Console → Firestore Database → Rules
- Or fix the code to write the exact fields the rules require

### "The query requires an index"

Firestore needs a composite index for the query. The error message in the browser console contains a clickable link — click it and accept the auto-suggested index. Then wait until the index status shows "Enabled" (a few seconds to a few minutes). For the indexes this project requires, see [ARCHITECTURE.md § Required composite indexes](ARCHITECTURE.md#5-required-composite-indexes).

### Deploy succeeds but the live site looks unchanged

Browser cache. Hard-refresh in incognito. If still wrong, check the Hosting → Releases panel — the deploy may have gone to a different Firebase project.

### `firebase: command not found`

Firebase CLI is not installed or is not on PATH. Install with:

```bash
npm install -g firebase-tools
```

Then re-open the terminal.