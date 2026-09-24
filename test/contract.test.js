import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { initContract, loadContract, validateContract, runValidate, parseJson, MAX_BYTES, digest } from '../src/contract.js'
import { AGENTS } from '../src/detect-agents.js'
import { scaffold } from '../src/scaffold.js'

const bin = new URL('../bin/madd.js', import.meta.url).pathname
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'madd-contract-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  initContract(root)
  return root
}
function bind(contract, root) {
  fs.writeFileSync(path.join(root, 'check.js'), '// acceptance check\n')
  Object.assign(contract.tasks.tests[0], { binding: 'bound', ref: 'check.js' })
  return contract
}

test('all shipped legacy fragments, assembled contracts and five adapter installs validate', async t => {
  const ajv = new Ajv2020({ strict: false }); addFormats(ajv)
  const base = new URL('../agents/shared/.madd/', import.meta.url)
  const schema = JSON.parse(fs.readFileSync(new URL('contract.schema.json', base)))
  const validate = ajv.compile(schema)
  const assembled = {}
  for (const file of fs.readdirSync(new URL('contract.d/', base))) {
    const data = JSON.parse(fs.readFileSync(new URL(`contract.d/${file}`, base)))
    assert.ok(validate(data), `${file}: ${ajv.errorsText(validate.errors)}`)
    Object.assign(assembled, data)
  }
  assert.ok(validate(assembled))
  assert.ok(fs.existsSync(new URL(assembled.$schema, new URL('contract.d/00-meta.json', base))))
  for (const { key } of AGENTS) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'madd-adapter-'))
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    await scaffold([key], root, {})
    const doc = Object.assign({}, ...fs.readdirSync(path.join(root, '.madd/contract.d')).map(file => JSON.parse(fs.readFileSync(path.join(root, '.madd/contract.d', file)))))
    assert.ok(validate(doc), `${key}: ${ajv.errorsText(validate.errors)}`)
  }
})

test('agent-free init, CLI validate and authored statuses never assert delivery', t => {
  const root = fixture(t)
  assert.deepEqual(fs.readdirSync(root), ['.madd'])
  assert.equal(fs.readdirSync(path.join(root, '.madd/contract.d')).length, 4)
  const contract = loadContract(root)
  contract.meta.status = 'verified'; contract.tasks.items[0].status = 'done'
  const report = validateContract(contract, { root })
  assert.equal(report.delivered, false)
  assert.equal(report.checksBound, false)
  assert.throws(() => validateContract(contract, { root, requireBound: true }), /not all bound/)
  assert.throws(() => initContract(root), /already exists/)
  let result = spawnSync(process.execPath, [bin, 'validate', root, '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).delivered, false)
  result = spawnSync(process.execPath, [bin, 'validate', root, '--require-bound', '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).ok, false)
  for (const command of ['init', 'update']) {
    result = spawnSync(process.execPath, [bin, command, root, '--yes'], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.deepEqual(fs.readdirSync(root), ['.madd'])
  }
  fs.renameSync(path.join(root, '.madd/contract.d/00-meta.json'), path.join(root, '.madd/contract.d/01-meta.json'))
  assert.equal(runValidate(root).ok, true)
  for (const command of ['init', 'update']) {
    result = spawnSync(process.execPath, [bin, command, root, '--yes'], { encoding: 'utf8' })
    assert.equal(result.status, 1, 'a renamed metadata fragment still protects the contract')
    assert.equal(runValidate(root).ok, true)
  }
  for (const args of [['--unknown'], ['--fraction'], ['--fraction', 'invalid'], ['--trust']]) {
    result = spawnSync(process.execPath, [bin, 'validate', root, '--json', ...args], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.equal(JSON.parse(result.stdout).ok, false)
  }
})

test('strict parsing rejects ambiguity, malicious schema refs, oversize and excessive depth', () => {
  for (const json of ['{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"__proto__":{}}', '{"$ref":"https://attacker.test/schema"}', '{// comment\n"x":1}', '{"x":1,}', '{"n":1e999}', '['.repeat(65) + '0' + ']'.repeat(65), '"' + 'x'.repeat(MAX_BYTES) + '"']) {
    assert.throws(() => parseJson(json), undefined, json.slice(0, 100))
  }
  assert.deepEqual(parseJson('{"x":[{"y":"x"}],"y":2}'), { x: [{ y: 'x' }], y: 2 })
})

test('schema and references reject invalid contracts and dependency cycles', t => {
  const root = fixture(t), original = loadContract(root)
  const mutations = [
    c => { c.intention.objectives.push(structuredClone(c.intention.objectives[0])) },
    c => { c.functional.actors = [{ id: '', description: 'first' }, { id: '', description: 'second' }] },
    c => { c.intention.objectives[0].description = '' },
    c => { c.functional.requirements[0].acceptance_criteria = [''] },
    c => { c.technical = { architecture: { decisions: [{ id: 'ADR-001', title: 'a', status: 'accepted', decision: 'a' }, { id: 'ADR-001', title: 'b', status: 'accepted', decision: 'b' }] } } },
    c => { c.technical = { api: { endpoints: [{ id: 'API-001', method: 'GET', path: '/one' }, { id: 'API-001', method: 'POST', path: '/two' }] } } },
    c => { c.unexpected = true },
    c => { c.meta.extra = true },
    c => { c.meta.format_version = '99.0.0' },
    c => { delete c.intention },
    c => { c.functional.requirements = [] },
    c => { c.functional.requirements[0].acceptance_criteria = [] },
    c => { c.functional.requirements[0].scenarios = [{ given: 'x', then: 'y' }] },
    c => { c.tasks.items.push(structuredClone(c.tasks.items[0])) },
    c => { c.tasks.items[0].requirements = ['REQ-F-404'] },
    c => { c.functional.requirements[0].validation.test_id = 'TEST-404' },
    c => { c.tasks.items[0].dependencies = ['TASK-001'] },
    c => { c.tasks.items.push({ ...structuredClone(c.tasks.items[0]), id: 'TASK-002', dependencies: ['TASK-001'] }); c.tasks.items[0].dependencies = ['TASK-002'] },
    c => { c.tasks.items[0].dependencies = ['TASK-404'] },
    c => { c.tasks.tests[0].binding = 'bound' },
    c => { c.tasks.tests[0].ref = 'check.js' },
    c => { c.$schema = 'https://attacker.test/schema' },
    c => { c.tasks.items[0].repository = 'missing-source' },
  ]
  for (const mutate of mutations) {
    const contract = structuredClone(original); mutate(contract)
    assert.throws(() => validateContract(contract, { root }), undefined, String(mutate))
  }
  assert.throws(() => validateContract({}, { root }))
  assert.throws(() => validateContract(original, { root, fraction: 'FRAC-999' }), /Unknown fraction/)
  const bound = bind(structuredClone(original), root)
  assert.equal(validateContract(bound, { root, requireBound: true }).checksBound, true)
  assert.equal(digest(original), digest(JSON.parse(JSON.stringify(original))))
  assert.notEqual(digest(original), digest(bound))
})

test('duplicate sections, symlinks, path escapes and unexpected fragments are refused', t => {
  const root = fixture(t)
  const dir = path.join(root, '.madd/contract.d'), duplicate = path.join(dir, '01-meta.json')
  fs.copyFileSync(path.join(dir, '00-meta.json'), duplicate)
  assert.throws(() => runValidate(root), /Duplicate contract section/)
  fs.unlinkSync(duplicate)
  fs.symlinkSync(path.join(dir, '00-meta.json'), duplicate)
  assert.throws(() => runValidate(root), /Not a regular local file/)
  fs.unlinkSync(duplicate)
  fs.writeFileSync(path.join(dir, 'ignored.txt'), '{}')
  assert.throws(() => runValidate(root), /Unexpected contract fragment/)
  fs.unlinkSync(path.join(dir, 'ignored.txt'))
  const contract = loadContract(root)
  for (const ref of ['../outside', '/etc/passwd', 'https://attacker.test/a', 'a/../../outside', 'a\\..\\outside', '.madd/contract.d']) {
    Object.assign(contract.tasks.tests[0], { binding: 'bound', ref })
    assert.throws(() => validateContract(contract, { root }), undefined, ref)
  }
  fs.symlinkSync('/etc/passwd', path.join(root, 'outside'))
  contract.tasks.tests[0].ref = 'outside'
  assert.throws(() => validateContract(contract, { root }), /regular local file/)
})

test('fraction coverage is exact; future unbound work does not block a bound fraction', t => {
  const root = fixture(t), c = bind(loadContract(root), root)
  c.functional.requirements.push({ ...structuredClone(c.functional.requirements[0]), id: 'REQ-F-002', validation: { method: 'test', test_id: 'TEST-002' } })
  c.tasks.tests.push({ ...structuredClone(c.tasks.tests[0]), id: 'TEST-002', requirement: 'REQ-F-002', binding: 'planned', ref: null })
  c.tasks.items.push({ ...structuredClone(c.tasks.items[0]), id: 'TASK-002', requirements: ['REQ-F-002'] })
  c.audit_cycle = { current_iteration: 0, max_iterations: 3, status: 'pending', history: [], recommendations: [], fractions: [{ id: 'FRAC-001', tasks: ['TASK-001'], requirements: ['REQ-F-001'], status: 'pending' }] }
  assert.equal(validateContract(c, { root, fraction: 'FRAC-001', requireBound: true }).checksBound, true)
  assert.throws(() => validateContract(c, { root, requireBound: true }), /not all bound/)
  c.audit_cycle.fractions[0].requirements = ['REQ-F-002']
  assert.throws(() => validateContract(c, { root }), /must equal/)
})

test('large validation errors remain complete machine-readable JSON when stdout is piped', t => {
  const root = fixture(t)
  fs.writeFileSync(path.join(root, '.madd/contract.d/20-functional.json'), JSON.stringify({ functional: { requirements: Array.from({ length: 2000 }, () => ({})) } }))
  const result = spawnSync(process.execPath, [bin, 'validate', root, '--json'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  assert.equal(result.status, 1)
  assert.equal(result.error, undefined)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, false)
  assert.match(report.error, /1999/)
})
