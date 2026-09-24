import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { canonical, initContract, loadContract, validateContract } from '../src/contract.js'
import { loadTrust, verifyEvidence, runVerify } from '../src/evidence.js'

test('only fresh signed CI plus independent review can satisfy the selected fraction', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'madd-evidence-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const candidate = path.join(root, 'candidate'); fs.mkdirSync(candidate); initContract(candidate)
  fs.writeFileSync(path.join(candidate, 'check.js'), '// tracked acceptance target')
  const contract = loadContract(candidate)
  Object.assign(contract.tasks.tests[0], { binding: 'bound', ref: 'check.js' })
  contract.audit_cycle = { current_iteration: 0, max_iterations: 3, status: 'pending', history: [], recommendations: [], fractions: [{ id: 'FRAC-001', tasks: ['TASK-001'], requirements: ['REQ-F-001'], status: 'pending' }] }
  const report = validateContract(contract, { root: candidate, fraction: 'FRAC-001', requireBound: true })
  const keys = { ci: crypto.generateKeyPairSync('ed25519'), review: crypto.generateKeyPairSync('ed25519') }
  const policy = { repository: 'https://github.com/example/project', authors: ['maker'], ci: { identity: 'protected-ci', publicKey: keys.ci.publicKey.export({ type: 'spki', format: 'pem' }) }, review: { identity: 'reviewer', publicKey: keys.review.publicKey.export({ type: 'spki', format: 'pem' }) } }
  const trustFile = path.join(root, 'protected-policy.json')
  fs.writeFileSync(trustFile, JSON.stringify(policy))
  const trusted = loadTrust(candidate, trustFile), revision = 'a'.repeat(40)
  const evidence = {}
  function sign(kind, payload) {
    return { payload, signature: crypto.sign(null, Buffer.from(canonical(payload)), keys[kind].privateKey).toString('base64') }
  }
  for (const kind of ['ci', 'review']) evidence[kind] = sign(kind, { formatVersion: '0.2.0', kind, issuer: policy[kind].identity, repository: policy.repository, revision, contractDigest: report.contractDigest, fraction: 'FRAC-001', requirements: report.requirements, checks: [{ id: 'TEST-001', ref: 'check.js', result: 'passed' }], reference: `https://example.test/${kind}/123`, verdict: kind === 'ci' ? 'passed' : 'approved' })
  assert.equal(verifyEvidence(report, evidence, trusted, revision).delivered, true)
  assert.equal(report.delivered, false, 'the structural validation result remains distinct')
  assert.throws(() => verifyEvidence(report, evidence, trusted, 'b'.repeat(40)), /Stale/)
  assert.throws(() => verifyEvidence({ ...report, contractDigest: 'changed' }, evidence, trusted, revision), /Stale/)
  assert.throws(() => verifyEvidence(report, { ci: evidence.ci }, trusted, revision), /fields/)
  const mutations = [
    p => { p.checks[0].result = 'skipped' }, p => { p.checks[0].result = 'failed' },
    p => { p.checks = [] }, p => { p.requirements = [] },
    p => { p.requirements.push('REQ-F-999') }, p => { p.checks[0].ref = 'unrelated.js' },
    p => { p.verdict = 'conditional' }, p => { p.fraction = 'FRAC-999' },
    p => { p.issuer = 'maker' }, p => { p.repository = 'https://example.test/other' },
  ]
  for (const change of mutations) {
    const payload = structuredClone(evidence.review.payload); change(payload)
    assert.throws(() => verifyEvidence(report, { ...evidence, review: sign('review', payload) }, trusted, revision), undefined, String(change))
  }
  const tampered = structuredClone(evidence); tampered.review.payload.reference += '/changed'
  assert.throws(() => verifyEvidence(report, tampered, trusted, revision), /signature/)
  const selfApproved = structuredClone(policy); selfApproved.review.identity = 'maker'
  fs.writeFileSync(trustFile, JSON.stringify(selfApproved))
  assert.throws(() => loadTrust(candidate, trustFile), /independent/)
  selfApproved.review.identity = 'reviewer'; selfApproved.review.publicKey = policy.ci.publicKey
  fs.writeFileSync(trustFile, JSON.stringify(selfApproved))
  assert.throws(() => loadTrust(candidate, trustFile), /independent/)
  fs.writeFileSync(path.join(candidate, 'policy.json'), JSON.stringify(policy))
  assert.throws(() => loadTrust(candidate, path.join(candidate, 'policy.json')), /outside/)
  assert.throws(() => runVerify(candidate, {}), /requires/)
})

test('verify binds every source byte and loaded fragment to HEAD, even with hidden Git changes', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'madd-head-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const root = path.join(dir, 'candidate'); fs.mkdirSync(root); initContract(root)
  fs.writeFileSync(path.join(root, 'check.js'), 'original check\n')
  fs.writeFileSync(path.join(root, 'app.js'), 'original application\n')
  fs.writeFileSync(path.join(root, '.gitignore'), '.madd/contract.d/30-technical.json\n')
  const contract = loadContract(root)
  Object.assign(contract.tasks.tests[0], { binding: 'bound', ref: 'check.js' })
  contract.audit_cycle = { current_iteration: 0, max_iterations: 3, status: 'pending', history: [], recommendations: [], fractions: [{ id: 'FRAC-001', tasks: ['TASK-001'], requirements: ['REQ-F-001'], status: 'pending' }] }
  fs.writeFileSync(path.join(root, '.madd/contract.d/40-tasks.json'), JSON.stringify({ tasks: contract.tasks }))
  fs.writeFileSync(path.join(root, '.madd/contract.d/60-audit-cycle.json'), JSON.stringify({ audit_cycle: contract.audit_cycle }))
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
  git('init', '-q'); git('config', 'user.name', 'Synthetic Test'); git('config', 'user.email', 'test@example.invalid')
  git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'synthetic fixture')
  const revision = git('rev-parse', 'HEAD')
  const keys = { ci: crypto.generateKeyPairSync('ed25519'), review: crypto.generateKeyPairSync('ed25519') }
  const policy = { repository: 'https://example.test/repository', authors: ['maker'], ci: { identity: 'ci', publicKey: keys.ci.publicKey.export({ type: 'spki', format: 'pem' }) }, review: { identity: 'reviewer', publicKey: keys.review.publicKey.export({ type: 'spki', format: 'pem' }) } }
  const trust = path.join(dir, 'policy.json'), evidence = path.join(dir, 'evidence.json')
  fs.writeFileSync(trust, JSON.stringify(policy))
  function receipts() {
    const report = validateContract(loadContract(root), { root, fraction: 'FRAC-001', requireBound: true })
    const records = {}
    for (const kind of ['ci', 'review']) {
      const payload = { formatVersion: '0.2.0', kind, issuer: policy[kind].identity, repository: policy.repository, revision, contractDigest: report.contractDigest, fraction: 'FRAC-001', requirements: report.requirements, checks: [{ id: 'TEST-001', ref: 'check.js', result: 'passed' }], reference: `https://example.test/${kind}/1`, verdict: kind === 'ci' ? 'passed' : 'approved' }
      records[kind] = { payload, signature: crypto.sign(null, Buffer.from(canonical(payload)), keys[kind].privateKey).toString('base64') }
    }
    fs.writeFileSync(evidence, JSON.stringify(records))
  }
  receipts()
  const verify = () => runVerify(root, { fraction: 'FRAC-001', evidence, trust })
  assert.equal(verify().delivered, true)
  for (const [flag, undo] of [['--assume-unchanged', '--no-assume-unchanged'], ['--skip-worktree', '--no-skip-worktree']]) {
    for (const file of ['check.js', 'app.js']) {
      const original = fs.readFileSync(path.join(root, file))
      git('update-index', flag, file); fs.writeFileSync(path.join(root, file), 'modified source hidden from git status\n')
      assert.equal(git('status', '--porcelain'), '')
      assert.throws(verify, /HEAD|revision/, `${flag} ${file}`)
      fs.writeFileSync(path.join(root, file), original); git('update-index', undo, file)
    }
  }
  fs.writeFileSync(path.join(root, '.madd/contract.d/30-technical.json'), '{"technical":{"stack":{"language":"extra ignored data"}}}')
  assert.equal(git('status', '--porcelain'), '')
  receipts()
  assert.throws(verify, /tracked|HEAD/)
  fs.unlinkSync(path.join(root, '.madd/contract.d/30-technical.json'))
  receipts()
  fs.writeFileSync(path.join(root, 'check.js'), 'different committed check\n')
  git('add', 'check.js'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'synthetic replacement')
  const replacement = git('rev-parse', 'HEAD')
  git('replace', revision, replacement)
  git('update-ref', 'HEAD', revision)
  assert.equal(git('status', '--porcelain'), '')
  assert.equal(git('rev-parse', 'HEAD'), revision)
  assert.throws(verify, /clean|HEAD|revision/, 'local replacement objects must not redefine a signed revision')
})
