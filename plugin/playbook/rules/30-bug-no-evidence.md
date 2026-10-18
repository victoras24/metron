---
id: bug-no-evidence
severity: check
when:
  all:
    - bug
    - not errorText
    - not repro
text: "Bug with no error text or repro: paste the error/stack trace and how to reproduce it"
insert: "/mattpocock-skills:diagnosing-bugs "
---
Without the error or a way to reproduce it, the model guesses. Held only when there is nothing to reproduce from.
Source: research Rule 4.
