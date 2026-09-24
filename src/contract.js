import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { visit } from 'jsonc-parser'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
export const schema = JSON.parse(fs.readFileSync(path.join(packageRoot, 'schemas/contract-0.2.0.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strictTypes: false, allowUnionTypes: true })
addFormats(ajv)
const complete = ajv.compile(schema)
const fragment = ajv.compile({ ...schema, $id: `${schema.$id}/fragment`, required: undefined })
export const MAX_BYTES = 1024 * 1024

/** Parse data only: no JSONC, duplicate properties, prototype keys or schema loading. */
export function parseJson(text) {
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('JSON exceeds 1 MiB')
  const objects = []
  let depth = 0
  visit(text, {
    onObjectBegin() { if (++depth > 64) throw new Error('JSON nesting exceeds 64'); objects.push(new Set()) },
    onObjectEnd() { depth--; objects.pop() },
    onArrayBegin() { if (++depth > 64) throw new Error('JSON nesting exceeds 64') },
    onArrayEnd() { depth-- },
    onObjectProperty(key) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(`Forbidden property: ${key}`)
      if (objects.at(-1).has(key)) throw new Error(`Duplicate JSON property: ${key}`)
      objects.at(-1).add(key)
    },
    onError(code, offset) { throw new Error(`Invalid JSON at byte ${offset} (${code})`) },
  }, { disallowComments: true, allowTrailingComma: false })
  return JSON.parse(text, (key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite JSON number')
    if (['$ref', '$dynamicRef'].includes(key)) throw new Error('Contract data cannot resolve schema references')
    return value
  })
}

/** Resolve only regular local files under the chosen root; never follow nested symlinks. */
export function localFile(root, ref) {
  if (typeof ref !== 'string' || !ref || path.isAbsolute(ref) || ref.includes('\\') || ref.includes('\0') || ref.split('/').some(p => !p || p === '.' || p === '..') || /^[a-z]+:/i.test(ref)) {
    throw new Error(`Expected a relative file path: ${ref}`)
  }
  let current = fs.realpathSync(root)
  const parts = ref.split('/')
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part)
    const stat = fs.lstatSync(current)
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error(`Not a regular local file: ${ref}`)
    }
  }
  return current
}

export function readJsonFile(root, ref) {
  const file = localFile(root, ref)
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  try {
    const stat = fs.fstatSync(fd)
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error(`File exceeds limit or is not regular: ${ref}`)
    return parseJson(fs.readFileSync(fd, 'utf8'))
  } finally { fs.closeSync(fd) }
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  return JSON.stringify(value)
}

export function digest(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex') }

export function loadContract(root) {
  // Verify the directory chain without trusting a supplied schema or fragment manifest.
  for (const ref of ['.madd', '.madd/contract.d']) {
    const stat = fs.lstatSync(path.join(root, ref))
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Not a regular directory: ${ref}`)
  }
  const files = fs.readdirSync(path.join(root, '.madd/contract.d')).sort()
  if (!files.length || files.length > 100) throw new Error('Expected 1–100 JSON fragments')
  const contract = {}
  let bytes = 0
  for (const name of files) {
    if (!/^\d{2}-[a-z0-9-]+\.json$/.test(name)) throw new Error(`Unexpected contract fragment: ${name}`)
    const ref = `.madd/contract.d/${name}`
    const file = localFile(root, ref)
    bytes += fs.statSync(file).size
    if (bytes > 4 * MAX_BYTES) throw new Error('Contract exceeds 4 MiB')
    const data = readJsonFile(root, ref)
    if (!fragment(data)) throw new Error(`${name}: ${ajv.errorsText(fragment.errors)}`)
    for (const [key, value] of Object.entries(data)) {
      if (Object.hasOwn(contract, key)) throw new Error(`Duplicate contract section: ${key}`)
      contract[key] = value
    }
  }
  return contract
}

/** Adapter lifecycle commands must discover metadata without assuming its filename. */
export function assertLegacyTarget(root) {
  const directory = path.join(root, '.madd/contract.d')
  if (!fs.existsSync(directory)) return
  const names = fs.readdirSync(directory)
  if (names.length > 100) throw new Error('Too many contract files to safely inspect before adapter installation')
  for (const name of names.filter(name => name.endsWith('.json'))) {
    const data = readJsonFile(root, `.madd/contract.d/${name}`)
    if (data?.meta?.format_version !== undefined) throw new Error('Contract-only specifications require an explicit format migration; adapter init/update will not overwrite them')
  }
}

export function validateContract(contract, { root, fraction: fractionId, requireBound = false } = {}) {
  if (!complete(contract)) throw new Error(ajv.errorsText(complete.errors, { separator: '\n' }))
  const { functional, tasks, technical, audit_cycle: audit, meta } = contract
  const requirements = [...functional.requirements, ...Object.values(technical?.nfr ?? {}).flat()]
  const components = technical?.architecture?.components ?? []
  const fractions = audit?.fractions ?? []
  const groups = {
    requirement: requirements, task: tasks.items, test: tasks.tests,
    feature: functional.features ?? [], actor: functional.actors ?? [],
    phase: tasks.phases ?? [], component: components, fraction: fractions,
    source: meta.sources ?? [], recommendation: audit?.recommendations ?? [],
    objective: contract.intention.objectives, risk: contract.intention.risks ?? [],
    workflow: functional.workflows ?? [], rule: functional.business_rules ?? [],
    ui: functional.ui_specs ?? [], decision: technical?.architecture?.decisions ?? [],
    endpoint: technical?.api?.endpoints ?? [], runbook: contract.operations?.runbooks ?? [],
    debt: contract.retro?.debt ?? [],
  }
  const ids = new Set()
  for (const [kind, items] of Object.entries(groups)) {
    for (const item of items) {
      if (item.id === undefined) continue // A few legacy optional UI/data observations have no identity.
      if (ids.has(item.id)) throw new Error(`Duplicate ID: ${item.id}`)
      ids.add(item.id)
    }
    groups[kind] = new Map(items.map(item => [item.id, item]))
  }
  function references(values, kind, owner) {
    if (!values) return
    if (new Set(values).size !== values.length) throw new Error(`Duplicate references in ${owner}`)
    for (const value of values) if (!groups[kind].has(value)) throw new Error(`${owner}: missing ${kind} ${value}`)
  }
  for (const req of requirements) {
    references([req.validation.test_id], 'test', req.id)
    if (groups.test.get(req.validation.test_id).requirement !== req.id) throw new Error(`${req.id}: test binding points to another requirement`)
    if (req.feature) references([req.feature], 'feature', req.id)
  }
  for (const task of tasks.items) {
    references(task.requirements, 'requirement', task.id)
    references(task.dependencies, 'task', task.id)
    if (task.phase) references([task.phase], 'phase', task.id)
    if (task.repository) references([task.repository], 'source', task.id)
  }
  for (const test of tasks.tests) {
    references([test.requirement], 'requirement', test.id)
    if (test.binding === 'bound') {
      if (!root) throw new Error('Bound checks require a source root')
      localFile(root, test.ref)
    }
  }
  for (const feature of functional.features ?? []) {
    references(feature.requirements, 'requirement', feature.id)
    if (feature.actor) references([feature.actor], 'actor', feature.id)
  }
  for (const phase of tasks.phases ?? []) references(phase.tasks, 'task', phase.id)
  for (const component of components) references(component.dependencies, 'component', component.id)
  for (const endpoint of technical?.api?.endpoints ?? []) references(endpoint.requirements, 'requirement', endpoint.id)
  for (const rec of audit?.recommendations ?? []) {
    references(rec.related_requirements, 'requirement', rec.id)
    references(rec.related_components, 'component', rec.id)
    if (rec.fraction) references([rec.fraction], 'fraction', rec.id)
  }
  for (const debt of contract.retro?.debt ?? []) if (debt.source_rec) references([debt.source_rec], 'recommendation', debt.id)
  for (const fraction of contract.retro?.fractions ?? []) {
    references([fraction.id], 'fraction', 'retro fraction')
    references(fraction.tasks, 'task', fraction.id)
    references(fraction.requirements_covered, 'requirement', fraction.id)
    references(fraction.debt, 'debt', fraction.id)
  }
  references(audit?.scope_details?.impacted_requirements, 'requirement', 'audit scope')
  references(audit?.scope_details?.impacted_components, 'component', 'audit scope')
  for (const frac of fractions) {
    references(frac.tasks, 'task', frac.id)
    references(frac.requirements, 'requirement', frac.id)
    const covered = new Set(frac.tasks.flatMap(id => groups.task.get(id).requirements))
    if (!frac.tasks.length || !frac.requirements?.length || covered.size !== frac.requirements.length || frac.requirements.some(id => !covered.has(id))) throw new Error(`${frac.id}: fraction requirements must equal its tasks' requirements`)
  }
  for (const kind of ['task', 'component']) {
    const visiting = new Set(), visited = new Set()
    function checkCycle(id) {
      if (visiting.has(id)) throw new Error(`Dependency cycle: ${id}`)
      if (visited.has(id)) return
      visiting.add(id)
      for (const dependency of groups[kind].get(id).dependencies ?? []) checkCycle(dependency)
      visiting.delete(id); visited.add(id)
    }
    for (const id of groups[kind].keys()) checkCycle(id)
  }
  const fraction = fractionId ? groups.fraction.get(fractionId) : null
  if (fractionId && !fraction) throw new Error(`Unknown fraction: ${fractionId}`)
  const selected = fraction?.requirements ?? requirements.map(r => r.id)
  const checks = tasks.tests.filter(t => selected.includes(t.requirement))
  const bound = checks.length > 0 && checks.every(t => t.binding === 'bound')
  if (requireBound && !bound) throw new Error('Selected checks are not all bound')
  return { ok: true, formatVersion: '0.2.0', structurallyValid: true, checksBound: bound, delivered: false, contractDigest: digest(contract), fraction: fractionId ?? null, requirements: selected, checks: checks.map(t => ({ id: t.id, ref: t.ref, binding: t.binding })) }
}

export function runValidate(root, options = {}) {
  return validateContract(loadContract(root), { ...options, root })
}

/** New contract only; refuse to replace any existing .madd directory or agent files. */
export function initContract(root, { dryRun = false } = {}) {
  root = fs.realpathSync(root)
  const dest = path.join(root, '.madd')
  if (fs.existsSync(dest) || fs.readdirSync(root).includes('.madd')) throw new Error('.madd already exists; contract init never overwrites it')
  if (dryRun) return { created: false, files: 5 }
  const staging = fs.mkdtempSync(path.join(root, '.madd-init-'))
  try {
    fs.cpSync(path.join(packageRoot, 'templates/contract.d'), path.join(staging, 'contract.d'), { recursive: true })
    fs.copyFileSync(path.join(packageRoot, 'schemas/contract-0.2.0.schema.json'), path.join(staging, 'contract.schema.json'))
    fs.renameSync(staging, dest)
  } finally { fs.rmSync(staging, { recursive: true, force: true }) }
  return { created: true, files: 5 }
}
