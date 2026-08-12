<!-- author: Cowork | date: 2026-06-02 -->
# Skills Library

> **What "skills" are here:** repeatable workflow recipes for this project. Each skill is a markdown doc that any AI session (Code, Cowork, future tooling) can read and follow consistently. Think of them as macros — saved instructions that produce the same outcome regardless of who invokes them.
>
> **Why these aren't formal Anthropic Skills:** the formal Skill system requires plugin-style installation. These are project-local — they live in the repo, ship with it, and survive any session. Less ceremony, same effect for our use case.

---

## Available skills

| Skill | What it does | When to use |
|---|---|---|
| [release-skill.md](release-skill.md) | Full ship workflow: test → bump → CHANGELOG → widget → ROADMAP → preview → approval → prod. Wraps every step of getting a change live. Includes the Cowork-Code 12-gate mapping at top. | Any time you're shipping a new version (PATCH, MINOR, or MAJOR). The operational spec behind both solo-Code ships and Cowork-Code multi-gate ships. |
| [hotfix-skill.md](hotfix-skill.md) | Abbreviated release for small, urgent PATCH-tier bug fixes. Compresses the 12 steps where safe (e.g. preview skipped for mechanical reverts). Documents the "Mode 1 itself is broken, ship manually" fallback. | A bug is currently affecting users, the fix is ≤ 3 files / a handful of lines, and PATCH-tier. If it grows, switch to release-skill. |
| [widget-update-skill.md](widget-update-skill.md) | Visitor-first curation rules for the homepage CHANGELOG widget — what to write, what to avoid, how multi-piece ships get multiple bullets, how date sections work. | Runs as a sub-step inside release-skill / hotfix-skill (and inside gate 5 of the 12-gate Cowork-Code ship). Mode 1's pipeline handles this automatically for new-anime ships. |

## Coming soon

These are planned but not yet written. Build when needed:

- **add-anime-skill.md** — wraps the new-anime workflow from `CODE-PROMPTS.md §1`. Mode 1 already implements this for the automated path; the skill is the manual / non-Mode-1 spec.
- **audit-fix-skill.md** — wraps the per-finding audit-item fix pattern from `CODE-PROMPTS.md §2`. Useful for closing out the remaining 30+ audit items.
- **patch-bundle-skill.md** — wraps the "ship 3-5 small fixes as one PATCH" pattern from `CODE-PROMPTS.md §4`.

## How to invoke a skill

In a Code session:

> "Follow the release skill at `docs/SKILLS/release-skill.md` to ship version X.Y.Z. Inputs: [list whatever the skill asks for]."

In a Cowork chat session: paste the skill's content into context, then ask the assistant to follow it. (The assistant can also read it directly from the repo.)

In a Mode 1 / Mode 2 implementation: the skill IS the implementation spec. The code that implements Mode 1 should literally execute the steps in `release-skill.md`.

## How to add a new skill

1. Identify a workflow you find yourself describing more than twice in different sessions.
2. Write it as a markdown file in this directory.
3. Add a row to the table above.
4. Reference it from the relevant section of `CODE-PROMPTS.md` (so Code sessions discover it).
5. Commit as part of the next docs ship.
