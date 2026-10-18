import { expect, mock, test } from 'claude-code/testing'

const splice = (_$: unknown, e: any) => {
  const t = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
  return { text: t, cursor: e.start + e.inputText.length }
}

const typeAll = (text: string) => ({
  origin: { kind: 'composer' as const }, text: '', cursor: 0, start: 0, end: 0, inputText: text,
})
// A no-op edit (cursor stays at end) to read the ghost after the pause.
const nudge = (text: string) => ({
  origin: { kind: 'composer' as const }, text, cursor: text.length, start: text.length, end: text.length, inputText: '',
})
const ghost = (r: any) => (r.decorations ?? []).map((d: any) => d.virtualText ?? '').join('')

const tipAfterPause = async ($: any, on: any, text: string, waitMs: number) => {
  const clock = mock.clock(on)
  on('prompt.edit', splice)
  await $.prompt.edit(typeAll(text))
  await clock.advance(waitMs)
  return ghost(await $.prompt.edit(nudge(text)))
}

const submit = (text: string) => ({ text, origin: { kind: 'composer' as const }, wait: false })

test('bug tip shows after typing pause', async ($, on) => {
  expect(await tipAfterPause($, on, 'the login page crashes with an exception', 700)).toContain('Bug report')
})

test('no tip before the pause', async ($, on) => {
  expect(await tipAfterPause($, on, 'the login page crashes with an exception', 100)).toBe('')
})

test('small task tip', async ($, on) => {
  expect(await tipAfterPause($, on, 'grill me then fix typo in readme.md', 700)).toContain('Small task')
})

test('slash commands get no tip', async ($, on) => {
  expect(await tipAfterPause($, on, '/compact now please and thanks', 700)).toBe('')
})

test('large feature is held once, then sent on second Enter', async ($, on) => {
  on('session.start', (_$: unknown, e: any) => e)
  on('prompt.submit', (_$: unknown, e: any) => ({ text: e.text }))
  const first: any = await $.prompt.submit(submit('implement a new billing feature'))
  expect(first.drop).toContain('Large feature')
  const second: any = await $.prompt.submit(submit('implement a new billing feature'))
  expect(second.text).toBe('implement a new billing feature')
})

test('large feature that mentions a plan is not held', async ($, on) => {
  on('prompt.submit', (_$: unknown, e: any) => ({ text: e.text }))
  const r: any = await $.prompt.submit(submit('plan then implement a new billing feature'))
  expect(r.drop).toBeUndefined()
})
