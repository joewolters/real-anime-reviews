<!-- author: Code | date: 2026-05-11 -->
# v1.6.6 — Gate 9 (full diff + npm test re-run + self-audit)

> Gates 5-8 post-apply content archived in git history. Overwritten per rolling-output convention.

---

## TL;DR for Cowork

- ✅ **9 modified files total** — 7 v1.6.6-attributable + 2 rolling SHIP-*.md (intra-session churn, not new for this ship)
- ✅ **No untracked files** (no new files created in v1.6.6 — pure modification ship)
- ✅ **`npm test` 7/7 in 17.8s** — back to baseline range
- ✅ **`--check` confirms 14/14 strings at 1.6.6** — no drift
- ✅ **No surprise files** in the diff; everything attributable to a specific gate (5/6/7/8)
- ✅ Single-character fix (`style.css`) is the root cause + only logic change

---

## (A) `git status --short`

```
 M CHANGELOG.md
 M ROADMAP.md
 M account.html
 M admin/new-anime.html
 M docs/NEXT.md
 M docs/SHIP-OUTPUT.md
 M docs/SHIP-PROMPT.md
 M index.html
 M style.css
```

**9 modified, 0 untracked.** Note: Cowork's gate 9 SHIP-PROMPT estimated "~6 modified" (style.css + 3 HTMLs + CHANGELOG + ROADMAP + NEXT.md = 7); my own propose-pass estimate was "7"; actual is 9 because the 2 rolling `docs/SHIP-*.md` files are tracked-modified from v1.6.5's commit (git sees their state has changed since `ba1990f`). The 7 v1.6.6-attributable files match the expected scope; the 2 rolling-file modifications are intra-session churn — they'll get committed alongside everything else at gate 10 per v1.6.5's established pattern (both files have ride-along-into-current-commit precedent from v1.6.5 and they're firebase-ignored either way).

---

## (B) `git diff --stat`

```
warning: in the working copy of 'CHANGELOG.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/NEXT.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/SHIP-OUTPUT.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/SHIP-PROMPT.md', LF will be replaced by CRLF the next time Git touches it
 CHANGELOG.md         |  11 ++
 ROADMAP.md           |   5 +-
 account.html         |   8 +-
 admin/new-anime.html |  10 +-
 docs/NEXT.md         |   6 +-
 docs/SHIP-OUTPUT.md  | 531 +++------------------------------------------------
 docs/SHIP-PROMPT.md  | 131 +++++++++----
 index.html           |  12 +-
 style.css            |   2 +-
 9 files changed, 146 insertions(+), 570 deletions(-)
```

Note the large net-negative on `docs/SHIP-OUTPUT.md` (-531 lines) — that's intra-session overwrites: v1.6.5's final close-out content (long) → v1.6.6's gates 5-8 confirmation (short) → THIS gate 9 file (this writes after the stat was captured, so the diff snapshot still shows the short content). All four `LF→CRLF` warnings are `.gitattributes`-driven; not blockers.

---

## (C) `git diff` — meaningful diffs (7 v1.6.6-attributable files)

Skipping `docs/SHIP-OUTPUT.md` and `docs/SHIP-PROMPT.md` diff bodies — those are rolling-file intra-session churn (~660 lines combined) that don't warrant per-line review at gate 9. Both files are firebase-ignored via gate 2's earlier fix. If Cowork wants them inline, say so and I'll re-emit.

### `style.css` — THE FIX

```diff
diff --git a/style.css b/style.css
index c6cbb6a..5e93013 100644
--- a/style.css
+++ b/style.css
@@ -215,7 +215,7 @@ header h1:hover {
     width: 100%;
     height: auto;
     aspect-ratio: 2 / 3;
-    object-fit: contain;
+    object-fit: cover;
     display: block;
 }
```

Pure `+1 / -1`. The root cause of the bug + the entire fix.

### `CHANGELOG.md` — v1.6.6 entry prepended

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index fbaa19b..bea235d 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -10,6 +10,17 @@ For what's coming next, see [ROADMAP.md](ROADMAP.md).
 
 ---
 
+<!-- author: Code | date: 2026-05-11 -->
+## v1.6.6 — PATCH (2026-05-11)
+
+**Hotfix: cover images now fill the anime card frame cleanly.** Switched `.card img` from `object-fit: contain` to `object-fit: cover` in `style.css:218` so AniList covers (and any source image not pixel-perfect 2:3) crop a few invisible edge pixels rather than letterboxing with visible dark bars inside the card frame.
+
+- `style.css:218` — `object-fit: contain` → `object-fit: cover` on the `.card img` rule. Pure `+1 / -1` diff. Affects both homepage cards (via `card-render.js`'s output) AND the admin form's live preview slot (which inherits the rule via the shared `.card` class).
+
+**Why it slipped through v1.6.5:** the rule was authored long before AniList sources came into use, and the project's 44 curated `assets/*.png` cover images happen to be ≈2:3 (most are 460×686, exactly the form copy's recommended ratio) — so `contain` and `cover` produced identical output in the live catalog. v1.6.5's live preview was the first feature to pipe an AniList CDN URL into a `.card` element, and AniList covers aren't always strictly 2:3 (the Gosick example Blake hit during v1.6.5 smoke is ~420×590, ratio 1:1.405 vs. 2:3's 1:1.5). Visible bars appeared. Queued in `docs/NEXT.md` v1.6.x as a polish ship; addressed here as a same-day hotfix since the AniList live-preview entry path was a v1.6.5 deliverable and visible-broken cards undermine the feature's value.
+
+Tier A — `style.css` is visitor-facing (homepage cards). `npm test` ran clean (7/7 in 15.6s). Blake's local browser check confirmed: live preview card now shows the AniList cover filling the card frame, no empty bars.
+
 <!-- author: Code | date: 2026-05-11 -->
 ## v1.6.5 — MINOR (2026-05-11)
```

Pure prepend. Author marker per project rule #2.

### `ROADMAP.md` — A1 (Live at + chain) + A2 (new v1.6.6 bullet) + B (Up next rewrite)

```diff
diff --git a/ROADMAP.md b/ROADMAP.md
index bed6bb7..86aef3e 100644
--- a/ROADMAP.md
+++ b/ROADMAP.md
@@ -71,7 +71,7 @@ These rules apply to every AI system that touches the project — Code (the buil
 
 ## Current state
 
-**Live at v1.6.5** ... shipped (v1.6.4); Mode 1 live preview as you type (search-as-you-type + ID-import + card-render extraction) shipped (v1.6.5):
+**Live at v1.6.6** ... shipped (v1.6.4); Mode 1 live preview as you type (search-as-you-type + ID-import + card-render extraction) shipped (v1.6.5); cover-image fill hotfix (`object-fit: cover` so AniList covers no longer letterbox) shipped (v1.6.6):
 
@@ -88,8 +88,9 @@ ...
 - v1.6.5 (2026-05-11) — Live preview as you type for the admin form. [unchanged]
+- v1.6.6 (2026-05-11) — Hotfix: cover images now fill the anime card frame cleanly. `style.css:218` — `object-fit: contain` → `object-fit: cover` on `.card img`. Surfaced by Blake during v1.6.5's live preview testing (Gosick example showed dark bars), queued in `docs/NEXT.md` and resolved same-day. Affects both homepage cards and the admin form's live preview via the shared `.card` class.
 
-**Up next:** v1.6.6 — "More Information" panel on anime cards + franchise aggregation. ... After v1.6.6: v1.6.7 suggestion box integration, ...
+**Up next:** v1.6.7 — "More Information" panel on anime cards + franchise aggregation. ... After v1.6.7: v1.6.8 suggestion box integration, ...
```

(Diff abbreviated — the Up next paragraph rewrite is verbatim the same content except `v1.6.6` → `v1.6.7` and the "After" tail `v1.6.6 → v1.6.7 / v1.6.7 → v1.6.8`. Full diff in git.)

### `docs/NEXT.md` — C1 + C2 + C3 + C4 + D1

```diff
diff --git a/docs/NEXT.md b/docs/NEXT.md
index 32b2d2b..e2e058f 100644
--- a/docs/NEXT.md
+++ b/docs/NEXT.md
@@ -9,6 +9,8 @@
 
 ## Recently shipped
 
+- **v1.6.6** (2026-05-11) — Hotfix: cover images now fill the anime card frame cleanly. `object-fit: contain` → `object-fit: cover` on `.card img` in `style.css`. Same-day fix for the bug surfaced during v1.6.5 smoke. See CHANGELOG.
+- **v1.6.5** (2026-05-11) — Live preview as you type for the admin form. Search-as-you-type AniList dropdown, ID-import as first-class entry point (the `b+` design), live card preview via the new shared `card-render.js`. Bundled fixes: sticky positioning (`overflow-x: clip`), title-case canonicalization on AniList fetch. First multi-gate Code/Cowork ship. See CHANGELOG.
 - **v1.6.4** (2026-05-11) — Update log widget upgrade. ...
@@ -34,8 +36,8 @@
 | Version | What | Notes |
 |---|---|---|
-| v1.6.6 | "More Information" panel on anime cards + franchise aggregation | ...[OPM spec — unchanged]... |
-| v1.6.7 | Suggestion Box + admin viewer | ...[unchanged]... |
+| v1.6.7 | "More Information" panel on anime cards + franchise aggregation | ...[OPM spec — unchanged]... |
+| v1.6.8 | Suggestion Box + admin viewer | ...[unchanged]... |
 | v1.6.x | Real one-click AI integration | [unchanged] |
 | v1.6.x | One-click full automation | [unchanged] |
 | v1.6.x | Clickable live preview opens modal | [unchanged] |
-| v1.6.x | Cover image sometimes doesn't fill the entire card | [DELETED — bug resolved in this ship] |
 | v1.7.x | Romaji subtitle on anime cards + modal | [unchanged] |
```

All 5 sub-edits visible:
- C1: `v1.6.6 → v1.6.7` (More Information row) — same spec text preserved
- C2: `v1.6.7 → v1.6.8` (Suggestion Box row) — same content preserved
- C3: Cover-image v1.6.x row DELETED
- C4: v1.6.6 prepended to Recently shipped
- D1: v1.6.5 prepended to Recently shipped (Option β — closes the v1.6.5 gap)

### `index.html` — bump + widget bullet add + bullet drop

```diff
diff --git a/index.html b/index.html
index a78f428..4fe9fe3 100644
--- a/index.html
+++ b/index.html
@@ -5,7 +5,7 @@
   <title>Real Anime Reviews</title>
-  <script>window.APP_VERSION="1.6.5"</script>
+  <script>window.APP_VERSION="1.6.6"</script>
@@ -21,9 +21,9 @@
-  <link rel="stylesheet" href="style.css?v=1.6.5">
-  <link rel="stylesheet" href="mobile.css?v=1.6.5" media="(max-width: 900px)">
-  <link rel="stylesheet" href="admin-fab.css?v=1.6.5">
+  <link rel="stylesheet" href="style.css?v=1.6.6">
+  <link rel="stylesheet" href="mobile.css?v=1.6.6" media="(max-width: 900px)">
+  <link rel="stylesheet" href="admin-fab.css?v=1.6.6">
@@ -166,7 +166,7 @@
-      <span class="changelog-tag" id="changelog-version">v1.6.5</span>
+      <span class="changelog-tag" id="changelog-version">v1.6.6</span>
@@ -174,6 +174,7 @@
       <div class="version-section">
         <div class="version-header">05/11/2026</div>
         <ul class="changelog-list">
+          <li>Fixed a bug where some anime cover images didn't fill the card cleanly.</li>
           <li>Improved the tools used to add new anime to the catalog.</li>
@@ -188,7 +189,6 @@
           <li>New admin tooling — adding anime is now nearly automatic behind the scenes</li>
           <li>Top 10 list refreshed — The Eminence in Shadow is now #1</li>
           <li>Fixed genre typos across the catalog so filtering surfaces every match correctly</li>
-          <li>Apocalypse Bringer Mynoghra now shows its full title</li>
         </ul>
       </div>
```

Five hunks:
- Line 8: `APP_VERSION 1.6.5 → 1.6.6` (gate 5 bump)
- Lines 24-26: 3 CSS cache-busts (gate 5 bump)
- Line 169: changelog widget static fallback `v1.6.5 → v1.6.6` (gate 5 bump — invariant with APP_VERSION above)
- Line 177: new v1.6.6 widget bullet (gate 7)
- Line 191: dropped Apocalypse Bringer bullet (gate 7 10-cap drop)

### `account.html` — pure version bump (gate 5)

```diff
diff --git a/account.html b/account.html
@@ -4,7 +4,7 @@
-  <script>window.APP_VERSION="1.6.5"</script>
+  <script>window.APP_VERSION="1.6.6"</script>
@@ -20,9 +20,9 @@
-  <link rel="stylesheet" href="style.css?v=1.6.5" />
-  <link rel="stylesheet" href="mobile.css?v=1.6.5" media="(max-width: 900px)" />
-  <link rel="stylesheet" href="admin-fab.css?v=1.6.5" />
+  <link rel="stylesheet" href="style.css?v=1.6.6" />
+  <link rel="stylesheet" href="mobile.css?v=1.6.6" media="(max-width: 900px)" />
+  <link rel="stylesheet" href="admin-fab.css?v=1.6.6" />
```

4 strings, all bump-version targets. No other edits.

### `admin/new-anime.html` — pure version bump (gate 5)

```diff
diff --git a/admin/new-anime.html b/admin/new-anime.html
@@ -4,14 +4,14 @@
-  <script>window.APP_VERSION="1.6.5"</script>
+  <script>window.APP_VERSION="1.6.6"</script>
...
-  <link rel="stylesheet" href="../style.css?v=1.6.5" />
-  <link rel="stylesheet" href="../mobile.css?v=1.6.5" media="(max-width: 900px)" />
-  <link rel="stylesheet" href="../admin-fab.css?v=1.6.5" />
-  <link rel="stylesheet" href="new-anime.css?v=1.6.5" />
+  <link rel="stylesheet" href="../style.css?v=1.6.6" />
+  <link rel="stylesheet" href="../mobile.css?v=1.6.6" media="(max-width: 900px)" />
+  <link rel="stylesheet" href="../admin-fab.css?v=1.6.6" />
+  <link rel="stylesheet" href="new-anime.css?v=1.6.6" />
```

5 strings, all bump-version targets. No other edits.

---

## (D) `npm test` re-run

```
> playwright test

Running 7 tests using 1 worker

  ✓ tests\404-page.spec.js:4:3
  ✓ tests\account-page-loads.spec.js:4:3
  ✓ tests\anime-modal-opens-and-closes.spec.js:4:3
  ✓ tests\deep-link-first-load.spec.js:16:3
  ✓ tests\homepage-loads.spec.js:4:3
  ✓ tests\modal-leak-check.spec.js:17:3
  ✓ tests\search-works.spec.js:4:3

  7 passed (17.8s)
```

7/7 clean in 17.8s — within baseline range (v1.6.5 gate-5b/5c were 14.3s and 15.5s; gate 9 of v1.6.5 was the outlier 30.2s). Card-rendering flows (homepage-loads, anime-modal, deep-link, modal-leak, search-works) all pass — the `object-fit: cover` change does not break any test that exercises card rendering or click handlers.

---

## (E) `--check` re-run (final sanity)

```
OK: all 14 strings agree on v1.6.6
```

No drift; 14/14 at 1.6.6.

---

## (F) Self-audit checklist

| Check | Status | Detail |
|---|---|---|
| File count matches expected scope | ✅ | 7 v1.6.6-attributable + 2 rolling SHIP-*.md = 9 total. Cowork's "~6 modified" estimate missed NEXT.md and the 2 rolling files; actual count tracks every gate's intended change. |
| No surprise files | ✅ | Every file in the diff attributable to gate 2/5/6/7/8. No equivalent of v1.6.5's gate-9 `docs/NEXT.md` surprise. |
| Version-string edits = exactly the 14 strings from `--check` | ✅ | account.html (4) + admin/new-anime.html (5) = 9 from bump in those files; index.html (5 from bump including changelog widget) = 14. Plus the +2 widget bullet changes in index.html (add new + drop old) which are gate 7, not gate 5. No surprise edits. |
| Version-bump-affected files have ONLY version-string + intended gate edits | ✅ | account.html: 4 version strings only. admin/new-anime.html: 5 version strings only. index.html: 5 version strings + 2 widget-bullet edits (gate 7 — intended). style.css: only the gate 2 fix. |
| `npm test` 7/7 | ✅ | 17.8s |
| `--check` clean | ✅ | All 14 at 1.6.6 |
| No partial work | ✅ | Every diff hunk is complete; no half-edits |
| `docs/SHIP-PROMPT.md` and `docs/SHIP-OUTPUT.md` are in the modified set, firebase-ignored | ✅ | Both have ` M` markers in `git status`; both covered by `docs/SHIP-*.md` in firebase.json `ignore` array (gate 2's fix from v1.6.5). They'll be committed but not deployed. |
| LF→CRLF warnings | ✅ informational | `.gitattributes` will normalize on next checkout. Same warning class as v1.6.5 gate 9. |

---

## State at end of gate 9 (read-only — no working tree changes)

```
modified:   CHANGELOG.md           (gate 6)
modified:   ROADMAP.md             (gate 8 A1 + A2 + B)
modified:   account.html           (gate 5 — 4 version strings)
modified:   admin/new-anime.html   (gate 5 — 5 version strings)
modified:   docs/NEXT.md           (gate 8 C + D1)
modified:   docs/SHIP-OUTPUT.md    (rolling file — this doc)
modified:   docs/SHIP-PROMPT.md    (rolling file — Cowork's prompts across gates)
modified:   index.html             (gate 5 — 5 version strings; gate 7 — widget bullet add + drop)
modified:   style.css              (gate 2 — object-fit fix)
```

9 modified, 0 untracked. Working tree clean otherwise.

**Awaiting Cowork's gate 9 approval.** Once approved, gate 10 = `git add -A`. Per the discipline reminder, NO `git add` until explicit gate 10 approval. Gates 11-14 proceed per SHIP-PROMPT.md (commit + push → preview deploy → Blake's preview verification → production deploy → curl + smoke verification). Gate 12 ≠ gate 13 — explicit go-signal at each.
