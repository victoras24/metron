// Rule behaviour against the real bundled Playbook files: `node --test plugin/tests/playbook.spec.ts`.
// (`claude plugin test` runs *.test.ts with no file system, so file-backed checks live here.)
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildPlaybook, evaluate, type Severity } from '../hooks/playbook.ts'
import { parseYaml } from '../hooks/yaml.ts'
import { BUNDLED_PLAYBOOK, loadDir } from '../scripts/check-playbook.ts'

const pb = loadDir(BUNDLED_PLAYBOOK)
const ctx = (text: string, over: Partial<{ contextTokens: number; priorCorrections: number; idleMs: number; turns: number }> = {}) =>
  ({ text, contextTokens: 0, priorCorrections: 0, idleMs: 0, turns: 0, ...over })
const ids = (text: string, severity: Severity, over = {}) => evaluate(pb, ctx(text, over), severity).map(s => s.ruleId)

describe('bundled Playbook', () => {
  test('loads with no errors', () => assert.deepEqual(pb.errors, []))

  test('bug with repro → failing-test tip', () =>
    assert.deepEqual(ids('the login page crashes when I run `npm start`', 'tip'), ['bug-test-first']))
  test('small clear-scope task → skip planning', () =>
    assert.deepEqual(ids('grill me then fix typo in readme.md', 'tip'), ['clear-scope-skip-plan']))
  test('vague change → done criteria first', () =>
    assert.equal(ids('make the dashboard page load faster for all the users please', 'tip')[0], 'no-done-criteria'))
  test('specific change with done criteria → no tip', () =>
    assert.deepEqual(ids('make src/dashboard/page.tsx load faster, it should render under 1s', 'tip'), []))
  test('questions → no change tips', () =>
    assert.deepEqual(ids('how does the billing module handle refunds for users', 'tip'), []))
  test('unscoped investigation', () =>
    assert.deepEqual(ids('investigate why the app feels slow lately', 'tip'), ['unscoped-investigation']))
  test('slash commands → no prompt tips', () => assert.deepEqual(ids('/compact now please and thanks', 'tip'), []))

  test('multi-file feature → plan-first check', () => assert.deepEqual(ids('implement a new billing feature', 'check'), ['plan-first']))
  test('feature that mentions a plan → no check', () => assert.deepEqual(ids('plan then implement a new billing feature', 'check'), []))
  test('bug with no evidence → check', () => assert.deepEqual(ids('the login page crashes', 'check'), ['bug-no-evidence']))
  test('bug with error text → no check', () =>
    assert.deepEqual(ids('login crashes with "TypeError: user is undefined"', 'check'), []))

  test('2nd correction → /clear tip, not check', () => {
    assert.deepEqual(ids('no, it still does not work at all', 'tip', { priorCorrections: 1 }), ['correction-loop'])
    assert.deepEqual(ids('no, it still does not work at all', 'check', { priorCorrections: 1 }), [])
  })
  test('3rd correction → check', () =>
    assert.deepEqual(ids('still not working', 'check', { priorCorrections: 2 }), ['correction-loop-check']))

  test('context size tip uses values.yaml threshold', () => {
    const big = { contextTokens: pb.values.contextTipTokens.value }
    const [s] = evaluate(pb, ctx('say hi in one word please', big), 'tip')
    assert.equal(s.ruleId, 'context-size')
    assert.match(s.text, /150k/)
    assert.deepEqual(ids('say hi in one word please', 'tip', { contextTokens: big.contextTokens - 1 }), [])
  })
  test('cold /compact after cache expiry', () => {
    const cold = { idleMs: pb.values.cacheTtlMs.value + 1, contextTokens: 60_000 }
    assert.deepEqual(ids('/compact', 'tip', cold), ['cold-compact'])
    assert.deepEqual(ids('/compact', 'tip', { ...cold, idleMs: 1000 }), [])
  })
  test('mid-Session /model switch', () => {
    assert.deepEqual(ids('/model opus', 'tip', { turns: 3 }), ['cache-break'])
    assert.deepEqual(ids('/model opus', 'tip'), [])
  })
})

const VALUES = 'n:\n  value: 3\n  evidence: unverified\n'
const rule = (fm: string, name = '10-x.md') => ({ name, text: `---\n${fm}\n---\nwhy` })
const errorsOf = (...files: ReturnType<typeof rule>[]) => buildPlaybook(VALUES, files).errors.join('\n')

describe('Playbook validation', () => {
  const ok = 'id: x\nseverity: tip\nwhen:\n  all:\n    - words > $n\ntext: hi'
  test('valid rule loads', () => assert.equal(errorsOf(rule(ok)), ''))
  test('unknown signal', () => assert.match(errorsOf(rule(ok.replace('words > $n', 'vibes'))), /unknown signal "vibes"/))
  test('unknown value', () => assert.match(errorsOf(rule(ok.replace('$n', '$m'))), /unknown value "\$m"/))
  test('bad severity', () => assert.match(errorsOf(rule(ok.replace('tip', 'block'))), /severity/))
  test('unknown field (typo)', () => assert.match(errorsOf(rule(`${ok}\nseverty: tip`)), /unknown field\(s\): severty/))
  test('duplicate id', () => assert.match(errorsOf(rule(ok), rule(ok, '20-y.md')), /already used by 10-x.md/))
  test('bad file does not drop the others', () => {
    const pb2 = buildPlaybook(VALUES, [rule(ok), rule('id: y', '20-y.md')])
    assert.deepEqual(pb2.rules.map(r => r.id), ['x'])
    assert.equal(pb2.errors.length, 1)
  })
  test('value needs evidence', () =>
    assert.match(buildPlaybook('n:\n  value: 3\n', []).errors.join(), /evidence/))
  test('file name order is priority', () => {
    const a = rule(ok.replace('id: x', 'id: late'), '90-late.md')
    const b = rule(ok.replace('id: x', 'id: early'), '05-early.md')
    assert.deepEqual(buildPlaybook(VALUES, [a, b]).rules.map(r => r.id), ['early', 'late'])
  })
})

describe('YAML subset', () => {
  test('maps, lists, scalars, comments', () =>
    assert.deepEqual(parseYaml('a: 1 # c\nb:\n  - x\n  - "y: z"\nc:\n  d: true\ne: \'it\'\'s\'\nf:\n- same-indent'), {
      a: 1, b: ['x', 'y: z'], c: { d: true }, e: "it's", f: ['same-indent'],
    }))
  test('unquoted ": " is rejected', () => assert.throws(() => parseYaml('text: a: b'), /quote it/))
  test('unsupported syntax is rejected', () => assert.throws(() => parseYaml('a: &anchor 1'), /unsupported/))
  test('tabs are rejected', () => assert.throws(() => parseYaml('a:\n\t- x'), /tabs/))
})
