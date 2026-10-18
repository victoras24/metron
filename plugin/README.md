# Metron Claude Code plugin (v0.1)

Live Suggestions from the Team Playbook: Tips while typing (after a pause), Checks on Enter (held once).

Run: `claude --plugin-dir plugin`
Tests: `claude plugin test plugin` (wiring) and `node --test plugin/tests/playbook.spec.ts` (Rules vs. real Playbook files)
Validate a Playbook: `node plugin/scripts/check-playbook.ts [dir]` (exit 1 on errors; use in the Playbook repo's CI)
Typecheck: copy `.claude-plugin/types` from a dev mod (gitignored), then `tsc -p plugin`

## Playbook

Bundled default: `plugin/playbook/`. A Team overrides it by committing `.metron/playbook/` (same layout) to their project; it replaces the default entirely. Re-read on each new Session (incl. `/clear`).

```
values.yaml          thresholds, each with evidence: documented | guidance | unverified
rules/NN-<id>.md     one Rule per file; file name order = priority
```

Rule file:

```markdown
---
id: bug-no-evidence
severity: check            # tip | check
appliesTo: prompt          # prompt (default) | slashCommand
when:
  all:                     # every condition must hold
    - bug
    - not errorText
  any:                     # optional: at least one must hold
    - words > $largeFeatureWords
text: "Shown to the Member. {valueName} interpolates a value"
insert: "/some-command "   # optional: the "Use" button inserts this
---
Why this Rule exists, with sources. For reviewers; not shown at runtime.
```

Conditions: `signal`, `not signal`, `numberSignal <op> 3 | $value` (`> >= < <= == !=`), `text ~ /regex/flags`.
Signals are defined in `hooks/signals.ts`; unknown names, values or fields fail validation.
