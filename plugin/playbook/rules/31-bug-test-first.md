---
id: bug-test-first
severity: tip
when:
  all:
    - bug
    - not mentionsTest
  any:
    - errorText
    - repro
text: "Ask for a failing test that reproduces it first, then the fix"
insert: "/mattpocock-skills:diagnosing-bugs "
---
A failing test gives the model a runnable check for "fixed".
Source: research Rule 4.
