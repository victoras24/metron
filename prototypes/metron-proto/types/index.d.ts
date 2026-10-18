export type Severity = 'tip' | 'check'
export type Suggestion = { ruleId: string; severity: Severity; text: string; insert?: string }
export type Stats = {
  edits: number
  keyEdits: number
  bursts: number
  lastEvalMs: number
  maxEvalMs: number
  shown: number
  accepted: number
  held: number
  overridden: number
  fixedAfterHold: number
}

declare module 'claude-code' {
  interface PluginState {
    'metron-proto': { suggestions: Suggestion[]; held: Suggestion[]; stats: Stats; isDebug: boolean }
  }
}
