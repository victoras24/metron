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

