// Wiring: Playbook loading, typing pause, hold-once, correction count. Rule content is tested in playbook.spec.ts.
import { expect, mock, test } from 'claude-code/testing'

const VALUES = 'tipPauseMs:\n  value: 600\n  evidence: unverified\ntipMinWords:\n  value: 2\n  evidence: unverified\n'
const TIP = '---\nid: say-why\nseverity: tip\nwhen:\n  all:\n    - text ~ /please/\ntext: "Say why"\n---\n'
const CHECK = '---\nid: no-yolo\nseverity: check\nwhen:\n  all:\n    - text ~ /yolo/\ntext: "No yolo"\n---\n'
const CORRECTION = '---\nid: loop\nseverity: check\nwhen:\n  all:\n    - corrections >= 3\ntext: "Loop"\n---\n'

// Serves files from memory. Keys are path suffixes: 'playbook/...' (bundled) or '.metron/playbook/...' (Team).
// Hooks can't close over locals, so the current test's files sit at module level.
let FILES: Record<string, string> = {}
const hits = (path: string, key: string) =>
  (path === key || path.endsWith(`/${key}`)) && (key.startsWith('.metron/') || !path.includes('/.metron/'))
const dirsOf = (k: string) => k.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))
const fsExists = (_$: unknown, e: any) => ({ value: Object.keys(FILES).some(k => hits(e.path, k) || dirsOf(k).some(d => hits(e.path, d))) })
const fsRead = (_$: unknown, e: any) => {
  const k = Object.keys(FILES).find(k => hits(e.path, k))
  return k === undefined ? { deny: `ENOENT ${e.path}` } : { value: FILES[k] }
}
const fsList = (_$: unknown, e: any) => ({
  value: Object.keys(FILES).filter(k => hits(e.path, k.slice(0, k.lastIndexOf('/'))))
    .map(k => ({ name: k.slice(k.lastIndexOf('/') + 1), kind: 'file', size: 1, mtimeMs: 0, isLink: false })),
})

const mockFs = (on: any, files: Record<string, string>) => {
  FILES = files
  on('fs.exists', fsExists)
  on('fs.read', fsRead)
  on('fs.list', fsList)
}

const bundled = (rules: Record<string, string>) => ({
  'playbook/values.yaml': VALUES,
  ...Object.fromEntries(Object.entries(rules).map(([n, t]) => [`playbook/rules/${n}`, t])),
})

const splice = (_$: unknown, e: any) => {
  const t = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
  return { text: t, cursor: e.start + e.inputText.length }
}
const typeAll = (text: string) => ({ origin: { kind: 'composer' as const }, text: '', cursor: 0, start: 0, end: 0, inputText: text })
const nudge = (text: string) => ({
  origin: { kind: 'composer' as const }, text, cursor: text.length, start: text.length, end: text.length, inputText: '',
})
const ghost = (r: any) => (r.decorations ?? []).map((d: any) => d.virtualText ?? '').join('')
const submit = (text: string) => ({ text, origin: { kind: 'composer' as const }, wait: false })
const passthrough = (on: any) => on('prompt.submit', (_$: unknown, e: any) => ({ text: e.text }))

const tipAfterPause = async ($: any, on: any, text: string, waitMs: number) => {
  const clock = mock.clock(on)
  on('prompt.edit', splice)
  await $.prompt.edit(typeAll(text))
  await clock.advance(waitMs)
  return ghost(await $.prompt.edit(nudge(text)))
}

test('tip from a Playbook file shows after the typing pause', async ($, on) => {
  mockFs(on, bundled({ '10-say-why.md': TIP }))
  expect(await tipAfterPause($, on, 'fix it please', 700)).toContain('Say why')
})

test('no tip before the pause', async ($, on) => {
  mockFs(on, bundled({ '10-say-why.md': TIP }))
  expect(await tipAfterPause($, on, 'fix it please', 100)).toBe('')
})

test('check holds once, second Enter sends', async ($, on) => {
  mockFs(on, bundled({ '10-no-yolo.md': CHECK }))
  passthrough(on)
  const first: any = await $.prompt.submit(submit('ship it yolo'))
  expect(first.drop).toContain('No yolo')
  const second: any = await $.prompt.submit(submit('ship it yolo'))
  expect(second.text).toBe('ship it yolo')
})

test('Team Playbook in .metron/playbook replaces the bundled one', async ($, on) => {
  mockFs(on, {
    ...bundled({ '10-no-yolo.md': CHECK }),
    '.metron/playbook/values.yaml': VALUES,
    '.metron/playbook/rules/10-say-why.md': TIP.replace('tip', 'check'),
  })
  passthrough(on)
  expect(((await $.prompt.submit(submit('ship it yolo'))) as any).drop).toBeUndefined()
  expect(((await $.prompt.submit(submit('ship it please'))) as any).drop).toContain('Say why')
})

test('a broken Rule file is skipped, the rest still work', async ($, on) => {
  mockFs(on, bundled({ '05-broken.md': '---\nid: broken\nseverity: block\n---\n', '10-no-yolo.md': CHECK }))
  passthrough(on)
  expect(((await $.prompt.submit(submit('ship it yolo'))) as any).drop).toContain('No yolo')
})

test('consecutive corrections count; a normal Prompt resets', async ($, on) => {
  mockFs(on, bundled({ '10-loop.md': CORRECTION }))
  passthrough(on)
  await $.prompt.submit(submit('that still does not work'))
  await $.prompt.submit(submit('say hi in one word'))
  await $.prompt.submit(submit('no, still broken'))
  expect(((await $.prompt.submit(submit('still not working'))) as any).drop).toBeUndefined()
  expect(((await $.prompt.submit(submit('still broken'))) as any).drop).toContain('Loop')
})


const TURNS = '---\nid: needs-turn\nseverity: check\nwhen:\n  all:\n    - turns > 0\ntext: "Mid-Session"\n---\n'
const turnDone = (agentId?: string) => ({ reason: 'answer', text: '', ...(agentId ? { agentId } : {}) }) as any

test('/clear (session.end) resets turns', async ($, on) => {
  mockFs(on, bundled({ '10-needs-turn.md': TURNS }))
  passthrough(on)
  on('session.usage', () => ({ value: { context: { tokens: 0 } } }))
  on('turn.complete', () => ({ text: '' }))
  on('session.end', () => ({ sessionId: 'x' }))
  await $.turn.complete(turnDone())
  expect(((await $.prompt.submit(submit('hello there'))) as any).drop).toContain('Mid-Session')
  await $.session.end({ reason: 'clear' } as any)
  expect(((await $.prompt.submit(submit('hello again'))) as any).drop).toBeUndefined()
})

test('subagent turns do not count', async ($, on) => {
  mockFs(on, bundled({ '10-needs-turn.md': TURNS }))
  passthrough(on)
  on('session.usage', () => ({ value: { context: { tokens: 0 } } }))
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(turnDone('agent-1'))
  expect(((await $.prompt.submit(submit('hello there'))) as any).drop).toBeUndefined()
})

// Calibration log: captured fs.write calls, keyed by path.
let WRITES: Record<string, string> = {}
const logged = () => Object.values(WRITES).flatMap(t => t.trim().split('\n')).map(l => JSON.parse(l))
const mockLog = (on: any, withClock = true) => {
  WRITES = {}
  mock.env(on, { HOME: '/home/m' })
  if (withClock) mock.clock(on)
  on('session.id', () => ({ value: 's1' }))
  on('fs.write', (_$: unknown, e: any) => {
    WRITES[e.path] = e.text
    return { value: undefined }
  })
}

test('held Check sent unchanged logs overridden, without Prompt text', async ($, on) => {
  mockFs(on, bundled({ '10-no-yolo.md': CHECK }))
  mockLog(on)
  passthrough(on)
  await $.prompt.submit(submit('ship it yolo'))
  await $.prompt.submit(submit('ship it yolo'))
  expect(Object.keys(WRITES)).toEqual(['/home/m/.metron/calibration/s1.jsonl'])
  const [ev] = logged()
  expect(ev).toMatchObject({ ruleId: 'no-yolo', severity: 'check', outcome: 'overridden', playbook: 'bundled', session: 's1' })
  expect(ev.signals.words).toBe(3)
  expect(JSON.stringify(WRITES)).not.toContain('yolo"')
})

test('held Check fixed by editing logs fixed', async ($, on) => {
  mockFs(on, bundled({ '10-no-yolo.md': CHECK }))
  mockLog(on)
  passthrough(on)
  await $.prompt.submit(submit('ship it yolo'))
  await $.prompt.submit(submit('ship it carefully'))
  expect(logged().map(e => e.outcome)).toEqual(['fixed'])
})

test('shown Tip: still matching at send → ignored, edited away → fixed', async ($: any, on) => {
  mockFs(on, bundled({ '10-say-why.md': TIP }))
  passthrough(on)
  const clock = mock.clock(on)
  mockLog(on, false)
  on('prompt.edit', splice)
  await $.prompt.edit(typeAll('fix it please'))
  await clock.advance(700)
  await $.prompt.submit(submit('fix it please'))
  await $.prompt.edit(typeAll('fix it please'))
  await clock.advance(700)
  await $.prompt.submit(submit('fix it because tests fail'))
  const evs = logged()
  expect(evs.map(e => `${e.ruleId}:${e.outcome}`)).toEqual(['say-why:ignored', 'say-why:fixed'])
  // The fixed Tip logs the draft that triggered it (3 words), not the sent Prompt (5 words).
  expect([evs[1].shownSignals.words, evs[1].signals.words]).toEqual([3, 5])
})

test('a non-composer send (e.g. task notification) leaves a held Check pending', async ($, on) => {
  mockFs(on, bundled({ '10-no-yolo.md': CHECK }))
  mockLog(on)
  passthrough(on)
  await $.prompt.submit(submit('ship it yolo'))
  await $.prompt.submit({ text: 'task finished', origin: { kind: 'task-notification' }, wait: false } as any)
  expect(logged()).toEqual([])
  const again: any = await $.prompt.submit(submit('ship it yolo'))
  expect(again.text).toBe('ship it yolo')
  expect(logged().map(e => e.outcome)).toEqual(['overridden'])
})

test('Windows: logs under USERPROFILE when HOME is unset', async ($, on) => {
  mockFs(on, bundled({ '10-no-yolo.md': CHECK }))
  WRITES = {}
  mock.env(on, { USERPROFILE: '/Users/m' })
  mock.clock(on)
  on('session.id', () => ({ value: 's1' }))
  on('fs.write', (_$: unknown, e: any) => {
    WRITES[e.path] = e.text
    return { value: undefined }
  })
  passthrough(on)
  await $.prompt.submit(submit('ship it yolo'))
  await $.prompt.submit(submit('ship it yolo'))
  expect(Object.keys(WRITES)).toEqual(['/Users/m/.metron/calibration/s1.jsonl'])
})

test('a failing session id does not stop a Check from holding', async ($, on) => {
  mockFs(on, bundled({ '10-no-yolo.md': CHECK }))
  mock.env(on, { HOME: '/home/m' })
  mock.clock(on)
  on('session.id', () => ({ deny: 'no session' }))
  passthrough(on)
  await $.prompt.submit(submit('ship it yolo'))
  expect(((await $.prompt.submit(submit('ship it carefully yolo'))) as any).drop).toContain('No yolo')
})

test('a task notification keeps the draft\'s Tip', async ($: any, on) => {
  mockFs(on, bundled({ '10-say-why.md': TIP }))
  passthrough(on)
  const clock = mock.clock(on)
  on('prompt.edit', splice)
  await $.prompt.edit(typeAll('fix it please'))
  await clock.advance(700)
  await $.prompt.submit({ text: 'task finished', origin: { kind: 'task-notification' }, wait: false } as any)
  expect(ghost(await $.prompt.edit(nudge('fix it please')))).toContain('Say why')
})
