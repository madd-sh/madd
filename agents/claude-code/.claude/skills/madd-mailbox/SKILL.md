---
name: madd-mailbox
description: Use this skill for inter-agent communication via the mailbox system. Agents write structured messages to .madd/mailbox/ which the orchestrator reads and routes between invocations.
---

# Mailbox — Inter-Agent Communication

## Purpose

Agents run in isolated sessions. The mailbox allows agents to leave structured messages for the orchestrator to route to other agents in subsequent invocations.

## Location

```
.madd/mailbox/
├── .gitkeep
├── msg-001-dev-FRAC-001.json     # Written by dev
├── msg-002-audit-FRAC-001.json   # Written by audit
└── ...
```

## Message Format

```json
{
  "id": "msg-001",
  "from": "madd-maker",
  "type": "NEED_CLARIFICATION",
  "fraction": "FRAC-001",
  "task": "TASK-003",
  "timestamp": "2025-01-15T10:30:00Z",
  "subject": "Ambiguous requirement REQ-F-005",
  "body": "REQ-F-005 says 'users should be notified' but doesn't specify the notification channel (email, in-app, push). Assumed in-app notifications. Please confirm or clarify.",
  "context": {
    "requirement": "REQ-F-005",
    "assumption_made": "in-app notifications only",
    "impact_if_wrong": "Would need to add email service integration"
  }
}
```

## Message Types

| Type | Sender | When | Orchestrator Action |
|------|--------|------|-------------------|
| `NEED_CLARIFICATION` | dev | Ambiguous requirement encountered | Escalate to user or route to spec |
| `BLOCKER` | dev, ci | Cannot proceed without resolution | Halt fraction, escalate to user |
| `WARNING` | audit | Pattern issue that affects future fractions | Include in next dev handoff |
| `CHECKPOINT` | dev | Significant milestone within a fraction | Log in state.json |
| `DEBT_NOTICE` | audit | Issue deferred, should be tracked | Add to scribe handoff |

## Writing Messages

### Dev Agent

Write a message when:
- A requirement is ambiguous (instead of guessing)
- A dependency is missing or incompatible
- A task is blocked by another task's incomplete output

```bash
cat > .madd/mailbox/msg-001-dev-FRAC-001.json << 'EOF'
{
  "id": "msg-001",
  "from": "madd-maker",
  "type": "NEED_CLARIFICATION",
  "fraction": "FRAC-001",
  "task": "TASK-003",
  "timestamp": "2025-01-15T10:30:00Z",
  "subject": "Short description",
  "body": "Detailed explanation of the issue",
  "context": {}
}
EOF
```

### Audit Agent

Write a message when:
- A pattern issue will affect future fractions
- An observation should be tracked but doesn't warrant a recommendation
- Technical debt should be flagged for the scribe

```bash
cat > .madd/mailbox/msg-002-audit-FRAC-001.json << 'EOF'
{
  "id": "msg-002",
  "from": "madd-breaker",
  "type": "WARNING",
  "fraction": "FRAC-001",
  "timestamp": "2025-01-15T10:30:00Z",
  "subject": "Error handling inconsistency",
  "body": "FRAC-001 uses custom AppError hierarchy but some handlers still throw generic Error. Future fractions should follow the established pattern.",
  "context": {
    "pattern": "AppError hierarchy",
    "locations": ["src/handlers/auth.ts:45", "src/handlers/users.ts:78"]
  }
}
EOF
```

## Reading Messages (Orchestrator)

After each subagent completes, the orchestrator reads all new messages:

```bash
# List all messages for a fraction
ls .madd/mailbox/msg-*-FRAC-001.json 2>/dev/null

# Read all messages
for f in .madd/mailbox/msg-*.json; do
  jq '{id, from, type, subject}' "$f"
done

# Filter by type
for f in .madd/mailbox/msg-*.json; do
  jq 'select(.type == "NEED_CLARIFICATION")' "$f"
done
```

## Routing Rules

| Message Type | Orchestrator Action |
|-------------|-------------------|
| `NEED_CLARIFICATION` | If spec can answer → include in spec handoff. Otherwise → escalate to user. |
| `BLOCKER` | Halt current fraction. Escalate to user with full context. |
| `WARNING` | Include in next dev fraction handoff as "Previous Warnings" section. |
| `CHECKPOINT` | Update state.json with checkpoint info. Continue. |
| `DEBT_NOTICE` | Accumulate. Include all in scribe handoff at end. |

## Cleanup

After the orchestrator routes a message, it can archive it:

```bash
mkdir -p .madd/mailbox/archived
mv .madd/mailbox/msg-001-dev-FRAC-001.json .madd/mailbox/archived/
```

## Rules

- Message IDs are sequential: `msg-001`, `msg-002`, etc.
- File naming: `msg-{id}-{agent}-{fraction}.json`
- Messages are **append-only** — agents never modify existing messages
- The orchestrator is the **only** consumer — agents never read each other's messages directly
- Messages in `.madd/mailbox/` are gitignored (session-specific)
