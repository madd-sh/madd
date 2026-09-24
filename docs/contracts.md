# Contract format 0.2.0 — release candidate

This is the opt-in candidate format, distinct from the CLI package version.
It is being exercised by MADD's own relaunch. The published 0.1.3 installer
and its five agent adapters retain their legacy contract. No automatic
migration or production evidence authority is enabled by this change.

## Start without an agent

In a reviewed candidate checkout, run `npm ci --ignore-scripts`, then:

```sh
mkdir /tmp/my-change
node bin/madd.js init /tmp/my-change --contract-only
node bin/madd.js validate /tmp/my-change --json
```

Initialization creates four numbered JSON fragments and their editor schema.
It refuses an existing `.madd`, even with `--force`. The files are authored
source, not an agent installation: `status`, `doctor`, `update` and `deinit`
continue to manage legacy adapter installations. They do not upgrade the new
format. Remove a contract through a normal reviewed source change, not deinit.

Replace the starter intention, requirement, task and test. A planned test
has `binding: "planned", ref: null`. Binding means setting `binding: "bound"`
and `ref` to an existing relative check file. `--require-bound` fails until
all selected checks are bound. Validation **never executes that file**.

## Structure and semantics

The authoritative candidate schema is
[`schemas/contract-0.2.0.schema.json`](../schemas/contract-0.2.0.schema.json).
JSON Schema draft 2020-12 is checked with pinned Ajv and ajv-formats. Microsoft
jsonc-parser supplies token callbacks to detect duplicate properties before
JSON.parse loses them. Comments and trailing commas remain forbidden.

Required sections: `meta`, `intention`, `functional`, `tasks`. The schema
requires a nonempty intention, objective, requirement, acceptance criteria,
task and test registry. Technical, operations, audit and retro sections are
optional. They keep existing MADD names and useful fields.

- `meta.format_version` selects 0.2.0; `meta.version` is the project's version.
- `meta.owner` identifies responsibility; `meta.sources` records baseline
  repository revisions. The delivery candidate revision is supplied by Git,
  outside its own contract, to avoid a self-referential commit hash.
- Requirements can add structured `scenarios` with `given`, `when`, `then`.
- Existing `validation.test_id` points into the single `tasks.tests` registry.
  Additional mandatory checks may reference the same requirement; all are
  required for its delivery evidence.
- Generic `source_ids` preserve imported aliases without hardcoding products.
- Task ownership, repository, deliverable, completion condition and risk
  are typed optional additions.
- A fraction's requirements must exactly equal its tasks' requirement union.
  `--fraction FRAC-001` scopes the binding/evidence gate; structural validity
  still covers the whole contract. Future unbound fractions remain pending.

Unknown fields are rejected on typed objects. Existing unstructured payloads
(such as API response descriptions and provider configuration) are explicitly
JSON data maps: they are not additional contract control fields or executable
schemas. No remote `$ref`, dynamic reference or user-supplied schema is loaded.
The parser refuses prototype keys and non-finite numbers. Limits: 1 MiB per
file, 4 MiB total, 100 fragments, 64 nesting levels. Fragment names are
`NN-lowercase-name.json`; extra files in `contract.d` are errors.

Local bindings refuse absolute paths, URLs, traversal, backslashes and nested
symlinks. The selected project root itself is resolved by the caller. Input
is read as bounded regular files, not devices or pipes. These checks reduce
filesystem ambiguity; they are not an OS sandbox against another process
that can rewrite the checkout concurrently. CI must use an isolated checkout. Evidence verification compares raw HEAD
blob bytes: submodules and checkout transformations such as CRLF conversion,
smudge filters or LFS expansion are unsupported and fail closed.

## Compatibility inventory and migration

The original adapter templates use `meta.maddVersion`, `meta.release` and
`audit_cycle.scope_details`. Witness instructions also describe
`retro.fractions`, implementation observations and coverage maps. Those
fields were inspected before closing the candidate schema and are modeled
explicitly or retained as JSON data maps. The candidate additionally requires
owners, format identity, real requirements and explicit check binding states;
legacy empty scaffolds are not complete new-format contracts.

Every shipped legacy fragment and each of the five adapter assemblies is
validated against its unchanged legacy schema in `test/contract.test.js`.
Seven invalid null placeholders are omitted, and the broken relative schema
link is corrected. No unknown language, provider or generation date is invented.

Migration is an explicit review: preserve IDs (or a reviewed alias map), map
every field, add ownership and acceptance checks, then validate the new copy.
Never reinterpret an old `verified` status as authenticated evidence. Keep the
old source read-only until the new source is accepted; then select one editable
authority. Qareen migration is deliberately deferred until the pilot retro.

## Three separate claims

`madd validate --json` reports `structurallyValid`, `checksBound` and
`delivered: false`. Authored task/test/contract statuses are planning claims.
They cannot change that delivery result.

`madd verify` additionally evaluates evidence for a named fraction:

```sh
node bin/madd.js verify /path/to/clean/checkout \
  --fraction FRAC-001 --evidence /protected/results/receipt.json \
  --trust /protected/policy/madd-trust.json --json
```

It requires a clean, tracked Git candidate and fresh CI **and** independent
review receipts. Missing, failed, skipped, stale, tampered or out-of-scope
checks fail closed. This command neither runs tests nor signs receipts.

## Trust boundary: who may assert success

The caller chooses a policy **outside the candidate checkout**, from protected
CI configuration or another reviewed authority. It must not be copied from a
pull request, supplied by an untrusted contract or edited by the implementer.
Merely moving a candidate-authored file outside the checkout does not make it
trusted. The path restriction is defense in depth; policy custody is an
operational responsibility.

```json
{
  "repository": "https://github.com/example/project",
  "authors": ["implementer-identity"],
  "ci": {"identity": "protected-ci", "publicKey": "<Ed25519 public PEM>"},
  "review": {"identity": "independent-reviewer", "publicKey": "<different public PEM>"}
}
```

Identity and public keys must differ between CI and review. A declared author
cannot be the reviewer. Maintainers are responsible for accurately identifying
authors, maintaining independent key custody, rotation and revocation, and
reviewing changes to the verification tool and protected pipeline itself.
Two keys held by one author do not create independent review.

There is no key provisioning, new service or secret required for ordinary
validation. Authenticated delivery remains unavailable until those authorities
are configured. Do not give signing credentials to untrusted PR jobs. Existing
CI/review mechanisms can supply receipts in protected post-check jobs; the
candidate does not silently change GitHub branch protection or account settings.

Each envelope is `{ "payload": <object>, "signature": <base64> }`. The evidence
file has exactly `ci` and `review` envelopes. The signature is Ed25519 over
UTF-8 `canonical(payload)` exported by `src/contract.js` (recursive sorted
object keys, JSON.stringify scalars, array order retained; this is MADD's
serialization, not a claim of RFC 8785 compatibility). Payload fields are:

```json
{
  "formatVersion": "0.2.0",
  "kind": "ci",
  "issuer": "protected-ci",
  "repository": "https://github.com/example/project",
  "revision": "<exact Git commit>",
  "contractDigest": "<madd validate contractDigest>",
  "fraction": "FRAC-001",
  "requirements": ["REQ-F-001"],
  "checks": [{"id": "TEST-001", "ref": "test/acceptance.js", "result": "passed"}],
  "reference": "https://example.test/ci/run/123",
  "verdict": "passed"
}
```

For review, `kind` is `review`, `issuer` is the trusted reviewer, `reference`
points to its review and `verdict` is `approved`. It must cover the same exact
requirements/checks/specification/revision. Every listed check must be passed.
The issuer must derive that list from actual execution results, not set
everything green from the authored contract. Review of the exact candidate is
mandatory even when the checks pass.

Signatures authenticate who asserted these facts; they cannot establish test
completeness, reviewer diligence or honest key custody. Unit tests use ephemeral
keys and synthetic receipts; their success is **not** authenticated CI evidence
for this relaunch. The pilot records local results and independent review
separately, until real protected authorities exist.

## Record the retrospective without rewriting the sealed candidate

Keep execution/review receipts and the current retrospective outside the
candidate contract (CI artifacts or a later documentation change referencing
its exact commit). Changing `audit_cycle`, `retro` or a task status inside
`contract.d` changes the specification digest and requires fresh evidence.
Do not mark the sealed source "verified" after the fact or manufacture a
self-referential commit hash. Optional `retro` data inside the next cycle's
contract can summarize a previous delivered revision. Legacy adapters that
update contract statuses remain on their existing workflow until migration.

## Dependency and rollback decision

The installer previously had zero runtime dependencies. Standards-complete
validation now deliberately adds three exact direct pins and seven locked
packages; no lifecycle scripts are allowed. `npm ci --ignore-scripts`, lockfile
integrity, `npm audit` and the package-content check cover the new surface.
We chose maintained parsers over a homemade JSON Schema implementation or a
second Python runtime. This decision is limited to contract validation.

Rollback to 0.1.3 restores the legacy installer; new format contracts remain
authored files and must not be silently fed to a legacy completeness/evidence
gate. Keep the candidate schema path separate until a reviewed release freezes
the final schema and CLI compatibility notes.

References: [Ajv JSON Schema](https://ajv.js.org/json-schema.html),
[Microsoft JSON parser](https://github.com/microsoft/node-jsonc-parser).
