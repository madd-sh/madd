import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { schema, initContract, loadContract, validateContract } from '../src/contract.js'

test('stable schema identity preserves RC contracts and refuses unknown schemas', t => {
  const stable = 'https://madd.sh/schemas/0.2.0/contract.schema.json'
  assert.equal(schema.$id, stable)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'madd-stable-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  initContract(root)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.madd/contract.schema.json'))), schema)
  const contract = loadContract(root)
  for (const identity of ['../contract.schema.json', stable, 'https://madd.sh/schemas/draft/0.2.0/contract.schema.json']) {
    contract.$schema = identity
    const report = validateContract(contract, { root })
    assert.equal(report.structurallyValid, true)
    assert.equal(report.delivered, false)
  }
  contract.$schema = 'https://example.invalid/contract.schema.json'
  assert.throws(() => validateContract(contract, { root }), /schema/i)
})
