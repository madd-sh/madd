# Go Conventions (Effective Go)

## Project Layout (Standard)

```
project/
├── go.mod
├── go.sum
├── cmd/                    # Entry points
│   └── server/
│       └── main.go
├── internal/               # Private packages (not importable)
│   ├── config/
│   │   └── config.go
│   ├── domain/             # Business logic
│   │   ├── user.go         # Entity + repository interface
│   │   └── user_test.go
│   ├── handler/            # HTTP handlers
│   │   ├── auth.go
│   │   └── auth_test.go
│   ├── middleware/
│   │   └── auth.go
│   ├── repository/         # Database implementations
│   │   └── user_postgres.go
│   └── service/            # Application services
│       └── auth.go
├── pkg/                    # Public packages (importable)
│   └── validator/
├── migrations/
└── Dockerfile
```

## Naming Conventions

```go
// Files: lowercase, no underscores (except _test.go)
// user_service.go (acceptable), userservice.go (preferred), user_test.go

// Exported (public): PascalCase
type UserService struct { ... }
func NewUserService(repo UserRepository) *UserService { ... }
func (s *UserService) GetByID(id string) (User, error) { ... }

// Unexported (private): camelCase
type userCache struct { ... }
func (s *UserService) validateInput(input CreateUserInput) error { ... }

// Interfaces: -er suffix when single method, descriptive otherwise
type Reader interface { Read(p []byte) (n int, err error) }
type UserRepository interface {
    FindByID(id string) (User, error)
    Save(user User) error
}

// Constants
const (
    MaxRetries     = 3
    DefaultTimeout = 30 * time.Second
)

// Acronyms: all caps
var httpClient *http.Client  // not httpClient
type HTTPHandler struct {}   // not HttpHandler
type UserID string           // not UserId
```

## Error Handling

```go
// Define sentinel errors for expected conditions
var (
    ErrNotFound       = errors.New("not found")
    ErrUnauthorized   = errors.New("unauthorized")
    ErrAlreadyExists  = errors.New("already exists")
)

// Custom error types for complex errors
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error on %s: %s", e.Field, e.Message)
}

// Always check errors immediately
user, err := repo.FindByID(id)
if err != nil {
    if errors.Is(err, ErrNotFound) {
        return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
    }
    return nil, fmt.Errorf("finding user %s: %w", id, err)
}

// Wrap errors with context using %w
func (s *UserService) CreateUser(input CreateUserInput) (User, error) {
    if err := s.validateInput(input); err != nil {
        return User{}, fmt.Errorf("CreateUser: %w", err)
    }
    user, err := s.repo.Save(input.toUser())
    if err != nil {
        return User{}, fmt.Errorf("CreateUser save: %w", err)
    }
    return user, nil
}
```

## Interface Patterns

```go
// Define interfaces in the consumer package, not the provider
// GOOD: handler package defines what it needs
package handler

type UserFinder interface {
    FindByID(id string) (domain.User, error)
}

type AuthHandler struct {
    users UserFinder // accept interface
}

// BAD: defining interface in provider package
// package repository
// type UserRepositoryInterface interface { ... } // Don't do this
```

## Constructor Pattern

```go
// Use New* functions to create structs
func NewUserService(repo UserRepository, logger *slog.Logger) *UserService {
    return &UserService{
        repo:   repo,
        logger: logger,
    }
}

// Use functional options for configurable constructors
type Option func(*Server)

func WithPort(port int) Option {
    return func(s *Server) { s.port = port }
}

func WithTimeout(d time.Duration) Option {
    return func(s *Server) { s.timeout = d }
}

func NewServer(opts ...Option) *Server {
    s := &Server{port: 8080, timeout: 30 * time.Second} // defaults
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

## Context Usage

```go
// Always pass context as first parameter
func (s *UserService) GetUser(ctx context.Context, id string) (User, error) {
    return s.repo.FindByID(ctx, id)
}

// Use context for cancellation and timeouts
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()

// Never store context in structs
// BAD: type Service struct { ctx context.Context }
```

## Logging (slog)

```go
import "log/slog"

logger := slog.Default()

// Structured logging
logger.Info("user created", "user_id", user.ID, "email", user.Email)
logger.Warn("login failed", "email", email, "ip", r.RemoteAddr)
logger.Error("database error", "error", err, "query", "FindByID")
```

## Import Order

```go
import (
    // 1. Standard library
    "context"
    "fmt"
    "net/http"

    // 2. Third-party
    "github.com/gin-gonic/gin"
    "github.com/jmoiron/sqlx"

    // 3. Internal
    "github.com/project/internal/domain"
    "github.com/project/internal/service"
)
```
