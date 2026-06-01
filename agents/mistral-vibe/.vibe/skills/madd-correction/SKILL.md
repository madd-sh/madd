---
name: madd-correction
description: Use when the dev agent needs to fix audit findings. Use when processing "audit feedback", "CHANGES_REQUIRED", "fix findings", "REC-xxx", "blocker", or when iterating on audit corrections. Provides the structured correction process with traceability.
version: 0.1.0
---

# MADD Correction Process

## When to Use

After the orchestrator routes audit findings back to the dev agent with a `CHANGES_REQUIRED` verdict.

## Correction Workflow

### 1. Read Iteration Context

```bash
jq '.audit_cycle.current_iteration' .madd/contract.d/60-audit-cycle.json
```

### 2. Get Prioritized Open Recommendations

```bash
jq '.audit_cycle.recommendations | map(select(.status == "open")) | sort_by(.priority)' .madd/contract.d/60-audit-cycle.json
```

### 3. Process by Priority

| Priority Range | Severity | Action |
|----------------|----------|--------|
| 1-1050 | Blocker | **MUST fix** — blocks approval |
| 100-150 | Major | **SHOULD fix** — if iterations remain |
| 10-60 | Minor | Fix if time allows |
| 1-51 | Observation | Document for future |

### 4. For Each Finding

1. **Read the code** at the specified `location`
2. **Identify root cause** (not just symptom)
3. **Implement fix** with proper error handling
4. **Add test** that would have caught the issue
5. **Document** the fix with REC-xxx reference in commit/comment

### 5. Traceability

When fixing REC-xxx, ensure:
- The fix addresses the root cause described in `description`
- Related requirements (`related_requirements`) still pass
- New test covers the specific scenario
- No regression in related components (`related_components`)

### 6. After All Fixes

1. Re-run all tests
2. Update `tasks.items[].status` and `tasks.tests[].status` in `40-tasks.json`
3. Report to orchestrator: "Fixes complete. Ready for re-audit (iteration N)."

## Rules

- **NEVER** fix by suppressing the check — fix the underlying issue
- **NEVER** fix a finding by breaking something else
- **NEVER** skip the associated test requirement
- **ALWAYS** prioritize blockers over majors over minors
- If remaining iterations are limited, focus exclusively on blockers
