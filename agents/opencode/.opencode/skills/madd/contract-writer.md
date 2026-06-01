# Contract Writer Skill

Skill for writing and updating the MADD contract.

## Usage

This skill is used by: `@madd/spec`, `@madd/scribe`, `@madd/orchestrator`

## Contract Location

```
.madd/
├── contract.schema.json   # Reference (read-only)
└── contract.d/
    ├── 00-meta.json       # @madd/spec writes
    ├── 10-intention.json  # @madd/spec writes
    ├── 20-functional.json # @madd/spec writes
    ├── 30-technical.json  # @madd/spec writes
    ├── 40-tasks.json      # @madd/spec writes, @madd/dev updates status
    ├── 50-operations.json # @madd/spec writes
    ├── 60-audit-cycle.json # @madd/orchestrator writes (recommendations tracking)
    └── 90-retro.json      # @madd/scribe writes ONLY
```

## Write Permissions

| Agent | Can Write |
|-------|-----------|
| @madd/spec | 00, 10, 20, 30, 40, 50 |
| @madd/orchestrator | 60 (audit cycle & recommendations) |
| @madd/scribe | 90 only |
| @madd/dev | 40 (status fields only) |
| @madd/audit | Nothing (read-only, outputs recommendations JSON) |

## Writing Guidelines

### Always
1. Read current file before modifying
2. Preserve existing data, add/update don't replace
3. Use sequential IDs (next available number)
4. Validate JSON syntax before saving

### ID Conventions

| Pattern | Section | Next ID |
|---------|---------|---------|
| `OBJ-xxx` | intention.objectives | OBJ-001, OBJ-002... |
| `RISK-xxx` | intention.risks | RISK-001... |
| `FEAT-xxx` | functional.features | FEAT-001... |
| `REQ-F-xxx` | functional.requirements | REQ-F-001... |
| `WF-xxx` | functional.workflows | WF-001... |
| `BR-xxx` | functional.business_rules | BR-001... |
| `COMP-xxx` | technical.architecture.components | COMP-001... |
| `ADR-xxx` | technical.architecture.decisions | ADR-001... |
| `API-xxx` | technical.api.endpoints | API-001... |
| `REQ-NF-xxx` | technical.nfr.* | REQ-NF-001... |
| `PHASE-xxx` | tasks.phases | PHASE-001... |
| `TASK-xxx` | tasks.items | TASK-001... |
| `TEST-xxx` | tasks.tests | TEST-001... |
| `RB-xxx` | operations.runbooks | RB-001... |
| `REC-xxx` | audit_cycle.recommendations | REC-001... |
| `DEBT-xxx` | retro.debt | DEBT-001... |

## @madd/spec Writing Patterns

### Adding a requirement
```bash
# Read current requirements
jq '.functional.requirements' .madd/contract.d/20-functional.json

# Add new requirement (use jq or edit directly)
jq '.functional.requirements += [{
  "id": "REQ-F-003",
  "feature": "FEAT-001",
  "description": "User can reset password via email",
  "acceptance_criteria": [
    "Reset link sent within 30 seconds",
    "Link expires after 1 hour",
    "Old password invalidated on reset"
  ],
  "validation": {
    "method": "test",
    "test_id": "TEST-003"
  }
}]' .madd/contract.d/20-functional.json > tmp.json && mv tmp.json .madd/contract.d/20-functional.json
```

### Adding an API endpoint
```bash
jq '.technical.api.endpoints += [{
  "id": "API-003",
  "method": "POST",
  "path": "/auth/reset-password",
  "description": "Request password reset",
  "request": {
    "body": {"email": "string:email:required"}
  },
  "responses": {
    "202": {"body": {"message": "Reset email sent"}},
    "400": {"body": {"error": {"code": "INVALID_EMAIL"}}}
  },
  "requirements": ["REQ-F-003"]
}]' .madd/contract.d/30-technical.json > tmp.json && mv tmp.json .madd/contract.d/30-technical.json
```

### Adding a task
```bash
jq '.tasks.items += [{
  "id": "TASK-003",
  "title": "Implement password reset endpoint",
  "phase": "PHASE-001",
  "requirements": ["REQ-F-003"],
  "acceptance": ["Reset email sent", "Link works", "Password updated"],
  "status": "pending"
}]' .madd/contract.d/40-tasks.json > tmp.json && mv tmp.json .madd/contract.d/40-tasks.json
```

## @madd/scribe Writing Patterns

### Update retro with implementation status
```bash
jq '.retro.coverage.requirements.details += [{
  "id": "REQ-F-001",
  "status": "implemented"
}]' .madd/contract.d/90-retro.json > tmp.json && mv tmp.json .madd/contract.d/90-retro.json
```

### Document technical debt
```bash
jq '.retro.debt += [{
  "id": "DEBT-001",
  "type": "todo",
  "location": "src/auth/reset.ts:45",
  "description": "TODO: Add rate limiting for reset requests",
  "impact": "medium",
  "effort": "small",
  "source_rec": null
}]' .madd/contract.d/90-retro.json > tmp.json && mv tmp.json .madd/contract.d/90-retro.json
```

### Convert Unresolved Recommendations to Debt

After 3 audit iterations, convert remaining open/deferred RECs to DEBT:
```bash
# For each unresolved recommendation, create a DEBT entry
jq --arg rec_id "REC-001" \
   --arg debt_id "DEBT-001" \
   --arg sev "blocker" \
   --arg loc "src/db/query.ts:45" \
   --arg title "SQL Injection vulnerability" \
   --arg desc "User input not sanitized" \
'.retro.debt += [{
  "id": $debt_id,
  "type": (if $sev == "blocker" then "fixme" elif $sev == "major" then "todo" else "workaround" end),
  "location": $loc,
  "description": ($title + ": " + $desc),
  "impact": (if $sev == "blocker" or $sev == "major" then "high" elif $sev == "minor" then "medium" else "low" end),
  "effort": "medium",
  "source_rec": $rec_id
}]' .madd/contract.d/90-retro.json > tmp.json && mv tmp.json .madd/contract.d/90-retro.json
```

### Document gap
```bash
jq '.retro.gaps += [{
  "intended": "REQ-F-005: OAuth login",
  "actual": "Not implemented",
  "reason": "Deferred to v2"
}]' .madd/contract.d/90-retro.json > tmp.json && mv tmp.json .madd/contract.d/90-retro.json
```

### Add changelog entry
```bash
jq '.retro.changelog += [{
  "version": "1.1.0",
  "date": "2026-02-02",
  "added": ["Password reset feature"],
  "changed": [],
  "fixed": [],
  "security": ["Rate limiting on auth endpoints"]
}]' .madd/contract.d/90-retro.json > tmp.json && mv tmp.json .madd/contract.d/90-retro.json
```

## Validation

After writing, validate:

```bash
# Check JSON syntax
jq '.' .madd/contract.d/20-functional.json > /dev/null && echo "Valid JSON"

# Validate against schema (if ajv-cli installed)
jq -s 'reduce .[] as $x ({}; . * $x)' .madd/contract.d/*.json | ajv validate -s .madd/contract.schema.json
```

## Status Updates

When updating status fields:

```json
{
  "status": "draft|approved|implemented|verified"  // meta
  "status": "pending|in_progress|done|blocked"     // tasks.items
  "status": "pending|passing|failing|skipped"      // tasks.tests
  "status": "open|in_progress|resolved|deferred|wont_fix"  // audit_cycle.recommendations
}
```

## @madd/orchestrator Writing Patterns

### Initialize Audit Cycle

```bash
jq --arg type "minor" \
   --arg scope "feature" \
   --arg ref "v1.0.0" \
   --arg date "$(date -Is)" \
'.audit_cycle.release_type = $type |
 .audit_cycle.scope = $scope |
 .audit_cycle.baseline_ref = $ref |
 .audit_cycle.started_at = $date |
 .audit_cycle.current_iteration = 1 |
 .audit_cycle.status = "in_progress" |
 .audit_cycle.history = [] |
 .audit_cycle.recommendations = []' \
.madd/contract.d/60-audit-cycle.json > tmp && mv tmp .madd/contract.d/60-audit-cycle.json
```

### Process @madd/audit Output

The @madd/audit agent outputs JSON with two sections:
- `verified_recommendations`: Status updates for existing REC-xxx
- `new_recommendations`: New findings to persist

#### Step 1: Process Verified Recommendations

For each item in `verified_recommendations`:

```bash
# If status is "resolved"
jq --arg id "REC-001" \
   --arg res "Fixed with parameterized queries in commit abc123" \
   --argjson iter 2 \
   --arg date "$(date -Is)" \
'(.audit_cycle.recommendations[] | select(.id == $id)) |= . + {
  "status": "resolved",
  "resolved_in_iteration": $iter,
  "resolution": $res,
  "updated_at": $date
}' .madd/contract.d/60-audit-cycle.json > tmp && mv tmp .madd/contract.d/60-audit-cycle.json

# If status is "still_open" - no update needed (remains open)
```

#### Step 2: Add New Recommendations

Priority calculation:
- `blocker` = 1000, `major` = 100, `minor` = 10, `observation` = 1
- `security` = +50, `compliance` = +40, `quality` = +30, `performance` = +20, `architecture` = +10

For each item in `new_recommendations`:

```bash
# Calculate priority (example: blocker + security = 1050)
PRIORITY=$((1000 + 50))

jq --arg id "REC-001" \
   --arg sev "blocker" \
   --argjson pri "$PRIORITY" \
   --arg cat "security" \
   --arg title "SQL Injection in user query" \
   --arg desc "User input concatenated directly into SQL without sanitization" \
   --arg loc "src/db/users.ts:45" \
   --argjson reqs '["REQ-NF-010"]' \
   --argjson comps '["COMP-002"]' \
   --argjson iter 1 \
   --arg date "$(date -Is)" \
'.audit_cycle.recommendations += [{
  "id": $id,
  "severity": $sev,
  "priority": $pri,
  "category": $cat,
  "status": "open",
  "title": $title,
  "description": $desc,
  "location": $loc,
  "related_requirements": $reqs,
  "related_components": $comps,
  "introduced_in_iteration": $iter,
  "resolved_in_iteration": null,
  "resolution": null,
  "created_at": $date,
  "updated_at": $date
}]' .madd/contract.d/60-audit-cycle.json > tmp && mv tmp .madd/contract.d/60-audit-cycle.json
```

### Update Recommendation Status

```bash
jq --arg id "REC-001" \
   --arg status "resolved" \
   --argjson iter 2 \
   --arg res "Fixed with parameterized queries in commit abc123" \
   --arg date "$(date -Is)" \
'(.audit_cycle.recommendations[] | select(.id == $id)) |= . + {
  "status": $status,
  "resolved_in_iteration": $iter,
  "resolution": $res,
  "updated_at": $date
}' .madd/contract.d/60-audit-cycle.json > tmp && mv tmp .madd/contract.d/60-audit-cycle.json
```

### Record Iteration Result

```bash
jq --arg verdict "CHANGES_REQUIRED" \
   --arg date "$(date -Is)" \
   --arg summary "2 blockers, 3 majors found" \
'.audit_cycle.history += [{
  "iteration": .audit_cycle.current_iteration,
  "verdict": $verdict,
  "date": $date,
  "summary": $summary
}] | .audit_cycle.current_iteration += 1' \
.madd/contract.d/60-audit-cycle.json > tmp && mv tmp .madd/contract.d/60-audit-cycle.json
```

### Query Open Recommendations by Priority

```bash
# Get all open recommendations sorted by priority (lowest = most urgent)
jq '.audit_cycle.recommendations | map(select(.status == "open")) | sort_by(.priority)' \
.madd/contract.d/60-audit-cycle.json

# Get blockers only
jq '.audit_cycle.recommendations | map(select(.status == "open" and .severity == "blocker"))' \
.madd/contract.d/60-audit-cycle.json

# Count by severity
jq '.audit_cycle.recommendations | group_by(.severity) | map({severity: .[0].severity, count: length})' \
.madd/contract.d/60-audit-cycle.json
```

### Complete Audit Cycle

```bash
jq --arg date "$(date -Is)" \
'.audit_cycle.status = "complete" |
 .audit_cycle.completed_at = $date' \
.madd/contract.d/60-audit-cycle.json > tmp && mv tmp .madd/contract.d/60-audit-cycle.json
```
