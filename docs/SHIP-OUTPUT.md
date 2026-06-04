<!-- author: Code | date: 2026-06-04 -->
# v1.8.1 — Final fix + compressed sweep (committed + pushed + preview deployed — awaiting "ship it")

> **v1.8.1 is committed, pushed to `main`, and live on a preview channel.** The cosmetic fix-platforms restyle (item 0) is applied, the full docs cascade is done (CHANGELOG MINOR + widget + bump 1.8.1 + ROADMAP/NEXT shipped), all audits pass, and the Blake-authored commit (zero trailers, 7 Cowork excludes out) is pushed. Preview verified: **APP_VERSION 1.8.1**, `/admin/edit` 200, new assets 200, all leak checks 404. **Production is the only thing left and it waits for your explicit "ship it."**

---

## 0. Fix-platforms "excluded" line restyle (applied)
- The raw `excluded(regional/defunct): Bilibili TV` debug string is gone. The shared lib's CLI vocabulary is **untouched** (the terminal output stays as-is); the edit page now **reformats each flag client-side** into premium **kicker + text** rows: an exclusion → an amber `NOT CARRIED · regional/defunct` pill + the platform name; an unmapped site → an amber `UNMAPPED` pill; manual-override / no-links notes → a neutral purple `NOTE` pill.
- **Δ** `edit.js` `fixFlagHtml`/`fixFlagRow` (+ wire `innerHTML` from `map`); `edit.css` `.edit-fix-flag*` (amber `--warn` / purple `--note`). Verified `node --check` OK, CSS **217/217**.

## Docs cascade
- **CHANGELOG.md** — new **v1.8.1 — MINOR** entry. Honestly scoped: "Visitor-facing: nothing user-visible" (the only new element is the admin-gated ✎), then a full "Behind the scenes (admin tooling)" list (edit page, two save tiers, change-diff, watched tree, live-preview, Revert, Fix-from-AniList, ✨ASK, origin-aware nav, scroll-lock, Mode-1 spec) + implementation-files line.
- **Widget** — visitor-first judgment per the skill: this ship is ~entirely admin-facing, so **one modest bullet** ("Behind the scenes: new admin tools to edit and re-publish existing reviews faster…") folded into the existing 06/04/2026 section, and the range chip extended `v1.7.4 → v1.8.1`. No padding.
- **bump-version 1.8.1** — `node scripts/bump-version.js 1.8.1` → **40 strings updated**, `--check` → **all 40 agree on v1.8.1**. (APP_VERSION + the `#changelog-version` static fallback both 1.8.1, verified.)
- **NEXT.md + ROADMAP.md** — v1.8.1 marked **✅ shipped 2026-06-04** in both ladders (scoped as actually built incl. the G2b/G4/G4b adds), the "Recently shipped" lists got a v1.8.1 entry, ROADMAP "Live at" → **v1.8.1**, and the ladder "next" pointer → **v1.8.2 (structured review template)**. The **new-anime ASK-drawer convergence flag** is recorded in both.

## Audits
| Audit | Result |
|---|---|
| `npm test` (Playwright) | **12 passed (14.0s)** — 9 spec files |
| `firestore.rules` untouched | **✓** (not in `git status`) |
| `.gitignore` ↔ `firebase.json` mirror | **✓** — no new sensitive files; `tests/**` already firebase-ignored (the new spec won't deploy); `admin/*` + `scripts/lib/*` deploy with no secrets |
| smart-quote sweep (Grep tool) | **none** in the cascade + touched files |
| `git diff` review | clean — `script.js` is the v1.8.1 ✎ block + `&from=modal`; bumped files are version-string-only |

## Commit + push
- **`d60c437`** authored **Blake Wolters <196413457+joewolters@…>**, **zero** forbidden trailers (verified). The **7 Cowork excludes** (`COWORK-STYLE.md`, `AI-PRIMER.md`, `CODE-PROMPTS.md`, `SKILLS/{README,hotfix,release,widget-update}.md`) restored out of the staged set (confirmed absent); the rolling docs (`SHIP-OUTPUT`, `SHIP-PROMPT`, `CODE-HANDOFF`, `NEXT`) rode in. Pushed `38a4baf..d60c437` to `main`; **HEAD == origin/main**.

## Preview deploy
- Channel: **https://real-anime-reviews--preview-v1-8-1-i2cmwb4k.web.app** (expires 2026-06-11).
- Post-deploy verification:

  | Check | Result |
  |---|---|
  | `APP_VERSION` on channel | **1.8.1** |
  | `/admin/edit` | **200** (the `.html`→301 is the standard `cleanUrls` redirect to `/admin/edit`) |
  | new assets (`chat-drawer.js`, `modal-scroll-lock.js`, `edit.js`, `edit.css`) | **200** |
  | leak checks (`docs/SHIP-OUTPUT.md`, `docs/CODE-HANDOFF.md`, `docs/COWORK-STYLE.md`, `docs/HANDOFF.md`, `tests/mode1-server.spec.js`, `.env`) | **all 404** |

## Blake's preview smoke (then "ship it" → prod)
On **https://real-anime-reviews--preview-v1-8-1-i2cmwb4k.web.app** (the edit-page Save/Ship/Fix need `npm run mode1` locally; the live channel has no server, so on-channel you're smoking the *static* surfaces — list/form render, the modal ✎, scroll-lock, preview overlay):
1. Sign in as admin → open a review → the **✎ Edit review** link is there → it opens `/admin/edit?slug=…&from=modal`.
2. The fix-platforms panel's flags now read as **premium pill rows** (NOT CARRIED · regional/defunct), not raw debug text.
3. Page **doesn't scroll behind** the modals.
4. Update log shows the **v1.8.1** tag + the one modest admin bullet.

Say **"ship it"** and I'll run `firebase deploy --only hosting` to production, verify APP_VERSION 1.8.1 + the leak 404s on the live domain, then refresh `docs/CODE-HANDOFF.md` for the next session.

## One-liner reply
v1.8.1 **committed, pushed, and preview-deployed — awaiting your "ship it" for prod**: restyled the fix-platforms flags into premium amber **NOT CARRIED · regional/defunct** / **UNMAPPED** pill rows (CLI lib vocabulary untouched, reformatted client-side); ran the full docs cascade — **CHANGELOG v1.8.1 MINOR** (honestly scoped "visitors see nothing new" + the admin-tooling list), **one modest visitor-first widget bullet** + range chip to v1.8.1, **`bump-version 1.8.1` (40 agree)**, and **v1.8.1 marked shipped in both NEXT + ROADMAP** ladders (next = v1.8.2 structured review template, with the new-anime ASK-drawer convergence flagged); all audits green (**`npm test` 12 passed**, `firestore.rules` untouched, gitignore↔firebase mirror clean with `tests/**` already ignored, no smart-quotes); committed **`d60c437`** authored **Blake** with **zero trailers** and the **7 Cowork excludes restored out** (rolling docs rode in), pushed `38a4baf..d60c437` to `main` (**HEAD == origin/main**); preview at **https://real-anime-reviews--preview-v1-8-1-i2cmwb4k.web.app** verified **APP_VERSION 1.8.1 · /admin/edit 200 · new assets 200 · all leak checks 404** — smoke it and say **"ship it"** for the production deploy (after which I'll verify the live domain + refresh `docs/CODE-HANDOFF.md`).
