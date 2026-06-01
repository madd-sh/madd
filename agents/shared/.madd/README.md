# MADD — Multi-Agent Driven Development

This directory and the adjacent `.claude/` directory were installed by `madd-init`.
They implement the MADD methodology: a structured way to develop software using
a team of specialised AI agents, each with a defined role and scope.

---

## File families

### `.madd/contract.d/` — The project contract

The contract is the single source of truth shared by all agents.
It is split into numbered sections so each agent can read exactly what it needs:

| File | Content |
|---|---|
| `00-meta.json` | Project name, version, `maddVersion`, cycle ID |
| `10-intention.json` | Goals, non-goals, constraints |
| `20-functional.json` | User stories, acceptance criteria |
| `30-technical.json` | Stack, architecture decisions, dependencies |
| `40-tasks.json` | Current fraction tasks and their status |
| `50-operations.json` | Deployment, monitoring, runbooks |
| `60-audit-cycle.json` | Breaker findings and resolutions |
| `90-retro.json` | Retrospective notes produced by Witness |

The `maddVersion` field in `00-meta.json` pins which version of the MADD
boilerplate was used, enabling benchmark comparisons across projects.

### `.madd/state.json` — Live workflow state

Tracks which agent is active and which fraction is in progress.
Written by the Conductor at the start of each fraction, read by all agents.

### `.madd/mailbox/` — Inter-agent messages

Agents post structured messages here when they need to hand off work
or flag a blocking issue. The Conductor polls it between fractions.

### `.madd/contract.schema.json` — JSON Schema

Validates the contract files. Agents use it to check their writes
before committing a contract update.

---

### `.claude/agents/` — The six MADD agents

Each file is a Claude sub-agent definition (name, role, instructions):

| Agent | Role |
|---|---|
| `madd-conductor.md` | Orchestrates fractions, reads state, delegates to other agents |
| `madd-architect.md` | Designs technical solutions, writes to `30-technical.json` |
| `madd-maker.md` | Implements code, one domain at a time |
| `madd-ci.md` | Runs validation gates (lint, test, build) |
| `madd-breaker.md` | Adversarial review — tries to break what Maker built |
| `madd-witness.md` | Produces retro notes and updates `90-retro.json` |

A **fraction** is one unit of work: Conductor plans it, Maker builds it,
CI validates it, Breaker audits it, Witness records it.

### `.claude/hooks/` — Safety guards

Shell scripts wired into Claude Code's hook system via `.claude/settings.json`:

| Hook | Trigger | Purpose |
|---|---|---|
| `pre-tool-use/block-dangerous-commands.sh` | Before any Bash call | Blocks `rm -rf`, `DROP DATABASE`, `curl \| bash`, force-push |
| `pre-tool-use/block-sensitive-files.sh` | Before any file write | Blocks `.env`, `*.pem`, `*.key`, credential files |
| `post-tool-use/auto-format.sh` | After a file write | Runs the project formatter if available |
| `stop/validate-state.sh` | When Claude stops | Asserts `.madd/state.json` is valid JSON |

### `.claude/skills/` — Knowledge contracts (COSTA)

Skills are Markdown files that give an agent deep, structured knowledge
about a specific domain. They follow the **COSTA framework** (see below).

Each skill covers: when to use it, key constraints, step-by-step approach,
output format, and common failure modes.

| Skill family | Examples |
|---|---|
| Domain makers | `madd-api-maker`, `madd-frontend-maker`, `madd-database-modeling` |
| Domain reviewers | `madd-api-review`, `madd-frontend-review`, `madd-security-review` |
| Cross-cutting | `madd-fraction-planner`, `madd-contract-writer`, `madd-correction` |
| Language | `madd-typescript`, `madd-python`, `madd-go` |

### `.claude/rules/` — Code style contracts

Markdown rules loaded by Claude Code for every session in this project:

| File | Scope |
|---|---|
| `00-base.md` | Universal: minimal diffs, intent alignment, session memory |
| `05-intent-alignment.md` | Never reduce scope without explicit approval |
| `10-javascript.md` | JS/TS conventions |
| `20-python.md` | Python conventions |
| `30-go.md` | Go conventions |
| `99-safety.md` | Security: no secrets, no injections, no unsafe patterns |

### `.claude/commands/` — Slash commands

`madd.md` registers the `/madd` slash command, which triggers the
Conductor to start or resume a development fraction.

### `.claude/memory/` — Session memory

`MEMORY.md` is the agent's persistent memory index across sessions.
`insights/` stores structured learnings from past fractions.

---

## COSTA framework

COSTA (Cognitive Stack Architecture) defines six levels of agent capability,
each unlocking more powerful tooling:

| Level | Name | What it adds |
|---|---|---|
| N1 | Foundation | Formatter, linter, basic hooks |
| N2 | Validation | Test runner, pre-commit checks |
| N3 | Intelligence | Claude Code sub-agents, skills |
| N4 | Memory | Persistent session memory, insights |
| N5 | Governance | MCP servers, policy enforcement |
| N6 | Orchestration | Multi-agent workflows, fraction planning |

`madd-init` installs a full N1-N6 stack for the selected agents.
The skills in `.claude/skills/` are the N3 knowledge contracts;
the hooks in `.claude/hooks/` are the N1-N2 safety layer.

---

## How a fraction works

```
Conductor reads contract.d/ + state.json
  -> plans the fraction tasks (40-tasks.json)
    -> Architect validates technical approach (30-technical.json)
      -> Maker implements (one domain per sub-fraction)
        -> CI validates (lint + test + build)
          -> Breaker audits (60-audit-cycle.json)
            -> Witness writes retro (90-retro.json)
              -> Conductor updates state.json, signals done
```

Each arrow is a hand-off via the mailbox or a direct sub-agent call.
The Breaker can send work back to Maker; the cycle repeats until CI and
Breaker both pass.

---

## Quick reference

```sh
# Start or resume a fraction
/madd

# Validate the MADD install
madd-init doctor .

# Update MADD files (diff + confirm per file)
madd-init update .
```
