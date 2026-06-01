---
name: madd-api-review
description: Use this skill when auditing or reviewing REST APIs, HTTP endpoints, or backend routes. Trigger phrases include "review the API", "audit the endpoints", "check the routes", "verify API consistency", "API review", "endpoint audit".
---

# API Review (Breaker)

Systematic audit checklist for REST API quality, security, and consistency.

## Audit Process

For each check below, mark as PASS, FAIL, or N/A. Any FAIL must include the specific endpoint/file and a recommended fix.

## 1. Input Validation

- [ ] **Missing request body validation**: Request bodies not validated with a schema library (Zod, Pydantic, struct tags, Joi). --> Unvalidated input leads to injection, data corruption, and crashes.

- [ ] **Missing query param validation**: Query parameters used directly without type coercion or range checks. --> Type confusion bugs and potential injection vectors.

- [ ] **Missing path param validation**: Path parameters (IDs, slugs) not validated for format (UUID, integer). --> Invalid IDs cause 500 errors instead of 400/404.

- [ ] **Missing content-type validation**: Endpoint accepts any Content-Type without checking `application/json` or expected type. --> Content-type confusion can bypass security middleware.

- [ ] **Missing request size limits**: No body size cap configured on the server or individual endpoints. --> Attackers can send arbitrarily large payloads causing OOM.

## 2. Error Handling

- [ ] **Inconsistent error format**: Error responses not following RFC 7807 Problem Details (`type`, `title`, `status`, `detail`, `instance`). --> Clients cannot reliably parse errors, leading to poor UX and debugging difficulty.

- [ ] **Inconsistent status codes**: Wrong HTTP status codes for operations (200 for creation instead of 201, 404 for validation errors instead of 422, 200 for deletion instead of 204). --> Clients cannot distinguish success types or error categories.

- [ ] **Stack traces in error responses**: Error responses containing stack traces, internal paths, or debug info in non-development environments. --> Information disclosure helps attackers map the system.

- [ ] **Missing error response documentation**: Error cases not documented in OpenAPI spec or equivalent. --> Clients cannot handle errors correctly.

## 3. Pagination and List Endpoints

- [ ] **Missing pagination on list endpoints**: List/collection endpoints returning unbounded result sets without pagination. --> Unbounded queries cause slow responses, high memory usage, and potential OOM.

- [ ] **Missing default limit**: Pagination without a default `limit` value when client omits it. --> Clients accidentally fetch entire tables.

- [ ] **Missing max limit cap**: Pagination accepting arbitrary `limit` values without a maximum (e.g., `limit=999999`). --> Clients can request unreasonably large pages.

## 4. Authentication and Authorization

- [ ] **Missing auth checks on protected endpoints**: Endpoints accessing user data or performing mutations without authentication middleware. --> Unauthenticated access to private data.

- [ ] **Missing authorization checks**: Authenticated endpoints not verifying the user has permission for the specific resource (IDOR vulnerability). --> Users can access/modify other users' data.

- [ ] **Sensitive data in URL query parameters**: Tokens, passwords, API keys, or PII passed via query parameters. --> Query params are logged in server logs, proxy logs, and browser history.

## 5. Rate Limiting

- [ ] **Missing rate limit headers**: Rate-limited endpoints not returning `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers. --> Clients cannot implement backoff, causing unnecessary 429 errors.

- [ ] **Missing Retry-After on 429**: Rate limit exceeded responses (429) not including `Retry-After` header. --> Clients retry immediately, worsening the overload.

- [ ] **No rate limiting on auth endpoints**: Login, registration, password reset endpoints without rate limiting. --> Brute force attacks on credentials.

## 6. Naming Consistency

- [ ] **Inconsistent resource names**: Mixed plural/singular resources across endpoints (`/user` vs `/users`). --> Confusing API surface, documentation mismatch.

- [ ] **Verbs in URLs**: Action verbs in URL paths (`/getUsers`, `/createOrder`) instead of nouns with HTTP methods. --> Violates REST conventions, inconsistent URL patterns.

- [ ] **Inconsistent casing**: Mixed casing in URLs (`/orderItems` vs `/order-items`) or response fields (`userId` vs `user_id`). --> Client serialization errors and confusion.

- [ ] **Inconsistent nesting**: Inconsistent depth for sub-resources, or nesting beyond 2 levels without flattening. --> Deep nesting creates unmaintainable URLs.

## 7. CORS Configuration

- [ ] **Missing CORS configuration**: API serving browser clients without CORS headers. --> Browsers block cross-origin requests from frontends.

- [ ] **Wildcard CORS origin**: `Access-Control-Allow-Origin: *` on authenticated endpoints. --> Any website can make authenticated requests.

- [ ] **Missing preflight handling**: OPTIONS requests not handled, causing CORS failures on non-simple requests. --> PUT, PATCH, DELETE, and custom-header requests fail in browsers.

## 8. Performance

- [ ] **N+1 queries behind endpoints**: Loading related data in loops instead of batch/join queries. Check for endpoints that return nested resources. --> Endpoint latency scales linearly with result count.

- [ ] **Missing request ID/correlation headers**: Requests not tagged with `X-Request-ID` for distributed tracing. --> Cannot correlate logs across services for debugging.

- [ ] **Missing caching headers**: GET endpoints for rarely-changing data without `Cache-Control` or `ETag` headers. --> Unnecessary load on servers, slow client experience.

## 9. Response Format

- [ ] **Inconsistent envelope format**: Some endpoints wrap in `{ "data": ... }`, others return raw objects. --> Clients need different parsing logic per endpoint.

- [ ] **Missing timestamps in responses**: Resource responses missing `created_at` and `updated_at` fields. --> Clients cannot sort, cache, or display recency.

- [ ] **Missing `id` in responses**: Resource responses not including the resource identifier. --> Clients cannot reference, update, or delete the resource.

## 10. Versioning

- [ ] **No versioning strategy**: API has no version prefix (`/api/v1/`) or header-based versioning. --> Breaking changes affect all clients simultaneously.

- [ ] **Breaking changes in same version**: Field removals, type changes, or behavior changes without version bump. --> Existing clients break without warning.

## Severity Guide

| Severity | Criteria | Examples |
|----------|----------|---------|
| CRITICAL | Security vulnerability | Missing auth, IDOR, sensitive data in URLs, wildcard CORS |
| HIGH | Data integrity or reliability risk | Missing validation, unbounded queries, N+1, missing rate limits |
| MEDIUM | Client integration difficulty | Inconsistent errors, naming, status codes, missing pagination |
| LOW | Best practice deviation | Missing caching headers, missing request ID, versioning |
