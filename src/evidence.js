import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { canonical, parseJson, runValidate, readJsonFile, localFile, MAX_BYTES } from './contract.js'

function exactKeys(value, keys, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).sort().join() !== [...keys].sort().join()) throw new Error(`Invalid ${label} fields`)
}

/** The policy must come from a protected CI configuration, outside the candidate tree. */
export function loadTrust(root, filename) {
  const base = fs.realpathSync(root), actual = fs.realpathSync(filename)
  if (actual === base || actual.startsWith(base + path.sep)) throw new Error('Trust policy must be outside the candidate tree')
  const stat = fs.lstatSync(filename)
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) throw new Error('Trust policy must be a bounded regular file')
  const policy = parseJson(fs.readFileSync(actual, 'utf8'))
  exactKeys(policy, ['repository', 'authors', 'ci', 'review'], 'trust policy')
  if (!/^https:\/\/[^\s]+$/.test(policy.repository) || !Array.isArray(policy.authors) || !policy.authors.length || policy.authors.some(id => typeof id !== 'string' || !id)) throw new Error('Invalid repository or authors in trust policy')
  for (const kind of ['ci', 'review']) {
    exactKeys(policy[kind], ['identity', 'publicKey'], `${kind} authority`)
    if (typeof policy[kind].identity !== 'string' || !policy[kind].identity) throw new Error('Missing authority identity')
    policy[kind].key = crypto.createPublicKey(policy[kind].publicKey)
    if (policy[kind].key.asymmetricKeyType !== 'ed25519') throw new Error('Evidence authority must use Ed25519')
  }
  const keyBytes = key => key.export({ type: 'spki', format: 'der' }).toString('base64')
  if (policy.review.identity === policy.ci.identity || policy.authors.includes(policy.review.identity) || keyBytes(policy.ci.key) === keyBytes(policy.review.key)) throw new Error('Review authority must be independent of the authors and CI')
  return policy
}

/** Verify signed data. No command in a contract or receipt is ever executed. */
export function verifyEvidence(report, evidence, policy, revision) {
  exactKeys(evidence, ['ci', 'review'], 'evidence')
  if (!report.checksBound || !report.fraction || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(revision)) throw new Error('Evidence requires a bound fraction and exact source revision')
  const required = [...report.requirements].sort()
  const expectedChecks = report.checks.map(check => ({ id: check.id, ref: check.ref, result: 'passed' })).sort((a, b) => a.id.localeCompare(b.id))
  const references = {}
  for (const kind of ['ci', 'review']) {
    const envelope = evidence[kind], authority = policy[kind]
    exactKeys(envelope, ['payload', 'signature'], `${kind} envelope`)
    const payload = envelope.payload
    exactKeys(payload, ['formatVersion', 'kind', 'issuer', 'repository', 'revision', 'contractDigest', 'fraction', 'requirements', 'checks', 'reference', 'verdict'], `${kind} receipt`)
    if (typeof envelope.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature) || !crypto.verify(null, Buffer.from(canonical(payload)), authority.key, Buffer.from(envelope.signature, 'base64'))) throw new Error(`Invalid ${kind} signature`)
    if (payload.formatVersion !== '0.2.0' || payload.kind !== kind || payload.issuer !== authority.identity || payload.repository !== policy.repository) throw new Error(`Wrong ${kind} authority or repository`)
    if (payload.revision !== revision || payload.contractDigest !== report.contractDigest || payload.fraction !== report.fraction) throw new Error(`Stale or out-of-scope ${kind} evidence`)
    if (!Array.isArray(payload.requirements) || canonical([...payload.requirements].sort()) !== canonical(required)) throw new Error(`Incorrect ${kind} requirement scope`)
    if (!Array.isArray(payload.checks) || canonical([...payload.checks].sort((a, b) => String(a.id).localeCompare(String(b.id)))) !== canonical(expectedChecks)) throw new Error(`Missing, failed or skipped ${kind} checks`)
    if (typeof payload.reference !== 'string' || !/^https:\/\/[^\s]+$/.test(payload.reference) || payload.verdict !== (kind === 'ci' ? 'passed' : 'approved')) throw new Error(`Invalid ${kind} outcome/reference`)
    references[kind] = payload.reference
  }
  return { ...report, delivered: true, repository: policy.repository, revision, evidence: references }
}

export function runVerify(root, { fraction, evidence, trust }) {
  if (!fraction || !evidence || !trust) throw new Error('verify requires --fraction, --evidence and --trust')
  const report = runValidate(root, { fraction, requireBound: true })
  const git = (...args) => execFileSync('git', ['--no-replace-objects', '--no-optional-locks', '-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: MAX_BYTES }).trim()
  if (fs.realpathSync(root) !== fs.realpathSync(git('rev-parse', '--show-toplevel'))) throw new Error('verify requires the repository root')
  if (git('status', '--porcelain', '--untracked-files=all')) throw new Error('Evidence requires a clean candidate checkout')
  const revision = git('rev-parse', 'HEAD')
  // Git status honors assume-unchanged/skip-worktree. Prove the actual bytes
  // against the commit's tree without mutating the index or following filters.
  const objectFormat = git('rev-parse', '--show-object-format')
  if (!['sha1', 'sha256'].includes(objectFormat)) throw new Error('Unsupported Git object format')
  const tracked = new Set()
  for (const entry of git('ls-tree', '-rz', '--full-tree', 'HEAD').split('\0').filter(Boolean)) {
    const tab = entry.indexOf('\t')
    const [mode, type, objectId] = entry.slice(0, tab).split(' ')
    const ref = entry.slice(tab + 1)
    if (type !== 'blob') throw new Error(`Cannot verify a nested repository against HEAD: ${ref}`)
    tracked.add(ref)
    const file = path.join(root, ref)
    let data
    if (mode === '120000') {
      // Compare the link text, never the external target it may point to.
      if (!fs.lstatSync(file).isSymbolicLink()) throw new Error(`Source differs from HEAD: ${ref}`)
      data = Buffer.from(fs.readlinkSync(file))
    } else {
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Source differs from HEAD: ${ref}`)
      if (process.platform !== 'win32' && Boolean(stat.mode & 0o111) !== (mode === '100755')) throw new Error(`Source mode differs from HEAD: ${ref}`)
      data = fs.readFileSync(localFile(root, ref))
    }
    const actual = crypto.createHash(objectFormat).update(`blob ${data.length}\0`).update(data).digest('hex')
    if (actual !== objectId) throw new Error(`Source differs from HEAD: ${ref}`)
  }
  const files = fs.readdirSync(path.join(root, '.madd/contract.d')).map(name => `.madd/contract.d/${name}`)
  files.push(...report.checks.map(c => c.ref))
  for (const ref of files) if (!tracked.has(ref)) throw new Error(`Evidence target is not tracked in HEAD: ${ref}`)
  const policy = loadTrust(root, trust)
  const evidencePath = path.resolve(evidence)
  const receipt = readJsonFile(path.dirname(evidencePath), path.basename(evidencePath))
  return verifyEvidence(report, receipt, policy, revision)
}
