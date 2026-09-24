---
name: madd-method
description: Use when planning or executing a bounded software change with MADD. Read the contract, create one fraction, bind executable checks, preserve independent review, and record evidence without declaring delivery from an editable status.
license: MIT
---

# MADD method

MADD (Multi-Agent Driven Development) makes intent and delivery evidence
explicit. It is agent- and stack-agnostic. Keep the repository's existing
tools; MADD supplies a contract and review loop, not a replacement framework.

## Start safely

Use the released CLI when possible. Inspect the package and provenance before
installing it:

```sh
npm view @madd-sh/madd@next version dist.integrity dist.provenance
npm audit signatures
npx --yes @madd-sh/madd@next init --contract-only .
```

For a pinned candidate, replace `@next` with the exact version shown by the
release. Do not pipe a remote script to a shell. In CI use `npm ci
--ignore-scripts` and keep credentials out of the repository.

`--contract-only` creates a specification and no agent hooks. Legacy
`madd init` remains available when an adapter is deliberately selected.

## The loop

1. Architect writes intent, non-goals, constraints, requirements and one small
   fraction in `.madd/contract.d/`.
2. Maker implements only that fraction.
3. CI binds each selected check to a real local file and runs it.
4. Breaker reviews the exact revision independently and records failures.
5. Witness records observed results and limits outside the sealed contract.

Validate before asking for delivery evidence:

```sh
madd validate . --require-bound --fraction FRAC-001 --json
```

`structurallyValid` and `checksBound` are not delivery. `delivered` stays
false until `madd verify` checks fresh, revision-bound CI and independent-review
receipts against a protected trust policy outside the checkout:

```sh
madd verify . --fraction FRAC-001 --evidence evidence.json --trust trust.json --json
```

Never let the contract nominate its own trust policy, execute commands from
specification fields, or let an author approve their own change. Keep the
specification digest stable; put retrospectives and CI logs in an external
evidence record linked to the exact revision.

## Handoff format

Every fraction handoff states: objective, included/excluded requirements,
files changed, exact checks and results, reviewer identity, known limits,
rollback, and the next fraction. If a check is skipped or unavailable, report
it as unresolved. Do not convert a local pass into a production claim.

## When to stop

Stop and ask the owner when the change needs a new service, a privileged
credential, a schema-breaking migration, a production mutation, or an
unconfigured trust authority. MADD controls the evidence boundary; it does
not grant permission to deploy.
