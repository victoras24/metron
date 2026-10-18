---
id: plan-first
severity: check
when:
  all:
    - featureVerb
    - not question
    - not mentionsPlanning
  any:
    - words > $largeFeatureWords
    - broadScope
    - locations >= $planFirstMinLocations
text: "Multi-file or unclear approach: plan first (plan mode). Needs product decisions? Interview → SPEC.md → fresh Session"
insert: "/grilling "
---
Keyed on multi-file or uncertain work, not on Prompt length alone. A spec and tickets are optional; a plan is not.
Source: research Rule 1 (changed).
