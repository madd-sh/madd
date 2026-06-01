---
name: madd-database-strategy
description: Use this skill when designing data models, choosing databases, planning migrations, or verifying data layer implementations. Covers schema design, migration patterns, indexing, and data validation.
---

# Database Strategy

## Schema Design Principles

1. **Normalize first, denormalize for performance** — Start with 3NF, denormalize only when measured
2. **Every table needs a primary key** — Prefer UUID v7 (time-sortable) or ULID over auto-increment for distributed systems
3. **Timestamps on everything** — `created_at`, `updated_at` on every table
4. **Soft delete when audit matters** — `deleted_at` nullable timestamp instead of DELETE
5. **Foreign keys are mandatory** — Enforce referential integrity at the database level

## Column Naming

| Convention | Example | Rule |
|-----------|---------|------|
| Tables | `users`, `order_items` | snake_case, plural |
| Columns | `first_name`, `created_at` | snake_case |
| Foreign keys | `user_id`, `order_id` | `<singular_table>_id` |
| Booleans | `is_active`, `has_verified` | `is_`/`has_` prefix |
| Timestamps | `created_at`, `expires_at` | `_at` suffix |
| Enums | `status`, `role` | Use string enums, not int codes |

## Index Strategy

| Scenario | Index Type | Example |
|----------|-----------|---------|
| Primary lookup | PRIMARY KEY | `id` |
| Unique constraint | UNIQUE | `email` |
| Foreign key queries | INDEX | `user_id` |
| Frequent filtering | INDEX | `status` |
| Text search | GIN/FULLTEXT | `name`, `description` |
| Composite queries | COMPOSITE | `(tenant_id, created_at)` |
| Sorting | INDEX | `created_at DESC` |

Rules:
- Index every foreign key column
- Index columns used in WHERE and ORDER BY
- Composite index column order matters (most selective first)
- Don't over-index (writes become slower)

## Migration Strategy

### Rules
1. Migrations are **forward-only** — never edit an applied migration
2. Every migration has an **up** and a **down**
3. Migrations must be **idempotent** where possible
4. **Data migrations** separate from schema migrations
5. **Zero-downtime** migrations: additive first, then cleanup

### Zero-Downtime Migration Pattern
```
Step 1: Add new column (nullable)
Step 2: Deploy code that writes to both old + new columns
Step 3: Backfill new column from old data
Step 4: Deploy code that reads from new column only
Step 5: Remove old column
```

### Tools by Stack

| Stack | ORM/Query Builder | Migration Tool |
|-------|------------------|---------------|
| Node.js | Prisma, Drizzle, Knex | Built-in |
| Python | SQLAlchemy, Tortoise | Alembic |
| Go | sqlx, GORM, Ent | goose, golang-migrate |

## SQL vs NoSQL Decision

| Use SQL When | Use NoSQL When |
|-------------|---------------|
| Data has relationships | Data is denormalized documents |
| ACID transactions needed | Eventual consistency acceptable |
| Complex queries (JOIN, GROUP BY) | Simple key-value or document lookup |
| Schema is well-defined | Schema evolves frequently |
| Reporting and analytics | High write throughput needed |

## Data Validation Layers

```
User Input → API Validation (Zod/Pydantic) → Domain Validation → DB Constraints
```

- API layer: format, type, required fields
- Domain layer: business rules (e.g., "email must be unique")
- DB layer: NOT NULL, UNIQUE, CHECK, FK constraints

**Validate at ALL layers** — DB constraints are the last line of defense.

## Multi-Tenancy Patterns

| Pattern | Isolation | Complexity | When to Use |
|---------|-----------|-----------|-------------|
| Shared DB + `tenant_id` column | Low | Low | SaaS MVP, <100 tenants |
| Schema per tenant | Medium | Medium | Compliance needs |
| Database per tenant | High | High | Enterprise, strict isolation |

## Verification Checklist (for Audit)

- [ ] Every table has a primary key
- [ ] All foreign keys have corresponding indexes
- [ ] `created_at`/`updated_at` on all tables
- [ ] Migrations are reversible (have down method)
- [ ] No raw SQL without parameterized queries
- [ ] Sensitive fields encrypted at rest
- [ ] Connection pooling configured

See references/:
- `migration-patterns.md` — Detailed migration examples by ORM
