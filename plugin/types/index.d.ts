import type { Suggestion } from '../hooks/playbook.ts'

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
  tipsFixed: number
  tipsIgnored: number
  logged: number
}

declare module 'claude-code' {
  interface PluginState {
    metron: { suggestions: Suggestion[]; held: Suggestion[]; stats: Stats; isDebug: boolean }
  }
}
