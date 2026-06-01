# MADD — Mistral Vibe install

Files installed by `madd-init` for the Mistral Vibe agent.

---

## `.vibe/config.toml` — Provider and model configuration

Configures multi-provider routing for the MADD agent team:

| Provider | Model | Used for |
|---|---|---|
| Anthropic | Claude Opus / Sonnet | Conductor, Architect, Witness |
| Google | Gemini Pro | Maker (high throughput) |
| OpenAI | GPT Codex | CI, Breaker |
| Zhipu | GLM | Fallback |

## `.vibe/agents/` — Agent definitions (TOML)

One `.toml` file per MADD agent, using v1 naming convention:

| File | Maps to |
|---|---|
| `madd-orchestrator.toml` | Conductor |
| `madd-spec.toml` | Architect |
| `madd-dev.toml` | Maker |
| `madd-audit.toml` | Breaker |
| `madd-scribe.toml` | Witness |

Each file defines: system prompt, provider, model, allowed tools.

## Quick start

```sh
# Open Mistral Vibe in your project
vibe

# Invoke the orchestrator to start a MADD fraction
```
