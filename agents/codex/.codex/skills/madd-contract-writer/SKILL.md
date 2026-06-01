---
name: madd-contract-writer
description: Write and update MADD contract files with strict ownership boundaries and traceable IDs. Use for specification, breaker-cycle state, and retro documentation updates.
metadata:
  short-description: Write contract files safely
---

# Contract Writer Skill

Skill for writing and updating the MADD contract.

## Usage

This skill is used by: `madd-architect`, `madd-witness`, `madd-conductor`

## Contract Location

```text
.madd/
├── contract.schema.json
└── contract.d/
    ├── 00-meta.json       # architect writes
    ├── 10-intention.json  # architect writes
    ├── 20-functional.json # architect writes
    ├── 30-technical.json  # architect writes
    ├── 40-tasks.json      # architect writes, maker updates status
    ├── 50-operations.json # architect writes
    ├── 60-audit-cycle.json # conductor writes
    └── 90-retro.json      # witness writes only
```

## Write Permissions

| Role | Can write |
|------|-----------|
| `madd-architect` | 00, 10, 20, 30, 40, 50 |
| `madd-conductor` | 60 |
| `madd-witness` | 90 |
| `madd-maker` | 40 status only |
| `madd-breaker` | none |

## Writing Guidelines

### Always
1. Read current file before modifying.
2. Preserve existing data, update incrementally.
3. Use sequential IDs.
4. Validate JSON syntax before returning.

### ID Conventions

| Pattern | Section |
|---------|---------|
| `OBJ-xxx` | intention.objectives |
| `RISK-xxx` | intention.risks |
| `FEAT-xxx` | functional.features |
| `REQ-F-xxx` | functional.requirements |
| `WF-xxx` | functional.workflows |
| `BR-xxx` | functional.business_rules |
| `COMP-xxx` | technical.architecture.components |
| `ADR-xxx` | technical.architecture.decisions |
| `API-xxx` | technical.api.endpoints |
| `REQ-NF-xxx` | technical.nfr.* |
| `PHASE-xxx` | tasks.phases |
| `TASK-xxx` | tasks.items |
| `TEST-xxx` | tasks.tests |
| `RB-xxx` | operations.runbooks |
| `REC-xxx` | audit_cycle.recommendations |
| `DEBT-xxx` | retro.debt |

## Validation

```bash
jq '.' .madd/contract.d/20-functional.json > /dev/null
jq -s 'reduce .[] as $x ({}; . * $x)' .madd/contract.d/*.json | ajv validate -s .madd/contract.schema.json
```

## Status Fields

```json
{
  "status": "draft|approved|implemented|verified",
  "status": "pending|in_progress|done|blocked",
  "status": "pending|passing|failing|skipped",
  "status": "open|in_progress|resolved|deferred|wont_fix"
}
```
