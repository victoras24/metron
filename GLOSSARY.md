# Metron

Prompt coaching and observability for Teams adopting agentic coding. Helps Members write better, more efficient prompts and shows improvement over time.

## People

**Team**:
A group of developers sharing one Metron installation, its Playbook and its aggregated metrics.
_Avoid_: Org, workspace

**Member**:
A developer belonging to a Team. Owns their own Sessions and Prompts.
_Avoid_: User, colleague

**Admin**:
A Member who approves Playbook changes and views Team progress plus per-Member coaching signals, never other Members' Prompt text.
_Avoid_: Manager, owner

## Activity

**Harness**:
An agentic coding tool a Member prompts (e.g. Claude Code). Claude Code is the first supported.
_Avoid_: Agent, LLM, client

**Session**:
One continuous conversation between a Member and a Harness, from start until clear/exit.
_Avoid_: Chat, conversation

**Prompt**:
A single message a Member submits to a Harness within a Session.
_Avoid_: Query, request

## Coaching

**Rule**:
One Team convention describing when a Prompt or Session should be handled a certain way (e.g. "large feature → plan first", "small fix → skip grilling", "long Session → compact or start fresh").
_Avoid_: Policy, check

**Learned Rule**:
A Rule Metron proposes from patterns in Team data. Becomes part of the Playbook only after Admin approval.
_Avoid_: Auto-rule

**Playbook**:
The versioned set of Rules a Team owns.
_Avoid_: Ruleset, config

**Signal**:
A named fact about a draft Prompt or its Session (e.g. `bug`, `errorText`, `contextTokens`) that Rule conditions combine. Detected in code; which Signals matter is the Playbook's call.
_Avoid_: Feature, detector

**Suggestion**:
Advice shown to a Member about their draft Prompt or Session. Comes from a Rule or from AI analysis. May recommend doing something or *not* doing something. Is Accepted or Ignored.
_Avoid_: Hint, tip, recommendation

**Tip**:
A Suggestion shown while the Member types, after a typing pause. Never blocks. Changing the Prompt so the Tip no longer applies counts as Fixed; sending with it still applying counts as Ignored.
_Avoid_: Hint, nudge

**Check**:
A Suggestion for a costly mistake, raised when the Member submits. Holds the Prompt once; submitting again sends it anyway (Overridden), changing it first counts as Fixed.
_Avoid_: Gate, block, warning

**Prompt Library**:
Team-shared collection of Prompts that Members chose to publish as good examples.
_Avoid_: Templates, snippets

**Efficiency Score**:
0–100 composite of cache hit ratio, context bloat and wasted turns, for a Session, Member or Team over a period.
_Avoid_: Token score, quality score

**Digest**:
A periodic summary of a Member's Prompts with concrete rewrite advice drawn from their own Sessions.
_Avoid_: Report, review

**Coaching Signal**:
A per-Member indicator visible to the Admin (Efficiency Score trend, frequently broken Rules, Suggestion accept rate). Never contains Prompt text.
_Avoid_: Performance metric

## Outcomes

**Task Type**:
What a Session is about: feature, bug, refactor or question, with a size of small or large.
_Avoid_: Category, label

**Outcome**:
How a Session ended: shipped (commit/PR), abandoned, or open.
_Avoid_: Result, status
