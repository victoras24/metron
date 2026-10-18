---
id: cache-break
severity: tip
appliesTo: slashCommand
when:
  all:
    - text ~ /^\/(model|effort|fast)\b/
    - turns > 0
text: "Switching model/effort/fast mid-Session rebuilds the prompt cache. Cheaper: pick it at Session start"
---
The cache is keyed on model and settings; switching mid-Session pays full price for the history again.
Source: research new Rule D.
