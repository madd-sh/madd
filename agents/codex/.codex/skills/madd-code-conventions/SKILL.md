---
name: madd-code-conventions
description: This skill should be used when writing code that must follow professional conventions, reviewing code style, setting up linting rules, organizing file structure, or naming variables/functions/classes. Use when the user mentions "naming convention", "code style", "file structure", "import order", "error handling pattern", "lint rules", "prettier", "eslint", "code organization", or when ensuring code follows professional standards.
metadata:
  short-description: Naming, structure, imports
---

# MADD Code Conventions

## Universal Principles

These apply regardless of language or framework:

1. **Naming reveals intent** — A name should tell you why it exists, what it does, and how it is used
2. **One responsibility per function** — A function does one thing. If "and" appears in its description, split it.
3. **Consistent abstraction level** — Functions in the same module should operate at the same level of abstraction
4. **Fail fast** — Validate inputs early, return/throw on invalid state immediately
5. **No magic values** — Extract constants with meaningful names

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (TS/JS) | kebab-case | `user-service.ts` |
| Files (Python) | snake_case | `user_service.py` |
| Files (Go) | lowercase | `userservice.go` |
| Classes/Types | PascalCase | `UserService`, `AuthConfig` |
| Functions/Methods | camelCase (TS/JS), snake_case (Python/Go) | `getUser()`, `get_user()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Boolean variables | is/has/can/should prefix | `isActive`, `hasPermission` |
| Interfaces (TS) | No prefix | `UserRepository` (not `IUserRepository`) |
| Private fields | Underscore prefix (Python) or `#` (TS) | `_cache`, `#connection` |

## File Organization

### Standard Project Layout

```
src/
├── config/          # Configuration loading, env validation
├── domain/          # Business logic, entities, value objects
│   └── {feature}/   # Grouped by feature/domain
├── infrastructure/  # Database, external APIs, file system
│   ├── database/    # DB connection, migrations, repositories
│   └── http/        # HTTP client wrappers
├── api/             # HTTP handlers, routes, middleware
│   ├── routes/      # Route definitions
│   ├── middleware/   # Auth, logging, error handling
│   └── validators/  # Request validation schemas
├── services/        # Application services (orchestrate domain + infra)
└── utils/           # Pure utility functions (no side effects)
```

### Import Ordering

Group imports in this order, separated by blank lines:

```
1. Standard library / built-in modules
2. Third-party packages
3. Internal/project modules (absolute paths)
4. Relative imports (same module)
```

## Error Handling Patterns

### TypeScript/JavaScript

```typescript
// Define custom error classes per domain
class AuthenticationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Throw specific errors, catch at boundaries
try {
  await authenticateUser(credentials);
} catch (error) {
  if (error instanceof AuthenticationError) {
    return res.status(401).json({ error: error.message, code: error.code });
  }
  throw error; // Re-throw unexpected errors
}
```

### Python

```python
# Custom exceptions in domain layer
class AuthenticationError(Exception):
    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.code = code

# Catch specific exceptions
try:
    authenticate_user(credentials)
except AuthenticationError as e:
    return JSONResponse(status_code=401, content={"error": str(e), "code": e.code})
# Let unexpected exceptions propagate to global handler
```

### Go

```go
// Define sentinel errors or custom error types
var ErrAuthentication = errors.New("authentication failed")

// Always check errors immediately after the call
user, err := authenticateUser(credentials)
if err != nil {
    if errors.Is(err, ErrAuthentication) {
        return c.JSON(401, map[string]string{"error": err.Error()})
    }
    return fmt.Errorf("authenticateUser: %w", err) // Wrap with context
}
```

## Function Length and Complexity

- **Max 30 lines** per function (soft limit). If longer, extract sub-functions.
- **Max 3 levels** of nesting. Use early returns to flatten.
- **Max 4 parameters** per function. If more, use an options/config object.

## Comments

- Do NOT comment what the code does — make the code readable instead
- DO comment **why** when the reason is non-obvious
- DO comment public API contracts (function signatures on exported functions)
- Never leave commented-out code in production

## Additional Resources

For language-specific conventions, consult:
- **`references/conventions-typescript.md`** — TypeScript/JavaScript conventions
- **`references/conventions-python.md`** — Python conventions (PEP 8+)
- **`references/conventions-go.md`** — Go conventions (Effective Go)
