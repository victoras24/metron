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

const passthrough = (on: any) => on('prompt.submit', (_$: unknown, e: any) => ({ text: e.text }))

test('bug with repro gets failing-test tip after typing pause', async ($, on) => {
  expect(await tipAfterPause($, on, 'the login page crashes when I run `npm start`', 700)).toContain('failing test')
})

test('no tip before the pause', async ($, on) => {
  expect(await tipAfterPause($, on, 'the login page crashes when I run `npm start`', 100)).toBe('')
})

test('small clear-scope task tip', async ($, on) => {
  expect(await tipAfterPause($, on, 'grill me then fix typo in readme.md', 700)).toContain('skip planning')
})

test('vague change asks for done criteria first', async ($, on) => {
  expect(await tipAfterPause($, on, 'make the dashboard page load faster for all the users please', 700)).toContain('"done"')
})

test('specific change with done criteria gets no tip', async ($, on) => {
  expect(await tipAfterPause($, on, 'make src/dashboard/page.tsx load faster, it should render under 1s', 700)).toBe('')
})

test('questions get no change tips', async ($, on) => {
  expect(await tipAfterPause($, on, 'how does the billing module handle refunds for users', 700)).toBe('')
})

test('unscoped investigation tip', async ($, on) => {
  expect(await tipAfterPause($, on, 'investigate why the app feels slow lately', 700)).toContain('subagent')
})

test('slash commands get no prompt tips', async ($, on) => {
  expect(await tipAfterPause($, on, '/compact now please and thanks', 700)).toBe('')
})

test('multi-file feature is held once, then sent on second Enter', async ($, on) => {
  on('session.start', (_$: unknown, e: any) => e)
  passthrough(on)
  const first: any = await $.prompt.submit(submit('implement a new billing feature'))
  expect(first.drop).toContain('plan first')
  const second: any = await $.prompt.submit(submit('implement a new billing feature'))
  expect(second.text).toBe('implement a new billing feature')
})

test('feature that mentions a plan is not held', async ($, on) => {
  passthrough(on)
  const r: any = await $.prompt.submit(submit('plan then implement a new billing feature'))
  expect(r.drop).toBeUndefined()
})

test('bug with no error text or repro is held', async ($, on) => {
  passthrough(on)
  const r: any = await $.prompt.submit(submit('the login page crashes'))
  expect(r.drop).toContain('repro')
})

test('bug with error text is not held', async ($, on) => {
  passthrough(on)
  const r: any = await $.prompt.submit(submit('login crashes with "TypeError: user is undefined"'))
  expect(r.drop).toBeUndefined()
})

test('2nd correction gets /clear tip', async ($, on) => {
  const clock = mock.clock(on)
  passthrough(on)
  on('prompt.edit', splice)
  await $.prompt.submit(submit('that still does not work'))
  const text = 'no, it still does not work at all'
  await $.prompt.edit(typeAll(text))
  await clock.advance(700)
  expect(ghost(await $.prompt.edit(nudge(text)))).toContain('/clear')
})

test('3rd correction is held', async ($, on) => {
  passthrough(on)
  await $.prompt.submit(submit('that still does not work'))
  await $.prompt.submit(submit('no, still broken'))
  const r: any = await $.prompt.submit(submit('still not working'))
  expect(r.drop).toContain('Correction loop')
})

test('a normal Prompt resets the correction count', async ($, on) => {
  passthrough(on)
  await $.prompt.submit(submit('that still does not work'))
  await $.prompt.submit(submit('say hi in one word'))
  await $.prompt.submit(submit('no, still broken'))
  const r: any = await $.prompt.submit(submit('still not working'))
  expect(r.drop).toBeUndefined()
})
