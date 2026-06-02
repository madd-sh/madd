import fs from 'node:fs'
import path from 'node:path'
import { readManifest, sha1 } from './manifest.js'

/**
 * @typedef {{ path: string, agent: string, state: 'unchanged'|'modified'|'missing' }} FileStatus
 * @typedef {{
 *   installed: boolean,
 *   manifestVersion?: string,
 *   maddVersion?: string,
 *   currentVersion?: string,
 *   upToDate?: boolean,
 *   agents?: string[],
 *   files?: FileStatus[],
 *   counts?: { unchanged: number, modified: number, missing: number }
 * }} StatusReport
 */

/**
 * @param {string} targetPath
 * @param {string} currentVersion  version of the installed @madd-sh/cli package
 * @returns {Promise<StatusReport>}
 */
export async function runStatus(targetPath, currentVersion) {
  const manifest = readManifest(targetPath)
  if (!manifest) return { installed: false }

  const files = manifest.files.map((f) => {
    const abs = path.join(targetPath, f.path)
    let state
    if (!fs.existsSync(abs)) state = 'missing'
    else state = sha1(abs) === f.sha1 ? 'unchanged' : 'modified'
    return { path: f.path, agent: f.agent, state }
  })

  return {
    installed: true,
    manifestVersion: manifest.manifestVersion,
    maddVersion: manifest.maddVersion,
    currentVersion,
    upToDate: manifest.maddVersion === currentVersion,
    agents: manifest.agents,
    files,
    counts: {
      unchanged: files.filter((f) => f.state === 'unchanged').length,
      modified: files.filter((f) => f.state === 'modified').length,
      missing: files.filter((f) => f.state === 'missing').length,
    },
  }
}
