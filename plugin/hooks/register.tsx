// Metron Claude Code plugin: live Suggestions from the Team Playbook (Tips while typing, Checks on Enter).
// Rules and thresholds live in Playbook files (ADR 0003); this file only wires them into Claude Code.
import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Register } from 'claude-code'

import type { Stats } from '../types'
import { buildPlaybook, evaluate, valueOf, type Playbook, type PlaybookFile, type Suggestion } from './playbook.ts'
import { isCorrection, words, type Ctx } from './signals.ts'

const suggestionsAtom = atom({ plugin: 'metron', key: 'suggestions' } as const, [] as Suggestion[])
const heldAtom = atom({ plugin: 'metron', key: 'held' } as const, [] as Suggestion[])
const statsAtom = atom({ plugin: 'metron', key: 'stats' } as const, {
  edits: 0, keyEdits: 0, bursts: 0, lastEvalMs: 0, maxEvalMs: 0,
  shown: 0, accepted: 0, held: 0, overridden: 0, fixedAfterHold: 0,
} as Stats)
const debugAtom = atom({ plugin: 'metron', key: 'isDebug' } as const, true)

// A Team Playbook in the project (committed, changed via PR) replaces the bundled default entirely.
export const TEAM_PLAYBOOK_DIR = '.metron/playbook'

type Loaded = Playbook & { source: string }

const loadPlaybook = async ($: Pick<CoreEngineInterface, 'fs' | 'plugin'>): Promise<Loaded> => {
  let dir = TEAM_PLAYBOOK_DIR
  try {
    if (!(await $.fs.exists(TEAM_PLAYBOOK_DIR))) dir = `${$.plugin.root}/playbook`
    const valuesPath = `${dir}/values.yaml`
    const values = (await $.fs.exists(valuesPath)) ? await $.fs.read(valuesPath) : undefined
    const files: PlaybookFile[] = []
    for (const f of await $.fs.list(`${dir}/rules`)) {
      if (f.kind === 'file' && f.name.endsWith('.md')) files.push({ name: f.name, text: await $.fs.read(`${dir}/rules/${f.name}`) })
    }
    return { ...buildPlaybook(values, files), source: dir }
  } catch (e) {
    return { rules: [], values: {}, errors: [`can't read ${dir}: ${String(e)}`], source: dir }
  }
}

export const register: Register = on => {
  let pb: Loaded | undefined
  let contextTokens = 0
  let priorCorrections = 0
  let turns = 0
  let lastTurnAt: number | undefined
  let settledIds: string[] = []
  let pause: { cancel: () => void } | undefined
  let heldText: string | undefined

  // Idle time only matters once a turn has completed, so skip the clock read before that.
  const ctxFor = (text: string, now: number): Ctx => ({
    text, contextTokens, priorCorrections, turns,
    idleMs: lastTurnAt === undefined ? 0 : now - lastTurnAt,
  })

  const resetSession = () => {
    contextTokens = 0
    priorCorrections = 0
    turns = 0
    lastTurnAt = undefined
    heldText = undefined
    settledIds = []
  }

  on('session.start', async ($, e, next) => {
    resetSession()
    pb = await loadPlaybook($)
    contextTokens = (await $.session.usage()).context.tokens ?? 0
    return next(e)
  })

  // session.start never fires on /clear; session.end does. Drop the Playbook so the next use re-reads it.
  on('session.end', async ($, e, next) => {
    pause?.cancel()
    resetSession()
    pb = undefined
    await update($, suggestionsAtom, () => [])
    await update($, heldAtom, () => [])
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e) // subagent turns aren't the Member's turns
    contextTokens = (await $.session.usage()).context.tokens ?? 0
    turns += 1
    lastTurnAt = await $.clock.now()
    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const book = (pb ??= await loadPlaybook($))
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
      pause = $.clock.after(valueOf(book, 'tipPauseMs', 600), async () => {
        const ctx = ctxFor(after, lastTurnAt === undefined ? 0 : await $.clock.now())
        const t0 = performance.now()
        const isTooShort = words(after) < valueOf(book, 'tipMinWords', 5) && !after.startsWith('/')
        const tips = isTooShort ? [] : evaluate(book, ctx, 'tip')
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
    const ctx = ctxFor(r.text, lastTurnAt === undefined ? 0 : await $.clock.now())
    const top = (await read($, suggestionsAtom)).find(s => book.rules.find(x => x.id === s.ruleId)?.match(ctx))
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
    const book = (pb ??= await loadPlaybook($))
    pause?.cancel()
    settledIds = []
    await update($, suggestionsAtom, () => [])

    const isComposer = e.origin.kind === 'composer'
    const checks = isComposer ? evaluate(book, ctxFor(e.text, lastTurnAt === undefined ? 0 : await $.clock.now()), 'check') : []
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

    // Count consecutive correction Prompts; anything else (incl. /clear) resets.
    if (isComposer) priorCorrections = isCorrection(e.text) && !e.text.startsWith('/') ? priorCorrections + 1 : 0
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)
    const book = (pb ??= await loadPlaybook($))
    const tips = await read($, suggestionsAtom)
    const held = await read($, heldAtom)
    const isDebug = await read($, debugAtom)
    const s = await read($, statsAtom)
    const rows = [...held, ...tips]
    if (rows.length === 0 && book.errors.length === 0 && !isDebug) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {book.errors.map((err, i) => (
          <Box key={`err-${i}`}>
            <Text color="red">Metron Playbook ({book.source}): {err} </Text>
          </Box>
        ))}
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
              [metron] playbook {book.source} ({book.rules.length} rules) · edits {s.edits} · eval {s.lastEvalMs.toFixed(2)}ms (max {s.maxEvalMs.toFixed(2)}) · ctx {Math.round(contextTokens / 1000)}k · turns {turns} · corrections {priorCorrections} · tips shown {s.shown} · used {s.accepted} · held {s.held} / overridden {s.overridden} / fixed {s.fixedAfterHold}{' '}
            </Text>
            <Button key="dbg" label="Hide debug" onPress={() => update($, debugAtom, () => false)} />
          </Box>
        ) : null}
      </Box>
    )
  })
}
