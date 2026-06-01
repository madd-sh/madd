# Migration Patterns by ORM

Concrete examples for migrating databases in common stacks.

---

## Prisma (Node.js / TypeScript)

### Schema Definition

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  posts     Post[]

  @@map("users")
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  status    PostStatus @default(DRAFT)
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status, createdAt])
  @@map("posts")
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### Migration Commands

```bash
# Create migration from schema changes
npx prisma migrate dev --name add_user_table

# Apply migrations in production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Reset database (dev only!)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

### Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Upsert ensures idempotency
  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      isActive: true,
    },
  })

  await prisma.post.upsert({
    where: { id: 'seed-post-1' },
    update: {},
    create: {
      id: 'seed-post-1',
      title: 'Welcome Post',
      content: 'This is a seed post',
      status: 'PUBLISHED',
      userId: user.id,
    },
  })

  console.log('Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

```json
// package.json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Run: `npx prisma db seed`

### Connection Pooling

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Environment config:

```bash
# For serverless (limited connections)
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=10"

# For long-running servers
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20"
```

---

## Alembic (Python / SQLAlchemy)

### Setup

```bash
pip install alembic sqlalchemy psycopg2-binary
alembic init alembic
```

### Configuration

```python
# alembic/env.py
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os

# Import your models here
from app.models import Base

config = context.config

# Override sqlalchemy.url from environment
config.set_main_option('sqlalchemy.url', os.getenv('DATABASE_URL'))

target_metadata = Base.metadata

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### Model Definition

```python
# app/models.py
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import enum
import uuid

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class PostStatus(enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True))

    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    content = Column(String)
    status = Column(Enum(PostStatus), default=PostStatus.DRAFT, nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="posts")
```

### Migration Commands

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Add user and post tables"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View current version
alembic current

# View migration history
alembic history --verbose
```

### Manual Migration Example

```python
# alembic/versions/001_add_users_table.py
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('name', sa.String()),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True)),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_email', 'users', ['email'])

def downgrade():
    op.drop_index('ix_users_email', 'users')
    op.drop_table('users')
```

### Seed Script

```python
# scripts/seed.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, User, Post, PostStatus
import os

DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def seed():
    session = SessionLocal()
    try:
        # Check if seed data exists
        existing_user = session.query(User).filter_by(email='admin@example.com').first()
        if not existing_user:
            user = User(
                email='admin@example.com',
                name='Admin User',
                is_active=True
            )
            session.add(user)
            session.commit()

            post = Post(
                title='Welcome Post',
                content='This is a seed post',
                status=PostStatus.PUBLISHED,
                user_id=user.id
            )
            session.add(post)
            session.commit()
            print("Seed completed")
        else:
            print("Seed data already exists")
    finally:
        session.close()

if __name__ == '__main__':
    seed()
```

### Connection Pooling

```python
# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
import os

DATABASE_URL = os.getenv('DATABASE_URL')

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,          # Number of permanent connections
    max_overflow=20,       # Max temporary connections beyond pool_size
    pool_timeout=30,       # Seconds to wait for connection
    pool_recycle=3600,     # Recycle connections after 1 hour
    pool_pre_ping=True,    # Verify connections before using
    echo=False             # Set to True for SQL logging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## goose (Go)

### Setup

```bash
go install github.com/pressly/goose/v3/cmd/goose@latest
mkdir -p db/migrations
```

### Migration Files

```sql
-- db/migrations/001_create_users.sql
-- +goose Up
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);

-- +goose Down
DROP TABLE users;
```

```sql
-- db/migrations/002_create_posts.sql
-- +goose Up
CREATE TYPE post_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    status post_status NOT NULL DEFAULT 'draft',
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status_created_at ON posts(status, created_at);

-- +goose Down
DROP TABLE posts;
DROP TYPE post_status;
```

### Migration Commands

```bash
# Set database URL
export DATABASE_URL="postgres://user:pass@localhost:5432/dbname?sslmode=disable"

# Apply all pending migrations
goose -dir db/migrations postgres "$DATABASE_URL" up

# Rollback last migration
goose -dir db/migrations postgres "$DATABASE_URL" down

# View status
goose -dir db/migrations postgres "$DATABASE_URL" status

# Create new migration
goose -dir db/migrations create add_user_avatar sql
```

### Embedding Migrations in Go Binary

```go
// db/migrations/embed.go
package migrations

import "embed"

//go:embed *.sql
var EmbedMigrations embed.FS
```

```go
// main.go or db/migrate.go
package main

import (
    "database/sql"
    "embed"
    "log"

    "github.com/pressly/goose/v3"
    _ "github.com/lib/pq"
    "yourapp/db/migrations"
)

//go:embed db/migrations/*.sql
var embedMigrations embed.FS

func runMigrations(db *sql.DB) error {
    goose.SetBaseFS(embedMigrations)

    if err := goose.SetDialect("postgres"); err != nil {
        return err
    }

    if err := goose.Up(db, "db/migrations"); err != nil {
        return err
    }

    log.Println("Migrations applied successfully")
    return nil
}

func main() {
    db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    if err := runMigrations(db); err != nil {
        log.Fatal(err)
    }

    // Start application...
}
```

### Seed Data

```go
// db/seed.go
package db

import (
    "context"
    "database/sql"
    "log"

    "github.com/google/uuid"
)

func Seed(ctx context.Context, db *sql.DB) error {
    // Check if seed data exists
    var count int
    err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE email = $1", "admin@example.com").Scan(&count)
    if err != nil {
        return err
    }

    if count > 0 {
        log.Println("Seed data already exists")
        return nil
    }

    tx, err := db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    userID := uuid.New()
    _, err = tx.ExecContext(ctx, `
        INSERT INTO users (id, email, name, is_active)
        VALUES ($1, $2, $3, $4)
    `, userID, "admin@example.com", "Admin User", true)
    if err != nil {
        return err
    }

    _, err = tx.ExecContext(ctx, `
        INSERT INTO posts (title, content, status, user_id)
        VALUES ($1, $2, $3, $4)
    `, "Welcome Post", "This is a seed post", "published", userID)
    if err != nil {
        return err
    }

    if err := tx.Commit(); err != nil {
        return err
    }

    log.Println("Seed completed")
    return nil
}
```

### Connection Pooling

```go
// db/db.go
package db

import (
    "database/sql"
    "time"

    _ "github.com/lib/pq"
)

func NewDB(databaseURL string) (*sql.DB, error) {
    db, err := sql.Open("postgres", databaseURL)
    if err != nil {
        return nil, err
    }

    // Connection pool settings
    db.SetMaxOpenConns(25)                 // Max open connections
    db.SetMaxIdleConns(5)                  // Max idle connections
    db.SetConnMaxLifetime(5 * time.Minute) // Max connection lifetime
    db.SetConnMaxIdleTime(2 * time.Minute) // Max idle time

    // Verify connection
    if err := db.Ping(); err != nil {
        return nil, err
    }

    return db, nil
}
```

---

## Connection String Examples

### PostgreSQL

```bash
# Standard
postgresql://username:password@localhost:5432/database_name

# With SSL
postgresql://username:password@localhost:5432/database_name?sslmode=require

# With connection pool limits
postgresql://username:password@localhost:5432/database_name?pool_max_conns=20&pool_min_conns=5

# Multiple hosts (failover)
postgresql://username:password@host1:5432,host2:5432/database_name?target_session_attrs=read-write
```

### MySQL

```bash
# Standard
mysql://username:password@tcp(localhost:3306)/database_name

# With parameters
mysql://username:password@tcp(localhost:3306)/database_name?parseTime=true&charset=utf8mb4
```

### SQLite

```bash
# File-based
sqlite:///path/to/database.db

# In-memory (testing)
sqlite://:memory:

# With WAL mode (better concurrency)
sqlite:///path/to/database.db?mode=rwc&_journal_mode=WAL
```

---

## Best Practices Summary

1. **Always use migrations** — Never manually ALTER tables in production
2. **Version control migrations** — Migrations are code, commit them
3. **Test migrations on staging** — Run migrations on production-like data first
4. **Idempotent seeds** — Use UPSERT or check-before-insert patterns
5. **Connection pooling** — Configure based on your deployment model (serverless vs. long-running)
6. **Monitor pool exhaustion** — Log slow queries and connection wait times
7. **Separate read replicas** — Use connection strings with read/write routing for scale

For zero-downtime migrations, see the main SKILL.md guide.
