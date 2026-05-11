<!-- author: Code | date: 2026-05-10 -->
# Mode 1 Baseline Design (v1.6.0 + v1.6.1)

> Architecture for the admin "Add New Anime" form and the local "Submit & Ship" server. Phase B begins here.

---

## 1 · The user-facing flow

**Two modes depending on where the form is loaded:**

**Local (Mode 1 server running):**
1. Blake runs `npm run mode1` once per coding session
2. Opens `http://localhost:8888/admin/new-anime`
3. Form auto-detects the server (calls `/api/health`) and shows "Submit & Ship" button
4. Blake fills the form and clicks Submit & Ship
5. Server runs the full ship pipeline, streams progress via SSE
6. Pauses for confirmation before firebase deploy
7. On confirm → live on realanimereviews.com within 30 seconds

**Remote (deployed admin form, no server):**
1. Blake opens `https://realanimereviews.com/admin/new-anime`
2. Form sees no server, shows "Generate Excel Row" button
3. Blake fills the form, clicks Generate
4. Form displays tab-separated Excel row + commands to run locally
5. Blake copies, pastes into Excel, runs commands manually

The deployed form is a fallback for when Blake is on a different device.

## 2 · File layout

```
Current Version/
  admin-fab.js                    ← Floating "Admin" button (every page, admin only)
  admin-fab.css                   ← FAB styling (matches .inline-header-btn)
  admin/
    new-anime.html                ← The form page (UID-gated)
    new-anime.css                 ← Form styling
    new-anime.js                  ← Form logic + AniList client + SSE handler
  scripts/
    mode1-server.js               ← Local Express server (npm run mode1)
```

## 3 · Admin UID gate

Hardcoded in `admin-fab.js` and `admin/new-anime.js`: `G2jGRa14u8bzGAmeBTkvXy8PKmr1` (from PERSONAL.md). Public in deployed JS — Firebase web API key is also intentionally public (see `docs/ARCHITECTURE.md`); the UID is an identifier not a credential. Real privilege boundary is on Blake's local machine.

## 4 · Mode 1 server pipeline (`/api/submit`)

In order, with SSE streaming progress back to the form:

1. **Cover image** — download AniList URL → `assets/<slug>.png` (or use Blake's override)
2. **Backup + append Excel** — copy `Anime_Master_Table.xlsx` to `.bak.<timestamp>.xlsx`, then append new row
3. **Sync** — `node scripts/sync-excel-to-js.js` (regenerates animeData.js)
4. **Update Log widget** — rewrites `<ul class="changelog-list">` in index.html with "Added: <Title>" + previous bullets (last 5)
5. **Bump version** — `node scripts/bump-version.js <next-patch>` (PATCH for new-anime adds)
6. **Update CHANGELOG.md** — prepends `<!-- author: Mode 1 -->` entry
7. **Run tests** — `npm test` (Playwright). FAIL HERE = chain stops. No commit.
8. **Git commit + push** — `git add -A`, `git commit -m "Add anime: <Title>"`, `git push`
9. **Deploy** — `firebase deploy --only hosting`. Server pauses BEFORE this if `?skipDeploy=1` and waits for explicit confirm via `/api/deploy`.

If any step fails, server sends `event: error` and stops. Excel backup means failed Excel writes are recoverable.

## 5 · Visual language

The FAB matches `.inline-header-btn` in style.css (same dark-purple gradient + shimmer). The form page reuses the cityscape glass aesthetic (purple panels, blur, Bebas Neue / Montserrat fonts). Custom scrollbars match. Number stepper uses purple gradient buttons instead of browser default arrows.

## 6 · Project rule #9 — hybrid image curation

The form's image step:
- AniList default (auto-fetched + downloaded by server)
- "Override" button reveals filename input — Blake picks a custom file from `assets/`
- Image preview shows dimensions + `⚠ not 2:3` warning if aspect ratio off

## 7 · The "two-step → one-step" upgrade arc

- **v1.6.0 (paste workflow)** — form ships, generates Excel row + commands. Blake runs locally.
- **v1.6.1 (Mode 1 server)** — local server collapses paste+commands into one button. Production deploy still requires explicit confirmation.
- **v1.6.2 (live preview as you type)** — debounced AniList search, dropdown of matches, live card preview using homepage render code.
- **v1.6.3 (More Information panel)** — left-side panel mirroring Community Tab.
- **v1.6.4 (Suggestion box integration)** — public form + admin queue + handoff into Mode 1.
- **v1.6.x (one-click full automation)** — server runs deploy without confirmation gate, after enough trust.

## 8 · Safety baked in

- `npm test` failure stops the chain — no broken commits
- Firebase deploy requires explicit UI confirmation (skipDeploy=1)
- Excel backup before any modification (recoverable from `.bak.*.xlsx`)
- Image download writes to `assets/` only — can't escape directory
- Server only listens on `127.0.0.1` (no LAN exposure)
- `git reset --hard HEAD` will NOT recover failed Mode 1 ships; rely on Excel backup + git stash patterns instead
