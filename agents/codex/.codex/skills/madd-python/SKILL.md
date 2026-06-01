---
name: madd-python
description: Use this skill when working with Python projects. Covers type hints, project configuration, async patterns, testing with pytest, and modern Python idioms (3.12+).
metadata:
  short-description: Python best practices
---

# Python Best Practices for MADD Agents

This skill provides comprehensive guidance for development and audit agents working with Python projects. It covers modern Python 3.12+ practices, type safety, async patterns, testing, and tooling.

## 1. Project Configuration (pyproject.toml)

Modern Python projects use `pyproject.toml` as the single source of truth. Avoid legacy `setup.py` or `setup.cfg`.

### Complete pyproject.toml Example

```toml
[project]
name = "my-project"
version = "0.1.0"
description = "A modern Python project"
readme = "README.md"
requires-python = ">=3.12"
license = {text = "MIT"}
authors = [
    {name = "Your Name", email = "you@example.com"}
]
dependencies = [
    "httpx>=0.27.0",
    "pydantic>=2.0.0",
    "structlog>=24.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "mypy>=1.8.0",
    "ruff>=0.2.0",
]

[project.scripts]
my-cli = "my_project.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = [
    "E",      # pycodestyle errors
    "W",      # pycodestyle warnings
    "F",      # pyflakes
    "I",      # isort
    "N",      # pep8-naming
    "UP",     # pyupgrade
    "ASYNC",  # async best practices
    "B",      # bugbear
    "C4",     # comprehensions
    "DTZ",    # datetime
    "T20",    # print statements
    "RET",    # return values
    "SIM",    # simplify
]
ignore = ["E501"]  # line too long (handled by formatter)

[tool.ruff.format]
quote-style = "double"
indent-style = "space"

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_any_generics = true
check_untyped_defs = true
no_implicit_optional = true

[tool.pytest.ini_options]
minversion = "8.0"
addopts = [
    "--strict-markers",
    "--strict-config",
    "--cov=my_project",
    "--cov-report=term-missing",
]
testpaths = ["tests"]
asyncio_mode = "auto"
```

### Virtual Environment Strategy

**Recommended: uv (fastest)**
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create venv and install deps
uv venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uv pip install -e ".[dev]"
```

**Alternative: Standard venv**
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Dependency Management

| Tool | Use Case | Speed |
|------|----------|-------|
| `uv` | Modern, fast, drop-in pip replacement | 10-100x faster |
| `pip` | Standard, stable | Baseline |
| `poetry` | Complex dependency resolution | Slower but thorough |

**Best practice:** Use `uv` for speed, fall back to `pip` if compatibility issues arise.

## 2. Type Hints (Modern Python 3.12+)

Type hints improve code quality, enable static analysis, and provide excellent IDE support.

### Built-in Generics (3.9+, mandatory in 3.12+)

```python
# Modern (Python 3.12+)
def process_items(items: list[str]) -> dict[str, int]:
    return {item: len(item) for item in items}

# Legacy (avoid)
from typing import List, Dict
def process_items(items: List[str]) -> Dict[str, int]:
    ...
```

### Union Types with `|` (3.10+)

```python
# Modern
def find_user(user_id: int) -> User | None:
    ...

# Legacy (avoid)
from typing import Optional, Union
def find_user(user_id: int) -> Optional[User]:
    ...

# Multiple unions
def parse_value(val: str | int | float) -> bool:
    ...
```

### TypeVar and ParamSpec

```python
from typing import TypeVar, ParamSpec, Callable

T = TypeVar("T")
P = ParamSpec("P")

# Generic function
def first(items: list[T]) -> T | None:
    return items[0] if items else None

# Decorator with ParamSpec
def log_calls(func: Callable[P, T]) -> Callable[P, T]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper
```

### Protocol for Structural Typing

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> str:
        ...

class Circle:
    def draw(self) -> str:
        return "circle"

class Square:
    def draw(self) -> str:
        return "square"

def render(shape: Drawable) -> None:
    print(shape.draw())

# Both work without explicit inheritance
render(Circle())
render(Square())
```

### TypedDict for Dict Shapes

```python
from typing import TypedDict, NotRequired

class UserDict(TypedDict):
    id: int
    name: str
    email: str
    nickname: NotRequired[str]  # Optional field (3.11+)

def create_user(data: UserDict) -> None:
    print(data["name"])  # Type-safe access
```

### @overload for Multiple Signatures

```python
from typing import overload

@overload
def get_item(key: int) -> str: ...

@overload
def get_item(key: str) -> int: ...

def get_item(key: int | str) -> str | int:
    if isinstance(key, int):
        return f"item_{key}"
    return len(key)
```

### Generic Classes

```python
from typing import Generic, TypeVar

T = TypeVar("T")

class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T | None:
        return self._items.pop() if self._items else None

# Usage
int_stack: Stack[int] = Stack()
int_stack.push(42)
```

## 3. Dataclasses vs Pydantic

### When to Use Dataclasses

Use for **internal domain objects** that don't need validation or serialization.

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float

    def distance_from_origin(self) -> float:
        return (self.x**2 + self.y**2)**0.5

@dataclass
class Graph:
    nodes: list[str] = field(default_factory=list)  # Mutable default
    edges: dict[str, list[str]] = field(default_factory=dict)
```

**Benefits:**
- `frozen=True`: Immutable, hashable, thread-safe
- `slots=True`: 20-30% memory reduction (3.10+)
- Fast, built-in, no dependencies

### When to Use Pydantic

Use for **API boundaries, validation, and serialization**.

```python
from pydantic import BaseModel, Field, field_validator, computed_field

class User(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=100)
    email: str
    age: int = Field(ge=0, le=150)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("Invalid email")
        return v.lower()

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.name} ({self.email})"

# Validation happens automatically
user = User(id=1, name="Alice", email="ALICE@EXAMPLE.COM", age=30)
print(user.display_name)  # Alice (alice@example.com)

# JSON serialization
print(user.model_dump_json())
```

**Benefits:**
- Automatic validation
- JSON/dict serialization
- Environment variable parsing (pydantic-settings)
- OpenAPI schema generation

### Decision Matrix

| Use Case | Tool |
|----------|------|
| Internal data structures | `dataclass` |
| API request/response models | `Pydantic` |
| Configuration from env vars | `pydantic-settings` |
| Database models | SQLAlchemy + Pydantic |
| Value objects (immutable) | `dataclass(frozen=True)` |

## 4. Async Patterns

### asyncio.gather for Parallel Operations

```python
import asyncio

async def fetch_user(user_id: int) -> dict:
    await asyncio.sleep(0.1)  # Simulate API call
    return {"id": user_id, "name": f"User {user_id}"}

async def main() -> None:
    # Parallel execution
    users = await asyncio.gather(
        fetch_user(1),
        fetch_user(2),
        fetch_user(3),
    )
    print(users)

# Run
asyncio.run(main())
```

### asyncio.TaskGroup for Structured Concurrency (3.11+)

**Preferred over manual task tracking** - automatically handles cancellation and exceptions.

```python
async def process_items(items: list[int]) -> list[str]:
    results: list[str] = []

    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(process_item(item)) for item in items]

    # All tasks guaranteed to complete (or all cancelled if one fails)
    return [task.result() for task in tasks]

async def process_item(item: int) -> str:
    await asyncio.sleep(0.1)
    return f"Processed {item}"
```

### Async Context Managers for Resources

```python
from typing import AsyncIterator
from contextlib import asynccontextmanager

@asynccontextmanager
async def database_connection(url: str) -> AsyncIterator[Connection]:
    conn = await connect(url)
    try:
        yield conn
    finally:
        await conn.close()

# Usage
async with database_connection("postgresql://...") as conn:
    await conn.execute("SELECT * FROM users")
```

### asyncio.Semaphore for Concurrency Limits

```python
async def download_with_limit(urls: list[str], max_concurrent: int = 5) -> None:
    semaphore = asyncio.Semaphore(max_concurrent)

    async def download(url: str) -> None:
        async with semaphore:
            # Only max_concurrent downloads at once
            await fetch(url)

    await asyncio.gather(*[download(url) for url in urls])
```

### When to Use Sync vs Async

| Use Sync When | Use Async When |
|--------------|----------------|
| CPU-bound operations | I/O-bound operations |
| Simple scripts | Network requests |
| No concurrency needed | High concurrency (100+ tasks) |
| Calling sync libraries | Using async libraries (httpx, aiohttp) |

**Anti-pattern:** Don't use async for CPU-bound work. Use `concurrent.futures.ProcessPoolExecutor` instead.

## 5. Testing with pytest

### conftest.py Hierarchy

```
project/
├── conftest.py              # Root fixtures
├── tests/
│   ├── conftest.py          # Shared test fixtures
│   ├── unit/
│   │   ├── conftest.py      # Unit test fixtures
│   │   └── test_models.py
│   └── integration/
│       ├── conftest.py      # Integration fixtures
│       └── test_api.py
```

### Fixtures with Scope

```python
import pytest
from typing import Iterator

@pytest.fixture(scope="function")  # Default, runs per test
def user() -> User:
    return User(id=1, name="Test")

@pytest.fixture(scope="class")  # Runs once per test class
def database() -> Iterator[Database]:
    db = Database.connect()
    yield db
    db.close()

@pytest.fixture(scope="module")  # Runs once per test file
def api_client() -> APIClient:
    return APIClient(base_url="http://test")

@pytest.fixture(scope="session")  # Runs once per test session
def docker_services() -> Iterator[None]:
    # Start Docker containers
    start_services()
    yield
    stop_services()
```

### pytest.mark.parametrize

```python
import pytest

@pytest.mark.parametrize("input,expected", [
    (1, 2),
    (2, 4),
    (3, 6),
])
def test_double(input: int, expected: int) -> None:
    assert double(input) == expected

@pytest.mark.parametrize("value", [
    pytest.param(-1, marks=pytest.mark.skip(reason="Negative not implemented")),
    pytest.param(0),
    pytest.param(1),
])
def test_with_skip(value: int) -> None:
    assert process(value) >= 0
```

### unittest.mock.patch vs monkeypatch

```python
from unittest.mock import patch, MagicMock
import pytest

# unittest.mock.patch (decorator or context manager)
@patch("my_module.external_api_call")
def test_with_patch(mock_api: MagicMock) -> None:
    mock_api.return_value = {"status": "ok"}
    result = my_function()
    assert result == "ok"

# pytest monkeypatch (cleaner for simple cases)
def test_with_monkeypatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("my_module.API_KEY", "test-key")
    monkeypatch.setenv("ENV", "test")
    result = my_function()
    assert result == "ok"
```

### Async Test Patterns with pytest-asyncio

```python
import pytest

@pytest.mark.asyncio
async def test_async_function() -> None:
    result = await fetch_data()
    assert result is not None

@pytest.fixture
async def async_client() -> AsyncIterator[AsyncClient]:
    client = AsyncClient()
    await client.connect()
    yield client
    await client.disconnect()

@pytest.mark.asyncio
async def test_with_async_fixture(async_client: AsyncClient) -> None:
    response = await async_client.get("/users")
    assert response.status == 200
```

### Coverage with pytest-cov

```bash
# Run tests with coverage
pytest --cov=my_project --cov-report=term-missing

# Generate HTML report
pytest --cov=my_project --cov-report=html

# Fail if coverage below threshold
pytest --cov=my_project --cov-fail-under=80
```

**pytest.ini or pyproject.toml:**
```toml
[tool.pytest.ini_options]
addopts = [
    "--cov=my_project",
    "--cov-report=term-missing",
    "--cov-fail-under=80",
]
```

## 6. Common Anti-Patterns

| Anti-Pattern | Why Bad | Better |
|-------------|---------|--------|
| **Mutable default args** | Shared state between calls, bugs | `field(default_factory=list)` |
| **Bare `except:`** | Catches SystemExit, KeyboardInterrupt | `except Exception:` |
| **`import *`** | Namespace pollution, unclear origins | Explicit imports |
| **Global mutable state** | Hard to test, race conditions | Dependency injection |
| **String formatting with `+`** | Slow, error-prone | f-strings |
| **No type hints** | Poor IDE support, no static analysis | Type everything |
| **Manual task tracking** | Easy to leak tasks, complex | `asyncio.TaskGroup` |
| **`time.sleep()` in async** | Blocks event loop | `asyncio.sleep()` |
| **Ignoring return values** | Errors silently ignored | Check or explicitly discard |
| **Using `setupClass`/`tearDown`** | Less flexible than fixtures | pytest fixtures |

### Examples

**Mutable default args (WRONG):**
```python
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

add_item("a")  # ["a"]
add_item("b")  # ["a", "b"]  <- BUG! Shared list
```

**Correct:**
```python
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items
```

**Bare except (WRONG):**
```python
try:
    risky_operation()
except:  # Catches EVERYTHING including KeyboardInterrupt
    pass
```

**Correct:**
```python
try:
    risky_operation()
except Exception as e:  # Only catches exceptions
    logger.error("Operation failed", exc_info=e)
```

## 7. Package Ecosystem

### Core Tools

| Category | Package | Why |
|----------|---------|-----|
| **Framework** | FastAPI | Async, type-safe, auto OpenAPI docs |
| **ORM** | SQLAlchemy 2.0 | Mature, async support, great tooling |
| **Validation** | Pydantic v2 | Fast, great DX, built-in JSON schema |
| **Testing** | pytest | Standard, powerful fixtures |
| **Linting** | ruff | 10-100x faster than flake8+isort+black |
| **Type checking** | mypy | Standard, strict mode |
| **HTTP client** | httpx | Async, modern, requests-compatible API |
| **Logging** | structlog | Structured logging, JSON output |
| **Settings** | pydantic-settings | Type-safe env vars |

### Framework-Specific

| Framework | Use Case | Alternatives |
|-----------|----------|--------------|
| FastAPI | REST APIs, async | Flask (sync), Django (batteries-included) |
| Django | Full-stack web apps | FastAPI + frontend framework |
| Click | CLI tools | Typer (type-safe), argparse (stdlib) |
| Celery | Background tasks | Dramatiq, RQ |
| pytest | Testing | unittest (stdlib, less powerful) |

### Data & ML

| Category | Package | Why |
|----------|---------|-----|
| Data manipulation | pandas | Standard for tabular data |
| Data validation | pandera | Schema validation for dataframes |
| Machine learning | scikit-learn | Standard ML library |
| Deep learning | PyTorch | Research and production |
| Array computing | numpy | Foundation for scientific Python |

## 8. Verification Checklist (for Audit)

Use this checklist when auditing Python projects:

### Project Structure
- [ ] `pyproject.toml` configured (not `setup.py` or `setup.cfg`)
- [ ] Virtual environment present (`.venv/` or similar)
- [ ] Dependencies pinned with version constraints
- [ ] Dev dependencies separated from production
- [ ] README with setup instructions

### Type Safety
- [ ] Type hints on all public functions and methods
- [ ] `mypy` configured in `pyproject.toml`
- [ ] `mypy --strict` passes (or documented exceptions)
- [ ] No `type: ignore` without explanation
- [ ] Modern type syntax (`list[str]`, `str | None`)

### Code Quality
- [ ] `ruff` configured for linting and formatting
- [ ] `ruff check` passes
- [ ] `ruff format` applied
- [ ] No bare `except:` blocks
- [ ] No mutable default arguments
- [ ] No `import *` statements

### Async Code
- [ ] `asyncio.TaskGroup` or `asyncio.gather` used (not manual task tracking)
- [ ] `asyncio.sleep()` used instead of `time.sleep()`
- [ ] Async context managers for resources
- [ ] Semaphores for concurrency limits where appropriate

### Testing
- [ ] Tests in `tests/` directory
- [ ] `pytest` configured in `pyproject.toml`
- [ ] Fixtures in `conftest.py`
- [ ] No `setUp`/`tearDown` methods (use fixtures)
- [ ] Coverage >= 80% (or documented reason)
- [ ] Async tests use `@pytest.mark.asyncio`

### Dependencies
- [ ] All dependencies in `pyproject.toml`
- [ ] No hardcoded secrets or API keys
- [ ] Environment variables for configuration
- [ ] Minimal dependency footprint

### Documentation
- [ ] Docstrings on public API
- [ ] Type hints serve as inline documentation
- [ ] README with examples
- [ ] CHANGELOG maintained (if versioned)

### Commands to Run

```bash
# Type checking
mypy .

# Linting
ruff check .

# Formatting
ruff format .

# Tests with coverage
pytest --cov=my_project --cov-report=term-missing

# Full audit
mypy . && ruff check . && ruff format --check . && pytest
```

## Summary

This skill covers:
1. **Project configuration** with modern `pyproject.toml` and tooling
2. **Type hints** using Python 3.12+ built-in generics and advanced patterns
3. **Dataclasses vs Pydantic** decision framework
4. **Async patterns** with structured concurrency
5. **Testing** with pytest fixtures and patterns
6. **Anti-patterns** to avoid
7. **Package ecosystem** recommendations
8. **Verification checklist** for audits

Apply these practices to ensure high-quality, maintainable Python code.
