# MADD — Claude Code install

Files installed by `madd-init` for the Claude Code agent.

---

## `.claude/agents/` — The six MADD agents

| Agent | Role |
|---|---|
| `madd-conductor.md` | Orchestrates fractions, reads state, delegates to other agents |
| `madd-architect.md` | Designs technical solutions, writes to `30-technical.json` |
| `madd-maker.md` | Implements code, one domain at a time |
| `madd-ci.md` | Runs validation gates (lint, test, build) |
| `madd-breaker.md` | Adversarial review — tries to break what Maker built |
| `madd-witness.md` | Produces retro notes, updates `90-retro.json` |

Invoke them via the `/madd` slash command or directly: `/agent madd-conductor`.

## `.claude/hooks/` — Safety guards

Wired into Claude Code via `.claude/settings.json`.

| Hook | Trigger | Purpose |
|---|---|---|
| `pre-tool-use/block-dangerous-commands.sh` | Before any Bash call | Blocks `rm -rf`, `DROP DATABASE`, `curl \| bash`, force-push |
| `pre-tool-use/block-sensitive-files.sh` | Before any file write | Blocks `.env`, `*.pem`, `*.key`, credential files |
| `post-tool-use/auto-format.sh` | After a file write | Runs the project formatter if available |
| `stop/validate-state.sh` | When Claude stops | Asserts `.madd/state.json` is valid JSON |

## `.claude/rules/` — Code style contracts

Loaded automatically by Claude Code for every session in this project.

| File | Scope |
|---|---|
| `00-base.md` | Minimal diffs, intent alignment, session memory |
| `05-intent-alignment.md` | Never reduce scope without explicit approval |
| `10-javascript.md` | JS/TS conventions |
| `20-python.md` | Python conventions |
| `30-go.md` | Go conventions |
| `99-safety.md` | No secrets, no injections, no unsafe patterns |

## `.claude/skills/` — COSTA knowledge contracts

Skills give agents deep, structured knowledge about a specific domain.
They follow the COSTA N3 level (see `.madd/README.md` for COSTA overview).

| Skill family | Skills |
|---|---|
| Domain makers | `madd-api-maker`, `madd-frontend-maker`, `madd-database-modeling`, `madd-infrastructure-maker`, `madd-security-maker` |
| Domain reviewers | `madd-api-review`, `madd-frontend-review`, `madd-database-review`, `madd-infrastructure-review`, `madd-security-review` |
| Cross-cutting | `madd-fraction-planner`, `madd-contract-writer`, `madd-contract-reader`, `madd-correction`, `madd-error-handling` |
| Language | `madd-typescript`, `madd-python`, `madd-go` |
| CI | `madd-ci`, `madd-ci-validation` |

## `.claude/memory/` — Session memory

`MEMORY.md` is the agent's persistent memory index across sessions.
`insights/` stores structured learnings from past fractions — add entries
after each retro using the `_template.md` format.

## `.claude/commands/madd.md` — Slash command

Registers `/madd` to trigger the Conductor and start or resume a fraction.

## Quick start

```sh
# Open Claude Code in your project
claude

# Start a MADD fraction
/madd
```
