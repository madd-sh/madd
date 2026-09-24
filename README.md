# 🤪 MADD — make intent verifiable

MADD (Multi-Agent Driven Development) turns intent into a versioned contract,
a small implementation fraction, executed checks, independent review and a
retrospective. Humans and agents can share those responsibilities. Start with
a developer, a reviewer and your existing CI; agent adapters are optional.

This branch contains **CLI 0.2.0-rc.1 / format 0.2.0 candidate**. The published
0.1.3 installer does not have `validate`, `verify` or `--contract-only`.
No package is published simply by running the checks below.

## Try the contract-only candidate

```sh
npm ci --ignore-scripts
mkdir /tmp/my-change
node bin/madd.js init /tmp/my-change --contract-only
node bin/madd.js validate /tmp/my-change --json
```

This creates four JSON specification fragments and an editor schema. It adds
no agent instructions, hooks or services, and refuses to overwrite `.madd`.
Replace the starter requirement and acceptance check; then bind the check to
an existing repository file and run `validate --require-bound`.

A valid contract, a bound test and a delivered change are different claims.
`validate` never executes specification content and always reports
`delivered: false`. `verify` additionally requires signed receipts from
separately trusted CI and independent review authorities for the exact clean
candidate. It fails closed when authority setup or evidence is missing.

Read [the format, compatibility and trust model](docs/contracts.md) before
using evidence as a delivery gate. The CLI does not provision signing keys,
alter branch protection or turn a local test result into a CI attestation.

## Commands

```text
madd init [path] --contract-only  Create a minimal candidate contract
madd validate [path]             Validate structure, references and check bindings
madd verify [path]               Verify trusted CI and review receipts

madd init [path]                 Install selected legacy agent adapters
madd status [path]               Inspect adapter files using the install manifest
madd update [path]               Review adapter updates and prune pristine orphans
madd deinit [path]               Remove pristine adapter files; keep edited files
madd doctor [path]               Check adapter installation health
```

`--json` provides machine output for status, doctor, validate and verify.
Validation accepts `--fraction FRAC-001` and `--require-bound`. Verification
requires `--fraction`, `--evidence FILE` and `--trust FILE`; its protected
trust policy must be outside the candidate checkout.

Adapter installation supports `--dry-run`, `--yes` and `--force` (backup in
`.madd.bak/`). Forced deinit is a separate destructive operation with a TTY
countdown. Contract-only initialization does not accept force.

## Keep existing agent installations compatible

The installer includes Claude Code, Codex, Mistral Vibe, OpenCode and Docker
cagent adapters. Detection uses `.claude/settings.json`, `.codex/config.toml`,
`.vibe/config.toml`, `.opencode/opencode.json` and `madd.yaml`, respectively.
The optional adapters use the existing legacy contract and workflow. Their
scaffolding/schema compatibility is regression-tested; client runtime behavior
still depends on the adapter and installed client version.

```sh
npx @madd-sh/madd@0.1.3 init --dry-run
```

An adapter installation records template SHA-256 hashes in
`.madd/manifest.yaml`. Deinit keeps modified files. These lifecycle commands
manage installed adapters; a contract-only specification is authored source
and evolves through reviewed source changes. No automatic format migration
is performed. Existing 0.1.3 `doctor` is an installation check, not a
complete-contract or delivery validator.

## Develop and review

The maintainer toolchain is pinned in `.node-version`. Node 18 and 20 remain
legacy compatibility targets in CI; prefer the maintained Node 22 toolchain.

```sh
npm ci --ignore-scripts
make check
```

The checks validate shipped legacy templates and all five adapter assemblies,
strict parsing and filesystem boundaries, semantic references and fractions,
stale/tampered/incomplete/self-approved evidence, the relaunch's own contract,
and the npm package inventory. New validation dependencies are exact pins
with a lockfile and no install scripts. [The dependency decision](docs/contracts.md#dependency-and-rollback-decision)
is explicit: use maintained JSON Schema and parsing implementations rather
than a custom standards subset.

The relaunch is itself specified in `.madd/contract.d/`. Its retrospective
records actual local/CI/review evidence and limitations. Qareen's contract
migration follows the pilot learning, not this implementation.

For publication controls, see [RELEASING.md](RELEASING.md). For security reports,
see [SECURITY.md](SECURITY.md). Website: [madd.sh](https://madd.sh).
