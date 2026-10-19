# Suggestion outcomes are logged locally, as Signal numbers, to calibrate the Playbook

Most Playbook thresholds are `unverified` guesses. To tune them, the plugin records what happened to each Suggestion: **accepted** ("Use" pressed), **fixed** (Prompt changed so the Rule no longer matched before sending), **ignored** (Tip still matched at send) or **overridden** (held Check sent unchanged). Each event carries the Rule id, outcome, Playbook source and two sets of number Signals (`words`, `locations`, `contextTokens`, `turns`, `corrections`, `idleMs`): `shownSignals` from the draft when the Suggestion first showed (what triggered it, used for thresholds) and `signals` from the Prompt as sent. Never Prompt text. Only Prompts the Member typed count; task notifications and scheduled prompts leave a held Check pending. Events go to `~/.metron/calibration/<session>.jsonl`; `scripts/calibration-report.ts` summarises acted-on rate and Signal medians per Rule.

Why: number Signals are exactly what thresholds compare against, so "acted on at 12 words, ignored at 30" informs `$largeFeatureWords` directly, while keeping ADR 0005's promise that Prompt text stays private. Local files first: the Collector (ADR 0008) can ship them to the Server later without changing the plugin, and a Member can read what is recorded about them. One file per Session avoids two Sessions overwriting each other, since the plugin file API has no append.

Known bias: "fixed" includes Prompts that stopped matching for unrelated reasons (e.g. the Member kept typing), and outcomes don't yet say whether the Session went better (research Q9). Treat rates as a signal for review, not proof.

## Considered Options

- Store only counters in plugin storage: no per-event Signals, so thresholds can't be tuned.
- Log Prompt text: best for analysis, breaks ADR 0005 and Member trust.
- Send straight to the Server: no Server yet, and offline Sessions would lose data.
