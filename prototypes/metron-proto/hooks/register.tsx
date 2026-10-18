// PROTOTYPE — throwaway. Questions:
// 1. Can a mod watch the draft per keystroke and show Suggestions live without lag?
// 2. Does "tips while typing (after a pause) + checks on Enter (held once)" feel right?
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Severity, Stats, Suggestion } from '../types'

const suggestionsAtom = atom({ plugin: 'metron-proto', key: 'suggestions' } as const, [] as Suggestion[])
const heldAtom = atom({ plugin: 'metron-proto', key: 'held' } as const, [] as Suggestion[])
const statsAtom = atom({ plugin: 'metron-proto', key: 'stats' } as const, {
  edits: 0, keyEdits: 0, bursts: 0, lastEvalMs: 0, maxEvalMs: 0,
  shown: 0, accepted: 0, held: 0, overridden: 0, fixedAfterHold: 0,
} as Stats)
const debugAtom = atom({ plugin: 'metron-proto', key: 'isDebug' } as const, true)

const PAUSE_MS = 600
const MIN_WORDS = 5

// Hard-coded stand-in for a Team Playbook.
type Ctx = { text: string; contextPercent: number }
type Rule = { id: string; severity: Severity; match: (c: Ctx) => boolean; text: string; insert?: string }

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length
const has = (t: string, re: RegExp) => re.test(t.toLowerCase())

const RULES: Rule[] = [
  {
    id: 'long-session', severity: 'check',
    match: c => c.contextPercent >= 60,
    text: 'Context is over 60% full: /compact or /clear and start fresh', insert: '/compact',
  },
  {
    id: 'large-feature', severity: 'check',
    match: c => has(c.text, /\b(implement|build|add|create|introduce)\b/) && (words(c.text) > 40 || has(c.text, /\b(feature|system|platform|module|integration)\b/)) && !has(c.text, /\b(plan|grill|spec)/),
    text: 'Large feature: plan first → specs → tickets → implement each ticket', insert: '/grilling ',
  },
  {
    id: 'small-task-no-grill', severity: 'tip',
    match: c => words(c.text) < 20 && has(c.text, /grill/) && has(c.text, /\b(fix|rename|typo|small|tweak|bump)\b/),
    text: 'Small task: skip the grilling session, just ask directly',
  },
  {
    id: 'bug', severity: 'tip',
    match: c => has(c.text, /\b(bug|error|broken|crash|crashes|fails?|exception|stack ?trace)\b/),
    text: 'Bug report: try the diagnosing skill for a reproduce → fix loop', insert: '/mattpocock-skills:diagnosing-bugs ',
  },
  {
    id: 'vague', severity: 'tip',
    match: c => words(c.text) >= 8 && !/[\w-]+\/[\w./-]+|\.\w{1,4}\b|`/.test(c.text) && !has(c.text, /\b(should|must|expect|so that|acceptance)\b/),
    text: 'Add file paths and what "done" looks like (acceptance criteria)',
  },
]

const evaluate = (ctx: Ctx, severity?: Severity): Suggestion[] =>
  ctx.text.trim() === '' || ctx.text.startsWith('/')
    ? []
    : RULES.filter(r => (!severity || r.severity === severity) && r.match(ctx))
        .map(r => ({ ruleId: r.id, severity: r.severity, text: r.text, insert: r.insert }))

export const register: Register = on => {
  let contextPercent = 0
  let settledIds: string[] = []
  let pause: { cancel: () => void } | undefined
  let heldText: string | undefined

  on('session.start', async ($, e, next) => {
    contextPercent = (await $.session.usage()).context.percent ?? 0
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    contextPercent = (await $.session.usage()).context.percent ?? 0
    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const after = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    const isTyping = after !== e.text

    if (isTyping) {
      await update($, statsAtom, s => ({
        ...s,
        edits: s.edits + 1,
        keyEdits: s.keyEdits + (e.key ? 1 : 0),
        bursts: s.bursts + (!e.key && e.inputText.length > 1 ? 1 : 0),
      }))

      // Tips wait for a typing pause, so half-written drafts don't flicker.
      pause?.cancel()
      pause = $.clock.after(PAUSE_MS, async () => {
        const t0 = performance.now()
        const tips = words(after) < MIN_WORDS ? [] : evaluate({ text: after, contextPercent }, 'tip')
        const evalMs = performance.now() - t0
        const ids = tips.map(t => t.ruleId)
        const fresh = ids.filter(id => !settledIds.includes(id)).length
        settledIds = ids
        await update($, suggestionsAtom, () => tips)
        await update($, statsAtom, s => ({
          ...s, lastEvalMs: evalMs, maxEvalMs: Math.max(s.maxEvalMs, evalMs), shown: s.shown + fresh,
        }))
      })
    }

    const r = await next(e)
    if (r.cursor !== r.text.length) return r

    // Ghost text: top settled tip, if it still matches what's in the box now.
    const ctx: Ctx = { text: r.text, contextPercent }
    const top = (await read($, suggestionsAtom)).find(s => RULES.find(x => x.id === s.ruleId)?.match(ctx))
    if (!top) return r
    return {
      ...r,
      decorations: [
        ...(r.decorations ?? []),
        { start: r.text.length, end: r.text.length, virtualText: `  ⟵ ${top.text}`, dimColor: true },
      ],
    }
  })

  on('prompt.submit', async ($, e, next) => {
    pause?.cancel()
    settledIds = []
    await update($, suggestionsAtom, () => [])

    const checks = e.origin.kind === 'composer' ? evaluate({ text: e.text, contextPercent }, 'check') : []
    const wasHeld = heldText !== undefined

    // Same text sent again after a hold → Member overrides; let it through.
    if (checks.length > 0 && heldText !== e.text) {
      heldText = e.text
      await update($, heldAtom, () => checks)
      await update($, statsAtom, s => ({ ...s, held: s.held + 1 }))
      return { drop: `Metron check: ${checks.map(c => c.text).join(' · ')} — press Enter again to send anyway` }
    }

    await update($, statsAtom, s => ({
      ...s,
      overridden: s.overridden + (wasHeld && heldText === e.text ? 1 : 0),
      fixedAfterHold: s.fixedAfterHold + (wasHeld && heldText !== e.text ? 1 : 0),
    }))
    heldText = undefined
    await update($, heldAtom, () => [])
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)
    const tips = await read($, suggestionsAtom)
    const held = await read($, heldAtom)
    const isDebug = await read($, debugAtom)
    const s = await read($, statsAtom)
    const rows = [...held, ...tips]
    if (rows.length === 0 && !isDebug) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {rows.map(sg => (
          <Box key={`${sg.severity}-${sg.ruleId}`}>
            {sg.severity === 'check'
              ? <Text color="yellow">⛔ Held: {sg.text} (Enter again sends anyway) </Text>
              : <Text color="cyan">💡 {sg.text} </Text>}
            {sg.insert ? (
              <Button
                key={`use-${sg.severity}-${sg.ruleId}`}
                label={`Use ${sg.insert.trim()}`}
                onPress={async () => {
                  await $.prompt.fill({ text: sg.insert!, mode: 'insert' })
                  await update($, statsAtom, x => ({ ...x, accepted: x.accepted + 1 }))
                }}
              />
            ) : null}
          </Box>
        ))}
        {isDebug ? (
          <Box>
            <Text dimColor>
              [metron-proto] edits {s.edits} (keys {s.keyEdits}, bursts {s.bursts}) · eval {s.lastEvalMs.toFixed(2)}ms (max {s.maxEvalMs.toFixed(2)}) · ctx {contextPercent}% · tips shown {s.shown} · used {s.accepted} · held {s.held} / overridden {s.overridden} / fixed {s.fixedAfterHold}{' '}
            </Text>
            <Button key="dbg" label="Hide debug" onPress={() => update($, debugAtom, () => false)} />
          </Box>
        ) : null}
      </Box>
    )
  })
}
