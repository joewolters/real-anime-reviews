<!-- author: Cowork | date: 2026-06-02 -->
# v1.6.10 — Gate 11 (stage + commit + push) — **FAST-TRACK**

`git add -A` → commit → `git push origin main`.

**Author (non-negotiable, CLAUDE.md convention):** `Blake Wolters <196413457+joewolters@users.noreply.github.com>`. **NO `Co-Authored-By` line of any kind — strip if tooling tries to add it.** This overrides any default harness commit footer (the "Claude Opus 4.x" Co-Authored-By template is NOT used in this repo). Precedent: v1.6.8 (commit `601570f`) and v1.6.9 (commit `7f4fe42`) both shipped with `Co-Authored-By` count = 0 per `git log --pretty=%B`.

**Subject** (≤70 chars, imperative): `Ship v1.6.10: More Info panel polish (dedupe, format pills, staff cap)`

**Body:** condense from CHANGELOG.md v1.6.10 entry — three polish wins + multi-hop deferral note to v1.7.1. ASCII for grep-friendliness.

**Stop:** unexpected file in `git status`; tooling adds Co-Authored-By and won't strip; push rejected; uncommitted changes post-commit.

**Report:** commit SHA, `git log -1 --pretty=fuller HEAD`, `grep -c 'Co-Authored-By'` count = **0**, push confirmation, working tree clean. One-liner.
