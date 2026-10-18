# OpenTelemetry is the primary data source; transcripts are backfill only

Claude Code's native OTel export gives tokens by type, cost, tool decisions and skill activations with stable, documented names. The on-disk session transcript format is explicitly internal and changes between versions, so we parse it only to import history, with a tolerant parser that skips unknown entries. Live per-turn data and Suggestions come from a Claude Code plugin (mod), not settings hooks, because only mods can observe the draft prompt and render UI above it.

## Considered Options

- Hooks only: no draft-prompt access, no UI.
- Transcripts as primary: undocumented schema, breaks on upgrades.
