# MADD relaunch pilot — execution record

Baseline: `063e420a888b6fc0749d77787577657478b6db8a` (CLI 0.1.3).
Branch: `feat/madd-relaunch-contracts`. Candidate: 0.2.0-rc.1.
Source specification: `.madd/contract.d/`; task aliases preserve M01–M04/M10.

## Fractions and responsibility

| Fraction | Scope | Maker | Independent checks | Breaker |
|---|---|---|---|---|
| FRAC-001 | M01–M03: templates, format, validation | Root implementation context | Separate CI validation context | Separate read-only review context |
| FRAC-002 | M04/M10: evidence verifier and release controls | Root implementation context | Package install from actual tarball and test suite | Same independent read-only context, no implementation edits |

The website has a separate maker and review. A new context reduces shared
implementation assumptions; it does not establish cryptographic CI authority
or guarantee independent human judgment. The user authorized this multi-agent
pilot. The full legacy agent harness was not installed into LilyPad.

## Observations during implementation

- Baseline template defects reproduced: seven invalid optional null values and
  a broken relative schema link. Removed unknown values instead of inventing
  defaults. All five adapter scaffold assemblies now validate against the
  legacy schema.
- The first format compile failed because an internal fragment schema used a
  nonempty `$id` anchor. Corrected to a distinct valid schema URI; schema
  references are still bundled and never fetched.
- Contract tests demonstrate that authored `verified` and `done` fields never
  produce `delivered: true`; unselected future checks stay pending.
- Full-suite first run: 17/18 passed. The remaining assertion enforced the old
  zero-dependency policy. Replaced it explicitly with an allowlist of three
  exact direct validation dependencies, SHA-512 lock integrity and no lifecycle
  scripts; the decision is documented in `contracts.md`.
- The independent reviewer identified that a tracked directory does not prove
  each loaded contract fragment is tracked. The reproduction failed before correction; exact HEAD blob comparison and
  per-fragment tracking now reject ignored fragments and assume-unchanged /
  skip-worktree concealment.

## Release boundary

Local checks, a separate agent review and ephemeral signature-test keys are
not authenticated CI/review receipts for this candidate. Keep the release
unverified until remote checks and the configured independent authority exist.
No tag, npm publication or production signing key is created by this pilot.
The site may truthfully document a candidate without claiming it is released.

Final results and unresolved limitations will be recorded after review.

## Corrective loop — first independent review

Four material findings were reproduced and fixed before acceptance:

1. Source bytes and every loaded fragment now match HEAD even when Git index
   flags hide modifications from status.
2. Adapter init/update discovers versioned metadata in all JSON fragments;
   renaming 00-meta to 01-meta no longer corrupts a contract.
3. Objective, risk, workflow, rule, decision and endpoint IDs participate in
   global uniqueness checks, alongside requirements/tasks/checks.
4. Error JSON drains before process exit; a 2,000-invalid-requirement fixture
   remains fully parseable when piped. Malformed options also return JSON.

The initial new regressions failed 3/8 before correction; the corrective
focused suite passes 9/9. This is local execution evidence, pending the
independent review of the delta and final packaged validation.

## Corrective review verdict

Independent reviewer: APPROVED after the corrective delta. Its separate probe
confirmed that `git replace` could previously substitute another tree behind
a signed revision; `--no-replace-objects` now prevents that substitution. An
empty-ID regression was also corrected. Focused tests: 9/9 passing. Review
limits: code and synthetic local fixtures, no production authority or remote
CI evidence.

GitHub read-only inspection on 2026-09-24 returned no classic branch protection
for CLI main and no active branch rules for either MADD repository. The
protection described in RELEASING.md is a setup requirement, not an observed
active control. This pilot does not silently change repository governance.

Learning: the original plan supplied intent/acceptance before implementation,
but the executable JSON pilot contract was materialized after the first code
prototype. For Qareen, author and validate that artifact before the first
implementation fraction. Keep runtime evidence/retro outside a sealed
candidate to avoid invalidating its digest with status bookkeeping.
