---
name: madd-security-maker
description: Use this skill when implementing security features, authentication, authorization, encryption, or secure coding patterns. Trigger phrases include "implement authentication", "add encryption", "set up RBAC", "secure the API", "implement OIDC", "add mTLS", "security headers", "audit logging", "secrets vault", "JWT validation".
---

# MADD Secure Coding

## OWASP Top 10 Checklist

Every implementation must be checked against these categories:

| # | Vulnerability | Dev Action | Audit Check |
|---|---------------|------------|-------------|
| A01 | **Broken Access Control** | Enforce authz on every endpoint. Default deny. | Verify no endpoint is accessible without proper role check |
| A02 | **Cryptographic Failures** | Use bcrypt/argon2 for passwords. TLS for transit. No secrets in code. | Verify no plaintext secrets, proper hashing, no weak algorithms |
| A03 | **Injection** | Parameterized queries. No string concatenation in SQL/shell. | Search for string interpolation in queries, `exec`, `eval` |
| A04 | **Insecure Design** | Threat model per feature. Rate limiting on auth endpoints. | Verify rate limits exist, account lockout, brute-force protection |
| A05 | **Security Misconfiguration** | Disable debug in production. Remove default credentials. CORS whitelist. | Check for debug flags, default passwords, open CORS |
| A06 | **Vulnerable Components** | Pin dependency versions. No known CVE dependencies. | Run `npm audit` / `pip audit` / `govulncheck` |
| A07 | **Auth Failures** | Secure session management. JWT with proper expiry. No token in URL. | Verify token storage, expiry, refresh flow |
| A08 | **Data Integrity Failures** | Validate all deserialized data. Verify signatures. | Check for unsafe deserialization, unvalidated webhooks |
| A09 | **Logging Failures** | Log auth events. No sensitive data in logs. Structured logging. | Verify login/logout/failure logged, no PII in logs |
| A10 | **SSRF** | Validate URLs. No user-controlled redirect targets. Block internal IPs. | Check for URL parameters used in server-side requests |

## Input Validation Rules

All user input MUST be validated at the system boundary (API handler, form submission):

```
1. Type check — Is it the expected type (string, number, boolean)?
2. Length check — Is it within acceptable bounds?
3. Format check — Does it match expected pattern (email, UUID, etc.)?
4. Range check — Is the numeric value within allowed range?
5. Whitelist check — Is the value in an allowed set (for enums)?
```

Reject invalid input with a 400 error. Never silently coerce invalid data.

## Authentication Patterns

### Password Storage

- Use bcrypt with cost factor >= 12, or argon2id
- Never store plaintext or reversibly encrypted passwords
- Never use MD5 or SHA-256 alone for passwords

### JWT Handling

- Sign with RS256 or ES256 (asymmetric) for microservices, HS256 for monoliths
- Set `exp` (expiry): access token 15min, refresh token 7 days
- Store refresh tokens server-side (database), not in localStorage
- Validate `iss`, `aud`, `exp` on every request
- Never put sensitive data in JWT payload (it is base64, not encrypted)

### Session Security

- Set `HttpOnly`, `Secure`, `SameSite=Strict` on cookies
- Regenerate session ID after login
- Implement session timeout (idle and absolute)

## Secrets Management

- Never hardcode secrets (API keys, DB passwords, tokens)
- Use environment variables or a secrets manager
- Add `.env` to `.gitignore`
- Validate required env vars at startup (fail fast)
- Never log secrets or include them in error messages

## SQL/NoSQL Injection Prevention

```
# GOOD: Parameterized query
db.query("SELECT * FROM users WHERE id = $1", [userId])

# BAD: String interpolation
db.query(`SELECT * FROM users WHERE id = ${userId}`)
```

This applies to ALL query builders and ORMs — verify the ORM uses parameterized queries under the hood.

## OIDC/JWKS Authentication

### JWT Verification Flow

```
1. Client sends: Authorization: Bearer <token>
2. Server extracts JWT header to get `kid` (key ID)
3. Server fetches JWKS from issuer's /.well-known/jwks.json (cached)
4. Server finds matching public key by `kid`
5. Server verifies signature, exp, iss, aud claims
6. Server extracts user identity from token claims
```

### JWKS Endpoint Caching

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";

// Cache JWKS for performance (auto-refreshes on key rotation)
const JWKS = createRemoteJWKSet(
  new URL("https://auth.example.com/.well-known/jwks.json"),
  { cacheMaxAge: 600000 } // 10 minutes
);

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://auth.example.com/",
    audience: "https://api.example.com",
    algorithms: ["RS256", "ES256"],    // Explicitly whitelist algorithms
  });

  return {
    userId: payload.sub,
    email: payload.email as string,
    roles: payload.roles as string[],
  };
}
```

### Issuer and Audience Validation

Rules:
- ALWAYS validate `iss` (issuer) — reject tokens from unknown issuers
- ALWAYS validate `aud` (audience) — reject tokens not intended for this service
- ALWAYS validate `exp` (expiration) — reject expired tokens
- ALWAYS whitelist algorithms — prevent algorithm confusion attacks
- Cache JWKS with TTL (10 min) — avoid fetching on every request
- Handle key rotation gracefully — refresh JWKS on unknown `kid`

## RBAC with Role Hierarchy

### Role Hierarchy

```
owner > admin > developer > viewer
```

### Permission Matrix

| Permission | viewer | developer | admin | owner |
|-----------|--------|-----------|-------|-------|
| Read resources | X | X | X | X |
| Create/update resources | | X | X | X |
| Delete resources | | | X | X |
| Manage members | | | X | X |
| Manage billing | | | | X |
| Delete workspace | | | | X |
| Transfer ownership | | | | X |

### Middleware Enforcement

```typescript
// Role hierarchy as numeric levels
const ROLE_LEVELS: Record<string, number> = {
  viewer: 0,
  developer: 1,
  admin: 2,
  owner: 3,
};

function requireRole(minimumRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || ROLE_LEVELS[userRole] < ROLE_LEVELS[minimumRole]) {
      return res.status(403).json({
        type: "https://api.example.com/errors/forbidden",
        title: "Insufficient Permissions",
        status: 403,
        detail: `Role '${minimumRole}' or higher required`,
      });
    }

    next();
  };
}

// Usage
router.get("/resources", requireRole("viewer"), listResources);
router.post("/resources", requireRole("developer"), createResource);
router.delete("/resources/:id", requireRole("admin"), deleteResource);
router.delete("/workspace", requireRole("owner"), deleteWorkspace);
```

Rules:
- Check roles on EVERY endpoint (default deny)
- Use middleware, not inline checks (consistent enforcement)
- Role checks happen AFTER authentication (authN before authZ)
- Log all permission check failures with user ID and attempted action

## AES-256-GCM Encryption

### Proper IV Generation and Auth Tag Handling

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;     // 96 bits for GCM
const TAG_LENGTH = 16;    // 128 bits auth tag

function encrypt(plaintext: string, key: Buffer): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = randomBytes(IV_LENGTH);       // MUST be unique per encryption
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted,
    iv: iv,
    authTag: cipher.getAuthTag(),
  };
}

function decrypt(ciphertext: Buffer, iv: Buffer, authTag: Buffer, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
```

### Key Derivation

```typescript
import { pbkdf2Sync, randomBytes } from "crypto";

function deriveKey(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
  const keySalt = salt || randomBytes(32);
  const key = pbkdf2Sync(password, keySalt, 100000, 32, "sha256");
  return { key, salt: keySalt };
}
```

Rules:
- NEVER reuse an IV with the same key (use `randomBytes(12)` for each encryption)
- ALWAYS store iv and authTag separately from ciphertext (not concatenated)
- Use 256-bit keys (32 bytes) for AES-256
- Use PBKDF2 or Argon2 for key derivation from passwords
- GCM mode provides both confidentiality AND integrity (authenticated encryption)

## mTLS Between Services

### Certificate Loading and Mutual Authentication

```typescript
import { readFileSync } from "fs";
import https from "https";

// Server: require client certificates
const server = https.createServer({
  cert: readFileSync("/etc/ssl/certs/server.crt"),
  key: readFileSync("/etc/ssl/private/server.key"),
  ca: readFileSync("/etc/ssl/certs/ca.crt"),       // Trust our CA
  requestCert: true,                                 // Require client cert
  rejectUnauthorized: true,                          // Reject invalid certs
});

// Client: present certificate to server
const agent = new https.Agent({
  cert: readFileSync("/etc/ssl/certs/client.crt"),
  key: readFileSync("/etc/ssl/private/client.key"),
  ca: readFileSync("/etc/ssl/certs/ca.crt"),
  rejectUnauthorized: true,
});

const response = await fetch("https://internal-service:8443/api/data", { agent });
```

### Certificate Validation

```typescript
server.on("secureConnection", (tlsSocket) => {
  const cert = tlsSocket.getPeerCertificate();

  // Verify expected service identity
  if (!cert.subject || cert.subject.CN !== "expected-service") {
    tlsSocket.destroy(new Error("Unexpected client identity"));
    return;
  }

  // Check certificate not expired
  if (new Date(cert.valid_to) < new Date()) {
    tlsSocket.destroy(new Error("Client certificate expired"));
    return;
  }
});
```

Rules:
- Use CA-signed certificates (not self-signed in production)
- Set `rejectUnauthorized: true` (never disable TLS verification)
- Validate client certificate CN/SAN matches expected service identity
- Rotate certificates before expiry (automate with cert-manager or similar)

## Secrets Vault Patterns

### Encrypt at Rest with AES-256

```typescript
// Store encrypted secrets in database
async function storeSecret(name: string, value: string, workspaceId: string) {
  const key = await getEncryptionKey(workspaceId);  // From KMS or vault
  const { ciphertext, iv, authTag } = encrypt(value, key);

  await db.query(
    `INSERT INTO secrets (name, ciphertext, iv, auth_tag, key_version, workspace_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [name, ciphertext, iv, authTag, currentKeyVersion, workspaceId]
  );

  // Audit log - NEVER log the plaintext value
  await auditLog("secret.created", { name, workspaceId });
}
```

### Key Rotation

```
1. Generate new encryption key (version N+1)
2. Store new key in KMS/vault
3. New writes use key version N+1
4. Background job re-encrypts existing secrets with new key
5. After all secrets migrated, mark key version N as deprecated
6. Delete deprecated key after grace period (30 days)
```

Rules:
- Never log plaintext secret values (log name, access event, user, timestamp only)
- Store encryption key version alongside ciphertext for rotation support
- Separate encryption keys per workspace/tenant
- Rotate keys every 90 days or on suspected compromise
- Audit ALL secret access (read, create, update, delete)

## Security Headers

Apply these headers on ALL HTTP responses:

```typescript
function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent XSS by restricting script sources
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
  );

  // Force HTTPS for 1 year, include subdomains
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict browser features
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  next();
}
```

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | `default-src 'self'` | Prevent XSS, data injection |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | Force HTTPS |
| X-Frame-Options | `DENY` | Prevent clickjacking |
| X-Content-Type-Options | `nosniff` | Prevent MIME confusion |
| Referrer-Policy | `strict-origin-when-cross-origin` | Limit referrer leakage |
| Permissions-Policy | `camera=(), microphone=()` | Restrict browser APIs |

## Audit Event Logging

### What to Log

```typescript
interface AuditEvent {
  action: string;           // "auth.login", "secret.accessed", "member.role_changed"
  userId: string;
  ip: string;
  userAgent: string;
  timestamp: string;        // ISO 8601
  resourceType: string;     // "user", "secret", "workspace"
  resourceId: string;
  metadata: Record<string, unknown>;  // Additional context (never plaintext secrets)
  outcome: "success" | "failure";
}
```

### Events to Audit

| Category | Events |
|----------|--------|
| Authentication | login_success, login_failure, logout, token_refresh, password_change |
| Authorization | permission_denied, role_change, member_invite, member_remove |
| Sensitive Data | secret_created, secret_accessed, secret_updated, secret_deleted |
| Admin Actions | workspace_created, workspace_deleted, settings_changed |
| Security Events | mfa_enabled, mfa_disabled, api_key_created, api_key_revoked |

### Implementation

```typescript
async function auditLog(action: string, context: {
  userId: string;
  ip: string;
  userAgent: string;
  resourceType: string;
  resourceId: string;
  outcome: "success" | "failure";
  metadata?: Record<string, unknown>;
}) {
  await db.query(
    `INSERT INTO audit_logs (action, user_id, ip_address, user_agent, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3::inet, $4, $5, $6, $7)`,
    [action, context.userId, context.ip, context.userAgent,
     context.resourceType, context.resourceId, JSON.stringify(context.metadata || {})]
  );
}

// Usage in route handlers
router.post("/secrets", requireRole("developer"), async (req, res) => {
  const secret = await createSecret(req.body);
  await auditLog("secret.created", {
    userId: req.user.id,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "",
    resourceType: "secret",
    resourceId: secret.id,
    outcome: "success",
    metadata: { name: req.body.name },  // Log name, NEVER log value
  });
  res.status(201).json(secret);
});
```

Rules:
- Log ALL authentication events (success AND failure)
- Log ALL permission checks that result in denial
- Log ALL access to sensitive data (secrets, PII)
- NEVER log plaintext secret values, passwords, or tokens
- Include IP address and user agent for forensic analysis
- Store audit logs in append-only storage (immutable)

## Verification Checklist

- [ ] OIDC/JWKS: JWT verified with cached JWKS, iss + aud + exp validated
- [ ] RBAC: role hierarchy enforced via middleware on every endpoint
- [ ] Encryption: AES-256-GCM with unique IV per encryption, separate auth tag
- [ ] mTLS: mutual certificate authentication between services
- [ ] Secrets: encrypted at rest, key rotation supported, access audited
- [ ] Headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options set
- [ ] Audit: all auth events, permission changes, and sensitive operations logged
- [ ] No plaintext secrets in logs, errors, or source code

## Additional Resources

For language-specific security patterns, consult:
- **`references/owasp-node.md`** — Node.js/TypeScript security patterns
- **`references/owasp-python.md`** — Python security patterns
