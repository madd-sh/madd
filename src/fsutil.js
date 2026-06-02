import fs from 'node:fs'
import path from 'node:path'

/**
 * Remove `dir` and its now-empty parents, walking up until `stopAt` (exclusive).
 * Silently no-ops on non-empty dirs or errors.
 * @param {string} dir
 * @param {string} stopAt
 */
export function removeEmptyDirs(dir, stopAt) {
  if (path.resolve(dir) === path.resolve(stopAt)) return
  try {
    if (fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir)
      removeEmptyDirs(path.dirname(dir), stopAt)
    }
  } catch {}
}
