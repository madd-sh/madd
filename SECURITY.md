# Security Policy

`@madd-sh/madd` (`madd`) can install **executable content** into a project when
an agent adapter is selected:

- Shell scripts under `.claude/hooks/*.sh` that are made executable (`chmod 755`)
  and wired into the coding agent's lifecycle hooks. These run on the developer's
  machine with the agent's privileges.
- Natural-language agent, skill, and rule files that are loaded into an LLM with
  tool access. A malicious instruction here is a prompt-injection / confused-deputy
  vector against whatever tools the agent can call (shell, file write, network).

Because of this, the project is treated as a supply-chain-sensitive tool.
Contract-only initialization installs JSON and a schema, without agent hooks.

## Supported versions

The project is in initial development (`0.x`): the public surface may still change
between minor versions. Security fixes are released on the latest `0.x` minor only.
Always install the latest version; `madd status` reports whether your installed
`maddVersion` matches the current package.

## Reporting a vulnerability

Please report privately via GitHub **Security Advisories**
(`Security` tab -> `Report a vulnerability`) on `madd-sh/madd`, or by email to
`m@tthieu.fr` with subject `SECURITY: madd`.

- Do not open a public issue for an unfixed vulnerability.
- Expect an acknowledgement within 72 hours and a triage decision within 7 days.
- Coordinated disclosure: we aim to ship a fix and advisory within 90 days.

## Risk profile

| # | Threat | Impact | Likelihood | Primary controls |
|---|--------|--------|------------|------------------|
| R1 | Malicious instructions in templates (prompt injection in agents/skills/rules) | Agent misuse of its tools (RCE-adjacent via shell tool) | Medium | Code review of `agents/**`, CODEOWNERS, signed releases, public diff via `npx <version>` |
| R2 | Tampered/compromised npm release (account takeover, CI compromise) | Arbitrary file write + executable hooks with an adapter | Low | Pinned CI and tested package; release workflow requests npm provenance through OIDC; repository/npm account controls require separate configuration |
| R3 | Typosquatting / dependency confusion | User installs a hostile look-alike | Medium | Scoped name `@madd-sh/madd`, canonical install instructions, exact validation dependency versions and lockfile integrity |
| R4 | Malicious `postinstall`/lifecycle script | Code execution at `npm install` time | Low | Tests reject package lifecycle hooks and locked dependencies with install scripts; CI installs with `npm ci --ignore-scripts` |
| R5 | Path traversal via a crafted template path | Write outside the target project | Low | `scaffold` rejects any destination resolving outside the target dir |
| R6 | `deinit` deletes user-modified or unrelated files | Data loss | Low | SHA-256 manifest; only files matching the recorded template hash are removed; pre-existing/edited files are kept |
| R7 | Stale CLI silently shipping known-bad templates | Prolonged exposure | Medium | `madd status` version drift, Dependabot, Scorecard |
| R8 | Executable hooks run shell on the dev machine | Local RCE if a hook is malicious | Medium | Hooks are reviewed in-repo; they themselves block `rm -rf`, `curl\|bash`, secret-file writes; install is opt-in per agent |
| R9 | Hostile contract input or forged delivery evidence | Invalid contract accepted or delivery falsely reported | Medium | Bundled strict schema, bounded JSON parsing, path and symlink checks; revision-bound receipts from distinct CI/reviewer keys in an external protected trust policy |

## Controls in place

- **Integrity manifest**: agent-adapter installation writes `.madd/manifest.yaml` recording the
  SHA-256 of each template. `deinit` removes a file only if it still matches that
  hash, so user edits and pre-existing config are never destroyed.
- **Pinned validation dependencies, no install scripts**: the candidate uses
  three direct packages (`ajv`, `ajv-formats`, `jsonc-parser`), seven packages
  in the lockfile. Tests enforce the direct allowlist, exact versions, SHA-512
  lock integrity and absence of installation hooks. CI uses `npm ci --ignore-scripts`.
- **Path-traversal guard**: `scaffold` refuses to write outside the target directory.
- **Release workflow**: GitHub Actions requests OIDC publication with
  `npm publish --provenance`. Trusted-publisher configuration and the resulting
  provenance must be verified for each release; workflow code alone is not
  evidence of a published attestation. See [RELEASING.md](RELEASING.md).
- **Signing policy**: maintainer commits and release tags must be GPG-signed.
- **Hardened CI**: least-privilege `permissions`, all third-party actions pinned to
  a full commit SHA, egress audited via `step-security/harden-runner`.
- **Static analysis**: CodeQL on push/PR; OpenSSF Scorecard scheduled.
- **Contract validation and evidence**: `validate` never executes contract
  commands and never declares delivery. `verify` requires an exact Git revision
  and independently signed CI/review receipts. Protecting the external policy
  and provisioning the signing authorities remain operator responsibilities;
  an arbitrary file outside the checkout is not automatically trustworthy.

As checked on 2026-09-24, GitHub reported no classic protection or active branch
rules for `madd-sh/madd` main. Branch protection described in the release guide
is a setup requirement, not an active control verified by this pilot.

## Verifying what you install

```sh
# Inspect before installing (no write):
npx @madd-sh/madd@<version> init --dry-run --yes .

# Verify the published package's provenance:
npm view @madd-sh/madd
npm audit signatures        # checks registry signatures + provenance attestations

# After install, audit local drift:
madd status --json
```

## Threat model scope

In scope: the CLI, its templates, the release pipeline, the manifest/deinit logic,
contract parsing and validation, and delivery-evidence verification. The trust
policy and signing-key custody are explicit deployment assumptions; see
[the contract trust model](docs/contracts.md#trust-boundary-who-may-assert-success).

Out of scope: the security of the coding agents themselves (Claude Code, Codex, etc.),
the LLM providers, and project code authored by the user or their agents after install.
The MADD hooks reduce but do not eliminate the risk of an agent taking a dangerous action.
