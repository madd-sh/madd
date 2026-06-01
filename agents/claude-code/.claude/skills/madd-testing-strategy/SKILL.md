---
name: MADD Testing Strategy
description: This skill should be used when writing tests, planning a testing strategy, choosing test frameworks, setting up test infrastructure, or verifying test coverage. Use when the user mentions "write tests", "testing strategy", "test pyramid", "unit test", "integration test", "e2e test", "test coverage", "test naming", "TDD", or when any MADD agent needs guidance on test creation and execution.
version: 0.1.0
---

# MADD Testing Strategy

## Test Pyramid

Prioritize tests in this order for cost-effectiveness:

| Layer | Ratio | Speed | Scope | When to Write |
|-------|-------|-------|-------|---------------|
| **Unit** | 70% | Fast (<100ms each) | Single function/class | Every requirement |
| **Integration** | 20% | Medium (<5s each) | Module boundaries, DB, API | Every API endpoint and data flow |
| **E2E** | 10% | Slow (<30s each) | Full user workflow | Critical business paths only |

## Test File Conventions

### Discovery Pattern

Place test files adjacent to source or in a parallel `__tests__/` directory:

```
# Adjacent (preferred for unit tests)
src/auth/login.ts        → src/auth/login.test.ts
src/auth/login.py        → src/auth/test_login.py
src/auth/login.go        → src/auth/login_test.go

# Parallel directory (for integration/e2e)
tests/integration/auth.test.ts
tests/e2e/login-flow.test.ts
```

### Naming Convention

```
# Unit test: describe the function behavior
"should return token when credentials are valid"
"should throw AuthError when password is incorrect"

# Integration test: describe the flow
"POST /auth/login returns 200 with valid JWT"
"database transaction rolls back on constraint violation"

# E2e test: describe the user story
"user can register, login, and access dashboard"
```

## Test Structure (AAA Pattern)

Every test follows **Arrange → Act → Assert**:

```
1. Arrange: Set up test data, mocks, fixtures
2. Act:     Call the function/endpoint under test
3. Assert:  Verify the expected outcome
```

Rules:
- One logical assertion per test (multiple `expect` calls are fine if they verify the same behavior)
- No logic in tests (no `if`, `for`, `try/catch`)
- Tests must be independent (no shared mutable state between tests)
- Tests must be deterministic (no random data, no time-dependent assertions without mocking)

## Mapping Contract Tests to Code

For each `TEST-xxx` in `40-tasks.json`:

1. Read the test definition: `jq '.tasks.tests[] | select(.id == "TEST-xxx")' .madd/contract.d/40-tasks.json`
2. Identify the linked requirement: `related_requirement` field
3. Write test(s) that verify the requirement's `acceptance_criteria`
4. Name the test file to match the component: `{component}.test.{ext}`
5. After writing, run and verify passing before moving to next requirement

## Execution Commands by Stack

```bash
# Node.js / TypeScript
npm test                      # Run all tests
npx jest --coverage           # With coverage report
npx jest --testPathPattern auth  # Run specific test files

# Python
pytest                        # Run all tests
pytest --cov=src              # With coverage
pytest tests/unit/ -x         # Run subset, stop on first failure

# Go
go test ./...                 # Run all tests
go test ./... -cover          # With coverage
go test ./internal/auth/...   # Run specific package
```

## Coverage Targets

| Test Type | Minimum | Target |
|-----------|---------|--------|
| Unit | 70% line coverage | 85% |
| Integration | All API endpoints tested | All public contracts |
| E2E | Critical paths covered | Happy + error paths |

## When Tests Fail

1. Read the failure output carefully — identify the failing assertion
2. Determine if it is a **code bug** (fix the code) or a **test bug** (fix the test)
3. Never delete a failing test to make the suite pass
4. Never add `skip` or `xit` without documenting the reason

## Additional Resources

For framework-specific patterns, consult:
- **`references/patterns-jest.md`** — Jest/Vitest patterns for TypeScript/JavaScript
- **`references/patterns-pytest.md`** — Pytest patterns for Python
- **`references/patterns-go-test.md`** — Go testing patterns
