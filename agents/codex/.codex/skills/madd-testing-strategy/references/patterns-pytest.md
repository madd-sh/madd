# Pytest Testing Patterns

## Setup

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = "test_*.py"
python_functions = "test_*"
addopts = "-v --tb=short"

[tool.coverage.run]
source = ["src"]
omit = ["tests/*"]

[tool.coverage.report]
fail_under = 70
```

## Unit Test Pattern

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.auth.user_service import create_user, AuthenticationError


class TestCreateUser:
    def test_creates_user_with_hashed_password(self):
        # Arrange
        mock_repo = MagicMock()
        mock_repo.save.return_value = {"id": "1", "email": "test@example.com"}

        # Act
        user = create_user(mock_repo, email="test@example.com", password="secret")

        # Assert
        assert user["id"] == "1"
        mock_repo.save.assert_called_once()
        saved_user = mock_repo.save.call_args[0][0]
        assert saved_user["email"] == "test@example.com"
        assert saved_user["password"] != "secret"  # should be hashed

    def test_raises_validation_error_for_invalid_email(self):
        mock_repo = MagicMock()

        with pytest.raises(ValueError, match="invalid email"):
            create_user(mock_repo, email="invalid", password="secret")
```

## Integration Test Pattern (FastAPI)

```python
import pytest
from httpx import AsyncClient, ASGITransport
from src.main import app
from src.database import get_db, init_test_db


@pytest.fixture(autouse=True)
async def setup_db():
    await init_test_db()
    yield
    await cleanup_test_db()


@pytest.mark.asyncio
class TestAuthLogin:
    async def test_returns_200_with_valid_jwt(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/login", json={
                "email": "test@example.com",
                "password": "correct-password"
            })

        assert response.status_code == 200
        assert "token" in response.json()

    async def test_returns_401_for_wrong_password(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/login", json={
                "email": "test@example.com",
                "password": "wrong"
            })

        assert response.status_code == 401

    async def test_returns_422_for_missing_email(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/login", json={
                "password": "some-password"
            })

        assert response.status_code == 422
```

## Fixtures

```python
@pytest.fixture
def sample_user():
    return {"email": "test@example.com", "name": "Test User"}

@pytest.fixture
def mock_email_service():
    with patch("src.services.email.send_email") as mock:
        mock.return_value = {"message_id": "mock-123"}
        yield mock

@pytest.fixture(autouse=True)
def reset_env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///test.db")
```

## Parametrized Tests

```python
@pytest.mark.parametrize("email,valid", [
    ("user@example.com", True),
    ("user@sub.example.com", True),
    ("invalid", False),
    ("@example.com", False),
    ("", False),
])
def test_email_validation(email, valid):
    assert validate_email(email) == valid
```

## Common Assertions

```python
# Equality
assert result == 42
assert result == {"name": "test"}

# Truthiness
assert result is True
assert result is None
assert result is not None

# Collections
assert len(items) == 3
assert "item" in items
assert {"id": 1} in items

# Exceptions
with pytest.raises(ValueError):
    do_something()

with pytest.raises(ValueError, match="specific message"):
    do_something()

# Approximate
assert result == pytest.approx(3.14, abs=0.01)
```
