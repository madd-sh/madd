---
name: madd-project-rules
description: MADD project rules — enforces multi-agent driven development methodology on this project. Loaded for all MADD agents.
version: 0.1.0
---

# MADD Project Rules

This project uses MADD (Multi-Agent Driven Development).

## Default Operating Mode

- For MADD workflow tasks, switch to the `madd-orchestrator` agent (Tab cycle or `--agent madd-orchestrator`).
- Use `.madd/contract.d/` as the source of truth before code changes.
- Preserve role separation: spec defines, dev implements, audit verifies, scribe records reality.
- Enforce max 3 dev/audit iterations before closing with explicit debt in retro.
- Orchestrator must delegate via task tool — never execute role work inline.

## Role Ownership

| Role | Main scope | Allowed contract writes |
|------|-----------|------------------------|
| `madd-orchestrator` | Workflow coordination | `60-audit-cycle.json` |
| `madd-spec` | Intention and requirements | `00/10/20/30/40/50` |
| `madd-dev` | Implementation and tests | `40-tasks.json` status fields |
| `madd-audit` | Independent verification | None (read-only report) |
| `madd-scribe` | Retro-spec and changelog | `90-retro.json`, `CHANGELOG.md` |

## Contract Paths

- `.madd/contract.schema.json`
- `.madd/contract.d/00-meta.json`
- `.madd/contract.d/10-intention.json`
- `.madd/contract.d/20-functional.json`
- `.madd/contract.d/30-technical.json`
- `.madd/contract.d/40-tasks.json`
- `.madd/contract.d/50-operations.json`
- `.madd/contract.d/60-audit-cycle.json`
- `.madd/contract.d/90-retro.json`

## Principle Reminders

1. Intention first.
2. Executable contract.
3. No self-validation.
4. Retro-spec is system memory.
5. Foundations before features.
6. Skills are knowledge contracts.
