// Per-Rule Suggestion outcomes from calibration logs: `node plugin/scripts/calibration-report.ts [dir]`.
// Default dir ~/.metron/calibration. Use it to tune `unverified` values in values.yaml.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { summarize, type CalibrationEvent } from '../hooks/calibration.ts'

const dir = process.argv[2] ?? join(homedir(), '.metron', 'calibration')
if (!existsSync(dir)) {
  console.log(`no calibration logs in ${dir} yet`)
  process.exit(0)
}

const events: CalibrationEvent[] = readdirSync(dir)
  .filter(n => n.endsWith('.jsonl'))
  .flatMap(n => readFileSync(join(dir, n), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as CalibrationEvent))

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)]! : NaN
}
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-')

const sessions = new Set(events.map(e => e.session)).size
console.log(`${events.length} outcomes from ${sessions} Sessions in ${dir}\n`)
console.log(['rule', 'kind', 'n', 'used', 'fixed', 'ignored', 'overridden', 'acted on', 'median draft words (acted / not)'].join('\t'))
for (const s of summarize(events)) {
  const mine = events.filter(e => e.ruleId === s.ruleId && e.severity === s.severity)
  const acted = mine.filter(e => e.outcome === 'accepted' || e.outcome === 'fixed').map(e => (e.shownSignals ?? e.signals).words ?? NaN)
  const not = mine.filter(e => e.outcome === 'ignored' || e.outcome === 'overridden').map(e => (e.shownSignals ?? e.signals).words ?? NaN)
  console.log([
    s.ruleId, s.severity, s.total, s.accepted, s.fixed, s.ignored, s.overridden,
    pct(s.accepted + s.fixed, s.total), `${median(acted)} / ${median(not)}`,
  ].join('\t'))
}
