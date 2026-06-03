<!-- author: Cowork | date: 2026-06-03 -->
# v1.7.1 — Gates 5 + 6 + 7 + 8 (docs cascade + audits + commit + preview deploy — FAST-TRACK)

Compressed sweep. All build gates clean through 1h. No firestore:rules redeploy (schema unchanged since v1.6.11 gate 8).

## Sub-step 1 — Version bump 1.7.0 → 1.7.1 (PATCH)

```
node scripts/bump-version.js 1.7.1
node scripts/bump-version.js --check    # expect: OK: all 26 strings agree on v1.7.1
```

## Sub-step 2 — CHANGELOG.md entry

Prepend new v1.7.1 entry above v1.7.0 with `<!-- author: Code | date: 2026-06-03 -->`. Headline: a polish bundle on top of v1.7.0's AniList enrichment. Cover the visible items:

- **Romaji + Japanese subtitle** on cards + modal, in `「 」` brackets, with Japanese native fallback (`チェンソーマン` etc.) when romaji matches English; up to 3-line wrap for long titles; Outfit Light Italic for Latin, Noto Sans JP for Japanese
- **Per-anime AniListColor accent** on the ANILIST badge with luminance guard (dark colors like Chainsaw Man's `#6b1a1a` lift to readable dusty rose)
- **Premium "no matches" empty-state card** replacing the bare text line, with 🔍 glyph + `NO MATCHES 該当なし` + `SUGGEST ONE →` CTA
- **Widget update-log version chips** per date with arrow notation for multi-ship dates (e.g. `v1.6.2 → v1.6.6` for 05/11)
- **4 previously-skipped anime backfilled** (My Stepmom's Daughter Is My Ex, Watari-kun's, Archdemon's Dilemma, Hatsune Miku: Colorful Stage!) — all 44 reviews now have AniList enrichment
- **New `--add-native` backfill mode** + `TitleNative` field across Excel + sync
- **Top 10 carousel glass portrait expanded** to fit subtitle line
- **Latest Anime Drop card** gets the romaji treatment + centering fix

## Sub-step 3 — Widget bullet

This patch IS visitor-facing (Japanese subtitles, per-anime color accent, premium empty-state are all directly visible). Add a bullet under v1.7.1 chip on the **06/03/2026** date section.

**Chip rule applies:** 06/03/2026 now has TWO ships (v1.7.0 from earlier today + v1.7.1 now). Per Blake's rule (1-2 ships → stacked chips), render `v1.7.1 / v1.7.0` stacked vertically above the 06/03/2026 date label.

Suggested bullet seed (refine in Blake's terse visitor-first voice):
> Each anime card now shows its Japanese title underneath the English one — the original kanji where it fits, or the romanized reading otherwise.

Cap math: dropping the oldest if widget is full.

## Sub-step 4 — NEXT.md cleanup

- Move v1.7.0-polish entry → "Recently shipped" as **v1.7.1**, mark shipped 2026-06-03
- **Renumber** Phase B-side: previously v1.7.1 multi-fetch → **v1.7.2**, previously v1.7.2 secondary modal → **v1.7.3**
- Update "Immediate next ship" to v1.7.2 (multi-fetch + multi-hop)
- Update v1.7.x polish slots section to reflect new ordering

## Sub-step 5 — ROADMAP.md update

- "Current state" → `Live at v1.7.1`
- Append v1.7.1 shipped-bullet (concise — references the v1.7.0 polish bundle headline items)
- Renumber: anywhere ROADMAP references v1.7.1 multi-fetch → v1.7.2, v1.7.2 modal → v1.7.3
- "Up next" rewrite: v1.7.2 multi-fetch → v1.7.3 secondary modal → v1.8.0 AniList tab

## Sub-step 6 — Audits (gate 6)

- `npm test` 7/7 required before commit. STOP and report if anything fails.
- `firebase.json` ↔ `.gitignore` mirror audit
- `git diff --stat HEAD` — confirm scope maps to v1.7.1 polish bundle + docs cascade + `animeData.js` regen from `--add-native` + Excel `TitleNative` column

## Sub-step 7 — Commit + push (gate 7)

- `git add -A`, then `git restore --staged` the 7 Cowork excludes (same as v1.6.11/v1.6.12/v1.7.0):
  ```
  docs/COWORK-STYLE.md docs/AI-PRIMER.md docs/CODE-PROMPTS.md
  docs/SKILLS/README.md docs/SKILLS/hotfix-skill.md
  docs/SKILLS/release-skill.md docs/SKILLS/widget-update-skill.md
  ```
- Author marker: `Blake Wolters <196413457+joewolters@users.noreply.github.com>` (NO Co-Authored-By / 🤖 / Claude Code / Generated with trailers)
- Commit message — match the CHANGELOG body shape, concise paragraphed body
- `git push origin main`

## Sub-step 8 — Preview deploy (gate 8)

```
firebase hosting:channel:deploy preview-v1-7-1
```

Capture the channel URL.

## Verify before stopping

- `bump-version.js --check` reports "all 26 strings agree on v1.7.1"
- `npm test` 7/7
- `grep -c "v1.7.1" CHANGELOG.md ROADMAP.md NEXT.md` ≥ 1 each
- Author + 0 forbidden trailers on the commit
- 7 excludes still in working tree post-push
- Preview channel URL printed

## Report shape

Lean. New commit SHA, push confirmation, preview URL prominently, NEXT.md + ROADMAP renumber confirmation. One-liner reply. Flag anything unexpected (especially around the v1.7.1/v1.7.0 widget chip stacking on the 06/03 date section + the renumbering of multi-fetch/modal entries).
