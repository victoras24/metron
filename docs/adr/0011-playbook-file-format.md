# Playbook Rules are declarative files over code-defined Signals

Each Rule is one Markdown file (YAML frontmatter + rationale body); thresholds live in `values.yaml`, each tagged with its evidence (documented, guidance, unverified). Conditions combine named Signals (`bug`, `not errorText`, `words > $largeFeatureWords`, `text ~ /regex/`) with `all`/`any`; Signal detection stays in TypeScript with tests.

Why: Rules must change by pull request without touching plugin code (ADR 0003), and a reviewer must read a Rule's logic and reasoning in one place. Arbitrary code in Rules was rejected: it can't run safely or be reviewed by non-developers, and the plugin can't load it within its sandbox. Regex-only Rules were rejected: the detectors (is it a bug report? does it have repro steps?) are too subtle to re-write per Rule. File name order sets priority, so reordering shows up in a diff.

A Team's Playbook at `.metron/playbook/` in their repo replaces the bundled default rather than merging with it, so what runs is exactly what the Team reviewed. Invalid files are reported in the UI and skipped, and the same validator runs in CI (`check-playbook.ts`) so mistakes fail the PR first. The YAML reader is a small strict subset because hooks can't import npm packages; unsupported syntax errors instead of silently meaning something else.
