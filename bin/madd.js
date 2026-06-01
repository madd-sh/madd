#!/usr/bin/env node

import path from 'node:path'
import { detectAgents, AGENTS } from '../src/detect-agents.js'
import { selectAgents, confirmFileDiff, printSummary } from '../src/tui.js'
import { scaffold } from '../src/scaffold.js'
import { runDoctor } from '../src/doctor.js'
import { runDeinit, printDeinitSummary } from '../src/deinit.js'
import { writeManifest, sha1, MANIFEST_REL } from '../src/manifest.js'
import fs from 'node:fs'

const VERSION = '1.0.0'

const HELP = `
madd v${VERSION}

Usage:
  madd init [path]      Scaffold MADD into current dir or [path]
  madd deinit [path]    Remove unmodified MADD files (reads manifest)
  madd doctor [path]    Validate an existing MADD install
  madd update [path]    Update MADD files with diff + confirm per file

Options:
  --force, -f    init: overwrite existing (backup to .madd.bak/)
                 deinit: skip SHA1 check, 10s countdown before delete
  --dry-run      Show what would happen without writing anything
  --yes, -y      Skip TUI, auto-select all detected agents
  --version, -v  Print version
  --help, -h     Print this help

Supported agents: ${AGENTS.map((a) => a.key).join(', ')}
`

function parseArgs(argv) {
  const args = { command: null, targetPath: '.', force: false, dryRun: false, yes: false }
  const positional = []

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') { process.stdout.write(HELP + '\n'); process.exit(0) }
    if (arg === '--version' || arg === '-v') { process.stdout.write(VERSION + '\n'); process.exit(0) }
    if (arg === '--force' || arg === '-f') { args.force = true; continue }
    if (arg === '--dry-run') { args.dryRun = true; continue }
    if (arg === '--yes' || arg === '-y') { args.yes = true; continue }
    if (!arg.startsWith('-')) positional.push(arg)
  }

  const COMMANDS = ['init', 'deinit', 'doctor', 'update']
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
    const installed = [...summary.copied, ...summary.backed_up]
    if (installed.length > 0) {
      const files = installed.map((f) => ({
        path: f.path,
        sha1: sha1(path.join(targetPath, f.path)),
        agent: f.agent,
      }))
      writeManifest(targetPath, { maddVersion: VERSION, agents: selected, files })
      process.stdout.write(`Manifest written: ${MANIFEST_REL}\n`)
      process.stdout.write('Run `madd doctor` to validate the install.\n\n')
    }
  }
}

async function cmdDeinit(targetPath, opts) {
  const { force, dryRun } = opts
  process.stdout.write(`\nmadd deinit — ${targetPath}\n`)
  if (dryRun) process.stdout.write('[dry-run mode]\n')

  const summary = await runDeinit(targetPath, { force, dryRun })
  printDeinitSummary(summary, dryRun)
}

async function cmdUpdate(targetPath, opts) {
  const { dryRun } = opts
  const detected = await detectAgents(targetPath)
  const selected = await selectAgents(detected)

  if (selected.length === 0) { process.stdout.write('No agents selected. Exiting.\n'); process.exit(0) }

  const summary = await scaffold(
    selected, targetPath, { force: false, dryRun, update: true }, confirmFileDiff,
  )
  printSummary(summary, dryRun)
}

async function cmdDoctor(targetPath) {
  process.stdout.write(`\nmadd doctor — ${targetPath}\n\n`)
  const reports = await runDoctor(targetPath)

  let allOk = true
  for (const { agent, checks } of reports) {
    process.stdout.write(`[${agent}]\n`)
    for (const { label, ok, detail } of checks) {
      const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
      const extra = detail ? `  \x1b[2m(${detail})\x1b[0m` : ''
      process.stdout.write(`  ${icon} ${label}${extra}\n`)
      if (!ok) allOk = false
    }
    process.stdout.write('\n')
  }

  // Check manifest
  const manifestPath = path.join(targetPath, MANIFEST_REL)
  const hasManifest = fs.existsSync(manifestPath)
  process.stdout.write(`[manifest]\n`)
  process.stdout.write(`  ${hasManifest ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${MANIFEST_REL}${hasManifest ? '' : '  \x1b[2m(missing — run madd init)\x1b[0m'}\n\n`)
  if (!hasManifest) allOk = false

  process.exit(allOk ? 0 : 1)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  try {
    if (args.command === 'doctor') await cmdDoctor(args.targetPath)
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
