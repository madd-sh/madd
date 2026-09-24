#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { detectAgents, AGENTS } from '../src/detect-agents.js'
import { selectAgents, confirmFileDiff, printSummary } from '../src/tui.js'
import { scaffold, expectedFiles, ensureGitignore } from '../src/scaffold.js'
import { runDoctor } from '../src/doctor.js'
import { runDeinit, printDeinitSummary } from '../src/deinit.js'
import { runStatus } from '../src/status.js'
import { writeManifest, readManifest, hashFile, MANIFEST_REL } from '../src/manifest.js'
import { removeEmptyDirs } from '../src/fsutil.js'
import { initContract, runValidate, assertLegacyTarget } from '../src/contract.js'
import { runVerify } from '../src/evidence.js'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const VERSION = pkg.version

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const HELP = `
madd v${VERSION}

Usage:
  madd init [path]      Scaffold MADD into current dir or [path]
  madd status [path]    Show install state (version, modified/missing files)
  madd update [path]    Update MADD files with diff + confirm; prune orphans
  madd deinit [path]    Remove unmodified MADD files (reads manifest)
  madd doctor [path]    Check agent installation health (not contract validity)
  madd validate [path]  Validate a 0.2 contract without installing agents
  madd verify [path]    Verify CI + independent review receipts for a clean revision

Options:
  --force, -f    init: overwrite existing (backup to .madd.bak/)
                 deinit: skip SHA1 check, 10s countdown before delete (TTY only)
  --dry-run      Show what would happen without writing anything
  --yes, -y      Skip TUI, auto-select all detected agents
  --contract-only  init: create a minimal contract without agents or hooks
  --fraction ID    validate: select a delivery fraction
  --require-bound  validate: fail if a selected check has no local file binding
  --evidence FILE   verify: signed CI and review receipts
  --trust FILE      verify: protected trust policy outside the candidate tree
  --json         Machine-readable output (status, doctor, validate)
  --version, -v  Print version
  --help, -h     Print this help

Supported agents: ${AGENTS.map((a) => a.key).join(', ')}
`

function parseArgs(argv) {
  const args = { command: null, targetPath: '.', force: false, dryRun: false, yes: false, json: false, contractOnly: false, requireBound: false }
  const positional = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { process.stdout.write(HELP + '\n'); process.exit(0) }
    if (arg === '--version' || arg === '-v') { process.stdout.write(VERSION + '\n'); process.exit(0) }
    if (arg === '--force' || arg === '-f') { args.force = true; continue }
    if (arg === '--dry-run') { args.dryRun = true; continue }
    if (arg === '--yes' || arg === '-y') { args.yes = true; continue }
    if (arg === '--json') { args.json = true; continue }
    if (arg === '--contract-only') { args.contractOnly = true; continue }
    if (arg === '--require-bound') { args.requireBound = true; continue }
    if (['--fraction', '--evidence', '--trust'].includes(arg)) {
      const value = argv[++i]
      if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value`)
      if (arg === '--fraction' && !/^FRAC-\d+$/.test(value)) throw new Error('--fraction requires FRAC-<number>')
      args[arg.slice(2)] = value; continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    if (!arg.startsWith('-')) positional.push(arg)
  }

  const COMMANDS = ['init', 'status', 'update', 'deinit', 'doctor', 'validate', 'verify']
  if (positional.length > 2) throw new Error('Expected one command and at most one path')
  if (positional.length === 0) { process.stdout.write(HELP + '\n'); process.exit(0) }

  const first = positional[0]
  if (COMMANDS.includes(first)) {
    args.command = first
    if (positional[1]) args.targetPath = positional[1]
  } else {
    throw new Error(`Unknown command: ${first}`)
  }

  args.targetPath = path.resolve(args.targetPath)
  if (args.contractOnly && args.command !== 'init') throw new Error('--contract-only is an init option')
  if ((args.fraction || args.requireBound) && !['validate', 'verify'].includes(args.command)) throw new Error('--fraction and --require-bound are validation options')
  if ((args.trust || args.evidence) && args.command !== 'verify') throw new Error('--trust and --evidence are verify options')
  return args
}

/**
 * Write the manifest from the full set of files MADD owns for `selected` agents,
 * recording each template's SHA1 (not the target file's). This is what lets
 * `deinit` distinguish a pristine MADD file from one the user has edited or
 * pre-existing files that happen to share a path.
 */
function recordManifest(targetPath, selected) {
  const files = expectedFiles(selected)
    .filter((f) => fs.existsSync(path.join(targetPath, f.path)))
    .map((f) => ({ path: f.path, sha256: hashFile(f.srcPath), agent: f.agent }))
  writeManifest(targetPath, {
    maddVersion: VERSION,
    installedAt: new Date().toISOString(),
    agents: selected,
    files,
  })
  return files.length
}

async function cmdInit(targetPath, opts) {
  const { force, dryRun, yes } = opts

  if (opts.contractOnly) {
    if (force) throw new Error('Contract init never overwrites existing specifications')
    const result = initContract(targetPath, { dryRun })
    process.stdout.write(`${result.created ? 'Created' : 'Would create'} five contract files, no agent installation.\nRun madd validate, then bind your acceptance check.\n`)
    return
  }
  assertLegacyTarget(targetPath)

  process.stdout.write(`\nmadd v${VERSION}\n`)
  process.stdout.write(`Target: ${targetPath}\n`)
  if (dryRun) process.stdout.write('[dry-run mode]\n')

  const detected = await detectAgents(targetPath)
  const detectedNames = AGENTS.filter((a) => detected[a.key]).map((a) => a.label)
  if (detectedNames.length > 0) process.stdout.write(`Detected: ${detectedNames.join(', ')}\n`)

  let selected
  if (yes || !process.stdin.isTTY) {
    selected = await selectAgents(detected)
    process.stdout.write(`Auto-selecting: ${selected.join(', ')}\n`)
  } else {
    selected = await selectAgents(detected)
  }

  if (selected.length === 0) { process.stdout.write('No agents selected. Exiting.\n'); process.exit(0) }

  const summary = await scaffold(selected, targetPath, { force, dryRun })
  printSummary(summary, dryRun)

  if (!dryRun) {
    const count = recordManifest(targetPath, selected)
    process.stdout.write(`Manifest written: ${MANIFEST_REL} (${count} files tracked)\n`)
    if (ensureGitignore(targetPath, '.madd.bak/')) {
      process.stdout.write(`Added .madd.bak/ to .gitignore\n`)
    }
    process.stdout.write('Run `madd doctor` to validate the install.\n\n')
  }
}

async function cmdUpdate(targetPath, opts) {
  assertLegacyTarget(targetPath)
  const { dryRun } = opts
  const manifestBefore = readManifest(targetPath)

  // Operate on the agents already installed (per manifest); fall back to detection.
  let selected
  if (manifestBefore && manifestBefore.agents.length) {
    selected = manifestBefore.agents
  } else {
    const detected = await detectAgents(targetPath)
    selected = await selectAgents(detected)
  }
  if (selected.length === 0) { process.stdout.write('No agents selected. Exiting.\n'); process.exit(0) }

  const summary = await scaffold(
    selected, targetPath, { force: false, dryRun, update: true }, confirmFileDiff,
  )
  printSummary(summary, dryRun)

  // Prune orphans: files tracked by the old manifest that no longer exist as
  // templates in the current package version. Only pristine ones are removed.
  if (manifestBefore) {
    const expected = new Set(expectedFiles(selected).map((f) => f.path))
    const orphans = manifestBefore.files.filter((f) => !expected.has(f.path))
    for (const o of orphans) {
      const abs = path.join(targetPath, o.path)
      if (!fs.existsSync(abs)) continue
      if (hashFile(abs) === o.sha256) {
        if (!dryRun) { fs.unlinkSync(abs); removeEmptyDirs(path.dirname(abs), targetPath) }
        process.stdout.write(`  ${RED}-${RESET} orphan removed: ${o.path}\n`)
      } else {
        process.stdout.write(`  ${DIM}=${RESET} orphan kept (modified): ${o.path}\n`)
      }
    }
  }

  if (!dryRun) recordManifest(targetPath, selected)
}

async function cmdDeinit(targetPath, opts) {
  const { force, dryRun } = opts
  process.stdout.write(`\nmadd deinit — ${targetPath}\n`)
  if (dryRun) process.stdout.write('[dry-run mode]\n')

  const summary = await runDeinit(targetPath, { force, dryRun })
  printDeinitSummary(summary, dryRun)
}

async function cmdStatus(targetPath, opts) {
  const report = await runStatus(targetPath, VERSION)

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    process.exitCode = report.installed ? 0 : 1
    return
  }

  if (!report.installed) {
    process.stdout.write('\nMADD is not installed here (no manifest). Run `madd init`.\n')
    process.exit(1)
  }

  const versionLine = report.upToDate
    ? `${GREEN}${report.maddVersion}${RESET} (up to date)`
    : `${YELLOW}${report.maddVersion}${RESET} installed, ${GREEN}${report.currentVersion}${RESET} available`
  process.stdout.write(`\nmadd status — ${targetPath}\n`)
  process.stdout.write(`Version: ${versionLine}\n`)
  process.stdout.write(`Agents:  ${report.agents.join(', ')}\n\n`)

  for (const f of report.files.filter((f) => f.state === 'modified')) {
    process.stdout.write(`  ${YELLOW}M${RESET} ${f.path}\n`)
  }
  for (const f of report.files.filter((f) => f.state === 'missing')) {
    process.stdout.write(`  ${RED}!${RESET} ${f.path} ${DIM}(missing)${RESET}\n`)
  }

  const { unchanged, modified, missing } = report.counts
  process.stdout.write(
    `\n${GREEN}${unchanged}${RESET} unchanged  ${YELLOW}${modified}${RESET} modified  ${RED}${missing}${RESET} missing\n`,
  )
  process.exit(0)
}

async function cmdDoctor(targetPath, opts) {
  const reports = await runDoctor(targetPath)
  const manifestPath = path.join(targetPath, MANIFEST_REL)
  const hasManifest = fs.existsSync(manifestPath)
  reports.push({
    agent: 'manifest',
    checks: [{ label: MANIFEST_REL, ok: hasManifest, detail: hasManifest ? undefined : 'missing — run madd init' }],
  })
  const allOk = reports.every((r) => r.checks.every((c) => c.ok))

  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: allOk, reports }, null, 2) + '\n')
    process.exitCode = allOk ? 0 : 1
    return
  }

  process.stdout.write(`\nmadd doctor — ${targetPath}\n\n`)
  for (const { agent, checks } of reports) {
    process.stdout.write(`[${agent}]\n`)
    for (const { label, ok, detail } of checks) {
      const icon = ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
      const extra = detail ? `  ${DIM}(${detail})${RESET}` : ''
      process.stdout.write(`  ${icon} ${label}${extra}\n`)
    }
    process.stdout.write('\n')
  }
  process.exit(allOk ? 0 : 1)
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
    if (['validate', 'verify'].includes(args.command)) {
      const report = args.command === 'verify' ? runVerify(args.targetPath, args) : runValidate(args.targetPath, args)
      process.stdout.write(args.json ? JSON.stringify(report, null, 2) + '\n' : `Contract valid; checks ${report.checksBound ? 'bound' : 'planned'}; delivery ${report.delivered ? 'verified against trusted receipts' : 'not verified'}.\n`)
      return
    }
    if (args.command === 'doctor') await cmdDoctor(args.targetPath, args)
    else if (args.command === 'status') await cmdStatus(args.targetPath, args)
    else if (args.command === 'deinit') await cmdDeinit(args.targetPath, args)
    else if (args.command === 'update') await cmdUpdate(args.targetPath, args)
    else await cmdInit(args.targetPath, args)
  } catch (err) {
    process.exitCode = 1
    if (args?.json || process.argv.includes('--json')) { process.stdout.write(JSON.stringify({ ok: false, delivered: false, error: err.message }) + '\n'); return }
    if (err.message === 'Aborted') { process.stdout.write('\nAborted.\n'); return }
    process.stderr.write(`Error: ${err.message}\n`)
  }
}

main()
