# Research brief: evidence-based prompting best practices for agentic coding

## Why
Metron's Playbook Rules (Tips/Checks) are currently based on intuition. Before building v0.1, every starter Rule needs evidence, or gets replaced. Read `GLOSSARY.md` and `docs/adr/` first for context.

## Questions
1. Which prompting practices measurably improve agentic coding results (correctness, fewer turns, fewer tokens, less rework)? Evidence strength for each.
2. For each current starter Rule, what does the evidence say? Keep / change / drop:
   - Large feature → plan first → specs → tickets → implement per ticket
   - Small task → skip the grilling/interview step
   - Context > ~60% full → compact or start a fresh Session
   - Bug report → structured reproduce → diagnose → fix loop
   - Vague prompt → add file paths + acceptance criteria ("what done looks like")
3. What new Rules does the evidence support that we missed?
4. For each Rule: can it be detected from draft Prompt text, Session state, or Claude Code telemetry (OpenTelemetry events, token usage, tool results)? What threshold, and is that threshold backed by data?
5. What does evidence say about token efficiency specifically (prompt caching, context size vs quality, CLAUDE.md size, subagents)?

## Sources, in trust order
1. Anthropic primary: Claude Code docs and best-practices pages, prompt-engineering docs, engineering blog (e.g. context engineering, agent design).
2. Other vendors' primary guidance (OpenAI, Google) where it applies to coding agents.
3. Peer-reviewed or well-documented studies: context-length degradation ("lost in the middle", context rot), planning/spec-first coding agents, controlled productivity studies (e.g. METR), SWE-bench-style ablations.
4. Practitioner write-ups only as hypotheses, clearly labelled as low evidence.

## Output
`docs/research/prompting-best-practices.md` with:
- One table per Rule: claim · evidence · strength (strong / moderate / weak / none) · source links · verdict.
- New Rule candidates, with evidence and how to detect each one.
- Open questions where evidence is missing (Metron's own data could answer them later).
Every claim must link a source. No source → mark as "unverified".
