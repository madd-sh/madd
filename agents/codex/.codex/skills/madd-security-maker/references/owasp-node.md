# OWASP Security Patterns — Node.js / TypeScript

## A01: Broken Access Control

```typescript
// Middleware: verify JWT and extract user
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    req.user = verifyJwt(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: check role
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Route: protected endpoint
router.delete('/users/:id', authMiddleware, requireRole('admin'), deleteUser);
```

## A02: Cryptographic Failures

```typescript
import bcrypt from 'bcrypt';

// Password hashing
const SALT_ROUNDS = 12;
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
const isValid = await bcrypt.compare(plainPassword, hashedPassword);

// JWT signing — use asymmetric keys for microservices
import jwt from 'jsonwebtoken';
const token = jwt.sign({ sub: userId, role: userRole }, process.env.JWT_SECRET!, {
  expiresIn: '15m',
  algorithm: 'HS256',
});
```

## A03: Injection Prevention

```typescript
// SQL: ALWAYS use parameterized queries
// Prisma (safe by default)
const user = await prisma.user.findUnique({ where: { id: userId } });

// Knex (parameterized)
const user = await knex('users').where('id', userId).first();

// Raw SQL (parameterized)
const [user] = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// NEVER do this:
// const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);

// Shell: avoid child_process with user input
// If unavoidable, use execFile (not exec) with explicit args
import { execFile } from 'child_process';
execFile('ls', ['-la', sanitizedPath], callback);
// NEVER: exec(`ls -la ${userInput}`);
```

## A04: Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many login attempts, try again later' },
  standardHeaders: true,
});

router.post('/auth/login', authLimiter, loginHandler);
```

## A05: Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet()); // Sets security headers

// CORS: whitelist specific origins
import cors from 'cors';
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
}));
```

## A06: Dependency Audit

```bash
# Check for known vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# Check for outdated packages
npm outdated
```

## A07: Session Security

```typescript
// Cookie settings for session/token
res.cookie('token', refreshToken, {
  httpOnly: true,     // Not accessible via JavaScript
  secure: true,       // HTTPS only
  sameSite: 'strict', // No cross-site sending
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',  // Only sent to auth endpoints
});
```

## A09: Logging

```typescript
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Log auth events
logger.info({ userId, action: 'login_success' }, 'User logged in');
logger.warn({ email, action: 'login_failure', ip: req.ip }, 'Failed login attempt');

// NEVER log sensitive data
// BAD: logger.info({ password, token }, 'Auth data');
// GOOD: logger.info({ userId, action: 'token_issued' }, 'Token issued');
```

## Input Validation with Zod

```typescript
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

function loginHandler(req: Request, res: Response) {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }
  // result.data is typed and validated
  const { email, password } = result.data;
}
```

## Environment Variables

```typescript
// Validate all required env vars at startup
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL', 'ALLOWED_ORIGINS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}
```
