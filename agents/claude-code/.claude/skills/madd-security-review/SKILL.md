---
name: madd-security-review
description: Use this skill when performing security audits, penetration testing reviews, or vulnerability assessments. Trigger phrases include "security audit", "check for vulnerabilities", "OWASP review", "pentest review", "security assessment", "threat model review", "check for injection", "verify authentication".
---

# Security Review (Breaker)

Systematic security audit checklist organized by OWASP Top 10 (2021) plus additional security controls.

## Audit Process

For each check below, mark as PASS, FAIL, or N/A. Any FAIL must include the specific file/line and a recommended fix with severity rating.

## OWASP Top 10 (2021)

### A01:2021 - Broken Access Control

- [ ] **Missing authorization checks**: Endpoints or functions performing actions without verifying the user has the required role/permission. --> Unauthorized users can perform privileged operations.

- [ ] **Insecure Direct Object Reference (IDOR)**: Resource access using user-supplied IDs without ownership verification (e.g., `GET /users/:id/data` without checking caller owns the resource). --> Users can access other users' data by guessing IDs.

- [ ] **Privilege escalation paths**: Ability to modify own role, access admin endpoints, or bypass role checks through parameter manipulation. --> Regular users can gain admin access.

- [ ] **Missing function-level access control**: Admin functions accessible to non-admin users, or role checks only on frontend. --> Backend does not enforce authorization.

- [ ] **CORS misconfiguration**: Wildcard origin on authenticated endpoints, or missing CORS on APIs consumed by browsers. --> Cross-site request forgery or blocked legitimate requests.

### A02:2021 - Cryptographic Failures

- [ ] **Weak algorithms**: Use of MD5, SHA1, DES, RC4, or ECB mode for any security-sensitive purpose. --> Known-broken algorithms provide no real security.

- [ ] **Missing encryption at rest**: Sensitive data (PII, secrets, tokens) stored in plaintext in database or files. --> Database breach exposes all sensitive data.

- [ ] **Hardcoded cryptographic keys**: Encryption keys, signing keys, or API secrets embedded in source code. --> Key rotation impossible, secret leaked to anyone with code access.

- [ ] **Improper key management**: Keys stored alongside encrypted data, or same key used for encryption and signing. --> Single compromise exposes everything.

- [ ] **Missing TLS**: HTTP endpoints serving sensitive data, or inter-service communication without TLS. --> Data intercepted in transit.

### A03:2021 - Injection

- [ ] **SQL injection**: String concatenation or interpolation in SQL queries instead of parameterized queries. Search for `${`, `f"SELECT`, `"SELECT" +`, `.format(` in query contexts. --> Full database compromise.

- [ ] **Command injection**: User input passed to `exec`, `spawn`, `system`, `os.popen`, or backtick execution. --> Remote code execution on server.

- [ ] **Cross-Site Scripting (XSS)**: User input rendered in HTML without escaping. Search for `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, template `|safe` filters. --> Session hijacking, account takeover.

- [ ] **Template injection**: User input in server-side template strings (Jinja2, EJS, Handlebars). --> Remote code execution via template engine.

- [ ] **LDAP/NoSQL injection**: User input in LDAP filters or MongoDB queries without sanitization. --> Authentication bypass or data exfiltration.

### A04:2021 - Insecure Design

- [ ] **Missing threat model**: No documented threat model for the application or feature. --> Security risks not identified during design.

- [ ] **No rate limiting**: Authentication endpoints, API endpoints, or form submissions without rate limiting. --> Brute force attacks, credential stuffing, DoS.

- [ ] **No account lockout**: Failed login attempts not tracked, no temporary or permanent lockout. --> Unlimited password guessing.

- [ ] **Missing input length limits**: Text inputs, file uploads, or API bodies without maximum size constraints. --> DoS via resource exhaustion.

### A05:2021 - Security Misconfiguration

- [ ] **Default credentials**: Default admin passwords, API keys, or database credentials not changed. --> Trivial unauthorized access.

- [ ] **Verbose error messages**: Stack traces, SQL errors, or internal paths exposed in production error responses. --> Information disclosure aids attackers.

- [ ] **Unnecessary features enabled**: Debug mode, directory listing, admin panels, or unused endpoints active in production. --> Expanded attack surface.

- [ ] **Missing security headers**: See non-OWASP section below for specific headers.

### A06:2021 - Vulnerable and Outdated Components

- [ ] **Known CVEs in dependencies**: Dependencies with known vulnerabilities. Run `npm audit`, `pip audit`, `go vuln check`, or `trivy`. --> Exploitable vulnerabilities in third-party code.

- [ ] **Outdated packages**: Dependencies multiple major versions behind with known security fixes. --> Missing security patches.

- [ ] **Unmaintained dependencies**: Dependencies with no commits in 2+ years or archived repos. --> No security fixes forthcoming.

### A07:2021 - Identification and Authentication Failures

- [ ] **Weak password policy**: No minimum length, complexity, or breach-list checking. --> Easily guessable passwords.

- [ ] **Missing MFA option**: No multi-factor authentication available for privileged accounts. --> Single-factor compromise = full account takeover.

- [ ] **Broken session management**: Sessions not invalidated on logout, password change, or after idle timeout. --> Stolen sessions remain valid indefinitely.

- [ ] **Insecure token storage**: JWT or session tokens stored in localStorage (XSS-accessible) instead of HttpOnly cookies. --> XSS attacks can steal authentication tokens.

- [ ] **Missing JWT validation**: JWT `exp`, `iss`, `aud` not validated, or algorithm not enforced (algorithm confusion attack). --> Token forgery or expired token reuse.

### A08:2021 - Software and Data Integrity Failures

- [ ] **Unsigned data**: Critical data (webhooks, inter-service messages) not signed with HMAC or digital signature. --> Data tampering in transit.

- [ ] **Missing integrity checks**: Downloaded files, packages, or configs not verified with checksums or signatures. --> Supply chain attacks via modified artifacts.

- [ ] **Unsafe deserialization**: User-controlled data passed to deserializers (pickle, Java ObjectInputStream, PHP unserialize). --> Remote code execution.

### A09:2021 - Security Logging and Monitoring Failures

- [ ] **Missing security event logging**: Login attempts, failed auth, permission changes, admin actions not logged. --> Cannot detect or investigate breaches.

- [ ] **PII in logs**: Passwords, tokens, SSNs, credit card numbers, or other PII written to log files. --> Log access = data breach.

- [ ] **Missing log integrity**: Logs stored without tamper protection (no write-once storage or signing). --> Attackers can cover their tracks.

- [ ] **No alerting on security events**: Multiple failed logins, privilege escalation attempts, or unusual access patterns not triggering alerts. --> Breaches go undetected.

### A10:2021 - Server-Side Request Forgery (SSRF)

- [ ] **Unvalidated URLs**: User-supplied URLs fetched by the server without validation (allowlist, DNS rebinding protection). --> Access to internal services, cloud metadata.

- [ ] **Internal service access**: Server-side requests can reach internal networks, cloud metadata endpoints (169.254.169.254), or localhost. --> Credential theft, internal service compromise.

- [ ] **Missing URL scheme restriction**: Server-side URL fetching accepting `file://`, `gopher://`, or other non-HTTP schemes. --> Local file read, protocol smuggling.

## Non-OWASP Security Controls

### Transport Security

- [ ] **Missing HTTPS enforcement**: Application accessible over HTTP without redirect to HTTPS. --> Data intercepted in transit.

- [ ] **Missing HSTS header**: `Strict-Transport-Security` header not set (recommended: `max-age=31536000; includeSubDomains`). --> Downgrade attacks from HTTPS to HTTP.

### Security Headers

- [ ] **Missing Content-Security-Policy (CSP)**: No CSP header restricting script sources, frame ancestors, and other content. --> XSS attacks can load external scripts.

- [ ] **Missing X-Frame-Options**: No `X-Frame-Options: DENY` or `SAMEORIGIN` header. --> Clickjacking attacks.

- [ ] **Missing X-Content-Type-Options**: No `X-Content-Type-Options: nosniff` header. --> MIME type confusion attacks.

- [ ] **Missing Referrer-Policy**: No `Referrer-Policy` header to control information leakage. --> Sensitive URL paths leaked to third parties.

- [ ] **Missing Permissions-Policy**: No `Permissions-Policy` header to restrict browser features (camera, microphone, geolocation). --> Unnecessary feature access.

### Secrets in Source

- [ ] **Secrets in source code**: API keys, passwords, tokens, or private keys committed to the repository. Search for patterns: `password=`, `secret=`, `api_key=`, `-----BEGIN`, `sk_live_`, `AKIA`. --> Secrets in git history are permanent. Rotate immediately.

- [ ] **Secrets in logs**: Sensitive values logged at any log level. Search for password, token, key, secret in log statements. --> Log aggregation systems become breach vectors.

- [ ] **Secrets in error messages**: Error responses or error logging including secret values. --> Secrets exposed to users or log readers.

### Audit Logging for Auth

- [ ] **Login events not logged**: Successful and failed login attempts not recorded with username, IP, timestamp. --> Cannot detect brute force or account compromise.

- [ ] **Permission changes not logged**: Role assignments, permission grants, and access revocations not recorded. --> Cannot audit who gave whom access.

- [ ] **Session events not logged**: Session creation, destruction, and token refresh not recorded. --> Cannot detect session hijacking.

## Severity Guide

| Severity | Criteria | Examples |
|----------|----------|---------|
| CRITICAL | Active exploitability, RCE, or full compromise | SQL injection, command injection, hardcoded secrets, missing auth |
| HIGH | Data exposure or significant security gap | IDOR, XSS, missing encryption, broken session management |
| MEDIUM | Defense-in-depth gap | Missing security headers, no rate limiting, missing MFA |
| LOW | Informational or minor hardening | Missing Referrer-Policy, verbose errors in staging, log formatting |
