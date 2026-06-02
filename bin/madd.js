#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { detectAgents, AGENTS } from '../src/detect-agents.js'
import { selectAgents, confirmFileDiff, printSummary } from '../src/tui.js'
import { scaffold, expectedFiles, ensureGitignore } from '../src/scaffold.js'
import { runDoctor } from '../src/doctor.js'
import { runDeinit, printDeinitSummary } from '../src/deinit.js'
import { runStatus } from '../src/status.js'
import { writeManifest, readManifest, sha1, MANIFEST_REL } from '../src/manifest.js'
import { removeEmptyDirs } from '../src/fsutil.js'

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
  madd doctor [path]    Validate an existing MADD install

Options:
  --force, -f    init: overwrite existing (backup to .madd.bak/)
                 deinit: skip SHA1 check, 10s countdown before delete (TTY only)
  --dry-run      Show what would happen without writing anything
  --yes, -y      Skip TUI, auto-select all detected agents
  --json         Machine-readable output (status, doctor)
  --version, -v  Print version
  --help, -h     Print this help

Supported agents: ${AGENTS.map((a) => a.key).join(', ')}
`

function parseArgs(argv) {
  const args = { command: null, targetPath: '.', force: false, dryRun: false, yes: false, json: false }
  const positional = []

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') { process.stdout.write(HELP + '\n'); process.exit(0) }
    if (arg === '--version' || arg === '-v') { process.stdout.write(VERSION + '\n'); process.exit(0) }
    if (arg === '--force' || arg === '-f') { args.force = true; continue }
    if (arg === '--dry-run') { args.dryRun = true; continue }
    if (arg === '--yes' || arg === '-y') { args.yes = true; continue }
    if (arg === '--json') { args.json = true; continue }
    if (!arg.startsWith('-')) positional.push(arg)
  }

  const COMMANDS = ['init', 'status', 'update', 'deinit', 'doctor']
  if (positional.length === 0) { process.stdout.write(HELP + '\n'); process.exit(0) }

  const first = positional[0]
  if (COMMANDS.includes(first)) {
    args.command = first
    if (positional[1]) args.targetPath = positional[1]
  } else {
    process.stderr.write(`Unknown command: ${first}\n${HELP}\n`)
    process.exit(1)
  }

  args.targetPath = path.resolve(args.targetPath)
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
    .map((f) => ({ path: f.path, sha1: sha1(f.srcPath), agent: f.agent }))
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
      if (sha1(abs) === o.sha1) {
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
    process.exit(report.installed ? 0 : 1)
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
    process.exit(allOk ? 0 : 1)
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
  const args = parseArgs(process.argv.slice(2))
  try {
    if (args.command === 'doctor') await cmdDoctor(args.targetPath, args)
    else if (args.command === 'status') await cmdStatus(args.targetPath, args)
    else if (args.command === 'deinit') await cmdDeinit(args.targetPath, args)
    else if (args.command === 'update') await cmdUpdate(args.targetPath, args)
    else await cmdInit(args.targetPath, args)
  } catch (err) {
    if (err.message === 'Aborted') { process.stdout.write('\nAborted.\n'); process.exit(1) }
    process.stderr.write(`Error: ${err.message}\n`)
    process.exit(1)
  }
}

main()
