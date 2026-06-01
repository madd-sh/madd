# madd

The CLI for [MADD (Multi-Agent Driven Development)](https://madd.sh).

```sh
npx madd init
```

Detects which coding agents are present in your project, lets you select which ones to scaffold, and installs the full MADD methodology stack — agents, hooks, skills, contract files — without touching your existing code.

---

## Commands

```sh
madd init [path]      Scaffold MADD into current dir or [path]
madd doctor [path]    Validate an existing MADD install
madd update [path]    Update MADD files with diff + confirm per file
```

## Options

```sh
--force, -f    Overwrite existing files (backs up first into .madd.bak/)
--dry-run      Show what would be copied without writing
--yes, -y      Skip TUI, auto-select all detected agents
--version, -v  Print version
--help, -h     Print help
```

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
madd doctor          # validate the install

# Claude Code: start a MADD fraction
/madd
```

Read `.madd/README.md` in your project for a full explanation of the contract system, the six MADD agents, and the COSTA framework.

---

## Requirements

- Node.js >= 18
- `diff` (standard Unix tool, included on macOS, Linux, and Git for Windows)
