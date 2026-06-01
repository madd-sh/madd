---
name: madd-correction
description: Fix breaker findings with root-cause remediation, regression tests, and recommendation traceability from REC IDs to code changes.
metadata:
  short-description: Correct breaker findings
---

# Correction Skill

Skill for fixing breaker findings with mandatory traceability.

## Usage

This skill is used by: `madd-maker` (invoked by `madd-conductor` after breaker)

## Transition

Breaker report -> corrected code.

When conductor routes breaker findings to maker, this skill defines the correction process.

## Mandatory Process

### For each blocker or major finding

1. Identify root cause (not only symptom).
2. Implement correction.
3. Add a test that would have detected the issue.
4. Keep traceability with REC-xxx reference.

### For each minor finding

1. Fix it or document a clear acceptance reason.
2. If postponed, ensure it becomes explicit technical debt.

## Correction Format

```text
fix: [REC-xxx] Short description

Root cause: Why this existed
Correction: What changed
Test: TEST-xxx verifies the fix
```

## Reading Audit Findings

### Get prioritized open recommendations

```bash
jq '.audit_cycle.recommendations | map(select(.status == "open")) | sort_by(.priority)' .madd/contract.d/60-audit-cycle.json
```

### Get blockers first

```bash
jq '[.audit_cycle.recommendations[] | select(.status == "open" and .severity == "blocker")]' .madd/contract.d/60-audit-cycle.json
```

Note: `audit_cycle` is the contract section name (not a role name). It stores findings from breaker iterations.

## Rules

- Never deliver a fix without associated test coverage.
- Never introduce regressions while fixing.
- Always trace finding -> correction -> verification.
- Fix in priority order: blockers, majors, minors.
- Escalate architectural changes beyond finding scope to conductor.
