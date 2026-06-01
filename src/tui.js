import { AGENTS } from './detect-agents.js'

const ESC = ''
const GREEN = `${ESC}[32m`
const CYAN = `${ESC}[36m`
const DIM = `${ESC}[2m`
const RESET = `${ESC}[0m`
const BOLD = `${ESC}[1m`

const KEYS = {
  UP: `${ESC}[A`,
  DOWN: `${ESC}[B`,
  SPACE: ' ',
  ENTER: '\r',
  ENTER_LF: '\n',
  CTRL_C: '',
  A: 'a',
  Q: 'q',
}

function write(s) { process.stdout.write(s) }

function clearLines(n) {
  write('[2K')
  for (let i = 1; i < n; i++) write('[1A[2K')
  write('\r')
}

function renderSelectUI(cursor, selected, detected) {
  const lines = [
    `${BOLD}Select agents to scaffold MADD for:${RESET}`,
    `${DIM}(Up/Down: navigate  Space: toggle  a: all  Enter: confirm  Ctrl-C: abort)${RESET}`,
    '',
  ]
  for (let i = 0; i < AGENTS.length; i++) {
    const { key, label } = AGENTS[i]
    const arrow = i === cursor ? `${CYAN}>${RESET}` : ' '
    const check = selected.has(key) ? `${GREEN}x${RESET}` : ' '
    const det = detected[key] ? `  ${GREEN}(detected)${RESET}` : ''
    lines.push(`${arrow} [${check}] ${label}${det}`)
  }
  return lines
}

/**
 * @param {Record<string, boolean>} detected
 * @returns {Promise<string[]>} selected agent keys
 */
export async function selectAgents(detected) {
  if (!process.stdin.isTTY) {
    // Non-interactive: return all detected agents (or all if none detected)
    const hits = AGENTS.filter((a) => detected[a.key]).map((a) => a.key)
    return hits.length > 0 ? hits : AGENTS.map((a) => a.key)
  }

  return new Promise((resolve, reject) => {
    let cursor = 0
    const selected = new Set(AGENTS.filter((a) => detected[a.key]).map((a) => a.key))
    let lastLineCount = 0

    const render = () => {
      const lines = renderSelectUI(cursor, selected, detected)
      if (lastLineCount > 0) clearLines(lastLineCount)
      write(lines.join('\n'))
      lastLineCount = lines.length
    }

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    write('\n')
    render()

    const onData = (key) => {
      if (key === KEYS.CTRL_C || key === KEYS.Q) {
        cleanup()
        write('\n')
        reject(new Error('Aborted'))
        return
      }
      if (key === KEYS.UP) {
        cursor = (cursor - 1 + AGENTS.length) % AGENTS.length
      } else if (key === KEYS.DOWN) {
        cursor = (cursor + 1) % AGENTS.length
      } else if (key === KEYS.SPACE) {
        const k = AGENTS[cursor].key
        if (selected.has(k)) selected.delete(k)
        else selected.add(k)
      } else if (key === KEYS.A) {
        if (selected.size === AGENTS.length) selected.clear()
        else AGENTS.forEach((a) => selected.add(a.key))
      } else if (key === KEYS.ENTER || key === KEYS.ENTER_LF) {
        cleanup()
        write('\n')
        resolve([...selected])
        return
      }
      render()
    }

    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }

    process.stdin.on('data', onData)
  })
}

/**
 * @param {string} filePath
 * @param {string} diff
 * @returns {Promise<boolean>}
 */
export async function confirmFileDiff(filePath, diff) {
  if (!process.stdin.isTTY) return false

  return new Promise((resolve) => {
    write(`\n${BOLD}${filePath}${RESET}\n`)
    for (const line of diff.split('\n')) {
      if (line.startsWith('+')) write(`${GREEN}${line}${RESET}\n`)
      else if (line.startsWith('-')) write(`${ESC}[31m${line}${RESET}\n`)
      else write(`${DIM}${line}${RESET}\n`)
    }
    write(`\nApply this update? ${DIM}[y/N]${RESET} `)

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const onData = (key) => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      write(key === 'y' || key === 'Y' ? 'y\n' : 'N\n')
      resolve(key === 'y' || key === 'Y')
    }

    process.stdin.once('data', onData)
  })
}

/**
 * @param {{ copied: string[], skipped: string[], backed_up: string[] }} summary
 * @param {boolean} dryRun
 */
export function printSummary(summary, dryRun = false) {
  const prefix = dryRun ? `${DIM}[dry-run]${RESET} ` : ''
  write('\n')
  for (const f of summary.copied) write(`  ${GREEN}+${RESET} ${prefix}${f}\n`)
  for (const f of summary.backed_up) write(`  ${CYAN}~${RESET} ${prefix}${f} (backed up)\n`)
  for (const f of summary.skipped) write(`  ${DIM}=${RESET} ${f} (skipped)\n`)
  write('\n')
  const action = dryRun ? 'Would copy' : 'Copied'
  write(`${action}: ${GREEN}${summary.copied.length + summary.backed_up.length}${RESET}  `)
  write(`Skipped: ${DIM}${summary.skipped.length}${RESET}\n`)
}
