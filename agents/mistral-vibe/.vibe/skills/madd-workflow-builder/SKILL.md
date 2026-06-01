---
name: madd-workflow-builder
description: Planning and orchestrating multi-agent MADD workflows. Used by the orchestrator to determine workflow type, agent sequence, and scope.
version: 0.1.0
---

# MADD Workflow Builder

## Workflow Decision Matrix

| Request Type | Agents Required | Sequence |
|-------------|-----------------|----------|
| New feature | spec → dev → audit → scribe | Full cycle |
| Bug fix | dev → audit → scribe | Partial cycle |
| Refactoring | dev → audit → scribe | Partial cycle |
| Spec only | spec | Single agent |
| Security review | audit → scribe | Audit cycle |
| Documentation | scribe | Single agent |
| Architecture change | spec → dev → audit → scribe | Full cycle |
| Performance fix | dev → audit | Partial cycle |

## Request Analysis

### Identifying Request Type

```
Keywords → Request Type
─────────────────────────
"add", "create", "new", "implement feature" → New feature
"fix", "bug", "issue", "broken", "error" → Bug fix
"refactor", "clean up", "improve code" → Refactoring
"plan", "design", "specify", "define" → Spec only
"review", "audit", "check", "verify" → Security review
"document", "update docs", "changelog" → Documentation
"architecture", "restructure", "redesign" → Architecture change
"slow", "performance", "optimize" → Performance fix
```

### Assessing Scope

```bash
# Check current contract state
jq -s 'reduce .[] as $x ({}; . * $x)' .madd/contract.d/*.json

# Count pending tasks
jq '[.tasks.items[] | select(.status == "pending")] | length' .madd/contract.d/40-tasks.json

# Check related features
jq '.functional.features[] | select(.name | test("keyword"; "i"))' .madd/contract.d/20-functional.json
```

## Workflow Templates

### Template: Full Feature Cycle

```markdown
## Workflow: New Feature

### Step 1: madd-spec
Define the feature in the contract:
- Create FEAT-xxx in functional.features
- Add requirements REQ-F-xxx with acceptance_criteria
- Define API endpoints API-xxx
- Add security NFRs REQ-NF-xxx
- Create tasks TASK-xxx and tests TEST-xxx

### Step 2: madd-dev
Implement the feature:
- Follow REQ-F-xxx requirements
- Implement API-xxx endpoints
- Meet REQ-NF-xxx constraints
- Update task status in 40-tasks.json

### Step 3: madd-audit
Verify implementation:
- Check all REQ-F-xxx are met
- Validate REQ-NF-xxx compliance
- Run security checks
- Produce audit report

### Step 4: madd-scribe
Document reality:
- Update 90-retro.json with implementation status
- Record any technical debt
- Update CHANGELOG.md
```

### Template: Bug Fix Cycle

```markdown
## Workflow: Bug Fix

### Step 1: madd-dev
Investigate and fix:
- Locate the issue
- Implement fix
- Add regression test
- Update task status

### Step 2: madd-audit
Verify fix:
- Confirm bug is resolved
- Check for regressions
- Validate test coverage

### Step 3: madd-scribe
Document fix:
- Update retro with fix details
- Add to changelog under "fixed"
```

### Template: Spec Only

```markdown
## Workflow: Specification

### Step 1: madd-spec
Define without implementing:
- Analyze requirements
- Update relevant contract files
- Create task backlog for future implementation
- Mark contract status as "approved" when complete
```

### Template: Audit Cycle

```markdown
## Workflow: Audit

### Step 1: madd-audit
Review existing code:
- Compare against contract requirements
- Check security compliance
- Identify gaps and issues
- Produce detailed audit report

### Step 2: madd-scribe
Document findings:
- Record gaps in retro
- Document technical debt
- Note security findings
```

## Parallel vs Sequential Execution

### Must Run Sequential
- spec → dev (dev needs contract)
- dev → audit (audit needs implementation)
- audit → scribe (scribe needs approval)

## Error Handling

### If spec Produces Incomplete Contract
→ Request clarification before proceeding to dev

### If dev Implementation Fails
→ Retry with more context, or escalate to user

### If audit Rejects
→ Return to dev with findings, then re-audit

### If scribe Finds Drift
→ Document as gap, flag for next cycle

## Workflow Validation Checklist

Before executing a workflow:

- [ ] Is the request type correctly identified?
- [ ] Are all required agents included?
- [ ] Is the sequence correct (dependencies respected)?
- [ ] Does each agent prompt include necessary context?
- [ ] Are scope boundaries clear?
- [ ] Are success criteria defined?
