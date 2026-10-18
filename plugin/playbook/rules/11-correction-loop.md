---
id: correction-loop
severity: tip
when:
  all:
    - correction
    - corrections >= $correctionTip
    - corrections < $correctionCheck
text: "2nd correction on this issue: /clear and re-prompt with everything learned usually beats correcting again"
insert: /clear
---
Early warning before the correction-loop Check. Anthropic guidance: after correcting more than twice, clear and start over.
