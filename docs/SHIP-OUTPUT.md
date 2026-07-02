<!-- author: Code | date: 2026-06-12 -->
# v1.10.2 — THE CREATOR PROFILE + the full account nav. **STAGED, verified green — deploys on your go.**

Mode **ULTRAMAX** on the sheet design. Both asks built, walked, and adversarially checked; the panel caught one real HIGH in my nav timing (fixed and re-proven). **Nothing deployed.**

## Design vision (1 para)
Your name stops being a teleport and becomes a meeting. Click "Blake" anywhere — a thread, a comment, a room — and the room meets THE CREATOR SHEET: the one gold sheet on the site. Gold filigree and the hanging lantern (your Den Keeper frame, on by default), **CREATOR 創り手** in gold where members wear purple MEMBER 旅人, your face in a gold ring, and a full-width gold door — **🏮 Visit the Den 隠れ家へ →** — so the old promise (your name leads home) survives with a face on it. No Appreciate counter ever renders there: gold is never counted. No report flag: nobody reports the owner to the owner. Your Tavern threads ride below in quiet purple; your reviews need no tab — they ARE the site, and the gold door says so.

## Item 1 — THE CREATOR PROFILE (your 3rd ask), with evidence
- **Members meet your sheet now:** e2e-proven live — Mika clicks your name → the gold sheet (CREATOR kicker ✓ Den Keeper frame ✓ no like row ✓ no flag ✓) → taps Visit the Den → every layer closes and she lands home. The screenshot at ship is the jaw-drop check: filigree, lantern, the gold door — it reads like meeting the owner.
- **Your Public view works** (your other ask): sign in → Account → 👁 Public view → YOUR sheet renders (or, before your first Studio save, a gold "ready to wear" card — never the old refusal). Save your profile once (bio, status, tags, a background if you like) and the sheet fills in everywhere.
- **The Studio now saves for you:** the rules' reserved-name list (which blocks members from naming themselves "Blake") carries a carve-out for the real you — your save mints your profile doc like anyone's. Rules-tested both ways: you may be Blake; a member named "bLaKe" still bounces.
- **Heart guards held and pinned:** the gold is `.is-creator`-scoped (a member sheet computed-style-checked to NEVER wear it), the like-on-you denial was already in the rules, your doc exposes only what members' docs expose (no email — that stays in the old users record, unchanged), and the catalog reviews tab is deliberately absent from your sheet (the Den door is that path).

## Item 2 — the full account nav, with evidence
View All · **Random ランダム** · **Filter 絞り込み** now all live on the account page header, matching home. Random and Filter route home and perform the action through the homepage's own wired buttons — and the adversarial panel caught my first cut firing the filter *into* the homepage's boot reset (an invisible panel + a stuck scroll-lock on the common path, with a test that was green for the wrong reason). Fixed at the root: the action now waits out the boot pass and the welcome door entirely, and **your door choice wins** — if you click a catch-up button instead, the queued action drops quietly. The spec now pins painted pixels (panel open, opacity 1), not just attributes.

## Adversarial (3 lenses, refute-verified: 1 HIGH + 2 MED + 2 LOW confirmed, 2 refuted — ALL fixed)
- **HIGH (fixed):** ?open=filter died on the already-welcomed path (the boot reset closed it same-tick; stuck aria + scroll-lock). The fire now defers past init(); re-proven against the hardened spec.
- **MED (fixed):** the g29 spec was false-green (asserted the stuck attribute) — now pins the open class + computed opacity. · The door-path fire raced the door's own teardown (focus/overflow clobber) — the fire now waits for the splash to be fully torn down.
- **LOW ×2 (fixed):** the queued action raced the door's catch-up hand-offs (a surprise random modal under the sheet) — the intent check drops the queued action when a catch-up surface or modal already owns the screen.
- **Refuted (2):** a profile-report REST path (pre-existing, admin-visible only) and a sessionStorage-throw asymmetry (unreachable in practice).
- The Creator sheet itself came through the doc-exposure and name-routing lenses **clean**.

## Tests — ALL GREEN (new floors)
`npm test` **225** (g29 ×5 + the g18 'creator' flip) · `test:rules` **156** (+2: your name on your doc allowed; "bLaKe" members still denied) · `test:functions` **77** · `test:cf` **67** · e2e **16** (+2: the member-meets-your-sheet walk incl. the Den door; your Public view never refuses).

## YOUR SMOKE (practice is up: http://127.0.0.1:8765/?emu=1)
1. Sign in as **anyone** (prac-mika / practice123) → open any Tavern thread or comment by Blake → **click your name** → the gold sheet. Tap **Visit the Den** — it takes you home.
2. Sign in as **blake@practice.test** → Account → **👁 Public view** → your sheet (the seeded account has a profile doc, so it renders fully). Try the Studio: set a status, Save — it lands.
3. On the account page: **Random** and **Filter** sit in the header now. Click each — you land home and the thing actually opens.

**STAGED — say go and it deploys (hosting + firestore rules), same two-command shape as last time. The rules change is the name carve-out only; no storage rules touched, so no Google-permission dance.**

## One-liner reply
Your name opens YOUR sheet now — the one gold sheet on the site, Den Keeper frame and lantern by default, CREATOR in gold where members wear purple, no count and no flag because gold is never counted and nobody reports the owner, with a full-width gold Visit-the-Den door keeping the old promise — your Public view renders it (no more refusal), your Studio save works (the rules now know the real Blake from impersonators, tested both ways), members met it live in the walk and the e2e suite, the account page carries the full View All · Random · Filter nav with actions that genuinely fire (the adversarial panel caught my first cut dying against the homepage boot pass and a test that was green for the wrong reason — both root-fixed and re-proven on painted pixels), every track is green at **225 / 156 / 77 / 67 / 16** — **staged, practice is up for your smoke, and it ships on your word.**
