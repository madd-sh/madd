# Python Conventions (PEP 8+)

## Project Layout

```
project/
├── pyproject.toml          # Project metadata, dependencies, tool config
├── src/
│   └── project_name/       # Source package (snake_case)
│       ├── __init__.py
│       ├── config.py        # Settings, env loading
│       ├── domain/          # Business logic
│       │   ├── __init__.py
│       │   ├── models.py    # Domain entities
│       │   └── services.py  # Business logic
│       ├── api/             # HTTP layer
│       │   ├── __init__.py
│       │   ├── routes.py
│       │   └── schemas.py   # Pydantic models for API
│       └── infrastructure/  # External integrations
│           ├── __init__.py
│           ├── database.py
│           └── repositories.py
├── tests/
│   ├── conftest.py          # Shared fixtures
│   ├── unit/
│   └── integration/
└── .env.example
```

## Naming Conventions

```python
# Files: snake_case
# user_service.py, auth_middleware.py, create_user_dto.py

# Classes: PascalCase
class UserService: ...
class CreateUserInput: ...

# Functions/methods: snake_case
def get_user(user_id: str) -> User: ...
def validate_email(email: str) -> bool: ...
async def create_order(input: CreateOrderInput) -> Order: ...

# Constants: UPPER_SNAKE_CASE
MAX_RETRIES = 3
DEFAULT_PAGE_SIZE = 20
JWT_EXPIRY_SECONDS = 900

# Private: underscore prefix
class UserService:
    def __init__(self):
        self._cache: dict[str, User] = {}

    def _validate_input(self, data: dict) -> bool: ...

# Boolean: is_/has_/can_/should_ prefix
is_authenticated = True
has_permission = check_permission(user, resource)
can_delete = user.role == "admin"
```

## Type Hints (Always Use)

```python
from typing import Optional, TypeAlias
from collections.abc import Sequence

# Use built-in generics (Python 3.10+)
def get_users(ids: list[str]) -> list[User]: ...
def get_config() -> dict[str, str]: ...

# Use | for unions (Python 3.10+)
def find_user(id: str) -> User | None: ...

# TypeAlias for complex types
UserId: TypeAlias = str
UserMap: TypeAlias = dict[UserId, User]

# Dataclasses for data structures
from dataclasses import dataclass

@dataclass(frozen=True)
class CreateUserInput:
    email: str
    name: str
    role: str = "user"

# Pydantic for validation + serialization
from pydantic import BaseModel, EmailStr, Field

class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
```

## Error Handling

```python
# Define exception hierarchy per domain
class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500):
        super().__init__(message)
        self.code = code
        self.status_code = status_code

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            f"{resource} with id {resource_id} not found",
            "NOT_FOUND",
            404,
        )

class ValidationError(AppError):
    def __init__(self, message: str, fields: dict[str, list[str]]):
        super().__init__(message, "VALIDATION_ERROR", 400)
        self.fields = fields

# FastAPI exception handler
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": str(exc), "code": exc.code},
    )
```

## Import Order

```python
# 1. Standard library
import os
from datetime import datetime, timezone
from pathlib import Path

# 2. Third-party packages
from fastapi import FastAPI, Depends
from pydantic import BaseModel

# 3. Internal imports
from project_name.domain.models import User
from project_name.infrastructure.database import get_db

# Use isort or ruff to enforce automatically
```

## Async Patterns

```python
import asyncio

# Always use async context managers for resources
async with aiohttp.ClientSession() as session:
    async with session.get(url) as response:
        data = await response.json()

# Use asyncio.gather for parallel operations
users, orders = await asyncio.gather(
    fetch_user(user_id),
    fetch_orders(user_id),
)

# Use asyncio.TaskGroup (Python 3.11+) for structured concurrency
async with asyncio.TaskGroup() as tg:
    task1 = tg.create_task(fetch_user(user_id))
    task2 = tg.create_task(fetch_orders(user_id))
# Both tasks guaranteed complete here
```
