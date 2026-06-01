---
name: madd-workflow-builder
description: Plan and choose the right MADD workflow sequence based on request type, scope, and risk level. Use for orchestration decisions.
metadata:
  short-description: Build MADD workflows
---

# MADD Workflow Builder Skill

Skill for planning and orchestrating multi-role workflows.

## Usage

This skill is used by: `madd-conductor`

## Workflow Decision Matrix

| Request type | Roles required | Sequence |
|--------------|----------------|----------|
| New feature | architect, maker, breaker, witness | Full cycle |
| Bug fix | maker, breaker, witness | Partial cycle |
| Refactor | maker, breaker, witness | Partial cycle |
| Spec only | architect | Single role |
| Security review | breaker, witness | Audit cycle |
| Documentation | witness | Single role |
| Architecture change | architect, maker, breaker, witness | Full cycle |
| Performance fix | maker, breaker | Partial cycle |

## Request Analysis

### Identify request type by intent

- "add", "create", "new", "implement feature" -> New feature
- "fix", "bug", "issue", "broken", "error" -> Bug fix
- "refactor", "clean up", "improve code" -> Refactor
- "plan", "design", "specify", "define" -> Spec only
- "review", "audit", "check", "verify" -> Security review
- "document", "update docs", "changelog" -> Documentation
- "architecture", "restructure", "redesign" -> Architecture change
- "slow", "performance", "optimize" -> Performance fix

### Assess scope from contract

```bash
jq -s 'reduce .[] as $x ({}; . * $x)' .madd/contract.d/*.json
jq '[.tasks.items[] | select(.status == "pending")] | length' .madd/contract.d/40-tasks.json
```

## Templates

### Full feature cycle

1. architect: define intention, requirements, APIs, NFRs, tasks/tests.
2. maker: implement requirements and tests.
3. breaker: verify contract and security compliance.
4. witness: document reality, debt, and changelog.

### Bug fix cycle

1. maker: isolate issue, fix root cause, add regression test.
2. breaker: verify resolution and regression coverage.
3. witness: record implemented fix and remaining debt.

### Spec-only cycle

1. architect: formalize contract updates without implementation.

## Sequencing Rules

### Can run in parallel

- Independent maker tasks on separate components.
- Independent architect edits on unrelated contract sections.

### Must run sequentially

- architect -> maker
- maker -> breaker
- breaker -> witness

## Failure Handling

- Incomplete architect: request clarification before maker.
- Failed implementation: retry with tighter scope/context.
- Breaker rejection: route back to maker with prioritized findings.
- Drift in witness: document as gap for next cycle.
