---
name: MADD CI Validation
description: This skill should be used when running CI checks, validating code before audit, executing build/lint/test pipelines, or verifying implementation readiness. Use when the user mentions "CI check", "validation pipeline", "build check", "lint check", "type check", "pre-audit validation", or when the dev agent needs to self-check before signaling completion.
version: 0.1.0
---

# MADD CI Validation

## Purpose

Run a local CI pipeline to validate code quality before audit. This prevents wasting audit iterations on code that does not compile, has lint errors, or has failing tests.

## CI Checklist

Execute these checks in order. Stop on first failure category (blockers), continue through warnings.

| # | Check | Blocker? | Command Pattern |
|---|-------|----------|-----------------|
| 1 | **Build** | Yes | Compile/transpile succeeds |
| 2 | **Type Check** | Yes | Static type analysis passes |
| 3 | **Lint** | Warning | Linter reports no errors (warnings acceptable) |
| 4 | **Format** | Warning | Code formatting is consistent |
| 5 | **Unit Tests** | Yes | All unit tests pass |
| 6 | **Integration Tests** | Yes | All integration tests pass (if they exist) |

## Stack Detection

Read `30-technical.json` to determine the stack:

```bash
jq '.technical.stack.runtime' .madd/contract.d/30-technical.json
```

## Commands by Stack

### Node.js / TypeScript

```bash
# 1. Build
npm run build 2>&1 || echo "BUILD_FAILED"

# 2. Type check (TypeScript only)
npx tsc --noEmit 2>&1 || echo "TYPECHECK_FAILED"

# 3. Lint
npm run lint 2>&1 || echo "LINT_FAILED"

# 4. Format check (if prettier configured)
npx prettier --check "src/**/*.{ts,tsx,js,jsx}" 2>&1 || echo "FORMAT_FAILED"

# 5-6. Tests
npm test 2>&1 || echo "TESTS_FAILED"
```

### Python

```bash
# 1. Compile check
python -m py_compile src/**/*.py 2>&1 || echo "BUILD_FAILED"

# 2. Type check
mypy src/ 2>&1 || echo "TYPECHECK_FAILED"

# 3. Lint
flake8 src/ 2>&1 || echo "LINT_FAILED"
# or: ruff check src/

# 4. Format check
black --check src/ 2>&1 || echo "FORMAT_FAILED"

# 5-6. Tests
pytest -x 2>&1 || echo "TESTS_FAILED"
```

### Go

```bash
# 1. Build
go build ./... 2>&1 || echo "BUILD_FAILED"

# 2. Type check (implicit in Go compilation)
go vet ./... 2>&1 || echo "TYPECHECK_FAILED"

# 3. Lint
golangci-lint run 2>&1 || echo "LINT_FAILED"

# 4. Format check
gofmt -l . 2>&1 | head -20

# 5-6. Tests
go test ./... 2>&1 || echo "TESTS_FAILED"
```

## CI Report Format

After running checks, produce a structured report:

```
## CI Report

| Check | Status | Details |
|-------|--------|---------|
| Build | PASS/FAIL | Error message if failed |
| Type Check | PASS/FAIL/SKIP | Error count |
| Lint | PASS/WARN/FAIL | Warning count |
| Format | PASS/WARN | Files needing format |
| Unit Tests | PASS/FAIL | X passed, Y failed |
| Integration Tests | PASS/FAIL/SKIP | X passed, Y failed |

**Verdict: PASS / FAIL**
**Blockers: [list if any]**
```

## Decision Rules

| CI Verdict | Action |
|------------|--------|
| All PASS | Proceed to audit |
| Warning only (lint/format) | Proceed to audit with note |
| Any FAIL (build/types/tests) | Return to dev — do NOT proceed to audit |

## Auto-Fix Guidance

Before reporting failure, attempt auto-fix for non-blocking issues:

```bash
# Auto-fix lint (Node.js)
npm run lint -- --fix

# Auto-fix format (Node.js)
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"

# Auto-fix format (Python)
black src/

# Auto-fix format (Go)
gofmt -w .
```

Re-run the check after auto-fix. Only report failure if it persists after auto-fix attempt.

## Additional Resources

For stack-specific CI commands and configuration patterns, consult:
- **`references/commands-by-stack.md`** — Extended command reference with edge cases
