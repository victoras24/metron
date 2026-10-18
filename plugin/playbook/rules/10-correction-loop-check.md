---
id: correction-loop-check
severity: check
when:
  all:
    - correction
    - corrections >= $correctionCheck
text: "Correction loop: /clear, then one Prompt with everything learned so far"
insert: /clear
---
Failed corrections pile up in context and keep steering the model wrong. A fresh Session with one consolidated Prompt usually beats another correction.
Source: docs/research/prompting-best-practices.md (new Rule B).
