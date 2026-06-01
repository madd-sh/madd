---
description: Run full MADD workflow cycle (architect → maker → breaker → witness)
argument-hint: [feature description]
---

# MADD Workflow

Launch the `madd-conductor` agent to run the full MADD development cycle for the following request:

$ARGUMENTS

The conductor will:
1. Create a todo list to track workflow progress
2. Invoke `madd-architect` to formalize intention and requirements into `.madd/contract.d/`
3. Detect domains per fraction and plan execution order
4. Per fraction: invoke domain-scoped `madd-maker` → `madd-ci` → `madd-breaker` (adaptive iterations)
5. Invoke `madd-witness` to document reality in retro-specification

Use the Task tool to launch the `madd-conductor` agent with the full feature request as context.
