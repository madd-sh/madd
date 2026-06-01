#!/usr/bin/env bash
# N1 Guardian — Auto-format code after Write/Edit
# Detects project stack and runs the appropriate formatter

FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

EXTENSION="${FILE_PATH##*.}"

case "$EXTENSION" in
  js|jsx|ts|tsx|json|css|scss|md|html|yaml|yml)
    if command -v npx &>/dev/null && [ -f node_modules/.bin/prettier ]; then
      npx prettier --write "$FILE_PATH" 2>/dev/null
    fi ;;
  py)
    if command -v black &>/dev/null; then
      black --quiet "$FILE_PATH" 2>/dev/null
    elif command -v ruff &>/dev/null; then
      ruff format "$FILE_PATH" 2>/dev/null
    fi ;;
  go)
    if command -v gofmt &>/dev/null; then
      gofmt -w "$FILE_PATH" 2>/dev/null
    fi ;;
  rs)
    if command -v rustfmt &>/dev/null; then
      rustfmt "$FILE_PATH" 2>/dev/null
    fi ;;
esac

exit 0
