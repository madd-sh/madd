---
name: madd-contract-reader
description: Read and interpret the MADD executable contract in .madd/contract.d. Use when implementation, breaker, or retro work needs reliable contract context.
metadata:
  short-description: Read the MADD contract
---

# Contract Reader Skill

Skill for reading and understanding the MADD contract.

## Usage

This skill is used by: `madd-conductor`, `madd-maker`, `madd-breaker`, `madd-witness`

## Contract Location

```text
.madd/contract.d/
├── 00-meta.json       # Project identity, version, status
├── 10-intention.json  # WHY: context, objectives, constraints, risks
├── 20-functional.json # WHAT: actors, features, requirements, workflows
├── 30-technical.json  # HOW: architecture, stack, data model, API, NFR
├── 40-tasks.json      # BUILD: phases, tasks, tests
├── 50-operations.json # RUN: environments, infra, deploy, monitoring
└── 90-retro.json      # REALITY: implementation status, debt, gaps
```

## Reading the Contract

### Merge all files into single JSON
```bash
jq -s 'reduce .[] as $x ({}; . * $x)' .madd/contract.d/*.json
```

### Read specific sections
```bash
# Read requirements
jq '.functional.requirements[]' .madd/contract.d/20-functional.json

# Read API endpoints
jq '.technical.api.endpoints[]' .madd/contract.d/30-technical.json

# Read task status
jq '.tasks.items[] | select(.status == "pending")' .madd/contract.d/40-tasks.json

# Read NFR security requirements
jq '.technical.nfr.security[]' .madd/contract.d/30-technical.json
```

## Key IDs to Track

| Pattern | Section | Example |
|---------|---------|---------|
| `OBJ-xxx` | intention.objectives | OBJ-001 |
| `RISK-xxx` | intention.risks | RISK-001 |
| `FEAT-xxx` | functional.features | FEAT-001 |
| `REQ-F-xxx` | functional.requirements | REQ-F-001 |
| `WF-xxx` | functional.workflows | WF-001 |
| `BR-xxx` | functional.business_rules | BR-001 |
| `COMP-xxx` | technical.architecture.components | COMP-001 |
| `ADR-xxx` | technical.architecture.decisions | ADR-001 |
| `API-xxx` | technical.api.endpoints | API-001 |
| `REQ-NF-xxx` | technical.nfr.* | REQ-NF-001 |
| `PHASE-xxx` | tasks.phases | PHASE-001 |
| `TASK-xxx` | tasks.items | TASK-001 |
| `TEST-xxx` | tasks.tests | TEST-001 |
| `RB-xxx` | operations.runbooks | RB-001 |
| `DEBT-xxx` | retro.debt | DEBT-001 |

## Validation

Schema: `.madd/contract.schema.json`

```bash
jq -s 'reduce .[] as $x ({}; . * $x)' .madd/contract.d/*.json | ajv validate -s .madd/contract.schema.json
```

## What to Look For

### As maker
- `functional.requirements[].acceptance_criteria` - What to implement
- `technical.stack` - What tools/packages to use
- `technical.api.endpoints` - API specs to follow
- `tasks.items` - Tasks assigned to you

### As breaker
- `functional.requirements` - Verify each is implemented
- `technical.nfr.security` - Security checklist
- `technical.nfr.performance` - Performance targets
- `tasks.tests` - Test coverage

### As witness
- `functional.requirements` - Compare with reality
- `technical.architecture.components` - What should exist
- `retro` - Previous state to update
