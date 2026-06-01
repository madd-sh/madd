# MADD Codex Project Rules

This project uses MADD (Multi-Agent Driven Development).

## Default Operating Mode

- If the user does not explicitly choose a role, start with `$madd-conductor`.
- Use `.madd/contract.d/` as the source of truth before code changes.
- Preserve role separation: architect defines, maker implements, ci validates, breaker verifies, witness records reality.
- The conductor decomposes work into **fractions** (independently deliverable units) that each go through domain-scoped maker->ci->breaker cycles.
- Domain detection per fraction: tasks with `domains` annotations trigger domain-specialized Maker/Breaker pairs.
- Adaptive iteration cap per fraction (2-5 based on task count). Global budget: 3 x number of fractions.
- Deterministic mode: for architect/maker/ci/breaker/witness work, conductor must use `spawn_agent` and must not execute role work inline.
- Session state persisted in `.madd/state.json` for resumption across crashes.

## Phase Budget

The conductor MUST complete ALL 5 phases (architect → fractions → witness) within the session:
- Architect: ~5% of session
- Fractions (maker + ci + breaker): ~80% of session
- Witness: ~5% of session
- Buffer: ~10%

**CRITICAL RULE:** After completing ALL maker fractions, the conductor MUST still invoke `breaker` for at least one audit pass AND `witness` for the retro-specification. Never end the workflow without these final phases. An implementation without audit and retro is INCOMPLETE.

If running low on iterations or context:
1. Reduce the number of maker iterations (accept CHANGES_REQUIRED with debt)
2. Combine remaining fractions
3. But NEVER skip the breaker and witness phases

## Role Ownership

| Role | Main scope | Allowed contract writes |
|------|-----------|------------------------|
| `madd-conductor` | Workflow coordination, domain detection, fraction planning | `60-audit-cycle.json`, `.madd/state.json` |
| `madd-architect` | Intention, requirements, domain annotation | `00/10/20/30/40/50` |
| `madd-maker` | Domain-scoped implementation and tests | `40-tasks.json` status fields |
| `madd-ci` | Build/lint/type-check/test validation | None (read-only report) |
| `madd-breaker` | Domain-scoped independent verification | None (read-only report) |
| `madd-witness` | Retro-spec and changelog | `90-retro.json`, `CHANGELOG.md` |

## Workflow Pipeline

```
madd-architect -> fraction-plan -> [per fraction: domain-detect -> maker(s) -> ci -> breaker(s)] -> madd-witness
```

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

## Runtime State

- `.madd/state.json` — Conductor session state (gitignored)
- `.madd/mailbox/` — Inter-agent message passing (gitignored)

## Skills

### Domain Skills — Loaded by Conductor per domain

| Domain | Maker Skill | Breaker Skill |
|--------|-------------|---------------|
| `database` | `madd-database-modeling` | `madd-database-review` |
| `api` | `madd-api-maker` | `madd-api-review` |
| `frontend` | `madd-frontend-maker` | `madd-frontend-review` |
| `security` | `madd-security-maker` | `madd-security-review` |
| `infrastructure` | `madd-infrastructure-maker` | `madd-infrastructure-review` |

### General Skills — Always loaded or supplementary

- `madd-testing-strategy` — Test pyramid, naming, execution
- `madd-ci-validation` — CI checklist, stack detection
- `madd-code-conventions` — Naming, structure, imports
- `madd-database-strategy` — Schema, migrations, indexing

### Architecture & Patterns

- `madd-clean-architecture` — Layers, ports/adapters, DI
- `madd-error-handling` — Error hierarchy, logging, patterns

### Stack-specific

- `madd-typescript` — Strict mode, utility types, async
- `madd-python` — Type hints, pyproject.toml, pytest
- `madd-go` — Standard layout, error idioms, concurrency

### Workflow Skills

- `madd-fraction-planner` — Fraction decomposition algorithm
- `madd-mailbox` — Inter-agent communication format

## Quality Gates

- Maker agent runs CI self-check (build, lint, type-check, tests) before signaling completion
- CI agent validates between every maker and breaker iteration
- Breaker agent uses confidence scoring (0-100) with thresholds to filter noise
- CI failures return to maker without counting as a breaker iteration

## Principle Reminders

1. Intention first.
2. Executable contract.
3. No self-validation.
4. Retro-spec is system memory.
5. Foundations before features.
6. Skills are knowledge contracts.
7. Fractions enable flow — decompose, don't monolith.
8. ALWAYS invoke breaker at least once per fraction — even with a single-pass audit.
9. ALWAYS invoke witness as the final step — never end without retro-specification.
10. When running low on budget, prefer a single-pass breaker over skipping audit entirely.
