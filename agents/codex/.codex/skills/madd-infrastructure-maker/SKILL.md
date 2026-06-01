---
name: madd-infrastructure-maker
description: Use this skill when designing or implementing infrastructure, Dockerfiles, Compose configurations, Terraform, CI/CD pipelines, mTLS, or secret management. Covers multi-stage builds, security hardening, layer caching, compose patterns, cloud infrastructure, and horizontal scaling. Trigger phrases include "create a Dockerfile", "set up Docker Compose", "configure Terraform", "set up CI/CD", "deploy the service", "infrastructure setup", "container configuration".
metadata:
  short-description: Docker and infrastructure patterns for Maker agent
---

# MADD Docker Best Practices

This skill provides comprehensive Docker and Docker Compose patterns for development and production environments, with a focus on security, performance, and maintainability.

## 1. Dockerfile Best Practices

### Multi-Stage Builds

Multi-stage builds separate build-time dependencies from runtime dependencies, resulting in smaller, more secure production images.

#### Node.js Multi-Stage Pattern

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### Python Multi-Stage Pattern

```dockerfile
# Build stage - create wheels
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and build wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt

# Production stage
FROM python:3.12-slim AS production

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1001 appuser

# Copy wheels and install
COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && \
    rm -rf /wheels

# Copy application
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

CMD ["python", "app.py"]
```

#### Go Multi-Stage Pattern

```dockerfile
# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production stage - minimal distroless image
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /

# Copy binary from builder
COPY --from=builder /app/main .

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/main"]
```

### Layer Caching Optimization

Order Dockerfile instructions from least to most frequently changing to maximize cache reuse:

```dockerfile
# 1. Base image (rarely changes)
FROM node:20-alpine

# 2. System dependencies (rarely change)
RUN apk add --no-cache tini

# 3. Application dependencies (change occasionally)
COPY package.json package-lock.json ./
RUN npm ci

# 4. Source code (changes frequently)
COPY . .

# 5. Build step (runs only when source changes)
RUN npm run build
```

**Key Principles:**
- Copy dependency manifests before source code
- Install dependencies in separate layer
- Copy source code last
- Combine related RUN commands to reduce layers

### Security Hardening

#### Non-Root User

Always run containers as non-root:

```dockerfile
# Alpine-based
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Debian-based
RUN useradd -m -u 1001 appuser

# Copy with ownership to avoid chown after
COPY --chown=appuser:appuser . .

USER appuser
```

#### Version Pinning

Use specific version tags, never `latest`:

```dockerfile
# Bad - non-reproducible
FROM node:alpine

# Good - specific, reproducible
FROM node:20.11.0-alpine3.19

# Better - digest for immutability
FROM node:20.11.0-alpine3.19@sha256:abc123...
```

#### Secrets Management

Never include secrets in Dockerfile:

```dockerfile
# Bad - secrets in build args or ENV
ARG DATABASE_PASSWORD=secret
ENV API_KEY=abc123

# Good - runtime injection via environment
# Set environment variables at runtime via:
# - docker run -e API_KEY=$API_KEY
# - Docker secrets (Swarm)
# - Kubernetes secrets
# - .env files (compose, dev only)
```

#### Capability Dropping

When using Docker Compose or orchestrators, drop unnecessary capabilities:

```yaml
services:
  app:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if binding to ports < 1024
    security_opt:
      - no-new-privileges:true
```

#### Vulnerability Scanning

Scan images regularly:

```bash
# Docker Scout (built into Docker Desktop)
docker scout cves myapp:latest

# Trivy (open-source)
trivy image myapp:latest

# Integrate into CI/CD
docker scout cves --exit-code --only-severity critical,high myapp:latest
```

### Size Optimization

#### Comprehensive .dockerignore

Exclude unnecessary files from build context:

```dockerignore
# Node.js
node_modules/
npm-debug.log
yarn-error.log
.npm/
.yarn/

# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
*.egg-info/
dist/
build/

# Go
vendor/
*.exe
*.test

# Version control
.git/
.gitignore
.gitattributes

# CI/CD
.github/
.gitlab-ci.yml
.travis.yml
Jenkinsfile

# Documentation
*.md
docs/
LICENSE

# Tests
tests/
test/
*.test.js
*.spec.js
__tests__/
coverage/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Environment
.env
.env.local
.env.*.local
*.pem
*.key

# Docker
Dockerfile*
docker-compose*.yml
.dockerignore
```

#### Multi-Stage to Remove Build Tools

```dockerfile
# Build stage includes compilers, build tools
FROM node:20 AS builder
RUN npm ci && npm run build

# Production excludes all build dependencies
FROM node:20-alpine
COPY --from=builder /app/dist ./dist
# Result: 90% smaller image
```

#### Alpine Variants

Use Alpine Linux for minimal base images:

```dockerfile
# Standard: ~1GB
FROM node:20

# Alpine: ~150MB
FROM node:20-alpine

# But verify compatibility - some packages need additional deps
FROM node:20-alpine
RUN apk add --no-cache python3 make g++  # For native modules
```

#### Combine RUN Commands

Reduce layers by combining related commands:

```dockerfile
# Bad - 3 layers
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# Good - 1 layer, cleanup in same layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
```

## 2. Docker Compose Patterns

### Development Compose

Full development setup with hot-reload, debug ports, and local databases:

```yaml
# compose.dev.yaml
version: '3.8'

services:
  app:
    build:
      context: .
      target: development
      dockerfile: Dockerfile.dev
    volumes:
      # Mount source for hot-reload
      - .:/app
      # Prevent node_modules override
      - /app/node_modules
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://dev:dev@db:5432/app_dev
      REDIS_URL: redis://redis:6379
    ports:
      - "3000:3000"
      - "9229:9229"  # Node.js debug port
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

### Production Compose

Hardened production configuration:

```yaml
# compose.prod.yaml
version: '3.8'

services:
  app:
    image: myapp:${VERSION:-latest}
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    environment:
      NODE_ENV: production
    env_file:
      - .env.prod
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    networks:
      - frontend
      - backend

  db:
    image: postgres:16-alpine
    read_only: true
    tmpfs:
      - /tmp
      - /run/postgresql
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
    networks:
      - backend

  nginx:
    image: nginx:1.25-alpine
    read_only: true
    tmpfs:
      - /var/cache/nginx
      - /var/run
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - app
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - frontend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

volumes:
  pgdata:
    driver: local

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### Development Dockerfile

Separate Dockerfile for development with tools and utilities:

```dockerfile
# Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Install development tools
RUN apk add --no-cache \
    git \
    curl \
    vim

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Source mounted via volume in compose

EXPOSE 3000 9229

CMD ["npm", "run", "dev"]
```

## 3. Health Checks

Health checks enable orchestrators to detect and restart failing containers.

### HTTP Application

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

```javascript
// Express.js health endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.ping();

    // Check Redis connection
    await redis.ping();

    res.status(200).json({ status: 'healthy' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

### Database Health Checks

| Service | Health Check Command | Notes |
|---------|---------------------|-------|
| PostgreSQL | `pg_isready -U $POSTGRES_USER` | Fast, checks if server accepts connections |
| MySQL | `mysqladmin ping -h localhost -u $MYSQL_USER -p$MYSQL_PASSWORD` | Requires password |
| MongoDB | `mongosh --eval 'db.runCommand("ping")'` | MongoDB 5+ |
| Redis | `redis-cli ping` | Returns PONG if healthy |
| Elasticsearch | `curl -f http://localhost:9200/_cluster/health` | HTTP endpoint |

### Compose Health Check Examples

```yaml
services:
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  mongodb:
    image: mongo:7
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.runCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

## 4. Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `latest` tag | Non-reproducible builds, unexpected breaking changes | Pin specific version: `node:20.11.0-alpine3.19` |
| Running as root | Security vulnerability, privilege escalation risk | Create and use non-root user: `USER 1001` |
| No `.dockerignore` | Bloated build context, slow builds, leaked secrets | Comprehensive `.dockerignore` excluding node_modules, .git, .env |
| Secrets in ENV/ARG | Visible in `docker inspect`, leaked in layers | Use runtime secrets, Docker secrets, or secret managers |
| Single-stage production | Large images with build tools, increased attack surface | Multi-stage build separating build and runtime |
| No health checks | Orchestrator can't detect failures, manual intervention needed | Add HEALTHCHECK in Dockerfile or compose |
| `COPY . .` before deps | Cache invalidation on every source change | Copy dependency files first, then source |
| Root-owned files | Permission issues, security risks | Use `COPY --chown=user:group` |
| Exposing dev ports in prod | Security risk, information disclosure | Separate dev/prod compose files |
| Not cleaning package cache | Bloated image size | Clean in same RUN layer: `&& rm -rf /var/lib/apt/lists/*` |
| Using `ADD` for local files | Unnecessary auto-extraction, unclear intent | Use `COPY` for local files, `ADD` only for URLs/tarballs |
| Multiple `FROM` in non-multi-stage | Confusing, only last image builds | Use proper multi-stage syntax with `AS` |
| Hardcoded config in image | Requires rebuild for config changes | Use environment variables or mounted configs |
| No resource limits | OOM kills, resource starvation | Set memory/CPU limits in compose deploy section |

## 5. Verification Checklist (for Audit Agent)

Use this checklist when reviewing Dockerfiles and compose configurations:

### Dockerfile Audit

- [ ] Multi-stage build used (no build tools in production image)
- [ ] Non-root user configured and used (`USER` instruction)
- [ ] Specific base image version pinned (not `latest`)
- [ ] No secrets in Dockerfile (no ARG/ENV with credentials)
- [ ] `.dockerignore` exists and excludes sensitive files
- [ ] Layer caching optimized (dependencies before source)
- [ ] Package manager cache cleaned in same RUN layer
- [ ] `COPY --chown` used instead of separate `RUN chown`
- [ ] HEALTHCHECK defined for application containers
- [ ] Minimal base image used (alpine, distroless, or scratch)
- [ ] Security scanning configured (Scout, Trivy, Snyk)

### Docker Compose Audit

- [ ] Health checks defined for all services
- [ ] `condition: service_healthy` used in depends_on
- [ ] Resource limits set (deploy.resources.limits)
- [ ] Restart policies configured appropriately
- [ ] Named volumes for persistent data
- [ ] No volume mounts of source code in production
- [ ] Environment variables externalized (not hardcoded)
- [ ] Secrets management strategy in place
- [ ] Network isolation between services (separate networks)
- [ ] Security options configured (cap_drop, no-new-privileges)
- [ ] Read-only root filesystem where possible
- [ ] Production ports not exposed to host (or limited)

### Security Audit

- [ ] Images scanned for CVEs (critical/high vulnerabilities addressed)
- [ ] No secrets in version control (.env in .gitignore)
- [ ] Principle of least privilege (minimal capabilities)
- [ ] Regular base image updates scheduled
- [ ] Supply chain security (verified base images)
- [ ] SBOM (Software Bill of Materials) generated
- [ ] Container runtime security configured (AppArmor, SELinux)

### Performance Audit

- [ ] Layer count minimized (combined RUN commands)
- [ ] Build cache optimized (correct instruction order)
- [ ] Image size reasonable for application type
- [ ] Unnecessary files excluded (.dockerignore)
- [ ] Multi-stage build removes dev dependencies
- [ ] Health check interval appropriate (not too aggressive)

## 6. Quick Reference

### Build and Run Commands

```bash
# Build with specific Dockerfile
docker build -f Dockerfile.prod -t myapp:latest .

# Build with build args
docker build --build-arg NODE_ENV=production -t myapp:latest .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .

# Run with environment variables
docker run -e NODE_ENV=production -e DATABASE_URL=$DATABASE_URL myapp:latest

# Run with volume mount
docker run -v $(pwd):/app myapp:latest

# Run with port mapping
docker run -p 3000:3000 myapp:latest

# Compose up with specific file
docker compose -f compose.prod.yaml up -d

# Compose with environment file
docker compose --env-file .env.prod up -d

# View logs
docker compose logs -f app

# Scale service
docker compose up -d --scale app=3

# Execute command in running container
docker compose exec app sh
```

### Debugging

```bash
# Check container logs
docker logs <container-id>

# Inspect container
docker inspect <container-id>

# View resource usage
docker stats

# Check health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Debug build issues
docker build --progress=plain --no-cache .

# Access shell in running container
docker exec -it <container-id> sh

# View image layers
docker history myapp:latest
```

## 7. Language-Specific Patterns

### Node.js

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Leverage layer caching for dependencies
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    npm cache clean --force

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Python

```dockerfile
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

RUN useradd -m -u 1001 appuser

COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && \
    rm -rf /wheels

COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

CMD ["python", "app.py"]
```

### Go

```dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o main .

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /

COPY --from=builder /app/main .

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/main"]
```

## 8. CI/CD Integration

### GitHub Actions Example

```yaml
name: Docker Build and Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-scan:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          load: true
          tags: myapp:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
```

---

## When to Use This Skill

Invoke this skill when:
- Creating new Dockerfiles for any language or framework
- Setting up Docker Compose for development or production
- Auditing existing Docker configurations for security or performance
- Troubleshooting container build or runtime issues
- Implementing multi-stage builds
- Configuring health checks for orchestration
- Optimizing image size or build time
- Hardening containers for production deployment

This skill complements `madd-security-maker` for security best practices and `madd-ci-validation` for CI/CD pipeline integration.

## 9. Advanced Docker Compose Patterns

### Healthcheck Best Practices

Every service must define a healthcheck with appropriate intervals:

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s      # How often to check
      timeout: 10s       # Max time for a single check
      retries: 3         # Failures before unhealthy
      start_period: 40s  # Grace period for startup
```

### Dependency Ordering with Conditions

Use `depends_on` with `condition` to ensure services start in the correct order:

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy    # Wait for healthcheck to pass
      redis:
        condition: service_healthy
      migrations:
        condition: service_completed_successfully  # Wait for one-shot container to finish

  migrations:
    build: .
    command: ["npm", "run", "migrate"]
    depends_on:
      db:
        condition: service_healthy
```

### Named Volumes and Backup

```yaml
volumes:
  pgdata:
    driver: local
    labels:
      com.example.description: "PostgreSQL data"
      com.example.backup: "daily"

  redis-data:
    driver: local
```

Backup pattern:
```bash
# Backup PostgreSQL from named volume
docker compose exec db pg_dump -U postgres -d appdb > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T db psql -U postgres -d appdb < backup_20250115.sql
```

## 10. Terraform Patterns

### VPC with Public/Private Subnets

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project}-vpc" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project}-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${var.project}-private-${count.index}" }
}
```

### Security Groups (Least Privilege)

```hcl
resource "aws_security_group" "app" {
  name_prefix = "${var.project}-app-"
  vpc_id      = aws_vpc.main.id

  # Inbound: only from ALB on app port
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Outbound: only to DB and internet (for external APIs)
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db.id]
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### IAM Least Privilege

```hcl
resource "aws_iam_role" "app_task" {
  name = "${var.project}-app-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "app_task" {
  role = aws_iam_role.app_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${aws_s3_bucket.uploads.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.app.arn
      }
    ]
  })
}
```

### ECS/Fargate Service

```hcl
resource "aws_ecs_service" "app" {
  name            = "${var.project}-app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.app_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }
}
```

## 11. mTLS Certificate Generation

### CA and Service Certificate Generation

```bash
# 1. Generate CA key and certificate
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/CN=Internal CA/O=MyOrg"

# 2. Generate service key and CSR with SAN extensions
openssl genrsa -out service.key 2048
openssl req -new -key service.key -out service.csr \
  -subj "/CN=app-service/O=MyOrg" \
  -addext "subjectAltName=DNS:app-service,DNS:app-service.internal,DNS:localhost,IP:127.0.0.1"

# 3. Sign with CA (include SAN from CSR)
openssl x509 -req -in service.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out service.crt -days 365 \
  -copy_extensions copyall

# 4. Verify certificate
openssl verify -CAfile ca.crt service.crt
openssl x509 -in service.crt -text -noout | grep -A1 "Subject Alternative Name"
```

### Docker Compose with mTLS

```yaml
services:
  app:
    volumes:
      - ./certs/ca.crt:/etc/ssl/certs/ca.crt:ro
      - ./certs/app.crt:/etc/ssl/certs/app.crt:ro
      - ./certs/app.key:/etc/ssl/private/app.key:ro
    environment:
      TLS_CA_CERT: /etc/ssl/certs/ca.crt
      TLS_CERT: /etc/ssl/certs/app.crt
      TLS_KEY: /etc/ssl/private/app.key
```

## 12. Secret Management

### Environment Variables vs Vault

| Method | Use Case | Security Level |
|--------|----------|---------------|
| `.env` file | Local development only | Low (file on disk) |
| Docker secrets | Swarm deployments | Medium (in-memory tmpfs) |
| AWS Secrets Manager | Production cloud | High (encrypted, audited) |
| HashiCorp Vault | Multi-cloud, on-prem | High (dynamic secrets) |

### Rotation Pattern

```
1. Generate new secret version (do NOT delete old yet)
2. Deploy services with dual-read capability (accept old + new)
3. Verify all services use new secret
4. Mark old version as deprecated
5. After grace period (24h), delete old version
```

Rules:
- Never log plaintext secrets (mask in logs: `sk_live_****`)
- Encrypt at rest with AES-256
- Rotate secrets every 90 days (automated)
- Separate secrets per environment (dev/staging/prod)
- Audit all secret access

## 13. Horizontal Scaling

### Task Queue + Worker Pool Pattern

```yaml
services:
  api:
    image: myapp:latest
    command: ["node", "dist/api.js"]
    deploy:
      replicas: 3
    depends_on:
      redis:
        condition: service_healthy

  worker:
    image: myapp:latest
    command: ["node", "dist/worker.js"]
    deploy:
      replicas: 5      # Scale workers independently
    depends_on:
      redis:
        condition: service_healthy

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
```

### Auto-Scaling Triggers

| Metric | Scale Up | Scale Down | Cooldown |
|--------|----------|------------|----------|
| CPU utilization | > 70% for 3 min | < 30% for 10 min | 5 min |
| Queue depth | > 100 messages | < 10 messages | 3 min |
| Response latency (P95) | > 500ms for 2 min | < 100ms for 10 min | 5 min |
| Memory utilization | > 80% for 3 min | < 40% for 10 min | 5 min |

## 14. Multi-Stage Dockerfile Best Practices

### Explicit Stage Names and Minimal Base

```dockerfile
# Stage 1: Install dependencies (cacheable)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build application
FROM deps AS builder
COPY . .
RUN npm run build

# Stage 3: Production runner (minimal)
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY package.json ./

USER nodejs
EXPOSE 3000

# Use tini as PID 1 for proper signal handling
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

Rules:
- Name every stage explicitly with `AS`
- Use the smallest base image for the runner stage (alpine, distroless, scratch)
- Never copy source code into the runner stage, only built artifacts
- Use tini or dumb-init as PID 1 for signal handling
- Runner stage should have NO build tools (gcc, make, python)

## 15. CI/CD Pipeline Patterns

### Standard Pipeline Stages

```
build -> test -> scan -> push -> deploy
```

### GitHub Actions Pipeline

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3

      - name: Build image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          load: true
          tags: myapp:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Run tests in container
        run: docker run --rm myapp:${{ github.sha }} npm test

  scan:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: 1

  push:
    needs: [test, scan]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Push to registry
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            registry.example.com/myapp:${{ github.sha }}
            registry.example.com/myapp:latest

  deploy:
    needs: push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster prod --service myapp \
            --force-new-deployment
```

Rules:
- Scan BEFORE push (never push vulnerable images)
- Cache Docker layers in CI (GitHub Actions cache, BuildKit)
- Tag images with commit SHA (not just `latest`)
- Deploy only from main branch after all checks pass
- Support rollback by redeploying previous SHA
