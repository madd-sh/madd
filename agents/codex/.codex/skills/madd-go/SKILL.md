---
name: madd-go
description: Use this skill when working with Go projects. Covers standard project layout, error handling idioms, concurrency patterns, interface design, and testing with testify.
metadata:
  short-description: Go best practices
---

# Go Best Practices for MADD Agents

This skill provides comprehensive guidance for development and audit agents working with Go projects. Follow these patterns to write idiomatic, maintainable, and safe Go code.

## 1. Standard Project Layout

```
project/
├── cmd/
│   └── server/
│       └── main.go          # Entry point
├── internal/                # Private packages (Go enforced)
│   ├── config/              # Configuration loading
│   ├── domain/              # Business logic, entities
│   ├── handler/             # HTTP handlers
│   ├── middleware/          # HTTP middleware
│   ├── repository/          # Data access layer
│   └── service/             # Application services
├── pkg/                     # Public packages (reusable)
├── migrations/              # SQL migrations
├── api/                     # OpenAPI/gRPC definitions
├── scripts/                 # Build and dev scripts
├── go.mod
├── go.sum
├── Makefile
├── Dockerfile
└── README.md
```

### Key Principles

- `cmd/` contains application entry points
- `internal/` packages cannot be imported by external projects
- `pkg/` contains reusable library code
- Keep `main.go` small - delegate to `internal/` packages
- Group by function (handler, service, repository), not by entity

## 2. Error Handling Idioms

### Sentinel Errors

Use for well-known errors that callers need to check:

```go
package repository

import "errors"

var (
    ErrNotFound      = errors.New("resource not found")
    ErrAlreadyExists = errors.New("resource already exists")
    ErrUnauthorized  = errors.New("unauthorized access")
)
```

### Custom Error Types

Use when you need to attach additional context:

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed for %s: %s", e.Field, e.Message)
}
```

### Error Wrapping

Always wrap errors with context:

```go
// Good
if err := db.Query(ctx, query); err != nil {
    return fmt.Errorf("failed to query users: %w", err)
}

// Bad - loses context
if err := db.Query(ctx, query); err != nil {
    return err
}
```

### Error Checking

Use `errors.Is` and `errors.As`:

```go
// Check sentinel errors
if errors.Is(err, repository.ErrNotFound) {
    return http.StatusNotFound
}

// Extract custom error types
var validationErr *ValidationError
if errors.As(err, &validationErr) {
    log.Printf("validation failed: %s", validationErr.Field)
}
```

### When to Panic

**Only use panic for unrecoverable programmer errors:**

- Array index out of bounds in initialization
- Nil pointer dereference in setup code
- Failed type assertions that "can't happen"

**Never panic in:**

- Libraries (always return errors)
- HTTP handlers
- Goroutines
- In response to user input

### HTTP Handler Error Pattern

```go
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")

    user, err := h.userService.GetByID(r.Context(), id)
    if err != nil {
        if errors.Is(err, repository.ErrNotFound) {
            http.Error(w, "user not found", http.StatusNotFound)
            return
        }
        log.Printf("error getting user: %v", err)
        http.Error(w, "internal server error", http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(user)
}
```

## 3. Interface Design

### Keep Interfaces Small

```go
// Good - focused interface
type UserRepository interface {
    GetByID(ctx context.Context, id string) (*User, error)
    Create(ctx context.Context, user *User) error
}

// Bad - too many responsibilities
type Repository interface {
    GetUserByID(ctx context.Context, id string) (*User, error)
    CreateUser(ctx context.Context, user *User) error
    GetPostByID(ctx context.Context, id string) (*Post, error)
    CreatePost(ctx context.Context, post *Post) error
    SendEmail(to, subject, body string) error
}
```

### Define Interfaces in Consumer Package

```go
// Good - service defines what it needs
package service

type UserRepository interface {
    GetByID(ctx context.Context, id string) (*User, error)
}

type UserService struct {
    repo UserRepository
}

// Bad - repository defines its own interface
package repository

type UserRepository interface {
    GetByID(ctx context.Context, id string) (*User, error)
}
```

### Accept Interfaces, Return Structs

```go
// Good
func NewUserService(repo UserRepository) *UserService {
    return &UserService{repo: repo}
}

// Bad - returns interface, makes testing harder
func NewUserService(repo UserRepository) UserRepositoryInterface {
    return &UserService{repo: repo}
}
```

### Standard Library Examples

Learn from `io.Reader` and `io.Writer`:

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}
```

### The Empty Interface (any)

Use sparingly:

```go
// Acceptable - JSON encoding
func JSON(w http.ResponseWriter, status int, data any) error {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    return json.NewEncoder(w).Encode(data)
}

// Better - use generics for type safety
func First[T any](slice []T) (T, bool) {
    if len(slice) == 0 {
        var zero T
        return zero, false
    }
    return slice[0], true
}
```

## 4. Concurrency Patterns

### Basic Goroutine + Channel

```go
func processItems(items []Item) {
    results := make(chan Result, len(items))

    for _, item := range items {
        go func(item Item) {
            result := process(item)
            results <- result
        }(item)
    }

    for i := 0; i < len(items); i++ {
        result := <-results
        fmt.Println(result)
    }
}
```

### errgroup for Parallel Work with Error Handling

```go
import "golang.org/x/sync/errgroup"

func fetchAll(ctx context.Context, urls []string) ([]Response, error) {
    g, ctx := errgroup.WithContext(ctx)
    responses := make([]Response, len(urls))

    for i, url := range urls {
        i, url := i, url // Capture loop variables
        g.Go(func() error {
            resp, err := fetch(ctx, url)
            if err != nil {
                return fmt.Errorf("failed to fetch %s: %w", url, err)
            }
            responses[i] = resp
            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err
    }

    return responses, nil
}
```

### sync.WaitGroup for Simple Fan-Out

```go
func processAll(items []Item) {
    var wg sync.WaitGroup

    for _, item := range items {
        wg.Add(1)
        go func(item Item) {
            defer wg.Done()
            process(item)
        }(item)
    }

    wg.Wait()
}
```

### Context for Cancellation and Timeout

```go
func doWork(ctx context.Context) error {
    // Create timeout context
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    // Respect cancellation
    select {
    case <-ctx.Done():
        return ctx.Err()
    case result := <-doAsyncWork(ctx):
        return result
    }
}
```

### Mutex vs Channels

**Use mutex for protecting state:**

```go
type Counter struct {
    mu    sync.Mutex
    count int
}

func (c *Counter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.count++
}
```

**Use channels for communication:**

```go
type WorkQueue struct {
    jobs chan Job
}

func (wq *WorkQueue) Submit(job Job) {
    wq.jobs <- job
}
```

### Worker Pool Pattern

```go
type WorkerPool struct {
    numWorkers int
    jobs       chan Job
    results    chan Result
    ctx        context.Context
    cancel     context.CancelFunc
    wg         sync.WaitGroup
}

func NewWorkerPool(numWorkers int) *WorkerPool {
    ctx, cancel := context.WithCancel(context.Background())
    return &WorkerPool{
        numWorkers: numWorkers,
        jobs:       make(chan Job, 100),
        results:    make(chan Result, 100),
        ctx:        ctx,
        cancel:     cancel,
    }
}

func (wp *WorkerPool) Start() {
    for i := 0; i < wp.numWorkers; i++ {
        wp.wg.Add(1)
        go wp.worker()
    }
}

func (wp *WorkerPool) worker() {
    defer wp.wg.Done()
    for {
        select {
        case <-wp.ctx.Done():
            return
        case job, ok := <-wp.jobs:
            if !ok {
                return
            }
            result := job.Process()
            wp.results <- result
        }
    }
}

func (wp *WorkerPool) Stop() {
    close(wp.jobs)
    wp.wg.Wait()
    close(wp.results)
}
```

### Golden Rule

**Never start a goroutine without knowing how it will stop.**

```go
// Bad - goroutine leak
func Handler(w http.ResponseWriter, r *http.Request) {
    go func() {
        // This goroutine runs forever!
        for {
            doSomething()
            time.Sleep(1 * time.Second)
        }
    }()
}

// Good - controlled lifecycle
type Service struct {
    ctx    context.Context
    cancel context.CancelFunc
    wg     sync.WaitGroup
}

func (s *Service) Start() {
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        ticker := time.NewTicker(1 * time.Second)
        defer ticker.Stop()

        for {
            select {
            case <-s.ctx.Done():
                return
            case <-ticker.C:
                doSomething()
            }
        }
    }()
}

func (s *Service) Stop() {
    s.cancel()
    s.wg.Wait()
}
```

## 5. Testing

### Table-Driven Tests

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name    string
        email   string
        wantErr bool
    }{
        {
            name:    "valid email",
            email:   "user@example.com",
            wantErr: false,
        },
        {
            name:    "missing @",
            email:   "userexample.com",
            wantErr: true,
        },
        {
            name:    "empty string",
            email:   "",
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateEmail(tt.email)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidateEmail() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}
```

### testify Assertions

```go
import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestUserService_GetByID(t *testing.T) {
    // Use require for preconditions (stops test on failure)
    repo := &MockUserRepository{}
    service := NewUserService(repo)
    require.NotNil(t, service)

    user, err := service.GetByID(context.Background(), "123")

    // Use assert for checks (continues on failure)
    assert.NoError(t, err)
    assert.Equal(t, "123", user.ID)
    assert.NotEmpty(t, user.Name)
}
```

### Interface-Based Mocking

```go
// Define interface in your code
type UserRepository interface {
    GetByID(ctx context.Context, id string) (*User, error)
}

// Hand-written mock
type MockUserRepository struct {
    GetByIDFunc func(ctx context.Context, id string) (*User, error)
}

func (m *MockUserRepository) GetByID(ctx context.Context, id string) (*User, error) {
    if m.GetByIDFunc != nil {
        return m.GetByIDFunc(ctx, id)
    }
    return nil, errors.New("not implemented")
}

// Use in test
func TestUserService(t *testing.T) {
    repo := &MockUserRepository{
        GetByIDFunc: func(ctx context.Context, id string) (*User, error) {
            return &User{ID: id, Name: "Test User"}, nil
        },
    }

    service := NewUserService(repo)
    user, err := service.GetByID(context.Background(), "123")

    require.NoError(t, err)
    assert.Equal(t, "Test User", user.Name)
}
```

### Test Helpers with t.Helper()

```go
func createTestUser(t *testing.T, name string) *User {
    t.Helper()
    user := &User{Name: name}
    if err := user.Validate(); err != nil {
        t.Fatalf("failed to create test user: %v", err)
    }
    return user
}

func TestSomething(t *testing.T) {
    user := createTestUser(t, "John") // Error points to this line, not inside helper
    assert.NotNil(t, user)
}
```

### Subtests with t.Run

```go
func TestUserValidation(t *testing.T) {
    user := &User{Name: "John", Email: "john@example.com"}

    t.Run("valid user", func(t *testing.T) {
        err := user.Validate()
        assert.NoError(t, err)
    })

    t.Run("empty name", func(t *testing.T) {
        user.Name = ""
        err := user.Validate()
        assert.Error(t, err)
    })
}
```

### Short Tests

```go
func TestSlowOperation(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping slow test in short mode")
    }

    // Long-running test code
}

// Run with: go test -short ./...
```

### Race Detection

```bash
go test -race ./...
```

### Integration Tests with Build Tags

```go
//go:build integration
// +build integration

package repository_test

func TestPostgresRepository(t *testing.T) {
    // Requires real database
}

// Run with: go test -tags=integration ./...
```

## 6. Common Anti-Patterns

| Anti-Pattern | Why Bad | Better |
|-------------|---------|--------|
| Ignoring errors (`_ = fn()`) | Silent failures, bugs escape | Always check: `if err != nil { return err }` |
| `init()` functions | Hidden side effects, hard to test, import order issues | Explicit initialization in `main()` or constructors |
| Large interfaces (10+ methods) | Hard to mock, violates Interface Segregation | Small, focused interfaces (1-3 methods) |
| Global variables | Shared mutable state, race conditions | Dependency injection via constructors |
| Naked goroutines | Leaked goroutines, no error handling | `errgroup` or explicit lifecycle management |
| `panic` in libraries | Crashes caller's application | Return errors, let caller decide |
| Pointer to interface | Unnecessary indirection | Use value: `var r UserRepository` |
| Premature channel buffering | Hides synchronization issues | Start unbuffered, add buffer when profiled |
| Missing context | No timeout/cancellation | Always pass `context.Context` as first param |
| Type assertions without check | Runtime panic on failure | Use comma-ok: `val, ok := x.(Type)` |

## 7. Package Ecosystem

| Category | Package | Why | Import |
|----------|---------|-----|--------|
| HTTP Router | `chi` or `echo` | Lightweight, stdlib-compatible | `github.com/go-chi/chi/v5` |
| Database | `pgx` | High-performance Postgres driver | `github.com/jackc/pgx/v5` |
| Database | `sqlx` | Type-safe SQL queries | `github.com/jmoiron/sqlx` |
| Validation | `validator` | Struct tag validation | `github.com/go-playground/validator/v10` |
| Testing | `testify` | Assertions + require + mocks | `github.com/stretchr/testify` |
| Linting | `golangci-lint` | Meta-linter with 50+ linters | Install via script |
| Config | `envconfig` | Environment variable parsing | `github.com/kelseyhightower/envconfig` |
| Config | `viper` | Multi-source config (env, file, flags) | `github.com/spf13/viper` |
| Logging | `slog` | Structured logging (stdlib) | `log/slog` |
| Migration | `goose` | SQL migrations | `github.com/pressly/goose/v3` |
| UUID | `google/uuid` | UUID generation | `github.com/google/uuid` |
| Concurrency | `errgroup` | Parallel work with errors | `golang.org/x/sync/errgroup` |

## 8. Makefile Targets

```makefile
.PHONY: help build test lint fmt run migrate docker-build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build the application
	go build -o bin/server ./cmd/server

test: ## Run tests
	go test -v -race -coverprofile=coverage.out ./...

test-coverage: test ## Generate coverage report
	go tool cover -html=coverage.out -o coverage.html

lint: ## Run linters
	golangci-lint run ./...

fmt: ## Format code
	go fmt ./...
	goimports -w .

vet: ## Run go vet
	go vet ./...

run: ## Run the application
	go run ./cmd/server

migrate: ## Run database migrations
	goose -dir migrations postgres "$(DATABASE_URL)" up

migrate-down: ## Rollback last migration
	goose -dir migrations postgres "$(DATABASE_URL)" down

docker-build: ## Build Docker image
	docker build -t myapp:latest .

docker-run: ## Run Docker container
	docker run -p 8080:8080 --env-file .env myapp:latest

clean: ## Clean build artifacts
	rm -rf bin/ coverage.out coverage.html

deps: ## Download dependencies
	go mod download
	go mod tidy

install-tools: ## Install development tools
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install golang.org/x/tools/cmd/goimports@latest
	go install github.com/pressly/goose/v3/cmd/goose@latest

.DEFAULT_GOAL := help
```

## 9. Verification Checklist (for Audit)

Use this checklist when auditing Go code:

### Code Quality

- [ ] `go vet ./...` passes without warnings
- [ ] `golangci-lint run` passes (or only acceptable warnings documented)
- [ ] `go fmt ./...` shows no changes needed
- [ ] No ignored errors (except intentional with `// nolint:errcheck` comment + justification)
- [ ] All exported functions/types have documentation comments

### Error Handling

- [ ] All errors are checked (no bare `fn()` when it returns `error`)
- [ ] Errors are wrapped with context using `fmt.Errorf("context: %w", err)`
- [ ] No use of `panic` except in `main` or truly unrecoverable situations
- [ ] Custom errors use sentinel errors or error types, not string matching

### Concurrency

- [ ] All goroutines have explicit shutdown mechanisms (context cancellation, channel close, etc.)
- [ ] No data races (`go test -race ./...` passes)
- [ ] Goroutines use `errgroup` or proper error handling
- [ ] No shared mutable state without synchronization (mutex or channels)
- [ ] Worker pools are properly shut down

### Interfaces and Design

- [ ] Interfaces defined in consumer packages, not provider packages
- [ ] Interfaces are small (1-3 methods typically)
- [ ] Functions accept interfaces, return structs
- [ ] No unnecessary use of `any` (empty interface) - prefer generics or specific types

### Context

- [ ] `context.Context` passed as first parameter to all functions that need it
- [ ] Context is not stored in structs (except for special cases like long-running services)
- [ ] No `context.TODO()` or `context.Background()` except in `main` or top-level handlers

### Testing

- [ ] Test coverage > 70% for business logic
- [ ] `go test -race ./...` passes
- [ ] Table-driven tests used for multiple similar cases
- [ ] Integration tests tagged with build tags
- [ ] No test panics or `t.Fatal` in goroutines

### Dependencies

- [ ] `go.mod` and `go.sum` committed
- [ ] No unused dependencies (`go mod tidy` makes no changes)
- [ ] Dependencies are from trusted sources
- [ ] No GPL-licensed dependencies (if project requires different license)

### Configuration

- [ ] No hardcoded credentials or secrets
- [ ] Configuration loaded from environment or config files
- [ ] Sensible defaults provided
- [ ] No `init()` functions (or justified with comment)

### Security

- [ ] SQL queries use parameterization (no string concatenation)
- [ ] User input is validated
- [ ] Sensitive data not logged
- [ ] HTTPS used for external calls
- [ ] Secrets not in version control

### Performance

- [ ] No unnecessary allocations in hot paths
- [ ] Defer used correctly (not in loops unless intended)
- [ ] Context timeouts set for external calls
- [ ] Connection pooling configured for database

### Documentation

- [ ] README.md includes setup and run instructions
- [ ] API documented (comments or OpenAPI spec)
- [ ] Complex algorithms have explanatory comments
- [ ] No TODO comments without GitHub issues

## Quick Reference Card

### Error Handling

```go
// Sentinel error
var ErrNotFound = errors.New("not found")

// Check
if errors.Is(err, ErrNotFound) { }

// Wrap
return fmt.Errorf("operation failed: %w", err)
```

### Concurrency

```go
// errgroup
g, ctx := errgroup.WithContext(ctx)
g.Go(func() error { return work() })
return g.Wait()

// Worker with shutdown
go func() {
    defer wg.Done()
    for {
        select {
        case <-ctx.Done():
            return
        case job := <-jobs:
            process(job)
        }
    }
}()
```

### Testing

```go
// Table test
tests := []struct{name, input, want string}{ ... }
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        got := Fn(tt.input)
        assert.Equal(t, tt.want, got)
    })
}
```

### Interface

```go
// Small, focused
type Reader interface {
    Read(ctx context.Context, id string) (*Data, error)
}
```

---

**Remember**: Write boring, obvious Go code. Prefer simplicity over cleverness. Make it work, make it right, then make it fast.
