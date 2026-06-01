# MADD — OpenCode install

Files installed by `madd-init` for the OpenCode agent.

---

## `.opencode/opencode.json` — Agent configuration

Configures OpenCode with the MADD agent team: model routing, tool permissions,
and agent profiles.

## `.opencode/package.json` — OpenCode extensions

Declares any OpenCode extension dependencies required by MADD
(MCP servers, tool adapters).

## Quick start

```sh
# Open OpenCode in your project
opencode

# The MADD agent profiles are loaded automatically from .opencode/opencode.json
```
