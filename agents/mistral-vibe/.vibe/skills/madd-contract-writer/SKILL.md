---
name: madd-contract-writer
description: How to write or update the MADD contract files in .madd/contract.d/. Use when creating specifications, updating task status, or modifying any contract JSON file. Provides structure rules, validation, and write permission boundaries.
version: 0.1.0
---

# MADD Contract Writer

## Write Permissions by Role

| Role | Allowed Writes |
|------|---------------|
| **madd-spec** | `00-meta.json`, `10-intention.json`, `20-functional.json`, `30-technical.json`, `40-tasks.json`, `50-operations.json` |
| **madd-dev** | `40-tasks.json` (status fields only) |
| **madd-orchestrator** | `60-audit-cycle.json` |
| **madd-scribe** | `90-retro.json`, `CHANGELOG.md` |
| **madd-audit** | None (read-only) |

## Validation Rules

1. **All JSON must be valid** — validate before writing
2. **IDs must be unique** within their section
3. **IDs follow conventions**: `OBJ-xxx`, `FEAT-xxx`, `REQ-F-xxx`, etc.
4. **Every requirement needs `acceptance_criteria`** (non-empty array)
5. **Phases need `category`**: foundation, core, feature, or polish
6. **Phase ordering**: lower-order phases complete before higher-order

## How to Write Safely

### Update a Specific Field

```bash
jq '.meta.status = "approved"' .madd/contract.d/00-meta.json > tmp && mv tmp .madd/contract.d/00-meta.json
```

### Add to an Array

```bash
jq '.functional.requirements += [{"id": "REQ-F-001", "description": "...", "acceptance_criteria": ["..."]}]' \
  .madd/contract.d/20-functional.json > tmp && mv tmp .madd/contract.d/20-functional.json
```

### Update Task Status (DEV only)

```bash
jq '(.tasks.items[] | select(.id == "TASK-001")).status = "done"' \
  .madd/contract.d/40-tasks.json > tmp && mv tmp .madd/contract.d/40-tasks.json
```

## Schema Reference

Validate against: `.madd/contract.schema.json`

```bash
# Merge and validate (requires ajv-cli or similar)
jq -s 'reduce .[] as $x ({}; . * $x)' .madd/contract.d/*.json | ajv validate -s .madd/contract.schema.json
```
