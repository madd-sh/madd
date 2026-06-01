# TypeScript Clean Architecture Example

Complete example showing clean architecture with TypeScript, Express, and Prisma.

## Project Structure

```
src/
├── domain/
│   ├── entities/
│   │   └── User.ts
│   ├── repositories/
│   │   └── UserRepository.ts
│   └── errors/
│       └── DomainError.ts
├── application/
│   ├── use-cases/
│   │   └── CreateUser.ts
│   └── dtos/
│       ├── CreateUserInput.ts
│       └── UserOutput.ts
├── infrastructure/
│   ├── repositories/
│   │   └── PrismaUserRepository.ts
│   ├── http/
│   │   └── UserController.ts
│   └── container.ts
└── main.ts
```

## Domain Layer

### Domain Entity

```typescript
// src/domain/entities/User.ts

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    private _password: string,
    public readonly createdAt: Date
  ) {
    this.validateEmail(email);
    this.validatePassword(_password);
  }

  private validateEmail(email: string): void {
    if (!email.includes('@')) {
      throw new Error('Invalid email format');
    }
  }

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
  }

  // Domain behavior
  changePassword(oldPassword: string, newPassword: string): void {
    if (this._password !== oldPassword) {
      throw new Error('Current password is incorrect');
    }
    this.validatePassword(newPassword);
    this._password = newPassword;
  }

  // Getter only - password is private
  verifyPassword(password: string): boolean {
    return this._password === password;
  }
}
```

### Repository Interface (Port)

```typescript
// src/domain/repositories/UserRepository.ts

import { User } from '../entities/User';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  exists(email: string): Promise<boolean>;
}
```

### Domain Errors

```typescript
// src/domain/errors/DomainError.ts

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class UserAlreadyExistsError extends DomainError {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.name = 'UserAlreadyExistsError';
  }
}
```

## Application Layer

### DTOs

```typescript
// src/application/dtos/CreateUserInput.ts

export interface CreateUserInput {
  email: string;
  password: string;
}
```

```typescript
// src/application/dtos/UserOutput.ts

export interface UserOutput {
  id: string;
  email: string;
  createdAt: string;
}

// Mapper to convert domain entity to DTO
export class UserMapper {
  static toOutput(user: User): UserOutput {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
```

### Use Case

```typescript
// src/application/use-cases/CreateUser.ts

import { randomUUID } from 'crypto';
import { User } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { UserAlreadyExistsError } from '../../domain/errors/DomainError';
import { CreateUserInput } from '../dtos/CreateUserInput';
import { UserOutput, UserMapper } from '../dtos/UserOutput';

export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: CreateUserInput): Promise<UserOutput> {
    // Business rule: email must be unique
    const exists = await this.userRepository.exists(input.email);
    if (exists) {
      throw new UserAlreadyExistsError(input.email);
    }

    // Create domain entity
    const user = new User(
      randomUUID(),
      input.email,
      input.password, // In real app: hash this first
      new Date()
    );

    // Persist
    await this.userRepository.save(user);

    // Return DTO, not entity
    return UserMapper.toOutput(user);
  }
}
```

## Infrastructure Layer

### Repository Implementation (Adapter)

```typescript
// src/infrastructure/repositories/PrismaUserRepository.ts

import { PrismaClient } from '@prisma/client';
import { User } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) return null;

    return new User(row.id, row.email, row.password, row.createdAt);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    if (!row) return null;

    return new User(row.id, row.email, row.password, row.createdAt);
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        password: user['_password'], // Access private field for persistence
        createdAt: user.createdAt,
      },
      update: {
        email: user.email,
        password: user['_password'],
      },
    });
  }

  async exists(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }
}
```

### HTTP Handler

```typescript
// src/infrastructure/http/UserController.ts

import { Request, Response } from 'express';
import { CreateUserUseCase } from '../../application/use-cases/CreateUser';
import { UserAlreadyExistsError } from '../../domain/errors/DomainError';

export class UserController {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Input validation
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Execute use case
      const user = await this.createUserUseCase.execute({ email, password });

      res.status(201).json(user);
    } catch (error) {
      if (error instanceof UserAlreadyExistsError) {
        res.status(409).json({ error: error.message });
        return;
      }

      // Domain validation errors
      if (error instanceof Error && error.message.includes('Invalid')) {
        res.status(400).json({ error: error.message });
        return;
      }

      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

### Dependency Injection Container

```typescript
// src/infrastructure/container.ts

import { PrismaClient } from '@prisma/client';
import { PrismaUserRepository } from './repositories/PrismaUserRepository';
import { CreateUserUseCase } from '../application/use-cases/CreateUser';
import { UserController } from './http/UserController';

// Simple manual DI container
export class Container {
  private static prisma = new PrismaClient();

  // Repositories
  static userRepository = new PrismaUserRepository(this.prisma);

  // Use Cases
  static createUserUseCase = new CreateUserUseCase(this.userRepository);

  // Controllers
  static userController = new UserController(this.createUserUseCase);
}
```

## Application Entry Point

```typescript
// src/main.ts

import express from 'express';
import { Container } from './infrastructure/container';

const app = express();
app.use(express.json());

// Wire controller
app.post('/users', (req, res) =>
  Container.userController.create(req, res)
);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Import Rules

### Domain Layer (src/domain/)
```typescript
// ✅ ALLOWED
import { User } from '../entities/User';
import { UserRepository } from '../repositories/UserRepository';

// ❌ FORBIDDEN
import { PrismaClient } from '@prisma/client';  // Infrastructure dependency
import { CreateUserUseCase } from '../../application/...';  // Outer layer
import express from 'express';  // Framework dependency
```

### Application Layer (src/application/)
```typescript
// ✅ ALLOWED
import { User } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';

// ❌ FORBIDDEN
import { PrismaUserRepository } from '../../infrastructure/...';  // Implementation
import { PrismaClient } from '@prisma/client';  // Infrastructure
import express from 'express';  // Framework
```

### Infrastructure Layer (src/infrastructure/)
```typescript
// ✅ ALLOWED
import { PrismaClient } from '@prisma/client';
import { User } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { CreateUserUseCase } from '../../application/use-cases/CreateUser';
import express from 'express';

// ⚠️ Be careful with cross-feature dependencies in infrastructure
```

## Alternative: Using TSyringe for DI

```typescript
// src/infrastructure/container.ts (with tsyringe)

import 'reflect-metadata';
import { container } from 'tsyringe';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../domain/repositories/UserRepository';
import { PrismaUserRepository } from './repositories/PrismaUserRepository';

// Register dependencies
container.registerSingleton<PrismaClient>(PrismaClient);
container.register<UserRepository>('UserRepository', {
  useClass: PrismaUserRepository,
});

export { container };
```

```typescript
// src/application/use-cases/CreateUser.ts (with tsyringe)

import { injectable, inject } from 'tsyringe';
import { UserRepository } from '../../domain/repositories/UserRepository';

@injectable()
export class CreateUserUseCase {
  constructor(
    @inject('UserRepository') private readonly userRepository: UserRepository
  ) {}

  // ... rest of implementation
}
```

## Testing Example

```typescript
// tests/application/CreateUser.test.ts

import { CreateUserUseCase } from '../../src/application/use-cases/CreateUser';
import { UserRepository } from '../../src/domain/repositories/UserRepository';
import { User } from '../../src/domain/entities/User';

// Mock repository
class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email === email) || null;
  }

  async save(user: User): Promise<void> {
    this.users.push(user);
  }

  async exists(email: string): Promise<boolean> {
    return this.users.some(u => u.email === email);
  }
}

describe('CreateUserUseCase', () => {
  it('should create a user successfully', async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new CreateUserUseCase(repo);

    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.email).toBe('test@example.com');
    expect(result.id).toBeDefined();
  });

  it('should throw error if user already exists', async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new CreateUserUseCase(repo);

    await useCase.execute({ email: 'test@example.com', password: 'pass123' });

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'pass456' })
    ).rejects.toThrow('already exists');
  });
});
```

## Key Takeaways

1. **Domain is pure**: No external dependencies, only business logic
2. **Application orchestrates**: Uses domain interfaces, returns DTOs
3. **Infrastructure implements**: Provides concrete implementations
4. **DI wires everything**: Container resolves dependencies at startup
5. **Test with mocks**: Mock repositories to test use cases in isolation
