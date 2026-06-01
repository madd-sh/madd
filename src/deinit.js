import fs from 'node:fs'
import path from 'node:path'
import { readManifest, sha1, MANIFEST_REL } from './manifest.js'

const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function removeEmptyDirs(dir, stopAt) {
  if (path.resolve(dir) === path.resolve(stopAt)) return
  try {
    if (fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir)
      removeEmptyDirs(path.dirname(dir), stopAt)
    }
  } catch {}
}

async function countdown(seconds) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n${BOLD}${RED}Warning:${RESET} all MADD files will be removed without SHA1 check.\n`)
    process.stdout.write(`Press Ctrl-C to abort. Continuing in `)

    const handler = () => {
      process.stdout.write('\nAborted.\n')
      process.exit(0)
    }
    process.on('SIGINT', handler)

    let remaining = seconds
    const tick = setInterval(() => {
      process.stdout.write(`${remaining}... `)
      remaining--
      if (remaining < 0) {
        clearInterval(tick)
        process.removeListener('SIGINT', handler)
        process.stdout.write('\n')
        resolve()
      }
    }, 1000)
  })
}

/**
 * @param {string} targetPath
 * @param {{ force?: boolean, dryRun?: boolean }} opts
 * @returns {Promise<{ removed: string[], skipped: string[], missing: string[] }>}
 */
export async function runDeinit(targetPath, opts) {
  const { force = false, dryRun = false } = opts
  const summary = { removed: [], skipped: [], missing: [] }

  const manifest = readManifest(targetPath)
  if (!manifest) {
    process.stderr.write(`No manifest found (${MANIFEST_REL}). Run \`madd init\` first.\n`)
    process.exit(1)
  }

  if (force && !dryRun) await countdown(10)

  for (const file of manifest.files) {
    const absPath = path.join(targetPath, file.path)

    if (!fs.existsSync(absPath)) {
      summary.missing.push(file.path)
      continue
    }

    if (!force) {
      const current = sha1(absPath)
      if (current !== file.sha1) {
        summary.skipped.push(file.path)
        continue
      }
    }

    if (!dryRun) {
      fs.unlinkSync(absPath)
      removeEmptyDirs(path.dirname(absPath), targetPath)
    }
    summary.removed.push(file.path)
  }

  if (!dryRun) {
    const manifestAbs = path.join(targetPath, MANIFEST_REL)
    if (fs.existsSync(manifestAbs)) {
      fs.unlinkSync(manifestAbs)
      removeEmptyDirs(path.dirname(manifestAbs), targetPath)
    }
  }

  return summary
}

export function printDeinitSummary(summary, dryRun = false) {
  const prefix = dryRun ? `${DIM}[dry-run]${RESET} ` : ''
  process.stdout.write('\n')
  for (const f of summary.removed) process.stdout.write(`  ${RED}-${RESET} ${prefix}${f}\n`)
  for (const f of summary.skipped) process.stdout.write(`  ${DIM}=${RESET} ${f} ${DIM}(modified, kept)${RESET}\n`)
  for (const f of summary.missing) process.stdout.write(`  ${DIM}?${RESET} ${f} ${DIM}(already missing)${RESET}\n`)
  process.stdout.write('\n')
  const action = dryRun ? 'Would remove' : 'Removed'
  process.stdout.write(`${action}: ${RED}${summary.removed.length}${RESET}  Kept: ${DIM}${summary.skipped.length}${RESET}\n`)
}
