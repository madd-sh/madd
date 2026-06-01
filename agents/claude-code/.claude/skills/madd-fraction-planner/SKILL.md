---
name: MADD Fraction Planner
description: This skill should be used when decomposing a contract into fractions for incremental development, planning the order of fraction execution, or managing fraction boundaries. Use when the user mentions "fraction", "decompose tasks", "plan fractions", "split work", or when the orchestrator needs to break a contract into independently deliverable units.
version: 0.1.0
---

# MADD Fraction Planner

## What is a Fraction?

A **fraction** is an independently deliverable unit of work — a subset of contract tasks that can go through a complete dev→ci→audit cycle without depending on unfinished tasks from other fractions.

Fractions replace the monolithic "implement everything then audit everything" pattern with incremental delivery: each fraction produces working, tested, audited code.

## When to Plan Fractions

The conductor invokes fraction planning **after architect completes**, before the first dev invocation.

## Fraction Planning Algorithm

### 1. Read Tasks

```bash
jq '.tasks.items[] | {id, title, phase, dependencies, fraction_hint, status}' .madd/contract.d/40-tasks.json
```

### 2. Group Tasks into Fractions

**Rules (in priority order):**

1. **Respect dependencies**: Tasks with circular dependencies MUST be in the same fraction
2. **Respect phases**: Foundation tasks form their own fraction before core/feature tasks
3. **Use hints**: If tasks have `fraction_hint`, group by hint value
4. **Consider domains**: Tasks with overlapping `domains` fields work well together. A fraction should ideally have 1-3 domains (more = too broad for focused Maker/Breaker pairs)
5. **Size constraint**: Target 2-6 tasks per fraction
   - Less than 2 = overhead exceeds value → merge with adjacent fraction
   - More than 6 = context saturation risk → split by sub-domain
   - If a fraction has 4+ domains, consider splitting by primary domain

### 3. Order Fractions

Fractions execute in dependency order:
1. **Foundation fractions** first (database setup, core config, shared utilities)
2. **Core fractions** next (main domain logic)
3. **Feature fractions** then (user-facing features)
4. **Polish fractions** last (optimization, documentation)

Within the same category, fractions with no inter-dependencies can execute in any order.

### 4. Compute Iteration Budget

Per fraction:
```
max_iterations = min(ceil(task_count / 2) + 1, 5)
```

| Tasks in Fraction | Max Iterations |
|-------------------|----------------|
| 1-2 | 2 |
| 3-4 | 3 |
| 5-6 | 4 |
| 7+ | 5 |

Global safety net: `total_budget = 3 × number_of_fractions`

### 5. Output Fraction Plan

Produce a structured fraction plan for the conductor:

```
## Fraction Plan

| Fraction | Phase | Tasks | Domains | Dependencies | Max Iter |
|----------|-------|-------|---------|-------------|----------|
| FRAC-001 | foundation | TASK-001, TASK-002 | database, infrastructure | none | 2 |
| FRAC-002 | core | TASK-003, TASK-004, TASK-005 | api, security | FRAC-001 | 3 |
| FRAC-003 | feature | TASK-006, TASK-007 | api, frontend | FRAC-002 | 2 |

Total fractions: 3
Total iteration budget: 9
Execution order: FRAC-001 → FRAC-002 → FRAC-003
```

The Domains column is derived from the union of `domains` fields across all tasks in the fraction. The Conductor uses this to instantiate domain-scoped Maker/Breaker pairs.

## Edge Cases

### Single Phase (simple project)
If all tasks are in one phase with no dependencies, create a single fraction = current behavior. No decomposition needed.

### Large Foundation Phase
If foundation has 8+ tasks, split into sub-fractions:
- FRAC-001a: Database/schema tasks
- FRAC-001b: Config/setup tasks

### Cross-Cutting Tasks
Tasks that affect multiple fractions (e.g., "setup CI pipeline") go into the earliest applicable fraction.

### 6. Domain-Aware Grouping

When planning fractions, consider domain distribution:

1. Read `domains` field from each task
2. A fraction should ideally have 1-3 domains (more = too broad for focused Maker/Breaker)
3. If a fraction has 4+ domains, split by primary domain
4. Foundation fractions typically cover: `database` + `infrastructure`
5. Core fractions typically cover: `api` + `security`
6. Feature fractions typically cover: `api` + `frontend`

The Conductor will instantiate Maker/Breaker pairs for each domain in the fraction.

## Fraction Context for Dev/Audit Handoff

When the conductor invokes dev/audit for a specific fraction, it should include:

```
Fraction: FRAC-002 (core)
Tasks in scope: TASK-003, TASK-004, TASK-005
Requirements in scope: REQ-F-003, REQ-F-004, REQ-F-005
Depends on: FRAC-001 (completed — see summary below)

Previous fraction summary:
- FRAC-001: Foundation complete. Files: src/db/schema.prisma, src/config/. Decisions: Prisma ORM, Redis cache-aside.

Implement ONLY the tasks listed above. Do not work on tasks from other fractions.
```

This scoped context prevents context saturation by limiting what each dev/audit invocation needs to process.
