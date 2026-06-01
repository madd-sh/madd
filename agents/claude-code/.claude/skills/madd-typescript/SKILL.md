---
name: madd-typescript
description: Use this skill when working with TypeScript projects. Covers strict mode configuration, utility types, project structure, async patterns, and common anti-patterns to avoid.
---

# TypeScript Best Practices for MADD

This skill provides comprehensive TypeScript guidance for both development and audit agents working on MADD projects.

## 1. tsconfig.json — Strict Mode

A properly configured TypeScript project starts with strict compiler options. Here's a recommended `tsconfig.json`:

```json
{
  "compilerOptions": {
    // Language and Environment
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Strict Type-Checking Options
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,

    // Module Resolution
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    // Path Aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/domain/*": ["src/domain/*"]
    },

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": false,

    // Interop Constraints
    "allowImportingTsExtensions": false,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### For Monorepos (Project References)

```json
{
  "compilerOptions": {
    "composite": true,
    "incremental": true
  },
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/api" }
  ]
}
```

## 2. Type Patterns

### Branded Types for Domain IDs

Prevent mixing different ID types by creating branded types:

```typescript
type UserId = string & { __brand: 'UserId' };
type ProductId = string & { __brand: 'ProductId' };
type OrderId = string & { __brand: 'OrderId' };

// Factory functions
function createUserId(id: string): UserId {
  return id as UserId;
}

// Type safety prevents mixing
function getUser(id: UserId) { /* ... */ }
function getProduct(id: ProductId) { /* ... */ }

const userId = createUserId('user-123');
const productId = 'prod-456' as ProductId;

getUser(userId); // OK
getUser(productId); // Error: ProductId not assignable to UserId
```

### Discriminated Unions for State Machines

Model complex state with discriminated unions:

```typescript
type RequestState =
  | { status: 'idle' }
  | { status: 'loading'; abortController: AbortController }
  | { status: 'success'; data: UserData; timestamp: number }
  | { status: 'error'; error: Error; retryCount: number };

function handleState(state: RequestState) {
  switch (state.status) {
    case 'idle':
      return 'Ready to fetch';
    case 'loading':
      return `Loading... (can abort: ${state.abortController})`;
    case 'success':
      return `Data: ${state.data}`;
    case 'error':
      return `Error: ${state.error.message}`;
  }
}
```

### `satisfies` Operator

Type-check object literals without widening types:

```typescript
type Route = { path: string; method: 'GET' | 'POST' };

const routes = {
  getUser: { path: '/users/:id', method: 'GET' },
  createUser: { path: '/users', method: 'POST' }
} satisfies Record<string, Route>;

// Type is preserved as literal
routes.getUser.method; // Type: 'GET' (not 'GET' | 'POST')
```

### Template Literal Types for API Routes

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiVersion = 'v1' | 'v2';
type Resource = 'users' | 'products' | 'orders';

type ApiRoute = `/${ApiVersion}/${Resource}`;
// Type: '/v1/users' | '/v1/products' | '/v1/orders' | '/v2/users' | ...

type EndpointConfig = `${HttpMethod} ${ApiRoute}`;
// Type: 'GET /v1/users' | 'POST /v1/users' | ...
```

### Const Assertions for Enums

Prefer const objects over numeric enums:

```typescript
// Bad: Numeric enum (poor tree-shaking)
enum Status {
  Pending,
  Active,
  Completed
}

// Good: Const object
const Status = {
  Pending: 'PENDING',
  Active: 'ACTIVE',
  Completed: 'COMPLETED'
} as const;

type Status = typeof Status[keyof typeof Status];
// Type: 'PENDING' | 'ACTIVE' | 'COMPLETED'
```

### `Record<K, V>` vs `Map<K, V>` Decision

| Use Case | Choose |
|----------|--------|
| Fixed set of known keys | `Record<K, V>` or object literal |
| Dynamic keys added at runtime | `Map<K, V>` |
| Keys are not strings/numbers/symbols | `Map<K, V>` (objects as keys) |
| Need guaranteed iteration order | `Map<K, V>` |
| Serializing to JSON | `Record<K, V>` or object literal |
| Frequent add/delete operations | `Map<K, V>` (better performance) |

### Utility Types Reference

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

// Pick: Select specific properties
type UserPublic = Pick<User, 'id' | 'name' | 'email'>;

// Omit: Exclude specific properties
type UserCreate = Omit<User, 'id' | 'createdAt'>;

// Partial: Make all properties optional
type UserUpdate = Partial<User>;

// Required: Make all properties required
type UserRequired = Required<Partial<User>>;

// ReturnType: Extract function return type
function getUser() { return { id: '1', name: 'Alice' }; }
type UserData = ReturnType<typeof getUser>;

// Awaited: Unwrap Promise type
type AsyncUserData = Awaited<Promise<User>>;

// Parameters: Extract function parameter types
function createUser(name: string, email: string) { /* ... */ }
type CreateUserParams = Parameters<typeof createUser>; // [string, string]
```

## 3. Async Patterns

### Promise.all for Parallel Operations

Use when all operations must succeed:

```typescript
async function loadUserDashboard(userId: UserId) {
  const [user, posts, notifications] = await Promise.all([
    fetchUser(userId),
    fetchUserPosts(userId),
    fetchNotifications(userId)
  ]);

  return { user, posts, notifications };
}
```

### Promise.allSettled for Fault-Tolerant Parallel

Use when some operations can fail:

```typescript
async function loadOptionalData(userId: UserId) {
  const results = await Promise.allSettled([
    fetchUser(userId),        // Critical
    fetchRecommendations(),   // Optional
    fetchAnalytics(userId)    // Optional
  ]);

  const user = results[0].status === 'fulfilled'
    ? results[0].value
    : null;

  const recommendations = results[1].status === 'fulfilled'
    ? results[1].value
    : [];

  return { user, recommendations };
}
```

### AbortController for Cancellation

```typescript
class DataService {
  private abortController: AbortController | null = null;

  async fetchData(query: string): Promise<Data> {
    // Cancel previous request
    this.abortController?.abort();
    this.abortController = new AbortController();

    try {
      const response = await fetch(`/api/search?q=${query}`, {
        signal: this.abortController.signal
      });
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request cancelled');
      }
      throw error;
    }
  }
}
```

### Async Iterators for Streaming

```typescript
async function* fetchPaginatedData(userId: UserId) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/api/users/${userId}/posts?page=${page}`);
    const data = await response.json();

    yield data.items;

    hasMore = data.hasNext;
    page++;
  }
}

// Usage
for await (const posts of fetchPaginatedData(userId)) {
  console.log('Batch:', posts);
}
```

### Error Boundaries in Async Code

```typescript
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const value = await fn();
    return { success: true, value };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

// Usage
const result = await safeAsync(() => fetchUser(userId));

if (result.success) {
  console.log(result.value); // Type: User
} else {
  console.error(result.error); // Type: Error
}
```

## 4. Module System

### ESM vs CJS: Prefer ESM

```typescript
// Good: ESM (Modern)
export class UserService { /* ... */ }
export const config = { /* ... */ };
export default createApp();

// Avoid: CJS (Legacy)
module.exports = { UserService, config };
```

### Import Type for Type-Only Imports

Reduce runtime bundle size with type-only imports:

```typescript
// Type-only import (removed at runtime)
import type { User, Product } from './types';

// Mixed import
import { type User, createUser } from './user-service';

// Runtime import
import { validateEmail } from './validators';
```

### Barrel Exports: When They Help vs Hurt

**Good use case** (small API surface):
```typescript
// src/domain/user/index.ts
export { User } from './user';
export { UserService } from './user-service';
export { UserRepository } from './user-repository';
```

**Bad use case** (hurts tree-shaking):
```typescript
// src/utils/index.ts - DON'T DO THIS
export * from './string-utils';     // 50+ functions
export * from './array-utils';      // 40+ functions
export * from './object-utils';     // 30+ functions
// Result: Entire utils bundle imported even if you use one function
```

**Better approach**:
```typescript
// Import directly from specific modules
import { debounce } from '@/utils/function-utils';
import { capitalize } from '@/utils/string-utils';
```

### Side-Effect Imports

For polyfills or global modifications:

```typescript
// Executed immediately when imported
import './polyfills/array-at';
import './global-error-handler';
import './instrument-monitoring';

// Regular imports
import { createApp } from './app';
```

## 5. Common Anti-Patterns

| Anti-Pattern | Why Bad | Better |
|-------------|---------|--------|
| `any` | Defeats type system | `unknown` + type guard |
| `as` type assertion | Hides type errors | Type narrowing with `if`/`in` |
| `!` non-null assertion | Runtime crash risk | Optional chaining + nullish coalescing |
| `enum` (numeric) | Poor tree-shaking | `const` object with `as const` |
| Interface with `I` prefix | Hungarian notation | Just `User` not `IUser` |
| Nested ternaries | Unreadable | `if`/`else` or `switch` |

### Examples and Fixes

#### Anti-Pattern: `any`

```typescript
// Bad
function processData(data: any) {
  return data.value.toUpperCase(); // No type safety
}

// Good
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    const value = data.value;
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
  }
  throw new Error('Invalid data shape');
}

// Better with Zod
import { z } from 'zod';

const DataSchema = z.object({ value: z.string() });
type Data = z.infer<typeof DataSchema>;

function processData(data: unknown): string {
  const parsed = DataSchema.parse(data);
  return parsed.value.toUpperCase();
}
```

#### Anti-Pattern: Type Assertions

```typescript
// Bad
const user = JSON.parse(response) as User; // Unsafe!

// Good
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
});

const user = UserSchema.parse(JSON.parse(response));
```

#### Anti-Pattern: Non-Null Assertions

```typescript
// Bad
function getUsername(user: User | null) {
  return user!.name; // Runtime crash if user is null
}

// Good
function getUsername(user: User | null): string {
  return user?.name ?? 'Anonymous';
}

// Or with explicit check
function getUsername(user: User | null): string {
  if (!user) {
    return 'Anonymous';
  }
  return user.name;
}
```

#### Anti-Pattern: Nested Ternaries

```typescript
// Bad
const status = user
  ? user.isActive
    ? user.isPremium
      ? 'premium-active'
      : 'active'
    : 'inactive'
  : 'guest';

// Good
function getUserStatus(user: User | null): string {
  if (!user) return 'guest';
  if (!user.isActive) return 'inactive';
  if (user.isPremium) return 'premium-active';
  return 'active';
}
```

## 6. Package Ecosystem (Recommended)

| Category | Package | Why |
|----------|---------|-----|
| Runtime | Node.js 22.x or Bun | Latest LTS with native TypeScript support |
| Framework | Express 5 / Fastify / Hono | Express for familiarity, Fastify for speed, Hono for edge |
| Validation | Zod | Runtime validation + static type inference |
| ORM | Prisma / Drizzle | Prisma for batteries-included, Drizzle for performance |
| Testing | Vitest | Fast, ESM-native, compatible with Jest API |
| Linting | Biome or ESLint flat config | Biome for speed, ESLint for ecosystem |
| Build | tsup / esbuild | Fast bundling with minimal configuration |
| Type Checking | tsc --noEmit | Use native TypeScript compiler for types |
| HTTP Client | ky or fetch | Modern, Promise-based, edge-compatible |
| Date/Time | Temporal API polyfill | Modern replacement for Date (coming to JS) |

### Example Package Configuration

```json
{
  "dependencies": {
    "zod": "^3.22.4",
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@biomejs/biome": "^1.6.0",
    "vitest": "^1.4.0",
    "tsup": "^8.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup src/index.ts --format esm --dts",
    "type-check": "tsc --noEmit",
    "lint": "biome check .",
    "test": "vitest"
  }
}
```

## 7. Verification Checklist (for Audit)

Use this checklist when auditing TypeScript code:

### Configuration
- [ ] `strict: true` in tsconfig.json
- [ ] `noUncheckedIndexedAccess: true` enabled
- [ ] `exactOptionalPropertyTypes: true` enabled
- [ ] Path aliases configured correctly
- [ ] Source maps enabled for debugging

### Code Quality
- [ ] No `any` in production code (check with `noExplicitAny`)
- [ ] Type-only imports used where appropriate (`import type`)
- [ ] No `@ts-ignore` without explanation comment
- [ ] No `@ts-expect-error` in production (only in tests)
- [ ] Minimal use of type assertions (`as`)
- [ ] No non-null assertions (`!`) without safety comment

### Domain Modeling
- [ ] Branded types for domain IDs
- [ ] Discriminated unions for complex state
- [ ] Const objects instead of numeric enums
- [ ] Proper use of utility types (`Pick`, `Omit`, etc.)

### Async Patterns
- [ ] Async errors properly handled (no floating promises)
- [ ] `Promise.all` used for parallel operations
- [ ] `Promise.allSettled` for fault-tolerant scenarios
- [ ] AbortController used for cancellable requests
- [ ] Proper error boundaries in async code

### Module System
- [ ] ESM modules used (not CJS)
- [ ] No barrel exports for large utility libraries
- [ ] Side-effect imports clearly marked
- [ ] Circular dependencies avoided

### Validation
- [ ] Runtime validation for external data (Zod, etc.)
- [ ] No unsafe `JSON.parse` without validation
- [ ] Type guards for narrowing `unknown` types
- [ ] Schema validation for API responses

### Performance
- [ ] Tree-shaking not blocked by barrel exports
- [ ] Large dependencies dynamically imported if not critical
- [ ] Type-only imports don't bloat runtime bundle

### Testing
- [ ] Type tests for complex types (e.g., with `expectTypeOf` from Vitest)
- [ ] Unit tests cover edge cases
- [ ] Integration tests validate runtime behavior

## Quick Reference Commands

### Type Checking
```bash
# Check types without emitting
tsc --noEmit

# Watch mode
tsc --noEmit --watch
```

### Find Type Issues
```bash
# Find all 'any' types
grep -r ": any" src/

# Find type assertions
grep -r " as " src/

# Find non-null assertions
grep -r "!" src/ | grep -v "!="
```

### Generate Types from Schema
```bash
# Prisma
npx prisma generate

# OpenAPI
npx openapi-typescript ./schema.yaml -o ./src/types/api.ts
```

## Additional Resources

- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- Total TypeScript: https://www.totaltypescript.com/
- Type Challenges: https://github.com/type-challenges/type-challenges
- Matt Pocock's Tips: https://twitter.com/mattpocockuk

---

This skill should be used as a reference for all TypeScript development and code reviews in MADD projects. When in doubt, prioritize type safety and readability over brevity.
