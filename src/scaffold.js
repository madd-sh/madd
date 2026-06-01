import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AGENTS_DIR = path.join(__dirname, '..', 'agents')

const SKIP_DIRS = new Set(['node_modules', '.git'])

function walkDir(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkDir(full, callback)
    else callback(full)
  }
}

// Returns Map<relPath, srcAbsPath>. Per-agent files override shared ones on same relPath.
function collectFiles(agents) {
  const files = new Map()
  const sharedDir = path.join(AGENTS_DIR, 'shared')
  if (fs.existsSync(sharedDir)) {
    walkDir(sharedDir, (abs) => files.set(path.relative(sharedDir, abs), abs))
  }
  for (const key of agents) {
    const agentDir = path.join(AGENTS_DIR, key)
    if (fs.existsSync(agentDir)) {
      walkDir(agentDir, (abs) => files.set(path.relative(agentDir, abs), abs))
    }
  }
  return files
}

/**
 * @param {string} srcPath
 * @param {string} destPath
 * @returns {string} unified diff (diff -u) or empty string if identical
 */
export function diffFiles(srcPath, destPath) {
  if (!fs.existsSync(destPath)) return ''
  try {
    execSync(`diff -u "${destPath}" "${srcPath}"`, { stdio: 'pipe' })
    return '' // exit 0 = identical
  } catch (err) {
    // diff exits 1 when files differ — stdout contains the diff
    return err.stdout?.toString() ?? ''
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  if (dest.endsWith('.sh')) fs.chmodSync(dest, 0o755)
}

/**
 * @param {string[]} agents
 * @param {string} targetPath
 * @param {{ force?: boolean, dryRun?: boolean, update?: boolean }} opts
 * @param {((relPath: string, diff: string) => Promise<boolean>) | null} confirmFn
 * @returns {Promise<{ copied: string[], skipped: string[], backed_up: string[] }>}
 */
export async function scaffold(agents, targetPath, opts, confirmFn = null) {
  const { force = false, dryRun = false, update = false } = opts
  const summary = { copied: [], skipped: [], backed_up: [] }
  const files = collectFiles(agents)

  for (const [relPath, srcPath] of files) {
    const destPath = path.join(targetPath, relPath)
    const exists = fs.existsSync(destPath)

    if (!exists) {
      if (!dryRun) copyFile(srcPath, destPath)
      summary.copied.push(relPath)
      continue
    }

    if (force) {
      if (!dryRun) {
        const backupPath = path.join(targetPath, '.madd.bak', relPath)
        copyFile(destPath, backupPath)
        copyFile(srcPath, destPath)
      }
      summary.backed_up.push(relPath)
      continue
    }

    if (update && confirmFn) {
      const diff = diffFiles(srcPath, destPath)
      if (!diff) { summary.skipped.push(relPath); continue }
      const confirmed = await confirmFn(relPath, diff)
      if (confirmed) {
        if (!dryRun) copyFile(srcPath, destPath)
        summary.copied.push(relPath)
      } else {
        summary.skipped.push(relPath)
      }
      continue
    }

    summary.skipped.push(relPath)
  }

  return summary
}
