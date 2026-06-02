import fs from 'node:fs'
import path from 'node:path'
import { readManifest, writeManifest, hashFile, MANIFEST_REL, MANIFEST_VERSION } from './manifest.js'
import { removeEmptyDirs } from './fsutil.js'

const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

async function countdown(seconds) {
  return new Promise((resolve) => {
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

  // A manifest written by an older format records hashes we can no longer verify;
  // every file would look "modified" and be kept. Fail safe and tell the user.
  if (manifest.manifestVersion !== MANIFEST_VERSION) {
    process.stderr.write(
      `Manifest format is v${manifest.manifestVersion || '?'}, this CLI expects v${MANIFEST_VERSION}.\n` +
      `Re-run \`madd init\` to regenerate it before deinit.\n`,
    )
    process.exit(1)
  }

  // --force skips per-file SHA1 verification. In an interactive terminal we give
  // a 10s Ctrl-C window; in non-TTY (CI) the explicit --force is taken at face value.
  if (force && !dryRun) {
    if (process.stdin.isTTY) await countdown(10)
    else process.stdout.write(`${DIM}(non-interactive: --force applied without countdown)${RESET}\n`)
  }

  for (const file of manifest.files) {
    const absPath = path.join(targetPath, file.path)

    if (!fs.existsSync(absPath)) {
      summary.missing.push(file.path)
      continue
    }

    if (!force) {
      const current = hashFile(absPath)
      if (current !== file.sha256) {
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
    if (summary.skipped.length === 0) {
      // Full uninstall: nothing left to track.
      if (fs.existsSync(manifestAbs)) {
        fs.unlinkSync(manifestAbs)
        removeEmptyDirs(path.dirname(manifestAbs), targetPath)
      }
    } else {
      // Partial: some modified files were kept — keep tracking only those.
      const kept = new Set(summary.skipped)
      writeManifest(targetPath, {
        maddVersion: manifest.maddVersion,
        installedAt: manifest.installedAt,
        agents: manifest.agents,
        files: manifest.files.filter((f) => kept.has(f.path)),
      })
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
