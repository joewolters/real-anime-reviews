<!-- author: Cowork | date: 2026-06-04 -->
# v1.8.2 — Prod deploy + Re:ZERO Excel cleanup (FAST-TRACK)

**Blake gave the go-signal in chat: "everything else is good. push it"** (after preview smoke passed — frost, header row, update log all confirmed good).

## 1. Production deploy
- `firebase deploy --only hosting` → verify on realanimereviews.com: APP_VERSION **1.8.2**, `admin/section-editor.{js,css}` 200, leak checks 404, Re:ZERO review junk-free.
- Refresh `docs/CODE-HANDOFF.md` per your usual close.

## 2. Re:ZERO Excel cleanup (Blake's explicit ask: "can code check if its still there and manually delete from the excel?")
The placeholder smoke sections (`## Intro / ## Story / ## Animation / … dgsdgsdg…`) you excluded from the commit are still in `Master List/Anime_Master_Table.xlsx` (the Re:ZERO Review cell). Localhost looks clean only because you restored `animeData.js` — Excel is the canonical copy and a future sync would re-import the junk.

- **Verify first:** read the Re:ZERO Review cell, report what's actually there (don't assume).
- **Backup the xlsx** before touching it (the Mode-1 backup convention).
- **Remove ONLY the placeholder sections** — the real prose review stays byte-intact. Same for `season-reviews` if the smoke touched any (his G3b smoke also saved a season review — check `index.json`-adjacent data for placeholder text like "A start sometimes it happens" on the Alya/One-Punch rows; report findings before deleting anything you're less than certain is smoke junk).
- **Run `npm run sync`** → confirm `animeData.js` comes out identical to the committed clean version (`git diff` empty = proof the cleanup matches what shipped).
- Report before/after of every cell you touched.

If anything in the Excel row looks ambiguous (real content mixed into placeholder sections), stop and list it instead of deleting.
