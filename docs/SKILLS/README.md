<!-- author: Code | date: 2026-05-09 -->
# Skills Library

> **What "skills" are here:** repeatable workflow recipes for this project. Each skill is a markdown doc that any AI session (Code, Cowork, future tooling) can read and follow consistently. Think of them as macros — saved instructions that produce the same outcome regardless of who invokes them.
>
> **Why these aren't formal Anthropic Skills:** the formal Skill system requires plugin-style installation. These are project-local — they live in the repo, ship with it, and survive any session. Less ceremony, same effect for our use case.

---

## Available skills

| Skill | What it does | When to use |
|---|---|---|
| [release-skill.md](release-skill.md) | Full ship workflow: test → bump → CHANGELOG → preview → approval → prod. Wraps every step of getting a change live. | Any time you're shipping a new version (PATCH, MINOR, or MAJOR). The `--dry-run` of Mode 1's eventual implementation. |

## Coming soon

These are planned but not yet written. Build when needed:

- **add-anime-skill.md** — wraps the new-anime workflow from `CODE-PROMPTS.md §1`. Becomes the literal Mode 1 implementation when v1.6.0 ships.
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
