// Signals: facts about a draft Prompt and its Session that Rule conditions refer to by name.
// Detection stays in code (regexes need tests); which Signals matter, and at what threshold, is the Playbook's call.

export type Ctx = { text: string; contextTokens: number; priorCorrections: number; idleMs: number; turns: number }

const has = (t: string, re: RegExp) => re.test(t.toLowerCase())

const CHANGE = /\b(add|build|implement|create|introduce|fix|change|update|refactor|migrate|make|remove|rename|move|replace|write|support)\b/
const FEATURE_VERB = /\b(implement|build|add|create|introduce|migrate|redesign)\b/
const BROAD = /\b(feature|system|platform|module|integration|architecture|service)\b/
const BUG = /\b(bug|error|broken|crash(es|ed|ing)?|fails?|failing|exception|stack ?trace|regression)\b/
const INVESTIGATE = /\b(investigate|look into|figure out|find out|dig into|explore)\b/
const LOCATION = /@[\w./-]+|[\w-]+\/[\w./-]+|\b[\w-]+\.[a-z]{1,5}\b|`[^`]+`|\b[a-z]+[A-Z]\w*\b|\b[A-Z][a-z]+[A-Z]\w*\b/g

export const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length
const locations = (t: string) => t.match(LOCATION)?.length ?? 0
const isQuestion = (t: string) =>
  /\?\s*$/.test(t.trim()) || /^(what|why|how|where|when|which|who|explain|does|do|is|are|can you explain|should i)\b/i.test(t.trim())
export const isCorrection = (t: string) =>
  /^(no\b|nope|still\b|wrong|that'?s (wrong|not)|not what|you (broke|didn'?t)|again\b)/i.test(t.trim()) ||
  has(t, /\b(still (fails|failing|broken|not|doesn'?t|wrong|crash\w*)|didn'?t (work|fix)|doesn'?t work|does not work|not working|same (error|problem|issue))\b/)

export const BOOLEAN_SIGNALS: Record<string, (c: Ctx) => boolean> = {
  question: c => isQuestion(c.text),
  correction: c => isCorrection(c.text),
  bug: c => has(c.text, BUG) && !isQuestion(c.text) && !isCorrection(c.text),
  change: c => words(c.text) >= 8 && has(c.text, CHANGE) && !isQuestion(c.text) && !has(c.text, BUG),
  featureVerb: c => has(c.text, FEATURE_VERB),
  broadScope: c => has(c.text, BROAD),
  investigate: c => has(c.text, INVESTIGATE),
  mentionsPlanning: c => has(c.text, /\b(plan|grill|spec|interview|design)/),
  asksForPlanning: c => has(c.text, /\b(grill|interview|ask me|plan mode|plan first|spec)\b/),
  smallChange: c => has(c.text, /\b(fix|rename|typo|small|tweak|bump|log line)\b/),
  doneCriteria: c =>
    has(c.text, /\b(should|must|expect(ed|s)?|so that|acceptance|done when|pass(es)?|returns?|tests?|verify|assert|until)\b/),
  mentionsTest: c => has(c.text, /\btests?\b/),
  errorText: c =>
    /Traceback|Error:|Exception:|\bat [\w.$<>]+ ?\(|:\d+:\d+|exit code \d+|"[^"]{8,}"|`[^`]{8,}`/.test(c.text),
  repro: c =>
    has(c.text, /\b(repro|reproduce|steps|when i|after i|run(ning)?|npm|pnpm|yarn|pytest|dotnet|cargo|go test)\b/) || /`[^`]+`/.test(c.text),
}

export const NUMBER_SIGNALS: Record<string, (c: Ctx) => number> = {
  words: c => words(c.text),
  locations: c => locations(c.text),
  contextTokens: c => c.contextTokens,
  idleMs: c => c.idleMs,
  turns: c => c.turns,
  // Consecutive corrections, counting this draft if it is one.
  corrections: c => c.priorCorrections + (isCorrection(c.text) ? 1 : 0),
}
