<!-- author: Code | date: 2026-06-04 -->
# v1.7.4 — Gate 8 (production deploy — FAST-TRACK ✓ LIVE)

> **v1.7.4 is LIVE in production.** Deployed commit `7364500` to `realanimereviews.com` on Blake's "ship it." Pre-deploy invariant held (HEAD == origin/main == 7364500). Every post-deploy check green: live serves `APP_VERSION="1.7.4"`, `markdown.js` is up (200), the empty `season-reviews/index.json` shipped (no demo content), the v1.7.3 watched-set data is intact (44), and all 4 leak checks (`.env` + 3 docs) are 404. Channel + main + prod are all aligned on `7364500`.

---

## Deploy
- **Command:** `firebase deploy --only hosting` (no channel flag — live site), from `Current Version/`.
- **Timestamp:** 2026-06-04 (~14:2x UTC; the index's `generatedAt` is `2026-06-04T14:20:41Z`).
- **Files:** 752 found in deploy root, **1 new uploaded** (the rest were already CDN-resident from the gate-7 preview channel — identical content hashes, so only the diff transferred).
- **Skipped** `firestore:rules` — untouched in v1.7.4.
- **No errors / no warnings.**

## Post-deploy verification (live `realanimereviews.com`)
| Check | Expected | Result |
|---|---|---|
| `/` → `APP_VERSION` | `1.7.4` (was `1.7.3`) | **`window.APP_VERSION="1.7.4"`** ✓ |
| `/` status | 200 | **200** ✓ |
| `/season-reviews/index.json` | empty | **`{count:0, ids:[], meta:{}}`** ✓ |
| `/markdown.js` | 200 | **200** ✓ (shared renderer deployed) |
| `/animeData.js` → `WatchedAniListIds` count | 44 | **44** ✓ (no v1.7.3 regression) |
| `/.env` | 404 | **404** ✓ (Anthropic key NOT exposed) |
| `/docs/SHIP-OUTPUT.md` | 404 | **404** ✓ |
| `/docs/HANDOFF.md` | 404 | **404** ✓ |
| `/docs/CODE-HANDOFF.md` | 404 | **404** ✓ |

## Alignment
- **commit `7364500`** == `origin/main` == preview channel == **prod**. All four aligned.
- Live version flipped `1.7.3` → `1.7.4` on the first curl (no propagation delay; no retry needed).

## Phantom-drift audit
None. Pre-deploy invariant verified against the real HEAD/origin refs before deploying; every post-deploy check curled the live site (version flip + 200s + 404s read, not assumed); the `.env` 404 re-confirmed on prod (not just the channel) per the gate's explicit security re-check.

## What's left in v1.7.4
- **Gate 11 — Blake's prod verify (browser):** the full ship on the live site (3-col modal, secondary deep-dive + history-back + Request, per-season review surface, routing, clickable characters/staff tertiary, markdown reviews + purple links). Reminder: writing a season review needs Blake's local `npm run mode1` server (visitor-facing rendering + browsing are fully live).
- **Session-close housekeeping (now done):** `docs/CODE-HANDOFF.md` refreshed this turn to capture the LIVE v1.7.4 state for the next Code session (it was last updated at gate 0). `docs/HANDOFF.md` is Cowork's to update.

## One-liner reply
v1.7.4 **Gate 8 (production deploy) DONE — LIVE on realanimereviews.com**: confirmed HEAD == origin/main == `7364500` then ran `firebase deploy --only hosting` (752 files found, 1 new uploaded since the rest were CDN-resident from the preview channel, no firestore:rules deploy, no errors); every live post-deploy check is green — the site now serves **`APP_VERSION="1.7.4"`** (flipped from 1.7.3 on the first curl), home 200, **`markdown.js` 200** (shared renderer live), **`season-reviews/index.json` empty `{count:0, ids:[]}`** (no demo content), **`WatchedAniListIds` count 44** (v1.7.3 watched-set intact, no regression), and all four leak checks (`.env`, `docs/SHIP-OUTPUT.md`, `docs/HANDOFF.md`, `docs/CODE-HANDOFF.md`) return **404** (Anthropic key safe); commit/main/preview/prod are all aligned on `7364500`; refreshed `docs/CODE-HANDOFF.md` to capture the live state for the next session; v1.7.4 is shipped — over to Blake's browser prod-verify to formally close it.
