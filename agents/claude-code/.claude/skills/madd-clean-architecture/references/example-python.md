# Python Clean Architecture Example

Complete example showing clean architecture with Python, FastAPI, and SQLAlchemy.

## Project Structure

```
src/
├── domain/
│   ├── entities/
│   │   └── user.py
│   ├── repositories/
│   │   └── user_repository.py
│   └── errors/
│       └── domain_errors.py
├── application/
│   ├── use_cases/
│   │   └── create_user.py
│   └── dtos/
│       ├── user_input.py
│       └── user_output.py
├── infrastructure/
│   ├── repositories/
│   │   └── sqlalchemy_user_repository.py
│   ├── http/
│   │   └── user_router.py
│   ├── database.py
│   └── container.py
└── main.py
```

## Domain Layer

### Domain Entity

```python
# src/domain/entities/user.py

from dataclasses import dataclass
from datetime import datetime
import re


@dataclass
class User:
    """Domain entity representing a user.

    Contains business logic and validation rules.
    """
    id: str
    email: str
    _password: str
    created_at: datetime

    def __post_init__(self):
        self._validate_email(self.email)
        self._validate_password(self._password)

    @staticmethod
    def _validate_email(email: str) -> None:
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, email):
            raise ValueError("Invalid email format")

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters")

    def change_password(self, old_password: str, new_password: str) -> None:
        """Domain behavior: change user password."""
        if self._password != old_password:
            raise ValueError("Current password is incorrect")
        self._validate_password(new_password)
        self._password = new_password

    def verify_password(self, password: str) -> bool:
        """Check if provided password matches."""
        return self._password == password

    @property
    def password(self) -> str:
        """Password is read-only from outside."""
        return self._password
```

### Repository Interface (Port)

```python
# src/domain/repositories/user_repository.py

from abc import ABC, abstractmethod
from typing import Optional
from ..entities.user import User


class UserRepository(ABC):
    """Repository interface defined in domain layer.

    Infrastructure layer will provide concrete implementation.
    """

    @abstractmethod
    async def find_by_id(self, user_id: str) -> Optional[User]:
        """Find user by ID."""
        pass

    @abstractmethod
    async def find_by_email(self, email: str) -> Optional[User]:
        """Find user by email."""
        pass

    @abstractmethod
    async def save(self, user: User) -> None:
        """Persist user entity."""
        pass

    @abstractmethod
    async def exists(self, email: str) -> bool:
        """Check if user with email exists."""
        pass
```

### Domain Errors

```python
# src/domain/errors/domain_errors.py

class DomainError(Exception):
    """Base class for domain errors."""
    pass


class UserAlreadyExistsError(DomainError):
    """Raised when attempting to create a user that already exists."""

    def __init__(self, email: str):
        self.email = email
        super().__init__(f"User with email {email} already exists")


class UserNotFoundError(DomainError):
    """Raised when user is not found."""

    def __init__(self, identifier: str):
        super().__init__(f"User not found: {identifier}")
```

## Application Layer

### DTOs

```python
# src/application/dtos/user_input.py

from pydantic import BaseModel, EmailStr, Field


class CreateUserInput(BaseModel):
    """Input DTO for creating a user."""
    email: EmailStr
    password: str = Field(min_length=8)

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword123"
            }
        }
```

```python
# src/application/dtos/user_output.py

from pydantic import BaseModel
from datetime import datetime
from ...domain.entities.user import User


class UserOutput(BaseModel):
    """Output DTO for user data."""
    id: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserMapper:
    """Maps domain entities to DTOs."""

    @staticmethod
    def to_output(user: User) -> UserOutput:
        """Convert User entity to UserOutput DTO."""
        return UserOutput(
            id=user.id,
            email=user.email,
            created_at=user.created_at
        )
```

### Use Case

```python
# src/application/use_cases/create_user.py

import uuid
from datetime import datetime
from typing import Protocol

from ...domain.entities.user import User
from ...domain.repositories.user_repository import UserRepository
from ...domain.errors.domain_errors import UserAlreadyExistsError
from ..dtos.user_input import CreateUserInput
from ..dtos.user_output import UserOutput, UserMapper


class PasswordHasher(Protocol):
    """Port for password hashing service."""
    def hash(self, password: str) -> str: ...


class CreateUserUseCase:
    """Use case for creating a new user.

    Contains application logic and orchestration.
    """

    def __init__(
        self,
        user_repository: UserRepository,
        password_hasher: PasswordHasher | None = None
    ):
        self._user_repository = user_repository
        self._password_hasher = password_hasher

    async def execute(self, input_dto: CreateUserInput) -> UserOutput:
        """Execute the create user use case."""

        # Business rule: email must be unique
        exists = await self._user_repository.exists(input_dto.email)
        if exists:
            raise UserAlreadyExistsError(input_dto.email)

        # Hash password if hasher is provided
        password = input_dto.password
        if self._password_hasher:
            password = self._password_hasher.hash(password)

        # Create domain entity
        user = User(
            id=str(uuid.uuid4()),
            email=input_dto.email,
            _password=password,
            created_at=datetime.utcnow()
        )

        # Persist
        await self._user_repository.save(user)

        # Return DTO, not entity
        return UserMapper.to_output(user)
```

## Infrastructure Layer

### Database Configuration

```python
# src/infrastructure/database.py

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "postgresql+asyncpg://user:password@localhost/dbname"

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency for getting database session."""
    async with AsyncSessionLocal() as session:
        yield session
```

### Repository Implementation (Adapter)

```python
# src/infrastructure/repositories/sqlalchemy_user_repository.py

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from ...domain.entities.user import User
from ...domain.repositories.user_repository import UserRepository
from ..database import Base


# SQLAlchemy model (infrastructure concern)
class UserModel(Base):
    """SQLAlchemy model for users table."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    password: Mapped[str]
    created_at: Mapped[datetime]


class SQLAlchemyUserRepository(UserRepository):
    """SQLAlchemy implementation of UserRepository."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def find_by_id(self, user_id: str) -> Optional[User]:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_email(self, email: str) -> Optional[User]:
        result = await self._session.execute(
            select(UserModel).where(UserModel.email == email)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def save(self, user: User) -> None:
        # Check if exists
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user.id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update
            existing.email = user.email
            existing.password = user.password
        else:
            # Insert
            model = UserModel(
                id=user.id,
                email=user.email,
                password=user.password,
                created_at=user.created_at
            )
            self._session.add(model)

        await self._session.commit()

    async def exists(self, email: str) -> bool:
        result = await self._session.execute(
            select(UserModel).where(UserModel.email == email)
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    def _to_entity(model: UserModel) -> User:
        """Convert SQLAlchemy model to domain entity."""
        return User(
            id=model.id,
            email=model.email,
            _password=model.password,
            created_at=model.created_at
        )
```

### HTTP Router

```python
# src/infrastructure/http/user_router.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...application.use_cases.create_user import CreateUserUseCase
from ...application.dtos.user_input import CreateUserInput
from ...application.dtos.user_output import UserOutput
from ...domain.errors.domain_errors import UserAlreadyExistsError
from ..database import get_db
from ..repositories.sqlalchemy_user_repository import SQLAlchemyUserRepository


router = APIRouter(prefix="/users", tags=["users"])


def get_create_user_use_case(
    db: AsyncSession = Depends(get_db)
) -> CreateUserUseCase:
    """Dependency injection for CreateUserUseCase."""
    repository = SQLAlchemyUserRepository(db)
    return CreateUserUseCase(repository)


@router.post(
    "",
    response_model=UserOutput,
    status_code=status.HTTP_201_CREATED
)
async def create_user(
    input_dto: CreateUserInput,
    use_case: CreateUserUseCase = Depends(get_create_user_use_case)
) -> UserOutput:
    """Create a new user endpoint."""
    try:
        return await use_case.execute(input_dto)
    except UserAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
```

### Dependency Injection Container (Alternative)

```python
# src/infrastructure/container.py

from functools import lru_cache
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.repositories.user_repository import UserRepository
from ..application.use_cases.create_user import CreateUserUseCase
from .repositories.sqlalchemy_user_repository import SQLAlchemyUserRepository


class Container:
    """Simple dependency injection container."""

    def __init__(self, db_session: AsyncSession):
        self._db_session = db_session
        self._user_repository: UserRepository | None = None
        self._create_user_use_case: CreateUserUseCase | None = None

    @property
    def user_repository(self) -> UserRepository:
        if self._user_repository is None:
            self._user_repository = SQLAlchemyUserRepository(self._db_session)
        return self._user_repository

    @property
    def create_user_use_case(self) -> CreateUserUseCase:
        if self._create_user_use_case is None:
            self._create_user_use_case = CreateUserUseCase(
                self.user_repository
            )
        return self._create_user_use_case
```

## Application Entry Point

```python
# src/main.py

from fastapi import FastAPI
from .infrastructure.http.user_router import router as user_router
from .infrastructure.database import engine, Base

app = FastAPI(title="Clean Architecture Example")

# Include routers
app.include_router(user_router)


@app.on_event("startup")
async def startup():
    """Create database tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.on_event("shutdown")
async def shutdown():
    """Close database connections on shutdown."""
    await engine.dispose()


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

## Import Rules

### Domain Layer (src/domain/)
```python
# ✅ ALLOWED
from .entities.user import User
from .repositories.user_repository import UserRepository
from dataclasses import dataclass
from datetime import datetime
from abc import ABC, abstractmethod

# ❌ FORBIDDEN
from sqlalchemy import Column  # Infrastructure dependency
from fastapi import FastAPI  # Framework dependency
from ...application.use_cases import CreateUser  # Outer layer
```

### Application Layer (src/application/)
```python
# ✅ ALLOWED
from ...domain.entities.user import User
from ...domain.repositories.user_repository import UserRepository
from pydantic import BaseModel  # DTOs only
from typing import Protocol  # For defining ports

# ❌ FORBIDDEN
from ...infrastructure.repositories import SQLAlchemyUserRepository  # Implementation
from sqlalchemy import select  # Infrastructure
from fastapi import APIRouter  # Framework
```

### Infrastructure Layer (src/infrastructure/)
```python
# ✅ ALLOWED
from sqlalchemy import Column, String
from fastapi import APIRouter, Depends
from ...domain.entities.user import User
from ...domain.repositories.user_repository import UserRepository
from ...application.use_cases.create_user import CreateUserUseCase
from ...application.dtos.user_input import CreateUserInput

# ⚠️ Be careful with cross-feature dependencies
```

## Testing Example

```python
# tests/application/test_create_user.py

import pytest
from datetime import datetime
from typing import Optional

from src.domain.entities.user import User
from src.domain.repositories.user_repository import UserRepository
from src.domain.errors.domain_errors import UserAlreadyExistsError
from src.application.use_cases.create_user import CreateUserUseCase
from src.application.dtos.user_input import CreateUserInput


class InMemoryUserRepository(UserRepository):
    """In-memory repository for testing."""

    def __init__(self):
        self._users: dict[str, User] = {}

    async def find_by_id(self, user_id: str) -> Optional[User]:
        return self._users.get(user_id)

    async def find_by_email(self, email: str) -> Optional[User]:
        for user in self._users.values():
            if user.email == email:
                return user
        return None

    async def save(self, user: User) -> None:
        self._users[user.id] = user

    async def exists(self, email: str) -> bool:
        return any(u.email == email for u in self._users.values())


@pytest.mark.asyncio
async def test_create_user_success():
    """Test successful user creation."""
    repository = InMemoryUserRepository()
    use_case = CreateUserUseCase(repository)

    input_dto = CreateUserInput(
        email="test@example.com",
        password="password123"
    )

    result = await use_case.execute(input_dto)

    assert result.email == "test@example.com"
    assert result.id is not None
    assert isinstance(result.created_at, datetime)


@pytest.mark.asyncio
async def test_create_user_already_exists():
    """Test error when user already exists."""
    repository = InMemoryUserRepository()
    use_case = CreateUserUseCase(repository)

    input_dto = CreateUserInput(
        email="test@example.com",
        password="password123"
    )

    # Create first user
    await use_case.execute(input_dto)

    # Try to create duplicate
    with pytest.raises(UserAlreadyExistsError) as exc_info:
        await use_case.execute(input_dto)

    assert "already exists" in str(exc_info.value)


@pytest.mark.asyncio
async def test_create_user_invalid_email():
    """Test validation error for invalid email."""
    repository = InMemoryUserRepository()
    use_case = CreateUserUseCase(repository)

    with pytest.raises(ValueError) as exc_info:
        input_dto = CreateUserInput(
            email="invalid-email",  # Pydantic will catch this
            password="password123"
        )
```

## Key Takeaways

1. **Domain is pure**: Uses standard library only, no external dependencies
2. **Application uses protocols**: Defines interfaces with `Protocol` or `ABC`
3. **Infrastructure implements**: SQLAlchemy, FastAPI live here
4. **FastAPI Depends for DI**: Natural dependency injection with `Depends()`
5. **Pydantic for DTOs**: Input validation and serialization at boundaries
6. **Test with in-memory repos**: Mock repositories inherit from domain interface
