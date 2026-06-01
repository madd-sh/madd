import fs from 'node:fs'
import path from 'node:path'

export const AGENTS = [
  { key: 'claude-code',   label: 'Claude Code',   marker: '.claude/settings.json' },
  { key: 'codex',         label: 'Codex',         marker: '.codex/config.toml' },
  { key: 'mistral-vibe',  label: 'Mistral Vibe',  marker: '.vibe/config.toml' },
  { key: 'opencode',      label: 'OpenCode',      marker: '.opencode/opencode.json' },
  { key: 'docker-cagent', label: 'Docker cagent', marker: 'madd.yaml' },
]

/**
 * @param {string} targetPath
 * @returns {Promise<Record<string, boolean>>}
 */
export async function detectAgents(targetPath) {
  const result = {}
  for (const agent of AGENTS) {
    result[agent.key] = fs.existsSync(path.join(targetPath, agent.marker))
  }
  return result
}
