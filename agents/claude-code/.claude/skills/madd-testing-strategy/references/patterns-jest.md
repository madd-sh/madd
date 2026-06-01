# Jest / Vitest Testing Patterns

## Setup

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

```typescript
// jest.config.ts (or vitest.config.ts)
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 }
  }
};
```

## Unit Test Pattern

```typescript
import { createUser } from './user-service';
import { UserRepository } from './user-repository';

// Mock dependencies at module level
jest.mock('./user-repository');

describe('createUser', () => {
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepo = new UserRepository() as jest.Mocked<UserRepository>;
    jest.clearAllMocks();
  });

  it('should create a user with hashed password', async () => {
    // Arrange
    mockRepo.save.mockResolvedValue({ id: '1', email: 'test@example.com' });

    // Act
    const user = await createUser(mockRepo, { email: 'test@example.com', password: 'secret' });

    // Assert
    expect(user.id).toBe('1');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    );
  });

  it('should throw ValidationError for invalid email', async () => {
    await expect(
      createUser(mockRepo, { email: 'invalid', password: 'secret' })
    ).rejects.toThrow('ValidationError');
  });
});
```

## Integration Test Pattern (API)

```typescript
import request from 'supertest';
import { app } from '../app';
import { db } from '../database';

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await db.migrate.latest();
    await db.seed.run();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('should return 200 with valid JWT for correct credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'correct-password' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.token).toMatch(/^eyJ/); // JWT prefix
  });

  it('should return 401 for incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 for missing email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ password: 'some-password' });

    expect(response.status).toBe(400);
  });
});
```

## Mocking Patterns

```typescript
// Mock external service
jest.mock('../lib/email-service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'mock-123' })
}));

// Mock environment variable
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };
});
afterEach(() => {
  process.env = originalEnv;
});

// Mock date/time
jest.useFakeTimers();
jest.setSystemTime(new Date('2026-01-01'));
afterEach(() => jest.useRealTimers());
```

## Common Assertions

```typescript
// Value equality
expect(result).toBe(42);
expect(result).toEqual({ name: 'test' }); // deep equality

// Truthiness
expect(result).toBeTruthy();
expect(result).toBeFalsy();
expect(result).toBeNull();
expect(result).toBeDefined();

// Arrays/Collections
expect(list).toHaveLength(3);
expect(list).toContain('item');
expect(list).toContainEqual({ id: 1 });

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('specific message');
await expect(asyncFn()).rejects.toThrow(CustomError);

// Partial matching
expect(obj).toMatchObject({ name: 'test' });
expect(fn).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
```
