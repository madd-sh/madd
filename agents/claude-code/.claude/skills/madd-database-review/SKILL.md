---
name: madd-database-review
description: Use this skill when auditing or reviewing database schemas, migrations, or data models. Trigger phrases include "review the schema", "audit the database", "check the migration", "verify the data model", "database review", "schema audit".
---

# Database Review (Breaker)

Systematic audit checklist for database schema quality, security, and correctness.

## Audit Process

For each check below, mark as PASS, FAIL, or N/A. Any FAIL must include the specific table/column and a recommended fix.

## 1. Normalization Violations

- [ ] **JSON blobs hiding relational data**: Graph/workflow data stored as JSON instead of normalized node + edge tables. Look for `jsonb` columns containing arrays of objects with IDs and relationships. --> Normalized tables enable indexing, constraints, and referential integrity.

- [ ] **Embedded tool catalogs**: Tool manifests embedded as JSON arrays inside parent entities instead of a dedicated `tools` table with proper FKs. --> Dedicated tables allow reuse, individual updates, and proper constraints.

- [ ] **Inline versioned configs**: Version history stored as columns on the main entity (`config_v1 jsonb`, `config_v2 jsonb` or `config jsonb` + `version int`) instead of a separate `_versions` table. --> Separate version tables scale indefinitely and enable diffing.

- [ ] **Schema not 3NF**: Unnecessary denormalization without a measured performance justification documented in comments or migration notes. --> Premature denormalization causes update anomalies.

## 2. Missing RLS Policies

- [ ] **Tables with tenant data missing RLS**: Every table containing `workspace_id` or equivalent tenant FK MUST have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at minimum SELECT + management policies. --> Missing RLS = cross-tenant data leakage.

- [ ] **Overly permissive RLS**: Policies granting ALL to viewer role, or policies with `USING (true)` on non-admin roles. --> Viewer should only have SELECT; developer should be scoped to own workspace.

## 3. Missing Indexes

- [ ] **Unindexed foreign keys**: PostgreSQL does NOT auto-index FKs. Every FK column must have an explicit index. --> Missing FK indexes cause slow JOINs and DELETE cascades.

- [ ] **Missing composite indexes**: Tables with `workspace_id` must have `(workspace_id, created_at DESC)` composite index for list queries. --> Without composite indexes, tenant-scoped list queries do full table scans.

- [ ] **Missing WHERE/ORDER BY indexes**: Columns used in WHERE clauses or ORDER BY without indexes. Run `EXPLAIN ANALYZE` on hot queries. --> Sequential scans on large tables kill performance.

- [ ] **Missing partial indexes**: Active record queries (`WHERE deleted_at IS NULL`) without partial indexes. --> Partial indexes are smaller and faster for common filter patterns.

## 4. Missing Constraints

- [ ] **CHECK constraints for enum columns**: Text columns with a limited set of valid values (status, role, type) must have CHECK constraints with string values, not integer codes. --> Unconstrained columns accept garbage data silently.

- [ ] **UNIQUE constraints for natural keys**: Combinations that must be unique (workspace_id + name, user_id + email) missing UNIQUE constraint. --> Duplicates cause logic bugs and data corruption.

- [ ] **NOT NULL for required fields**: Columns that should never be NULL missing NOT NULL constraint. --> NULL values cause unexpected behavior in queries and application logic.

- [ ] **Missing FK constraints**: Columns referencing other tables without FOREIGN KEY constraint. --> Orphaned records and referential integrity violations.

## 5. Missing Audit Trail

- [ ] **No audit table**: Application handles sensitive operations (secret access, member changes, deployments, permission changes) without a dedicated `audit_logs` table. --> No audit trail = compliance failure and no forensic capability.

- [ ] **Incomplete audit columns**: Audit table missing `ip_address inet`, `user_agent text`, or `metadata jsonb`. --> Incomplete audit records limit forensic analysis.

- [ ] **Missing audit events**: Sensitive operations not logging to audit table. Check: secret access, member role changes, deployment actions, login/logout, permission changes. --> Gaps in audit trail create blind spots.

## 6. Cascade Delete Risks

- [ ] **CASCADE on high-value data**: `ON DELETE CASCADE` on tables containing business-critical data without soft delete (`deleted_at`). --> Accidental parent deletion causes irrecoverable data loss.

- [ ] **Missing ON DELETE policy**: FK columns with no ON DELETE clause (defaults to RESTRICT). Verify this is intentional. --> Implicit RESTRICT may block legitimate deletions or need explicit handling.

## 7. Missing Triggers

- [ ] **No updated_at auto-maintenance**: Mutable tables without a `BEFORE UPDATE` trigger calling `update_updated_at()`. --> `updated_at` becomes stale and unreliable.

- [ ] **Missing auto-membership trigger**: Workspace creation without auto-inserting an owner membership record. --> Creator locked out of their own workspace.

- [ ] **Missing auto-profile trigger**: User creation without auto-creating a profile record. --> Application crashes on profile lookups for new users.

## 8. Data Type Issues

- [ ] **timestamp instead of timestamptz**: Any column using `timestamp` without time zone. --> Ambiguous time values cause bugs across time zones.

- [ ] **varchar(255) instead of text**: Columns using `varchar(n)` without a genuine length constraint requirement. --> Arbitrary length limits cause silent truncation or application errors.

- [ ] **Integer PK instead of UUID**: Tables using `serial` or `bigserial` primary keys instead of UUID v7. --> Sequential integers leak row count, are non-portable, and cause merge conflicts.

- [ ] **int codes for enums**: Status/type/role columns using integer values (0, 1, 2) instead of text with CHECK. --> Integer codes are unreadable and error-prone without a lookup table.

## 9. Missing Temporal Columns

- [ ] **Tables without created_at**: Any table missing `created_at timestamptz NOT NULL DEFAULT now()`. --> No record of when data was created.

- [ ] **Mutable tables without updated_at**: Any table that receives UPDATEs missing `updated_at timestamptz NOT NULL DEFAULT now()`. --> Cannot determine data freshness or debug timing issues.

- [ ] **Missing soft delete where needed**: High-value data tables without `deleted_at timestamptz` column. --> Hard deletes are irrecoverable.

## 10. Migration Quality

- [ ] **Missing DOWN/rollback method**: Migrations without a reverse operation. --> Failed deployments cannot be rolled back.

- [ ] **Non-transactional DDL**: Schema changes not wrapped in transactions (where supported). --> Partial failures leave schema in inconsistent state.

- [ ] **Missing migration comments**: Complex schema changes without comments explaining the WHY. --> Future developers cannot understand design decisions.

## Severity Guide

| Severity | Criteria | Examples |
|----------|----------|---------|
| CRITICAL | Data loss or security breach risk | Missing RLS, CASCADE on critical data, no audit trail |
| HIGH | Data integrity or performance risk | Missing constraints, missing indexes on FKs, wrong data types |
| MEDIUM | Maintainability or correctness risk | Missing triggers, normalization violations, missing temporal columns |
| LOW | Best practice deviation | Missing comments, varchar vs text, missing partial indexes |
