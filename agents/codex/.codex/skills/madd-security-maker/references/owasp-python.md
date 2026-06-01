# OWASP Security Patterns — Python

## A01: Broken Access Control

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = verify_jwt(token)
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*roles: str):
    async def role_checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# Route: protected endpoint
@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require_role("admin"))):
    ...
```

## A02: Cryptographic Failures

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash password
hashed = pwd_context.hash(plain_password)

# Verify password
is_valid = pwd_context.verify(plain_password, hashed)

# JWT
import jwt
from datetime import datetime, timedelta, timezone

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")
```

## A03: Injection Prevention

```python
# SQLAlchemy (safe ORM)
user = session.query(User).filter(User.id == user_id).first()

# Raw SQL: ALWAYS use parameterized queries
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# NEVER do this:
# cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# Command injection: use subprocess with list args
import subprocess
result = subprocess.run(["ls", "-la", sanitized_path], capture_output=True, text=True)
# NEVER: subprocess.run(f"ls -la {user_input}", shell=True)

# Avoid eval/exec entirely
# NEVER: eval(user_input)
# NEVER: exec(user_input)
```

## A04: Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/auth/login")
@limiter.limit("5/15minutes")
async def login(request: Request, credentials: LoginRequest):
    ...
```

## A05: Security Headers

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

## A06: Dependency Audit

```bash
# pip-audit
pip install pip-audit
pip-audit

# Safety (alternative)
pip install safety
safety check

# Check for outdated packages
pip list --outdated
```

## A09: Logging

```python
import structlog

logger = structlog.get_logger()

# Log auth events
logger.info("login_success", user_id=user_id, ip=request.client.host)
logger.warning("login_failure", email=email, ip=request.client.host)

# NEVER log sensitive data
# BAD: logger.info("auth_data", password=password, token=token)
# GOOD: logger.info("token_issued", user_id=user_id)
```

## Input Validation with Pydantic

```python
from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    role: str = Field(pattern="^(user|admin|moderator)$")

# FastAPI validates automatically when used as parameter type
@router.post("/auth/login")
async def login(credentials: LoginRequest):
    # credentials is already validated
    ...
```

## Environment Variables

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    jwt_secret: str
    database_url: str
    allowed_origins: str = ""
    debug: bool = False

    class Config:
        env_file = ".env"

# Fail fast at startup if required vars missing
settings = Settings()
```
