import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const MANIFEST_REL = '.madd/manifest.yaml'
export const MANIFEST_VERSION = '2'

/**
 * SHA-256 of a file's contents, hex-encoded.
 * SHA-256 (not SHA-1) because this hash is an integrity control: deinit trusts
 * it to decide what is safe to delete, so it must be collision-resistant.
 * @param {string} filePath
 * @returns {string}
 */
export function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

/**
 * @param {string} targetPath
 * @param {{ maddVersion: string, installedAt: string, agents: string[], files: Array<{path: string, sha256: string, agent: string}> }} data
 */
export function writeManifest(targetPath, { maddVersion, installedAt, agents, files }) {
  const lines = [
    `manifestVersion: "${MANIFEST_VERSION}"`,
    `maddVersion: "${maddVersion}"`,
    `installedAt: "${installedAt}"`,
    `agents:`,
    ...agents.map((a) => `  - ${a}`),
    `files:`,
    ...files.map((f) => `  - path: ${f.path}\n    sha256: ${f.sha256}\n    agent: ${f.agent}`),
    '',
  ]
  const dest = path.join(targetPath, MANIFEST_REL)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, lines.join('\n'))
}

/**
 * @param {string} targetPath
 * @returns {{ manifestVersion: string, maddVersion: string, installedAt: string, agents: string[], files: Array<{path: string, sha256: string, agent: string}> } | null}
 */
export function readManifest(targetPath) {
  const src = path.join(targetPath, MANIFEST_REL)
  if (!fs.existsSync(src)) return null

  const lines = fs.readFileSync(src, 'utf8').split('\n')
  const result = { manifestVersion: '', maddVersion: '', installedAt: '', agents: [], files: [] }
  let section = null
  let current = null
  const unquote = (s) => s.trim().replace(/^"|"$/g, '')

  for (const line of lines) {
    if (line.startsWith('manifestVersion:')) {
      result.manifestVersion = unquote(line.slice('manifestVersion:'.length))
    } else if (line.startsWith('maddVersion:')) {
      result.maddVersion = unquote(line.slice('maddVersion:'.length))
    } else if (line.startsWith('installedAt:')) {
      result.installedAt = unquote(line.slice('installedAt:'.length))
    } else if (line === 'agents:') {
      section = 'agents'
    } else if (line === 'files:') {
      if (current) result.files.push(current)
      current = null
      section = 'files'
    } else if (section === 'agents' && line.startsWith('  - ')) {
      result.agents.push(line.slice(4).trim())
    } else if (section === 'files' && line.startsWith('  - path:')) {
      if (current) result.files.push(current)
      current = { path: line.slice('  - path:'.length).trim(), sha256: '', agent: '' }
    } else if (section === 'files' && line.startsWith('    sha256:')) {
      if (current) current.sha256 = line.slice('    sha256:'.length).trim()
    } else if (section === 'files' && line.startsWith('    agent:')) {
      if (current) current.agent = line.slice('    agent:'.length).trim()
    }
  }
  if (current) result.files.push(current)

  return result
}
