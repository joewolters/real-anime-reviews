<!-- author: Cowork | date: 2026-06-05 -->
# v1.8.3 — Production deploy (FAST-TRACK)

**Blake gave the explicit go-signal in chat: "ship it"** (2026-06-05, after his preview smoke on the v1.8.3 channel).

1. `firebase deploy --only hosting` → production.
2. Live-verify on realanimereviews.com: APP_VERSION **1.8.3**, `/assets/rar_banner.webp` 200, `/assets/icon-192.png` 200, leak checks 404 (SHIP docs, CODE-HANDOFF, HANDOFF, tests/, .env).
3. Refresh `docs/CODE-HANDOFF.md` to the live state (v1.8.3 live, next = v1.8.4 Discovery & Blend gate-0 design study; carry the banked seeds list forward).

Report the live verification table. Nothing else queued.
