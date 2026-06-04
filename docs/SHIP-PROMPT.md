<!-- author: Cowork | date: 2026-06-04 -->
# v1.8.1 — Production deploy (FAST-TRACK)

Blake smoked the preview (static surfaces clean; he understands Save/Ship/Fix need his local `npm run mode1` — permanent design, not a preview limitation) and gave the explicit "ship it". Deploy `d60c437` to production.

1. Pre-deploy invariant: HEAD == origin/main == `d60c437`. Stop if not.
2. `firebase deploy --only hosting` from `Current Version/` (no channel flag, no `firestore:rules` — untouched).
3. Post-deploy verify on live `realanimereviews.com`:
   - `/` 200 + `APP_VERSION` flips to `1.8.1`
   - `/admin/edit` 200 · `chat-drawer.js` + `modal-scroll-lock.js` 200
   - Leak checks 404: `/.env`, `/docs/SHIP-OUTPUT.md`, `/docs/HANDOFF.md`, `/docs/CODE-HANDOFF.md`, `/docs/COWORK-STYLE.md`, `/tests/mode1-server.spec.js`
   - Alignment: commit == main == channel == prod
4. Refresh `docs/CODE-HANDOFF.md` to the live v1.8.1 state. Next ship: **v1.8.2 — Structured review template** (the 9 sections; the NEXT.md brainstorm — `##`-heading authoring + "Insert template" admin button + jump-pill render — is the gate-0 seed).

## Report shape
Standard deploy report: command, files, post-deploy table, alignment, one-liner.
