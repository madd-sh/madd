# MADD — Codex install

Files installed by `madd-init` for the Codex agent.

---

## `.codex/config.toml` — Agent configuration

Configures the Codex agent: model, reasoning effort, approval policy,
sandbox mode, and multi-agent threading.

Key settings installed by MADD:

```toml
approval_policy = "on-request"   # agent asks before irreversible actions
sandbox_mode    = "workspace-write"
[features]
collab          = true            # enables multi-agent collaboration
child_agents_md = true            # agents read AGENTS.md for team context
```

## `AGENTS.md` — Team context

Describes the MADD agent team to Codex. Read automatically by Codex
at session start when `child_agents_md = true`.

Covers: Conductor, Architect, Maker, CI, Breaker, Witness — their roles,
responsibilities, and hand-off protocol.

## `.codex/skills/` — COSTA knowledge contracts

Same skill set as the Claude Code install, adapted for Codex's skill loading
format. Each skill is a `SKILL.md` file in its own directory.

Skills are loaded on demand when an agent invokes a skill by name.

## Quick start

```sh
# Open Codex in your project
codex

# The AGENTS.md gives Codex immediate context on the MADD team
# Start a fraction by prompting the Conductor role
```
