---
name: madd-api-maker
description: Use this skill when designing or implementing REST APIs, WebSocket endpoints, webhooks, or async job systems. Covers HTTP conventions, error response format, pagination, versioning, streaming, rate limiting, and validation patterns. Trigger phrases include "design the API", "create endpoints", "implement the routes", "add WebSocket", "set up webhooks", "API validation".
---

# API Design & Implementation (Maker)

## REST Conventions

### URL Structure
- Use nouns, not verbs: `/users` not `/getUsers`
- Plural resources: `/users`, `/orders`, `/products`
- Nested resources for ownership: `/users/{id}/orders`
- Max 2 levels of nesting (deeper = flatten with query params)
- kebab-case for multi-word: `/order-items`

### HTTP Methods

| Method | Purpose | Idempotent | Request Body | Success Code |
|--------|---------|------------|-------------|-------------|
| GET | Read resource(s) | Yes | No | 200 |
| POST | Create resource | No | Yes | 201 |
| PUT | Full replace | Yes | Yes | 200 |
| PATCH | Partial update | No | Yes | 200 |
| DELETE | Remove resource | Yes | No | 204 |

### Status Codes

| Range | Meaning | Common Codes |
|-------|---------|-------------|
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301, 304 |
| 4xx | Client error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Rate Limited |
| 5xx | Server error | 500 Internal, 503 Service Unavailable |

### Error Response Format (RFC 7807)

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body contains invalid fields",
  "instance": "/users/123",
  "errors": [
    { "field": "email", "message": "must be a valid email address" }
  ]
}
```

Rules:
- ALWAYS return consistent error shape
- Include `type` URI for machine-readable error categorization
- `detail` for human-readable message
- `errors[]` array for field-level validation errors
- NEVER expose stack traces or internal details in production

### Pagination

Cursor-based (recommended):
```
GET /users?cursor=abc123&limit=20
Response: { "data": [...], "pagination": { "next_cursor": "def456", "has_more": true } }
```

Offset-based (simple):
```
GET /users?page=2&per_page=20
Response: { "data": [...], "pagination": { "page": 2, "per_page": 20, "total": 150, "total_pages": 8 } }
```

### Filtering & Sorting
```
GET /users?status=active&role=admin           # Filtering
GET /users?sort=created_at&order=desc         # Sorting
GET /users?fields=id,name,email               # Sparse fields
```

### Versioning

URL path (recommended for simplicity):
```
/api/v1/users
/api/v2/users
```

Header-based (for advanced use):
```
Accept: application/vnd.api.v2+json
```

### Request/Response Conventions

- Use camelCase for JSON fields
- Use ISO 8601 for dates: `"2025-01-15T10:30:00Z"`
- Wrap collections: `{ "data": [...], "pagination": {...} }`
- Single resources: return object directly or `{ "data": {...} }`
- Include `id` in all response objects
- Include `created_at` and `updated_at` timestamps

### Authentication Headers
```
Authorization: Bearer <jwt-token>
X-API-Key: <api-key>
```

### Rate Limiting Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
Retry-After: 60  (on 429)
```

## OpenAPI / Swagger

- Define schemas for all request/response bodies
- Document all error responses (not just 200)
- Use `$ref` for shared schemas
- Tag endpoints by feature/resource

## Verification Checklist (for Audit)

- [ ] All endpoints use correct HTTP methods
- [ ] Error responses follow consistent format
- [ ] Pagination implemented for list endpoints
- [ ] Authentication required where specified
- [ ] Status codes match the operation semantics
- [ ] No sensitive data in URL query parameters
- [ ] Rate limiting headers present

## WebSocket Streaming Patterns

### Event Types

Define a strict event protocol for real-time streaming:

```typescript
// Server -> Client events
type ServerEvent =
  | { type: "chunk"; data: string; sequence: number }
  | { type: "complete"; totalChunks: number; metadata?: Record<string, unknown> }
  | { type: "error"; code: string; message: string }
  | { type: "heartbeat"; timestamp: string };

// Client -> Server events
type ClientEvent =
  | { type: "subscribe"; channel: string }
  | { type: "unsubscribe"; channel: string }
  | { type: "ping" };
```

### Connection Lifecycle

```
1. Client connects with auth token: ws://api/v1/stream?token=<jwt>
2. Server validates token, sends: { type: "connected", sessionId: "..." }
3. Client subscribes: { type: "subscribe", channel: "jobs/123" }
4. Server streams chunks: { type: "chunk", data: "...", sequence: 0 }
5. Server signals end: { type: "complete", totalChunks: 42 }
6. Server sends heartbeat every 30s to detect stale connections
7. Client reconnects with last sequence number for resumption
```

Rules:
- Always authenticate on connect (JWT in query param or first message)
- Include sequence numbers for ordering and resumption
- Heartbeat every 30s; close connection after 3 missed heartbeats
- Include `error` event type with machine-readable code
- Support graceful reconnection with last-seen sequence

## Webhook Callback Patterns

### Sending Webhooks

```typescript
// Webhook payload with HMAC signature
const payload = JSON.stringify({ event: "deployment.completed", data: { ... } });
const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

// Send with signature header + idempotency key
fetch(callbackUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Webhook-Signature": `sha256=${signature}`,
    "X-Webhook-Id": idempotencyKey,       // UUID for deduplication
    "X-Webhook-Timestamp": timestamp,      // ISO 8601
  },
  body: payload,
});
```

### Retry Strategy

```
Attempt 1: immediate
Attempt 2: 30 seconds
Attempt 3: 2 minutes
Attempt 4: 15 minutes
Attempt 5: 1 hour
Attempt 6: 4 hours (final)
```

Rules:
- Sign ALL webhook payloads with HMAC-SHA256
- Include idempotency key (`X-Webhook-Id`) for deduplication
- Include timestamp for replay attack prevention (reject if > 5 min old)
- Retry with exponential backoff (max 6 attempts)
- Log all delivery attempts and outcomes
- Provide a webhook delivery log endpoint for debugging

### Receiving Webhooks

```typescript
function verifyWebhook(req: Request, secret: string): boolean {
  const signature = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];

  // Reject old timestamps (replay protection)
  if (Date.now() - new Date(timestamp).getTime() > 5 * 60 * 1000) return false;

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

## Rate Limiting Patterns

### Sliding Window

Best for most API rate limiting. Smooth, no burst at window edges:

```
Key: rate_limit:{user_id}:{endpoint}
Algorithm: sorted set with timestamp scores
Check: count entries in [now - window, now]
```

### Token Bucket

Best for allowing controlled bursts:

```
Bucket capacity: 100 requests
Refill rate: 10 requests/second
Burst: up to 100 requests at once, then throttled
```

### Per-Tenant Quotas

```typescript
// Rate limit tiers
const RATE_LIMITS = {
  free:       { requests: 100,  window: "1h" },
  pro:        { requests: 1000, window: "1h" },
  enterprise: { requests: 10000, window: "1h" },
};
```

Always return headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1609459200
Retry-After: 60  (only on 429)
```

## Async Job Dispatch

For long-running operations, use a queue + callback pattern:

### Job Submission

```
POST /api/v1/jobs
{
  "type": "report_generation",
  "params": { ... },
  "callback_url": "https://client.example.com/webhooks/jobs"  // optional
}

Response: 202 Accepted
{
  "id": "job_abc123",
  "status": "queued",
  "status_url": "/api/v1/jobs/job_abc123",
  "estimated_duration_seconds": 120
}
```

### Job Status Polling

```
GET /api/v1/jobs/job_abc123

Response: 200 OK
{
  "id": "job_abc123",
  "status": "processing",    // queued | processing | completed | failed
  "progress": 0.45,          // 0.0 to 1.0
  "created_at": "...",
  "updated_at": "...",
  "result_url": null          // populated when status=completed
}
```

Rules:
- Return 202 Accepted (not 200) for queued jobs
- Include a `status_url` for polling
- Support optional `callback_url` for webhook notification on completion
- Include `progress` (0.0-1.0) for long operations
- Return `result_url` when complete (not inline result)

## Zod Validation Schema Examples

### Request Body Validation

```typescript
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["viewer", "developer", "admin"]),
  metadata: z.record(z.unknown()).optional(),
});

// In route handler
const result = CreateUserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(422).json({
    type: "https://api.example.com/errors/validation",
    title: "Validation Error",
    status: 422,
    detail: "Request body validation failed",
    errors: result.error.issues.map(i => ({ field: i.path.join("."), message: i.message })),
  });
}
```

### Query Param Validation

```typescript
const ListUsersQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  sort: z.enum(["created_at", "name", "email"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
```

### Path Param Validation

```typescript
const PathParamsSchema = z.object({
  userId: z.string().uuid(),
  orderId: z.string().uuid(),
});
```

## Request ID Tracing

### Generate and Propagate

```typescript
// Middleware: assign or propagate X-Request-ID
function requestIdMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}
```

### Propagation Through Services

```typescript
// When calling downstream services, always forward the request ID
const response = await fetch("https://internal-service/api/v1/data", {
  headers: {
    "X-Request-ID": req.requestId,
    "Authorization": `Bearer ${serviceToken}`,
  },
});
```

### Include in Logs

```typescript
logger.info("Processing request", {
  requestId: req.requestId,
  method: req.method,
  path: req.path,
  userId: req.user?.id,
});
```

Rules:
- Generate UUID v4 if no `X-Request-ID` header present
- Echo back in response headers
- Forward to all downstream service calls
- Include in all log entries for correlation
- Include in error responses for debugging

## Verification Checklist (for Audit)

- [ ] All endpoints use correct HTTP methods
- [ ] Error responses follow RFC 7807 format
- [ ] Pagination implemented for list endpoints
- [ ] Authentication required where specified
- [ ] Status codes match the operation semantics
- [ ] No sensitive data in URL query parameters
- [ ] Rate limiting headers present
- [ ] Request body validated with Zod/Pydantic schema
- [ ] X-Request-ID generated and propagated
- [ ] WebSocket events use typed protocol with sequence numbers
- [ ] Webhooks signed with HMAC-SHA256 and include idempotency keys
- [ ] Async jobs return 202 with status polling URL
- [ ] Rate limits configured per-tenant with proper headers

See references/:
- `rest-conventions.md` — Extended patterns and framework-specific examples
