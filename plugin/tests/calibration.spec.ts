// Calibration outcomes and report summary: `node --test plugin/tests/calibration.spec.ts`.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { addShown, resolveHeld, resolveTips, signalSnapshot, summarize, type CalibrationEvent } from '../hooks/calibration.ts'
import { buildPlaybook } from '../hooks/playbook.ts'

const RULE = '---\nid: say-why\nseverity: tip\nwhen:\n  all:\n    - text ~ /please/\ntext: "Say why"\n---\n'
const pb = buildPlaybook(undefined, [{ name: '10-say-why.md', text: RULE }])
const ctx = (text: string) => ({ text, contextTokens: 1000, priorCorrections: 0, idleMs: 0, turns: 2 })

const shown = [{ ruleId: 'say-why', signals: { words: 2 } }]

test('tip outcomes', () => {
  assert.deepEqual(resolveTips(pb, shown, ['say-why'], ctx('x please')).map(o => o.outcome), ['accepted'])
  assert.deepEqual(resolveTips(pb, shown, [], ctx('x please')).map(o => o.outcome), ['ignored'])
  assert.deepEqual(resolveTips(pb, shown, [], ctx('x because')).map(o => o.outcome), ['fixed'])
})

test('held check: unchanged → overridden, still matching edit → unresolved', () => {
  assert.deepEqual(resolveHeld(pb, shown, 'a please', ctx('a please')).map(o => o.outcome), ['overridden'])
  assert.deepEqual(resolveHeld(pb, shown, 'a please', ctx('b please')), [])
  assert.deepEqual(resolveHeld(pb, shown, 'a please', ctx('b')).map(o => o.outcome), ['fixed'])
})

test('outcomes carry the Signals from when the Suggestion showed, not from the sent Prompt', () => {
  const [tip] = resolveTips(pb, shown, [], ctx('a much longer prompt that explains because'))
  assert.deepEqual(tip?.shownSignals, { words: 2 })
  const [check] = resolveHeld(pb, shown, 'a please', ctx('a please'))
  assert.deepEqual(check?.shownSignals, { words: 2 })
})

test('addShown keeps the first showing', () => {
  const once = addShown([], ['say-why'], { words: 2 })
  assert.deepEqual(addShown(once, ['say-why', 'other'], { words: 9 }), [
    { ruleId: 'say-why', signals: { words: 2 } },
    { ruleId: 'other', signals: { words: 9 } },
  ])
})

test('snapshot has numbers only', () => {
  const s = signalSnapshot(ctx('fix src/a.ts please'))
  assert.equal(s.words, 3)
  assert.equal(s.contextTokens, 1000)
  assert.ok(Object.values(s).every(v => typeof v === 'number'))
})

test('summarize counts per Rule', () => {
  const ev = (outcome: CalibrationEvent['outcome']): CalibrationEvent =>
    ({ ts: 0, session: 's', playbook: 'bundled', ruleId: 'say-why', severity: 'tip', outcome, shownSignals: {}, signals: {} })
  const [s] = summarize([ev('fixed'), ev('ignored'), ev('fixed')])
  assert.deepEqual(s, { ruleId: 'say-why', severity: 'tip', total: 3, accepted: 0, fixed: 2, ignored: 1, overridden: 0 })
})
