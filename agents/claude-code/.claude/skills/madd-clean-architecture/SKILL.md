---
name: madd-clean-architecture
description: Use this skill when designing or verifying software architecture. Covers clean architecture layers, dependency inversion, ports/adapters patterns, and project structuring strategies.
---

# Clean Architecture

## Core Principle

Dependencies point INWARD. Domain knows nothing about infrastructure.

## Layer Model

| Layer | Contains | Depends On | Never Depends On |
|-------|----------|------------|------------------|
| **Domain** | Entities, value objects, domain events, repository interfaces | Nothing | Application, Infrastructure |
| **Application** | Use cases, DTOs, port interfaces | Domain | Infrastructure |
| **Infrastructure** | DB implementations, HTTP handlers, external APIs, config | Application, Domain | — |
| **Presentation** | Controllers, views, CLI | Application | Domain directly |

## Dependency Rule

- Inner layers define INTERFACES (ports)
- Outer layers provide IMPLEMENTATIONS (adapters)
- Use dependency injection to wire them

## Project Structure Strategies

### Feature-Based (Recommended for >5 features)
```
src/
├── features/
│   ├── auth/
│   │   ├── domain/       # entities, interfaces
│   │   ├── application/  # use cases, DTOs
│   │   └── infrastructure/ # repos, handlers
│   └── orders/
│       ├── domain/
│       ├── application/
│       └── infrastructure/
└── shared/               # cross-cutting concerns
```

### Layer-Based (Simple projects <5 features)
```
src/
├── domain/
├── application/
├── infrastructure/
└── presentation/
```

## Key Patterns

### Repository Pattern
```
Domain defines:  interface UserRepository { findById(id): User }
Infra provides:  class PostgresUserRepository implements UserRepository
```

### Use Case Pattern
```
class CreateUser {
  constructor(private repo: UserRepository) {}
  execute(input: CreateUserInput): User {
    // business logic only — no DB, no HTTP
  }
}
```

### DTO Boundaries
- Domain entities NEVER cross layer boundaries directly
- Use DTOs/mappers at each boundary
- API response ≠ Domain entity ≠ DB row

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Domain imports DB client | Inner layer depends on outer | Use repository interface |
| Business logic in handler | Logic leaks to infrastructure | Extract to use case |
| Entity has JSON decorators | Domain coupled to serialization | Use separate DTO |
| Direct DB query in use case | Application depends on infra | Inject repository |
| God service with 20+ methods | Violation of SRP | Split into focused use cases |

## Verification Checklist (for Audit)

- [ ] Domain layer has ZERO imports from infrastructure
- [ ] All external dependencies accessed through interfaces
- [ ] Use cases contain business logic, not plumbing
- [ ] No circular dependencies between features
- [ ] Shared code is truly shared (used by 2+ features)

## Stack-Specific Examples

See references/:
- `example-typescript.md` — TypeScript/Node.js clean architecture
- `example-python.md` — Python/FastAPI clean architecture
