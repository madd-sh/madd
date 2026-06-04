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
madd status [path]    Show install state (version, modified/missing files)
madd update [path]    Update MADD files with diff + confirm; prune orphans
madd deinit [path]    Remove unmodified MADD files (reads the manifest)
madd doctor [path]    Validate an existing MADD install
```

## Options

```sh
--force, -f    init: overwrite existing files (backs up first into .madd.bak/)
               deinit: skip the SHA1 check (10s Ctrl-C window in a terminal)
--dry-run      Show what would happen without writing anything
--yes, -y      Skip TUI, auto-select all detected agents
--json         Machine-readable output (status, doctor)
--version, -v  Print version
--help, -h     Print help
```

## Manifest

Every `init` writes `.madd/manifest.yaml`: the list of files MADD installed,
each with the SHA1 of the template it came from, plus the `maddVersion` and the
selected agents. It is human-readable YAML (a superset of JSON).

This is what makes `deinit` safe: a file is only removed when it still matches
the template SHA1, so anything you have edited (or a config that predated the
install) is always kept. `status` uses the same comparison to report which
tracked files are `unchanged`, `modified`, or `missing`.

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

## Security

`madd` installs executable content (shell hooks + LLM-executed agent instructions),
so it is treated as supply-chain-sensitive: SHA-256 integrity manifest, zero
dependencies and zero install scripts, path-traversal guard, signed provenance-backed
releases (SLSA Build L2), GPG-signed commits, pinned/hardened CI, CodeQL and Scorecard.

See [SECURITY.md](SECURITY.md) for the threat model and reporting, and
[RELEASING.md](RELEASING.md) for the release pipeline.

```sh
npx @madd-sh/madd@<version> init --dry-run --yes .   # inspect before installing
npm audit signatures                                # verify provenance after install
```

## Requirements

- Node.js >= 18
- `diff` (standard Unix tool, included on macOS, Linux, and Git for Windows)
