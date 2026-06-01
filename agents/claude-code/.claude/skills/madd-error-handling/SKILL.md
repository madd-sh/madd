---
name: madd-error-handling
description: Use this skill when implementing or verifying error handling. Covers error hierarchy design, propagation patterns, logging strategy, and stack-specific idioms for TypeScript, Python, and Go.
---

# Error Handling Patterns

## Universal Principles

1. **Errors are values** — Handle them explicitly, never silently swallow
2. **Fail fast at boundaries** — Validate inputs at system edges (API, CLI, external data)
3. **Propagate with context** — Each layer adds context about what it was doing
4. **Log once at the boundary** — Don't log at every layer (creates duplicate noise)
5. **Distinguish operational vs programmer errors** — Operational (network down, bad input) vs bugs (null pointer, type error)

## Error Classification

| Type | HTTP Code | Retryable | Example | Action |
|------|-----------|-----------|---------|--------|
| Validation | 400/422 | No | Invalid email format | Return details to client |
| Authentication | 401 | No | Bad token | Return generic message |
| Authorization | 403 | No | Insufficient role | Return generic message |
| Not Found | 404 | No | Resource doesn't exist | Return with resource type |
| Conflict | 409 | Maybe | Duplicate email | Return with conflict field |
| Rate Limited | 429 | Yes | Too many requests | Return Retry-After header |
| Internal | 500 | Maybe | Unexpected error | Log full details, return generic message |
| Unavailable | 503 | Yes | DB connection failed | Log, return Retry-After |

## NEVER expose to clients:
- Stack traces
- Internal file paths
- Database query details
- Environment variables
- Third-party service details

---

## TypeScript Error Handling

### Custom Error Hierarchy

```typescript
// Base application error
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    // Maintains proper stack trace for where error was thrown (V8 only)
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly to maintain instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, true, context);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, true, { resource, identifier });
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, true);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, true);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 409, true, context);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number; // seconds

  constructor(retryAfter: number = 60) {
    super('Rate limit exceeded', 429, true, { retryAfter });
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, true);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}
```

### Express Error Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';
import { logger } from './logger';

// Standard error response format
interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
}

// Error handling middleware (must be last)
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error with context
  const errorContext = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: (req as any).user?.id,
    requestId: (req as any).id,
  };

  if (err instanceof AppError) {
    // Log operational errors at appropriate level
    if (err.statusCode >= 500) {
      logger.error('Operational error', { error: err, ...errorContext });
    } else if (err.statusCode >= 400) {
      logger.warn('Client error', { error: err, ...errorContext });
    }

    // Send appropriate response
    const response: ErrorResponse = {
      error: {
        message: err.message,
        ...(err.context && { details: err.context }),
      },
    };

    res.status(err.statusCode).json(response);
  } else {
    // Programmer error or unexpected error
    logger.error('Unexpected error', { error: err, ...errorContext, stack: err.stack });

    // Never expose internal error details
    const response: ErrorResponse = {
      error: {
        message: 'An unexpected error occurred',
      },
    };

    res.status(500).json(response);
  }
}

// Async handler wrapper to avoid try/catch in every route
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Example usage
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User', req.params.id);
  }
  res.json(user);
}));

// Global unhandled rejection handler
process.on('unhandledRejection', (reason: Error | any) => {
  logger.error('Unhandled rejection', { reason, stack: reason?.stack });
  // Graceful shutdown
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error, stack: error.stack });
  // Graceful shutdown
  process.exit(1);
});
```

### Fastify Error Handling

```typescript
import Fastify from 'fastify';
import { AppError } from './errors';
import { logger } from './logger';

const app = Fastify({
  logger: false, // Use custom logger instead
});

// Custom error handler
app.setErrorHandler((error, request, reply) => {
  const errorContext = {
    method: request.method,
    url: request.url,
    ip: request.ip,
    userId: (request as any).user?.id,
    requestId: request.id,
  };

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error('Operational error', { error, ...errorContext });
    } else if (error.statusCode >= 400) {
      logger.warn('Client error', { error, ...errorContext });
    }

    reply.status(error.statusCode).send({
      error: {
        message: error.message,
        ...(error.context && { details: error.context }),
      },
    });
  } else {
    logger.error('Unexpected error', { error, ...errorContext, stack: error.stack });

    reply.status(500).send({
      error: {
        message: 'An unexpected error occurred',
      },
    });
  }
});

// Example route with error handling
app.get('/users/:id', async (request, reply) => {
  const user = await userService.findById(request.params.id);
  if (!user) {
    throw new NotFoundError('User', request.params.id);
  }
  return user;
});
```

### Result Pattern (Alternative to Exceptions)

```typescript
// Result type for operations that can fail
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helper functions
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Example usage in service layer
export class UserService {
  async findById(id: string): Promise<Result<User, NotFoundError>> {
    const user = await this.repository.findOne({ id });

    if (!user) {
      return Err(new NotFoundError('User', id));
    }

    return Ok(user);
  }

  async create(data: CreateUserDto): Promise<Result<User, ValidationError | ConflictError>> {
    // Validate
    const validation = this.validate(data);
    if (!validation.ok) {
      return validation;
    }

    // Check for duplicates
    const existing = await this.repository.findOne({ email: data.email });
    if (existing) {
      return Err(new ConflictError('User with this email already exists', { email: data.email }));
    }

    const user = await this.repository.create(data);
    return Ok(user);
  }
}

// Usage in controller
app.post('/users', asyncHandler(async (req, res) => {
  const result = await userService.create(req.body);

  if (!result.ok) {
    throw result.error; // Let error middleware handle it
  }

  res.status(201).json(result.value);
}));
```

### Async Error Handling Patterns

```typescript
// WRONG: Unhandled promise rejection
async function badExample() {
  fetchData().then(data => {
    processData(data); // If this throws, it's unhandled
  });
}

// CORRECT: Await or catch
async function goodExample() {
  try {
    const data = await fetchData();
    processData(data);
  } catch (error) {
    logger.error('Failed to process data', { error });
    throw new AppError('Data processing failed', 500);
  }
}

// CORRECT: With .catch()
async function alternativeExample() {
  return fetchData()
    .then(data => processData(data))
    .catch(error => {
      logger.error('Failed to process data', { error });
      throw new AppError('Data processing failed', 500);
    });
}

// Parallel operations with proper error handling
async function parallelOperations() {
  try {
    const [users, posts, comments] = await Promise.all([
      fetchUsers(),
      fetchPosts(),
      fetchComments(),
    ]);
    return { users, posts, comments };
  } catch (error) {
    // One failure fails all - use Promise.allSettled if you want partial success
    throw new AppError('Failed to fetch data', 500, true, { originalError: error });
  }
}

// Partial success pattern
async function partialSuccess() {
  const results = await Promise.allSettled([
    fetchUsers(),
    fetchPosts(),
    fetchComments(),
  ]);

  const data = {
    users: results[0].status === 'fulfilled' ? results[0].value : [],
    posts: results[1].status === 'fulfilled' ? results[1].value : [],
    comments: results[2].status === 'fulfilled' ? results[2].value : [],
  };

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => r.reason);

  if (errors.length > 0) {
    logger.warn('Some operations failed', { errors });
  }

  return data;
}
```

---

## Python Error Handling

### Custom Exception Hierarchy

```python
from typing import Optional, Dict, Any

class AppError(Exception):
    """Base application error."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        is_operational: bool = True,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.is_operational = is_operational
        self.context = context or {}


class ValidationError(AppError):
    """Validation error (400)."""

    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(message, 400, True, context)


class NotFoundError(AppError):
    """Resource not found (404)."""

    def __init__(self, resource: str, identifier: Optional[str] = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with identifier '{identifier}' not found"
        context = {"resource": resource}
        if identifier:
            context["identifier"] = identifier
        super().__init__(message, 404, True, context)


class UnauthorizedError(AppError):
    """Authentication required (401)."""

    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, 401, True)


class ForbiddenError(AppError):
    """Insufficient permissions (403)."""

    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, 403, True)


class ConflictError(AppError):
    """Resource conflict (409)."""

    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(message, 409, True, context)


class RateLimitError(AppError):
    """Rate limit exceeded (429)."""

    def __init__(self, retry_after: int = 60):
        super().__init__(
            "Rate limit exceeded",
            429,
            True,
            {"retry_after": retry_after}
        )
        self.retry_after = retry_after


class ServiceUnavailableError(AppError):
    """Service unavailable (503)."""

    def __init__(self, message: str = "Service temporarily unavailable"):
        super().__init__(message, 503, True)
```

### FastAPI Exception Handlers

```python
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import structlog
from typing import Dict, Any

logger = structlog.get_logger()

app = FastAPI()

# Standard error response format
def error_response(message: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create standard error response."""
    response = {"error": {"message": message}}
    if details:
        response["error"]["details"] = details
    return response


# Handle custom app errors
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handle application errors."""
    error_context = {
        "method": request.method,
        "url": str(request.url),
        "client_host": request.client.host if request.client else None,
        "user_id": getattr(request.state, "user_id", None),
    }

    if exc.status_code >= 500:
        logger.error("operational_error", error=str(exc), **error_context, **exc.context)
    elif exc.status_code >= 400:
        logger.warning("client_error", error=str(exc), **error_context, **exc.context)

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(exc.message, exc.context if exc.context else None),
    )


# Handle validation errors from Pydantic
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors."""
    logger.warning(
        "validation_error",
        method=request.method,
        url=str(request.url),
        errors=exc.errors(),
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_response(
            "Validation error",
            {"validation_errors": exc.errors()},
        ),
    )


# Handle unexpected errors
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected errors."""
    logger.error(
        "unexpected_error",
        error=str(exc),
        error_type=type(exc).__name__,
        method=request.method,
        url=str(request.url),
        exc_info=True,  # Include stack trace in logs
    )

    # Never expose internal details
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response("An unexpected error occurred"),
    )


# Example route
@app.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user by ID."""
    user = await user_service.find_by_id(user_id)
    if not user:
        raise NotFoundError("User", user_id)
    return user


@app.post("/users")
async def create_user(user_data: CreateUserSchema):
    """Create new user."""
    # Check for duplicate
    existing = await user_service.find_by_email(user_data.email)
    if existing:
        raise ConflictError(
            "User with this email already exists",
            {"email": user_data.email}
        )

    user = await user_service.create(user_data)
    return user
```

### Flask Error Handlers

```python
from flask import Flask, jsonify, request
import structlog

logger = structlog.get_logger()

app = Flask(__name__)

@app.errorhandler(AppError)
def handle_app_error(error: AppError):
    """Handle application errors."""
    error_context = {
        "method": request.method,
        "url": request.url,
        "remote_addr": request.remote_addr,
    }

    if error.status_code >= 500:
        logger.error("operational_error", error=str(error), **error_context)
    elif error.status_code >= 400:
        logger.warning("client_error", error=str(error), **error_context)

    response = {"error": {"message": error.message}}
    if error.context:
        response["error"]["details"] = error.context

    return jsonify(response), error.status_code


@app.errorhandler(Exception)
def handle_unexpected_error(error: Exception):
    """Handle unexpected errors."""
    logger.error(
        "unexpected_error",
        error=str(error),
        error_type=type(error).__name__,
        method=request.method,
        url=request.url,
        exc_info=True,
    )

    return jsonify({
        "error": {"message": "An unexpected error occurred"}
    }), 500
```

### Context Managers for Resource Cleanup

```python
from contextlib import contextmanager
from typing import Generator
import structlog

logger = structlog.get_logger()

@contextmanager
def database_transaction(session) -> Generator[None, None, None]:
    """Context manager for database transactions."""
    try:
        yield
        session.commit()
        logger.info("transaction_committed")
    except Exception as e:
        session.rollback()
        logger.error("transaction_rolled_back", error=str(e))
        raise AppError(f"Transaction failed: {str(e)}", 500)
    finally:
        session.close()


# Usage
async def create_user_with_profile(user_data: dict, profile_data: dict):
    """Create user and profile in a transaction."""
    async with database_transaction(db.session) as session:
        user = User(**user_data)
        session.add(user)
        await session.flush()  # Get user.id

        profile = Profile(**profile_data, user_id=user.id)
        session.add(profile)

        return user


@contextmanager
def handle_operation(operation_name: str) -> Generator[None, None, None]:
    """Context manager for consistent error handling and logging."""
    logger.info(f"{operation_name}_started")
    try:
        yield
        logger.info(f"{operation_name}_completed")
    except AppError:
        logger.warning(f"{operation_name}_failed_operational")
        raise
    except Exception as e:
        logger.error(f"{operation_name}_failed_unexpected", error=str(e), exc_info=True)
        raise AppError(f"{operation_name} failed", 500)


# Usage
def process_payment(payment_data: dict):
    """Process payment with error handling."""
    with handle_operation("process_payment"):
        # Validate
        if payment_data["amount"] <= 0:
            raise ValidationError("Amount must be positive", {"amount": payment_data["amount"]})

        # Process
        result = payment_gateway.charge(payment_data)
        return result
```

### Structured Logging with structlog

```python
import structlog
from typing import Any, Dict

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Logging examples
logger.debug("cache_hit", key="user:123", ttl=3600)
logger.info("user_created", user_id="123", email="user@example.com")
logger.warning("rate_limit_approaching", user_id="123", requests=95, limit=100)
logger.error("database_connection_failed", host="db.example.com", port=5432, exc_info=True)

# With context binding
user_logger = logger.bind(user_id="123", session_id="abc")
user_logger.info("login_successful")
user_logger.info("profile_updated", fields=["name", "email"])
```

---

## Go Error Handling

### Error Types and Patterns

```go
package errors

import (
    "errors"
    "fmt"
    "net/http"
)

// AppError represents an application error with HTTP context
type AppError struct {
    Message      string                 `json:"message"`
    StatusCode   int                    `json:"-"`
    IsOperational bool                  `json:"-"`
    Context      map[string]interface{} `json:"context,omitempty"`
    Err          error                  `json:"-"` // Wrapped error
}

func (e *AppError) Error() string {
    if e.Err != nil {
        return fmt.Sprintf("%s: %v", e.Message, e.Err)
    }
    return e.Message
}

func (e *AppError) Unwrap() error {
    return e.Err
}

// Constructor functions for common errors
func NewValidationError(message string, context map[string]interface{}) *AppError {
    return &AppError{
        Message:      message,
        StatusCode:   http.StatusBadRequest,
        IsOperational: true,
        Context:      context,
    }
}

func NewNotFoundError(resource, identifier string) *AppError {
    message := fmt.Sprintf("%s not found", resource)
    if identifier != "" {
        message = fmt.Sprintf("%s with identifier '%s' not found", resource, identifier)
    }
    return &AppError{
        Message:      message,
        StatusCode:   http.StatusNotFound,
        IsOperational: true,
        Context: map[string]interface{}{
            "resource":   resource,
            "identifier": identifier,
        },
    }
}

func NewUnauthorizedError(message string) *AppError {
    if message == "" {
        message = "Authentication required"
    }
    return &AppError{
        Message:      message,
        StatusCode:   http.StatusUnauthorized,
        IsOperational: true,
    }
}

func NewForbiddenError(message string) *AppError {
    if message == "" {
        message = "Insufficient permissions"
    }
    return &AppError{
        Message:      message,
        StatusCode:   http.StatusForbidden,
        IsOperational: true,
    }
}

func NewConflictError(message string, context map[string]interface{}) *AppError {
    return &AppError{
        Message:      message,
        StatusCode:   http.StatusConflict,
        IsOperational: true,
        Context:      context,
    }
}

func NewInternalError(message string, err error) *AppError {
    return &AppError{
        Message:      message,
        StatusCode:   http.StatusInternalServerError,
        IsOperational: true,
        Err:          err,
    }
}

func NewServiceUnavailableError(message string) *AppError {
    if message == "" {
        message = "Service temporarily unavailable"
    }
    return &AppError{
        Message:      message,
        StatusCode:   http.StatusServiceUnavailable,
        IsOperational: true,
    }
}
```

### Sentinel Errors

```go
package users

import "errors"

// Sentinel errors for common cases
var (
    ErrUserNotFound      = errors.New("user not found")
    ErrDuplicateEmail    = errors.New("email already exists")
    ErrInvalidCredentials = errors.New("invalid credentials")
    ErrInvalidToken      = errors.New("invalid token")
)

// Usage with errors.Is
func (s *UserService) FindByEmail(email string) (*User, error) {
    user, err := s.repo.FindByEmail(email)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, ErrUserNotFound
        }
        return nil, fmt.Errorf("find user by email: %w", err)
    }
    return user, nil
}

// Checking sentinel errors
user, err := userService.FindByEmail("test@example.com")
if err != nil {
    if errors.Is(err, users.ErrUserNotFound) {
        // Handle not found case
        return apperrors.NewNotFoundError("User", "")
    }
    // Other error
    return fmt.Errorf("get user: %w", err)
}
```

### Error Wrapping and Context

```go
package main

import (
    "errors"
    "fmt"
)

// CORRECT: Add context at each layer
func (s *UserService) Create(user *User) error {
    if err := s.validate(user); err != nil {
        return fmt.Errorf("validate user: %w", err)
    }

    if err := s.repo.Save(user); err != nil {
        return fmt.Errorf("save user to database: %w", err)
    }

    if err := s.emailService.SendWelcome(user.Email); err != nil {
        // Non-critical - log but don't fail
        s.logger.Warn("failed to send welcome email", "error", err, "user_id", user.ID)
    }

    return nil
}

// Unwrapping errors to check types
func handleError(err error) {
    var appErr *apperrors.AppError
    if errors.As(err, &appErr) {
        // Handle application error
        fmt.Printf("App error: %s (status: %d)\n", appErr.Message, appErr.StatusCode)
        return
    }

    // Check for specific sentinel error
    if errors.Is(err, users.ErrUserNotFound) {
        fmt.Println("User not found")
        return
    }

    // Unknown error
    fmt.Printf("Unexpected error: %v\n", err)
}
```

### HTTP Error Handling Middleware

```go
package middleware

import (
    "encoding/json"
    "errors"
    "net/http"

    apperrors "yourapp/pkg/errors"
    "yourapp/pkg/logger"
)

type ErrorResponse struct {
    Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
    Message string                 `json:"message"`
    Details map[string]interface{} `json:"details,omitempty"`
}

// ErrorHandler middleware
func ErrorHandler(log logger.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Wrap response writer to capture errors
            rw := &responseWriter{ResponseWriter: w, request: r, logger: log}
            next.ServeHTTP(rw, r)
        })
    }
}

type responseWriter struct {
    http.ResponseWriter
    request *http.Request
    logger  logger.Logger
}

// WriteError writes an error response
func WriteError(w http.ResponseWriter, r *http.Request, log logger.Logger, err error) {
    var appErr *apperrors.AppError

    // Extract request context
    ctx := map[string]interface{}{
        "method":     r.Method,
        "url":        r.URL.String(),
        "remote_addr": r.RemoteAddr,
    }

    if errors.As(err, &appErr) {
        // Application error
        if appErr.StatusCode >= 500 {
            log.Error("operational error", "error", err, "context", ctx)
        } else if appErr.StatusCode >= 400 {
            log.Warn("client error", "error", err, "context", ctx)
        }

        response := ErrorResponse{
            Error: ErrorDetail{
                Message: appErr.Message,
                Details: appErr.Context,
            },
        }

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(appErr.StatusCode)
        json.NewEncoder(w).Encode(response)
        return
    }

    // Unexpected error
    log.Error("unexpected error", "error", err, "context", ctx)

    response := ErrorResponse{
        Error: ErrorDetail{
            Message: "An unexpected error occurred",
        },
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusInternalServerError)
    json.NewEncoder(w).Encode(response)
}

// Example handler with error handling
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")

    user, err := h.userService.FindByID(userID)
    if err != nil {
        if errors.Is(err, users.ErrUserNotFound) {
            WriteError(w, r, h.logger, apperrors.NewNotFoundError("User", userID))
            return
        }
        WriteError(w, r, h.logger, apperrors.NewInternalError("Failed to get user", err))
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}
```

### Panic vs Error Return

```go
// NEVER panic in library code
func (s *Service) Process(data string) error {
    if data == "" {
        // WRONG: panic("data is empty")
        // CORRECT:
        return errors.New("data cannot be empty")
    }
    return nil
}

// Only panic for programmer errors in main/init
func init() {
    configPath := os.Getenv("CONFIG_PATH")
    if configPath == "" {
        panic("CONFIG_PATH environment variable is required")
    }
}

// Recover from panics at boundaries (e.g., HTTP handlers)
func RecoveryMiddleware(log logger.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            defer func() {
                if err := recover(); err != nil {
                    log.Error("panic recovered",
                        "error", err,
                        "url", r.URL.String(),
                        "method", r.Method,
                    )

                    WriteError(w, r, log,
                        apperrors.NewInternalError("Internal server error", nil))
                }
            }()
            next.ServeHTTP(w, r)
        })
    }
}
```

### Error Handling in Goroutines

```go
package main

import (
    "context"
    "fmt"
    "sync"
)

// Use errgroup for concurrent operations
import "golang.org/x/sync/errgroup"

func ProcessItems(ctx context.Context, items []string) error {
    g, ctx := errgroup.WithContext(ctx)

    for _, item := range items {
        item := item // Capture loop variable
        g.Go(func() error {
            return processItem(ctx, item)
        })
    }

    // Wait for all goroutines, return first error
    if err := g.Wait(); err != nil {
        return fmt.Errorf("process items: %w", err)
    }

    return nil
}

// Manual error collection
func ProcessItemsPartialSuccess(ctx context.Context, items []string) ([]Result, error) {
    results := make([]Result, len(items))
    var mu sync.Mutex
    var wg sync.WaitGroup
    errors := make([]error, 0)

    for i, item := range items {
        i, item := i, item
        wg.Add(1)

        go func() {
            defer wg.Done()

            result, err := processItem(ctx, item)
            mu.Lock()
            if err != nil {
                errors = append(errors, fmt.Errorf("item %d: %w", i, err))
            } else {
                results[i] = result
            }
            mu.Unlock()
        }()
    }

    wg.Wait()

    if len(errors) > 0 {
        // Log partial failures
        for _, err := range errors {
            fmt.Printf("Error: %v\n", err)
        }
    }

    return results, nil
}
```

---

## Logging Strategy

### Log Levels

| Level | When to Use | Examples |
|-------|-------------|----------|
| DEBUG | Development debugging, verbose details | SQL queries, cache keys, function entry/exit |
| INFO | Normal operations, significant events | User login, order created, job started |
| WARN | Recoverable issues, degraded functionality | Retry on network error, fallback to default, rate limit approaching |
| ERROR | Errors requiring attention | Failed API call, database error, unexpected exception |

### Structured Logging Fields

Always include:
- `timestamp` - ISO 8601 format
- `level` - Log level
- `message` - Human-readable description
- `request_id` - Trace requests across services

Context-specific:
- `user_id` - For user actions
- `session_id` - For session tracking
- `operation` - What was being attempted
- `duration_ms` - For performance tracking
- `error` - Error message (not full stack trace in production)
- `error_type` - Error class/type
- `status_code` - HTTP status code

### What to NEVER Log

- Passwords (plaintext or hashed)
- API keys, tokens, secrets
- Credit card numbers, CVV
- Social security numbers
- Full IP addresses (last octet only)
- Personal health information
- Raw request/response bodies (may contain sensitive data)

### Example Structured Log Entries

```json
{
  "timestamp": "2026-02-08T10:30:45.123Z",
  "level": "info",
  "message": "user_login_successful",
  "user_id": "user_123",
  "session_id": "sess_abc",
  "ip": "192.168.1.xxx",
  "user_agent": "Mozilla/5.0..."
}

{
  "timestamp": "2026-02-08T10:31:12.456Z",
  "level": "error",
  "message": "database_query_failed",
  "operation": "fetch_user_profile",
  "user_id": "user_123",
  "request_id": "req_xyz",
  "error": "connection timeout",
  "error_type": "TimeoutError",
  "duration_ms": 5000,
  "retry_attempt": 2
}

{
  "timestamp": "2026-02-08T10:32:00.789Z",
  "level": "warn",
  "message": "rate_limit_approaching",
  "user_id": "user_456",
  "endpoint": "/api/v1/search",
  "requests_count": 95,
  "limit": 100,
  "window": "60s"
}
```

---

## Verification Checklist

Use this checklist when auditing error handling in a codebase:

### Error Types and Hierarchy
- [ ] Custom error hierarchy exists (not generic Error/Exception everywhere)
- [ ] Errors extend from a base AppError/ApplicationError class
- [ ] Each error type has appropriate HTTP status code
- [ ] Errors include context about what failed (resource, identifier, etc.)

### Error Handling Patterns
- [ ] No empty catch blocks (swallowed errors)
- [ ] No generic `catch (Exception e)` without logging or re-throwing
- [ ] Errors are wrapped with context at each layer (`fmt.Errorf`, `raise ... from`, `throw`)
- [ ] Try/catch only at boundaries (handlers, main), not everywhere
- [ ] Async errors properly caught (no unhandled promise rejections)

### API Error Responses
- [ ] Consistent error response format across all endpoints
- [ ] Never expose stack traces to clients
- [ ] Never expose internal paths, DB queries, or environment details
- [ ] Sensitive errors (auth/authz) return generic messages
- [ ] Validation errors include field-specific details

### Logging
- [ ] Errors logged at appropriate level (ERROR for 5xx, WARN for 4xx)
- [ ] Structured logging with consistent fields (request_id, user_id, operation)
- [ ] No sensitive data in logs (passwords, tokens, PII)
- [ ] Errors logged once at boundary (not at every layer)
- [ ] Stack traces included in logs (but not sent to clients)

### Language-Specific
#### TypeScript/JavaScript
- [ ] Error middleware is last in middleware chain
- [ ] Async handlers wrapped or use try/catch
- [ ] Unhandled rejection handler registered
- [ ] Error.captureStackTrace used for proper stack traces

#### Python
- [ ] Exception handlers registered for FastAPI/Flask
- [ ] Context managers used for resource cleanup
- [ ] `exc_info=True` used when logging exceptions
- [ ] Type hints on exception classes

#### Go
- [ ] Errors wrapped with `fmt.Errorf("context: %w", err)`
- [ ] Sentinel errors used for known cases
- [ ] `errors.Is` and `errors.As` for error checking
- [ ] Panic only for programmer errors, not library code
- [ ] Recovery middleware at HTTP boundaries

### Operational
- [ ] Retryable errors documented (429, 503)
- [ ] Non-retryable errors documented (400, 401, 403, 404, 409)
- [ ] Rate limit responses include Retry-After header
- [ ] Service unavailable responses include Retry-After if possible
- [ ] Critical errors trigger alerts/monitoring
