---
id: cold-compact
severity: tip
appliesTo: slashCommand
when:
  all:
    - text ~ /^\/compact\b/
    - idleMs > $cacheTtlMs
    - contextTokens >= $coldCompactMinTokens
text: "Cache likely expired: /compact now re-reads everything at full price. Cheaper: /clear + point to written state (spec, progress file, git)"
---
Compacting after the prompt cache expired reprocesses the whole history uncached.
Source: research Rule 3c.
