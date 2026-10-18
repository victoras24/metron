# Suggestions come from three layers

1. Playbook Rules: deterministic, evaluated per keystroke within the plugin's 50 ms budget.
2. AI Suggestions: an LLM reviews the draft Prompt and Session state after a typing pause, so Suggestions are never limited to written Rules.
3. Learned Rules: offline analysis of Team data proposes new Rules as pull requests to the Playbook; an Admin must approve, never auto-enabled.
