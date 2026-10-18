// Minimal YAML subset reader. Hooks can't import npm packages, so this covers what Playbook files use:
// nested maps and `- item` lists by indentation, plain/quoted scalars, numbers, booleans, null, `#` comments.
// Anything else (anchors, tags, block scalars, flow maps) throws, so a file never silently means something else.

export type Yaml = string | number | boolean | null | Yaml[] | { [key: string]: Yaml }

type Line = { indent: number; body: string; no: number }

export class YamlError extends Error {
  constructor(message: string, line: number) {
    super(`line ${line}: ${message}`)
  }
}

const stripComment = (s: string) => {
  let quote: string | undefined
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      if (ch === quote) quote = undefined
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '#' && (i === 0 || s[i - 1] === ' ')) {
      return s.slice(0, i).trimEnd()
    }
  }
  return s
}

const scalar = (raw: string, no: number): Yaml => {
  const s = raw.trim()
  if (s.startsWith('"')) {
    if (!s.endsWith('"') || s.length < 2) throw new YamlError('unterminated "string"', no)
    try {
      return JSON.parse(s) as string
    } catch {
      throw new YamlError(`bad "string": ${s}`, no)
    }
  }
  if (s.startsWith("'")) {
    if (!s.endsWith("'") || s.length < 2) throw new YamlError("unterminated 'string'", no)
    return s.slice(1, -1).replace(/''/g, "'")
  }
  if (s === '' || s === '~' || s === 'null') return null
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === '[]') return []
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (/^[&*!|>%@`{[]/.test(s)) throw new YamlError(`unsupported YAML (quote the value): ${s}`, no)
  if (/:\s/.test(s) || s.endsWith(':')) throw new YamlError(`unquoted ": " in value (quote it): ${s}`, no)
  return s
}

const splitKey = (body: string, no: number): [string, string] => {
  const m = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(body)
  if (!m || m[1] === undefined) throw new YamlError(`expected "key: value", got: ${body}`, no)
  return [m[1], m[2] ?? '']
}

const isItem = (l: Line | undefined, indent: number): l is Line =>
  l !== undefined && l.indent === indent && (l.body === '-' || l.body.startsWith('- '))

// Parses the block of lines at `indent` starting at `at`; returns its value and the next unread line.
const block = (lines: Line[], at: number, indent: number): [Yaml, number] => {
  if (isItem(lines[at], indent)) {
    const out: Yaml[] = []
    let i = at
    for (let line = lines[i]; isItem(line, indent); line = lines[i]) {
      const rest = line.body.slice(1).trim()
      if (/^[A-Za-z_][\w-]*:(\s|$)/.test(rest)) throw new YamlError('maps inside lists are not supported', line.no)
      const child = lines[i + 1]
      if (rest !== '') {
        out.push(scalar(rest, line.no))
        i += 1
      } else if (child && child.indent > indent) {
        const [v, next] = block(lines, i + 1, child.indent)
        out.push(v)
        i = next
      } else {
        out.push(null)
        i += 1
      }
    }
    return [out, i]
  }

  const out: { [key: string]: Yaml } = {}
  let i = at
  for (let line = lines[i]; line !== undefined && line.indent === indent; line = lines[i]) {
    const [key, rest] = splitKey(line.body, line.no)
    if (key in out) throw new YamlError(`duplicate key "${key}"`, line.no)
    const child = lines[i + 1]
    if (rest === '' && child && child.indent > indent) {
      const [v, next] = block(lines, i + 1, child.indent)
      out[key] = v
      i = next
    } else if (rest === '' && isItem(child, indent)) {
      // Lists may sit at the same indent as their key.
      const [v, next] = block(lines, i + 1, indent)
      out[key] = v
      i = next
    } else {
      out[key] = scalar(rest, line.no)
      i += 1
    }
  }
  return [out, i]
}

export const parseYaml = (src: string, firstLine = 1): Yaml => {
  const lines: Line[] = []
  src.split(/\r?\n/).forEach((raw, idx) => {
    const no = idx + firstLine
    if (/^\s*\t/.test(raw)) throw new YamlError('tabs are not allowed for indentation', no)
    const body = stripComment(raw.trim())
    if (body === '' || body === '---') return
    lines.push({ indent: raw.length - raw.trimStart().length, body, no })
  })
  const first = lines[0]
  if (!first) return null
  const [v, next] = block(lines, 0, first.indent)
  const stray = lines[next]
  if (stray) throw new YamlError('unexpected indentation', stray.no)
  return v
}
