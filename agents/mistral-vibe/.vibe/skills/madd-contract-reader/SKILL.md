---
name: madd-contract-reader
description: How to read, understand, and query the MADD contract in .madd/contract.d/. Use when the user mentions "contract", "requirements", "specification", "intention", or when any MADD agent needs to read the contract state.
version: 0.1.0
---

# MADD Contract Reader

## Contract Location

The MADD contract is a collection of JSON files in `.madd/contract.d/`:

| File | Section | Content |
|------|---------|---------|
| `00-meta.json` | `meta` | Project identity, version, cycle tracking |
| `10-intention.json` | `intention` | Context, objectives, constraints, risks |
| `20-functional.json` | `functional` | Actors, features, requirements, workflows |
| `30-technical.json` | `technical` | Architecture, stack, API, NFR |
| `40-tasks.json` | `tasks` | Phases, task items, test definitions |
| `50-operations.json` | `operations` | Environments, deployment, monitoring |
| `60-audit-cycle.json` | `audit_cycle` | Iteration state, recommendations |
| `90-retro.json` | `retro` | Reality documentation (scribe output) |

Schema: `.madd/contract.schema.json`

## How to Read

### Merge All Files

```bash
jq -s 'reduce .[] as $x ({}; . * $x)' .madd/contract.d/*.json
```

### Read Specific Sections

```bash
# Requirements to implement
jq '.functional.requirements[] | {id, description, acceptance_criteria}' .madd/contract.d/20-functional.json

# Current tech stack
jq '.technical.stack' .madd/contract.d/30-technical.json

# Task status
jq '.tasks.items[] | {id, title, status}' .madd/contract.d/40-tasks.json

# Audit state
jq '.audit_cycle | {current_iteration, status, scope}' .madd/contract.d/60-audit-cycle.json

# Open recommendations
jq '.audit_cycle.recommendations | map(select(.status == "open")) | sort_by(.priority)' .madd/contract.d/60-audit-cycle.json

# Reality vs intention
jq '.retro.coverage.requirements' .madd/contract.d/90-retro.json
```

## ID Conventions

| Pattern | Section |
|---------|---------|
| `OBJ-xxx` | Objectives |
| `FEAT-xxx` | Features |
| `REQ-F-xxx` | Functional requirements |
| `REQ-NF-xxx` | Non-functional requirements |
| `COMP-xxx` | Architecture components |
| `ADR-xxx` | Architecture decisions |
| `API-xxx` | API endpoints |
| `PHASE-xxx` | Execution phases |
| `TASK-xxx` | Task items |
| `TEST-xxx` | Test definitions |
| `WF-xxx` | Workflows |
| `BR-xxx` | Business rules |
| `RISK-xxx` | Risks |
| `RB-xxx` | Runbooks |
| `REC-xxx` | Audit recommendations |
| `DEBT-xxx` | Technical debt |
