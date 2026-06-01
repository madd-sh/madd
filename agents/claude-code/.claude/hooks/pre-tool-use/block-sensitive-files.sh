#!/usr/bin/env bash
# N1 Guardian — Block access to sensitive files
# Intercepts Read/Write/Edit tool calls targeting secrets, credentials, keys

FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

BASENAME=$(basename "$FILE_PATH")
EXTENSION="${BASENAME##*.}"

# Block by exact filename
case "$BASENAME" in
  .env|.env.local|.env.production|.env.staging)
    echo '{"decision":"deny","reason":"Sensitive file blocked: .env files contain secrets. Use environment variables or config/governance/ policies instead."}' >&2
    exit 2 ;;
  credentials.json|secrets.json|service-account.json)
    echo '{"decision":"deny","reason":"Sensitive file blocked: credential files must not be read or modified by agents."}' >&2
    exit 2 ;;
  id_rsa|id_ed25519|id_ecdsa)
    echo '{"decision":"deny","reason":"Sensitive file blocked: SSH private keys must not be accessed."}' >&2
    exit 2 ;;
esac

# Block by extension
case "$EXTENSION" in
  pem|key|p12|pfx|jks|keystore)
    echo '{"decision":"deny","reason":"Sensitive file blocked: certificate/key files must not be accessed."}' >&2
    exit 2 ;;
esac

exit 0
