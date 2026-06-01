import fs from 'node:fs'
import path from 'node:path'
import { AGENTS, detectAgents } from './detect-agents.js'

const REQUIRED_SHARED = [
  '.madd/contract.schema.json',
  '.madd/contract.d/00-meta.json',
  '.madd/contract.d/10-intention.json',
  '.madd/contract.d/20-functional.json',
  '.madd/contract.d/30-technical.json',
  '.madd/contract.d/40-tasks.json',
  '.madd/contract.d/50-operations.json',
  '.madd/contract.d/60-audit-cycle.json',
  '.madd/contract.d/90-retro.json',
]

const REQUIRED_PER_AGENT = {
  'claude-code':   ['.claude/settings.json', '.claude/agents/madd-conductor.md'],
  'codex':         ['.codex/config.toml', 'AGENTS.md'],
  'mistral-vibe':  ['.vibe/config.toml'],
  'opencode':      ['.opencode/opencode.json'],
  'docker-cagent': ['madd.yaml'],
}

function checkJson(filePath) {
  try {
    JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} targetPath
 * @returns {Promise<Array<{ agent: string, checks: Array<{ label: string, ok: boolean, detail?: string }> }>>}
 */
export async function runDoctor(targetPath) {
  const detected = await detectAgents(targetPath)
  const installedAgents = AGENTS.filter((a) => detected[a.key])

  if (installedAgents.length === 0) {
    return [{ agent: 'global', checks: [{ label: 'No MADD agents detected in target', ok: false }] }]
  }

  const reports = []

  // Shared .madd/ checks (run once)
  const sharedChecks = []
  for (const rel of REQUIRED_SHARED) {
    const abs = path.join(targetPath, rel)
    const exists = fs.existsSync(abs)
    sharedChecks.push({ label: rel, ok: exists, detail: exists ? undefined : 'missing' })
  }
  // Check maddVersion in 00-meta.json
  const metaPath = path.join(targetPath, '.madd/contract.d/00-meta.json')
  if (fs.existsSync(metaPath)) {
    const validJson = checkJson(metaPath)
    sharedChecks.push({ label: '.madd/contract.d/00-meta.json (valid JSON)', ok: validJson })
    if (validJson) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      const hasMaddVersion = Boolean(meta?.meta?.maddVersion)
      sharedChecks.push({ label: 'maddVersion field present', ok: hasMaddVersion })
    }
  }
  reports.push({ agent: 'shared (.madd/)', checks: sharedChecks })

  // Per-agent checks
  for (const agent of installedAgents) {
    const required = REQUIRED_PER_AGENT[agent.key] ?? []
    const checks = required.map((rel) => {
      const abs = path.join(targetPath, rel)
      const exists = fs.existsSync(abs)
      return { label: rel, ok: exists, detail: exists ? undefined : 'missing' }
    })
    reports.push({ agent: agent.label, checks })
  }

  return reports
}
