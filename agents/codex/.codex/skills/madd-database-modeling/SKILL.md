---
name: madd-database-modeling
description: Use this skill when designing database schemas, creating migrations, or modeling data. Trigger phrases include "design the schema", "create a database", "model the data", "write a migration", "database tables", "normalize the schema", "add RLS policies", "create audit tables".
metadata:
  short-description: Database modeling patterns for Maker agent
---

# Database Modeling (Maker)

Production-grade database schema design patterns for PostgreSQL.

## 1. Primary Keys and Data Types

- **UUID v7** for all primary keys (time-sortable, globally unique):
  ```sql
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  ```
- **timestamptz** (NOT `timestamp`) for all date/time columns — always store timezone
- **text** (NOT `varchar`) unless a hard length constraint is required
- String enums via **CHECK constraints** — never integer codes:
  ```sql
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'))
  ```

## 2. Normalization

- **3NF minimum** for all schemas
- Denormalize ONLY with explicit, measured performance justification documented in a migration comment
- Graph/workflow structures: ALWAYS use normalized tables (nodes + edges), NEVER JSON blobs for graph data
- Tool catalogs: dedicated table for reusable tool manifests, NOT embedded JSON in parent
- Versioned configs: dedicated version table with `version_number integer` + `config jsonb` snapshot, NOT baked into the main entity

## 3. Temporal Columns

Every mutable table MUST have:

```sql
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
deleted_at timestamptz  -- soft delete (NULL = active)
```

Auto-maintain `updated_at` via trigger:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every mutable table:
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON <table_name>
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

## 4. Multi-Tenancy

- Add `workspace_id uuid NOT NULL REFERENCES workspaces(id)` as FK on every business table
- Enforce isolation via RLS (see section 7)
- Index pattern: `CREATE INDEX idx_<table>_workspace_created ON <table>(workspace_id, created_at DESC);`

## 5. Audit Logging

Dedicated audit table for all sensitive operations:

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'access', 'login', 'logout', 'permission_change')),
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

Log these events: secret access, member changes, deployment actions, permission changes, login/logout.

## 6. Versioning Pattern

Separate version history from the main entity:

```sql
CREATE TABLE <entity>_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  <entity>_id uuid NOT NULL REFERENCES <entity>(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  config jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (<entity>_id, version_number)
);

CREATE INDEX idx_<entity>_versions_latest ON <entity>_versions(<entity>_id, version_number DESC);
```

## 7. Row Level Security (RLS)

Enable RLS on ALL tables with tenant data:

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Viewer: SELECT only within workspace
CREATE POLICY viewer_select ON <table_name>
  FOR SELECT
  TO viewer_role
  USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- Developer: ALL operations on own workspace
CREATE POLICY developer_all ON <table_name>
  FOR ALL
  TO developer_role
  USING (workspace_id = current_setting('app.workspace_id')::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id')::uuid);

-- Admin: ALL operations (no workspace restriction)
CREATE POLICY admin_all ON <table_name>
  FOR ALL
  TO admin_role
  USING (true)
  WITH CHECK (true);
```

## 8. Indexing Strategy

- **All foreign keys** must be indexed (PostgreSQL does NOT auto-index FKs)
- **Composite indexes** for frequent query patterns:
  ```sql
  CREATE INDEX idx_<table>_workspace_created ON <table>(workspace_id, created_at DESC);
  ```
- **Partial indexes** for status filters:
  ```sql
  CREATE INDEX idx_<table>_active ON <table>(workspace_id) WHERE deleted_at IS NULL;
  ```
- **Covering indexes** for frequent reads:
  ```sql
  CREATE INDEX idx_<table>_list ON <table>(workspace_id, created_at DESC) INCLUDE (name, status);
  ```
- Index all columns used in WHERE, ORDER BY, and JOIN clauses

## 9. Encrypted Storage

Separate columns for encryption components — NOT a single bytea blob:

```sql
CREATE TABLE secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL,
  auth_tag bytea NOT NULL,
  algorithm text NOT NULL DEFAULT 'aes-256-gcm',
  key_version integer NOT NULL DEFAULT 1,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 10. Graph/Workflow Structures

ALWAYS use normalized node + edge tables:

```sql
CREATE TABLE workflow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN ('start', 'action', 'condition', 'end')),
  config jsonb NOT NULL DEFAULT '{}',
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  condition jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, source_node_id, target_node_id)
);
```

## 11. Trigger Functions

Auto-create related records on insert:

```sql
-- Auto-create membership when workspace is created
CREATE OR REPLACE FUNCTION auto_create_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspace_auto_membership
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_membership();

-- Auto-create profile when user is created
CREATE OR REPLACE FUNCTION auto_create_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, display_name)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_auto_profile
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_profile();
```

## 12. Alert Modeling

Separate configurable alerts from alert event history:

```sql
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  condition jsonb NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  enabled boolean NOT NULL DEFAULT true,
  notify_channels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_events_alert ON alert_events(alert_id, created_at DESC);
CREATE INDEX idx_alert_events_unacked ON alert_events(alert_id) WHERE acknowledged_at IS NULL;
```

## 13. Tool Catalog

Dedicated table for reusable tool manifests:

```sql
CREATE TABLE tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  description text,
  tool_type text NOT NULL CHECK (tool_type IN ('function', 'api', 'webhook', 'script')),
  manifest jsonb NOT NULL,
  input_schema jsonb NOT NULL,
  output_schema jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
```

## 14. Migration Best Practices

- One migration per logical change
- Always provide UP and DOWN methods
- Use transactions for DDL changes
- Add comments explaining WHY (not just what)
- Test rollback before deploying

## Verification Checklist

Use this checklist to verify schema completeness before handoff to the Breaker:

- [ ] All PKs use UUID v7 (`uuid DEFAULT gen_random_uuid()`)
- [ ] All timestamps use `timestamptz` (not `timestamp`)
- [ ] All text columns use `text` (not `varchar`) unless length constraint is justified
- [ ] All enum-like columns have CHECK constraints with string values
- [ ] All tables have `created_at timestamptz NOT NULL DEFAULT now()`
- [ ] All mutable tables have `updated_at` with auto-update trigger
- [ ] Soft delete uses `deleted_at timestamptz` where applicable
- [ ] All business tables have `workspace_id` FK for multi-tenancy
- [ ] RLS enabled on all tenant-scoped tables with per-role policies
- [ ] All foreign keys are indexed
- [ ] Composite indexes exist for (workspace_id, created_at) on all tenant tables
- [ ] Partial indexes exist for active record filters (WHERE deleted_at IS NULL)
- [ ] Audit log table covers all sensitive operations
- [ ] Version history uses separate table (not columns on main entity)
- [ ] Graph/workflow data uses normalized node + edge tables
- [ ] Encrypted fields have separate ciphertext, iv, auth_tag columns
- [ ] Tool manifests stored in dedicated table (not embedded JSON)
- [ ] Alerts separated from alert events
- [ ] Auto-create triggers defined (membership on workspace, profile on user)
- [ ] Migration includes both UP and DOWN methods
- [ ] Schema is in 3NF (any denormalization has documented justification)
