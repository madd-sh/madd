# madd-init

Install [MADD (Multi-Agent Driven Development)](https://madd.sh) into any project in seconds.

```sh
npx madd-init
```

Detects which coding agents are present in your project, lets you select which ones to scaffold, and installs the full MADD methodology stack — agents, hooks, skills, contract files — without touching your existing code.

---

## Supported agents

| Agent | Detection marker |
|---|---|
| Claude Code | `.claude/settings.json` |
| Codex | `.codex/config.toml` |
| Mistral Vibe | `.vibe/config.toml` |
| OpenCode | `.opencode/opencode.json` |
| Docker cagent | `madd.yaml` |

---

## Usage

```sh
# Interactive — detects agents, shows TUI selector
npx madd-init

# Non-interactive — auto-select all detected agents
npx madd-init --yes

# Preview without writing anything
npx madd-init --dry-run --yes

# Install into a specific directory
npx madd-init /path/to/project

# Overwrite existing files (backs up to .madd.bak/ first)
npx madd-init --force

# Validate an existing install
npx madd-init doctor

# Update MADD files with diff + per-file confirmation
npx madd-init update
```

---

## What gets installed

```
.madd/
├── README.md                  MADD methodology overview
├── README.<agent>.md          Agent-specific guide (one per selected agent)
├── contract.d/
│   ├── 00-meta.json           Project metadata + maddVersion
│   ├── 10-intention.json      Goals and constraints
│   ├── 20-functional.json     User stories, acceptance criteria
│   ├── 30-technical.json      Stack, architecture decisions
│   ├── 40-tasks.json          Current fraction tasks
│   ├── 50-operations.json     Deployment, runbooks
│   ├── 60-audit-cycle.json    Breaker findings
│   └── 90-retro.json          Witness retrospective notes
├── contract.schema.json
├── mailbox/                   Inter-agent messages
└── state.json                 Active workflow state

.claude/                       (claude-code only)
├── agents/                    6 MADD sub-agents
├── commands/madd.md           /madd slash command
├── hooks/                     Safety guards (block-dangerous, validate-state)
├── rules/                     Code style contracts
├── skills/                    20 COSTA knowledge contracts
└── settings.json              Hook wiring
```

Your existing project files are never modified. MADD installs only into `.madd/` and the agent config directory (`.claude/`, `.codex/`, etc.).

---

## Safety model

| Scenario | Behaviour |
|---|---|
| File already exists | Skip (default) |
| File already exists + `--force` | Backup to `.madd.bak/`, then overwrite |
| File already exists + `update` | Show `diff -u`, ask confirmation per file |
| `--dry-run` | Log everything, write nothing |

---

## After install

```sh
# Validate the install
npx madd-init doctor

# Start a MADD fraction (Claude Code)
/madd
```

Read `.madd/README.md` in your project for a full explanation of the contract system, the six MADD agents, and the COSTA framework.

---

## Requirements

- Node.js >= 18
- `diff` (standard Unix tool, included on macOS, Linux, and Git for Windows)
