// Calibration: what happened to each Suggestion, logged so unverified Playbook values can be tuned from Team data.
// Pure functions; register.tsx feeds them and writes the events. Events hold Signal numbers, never Prompt text (ADR 0005).
import type { Playbook, Severity } from './playbook.ts'
import { NUMBER_SIGNALS, type Ctx } from './signals.ts'

// accepted = "Use" pressed · fixed = Prompt changed so the Rule no longer matched · ignored = Tip still matched at send
// overridden = held Check sent unchanged.
export type Outcome = 'accepted' | 'fixed' | 'ignored' | 'overridden'
export type CalibrationEvent = {
  ts: number
  session: string
  playbook: 'bundled' | 'team'
  ruleId: string
  severity: Severity
  outcome: Outcome
  shownSignals: Signals // the draft when the Suggestion first showed: what triggered it
  signals: Signals // the Prompt as sent
}
export type Signals = Record<string, number>
// A Suggestion shown to the Member, with the Signals of the draft at that moment.
export type Shown = { ruleId: string; signals: Signals }

// Number Signals of a Prompt: what a threshold is compared against. Booleans are re-derivable from the Rule.
export const signalSnapshot = (c: Ctx): Signals =>
  Object.fromEntries(Object.entries(NUMBER_SIGNALS).map(([k, f]) => [k, f(c)]))

const matches = (pb: Playbook, ruleId: string, c: Ctx) => pb.rules.find(r => r.id === ruleId)?.match(c) ?? false

export type Resolved = Pick<CalibrationEvent, 'ruleId' | 'severity' | 'outcome' | 'shownSignals'>

// Adds Suggestions not shown yet; one already shown keeps the Signals from its first showing.
export const addShown = (shown: Shown[], ruleIds: string[], signals: Signals): Shown[] => [
  ...shown,
  ...ruleIds.filter(id => !shown.some(s => s.ruleId === id)).map(ruleId => ({ ruleId, signals })),
]

// Tips shown while drafting, resolved when the Prompt is sent.
export const resolveTips = (pb: Playbook, shown: Shown[], accepted: string[], sent: Ctx): Resolved[] =>
  shown.map(({ ruleId, signals }) => ({
    ruleId,
    severity: 'tip',
    outcome: accepted.includes(ruleId) ? 'accepted' : matches(pb, ruleId, sent) ? 'ignored' : 'fixed',
    shownSignals: signals,
  }))

// Held Checks, resolved on the next send. A Check that still matches changed text is held again, so not resolved yet.
export const resolveHeld = (pb: Playbook, held: Shown[], heldText: string, sent: Ctx): Resolved[] =>
  held.flatMap(({ ruleId, signals }): Resolved[] => {
    const base = { ruleId, severity: 'check' as const, shownSignals: signals }
    if (sent.text === heldText) return [{ ...base, outcome: 'overridden' }]
    return matches(pb, ruleId, sent) ? [] : [{ ...base, outcome: 'fixed' }]
  })

export const toJsonl = (events: CalibrationEvent[]) => events.map(e => JSON.stringify(e)).join('\n') + '\n'

export type RuleSummary = { ruleId: string; severity: Severity; total: number } & Record<Outcome, number>

// Per-Rule outcome counts, for the calibration report.
export const summarize = (events: CalibrationEvent[]): RuleSummary[] => {
  const by = new Map<string, RuleSummary>()
  for (const e of events) {
    const k = `${e.severity}:${e.ruleId}`
    const s = by.get(k) ?? { ruleId: e.ruleId, severity: e.severity, total: 0, accepted: 0, fixed: 0, ignored: 0, overridden: 0 }
    s.total += 1
    s[e.outcome] += 1
    by.set(k, s)
  }
  return [...by.values()].sort((a, b) => b.total - a.total)
}
