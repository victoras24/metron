// Validates a Playbook directory: `node plugin/scripts/check-playbook.ts [dir]`. Exit 1 on errors.
// Run it in CI on the repo holding the Team Playbook so a bad Rule fails the PR, not the Members' sessions.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPlaybook, type Playbook } from '../hooks/playbook.ts'

export const BUNDLED_PLAYBOOK = fileURLToPath(new URL('../playbook', import.meta.url))

export const loadDir = (dir: string): Playbook => {
  const valuesPath = join(dir, 'values.yaml')
  const values = existsSync(valuesPath) ? readFileSync(valuesPath, 'utf8') : undefined
  const rulesDir = join(dir, 'rules')
  const files = readdirSync(rulesDir)
    .filter(n => n.endsWith('.md'))
    .map(name => ({ name, text: readFileSync(join(rulesDir, name), 'utf8') }))
  return buildPlaybook(values, files)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? BUNDLED_PLAYBOOK
  const pb = loadDir(dir)
  for (const e of pb.errors) console.error(`✗ ${e}`)
  const unverified = Object.entries(pb.values).filter(([, v]) => v.evidence === 'unverified').map(([k]) => k)
  console.log(`${pb.rules.length} rules, ${Object.keys(pb.values).length} values (${unverified.length} unverified: ${unverified.join(', ')})`)
  process.exit(pb.errors.length ? 1 : 0)
}
