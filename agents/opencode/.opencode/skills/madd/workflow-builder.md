# MADD Workflow Builder Skill

Skill for planning and orchestrating multi-agent workflows.

## Usage

This skill is used by: `@madd/orchestrator`

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

### Step 1: @madd/spec
Define the feature in the contract:
- Create FEAT-xxx in functional.features
- Add requirements REQ-F-xxx with acceptance_criteria
- Define API endpoints API-xxx
- Add security NFRs REQ-NF-xxx
- Create tasks TASK-xxx and tests TEST-xxx

### Step 2: @madd/dev
Implement the feature:
- Follow REQ-F-xxx requirements
- Implement API-xxx endpoints
- Meet REQ-NF-xxx constraints
- Update task status in 40-tasks.json

### Step 3: @madd/audit
Verify implementation:
- Check all REQ-F-xxx are met
- Validate REQ-NF-xxx compliance
- Run security checks
- Produce audit report

### Step 4: @madd/scribe
Document reality:
- Update 90-retro.json with implementation status
- Record any technical debt
- Update CHANGELOG.md
```

### Template: Bug Fix Cycle

```markdown
## Workflow: Bug Fix

### Step 1: @madd/dev
Investigate and fix:
- Locate the issue
- Implement fix
- Add regression test
- Update task status

### Step 2: @madd/audit
Verify fix:
- Confirm bug is resolved
- Check for regressions
- Validate test coverage

### Step 3: @madd/scribe
Document fix:
- Update retro with fix details
- Add to changelog under "fixed"
```

### Template: Spec Only

```markdown
## Workflow: Specification

### Step 1: @madd/spec
Define without implementing:
- Analyze requirements
- Update relevant contract files
- Create task backlog for future implementation
- Mark contract status as "approved" when complete
```

### Template: Audit Cycle

```markdown
## Workflow: Audit

### Step 1: @madd/audit
Review existing code:
- Compare against contract requirements
- Check security compliance
- Identify gaps and issues
- Produce detailed audit report

### Step 2: @madd/scribe
Document findings:
- Record gaps in retro
- Document technical debt
- Note security findings
```

## Prompt Optimization Patterns

### Context Injection
Always include relevant contract context:

```markdown
**Context from contract:**
- Project: {meta.name} v{meta.version}
- Related features: {functional.features relevant to request}
- Existing requirements: {functional.requirements related}
- Tech stack: {technical.stack}
```

### Scope Boundaries
Be explicit about boundaries:

```markdown
**In scope:**
- [Specific items to address]

**Out of scope:**
- [What NOT to do]
```

### Success Criteria
Define what "done" looks like:

```markdown
**Expected deliverables:**
- [Specific files or artifacts]
- [Status updates required]
- [Tests to pass]
```

## Parallel vs Sequential Execution

### Can Run in Parallel
- Multiple @madd/dev tasks on independent components
- @madd/spec updates to unrelated contract sections

### Must Run Sequential
- @madd/spec → @madd/dev (dev needs contract)
- @madd/dev → @madd/audit (audit needs implementation)
- @madd/audit → @madd/scribe (scribe needs approval)

## Error Handling

### If @madd/spec Produces Incomplete Contract
→ Request clarification before proceeding to @madd/dev

### If @madd/dev Implementation Fails
→ Retry with more context, or escalate to user

### If @madd/audit Rejects
→ Return to @madd/dev with findings, then re-audit

### If @madd/scribe Finds Drift
→ Document as gap, flag for next cycle

## Workflow Validation Checklist

Before executing a workflow:

- [ ] Is the request type correctly identified?
- [ ] Are all required agents included?
- [ ] Is the sequence correct (dependencies respected)?
- [ ] Does each agent prompt include necessary context?
- [ ] Are scope boundaries clear?
- [ ] Are success criteria defined?

## Example: Complex Request Decomposition

```
User: "Add OAuth login with Google and GitHub, and make sure it's secure"

Analysis:
- Type: New feature (authentication expansion)
- Scope: OAuth providers, security requirements
- Complexity: High (multiple providers, security focus)

Workflow:
1. @madd/spec: Define OAuth requirements
   - FEAT-002: OAuth authentication
   - REQ-F-010: Google OAuth login
   - REQ-F-011: GitHub OAuth login
   - REQ-NF-015: OAuth token security
   - API-010: GET /auth/oauth/:provider
   - API-011: GET /auth/oauth/:provider/callback

2. @madd/dev: Implement OAuth
   - OAuth provider abstraction
   - Google integration
   - GitHub integration
   - Token handling
   - Tests for each flow

3. @madd/audit: Security review (thorough)
   - OAuth flow security
   - Token storage
   - Callback validation
   - State parameter usage
   - CSRF protection

4. @madd/scribe: Document
   - OAuth implementation status
   - Security measures taken
   - Any limitations or debt
```
