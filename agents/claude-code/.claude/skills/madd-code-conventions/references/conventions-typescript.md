# TypeScript / JavaScript Conventions

## TypeScript Configuration

```json
// tsconfig.json — strict mode recommended
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Naming Conventions

```typescript
// Files: kebab-case
// user-service.ts, auth-middleware.ts, create-user.dto.ts

// Types/Interfaces: PascalCase, no prefix
interface UserRepository { ... }    // NOT IUserRepository
type CreateUserInput = { ... }
enum UserRole { Admin, User, Guest }

// Functions: camelCase, verb-first
function getUser(id: string): Promise<User> { ... }
function validateEmail(email: string): boolean { ... }
async function createOrder(input: CreateOrderInput): Promise<Order> { ... }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_PAGE_SIZE = 20;
const JWT_EXPIRY_SECONDS = 900;

// Boolean: is/has/can/should prefix
const isAuthenticated = true;
const hasPermission = checkPermission(user, resource);
const canDelete = user.role === 'admin';
```

## Type Patterns

```typescript
// Use branded types for IDs
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

// Use discriminated unions for state machines
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User }
  | { status: 'error'; error: Error };

// Use Readonly for immutable data
function processConfig(config: Readonly<AppConfig>) { ... }

// Prefer unknown over any
function parseJson(input: string): unknown {
  return JSON.parse(input);
}

// Use satisfies for type-safe object literals
const config = {
  port: 3000,
  host: 'localhost',
} satisfies ServerConfig;
```

## Error Handling

```typescript
// Define error hierarchy per domain
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields: Record<string, string[]>,
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

// Global error handler (Express)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

## Import Order

```typescript
// 1. Node built-ins
import path from 'node:path';
import { readFile } from 'node:fs/promises';

// 2. Third-party packages
import express from 'express';
import { z } from 'zod';

// 3. Internal absolute imports
import { UserService } from '@/services/user-service';
import { db } from '@/infrastructure/database';

// 4. Relative imports
import { validateInput } from './validators';
import type { CreateUserInput } from './types';
```

## Async Patterns

```typescript
// Always handle async errors
// GOOD: try/catch in async function
async function getUser(id: string): Promise<User> {
  try {
    return await userRepository.findById(id);
  } catch (error) {
    throw new NotFoundError('User', id);
  }
}

// GOOD: Promise.allSettled for parallel operations
const results = await Promise.allSettled([fetchUser(id), fetchOrders(id)]);

// Avoid: unhandled promise rejection
// BAD: someAsyncFunction(); // no await, no .catch
```
