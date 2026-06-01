# Correction Skill

Skill for fixing audit findings with mandatory traceability.

## Usage

This skill is used by: `@madd/dev` (invoked via `@madd/orchestrator` after audit)

## Transition

**Audit Report → Corrected Code**

When @madd/orchestrator routes audit findings to @madd/dev, this skill defines the correction process.

## Mandatory Process

### For each blocker/major finding

1. **Identify root cause** (not just symptom)
2. **Implement correction**
3. **Add test** that would have detected the problem
4. **Document the correction** in commit message with REC-xxx reference

### For each minor finding

1. Fix or document why acceptable
2. If acceptable: flag as explicit technical debt (will become DEBT-xxx)

## Correction Format

For each finding, the commit and code change must be traceable:

```
fix: [REC-xxx] Short description

Root cause: Why this problem existed
Correction: What was changed
Test: TEST-xxx verifies the fix
```

## Reading Audit Findings

### Get prioritized open recommendations

```bash
jq '.audit_cycle.recommendations | map(select(.status == "open")) | sort_by(.priority)' .madd/contract.d/60-audit-cycle.json
```

### Get blockers (fix first)

```bash
jq '[.audit_cycle.recommendations[] | select(.status == "open" and .severity == "blocker")]' .madd/contract.d/60-audit-cycle.json
```

### Get finding details

```bash
jq --arg id "REC-001" '.audit_cycle.recommendations[] | select(.id == $id)' .madd/contract.d/60-audit-cycle.json
```

## Rules

- **NEVER** correct without an associated test
- **NEVER** apply a fix that breaks something else (run full test suite after each fix)
- **ALWAYS** trace finding → correction → commit (reference REC-xxx in commit)
- Fix in priority order: blockers first, then majors, then minors
- If a fix requires architectural changes beyond the finding scope, escalate to @madd/orchestrator

## After Corrections

1. Run all tests
2. Update task status in `40-tasks.json` if applicable
3. Report to @madd/orchestrator: "Fixes complete. Ready for re-audit (iteration N)."
