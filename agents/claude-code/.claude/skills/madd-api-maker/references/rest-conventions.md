# REST API Conventions - Extended Patterns

This document provides framework-specific examples and advanced patterns for building production-ready REST APIs.

## Table of Contents
- [Express.js Examples](#expressjs-examples)
- [FastAPI Examples](#fastapi-examples)
- [Go Examples](#go-examples)
- [HATEOAS Basics](#hateoas-basics)
- [Content Negotiation](#content-negotiation)
- [Bulk Operations](#bulk-operations)
- [Webhook Patterns](#webhook-patterns)

---

## Express.js Examples

### Basic Router with Error Handling

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();

// Error classes
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.status = 422;
    this.errors = errors;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

// GET /api/v1/users - List with pagination
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = Math.min(parseInt(req.query.per_page) || 20, 100);
    const status = req.query.status;
    const sortBy = req.query.sort || 'created_at';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const filters = {};
    if (status) filters.status = status;

    const total = await User.count(filters);
    const users = await User.find(filters)
      .sort({ [sortBy]: order })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .select('-password');

    res.status(200).json({
      data: users,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/users/:id - Single resource
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      throw new NotFoundError('User not found');
    }
    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/users - Create
router.post('/', async (req, res, next) => {
  try {
    const { email, name, password } = req.body;

    // Validation
    const errors = [];
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.push({ field: 'email', message: 'must be a valid email address' });
    }
    if (!name || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'must be at least 2 characters' });
    }
    if (!password || password.length < 8) {
      errors.push({ field: 'password', message: 'must be at least 8 characters' });
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    // Check uniqueness
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        type: 'https://api.example.com/errors/conflict',
        title: 'Conflict',
        status: 409,
        detail: 'A user with this email already exists',
        instance: req.path
      });
    }

    const user = await User.create({ email, name, password });
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201)
      .header('Location', `/api/v1/users/${user.id}`)
      .json({ data: userResponse });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/users/:id - Partial update
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = req.body;
    const allowedFields = ['name', 'email', 'status'];
    const filteredUpdates = {};

    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

### Error Handling Middleware

```javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Default to 500
  let status = err.status || 500;
  let response = {
    type: `https://api.example.com/errors/${err.name || 'internal'}`,
    title: err.name || 'Internal Server Error',
    status: status,
    detail: err.message || 'An unexpected error occurred',
    instance: req.path
  };

  // Add validation errors if present
  if (err.errors && Array.isArray(err.errors)) {
    response.errors = err.errors;
  }

  // Log server errors (5xx) but not client errors (4xx)
  if (status >= 500) {
    console.error('Server error:', err);
    // Don't expose internal details in production
    if (process.env.NODE_ENV === 'production') {
      response.detail = 'An internal error occurred';
      delete response.errors;
    }
  }

  res.status(status).json(response);
};

module.exports = errorHandler;
```

### Rate Limiting Middleware

```javascript
// middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      type: 'https://api.example.com/errors/rate-limit',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Too many requests from this IP, please try again later',
      instance: req.path
    });
  }
});

module.exports = limiter;
```

### Application Setup

```javascript
// app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const limiter = require('./middleware/rateLimit');
const usersRouter = require('./routes/users');

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
app.use('/api/', limiter);

// Routes
app.use('/api/v1/users', usersRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    type: 'https://api.example.com/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail: 'The requested resource was not found',
    instance: req.path
  });
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
```

---

## FastAPI Examples

### Basic Router with Pydantic Models

```python
# models/user.py
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8)

    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('name cannot be empty or whitespace')
        return v.strip()

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    status: Optional[UserStatus] = None

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    status: UserStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int
    total_pages: int

class UserListResponse(BaseModel):
    data: List[UserResponse]
    pagination: PaginationMeta

class ErrorDetail(BaseModel):
    field: str
    message: str

class ErrorResponse(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: str
    errors: Optional[List[ErrorDetail]] = None
```

### Routes with Error Handling

```python
# routes/users.py
from fastapi import APIRouter, HTTPException, Query, Path, status, Request
from fastapi.responses import JSONResponse
from typing import Optional
from models.user import (
    UserCreate, UserUpdate, UserResponse, UserListResponse,
    UserStatus, ErrorResponse, ErrorDetail, PaginationMeta
)
import math

router = APIRouter(prefix="/api/v1/users", tags=["users"])

# Custom exception
class ConflictException(HTTPException):
    def __init__(self, detail: str, instance: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "type": "https://api.example.com/errors/conflict",
                "title": "Conflict",
                "status": 409,
                "detail": detail,
                "instance": instance
            }
        )

# GET /api/v1/users - List with pagination
@router.get(
    "/",
    response_model=UserListResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "List of users"},
        400: {"model": ErrorResponse}
    }
)
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[UserStatus] = Query(None, alias="status"),
    sort: str = Query("created_at", regex="^(created_at|email|name)$"),
    order: str = Query("desc", regex="^(asc|desc)$")
):
    # Build filter
    filters = {}
    if status_filter:
        filters["status"] = status_filter

    # Get total count
    total = await User.count(filters)

    # Get paginated results
    skip = (page - 1) * per_page
    users = await User.find(filters).sort(
        [(sort, 1 if order == "asc" else -1)]
    ).skip(skip).limit(per_page).to_list()

    return UserListResponse(
        data=[UserResponse.from_orm(u) for u in users],
        pagination=PaginationMeta(
            page=page,
            per_page=per_page,
            total=total,
            total_pages=math.ceil(total / per_page)
        )
    )

# GET /api/v1/users/{id}
@router.get(
    "/{id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"model": ErrorResponse}
    }
)
async def get_user(
    id: str = Path(..., description="User ID")
):
    user = await User.get(id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return UserResponse.from_orm(user)

# POST /api/v1/users
@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "User created"},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse}
    }
)
async def create_user(user_data: UserCreate, request: Request):
    # Check uniqueness
    existing = await User.find_one({"email": user_data.email})
    if existing:
        raise ConflictException(
            detail="A user with this email already exists",
            instance=str(request.url.path)
        )

    # Create user
    user = User(**user_data.dict())
    await user.save()

    return UserResponse.from_orm(user)

# PATCH /api/v1/users/{id}
@router.patch(
    "/{id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse}
    }
)
async def update_user(
    id: str = Path(..., description="User ID"),
    updates: UserUpdate = None
):
    user = await User.get(id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Apply updates
    update_data = updates.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await user.save()
    return UserResponse.from_orm(user)

# DELETE /api/v1/users/{id}
@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorResponse}
    }
)
async def delete_user(
    id: str = Path(..., description="User ID")
):
    user = await User.get(id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    await user.delete()
    return None
```

### Error Handler

```python
# main.py
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from routes import users
import logging

app = FastAPI(title="Example API", version="1.0.0")

# Custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = ".".join(str(x) for x in error["loc"][1:])  # Skip 'body'
        errors.append({
            "field": field,
            "message": error["msg"]
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "type": "https://api.example.com/errors/validation",
            "title": "Validation Error",
            "status": 422,
            "detail": "The request contains invalid fields",
            "instance": str(request.url.path),
            "errors": errors
        }
    )

# Generic exception handler
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "type": "https://api.example.com/errors/internal",
            "title": "Internal Server Error",
            "status": 500,
            "detail": "An unexpected error occurred",
            "instance": str(request.url.path)
        }
    )

# Include routers
app.include_router(users.router)

# Rate limiting with slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "type": "https://api.example.com/errors/rate-limit",
            "title": "Too Many Requests",
            "status": 429,
            "detail": "Rate limit exceeded, please try again later",
            "instance": str(request.url.path)
        },
        headers={"Retry-After": "60"}
    )
```

---

## Go Examples

### Chi Router with Middleware

```go
// models/user.go
package models

import "time"

type User struct {
    ID        string    `json:"id" db:"id"`
    Email     string    `json:"email" db:"email"`
    Name      string    `json:"name" db:"name"`
    Status    string    `json:"status" db:"status"`
    CreatedAt time.Time `json:"createdAt" db:"created_at"`
    UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type UserCreate struct {
    Email    string `json:"email" validate:"required,email"`
    Name     string `json:"name" validate:"required,min=2,max=100"`
    Password string `json:"password" validate:"required,min=8"`
}

type UserUpdate struct {
    Email  *string `json:"email,omitempty" validate:"omitempty,email"`
    Name   *string `json:"name,omitempty" validate:"omitempty,min=2,max=100"`
    Status *string `json:"status,omitempty" validate:"omitempty,oneof=active inactive suspended"`
}

type PaginationMeta struct {
    Page       int `json:"page"`
    PerPage    int `json:"perPage"`
    Total      int `json:"total"`
    TotalPages int `json:"totalPages"`
}

type UserListResponse struct {
    Data       []User         `json:"data"`
    Pagination PaginationMeta `json:"pagination"`
}

type ErrorDetail struct {
    Field   string `json:"field"`
    Message string `json:"message"`
}

type ErrorResponse struct {
    Type     string         `json:"type"`
    Title    string         `json:"title"`
    Status   int            `json:"status"`
    Detail   string         `json:"detail"`
    Instance string         `json:"instance"`
    Errors   []ErrorDetail  `json:"errors,omitempty"`
}
```

### Handlers

```go
// handlers/users.go
package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "math"

    "github.com/go-chi/chi/v5"
    "github.com/go-playground/validator/v10"
    "example.com/api/models"
)

var validate = validator.New()

type UserHandler struct {
    // Add database connection, services, etc.
}

func NewUserHandler() *UserHandler {
    return &UserHandler{}
}

// GET /api/v1/users
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
    // Parse query params
    page, _ := strconv.Atoi(r.URL.Query().Get("page"))
    if page < 1 {
        page = 1
    }

    perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
    if perPage < 1 || perPage > 100 {
        perPage = 20
    }

    status := r.URL.Query().Get("status")
    sort := r.URL.Query().Get("sort")
    if sort == "" {
        sort = "created_at"
    }
    order := r.URL.Query().Get("order")
    if order != "asc" {
        order = "desc"
    }

    // Build query (pseudo-code - adapt to your DB)
    filters := make(map[string]interface{})
    if status != "" {
        filters["status"] = status
    }

    total, err := h.countUsers(filters)
    if err != nil {
        respondError(w, r, http.StatusInternalServerError, "Failed to count users", nil)
        return
    }

    offset := (page - 1) * perPage
    users, err := h.findUsers(filters, sort, order, offset, perPage)
    if err != nil {
        respondError(w, r, http.StatusInternalServerError, "Failed to fetch users", nil)
        return
    }

    response := models.UserListResponse{
        Data: users,
        Pagination: models.PaginationMeta{
            Page:       page,
            PerPage:    perPage,
            Total:      total,
            TotalPages: int(math.Ceil(float64(total) / float64(perPage))),
        },
    }

    respondJSON(w, http.StatusOK, response)
}

// GET /api/v1/users/{id}
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")

    user, err := h.findUserByID(id)
    if err != nil {
        respondError(w, r, http.StatusNotFound, "User not found", nil)
        return
    }

    respondJSON(w, http.StatusOK, map[string]interface{}{"data": user})
}

// POST /api/v1/users
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
    var input models.UserCreate
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        respondError(w, r, http.StatusBadRequest, "Invalid request body", nil)
        return
    }

    // Validate
    if err := validate.Struct(input); err != nil {
        errors := []models.ErrorDetail{}
        for _, err := range err.(validator.ValidationErrors) {
            errors = append(errors, models.ErrorDetail{
                Field:   err.Field(),
                Message: formatValidationError(err),
            })
        }
        respondError(w, r, http.StatusUnprocessableEntity, "Validation failed", errors)
        return
    }

    // Check uniqueness
    existing, _ := h.findUserByEmail(input.Email)
    if existing != nil {
        respondError(w, r, http.StatusConflict, "A user with this email already exists", nil)
        return
    }

    // Create user
    user, err := h.createUser(input)
    if err != nil {
        respondError(w, r, http.StatusInternalServerError, "Failed to create user", nil)
        return
    }

    w.Header().Set("Location", "/api/v1/users/"+user.ID)
    respondJSON(w, http.StatusCreated, map[string]interface{}{"data": user})
}

// PATCH /api/v1/users/{id}
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")

    var input models.UserUpdate
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        respondError(w, r, http.StatusBadRequest, "Invalid request body", nil)
        return
    }

    // Validate
    if err := validate.Struct(input); err != nil {
        errors := []models.ErrorDetail{}
        for _, err := range err.(validator.ValidationErrors) {
            errors = append(errors, models.ErrorDetail{
                Field:   err.Field(),
                Message: formatValidationError(err),
            })
        }
        respondError(w, r, http.StatusUnprocessableEntity, "Validation failed", errors)
        return
    }

    user, err := h.updateUser(id, input)
    if err != nil {
        respondError(w, r, http.StatusNotFound, "User not found", nil)
        return
    }

    respondJSON(w, http.StatusOK, map[string]interface{}{"data": user})
}

// DELETE /api/v1/users/{id}
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")

    err := h.deleteUser(id)
    if err != nil {
        respondError(w, r, http.StatusNotFound, "User not found", nil)
        return
    }

    w.WriteHeader(http.StatusNoContent)
}

// Helper functions
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, r *http.Request, status int, detail string, errors []models.ErrorDetail) {
    response := models.ErrorResponse{
        Type:     "https://api.example.com/errors/" + http.StatusText(status),
        Title:    http.StatusText(status),
        Status:   status,
        Detail:   detail,
        Instance: r.URL.Path,
        Errors:   errors,
    }
    respondJSON(w, status, response)
}

func formatValidationError(err validator.FieldError) string {
    switch err.Tag() {
    case "required":
        return "field is required"
    case "email":
        return "must be a valid email address"
    case "min":
        return "must be at least " + err.Param() + " characters"
    case "max":
        return "must be at most " + err.Param() + " characters"
    default:
        return "validation failed"
    }
}

// Stub database methods (implement with your DB layer)
func (h *UserHandler) countUsers(filters map[string]interface{}) (int, error) {
    // Implement DB query
    return 0, nil
}

func (h *UserHandler) findUsers(filters map[string]interface{}, sort, order string, offset, limit int) ([]models.User, error) {
    // Implement DB query
    return []models.User{}, nil
}

func (h *UserHandler) findUserByID(id string) (*models.User, error) {
    // Implement DB query
    return nil, nil
}

func (h *UserHandler) findUserByEmail(email string) (*models.User, error) {
    // Implement DB query
    return nil, nil
}

func (h *UserHandler) createUser(input models.UserCreate) (*models.User, error) {
    // Implement DB insert
    return nil, nil
}

func (h *UserHandler) updateUser(id string, input models.UserUpdate) (*models.User, error) {
    // Implement DB update
    return nil, nil
}

func (h *UserHandler) deleteUser(id string) error {
    // Implement DB delete
    return nil
}
```

### Router Setup with Middleware

```go
// main.go
package main

import (
    "log"
    "net/http"
    "time"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
    "github.com/go-chi/httprate"
    "example.com/api/handlers"
)

func main() {
    r := chi.NewRouter()

    // Middleware
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.RequestID)
    r.Use(middleware.RealIP)
    r.Use(middleware.Timeout(60 * time.Second))

    // Rate limiting
    r.Use(httprate.LimitByIP(100, 15*time.Minute))

    // CORS
    r.Use(corsMiddleware)

    // Routes
    userHandler := handlers.NewUserHandler()

    r.Route("/api/v1/users", func(r chi.Router) {
        r.Get("/", userHandler.ListUsers)
        r.Post("/", userHandler.CreateUser)
        r.Get("/{id}", userHandler.GetUser)
        r.Patch("/{id}", userHandler.UpdateUser)
        r.Delete("/{id}", userHandler.DeleteUser)
    })

    // 404 handler
    r.NotFound(func(w http.ResponseWriter, r *http.Request) {
        respondError(w, r, http.StatusNotFound, "The requested resource was not found", nil)
    })

    log.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", r))
}

func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusOK)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

---

## HATEOAS Basics

HATEOAS (Hypermedia as the Engine of Application State) adds hypermedia links to responses, allowing clients to discover available actions.

### When to Use HATEOAS

- Public APIs with evolving endpoints
- APIs requiring discoverability
- Complex workflows with state transitions

### When NOT to Use HATEOAS

- Internal microservices (overhead without benefit)
- Simple CRUD APIs
- High-performance requirements (links add payload size)

### Example Response

```json
{
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe",
    "status": "active"
  },
  "_links": {
    "self": { "href": "/api/v1/users/123" },
    "orders": { "href": "/api/v1/users/123/orders" },
    "update": { "href": "/api/v1/users/123", "method": "PATCH" },
    "delete": { "href": "/api/v1/users/123", "method": "DELETE" }
  }
}
```

### Conditional Links Based on State

```json
{
  "data": {
    "id": "order-456",
    "status": "pending",
    "total": 99.99
  },
  "_links": {
    "self": { "href": "/api/v1/orders/456" },
    "cancel": { "href": "/api/v1/orders/456/cancel", "method": "POST" },
    "pay": { "href": "/api/v1/orders/456/pay", "method": "POST" }
  }
}
```

If the order status is "completed", only `self` link would appear.

---

## Content Negotiation

Allow clients to request different formats or versions via headers.

### Accept Header for Format

```http
GET /api/v1/users
Accept: application/json        # Default
Accept: application/xml         # Return XML
Accept: text/csv                # Return CSV
```

Response:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "data": [...] }
```

### Custom Vendor MIME Types for Versioning

```http
GET /api/v1/users
Accept: application/vnd.api.v1+json    # Version 1
Accept: application/vnd.api.v2+json    # Version 2
```

### Handling Unsupported Media Types

```javascript
app.use((req, res, next) => {
  const accept = req.headers.accept || 'application/json';
  if (!accept.includes('application/json')) {
    return res.status(406).json({
      type: 'https://api.example.com/errors/not-acceptable',
      title: 'Not Acceptable',
      status: 406,
      detail: 'Only application/json is supported',
      instance: req.path
    });
  }
  next();
});
```

---

## Bulk Operations

### Bulk Create

```http
POST /api/v1/users/bulk
Content-Type: application/json

{
  "users": [
    { "email": "user1@example.com", "name": "User One", "password": "password123" },
    { "email": "user2@example.com", "name": "User Two", "password": "password456" }
  ]
}
```

Response:
```json
{
  "data": {
    "created": 2,
    "failed": 0,
    "results": [
      { "index": 0, "status": "success", "id": "123" },
      { "index": 1, "status": "success", "id": "124" }
    ]
  }
}
```

### Bulk Update

```http
PATCH /api/v1/users/bulk
Content-Type: application/json

{
  "updates": [
    { "id": "123", "status": "inactive" },
    { "id": "124", "name": "Updated Name" }
  ]
}
```

### Handling Partial Failures

Return 207 Multi-Status:
```json
{
  "data": {
    "created": 1,
    "failed": 1,
    "results": [
      { "index": 0, "status": "success", "id": "123" },
      {
        "index": 1,
        "status": "error",
        "error": {
          "type": "https://api.example.com/errors/validation",
          "detail": "Email already exists"
        }
      }
    ]
  }
}
```

---

## Webhook Patterns

### Webhook Registration

```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://example.com/webhook-receiver",
  "events": ["user.created", "user.updated", "user.deleted"],
  "secret": "your-signing-secret"
}
```

Response:
```json
{
  "data": {
    "id": "webhook-789",
    "url": "https://example.com/webhook-receiver",
    "events": ["user.created", "user.updated", "user.deleted"],
    "created_at": "2025-01-15T10:30:00Z",
    "status": "active"
  }
}
```

### Webhook Payload

```json
{
  "id": "event-abc123",
  "type": "user.created",
  "timestamp": "2025-01-15T10:35:00Z",
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Signature Verification (HMAC)

Server generates signature:
```javascript
const crypto = require('crypto');

function signPayload(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// Include in header
headers['X-Webhook-Signature'] = signPayload(payload, webhookSecret);
```

Client verifies:
```javascript
function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Retry Logic

- Retry failed webhooks with exponential backoff: 1s, 2s, 4s, 8s, 16s
- Mark webhook as failed after 5 attempts
- Store delivery attempts in database for debugging

Example retry middleware:
```javascript
async function deliverWebhook(webhook, payload, attempt = 1) {
  try {
    const signature = signPayload(payload, webhook.secret);
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-ID': payload.id
      },
      body: JSON.stringify(payload),
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await logDelivery(webhook.id, payload.id, 'success', attempt);
  } catch (error) {
    await logDelivery(webhook.id, payload.id, 'failed', attempt, error.message);

    if (attempt < 5) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      setTimeout(() => deliverWebhook(webhook, payload, attempt + 1), delay);
    } else {
      await markWebhookFailed(webhook.id);
    }
  }
}
```

### Webhook Testing Endpoint

Provide a test endpoint to trigger a sample webhook:
```http
POST /api/v1/webhooks/{id}/test
```

Response:
```json
{
  "data": {
    "status": "delivered",
    "http_status": 200,
    "latency_ms": 145
  }
}
```

---

## Additional Best Practices

### Idempotency Keys

For POST requests that should be idempotent (e.g., payments):
```http
POST /api/v1/payments
Idempotency-Key: unique-client-generated-key
Content-Type: application/json

{ "amount": 99.99, "currency": "USD" }
```

Server stores key and returns cached response if key is reused within TTL (24h).

### Conditional Requests (ETags)

```http
GET /api/v1/users/123
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# Client caches response, includes ETag in next request
GET /api/v1/users/123
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# If unchanged, return 304 Not Modified (no body)
HTTP/1.1 304 Not Modified
```

### Range Requests for Large Resources

```http
GET /api/v1/reports/large-export.csv
Range: bytes=0-1023

HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/5000
Content-Length: 1024
```

### API Health Check

```http
GET /api/health

{
  "status": "healthy",
  "version": "1.2.3",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "storage": "ok"
  }
}
```

---

## Summary

This document provides framework-specific patterns for building production-ready REST APIs. Key takeaways:

1. **Consistency**: Use consistent error responses, status codes, and URL patterns
2. **Validation**: Always validate inputs and return detailed error messages
3. **Pagination**: Implement pagination for list endpoints
4. **Error Handling**: Use centralized error handling middleware
5. **Security**: Rate limiting, authentication, input sanitization
6. **Documentation**: Keep OpenAPI specs in sync with implementation
7. **Testing**: Test error cases, edge cases, and happy paths

Adapt these patterns to your specific framework and requirements.
