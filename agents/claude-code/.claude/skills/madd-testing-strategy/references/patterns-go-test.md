# Go Testing Patterns

## Setup

Go tests live alongside source files with `_test.go` suffix. No configuration needed.

```
auth/
├── handler.go
├── handler_test.go
├── service.go
├── service_test.go
└── testdata/          # Test fixtures
    └── valid_token.json
```

## Unit Test Pattern

```go
package auth

import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestCreateUser(t *testing.T) {
    t.Run("creates user with hashed password", func(t *testing.T) {
        // Arrange
        repo := &MockUserRepository{
            SaveFn: func(u User) (User, error) {
                return User{ID: "1", Email: u.Email}, nil
            },
        }

        // Act
        user, err := CreateUser(repo, "test@example.com", "secret")

        // Assert
        require.NoError(t, err)
        assert.Equal(t, "1", user.ID)
        assert.Equal(t, "test@example.com", user.Email)
    })

    t.Run("returns error for invalid email", func(t *testing.T) {
        repo := &MockUserRepository{}

        _, err := CreateUser(repo, "invalid", "secret")

        require.Error(t, err)
        assert.ErrorIs(t, err, ErrInvalidEmail)
    })
}
```

## Integration Test Pattern (HTTP API)

```go
package auth_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestLoginEndpoint(t *testing.T) {
    // Setup test server
    router := setupTestRouter(t)
    server := httptest.NewServer(router)
    defer server.Close()

    t.Run("returns 200 with valid JWT", func(t *testing.T) {
        body, _ := json.Marshal(map[string]string{
            "email": "test@example.com", "password": "correct",
        })
        resp, err := http.Post(server.URL+"/api/auth/login", "application/json", bytes.NewReader(body))
        require.NoError(t, err)
        defer resp.Body.Close()

        assert.Equal(t, http.StatusOK, resp.StatusCode)

        var result map[string]string
        json.NewDecoder(resp.Body).Decode(&result)
        assert.Contains(t, result, "token")
    })

    t.Run("returns 401 for wrong password", func(t *testing.T) {
        body, _ := json.Marshal(map[string]string{
            "email": "test@example.com", "password": "wrong",
        })
        resp, err := http.Post(server.URL+"/api/auth/login", "application/json", bytes.NewReader(body))
        require.NoError(t, err)
        defer resp.Body.Close()

        assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
    })
}
```

## Interface-Based Mocking

```go
// Define interface in consumer package
type UserRepository interface {
    Save(user User) (User, error)
    FindByEmail(email string) (User, error)
}

// Mock in test file
type MockUserRepository struct {
    SaveFn        func(User) (User, error)
    FindByEmailFn func(string) (User, error)
}

func (m *MockUserRepository) Save(u User) (User, error) {
    if m.SaveFn != nil {
        return m.SaveFn(u)
    }
    return User{}, nil
}

func (m *MockUserRepository) FindByEmail(email string) (User, error) {
    if m.FindByEmailFn != nil {
        return m.FindByEmailFn(email)
    }
    return User{}, ErrNotFound
}
```

## Table-Driven Tests

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name  string
        email string
        valid bool
    }{
        {"valid email", "user@example.com", true},
        {"subdomain email", "user@sub.example.com", true},
        {"no at sign", "invalid", false},
        {"no local part", "@example.com", false},
        {"empty string", "", false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            assert.Equal(t, tt.valid, ValidateEmail(tt.email))
        })
    }
}
```

## Test Commands

```bash
go test ./...                    # Run all tests
go test ./... -v                 # Verbose output
go test ./... -cover             # With coverage summary
go test ./... -coverprofile=coverage.out  # Coverage file
go tool cover -html=coverage.out          # HTML report
go test ./... -run TestCreateUser         # Run specific test
go test ./... -count=1                    # Disable cache
go test ./... -race                       # Race condition detection
go test ./... -timeout 30s               # Set timeout
```

## Common Assertions (testify)

```go
// Equality
assert.Equal(t, expected, actual)
assert.NotEqual(t, unexpected, actual)

// Nil checks
assert.Nil(t, err)
assert.NotNil(t, result)

// Errors
require.NoError(t, err)      // Fails test immediately
require.Error(t, err)
assert.ErrorIs(t, err, ErrNotFound)
assert.ErrorContains(t, err, "not found")

// Collections
assert.Len(t, items, 3)
assert.Contains(t, items, "value")
assert.Empty(t, items)

// Boolean
assert.True(t, condition)
assert.False(t, condition)
```
