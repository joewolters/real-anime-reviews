<!-- author: Code | date: 2026-05-09 -->
# Decision Log

> **What this is:** the WHY behind project choices that aren't self-evident from the code. Future-Blake and future-AIs both forget the why fast; this preserves it so we don't re-litigate decisions or accidentally undo them while making "improvements."
>
> **What this is NOT:** a status report (use `CHANGELOG.md`). A plan (use `ROADMAP.md`). Operational rules (use `CLAUDE.md`).
>
> **Format:** one entry per decision. Each has: a title, the decision in one line, the why, and when/where it applies. New decisions go at the top. Mark with date when added so you can track when our thinking evolved.

---

## 2026-05-11 · When you touch a pipeline's plumbing, re-run the pipeline at the commit you're shipping (lessons from Bug 10)

**Decision:** when an edit changes a low-level utility used by an automated pipeline (e.g. Mode 1's `runCmd`), the verification standard is "re-run the pipeline end-to-end *at the exact commit being shipped*" — not "the change looks right" or "earlier-state pre-ship testing already passed."

**Why:** Bug 10 (v1.6.0 → v1.6.1 hotfix) was a `spawn EINVAL` in `runCmd` that crashed every Mode 1 ship at the `npm test` step. The spawn-config edit looked correct in isolation. But the v1.6.0 pre-ship test session (Vinland Saga, end-to-end) was conducted *before* the spawn change landed in the working tree. After the change was made, the pipeline was never re-run before commit + push + deploy — the v1.6.0 ship trusted earlier-state testing. The spawn config was the surface bug; the deeper failure was treating "we tested *something* end-to-end" as equivalent to "we tested *this code* end-to-end." They were different commits. v1.6.2 adds a startup smoke check (`smokeCheckSpawn`) that catches the specific class of regression at server startup, but the structural lesson is the verification discipline, not the smoke check.

**Applies:** every change to `scripts/mode1-server.js`'s plumbing helpers (`runCmd`, `runShipSequence`, `downloadFile`, `appendExcelRow`, the pre-flight checks) and every Mode 2 ship when Mode 2 exists. The rule: if you edit any of these, end-to-end test through the pipeline you just edited *with the edit in place* — not "the test we ran earlier on the previous code."

---

## 2026-05-09 · Repo went public

**Decision:** GitHub repo flipped from private to public; account renamed `ReaIGodzilla` → `joewolters`.

**Why:** the repo is now a portfolio link from Joe's CV. Visibility benefits (code review, recruiter discoverability, public commit history as evidence of work) outweigh the leak risk *because* the rigorous `.gitignore` ↔ `firebase.json` ignore-mirror discipline and PERSONAL.md handling already protect against credential exposure.

**Applies:** every commit, every doc edit, every file that gets created from now on. Treat anything you commit as world-readable. The `.gitignore`/`firebase.json` mirror rule (codified v1.3.9) and project rule #9 (image curation stays human, no AI-curated content) both matter even more under public visibility.

---

## 2026-05-09 · Version bumping became scripted

**Decision:** `scripts/bump-version.js` replaces the 7-step manual version-string checklist documented in CLAUDE.md.

**Why:** the manual checklist was error-prone — the v1.3.4 changelog widget bug (commit `fe0dc4a`) was exactly this category: `APP_VERSION` got bumped but the static fallback didn't. Script makes the bug class structurally impossible.

**Applies:** every release. Hand-editing version strings is now a code smell. Use the script, then `--check` to verify, then commit.

---

## 2026-04-30 · Phase C (Playwright tests) shipped before Phase A (Excel sync)

**Decision:** test infrastructure was built and shipped (v1.4.0) before the Excel-sync work that's the actual roadmap milestone.

**Why:** Mode 1 and Mode 2 both write to live data. Without automated verification, a single bad sync could corrupt the deployed site (or worse, deploy and *not be noticed*). Building tests after Mode 1/Mode 2 would be retrofitting safety on top of risk that already shipped. The order matters: protection first, capability second.

**Applies:** any future AI-write capability. Tests come before the capability that needs them, not after.

---

## 2026-04-30 · Suggestion box folded into v1.6.3 (Mode 1) instead of standalone

**Decision:** the originally-planned standalone "v1.4.0 — Suggestion box + admin viewer" feature is no longer scheduled separately. It ships as v1.6.3 wired into Mode 1's admin panel.

**Why:** standalone was always two disconnected steps — visitors submit suggestions, Blake separately writes a review. Combining them gives one workflow: visitor submits → admin queue → Blake clicks "Add this anime" → form pre-fills → write review → save → Mode 1 ships. Tighter, fewer context switches, naturally completed.

**Applies:** roadmap planning. If "what about the suggestion box?" comes up, the answer is "it's in v1.6.3, paired with Mode 1, not separate."

---

## 2026-04-30 · Anime font and @mentions deferred (still on roadmap, lower priority)

**Decision:** moved "anime font" (originally v1.5.0) and "@mentions in comments" (originally v1.6.0) to a Deferred section. Suggestion box was deferred and then folded into Mode 1; these two stay deferred without folding.

**Why:** both turned out to be lower leverage than the AniList integration arc. Site typography is currently fine — visitors aren't complaining. Comment system works without @mentions — community engagement isn't yet bottlenecked by it. Revisiting either is fine *when there's a reason*. Until then, build the Mode 1/Mode 2 capabilities that compound.

**Applies:** if either feature comes up in roadmap discussion, it's "yes if/when" not "soon."

---

## 2026-04-30 · Mode 1 became an upgrade arc, not a single ship

**Decision:** Mode 1 is a *capability*, not a single version. It ships across v1.6.0 (baseline form), v1.6.1 (live preview), v1.6.2 (More Information panel), v1.6.3 (suggestion box integration), v1.6.4+ (TBD based on real usage).

**Why:** baseline Mode 1 needs to ship and be *used* before we know what else it should do. Bundling everything into v1.6.0 would be guessing at what matters. Shipping the baseline first lets v1.6.1+ be informed by actual workflow friction, not speculation.

**Applies:** Mode 1 sub-feature decisions. Default answer to "should v1.6.0 also do X?" is "no, that's a v1.6.x candidate after we use the baseline."

---

## 2026-04-30 · Mode 2 constrained to PATCH-tier changes

**Decision:** Mode 2 (autonomous site caretaker) is allowed to ship PATCH-tier changes without per-change approval. Anything MINOR or MAJOR escalates to Blake.

**Why:** the trust-gate model. Per-change approval defeats the point of autonomy; *no* gates risks silent scope creep. PATCH-tier is the safest middle: small enough that the blast radius of a wrong call is limited, but useful enough that Mode 2 can do real work (data sync, broken-link fixes, missing-asset detection). Trust earned through good reporting, not gated approvals.

**Applies:** every Mode 2 capability. If a Mode 2 task wants to change schemas, add features, or rewrite components — it's not Mode 2's call. It writes a report and Blake decides.

---

## 2026-04-30 · Mode 1 and Mode 2 are separate AI systems

**Decision:** different roles, different trust gates, possibly different underlying models. Don't conflate them in code, prompts, or docs.

**Why:** they have fundamentally different risk profiles. Mode 1 is human-initiated with a manual approval gate (low autonomy, high precision). Mode 2 is AI-initiated, scheduled, autonomous within bounds (high autonomy, low per-change risk). Mixing them — using one prompt template for both, sharing state, having the same model do both — would muddy both. Separation makes each easier to reason about and verify.

**Applies:** every Mode 1 / Mode 2 implementation decision. If a piece of code or doc is unclear which mode it serves, that's a smell.

---

## 2026-04-30 · Excel is canonical for anime data

**Decision:** `Anime_Master_Table.xlsx` (in `Master List/`) is the source of truth. `animeData.js` is downstream output. Any AI that changes anime data also updates Excel.

**Why:** three reasons. (1) Blake can open Excel offline and see ground truth, including data Mode 2 changed while he wasn't watching. (2) Excel is human-friendly for editing; JS is not. (3) Single source of truth prevents the "which file is right when they disagree?" problem that *will* otherwise emerge once Mode 1 starts writing.

**Applies:** every anime data change. The flow is always Excel → JS, never the reverse, never both independently.

---

## 2026-05-09 · Image curation: hybrid (AniList default + manual override) — SUPERSEDES the 2026-04-30 "always human" rule

**Decision:** Mode 1 fetches the AniList cover image and pre-populates it on the new-anime form as the default. Blake can either accept the AniList default with one click, or override by dropping a custom image into `assets/` and selecting it from the file dropdown. Mode 1 never silently changes images — the form always shows what's about to ship and Blake confirms before save. Mode 2 is NOT permitted to swap images on existing anime; image changes are always Blake-initiated.

**Why this changed from the original rule:** the original "always human" rule (2026-04-30) was strict because the worry was AI-slop image selection. But AniList covers are official posters — high-quality, legally clear, consistent. Forcing the manual download-rename-drop step every time was friction without benefit *for the common case*. The hybrid keeps Blake's judgment available exactly when it matters (he can override anytime) while making the default workflow truly hands-off. Best of both: speed when the AniList default is good, taste when it isn't.

**Why Mode 2 is still locked out of image changes:** Mode 2 is autonomous. If it could swap images on existing anime, even small classification errors compound silently across the site. Image changes stay Mode 1 (Blake-initiated) territory. Mode 2 can flag "I think this anime now has a better cover available on AniList" in its weekly report, but cannot apply the change.

**Applies:** Mode 1 form UX (v1.6.0), Mode 2 reporting (Phase D). Project rule #9 in `ROADMAP.md` is the canonical short-form version.

---

## (Original architecture decisions — undated, predate the formal doc system)

### Vanilla HTML/CSS/JS — no framework

**Decision:** site is built without React, Vue, Svelte, or any framework. Plain HTML, CSS, and a single ~4000-line `script.js`.

**Why:** the site is small enough that vanilla works. Framework migration would be weeks of rewrite for marginal benefit. Vanilla also matches Blake's coding skill level — he can read it, understand changes, and learn from edits in a way that React component trees would obscure. The architecture is *intentionally accessible to its owner.*

**Applies:** any future feature. "Should we use a framework for this?" → no, unless the answer changes the project's nature (which would be a bigger conversation).

### No monetization (no ads, no subscriptions, no donations)

**Decision:** the site is a pet project, not a business. No revenue mechanisms.

**Why:** monetization would cheapen the personal-voice quality. Visitors come for honest reviews from a normal person; ads turn that into a content-mill aesthetic. Ad-free is a quality decision, not just a financial one.

**Applies:** every UI change. If a feature needs a "premium" tier or "sponsored" badge, it doesn't belong here.

### No multi-language support

**Decision:** English only. No translation infrastructure.

**Why:** the reviews ARE the personal voice. Translation dilutes that voice (machine translation flattens; human translation requires another voice). Multi-language would also require maintaining N copies of every review forever — unbounded ongoing work for marginal reach gain.

**Applies:** any "should we add Spanish/Japanese/etc.?" conversation. Default no.

### No AniWave / unofficial-streaming-site integration in Mode 1

**Decision:** Mode 1 uses AniList only for streaming-where-to-watch data. Aggregator scraping (hianime, 9anime, aniwave, etc.) is out of scope.

**Why:** two reasons. (1) Legal risk — those sites distribute copyrighted content without license. Linking is a grey area; auto-fetching from them is worse. (2) Data quality — AniList's `externalLinks` is curated and stable; aggregator listings are noisy and break often. AniList covers all the official platforms we care about (Crunchyroll, Netflix, Hulu, etc.); that's enough.

**Applies:** Mode 1 implementation. Blake's *manual* `Platforms` field can still include unofficial sites if he wants — that's a human choice. AI-fetched data is AniList-only.

### Slow-and-safe over fast-and-broken (the deploy ladder)

**Decision:** every meaningful change ladders local → preview channel → production. Three separate validation surfaces.

**Why:** local catches code errors before they reach git. Preview channel catches deploy/config errors before they reach users (Firebase rules differences, asset 404s, environment-specific bugs). Production is the final commit. Skipping preview to "save time" cost real bugs in earlier project history; the discipline pays for itself.

**Applies:** every production-facing change. The pattern is documented in `docs/DEPLOYMENT.md`.

### "Show, don't do" is non-negotiable

**Decision:** every meaningful change shows the plan, then the diff, then pauses for approval *before* writing.

**Why:** Blake caught multiple real bugs by seeing diffs before they hit history (encoding bugs, smart-quote conversions, file-system cleanups). The two-step pattern is a quality control mechanism, not a delay. AI sessions that skip "show, don't do" lose Blake's review and lose the catch-bugs-early benefit.

**Applies:** every Code session. Auto-applying changes "to save time" is a fail mode.

### Each audit fix is its own commit, not bundled

**Decision:** when fixing audit items, each fix is its own diff with its own commit message — not 5 fixes squashed into "audit cleanup."

**Why:** easier to revert one fix without unwinding others; clearer git log when reading history; better atomic units for code review. The exception is when 3-5 small items are *intentionally* bundled as a planned PATCH (audit polish bundles in the roadmap) — but that's a planned bundle, not an emergent dump.

**Applies:** Step 3.5+ audit work and any future audit cycles.

### Curly vs straight quotes in `index.html` is intentional

**Decision:** HTML attributes use straight ASCII `"`. Decorative text content uses curly typographic `"..."`. Both conventions live in the same file, deliberately.

**Why:** HTML attributes REQUIRE straight quotes — curly quotes break attribute parsing and CSS selector matching. Text content can use curly quotes for typography (looks better, fits the site's aesthetic). The split is correct, not an inconsistency.

**Applies:** any AI doing find-and-replace in HTML. Don't "normalize" curly quotes to straight (would break decorative typography) or straight to curly (would break attributes). Verify with byte-level inspection if a quote-character change is intentional.
