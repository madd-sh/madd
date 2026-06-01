---
name: madd-infrastructure-review
description: Use this skill when auditing or reviewing Docker configurations, Compose files, Terraform, CI/CD pipelines, or deployment infrastructure. Trigger phrases include "review the Docker", "audit the infrastructure", "check the compose file", "verify the deployment", "infrastructure review", "container audit".
metadata:
  short-description: Infrastructure audit checklist for Breaker agent
---

# Infrastructure Review (Breaker)

Systematic audit checklist for container, orchestration, and deployment infrastructure.

## Audit Process

For each check below, mark as PASS, FAIL, or N/A. Any FAIL must include the specific file/service and a recommended fix.

## 1. Container Security

- [ ] **Running as root**: Dockerfile missing `USER` instruction or explicitly using `USER root` for the final stage. --> Root in container = root escape potential. Always use non-root user.

- [ ] **Missing capability dropping**: Compose/orchestrator config not setting `cap_drop: [ALL]` with selective `cap_add`. --> Containers inherit all Linux capabilities by default, expanding attack surface.

- [ ] **Missing no-new-privileges**: Service config missing `security_opt: [no-new-privileges:true]`. --> Processes inside container can escalate privileges via setuid binaries.

- [ ] **Non-multi-stage Dockerfiles**: Production Dockerfile using a single stage that includes build tools, compilers, and dev dependencies. --> Bloated image with unnecessary attack surface and wasted disk/bandwidth.

- [ ] **Missing .dockerignore**: No `.dockerignore` file, or file not excluding `node_modules`, `.git`, `.env`, test files. --> Secrets leak into image layers, build context is bloated and slow.

- [ ] **Unpinned base images**: Using `latest` tag or unversioned images (`FROM node:alpine`). --> Non-reproducible builds, unexpected breakage from upstream changes.

## 2. Health Checks

- [ ] **Missing healthchecks in Docker Compose**: Services without `healthcheck` configuration. --> Orchestrator cannot detect and restart failing containers.

- [ ] **Missing start_period**: Health checks without `start_period` on services with slow startup. --> Container marked unhealthy during initialization, causing restart loops.

- [ ] **No health endpoint in application**: Application code missing `/health` or `/healthz` endpoint that checks dependencies (DB, Redis). --> Health check can only verify process is running, not that it is functional.

- [ ] **Missing depends_on with condition**: Services depending on others without `depends_on: { <service>: { condition: service_healthy } }`. --> Services start before their dependencies are ready, causing connection errors.

## 3. Network and Port Security

- [ ] **Exposed ports that should be internal-only**: Database ports (5432, 3306), Redis (6379), or internal services mapped to host. --> Internal services directly accessible from outside the Docker network.

- [ ] **Missing network isolation**: All services on the default bridge network instead of separate frontend/backend networks. --> Any compromised container can reach all other services.

- [ ] **Missing internal network flag**: Backend network not marked `internal: true`. --> Containers on backend network can still reach the internet.

- [ ] **Missing TLS for inter-service communication**: Services communicating over plaintext HTTP within the network. --> Traffic between containers is sniffable if network is compromised.

## 4. Secrets Management

- [ ] **Hardcoded secrets in Dockerfiles**: API keys, passwords, or tokens in `ENV` or `ARG` instructions. --> Secrets visible in `docker history` and image layers forever.

- [ ] **Hardcoded secrets in Compose files**: Credentials directly in `environment:` block instead of env_file or Docker secrets. --> Secrets committed to version control.

- [ ] **Hardcoded secrets in Terraform**: Credentials in `.tf` files or `terraform.tfvars` committed to git. --> Secrets in version control history permanently.

- [ ] **Secrets in environment without encryption**: Sensitive values passed as plain environment variables without a secrets manager. --> Environment variables visible via `/proc`, `docker inspect`, and crash dumps.

## 5. Resource Management

- [ ] **Missing resource limits**: Containers without CPU/memory limits (`deploy.resources.limits`). --> Runaway container can consume all host resources, affecting other services.

- [ ] **Missing resource reservations**: No minimum resource guarantees (`deploy.resources.reservations`). --> Container may be starved of resources under load.

- [ ] **Missing volume persistence for stateful services**: Database or queue services without named volumes. --> Data lost on container restart/recreation.

- [ ] **Source code mounted in production**: Volume mounts of source code (`- .:/app`) in production compose file. --> Exposes source code, prevents immutable deployments.

## 6. Reliability

- [ ] **Single points of failure**: Critical services with no replicas and no restart policy. --> Service crash = downtime with no recovery.

- [ ] **Missing restart policy**: Services without `restart: unless-stopped` or equivalent. --> Container exits and stays down until manually restarted.

- [ ] **Missing dependency ordering**: Services starting before their dependencies via proper `depends_on` with health conditions. --> Race conditions on startup causing intermittent failures.

- [ ] **Missing backup strategy for persistent data**: No backup mechanism (cron, managed snapshots) for database volumes. --> Volume corruption or deletion = permanent data loss.

## 7. Image Quality

- [ ] **Large production images**: Production images containing build tools, test frameworks, dev dependencies. Run `docker images` to check size. --> Slow pulls, wasted storage, larger attack surface.

- [ ] **Missing layer cache optimization**: Dockerfile copying source before dependencies, invalidating cache on every change. --> Slow builds, wasted CI minutes.

- [ ] **Unnecessary COPY or ADD**: Using `ADD` for local files (should be `COPY`), or copying files that are in `.dockerignore`. --> Confusion about auto-extraction behavior, unintended files in image.

- [ ] **Package cache not cleaned**: `apt-get`, `pip`, or `npm` cache not cleaned in the same `RUN` layer. --> Wasted space in image layers.

## 8. IAM and Access Control (Cloud)

- [ ] **Over-privileged IAM roles**: IAM roles with `*` permissions or `AdministratorAccess` instead of least privilege. --> Compromised service has full account access.

- [ ] **Shared credentials across services**: Multiple services using the same IAM role or API key. --> Cannot scope permissions per service, audit trail is ambiguous.

- [ ] **Missing service account rotation**: Static credentials without rotation schedule. --> Long-lived credentials increase window of exposure if leaked.

## 9. CI/CD Pipeline

- [ ] **No image scanning in pipeline**: Docker images not scanned for CVEs before push to registry. --> Known vulnerabilities deployed to production.

- [ ] **Missing build cache in CI**: Docker builds not using layer caching in CI (GitHub Actions cache, BuildKit cache). --> Slow CI pipelines, wasted build minutes.

- [ ] **No rollback mechanism**: Deployment without ability to revert to previous version. --> Failed deployment requires forward-fix under pressure.

## Severity Guide

| Severity | Criteria | Examples |
|----------|----------|---------|
| CRITICAL | Security breach or data loss risk | Running as root, hardcoded secrets, no backup, exposed DB ports |
| HIGH | Reliability or availability risk | No health checks, no restart policy, no resource limits, missing depends_on |
| MEDIUM | Operational or maintenance risk | No .dockerignore, unpinned images, no cache optimization, no scanning |
| LOW | Best practice deviation | Missing internal network, no reservations, no TLS between services |
