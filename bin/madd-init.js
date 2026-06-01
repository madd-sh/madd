#!/usr/bin/env node

import path from 'node:path'
import { detectAgents, AGENTS } from '../src/detect-agents.js'
import { selectAgents, confirmFileDiff, printSummary } from '../src/tui.js'
import { scaffold } from '../src/scaffold.js'
import { runDoctor } from '../src/doctor.js'

const VERSION = '1.0.0'

const HELP = `
madd-init v${VERSION}

Install MADD (Multi-Agent Driven Development) into your project.

Usage:
  madd-init [path]                     Init in current dir or [path]
  madd-init doctor [path]              Validate an existing MADD install
  madd-init update [path]              Update MADD files with diff + confirm

Options:
  --force, -f    Overwrite existing files (backs up first into .madd.bak/)
  --dry-run      Show what would be copied without writing
  --yes, -y      Skip TUI, auto-select all detected agents
  --version, -v  Print version
  --help, -h     Print this help

Supported agents: ${AGENTS.map((a) => a.key).join(', ')}
`

function parseArgs(argv) {
  const args = {
    command: 'init',
    targetPath: '.',
    force: false,
    dryRun: false,
    yes: false,
  }
  const positional = []

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') { process.stdout.write(HELP + '\n'); process.exit(0) }
    if (arg === '--version' || arg === '-v') { process.stdout.write(VERSION + '\n'); process.exit(0) }
    if (arg === '--force' || arg === '-f') { args.force = true; continue }
    if (arg === '--dry-run') { args.dryRun = true; continue }
    if (arg === '--yes' || arg === '-y') { args.yes = true; continue }
    if (!arg.startsWith('-')) positional.push(arg)
  }

  if (positional.length > 0) {
    const first = positional[0]
    if (first === 'doctor' || first === 'update' || first === 'init') {
      args.command = first
      if (positional[1]) args.targetPath = positional[1]
    } else {
      args.targetPath = first
    }
  }

  args.targetPath = path.resolve(args.targetPath)
  return args
}

async function cmdInit(targetPath, opts) {
  const { force, dryRun, yes } = opts

  process.stdout.write(`\nmadd-init v${VERSION}\n`)
  process.stdout.write(`Target: ${targetPath}\n`)
  if (dryRun) process.stdout.write('[dry-run mode]\n')

  const detected = await detectAgents(targetPath)
  const detectedNames = AGENTS.filter((a) => detected[a.key]).map((a) => a.label)
  if (detectedNames.length > 0) {
    process.stdout.write(`Detected: ${detectedNames.join(', ')}\n`)
  }

  let selected
  if (yes || !process.stdin.isTTY) {
    selected = await selectAgents(detected)
    process.stdout.write(`Auto-selecting: ${selected.join(', ')}\n`)
  } else {
    selected = await selectAgents(detected)
  }

  if (selected.length === 0) {
    process.stdout.write('No agents selected. Exiting.\n')
    process.exit(0)
  }

  const summary = await scaffold(selected, targetPath, { force, dryRun })
  printSummary(summary, dryRun)

  if (!dryRun && (summary.copied.length > 0 || summary.backed_up.length > 0)) {
    process.stdout.write('Run `madd-init doctor` to validate the install.\n\n')
  }
}

async function cmdUpdate(targetPath, opts) {
  const { dryRun } = opts
  const detected = await detectAgents(targetPath)
  const selected = await selectAgents(detected)

  if (selected.length === 0) {
    process.stdout.write('No agents selected. Exiting.\n')
    process.exit(0)
  }

  const summary = await scaffold(
    selected,
    targetPath,
    { force: false, dryRun, update: true },
    confirmFileDiff,
  )
  printSummary(summary, dryRun)
}

async function cmdDoctor(targetPath) {
  process.stdout.write(`\nmadd-init doctor — ${targetPath}\n\n`)
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

  process.exit(allOk ? 0 : 1)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  try {
    if (args.command === 'doctor') await cmdDoctor(args.targetPath)
    else if (args.command === 'update') await cmdUpdate(args.targetPath, args)
    else await cmdInit(args.targetPath, args)
  } catch (err) {
    if (err.message === 'Aborted') {
      process.stdout.write('\nAborted.\n')
      process.exit(1)
    }
    process.stderr.write(`Error: ${err.message}\n`)
    process.exit(1)
  }
}

main()
