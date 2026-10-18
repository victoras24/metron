// Playbook: a Team's Rules as files (ADR 0003). One Markdown file per Rule (YAML frontmatter + rationale),
// plus values.yaml for thresholds. Pure functions over file text, so the same code validates a Playbook in CI.
import { BOOLEAN_SIGNALS, NUMBER_SIGNALS, type Ctx } from './signals.ts'
import { parseYaml, type Yaml } from './yaml.ts'

export type Severity = 'tip' | 'check'
export type Evidence = 'documented' | 'guidance' | 'unverified'
export type Value = { value: number; evidence: Evidence; note?: string }
export type Rule = {
  id: string
  file: string
  severity: Severity
  appliesTo: 'prompt' | 'slashCommand'
  text: string
  insert?: string
  why: string
  match: (c: Ctx) => boolean
}
export type Playbook = { rules: Rule[]; values: Record<string, Value>; errors: string[] }
export type Suggestion = { ruleId: string; severity: Severity; text: string; insert?: string }
export type PlaybookFile = { name: string; text: string }

const EVIDENCE: Evidence[] = ['documented', 'guidance', 'unverified']
const isMap = (y: Yaml): y is { [k: string]: Yaml } => typeof y === 'object' && y !== null && !Array.isArray(y)

export const parseValues = (src: string): Record<string, Value> => {
  const y = parseYaml(src)
  if (y === null) return {}
  if (!isMap(y)) throw new Error('values.yaml: expected a map of names')
  const out: Record<string, Value> = {}
  for (const [name, v] of Object.entries(y)) {
    if (!isMap(v) || typeof v.value !== 'number') throw new Error(`values.yaml: "${name}" needs a numeric "value"`)
    if (!EVIDENCE.includes(v.evidence as Evidence)) {
      throw new Error(`values.yaml: "${name}" needs "evidence" (${EVIDENCE.join(' | ')})`)
    }
    out[name] = { value: v.value, evidence: v.evidence as Evidence, note: typeof v.note === 'string' ? v.note : undefined }
  }
  return out
}

const CMP: Record<string, (a: number, b: number) => boolean> = {
  '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a === b,
  '!=': (a, b) => a !== b, '>': (a, b) => a > b, '<': (a, b) => a < b,
}

// Condition forms: `signal`, `not signal`, `signal >= 3`, `signal < $valueName`, `text ~ /regex/i`, `not text ~ /regex/`.
export const compileCondition = (src: string, values: Record<string, Value>): ((c: Ctx) => boolean) => {
  const s = src.trim()
  const re = /^(not\s+)?text\s*~\s*\/(.+)\/([a-z]*)$/.exec(s)
  if (re) {
    const [, isNot, pattern = '', flags = ''] = re
    let rx: RegExp
    try {
      rx = new RegExp(pattern, flags)
    } catch {
      throw new Error(`bad regex in "${s}"`)
    }
    return isNot ? c => !rx.test(c.text) : c => rx.test(c.text)
  }
  const bool = /^(not\s+)?([A-Za-z]\w*)$/.exec(s)
  if (bool) {
    const [, isNot, name = ''] = bool
    const f = BOOLEAN_SIGNALS[name]
    if (!f) throw new Error(`unknown signal "${name}" (known: ${Object.keys(BOOLEAN_SIGNALS).join(', ')})`)
    return isNot ? c => !f(c) : f
  }
  const num = /^([A-Za-z]\w*)\s*(>=|<=|==|!=|>|<)\s*(\$?[A-Za-z0-9_]+)$/.exec(s)
  if (num) {
    const [, name = '', op = '', rhs = ''] = num
    const f = NUMBER_SIGNALS[name]
    if (!f) throw new Error(`unknown number signal "${name}" (known: ${Object.keys(NUMBER_SIGNALS).join(', ')})`)
    let n: number
    if (rhs.startsWith('$')) {
      const v = values[rhs.slice(1)]
      if (!v) throw new Error(`unknown value "${rhs}" (define it in values.yaml)`)
      n = v.value
    } else if (/^\d+$/.test(rhs)) {
      n = Number(rhs)
    } else {
      throw new Error(`expected a number or $value after "${op}" in "${s}"`)
    }
    const cmp = CMP[op]!
    return c => cmp(f(c), n)
  }
  throw new Error(`can't read condition "${s}"`)
}

const fmt = (n: number) => (n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : String(n))

// `{name}` in text → the value, 150000 shown as 150k.
const interpolate = (text: string, values: Record<string, Value>) =>
  text.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = values[name]
    if (!v) throw new Error(`unknown value "{${name}}" in text`)
    return fmt(v.value)
  })

const stringList = (y: Yaml | undefined, field: string): string[] => {
  if (y === undefined || y === null) return []
  if (!Array.isArray(y) || y.some(x => typeof x !== 'string')) throw new Error(`"${field}" must be a list of conditions`)
  return y as string[]
}

export const parseRule = (file: PlaybookFile, values: Record<string, Value>): Rule => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/.exec(file.text)
  if (!m) throw new Error('must start with YAML frontmatter between --- lines')
  const fm = parseYaml(m[1] ?? '', 2)
  if (!isMap(fm)) throw new Error('frontmatter must be a map')
  const known = ['id', 'severity', 'appliesTo', 'when', 'text', 'insert']
  const extra = Object.keys(fm).filter(k => !known.includes(k))
  if (extra.length) throw new Error(`unknown field(s): ${extra.join(', ')}`)

  const { id, severity, appliesTo = 'prompt', when, text, insert } = fm
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) throw new Error('"id" must be kebab-case')
  if (severity !== 'tip' && severity !== 'check') throw new Error('"severity" must be tip or check')
  if (appliesTo !== 'prompt' && appliesTo !== 'slashCommand') throw new Error('"appliesTo" must be prompt or slashCommand')
  if (typeof text !== 'string' || text.trim() === '') throw new Error('"text" is required')
  if (insert !== undefined && insert !== null && typeof insert !== 'string') throw new Error('"insert" must be text')
  if (!isMap(when ?? null)) throw new Error('"when" must have "all" and/or "any" lists')
  const w = when as { [k: string]: Yaml }
  const whenExtra = Object.keys(w).filter(k => k !== 'all' && k !== 'any')
  if (whenExtra.length) throw new Error(`unknown "when" field(s): ${whenExtra.join(', ')}`)

  const all = stringList(w.all, 'when.all').map(c => compileCondition(c, values))
  const any = stringList(w.any, 'when.any').map(c => compileCondition(c, values))
  if (all.length + any.length === 0) throw new Error('"when" has no conditions')

  return {
    id, file: file.name, severity, appliesTo, text: interpolate(text, values),
    insert: typeof insert === 'string' ? insert : undefined,
    why: (m[2] ?? '').trim(),
    match: c => all.every(f => f(c)) && (any.length === 0 || any.some(f => f(c))),
  }
}

// Bad files are reported and skipped; the rest of the Playbook still works.
export const buildPlaybook = (valuesSrc: string | undefined, ruleFiles: PlaybookFile[]): Playbook => {
  const errors: string[] = []
  let values: Record<string, Value> = {}
  if (valuesSrc !== undefined) {
    try {
      values = parseValues(valuesSrc)
    } catch (e) {
      errors.push(String((e as Error).message))
    }
  }
  const rules: Rule[] = []
  // File name order = priority (e.g. 10-correction-loop-check.md before 20-...).
  for (const f of [...ruleFiles].sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const r = parseRule(f, values)
      const dup = rules.find(x => x.id === r.id)
      if (dup) throw new Error(`id "${r.id}" already used by ${dup.file}`)
      rules.push(r)
    } catch (e) {
      errors.push(`${f.name}: ${(e as Error).message}`)
    }
  }
  return { rules, values, errors }
}

export const valueOf = (pb: Playbook, name: string, fallback: number) => pb.values[name]?.value ?? fallback

export const evaluate = (pb: Playbook, ctx: Ctx, severity?: Severity): Suggestion[] => {
  if (ctx.text.trim() === '') return []
  const isSlash = ctx.text.startsWith('/')
  return pb.rules
    .filter(r => (r.appliesTo === 'slashCommand') === isSlash && (!severity || r.severity === severity) && r.match(ctx))
    .map(r => ({ ruleId: r.id, severity: r.severity, text: r.text, insert: r.insert }))
}
