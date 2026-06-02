import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import { writeManifest, readManifest } from '../src/manifest.js'
import { expectedFiles, diffFiles } from '../src/scaffold.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BIN = path.join(__dirname, '..', 'bin', 'madd.js')

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'madd-test-'))
}

function run(args, cwd) {
  return execFileSync('node', [BIN, ...args], { cwd, encoding: 'utf8' })
}

function manifestCount(targetPath) {
  const m = readManifest(targetPath)
  return m ? m.files.length : 0
}

test('manifest roundtrip: write then read returns equal data', () => {
  const dir = tmp()
  const data = {
    maddVersion: '1.2.3',
    installedAt: '2026-06-02T00:00:00.000Z',
    agents: ['claude-code', 'codex'],
    files: [
      { path: '.madd/state.json', sha1: 'abc123', agent: 'shared' },
      { path: '.claude/settings.json', sha1: 'def456', agent: 'claude-code' },
    ],
  }
  writeManifest(dir, data)
  const back = readManifest(dir)
  assert.equal(back.maddVersion, data.maddVersion)
  assert.equal(back.manifestVersion, '1')
  assert.deepEqual(back.agents, data.agents)
  assert.deepEqual(back.files, data.files)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('expectedFiles returns the shared contract for a single agent', () => {
  const files = expectedFiles(['claude-code'])
  assert.ok(files.length > 0)
  assert.ok(files.some((f) => f.path === '.madd/contract.schema.json' && f.agent === 'shared'))
  assert.ok(files.some((f) => f.path === '.claude/settings.json' && f.agent === 'claude-code'))
})

test('diffFiles: identical files yield empty string, different files yield a diff', () => {
  const dir = tmp()
  const a = path.join(dir, 'a.txt')
  const b = path.join(dir, 'b.txt')
  fs.writeFileSync(a, 'one\ntwo\n')
  fs.writeFileSync(b, 'one\ntwo\n')
  assert.equal(diffFiles(a, b), '')
  fs.writeFileSync(b, 'one\nTWO\n')
  assert.match(diffFiles(a, b), /TWO/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('init writes a complete manifest and a .gitignore entry', () => {
  const dir = tmp()
  run(['init', '--yes', dir], dir)
  assert.ok(fs.existsSync(path.join(dir, '.madd/manifest.yaml')))
  assert.ok(fs.existsSync(path.join(dir, '.claude/settings.json')))
  assert.ok(manifestCount(dir) > 100)
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /\.madd\.bak\//)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('re-init keeps the manifest complete (bug: truncation on skip)', () => {
  const dir = tmp()
  run(['init', '--yes', dir], dir)
  const first = manifestCount(dir)
  run(['init', '--yes', dir], dir) // everything already present -> all skipped
  const second = manifestCount(dir)
  assert.equal(second, first)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('status --json flags a modified tracked file', () => {
  const dir = tmp()
  run(['init', '--yes', dir], dir)
  const tracked = path.join(dir, '.madd/state.json')
  fs.writeFileSync(tracked, '{"workflow":"EDITED"}\n')
  const report = JSON.parse(run(['status', '--json', dir], dir))
  assert.equal(report.installed, true)
  assert.equal(report.upToDate, true)
  const entry = report.files.find((f) => f.path === '.madd/state.json')
  assert.equal(entry.state, 'modified')
  assert.ok(report.counts.modified >= 1)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('deinit removes pristine files but keeps a modified one', () => {
  const dir = tmp()
  run(['init', '--yes', dir], dir)
  const modified = path.join(dir, '.madd/state.json')
  const pristine = path.join(dir, '.madd/contract.schema.json')
  fs.writeFileSync(modified, '{"workflow":"EDITED"}\n')

  run(['deinit', dir], dir)

  assert.ok(!fs.existsSync(pristine), 'pristine file should be removed')
  assert.ok(fs.existsSync(modified), 'modified file should be kept')
  // partial deinit -> manifest rewritten, tracking only kept files
  const m = readManifest(dir)
  assert.ok(m, 'manifest should still exist after partial deinit')
  assert.ok(m.files.every((f) => f.path === '.madd/state.json'))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('deinit with all files pristine removes the manifest entirely', () => {
  const dir = tmp()
  run(['init', '--yes', dir], dir)
  run(['deinit', dir], dir)
  assert.ok(!fs.existsSync(path.join(dir, '.madd/manifest.yaml')))
  assert.ok(!fs.existsSync(path.join(dir, '.madd')))
  fs.rmSync(dir, { recursive: true, force: true })
})
