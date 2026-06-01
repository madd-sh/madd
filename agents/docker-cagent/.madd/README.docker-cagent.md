# MADD — Docker cagent install

Files installed by `madd-init` for the Docker cagent agent.

---

## `madd.yaml` — Master configuration

Single YAML file at the project root that configures the full MADD stack
for Docker cagent: providers, models, all six agents, and per-agent hooks.

Key sections:

```yaml
providers:          # LLM providers and API keys (env vars)
models:             # model aliases per role
agents:             # one block per MADD agent
  conductor:        # Conductor config
    shell_allow: [] # per-agent shell allowlist
    shell_deny:  [] # per-agent shell denylist
hooks:              # lifecycle hooks (pre/post per agent)
```

## Per-agent shell allowlists

Each agent in `madd.yaml` has an explicit `shell_allow` and `shell_deny` list.
This is the most granular hook system across all MADD-supported agents —
Maker can run tests but not deploy; Breaker is read-only.

## Quick start

```sh
# Run the MADD conductor via Docker cagent
docker run --rm -v $(pwd):/workspace madd-sh/cagent conductor
```
