<!-- author: Code | date: 2026-07-08 -->
# v2.1.0 · PART 0 — 🔴 THE DECEMBER REVIEWS RESTORE: **4 reviews restored to their December text, staged & tested. NOT deployed.**

**RESTORE APPLIED (staged, on Blake's "1 and 2" — 2026-07-08).** Restored to git-v1.3.4 December text: **Rascal** (213→710), **An Archdemon's Dilemma** (112→337), **Attack on Titan** (638→690), **Demon Slayer** (558→582). Applied by zip-patching the canonical master (only `sheet1.xml` changed — every other member byte-identical), then `npm run sync` → `animeData.js` (git diff = exactly those 4 Review fields + the sync timestamp, 0 other lines; 44 anime unchanged). `npm test` = **284 passed + 1 flaky** (`g29 ?open=filter`, unrelated to review text; passes clean on isolated re-run) → effectively 285/285. Original master preserved + hash-verified at `Master List/_forensics_2026-07-08T19-54-26Z/Anime_Master_Table.CURRENT-BACKUP.*.xlsx`. **Committed as staged; NO deploy until Blake's explicit go.**

_(Forensics record from the investigation phase follows.)_

## THE HEADLINE
Your December work is **not** broadly gone. Of 44 reviews, the big-update enrichment is **intact and live** for 23+ of them — they're 1.5×–440× longer than your June-2025 pre-update baseline, and **zero** reviews are richer in that old baseline than they are now. The reversion is **real but localized: 2 reviews.** And the two *biggest* apparent recoveries turned out to be **corrupt junk, not your writing** — caught before it could ship.

## PART 0 CONTINUATION — THE ARCHIVE RECOVERY (Wayback) — 2026-07-08
<!-- author: Code | date: 2026-07-08 -->
You approved the web.archive.org check and believe more than 2 reverted. **The Wayback lead is a dead end — and I want to be straight about the hard part.**
- **web.archive.org has ZERO captures of your site — ever.** Checked `realanimereviews.com` (custom domain), `www`, `http`, `/index.html`, `real-anime-reviews.web.app`, and `real-anime-reviews.firebaseapp.com`, via both the CDX API and the availability API (`archived_snapshots: {}` for all). A control query (example.com) returned data, so the API/network work — the Internet Archive simply never crawled this site. Evidence: `_forensics_.../wayback-result.md`.
- **Expanded diff — ALL 44 reviews, git-v1.3.4 vs current-live** (full table: `_forensics_.../expanded-diff-table.md`). Within everything git has ever seen (2026-04-29 →), only **5** reviews ever changed: the 2 material reverts (Rascal, Archdemon) + 3 minor (Attack on Titan −58, Demon Slayer −30, Death Note −20). The other **39 are identical / reworded-same-length / grew** (Watari-kun actually grew +321). **No new reversion surfaced.**
- **Drive-wide content sweep:** no stray `animeData.js` or reviews file exists anywhere on the machine outside the project (searched Documents/Downloads/Desktop/OneDrive/PROJECTS for `const animeData` and distinctive review phrases).
- **The honest hard truth:** your memory is credible, but any trimming you remember happened in the **Dec 2025 → late-April 2026 window** — *before* git's first snapshot (4/29) and with no Wayback capture. The richer December text for those would have lived only in files that no longer exist here (the original December master you can't find + a pre-repo `animeData.js`). **From every source I can reach, that text is not recoverable.**
- **Candidate unchanged** — still just Rascal + Archdemon (Wayback added nothing to recover). The 3 minor stay your call.

### Where a December copy could still survive (needs your go — I did NOT touch these)
1. **Google Drive / Gmail** — did you ever upload or email yourself the original master sheet? Most likely survivor. I can search with your OK (it's your private data).
2. **Your old ChatGPT/GPT history** — the Dec-2025 handoff was for a GPT session; you may have pasted reviews into that chat. Worth you checking.
3. **Windows File History / "Previous Versions"** on the `Master List` folder, or OneDrive recycle/version history — if ever enabled.
4. **Another device / old laptop / phone notes** where you drafted them.

## ROOT CAUSE (with evidence)
The **v1.5.0 "Excel → animeData.js sync"** (commit `3c47366`, 2026-05-09) — the ship where Excel became the authority that regenerates the site data. The master is a **script-maintained file** (internal metadata `Application: SheetJS`, last full-write stamped **2026-05-10**), so its older text for two reviews overwrote the richer hand-authored versions on that first sync.
- Review-text total held at **22,052 chars** from the first commit (v1.3.4, 4/29) through v1.4.3 → **dropped to 21,597 exactly at v1.5.0** → never recovered (HEAD = 21,614). Independently re-derived by a second method (matching rows by `image` filename, since the sync also re-typeset many titles — curly apostrophes, Re:ZERO hyphen→minus, "Forget"→"Forgot Her Glasses").
- Net −438 reconciles perfectly: Rascal −498, Archdemon −225, AoT −52, Demon Slayer −24, Death Note −17, **Watari-kun +321** (grew), plus glyph-only re-typesetting on 15 reviews.

## THE PER-REVIEW DECISION TABLE (the treasure)
| Review | Now | Recover to | Source | Call |
|---|--:|--:|---|---|
| **Rascal Does Not Dream of Bunny Girl Senpai** | 213 | **710** | git v1.3.4 | **RESTORE** — clear strip-down |
| **An Archdemon's Dilemma** | 112 | **337** | git v1.3.4 | **RESTORE** — clear strip-down |
| Attack on Titan | 638 | 690 | git v1.3.4 | **You decide** — parallel edits |
| Demon Slayer | 558 | 582 | git v1.3.4 | **You decide** — parallel edits |
| Death Note | 337 | 354 | git v1.3.4 | Keep current — no real gain |
| ~~Re:ZERO~~ | 737 | ~~3187~~ | June-5 bak | **DO NOT — corrupt junk** |
| ~~The Eminence in Shadow~~ | 458 | ~~1399~~ | June-5 bak | **DO NOT — corrupt junk** |
| Watari-kun's… | 1838 | 1517 | — | keep current (already richest) |
| other 36 reviews | — | — | — | already best / unchanged |

The two "junk" rows: their extra length is `## Animation` + `dgsdgsdg…` keyboard-mash and duplicated fragments from a June-5 structured-editor experiment — **your current versions are the correct ones.** Full side-by-side text (all 7) in `reverted-side-by-side.md`; full write-up in `_forensics_.../REPORT.md`.

## RECOVERY-SOURCE MAP (all checked)
git (every commit, blob, reflog + 1 dangling stash-commit) · all 42 `.bak` files · the `Downloads` copy (byte-identical to master) · 3 CSVs · both handoff docs — the `.docx` (Apr-2026) and the **Dec-16-2025 PDF** (both project prose, **no reviews**) · the June-2025 `.txt` baseline · OneDrive/Desktop/Documents. No release-archive zips exist locally.

## UNRECOVERABLE
Nothing is lost *within* captured history. **Honest caveat:** git begins 2026-04-29 — if your December text was *richer than that 4/29 state*, the extra delta is in **no local file**. Only remaining possible source: **web.archive.org** snapshots of your live `animeData.js` from Dec 2025–Apr 2026 (needs network + your go). (Also: a *Vinland Saga* stub — 69 chars — existed briefly ~5/10 then was dropped; recover only if wanted.)

## THE CANDIDATE (built, NOT applied)
`Anime_Master_Table.CANDIDATE.2026-07-08T19-54-26Z.xlsx` — the master with **only** cells **F39 (Archdemon)** and **F40 (Rascal)** restored to the v1.3.4 text. The 2 "you decide" reviews are deliberately left out.

Built by **patching the string inside the zip member** (`xl/worksheets/sheet1.xml` — the reviews are inline `<v>` cell values; there is no sharedStrings.xml), **not a spreadsheet-library round-trip** (per the canonical-Excel rule). Verified three ways: only `sheet1.xml` differs from the master and it equals the master with exactly the 2 strings swapped; a parser read-back decodes F39/F40 to the exact v1.3.4 text with all 42 other reviews byte-identical; member/row count preserved. **The trap, avoided:** my first attempt used a SheetJS round-trip — it silently re-serialized `sheet1.xml.rels` (104,613→202,917 bytes, member I never touched); a cell-value check wouldn't have caught it. **On your go:** close Excel first (it's open — lock file present), then swap in the candidate or re-run the zip-patch on the live master.

## PREVENTION — the sync tripwire (proposed, not yet built)
Add to `scripts/sync-excel-to-js.js` before write: abort (require `--force`) if total review chars shrink >2%, OR any single review shrinks >25% / >150 chars — with a per-review shrink report. Rascal (−498) and Archdemon (−225) would each have tripped it. Plus: tag one `.bak` per shipped version alongside the existing rotation.

## WHAT I NEED FROM YOU NOW (restore is done & staged)
1. **Deploy the restore?** It's committed but NOT live. A data-only change → `--only hosting` (with your explicit go + affected tracks green). Or hold it to ride out with the rest of v2.1.0.
2. **Attack on Titan note:** the December text I restored says *"This is one of my favorite animes"*; the live version you're replacing had *"This is in my top 3 anime."* If you want that "top 3" phrasing kept, say so and I'll merge it (fix-forward). Same offer for Demon Slayer.
3. **Still want me to search Google Drive / Gmail** for the original December master? — the best remaining shot at anything the pre-git window lost (Wayback was empty). Your data, your call.
4. Otherwise I move to **Part A** (the fix list).

## One-liner reply
The Wayback check came back empty — web.archive.org never archived your site (zero captures, ever), so it can't recover a richer December version; and comparing all 44 reviews across git's full history surfaces nothing beyond the 5 already found. Your instinct that more reverted is credible, but any such trimming happened in the Dec 2025–April 2026 window that predates git's first snapshot and has no web archive, so that text isn't in any source I can reach here — the best remaining shot is your Google Drive / Gmail / old GPT chat, which I can check with your go. The confirmed, recoverable set stays Rascal + Archdemon (candidate built, only F39/F40 changed, verified); master untouched, nothing synced or deployed, holding for your word.
