// PROTOTYPE — throwaway. Questions:
// 1. Can a mod watch the draft per keystroke and show Suggestions live without lag?
// 2. Does "tips while typing (after a pause) + checks on Enter (held once)" feel right?
// Rules follow docs/research/prompting-best-practices.md.
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

// Playbook values. "unverified" = no outcome data backs the number; calibrate from Team data.
const PLAYBOOK = {
  contextTipTokens: 150_000, // unverified. Research: no % threshold is supported; use absolute tokens.
  coldCompactMinTokens: 50_000, // unverified
  cacheTtlMs: 5 * 60_000, // documented Claude Code default (1 h for subscription main conversation)
  largeFeatureWords: 40, // unverified
  smallTaskWords: 20, // unverified
  correctionTip: 2, // Anthropic guidance ("corrected more than twice"), not data
  correctionCheck: 3, // unverified
}

// Hard-coded stand-in for a Team Playbook.
type Ctx = { text: string; contextTokens: number; priorCorrections: number; idleMs: number; turns: number }
type Rule = {
  id: string; severity: Severity; match: (c: Ctx) => boolean; text: string; insert?: string
  slash?: boolean // evaluated only for slash-command drafts
}

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length
const has = (t: string, re: RegExp) => re.test(t.toLowerCase())

const CHANGE = /\b(add|build|implement|create|introduce|fix|change|update|refactor|migrate|make|remove|rename|move|replace|write|support)\b/
const FEATURE_VERB = /\b(implement|build|add|create|introduce|migrate|redesign)\b/
const BROAD = /\b(feature|system|platform|module|integration|architecture|service)\b/
const BUG = /\b(bug|error|broken|crash(es|ed|ing)?|fails?|failing|exception|stack ?trace|regression)\b/
const INVESTIGATE = /\b(investigate|look into|figure out|find out|dig into|explore)\b/
const LOCATION = /@[\w./-]+|[\w-]+\/[\w./-]+|\b[\w-]+\.[a-z]{1,5}\b|`[^`]+`|\b[a-z]+[A-Z]\w*\b|\b[A-Z][a-z]+[A-Z]\w*\b/g

const isQuestion = (t: string) =>
  /\?\s*$/.test(t.trim()) || /^(what|why|how|where|when|which|who|explain|does|do|is|are|can you explain|should i)\b/i.test(t.trim())
const locations = (t: string) => t.match(LOCATION)?.length ?? 0
const hasDone = (t: string) =>
  has(t, /\b(should|must|expect(ed|s)?|so that|acceptance|done when|pass(es)?|returns?|tests?|verify|assert|until)\b/)
const hasErrorText = (t: string) =>
  /Traceback|Error:|Exception:|\bat [\w.$<>]+ ?\(|:\d+:\d+|exit code \d+|"[^"]{8,}"|`[^`]{8,}`/.test(t)
const hasRepro = (t: string) =>
  has(t, /\b(repro|reproduce|steps|when i|after i|run(ning)?|npm|pnpm|yarn|pytest|dotnet|cargo|go test)\b/) || /`[^`]+`/.test(t)
const isCorrection = (t: string) =>
  /^(no\b|nope|still\b|wrong|that'?s (wrong|not)|not what|you (broke|didn'?t)|again\b)/i.test(t.trim()) ||
  has(t, /\b(still (fails|failing|broken|not|doesn'?t|wrong|crash\w*)|didn'?t (work|fix)|doesn'?t work|does not work|not working|same (error|problem|issue))\b/)
const isBug = (c: Ctx) => has(c.text, BUG) && !isQuestion(c.text) && !isCorrection(c.text)
const isChange = (c: Ctx) => words(c.text) >= 8 && has(c.text, CHANGE) && !isQuestion(c.text) && !has(c.text, BUG)

// Order = priority for the ghost text.
const RULES: Rule[] = [
  // New Rule B: failed corrections pile up; a fresh Session with one consolidated Prompt beats more corrections.
  {
    id: 'correction-loop-check', severity: 'check',
    match: c => isCorrection(c.text) && c.priorCorrections + 1 >= PLAYBOOK.correctionCheck,
    text: 'Correction loop: /clear, then one Prompt with everything learned so far', insert: '/clear',
  },
  {
    id: 'correction-loop', severity: 'tip',
    match: c => isCorrection(c.text) && c.priorCorrections + 1 >= PLAYBOOK.correctionTip && c.priorCorrections + 1 < PLAYBOOK.correctionCheck,
    text: '2nd correction on this issue: /clear and re-prompt with everything learned usually beats correcting again', insert: '/clear',
  },
  // Rule 1 (changed): key on multi-file / uncertain, not "large". Spec + tickets are optional.
  {
    id: 'plan-first', severity: 'check',
    match: c => has(c.text, FEATURE_VERB) && !isQuestion(c.text) && !has(c.text, /\b(plan|grill|spec|interview|design)/)
      && (words(c.text) > PLAYBOOK.largeFeatureWords || has(c.text, BROAD) || locations(c.text) >= 3),
    text: 'Multi-file or unclear approach: plan first (plan mode). Needs product decisions? Interview → SPEC.md → fresh Session',
    insert: '/grilling ',
  },
  // Rule 2 (reworded): skip planning when scope is clear, not merely when the Prompt is short.
  {
    id: 'clear-scope-skip-plan', severity: 'tip',
    match: c => words(c.text) < PLAYBOOK.smallTaskWords && has(c.text, /\b(grill|interview|ask me|plan mode|plan first|spec)\b/)
      && has(c.text, /\b(fix|rename|typo|small|tweak|bump|log line)\b/) && locations(c.text) >= 1,
    text: 'Clear, small change: skip planning/interview and ask directly',
  },
  // Rule 4 (kept): reproduce first. Hold only when there is nothing to reproduce from.
  {
    id: 'bug-no-evidence', severity: 'check',
    match: c => isBug(c) && !hasErrorText(c.text) && !hasRepro(c.text),
    text: 'Bug with no error text or repro: paste the error/stack trace and how to reproduce it',
    insert: '/mattpocock-skills:diagnosing-bugs ',
  },
  {
    id: 'bug-test-first', severity: 'tip',
    match: c => isBug(c) && (hasErrorText(c.text) || hasRepro(c.text)) && !has(c.text, /\btests?\b/),
    text: 'Ask for a failing test that reproduces it first, then the fix',
    insert: '/mattpocock-skills:diagnosing-bugs ',
  },
  // New Rule E (weak evidence): unscoped investigations read many files.
  {
    id: 'unscoped-investigation', severity: 'tip',
    match: c => has(c.text, INVESTIGATE) && locations(c.text) === 0,
    text: 'Scope it to a dir/file, or have a subagent investigate and report back a summary',
  },
  // Rule 5 + New Rule A: done-criteria / runnable check first, location second.
  {
    id: 'no-done-criteria', severity: 'tip',
    match: c => isChange(c) && !hasDone(c.text),
    text: 'Say what "done" looks like and how to check it (test, command, expected output)',
  },
  {
    id: 'no-location', severity: 'tip',
    match: c => isChange(c) && !has(c.text, INVESTIGATE) && locations(c.text) === 0,
    text: 'Point to the file or symbol (@path), or an example to copy',
  },
  // Rule 3 (changed): absolute tokens, Tip only, never a Check.
  {
    id: 'context-size', severity: 'tip',
    match: c => c.contextTokens >= PLAYBOOK.contextTipTokens,
    text: `Context over ${PLAYBOOK.contextTipTokens / 1000}k tokens: at a natural break, /compact (same task) or /clear (new task)`,
    insert: '/compact',
  },
  // Rule 3c: compacting after the cache expired reprocesses the whole history at full price.
  {
    id: 'cold-compact', severity: 'tip', slash: true,
    match: c => /^\/compact\b/.test(c.text) && c.idleMs > PLAYBOOK.cacheTtlMs && c.contextTokens >= PLAYBOOK.coldCompactMinTokens,
    text: 'Cache likely expired: /compact now re-reads everything at full price. Cheaper: /clear + point to written state (spec, progress file, git)',
  },
  // New Rule D: cache-breaking actions mid-Session.
  {
    id: 'cache-break', severity: 'tip', slash: true,
    match: c => /^\/(model|effort|fast)\b/.test(c.text) && c.turns > 0,
    text: 'Switching model/effort/fast mid-Session rebuilds the prompt cache. Cheaper: pick it at Session start',
  },
]

const evaluate = (ctx: Ctx, severity?: Severity): Suggestion[] => {
  if (ctx.text.trim() === '') return []
  const isSlash = ctx.text.startsWith('/')
  return RULES.filter(r => !!r.slash === isSlash && (!severity || r.severity === severity) && r.match(ctx))
    .map(r => ({ ruleId: r.id, severity: r.severity, text: r.text, insert: r.insert }))
}

export const register: Register = on => {
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

  on('session.start', async ($, e, next) => {
    contextTokens = (await $.session.usage()).context.tokens ?? 0
    priorCorrections = 0
    turns = 0
    lastTurnAt = undefined
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    contextTokens = (await $.session.usage()).context.tokens ?? 0
    turns += 1
    lastTurnAt = await $.clock.now()
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
        const ctx = ctxFor(after, lastTurnAt === undefined ? 0 : await $.clock.now())
        const t0 = performance.now()
        const tips = words(after) < MIN_WORDS && !after.startsWith('/') ? [] : evaluate(ctx, 'tip')
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

    const isComposer = e.origin.kind === 'composer'
    const checks = isComposer ? evaluate(ctxFor(e.text, lastTurnAt === undefined ? 0 : await $.clock.now()), 'check') : []
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
              [metron-proto] edits {s.edits} (keys {s.keyEdits}, bursts {s.bursts}) · eval {s.lastEvalMs.toFixed(2)}ms (max {s.maxEvalMs.toFixed(2)}) · ctx {Math.round(contextTokens / 1000)}k · turns {turns} · corrections {priorCorrections} · tips shown {s.shown} · used {s.accepted} · held {s.held} / overridden {s.overridden} / fixed {s.fixedAfterHold}{' '}
            </Text>
            <Button key="dbg" label="Hide debug" onPress={() => update($, debugAtom, () => false)} />
          </Box>
        ) : null}
      </Box>
    )
  })
}
