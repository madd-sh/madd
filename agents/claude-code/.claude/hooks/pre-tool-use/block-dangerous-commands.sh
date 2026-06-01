#!/usr/bin/env bash
# N1 Guardian — Block dangerous shell commands
# Intercepts Bash tool calls matching destructive patterns

COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

# Destructive filesystem operations
if echo "$COMMAND" | grep -qE '(rm\s+-rf\s+/|rm\s+-rf\s+\*|sudo\s+rm|mkfs\s+|dd\s+if=|chmod\s+777|chown\s+-R\s+root)'; then
  echo '{"decision":"deny","reason":"Blocked: destructive filesystem command. Use targeted operations instead."}' >&2
  exit 2
fi

# Dangerous git operations
if echo "$COMMAND" | grep -qE '(git\s+reset\s+--hard|git\s+checkout\s+--\s+\.|git\s+clean\s+-fd|git\s+push\s+--force\s+origin\s+main|git\s+push\s+-f\s+origin\s+main)'; then
  echo '{"decision":"deny","reason":"Blocked: destructive git operation. These can cause irreversible data loss."}' >&2
  exit 2
fi

# Database destruction
if echo "$COMMAND" | grep -qiE '(DROP\s+DATABASE|DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\w+\s*;)'; then
  echo '{"decision":"deny","reason":"Blocked: destructive database command. Use migrations for schema changes."}' >&2
  exit 2
fi

# System-level commands
if echo "$COMMAND" | grep -qE '(sudo\s+|curl\s+.*\|\s*bash|wget\s+.*\|\s*sh)'; then
  echo '{"decision":"deny","reason":"Blocked: elevated privilege or pipe-to-shell. Install packages through project dependency managers."}' >&2
  exit 2
fi

exit 0
