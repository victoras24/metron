# Evidence-based prompting best practices for agentic coding

Research for [BRIEF-prompting-best-practices.md](BRIEF-prompting-best-practices.md). It checks every starter Playbook Rule against evidence and proposes new Rules. Each Rule section also says whether it can be detected from the draft Prompt, from Session state, or from Claude Code OpenTelemetry (OTel). Terms follow [GLOSSARY.md](../../GLOSSARY.md).
Sources accessed 2026-10-18. Reference-style links (`[liu]`, `[cc-bp]`, …) resolve to the source list at the bottom.

## Summary

| # | Starter Rule | Verdict | One-line reason |
|---|---|---|---|
| 1 | Large feature → plan → specs → tickets → implement per ticket | **Change** | Planning first is well supported: three vendors recommend it and two code-gen studies measured gains. No study tests the full four-stage pipeline, and all three vendors say planning costs overhead. Key the Rule on *uncertainty / multi-file / can't describe the diff in one sentence*, not on "large". Make spec and tickets an optional Tip, not a Check. |
| 2 | Small task → skip the grilling/interview step | **Keep, reword** | Anthropic says to skip planning when the diff fits in one sentence. Ambig-SWE shows that asking questions helps only when the task is *underspecified*, and it added steps. The key is how clear the Prompt is, not its size. A small but vague Prompt still needs clarifying. |
| 3 | Context > ~60% full → compact or start a fresh Session | **Change** | Quality does drop as context grows (strong evidence). But **no data supports 60%** (or any percentage of the window). Degradation is gradual, depends on the task, and is measured in absolute tokens. Claude Code itself auto-compacts only near the limit. Replace with event triggers: unrelated task switch, ≥2 failed corrections, return after cache expiry. Keep a configurable absolute-token Tip as an unverified heuristic that Metron data should calibrate. |
| 4 | Bug report → structured reproduce → diagnose → fix loop | **Keep** | Agentless ablation: reproduction tests raised SWE-bench Lite resolves from 27.0% to 32.0%. Anthropic docs recommend "write a failing test that reproduces the issue, then fix it". Moderate evidence. |
| 5 | Vague prompt → add file paths + acceptance criteria | **Keep, reorder** | Acceptance criteria and a runnable check have the most support (TDD study +8.5 to +12 points; Anthropic's top tip). File paths help less, and the gain varies by model (Ambig-SWE: +6.4 points on Claude Sonnet 4, −3.1 on Qwen 3 Coder). Exception: deliberately exploratory Prompts. |

Top new Rule candidates (details in [New Rule candidates](#new-rule-candidates)):
1. **No runnable check → add one** (test, build, command, screenshot). Moderate evidence.
2. **≥2 failed corrections on the same issue → `/clear` (start a fresh Session) and re-prompt with everything consolidated.** Moderate evidence.
3. **Unrelated task in the same Session → `/clear` first.** Moderate on the mechanism, no direct coding data.

Also strong on cost, weak on quality: **avoid cache-breaking actions mid-Session** (switching model, changing effort, connecting MCP servers). This is a token-efficiency Rule backed by documented pricing.

## Evidence strength scale used

- **strong**: several controlled studies or benchmarks agree across models, and the task is close to agentic coding.
- **moderate**: one controlled study or benchmark ablation on coding (or several on nearby LLM tasks), plus consistent vendor guidance.
- **weak**: vendor guidance or expert opinion only, with no published data; or data that only indirectly applies.
- **none**: no source found → also marked "unverified".

Vendor docs are primary sources for *what the vendor recommends and how the Harness behaves*. They are not evidence that a practice improves outcomes unless they publish data. Anthropic's best-practices page describes its patterns as "proven effective across Anthropic's internal teams" but publishes no numbers [cc-bp].

---

## Q1. Practices that measurably improve agentic coding results

| Practice | Measured effect | Strength | Sources |
|---|---|---|---|
| Give the agent a runnable check (tests in the Prompt, reproduction test, validation) | Including tests in the Prompt solved an extra 12.0% (MBPP) and 8.5% (HumanEval) of problems with GPT-4 [tdd]. Agentless patch validation: 77 → 81 → 96 resolved / 300 (25.67% → 27.0% → 32.0%) when regression tests, then reproduction tests, were added [agentless] (Table 4). Anthropic calls it "the difference between a session you watch and one you walk away from" [cc-bp]. | moderate | [tdd], [agentless], [cc-bp], [a-harness] |
| Fully specify the task up front; underspecification hurts | Ambig-SWE (ICLR 2026): letting the agent ask questions on underspecified SWE-bench Verified issues improves results "up to 74%" over non-interactive runs, recovering ~80–89% of fully-specified performance for Claude models [ambig]. Multi-turn underspecified conversations lose an average of 39% vs single-turn fully specified, across 6 tasks including code. Putting all the pieces in one Prompt ("Concat") keeps 95.1% of Full [laban]. | moderate–strong | [ambig], [laban] |
| Plan before coding | Self-planning code generation: up to 25.4% relative Pass@1 gain vs direct generation, 11.9% vs CoT [selfplan]. CodePlan, on repo-level multi-file edits: 5/6 repos pass validity checks vs 0 for no-planning baselines with the same context [codeplan]. Neither is a modern agentic Harness study. | moderate (indirect) | [selfplan], [codeplan], [cc-bp], [oai-codex] |
| Keep context short and relevant | Performance falls as input grows, even on simple tasks, across 18 models [chroma]. It also falls for information in the middle of the context [liu]. At 32K tokens, 11 of 13 models drop below 50% of their short-context baseline [nolima]. Length alone costs 13.9%–85% even with perfect retrieval, in math, QA and coding [du]. | strong (for "longer = worse"); none for a specific threshold | [liu], [chroma], [nolima], [du] |
| Restart with a consolidated Prompt after the conversation goes wrong | "When LLMs take a wrong turn in a conversation, they get lost and do not recover." The authors recommend starting a new conversation with the information consolidated [laban]. | moderate | [laban], [cc-bp] |
| Work incrementally, one feature per Session, with state in files and git | Anthropic's long-running harness: agents tried to "one-shot the app", and work improved with one feature per Session, a JSON feature list, a progress file and git [a-harness]. Qualitative only, no numbers. | weak | [a-harness], [api-prompt] |
| Short, non-standard-only CLAUDE.md / AGENTS.md | Mixed. ETH study: context files "do not generally improve task success rates" and raise inference cost "over 20%" [agentsmd]. Lulla et al.: AGENTS.md associated with 28.64% lower median runtime and 16.58% fewer output tokens, with comparable completion [agentsmd-eff]. | moderate (that bloat costs tokens); mixed on quality | [agentsmd], [agentsmd-eff], [ifscale], [cc-mem] |
| AI assistance in general | METR RCT (16 experienced developers, 246 tasks, early-2025 tools): AI made tasks **19% slower**, while developers believed they were 20% faster [metr25]. The late-2025 follow-up (57 developers, 800+ tasks) estimates −4% (CI −15% to +9%) for new developers and −18% (CI −38% to +9%) for returning ones, i.e. a speedup. METR calls these weak evidence because of selection effects [metr26]. | strong (that self-perception is unreliable) | [metr25], [metr26] |

Takeaway for Metron: self-reported "this helped" is unreliable [metr25]. Metron should measure Outcomes (commits/PRs, correction turns, tokens) instead of trusting Member perception.

---

## Q2 + Q4. Starter Rules

### Rule 1: Large feature → plan first → specs → tickets → implement per ticket

| Claim | Evidence | Strength | Sources | Verdict |
|---|---|---|---|---|
| Planning before coding improves correctness | Self-planning: up to +25.4% relative Pass@1 [selfplan]. CodePlan: 5/6 vs 0/6 repos on multi-file edits [codeplan]. Both predate modern agentic Harnesses. | moderate (indirect) | [selfplan], [codeplan] | keep the planning part |
| Vendors recommend planning for complex work | Anthropic: "Letting Claude jump straight to coding can produce code that solves the wrong problem"; plan mode prevents "expensive re-work when the initial direction is wrong" [cc-bp], [cc-costs]. OpenAI Codex: "If the task is complex, ambiguous, or hard to describe well, ask Codex to plan before it starts coding" [oai-codex]. Gemini CLI ships a read-only Plan mode [gem-mem]. | weak (guidance, no data) but unanimous | [cc-bp], [cc-costs], [oai-codex] | keep |
| Planning has a cost; skip it on clear tasks | Anthropic: "Plan mode is useful, but also adds overhead… If you could describe the diff in one sentence, skip the plan." Planning is most useful when "uncertain about the approach, when the change modifies multiple files, or when you're unfamiliar with the code" [cc-bp]. | weak | [cc-bp] | change trigger |
| Interview → written spec → fresh Session to implement | Anthropic recommends it "for larger features": interview with AskUserQuestion, write SPEC.md, then "start a fresh session to execute it". Good specs "name the files and interfaces… state what is out of scope, and end with an end-to-end verification step" [cc-bp]. Ambig-SWE supports clarifying underspecified tasks [ambig]. | weak–moderate | [cc-bp], [ambig] | keep as optional Tip |
| Split into tickets, implement one at a time | Anthropic long-running harness: one feature per Session beat one-shotting [a-harness] (qualitative). "Test incrementally" [cc-costs]. No controlled study of ticket decomposition for human-driven Sessions. | weak | [a-harness], [cc-costs] | Tip, not Check |
| Full pipeline (plan→spec→tickets→implement) beats plan-only | No source found. | none (**unverified**) | | drop as a mandated sequence |

**Proposed Rule:** *Task is multi-file, unfamiliar, or approach-uncertain (can't describe the diff in one sentence) → start in plan mode. For features that need product decisions → interview → SPEC.md (files, out-of-scope, end-to-end check) → fresh Session to implement, in verifiable increments.* Planning = **Tip** (or Check only when the draft is large-feature-shaped and the Session is not already in plan mode). Spec and tickets = Tip.

**Detection (Q4):**
- Draft Prompt: feature verbs (add/build/implement/migrate) plus several named components or files, or long Prompts with no paths. Size classification is heuristic. Task Type classification via the AI layer (ADR 0006) is a better fit than regex. Thresholds: **none backed by data**, calibrate on Metron data.
- Session state: plan mode on? OTel `claude_code.permission_mode_changed` with `to_mode` = `plan` [cc-otel], [cc-perm]. The model can also enter plan mode itself through the `EnterPlanMode`/`ExitPlanMode` tools [a-cacheblog]. These should show as `tool_name` on `claude_code.tool_result` (verify).
- Afterwards (for Learned Rules): count files edited (`claude_code.tool_result` with `tool_name` Edit/Write, `tool_input` file paths when `OTEL_LOG_TOOL_DETAILS=1`) and `claude_code.lines_of_code.count`. Then check whether Sessions that started in plan mode had fewer correction turns or more `claude_code.commit.count` / `claude_code.pull_request.count` [cc-otel].

### Rule 2: Small task → skip the grilling/interview step

| Claim | Evidence | Strength | Sources | Verdict |
|---|---|---|---|---|
| Overhead isn't worth it on small, clear tasks | Anthropic: for "fixing a typo, adding a log line, or renaming a variable, ask Claude to do it directly"; interviewing is recommended "for larger features" [cc-bp]. | weak | [cc-bp] | keep |
| Clarification pays off only when the task is underspecified | Ambig-SWE: interaction gains show up on underspecified inputs. Interaction did *not* reduce steps (Claude Sonnet 4 ~65 → 75 steps) [ambig] (§3.2). Models often can't tell well-specified from underspecified (Claude Sonnet 4: 0.74–0.89 accuracy depending on prompt) [ambig] (Table 2). | moderate | [ambig] | change key: clarity, not size |
| Front-loading information beats drip-feeding | Multi-turn sharded instructions −39% on average vs fully specified single turn [laban]. | moderate | [laban] | supports "skip the interview only when the Prompt is already complete" |

**Proposed Rule:** *Clear-scope Prompt (one-sentence diff, target named) → skip plan mode and interview; ask directly.* Show it as a **Tip** that recommends *not* doing something (allowed per the glossary's Suggestion definition). A small *but vague* Prompt falls under Rule 5 instead.

**Detection (Q4):**
- Draft Prompt: short, names one file/symbol, imperative verb (rename/fix typo/add log). And the Member typed an interview request ("interview me", "ask me questions") or switched to plan mode. Thresholds such as "< N words": **unverified**, calibrate.
- Session state: `claude_code.permission_mode_changed` → `plan` for a draft classified as small [cc-otel]. Wasted plan detection afterwards: the plan was approved and the resulting diff was tiny (`claude_code.lines_of_code.count`).

### Rule 3: Context > ~60% full → compact or start a fresh Session

| Claim | Evidence | Strength | Sources | Verdict |
|---|---|---|---|---|
| Quality degrades as context grows | Lost in the Middle (TACL): performance "is often highest when relevant information occurs at the beginning or end", worse in the middle [liu]. Chroma: 18 models, "performance grows increasingly unreliable as input length grows"; focused ~300-token prompts beat full ~113k-token prompts on LongMemEval [chroma]. NoLiMa: 11/13 models < 50% of baseline at 32K [nolima]. Du et al.: −13.9% to −85% from length alone [du]. Anthropic: "LLM performance degrades as context fills" [cc-bp]. Anthropic also names "context rot" and an "attention budget" [a-ctx]. | strong | [liu], [chroma], [nolima], [du], [cc-bp], [a-ctx] | keep the intent |
| A threshold at ~60% of the window | Chroma "does not identify a specific threshold, a percentage of the context window, or a cliff"; degradation is gradual and its onset depends on the task [chroma]. No Anthropic doc gives a % threshold. The 60% figure comes from practitioner blogs that offer it as an illustrative example, not a measurement [low-morph] (**low evidence**). | none (**unverified**) | [chroma], [low-morph] | drop the number |
| Percent of window is the wrong unit | Studies measure degradation in *absolute* tokens (e.g. 32K in [nolima], ~113k in [chroma]). Claude Code windows are 200K or 1M depending on model [cc-model], so "60%" means 120K on one model and 600K on another. | moderate (inference from the above) | [nolima], [chroma], [cc-model] | change unit |
| What Claude Code does | Default: compacts "when the conversation reaches the model's context limit". Native-1M models compact "at about 967K tokens". Opus/Sonnet 4.6 without extended context compact at 200K. Configurable through `autoCompactWindow` / `CLAUDE_CODE_AUTO_COMPACT_WINDOW` / `/autocompact`, 100K–1M tokens. The page gives no rationale for the default [cc-model]. Gemini CLI default `model.compressionThreshold` = 0.5 of the window, with no rationale [gem-cfg]. Vendors disagree and none publishes data. | (fact) | [cc-model], [gem-cfg] | |
| Anthropic's actual triggers are events, not % | "`/clear` between unrelated tasks"; "If you've corrected Claude more than twice on the same issue… run `/clear`"; run `/compact` "at a natural break… instead of waiting for auto-compaction to trigger mid-task" [cc-bp], [cc-cache]. | weak (guidance) | [cc-bp], [cc-cache] | adopt |
| Compact vs fresh Session | Compaction keeps a structured summary, re-reads up to 5 recently modified files and re-injects invoked skills. Full tool outputs and reasoning are lost [cc-ctx]. `/compact` is itself a large request: cheap with a warm cache, full uncached reprocessing after the cache TTL. "`/clear` costs nothing" [cc-costs], [cc-cache]. Anthropic: "consider starting with a brand new context window rather than using compaction. Claude's latest models are extremely effective at discovering state from the local filesystem" [api-prompt]. | weak (guidance) + documented mechanism | [cc-ctx], [cc-cache], [cc-costs], [api-prompt] | prefer fresh Session + written state when the task changes; compact when continuing |

**Proposed Rule (replaces 3):**
- *(a) Task switch:* draft is unrelated to the current Session → Tip: `/clear` (see New Rule C).
- *(b) Correction loop:* see New Rule B.
- *(c) Returning after idle > cache TTL with a big context* → Tip: prefer `/clear` plus a pointer to written state over `/compact`. Compacting cold reprocesses the full history uncached [cc-cache].
- *(d) Size Tip (unverified heuristic):* main-conversation context above a **configurable absolute token count** (Playbook value; suggest starting near the 100K–200K range that long-context studies probe, and label it unverified) → Tip "compact at this natural break or start fresh". Never a Check. Calibrate per Team from Metron data (see Open questions).

**Detection (Q4):**
- Context size: per-request context ≈ `input_tokens + cache_read_tokens + cache_creation_tokens` on the latest `claude_code.api_request` with `query_source` = main [cc-otel]. This is the same input-only formula as the status line's `context_window.used_percentage` [cc-status]. The plugin can read `context_window.used_percentage`, `context_window.context_window_size` and `current_usage` live [cc-status]. OTel has no context-window-% metric (none found in [cc-otel]).
- Compaction: `claude_code.compaction` event with `trigger` (`auto`/`manual`), `pre_tokens`, `post_tokens`, `success` [cc-otel]. Also `query_source` = `compact` on `api_request` [cc-otel].
- Idle: gap between `claude_code.user_prompt` timestamps vs cache TTL (5 min default; 1 h on subscription main conversation) [cc-cache]. Confirm with a `cache_creation_tokens` spike on the next `api_request`.
- `/clear`, `/compact` usage: `command_name` on `claude_code.user_prompt` [cc-otel] (exact value format: verify).

### Rule 4: Bug report → structured reproduce → diagnose → fix loop

| Claim | Evidence | Strength | Sources | Verdict |
|---|---|---|---|---|
| Reproducing first improves fix rate | Agentless ablation (SWE-bench Lite): adding reproduction-test filtering raised resolves from 81 (27.0%) to 96 (32.0%), "the largest gain" of the validation steps [agentless] (Table 4). Caveat: in that study the agent writes and uses the reproduction tests automatically, not the human. | moderate | [agentless] | keep |
| Localize → repair → validate structure works | Agentless's three-phase process reached 32.00% at $0.70/issue, the best open-source result at the time [agentless]. | moderate | [agentless] | keep |
| Vendor guidance | "users report that login fails after session timeout. check the auth flow in src/auth/… write a failing test that reproduces the issue, then fix it" [cc-bp]. "Tell Claude the command to reproduce the issue and get a stack trace" [cc-wf]. "address the root cause, don't suppress the error" [cc-bp]. | weak (guidance) | [cc-bp], [cc-wf] | keep |
| Tests as the spec help | +8.5–12 percentage points from tests in the Prompt [tdd]. | moderate | [tdd] | supports "failing test first" |

**Proposed Rule:** *Bug Prompt → include symptom (error text / stack trace), repro command or steps, expected vs actual, and ask for a failing test before the fix.* **Tip**. Make it a Check only when the bug Prompt has no error text and no repro at all.

**Detection (Q4):**
- Draft Prompt: bug lexicon (fix, bug, error, fails, broken, crash, exception) → Task Type = bug. Missing pieces: no stack-trace-like text (`at …:line`, `Traceback`, `Error:`), no command (backticks / `npm|pytest|dotnet test`), no "expected/actual". Regex is feasible inside the 50 ms budget (ADR 0006).
- Session state afterwards: test command run before the first Edit? Order of `claude_code.tool_result` events (`tool_name` Bash running test vs Edit/Write) [cc-otel]. Bash command text requires `OTEL_LOG_TOOL_DETAILS=1` / `tool_parameters`.

### Rule 5: Vague prompt → add file paths + acceptance criteria ("what done looks like")

| Claim | Evidence | Strength | Sources | Verdict |
|---|---|---|---|---|
| Acceptance criteria / verification improve results | [tdd], [agentless] (see Q1). Anthropic's first best practice: "Give Claude a check it can run" [cc-bp]. Codex prompt template ends with "Done when" [oai-codex]. Scheduled-task Prompts must be "explicit about what success looks like" [cc-wf]. | moderate | [tdd], [agentless], [cc-bp], [oai-codex] | keep, put first |
| Underspecified Prompts hurt | Ambig-SWE: big drop from Full to Hidden (underspecified), partially recovered by interaction [ambig]. Multi-turn underspecification −39% [laban]. | moderate–strong | [ambig], [laban] | keep |
| File paths help | Ambig-SWE Table 1, navigational info (file locations) gain: Claude Sonnet 3.5 +21.6 pts, Haiku 3.5 +12.2, Claude Sonnet 4 +6.4, Qwen 3 Coder −3.1. Stronger models ask for paths less (12% of issues for Sonnet 4) [ambig]. Anthropic: "Reference specific files" and use `@` [cc-bp]. Specific requests "let Claude work efficiently with minimal file reads" [cc-costs]. METR: developers said AI "doesn't pick the right location to make the edits" in large repos [metr25] (C.1.5). | moderate for quality on weaker models; weak–moderate on current models; weak for token savings | [ambig], [cc-bp], [cc-costs], [metr25] | keep, secondary |
| Vague is sometimes right | "Vague prompts can be useful when you're exploring and can afford to course-correct" [cc-bp]. | weak | [cc-bp] | add exception |

**Proposed Rule:** *Change-requesting Prompt with no acceptance criteria/check → Tip "say what done looks like and how to verify it". If no file, symbol or `@` mention is given and the repo is large → also suggest pointing to the location or an example pattern.* Skip for question/exploration Prompts.

**Detection (Q4):**
- Draft Prompt: done-criteria markers ("should", "expect", "test", "passes", "returns", "done when", example inputs/outputs). Path markers: `@` mentions, `/`-paths, file extensions, CamelCase symbols. Feasible deterministically.
- After submit: `claude_code.at_mention` with `mention_type` = `file`/`directory` [cc-otel]. `claude_code.user_prompt.prompt_length` (always recorded) [cc-otel].
- Outcome proxy: number of `Read`/`Grep`/`Glob` `tool_result` events before the first Edit (exploration cost), plus correction turns.

---

## Q3. New Rule candidates

| ID | Candidate Rule | Evidence | Strength | Detection | Suggested type |
|---|---|---|---|---|---|
| **A** | **No runnable check → add one** (test cases, build/test command, screenshot to compare; "show evidence") | [tdd] +8.5–12 pts; [agentless] validation 25.67% → 32.0%; Anthropic's #1 practice [cc-bp]; e2e testing fixed premature "done" [a-harness]; METR: <44% of AI generations accepted, ~9% of time reviewing/cleaning AI output [metr25] | moderate | Draft: change verb with no test/command/expected-output marker. Session: no Bash test runs after edits (`tool_result` ordering) [cc-otel] | Tip; Check for large-feature drafts |
| **B** | **≥2 failed corrections on the same issue → `/clear` and re-prompt with what you learned, consolidated** | "LLMs… get lost and do not recover"; consolidating into a new conversation recommended; Concat keeps 95.1% of Full vs large drop when sharded [laban]. Anthropic: "After two failed corrections, `/clear`… A clean session with a better prompt almost always outperforms a long session with accumulated corrections" [cc-bp]. The number **2** is Anthropic guidance, not data. | moderate | Draft: correction lexicon ("still", "again", "no,", "that's wrong", "didn't work") in consecutive Prompts. Session: `tool_decision` `decision`=`reject`, `/rewind` via `command_name`, repeated edits to the same file [cc-otel] | Tip on 2nd correction; Check on 3rd (calibrate) |
| **C** | **Unrelated task in current Session → `/clear` first** ("kitchen sink session") | Anthropic failure pattern "kitchen sink session" [cc-bp]. Distractors and irrelevant context degrade performance [chroma], [du]. Stale context "wastes tokens on every subsequent message" [cc-costs]. No direct coding-agent measurement. | moderate (mechanism), none (direct) | Draft vs Session: low overlap between files/symbols in draft and files touched so far (`tool_input` paths) — AI layer better than regex | Tip |
| **D** | **Don't break the prompt cache mid-Session** (model switch, effort change on most models, connecting MCP servers, enabling fast mode); pick these at Session start | Cache reads 0.1× base input (0.05× on Opus/Sonnet 5.5); writes 1.25× (5 min) / 2× (1 h) [api-cache]. Switching models "recomputes the entire request" [cc-cache]. Anthropic: "a few percentage points of cache miss rate can dramatically affect cost and latency" and treats cache breaks as incidents [a-cacheblog] | strong (cost, documented pricing); none (quality) | Session: `model` change between consecutive main `api_request`s; `cache_creation_tokens` spike after the first turn; `/model`/`/effort` via `command_name`; `mcp_server_connection` mid-Session [cc-otel] | Tip when the action is typed |
| **E** | **Scope investigations; delegate verbose exploration/test runs to a subagent** | Anthropic: unscoped "investigate" makes Claude read "hundreds of files" [cc-bp]. Subagents return summaries "often 1,000–2,000 tokens" [a-ctx]. Docs advise the main conversation for "quick, targeted change[s]" and when phases share context [cc-sub]. Counter-evidence on cost: multi-agent ~15× chat tokens, "most coding tasks involve fewer truly parallelizable tasks" [a-multi]. Opus models over-spawn subagents [api-prompt]. | weak (net benefit unmeasured for coding) | Draft: "investigate/look into/figure out why" with no path. Session: large `tool_result_size_bytes` on main-conversation reads; `subagent_completed` `total_tool_uses` [cc-otel] | Tip |
| **F** | **Keep CLAUDE.md short and limited to non-standard, non-inferable rules** (Team-level Rule, checked at Session start) | Context files raise cost >20% with no general success gain [agentsmd]; but AGENTS.md cut runtime 28.64% and output tokens 16.58% [agentsmd-eff]. Instruction-following degrades with instruction count (best model 68% at 500) [ifscale]. Anthropic: "target under 200 lines… Longer files consume more context and reduce adherence" [cc-mem]. OpenAI: "A short, accurate AGENTS.md is more useful than a long file" [oai-codex]. The 200-line figure is guidance, not data. | moderate | Not from OTel directly. Session baseline: input+cache tokens of the first main `api_request` (fixed overhead). Plugin can read the file. `/doctor` proposes cuts [cc-bp] | Digest/Admin item, not a per-Prompt Tip |
| **G** | **Front-load requirements in one Prompt instead of drip-feeding constraints over turns** | −39% average for sharded multi-turn vs single full Prompt [laban]. Codex template: Goal/Context/Constraints/Done when [oai-codex] | moderate | Session: short follow-up Prompts adding constraints soon after the first Prompt, before any commit (pattern for Learned Rules / Digest) | Digest advice |

Practitioner hypotheses (low evidence, not proposed yet): fixed context-% thresholds (e.g. 60%, or "degrades past ~147K tokens") [low-morph]. Unverified; Metron data should test them.

---

## Q4. Detection signal reference (Claude Code)

Sources: [cc-otel], [cc-status], [cc-cache]. Names below are exact, from the Claude Code monitoring docs.

| Signal | Where | Use for Rules |
|---|---|---|
| Draft Prompt text | Plugin only (ADR 0002). Never shown to Admin (ADR 0005) | 1, 2, 4, 5, A, B, C, E, G |
| `claude_code.user_prompt`: `prompt_length` (always), `prompt`/`prompt_text` (only with `OTEL_LOG_USER_PROMPTS=1`), `command_name`, `command_source`, `prompt.id` | OTel event | 5, B, slash-command usage (`/clear`, `/compact`, `/rewind`, `/model`) |
| `claude_code.api_request`: `model`, `input_tokens` (excludes cache), `cache_read_tokens`, `cache_creation_tokens`, `output_tokens`, `cost_usd`, `query_source` (`main`, `subagent`, `compact`, …), `effort` | OTel event | 3 (context size), D (cache breaks), Efficiency Score |
| `claude_code.token.usage` (`type` = input/output/cacheRead/cacheCreation), `claude_code.cost.usage` | OTel metric | Efficiency Score, cache hit ratio |
| `claude_code.compaction`: `trigger`, `pre_tokens`, `post_tokens`, `success`, `duration_ms`, `precompute_reuse` | OTel event | 3 |
| `claude_code.permission_mode_changed`: `from_mode`, `to_mode` (`plan`, `default`, `acceptEdits`, `auto`, …) | OTel event | 1, 2 |
| `claude_code.at_mention`: `mention_type` (`file`, `directory`, `agent`, `mcp_resource`, `peer`) | OTel event | 5 |
| `claude_code.tool_result`: `tool_name`, `success`, `error`, `tool_input_size_bytes`, `tool_result_size_bytes`, `tool_parameters`/`tool_input` (details need `OTEL_LOG_TOOL_DETAILS=1`) | OTel event | 4, A, E, file overlap for C |
| `claude_code.tool_decision`: `decision` (`accept`/`reject`), `source` | OTel event | B (rejections as correction signal) |
| `claude_code.subagent_completed`: `agent_type`, `total_tokens` (final request only), `total_tool_uses`, `is_async` | OTel event | E |
| `claude_code.session.count` (`start_type`: fresh/resume/continue/agents_view), `claude_code.commit.count`, `claude_code.pull_request.count`, `claude_code.lines_of_code.count` | OTel metric | Outcome, Rule effectiveness |
| `claude_code.skill_activated`: `skill.name`, `invocation_trigger` | OTel event | Playbook skill adoption |
| Status line JSON: `context_window.used_percentage`, `context_window.context_window_size`, `context_window.current_usage`, `exceeds_200k_tokens`, `prompt_cache.hit_ratio` | Plugin / status line, live | 3, D (live Tips) |

No threshold in this document is backed by outcome data except as stated. Every numeric trigger (word counts, token counts, correction counts) should ship as a Playbook value marked "unverified" and be calibrated from Team data.

---

## Q5. Token efficiency

| Topic | Finding | Strength | Sources |
|---|---|---|---|
| Prompt caching economics | Cache read 0.1× base input (0.05× Opus/Sonnet 5.5; 0.025× Fable/Mythos 5.1). Write 1.25× (5 min TTL) or 2× (1 h). Hits need byte-identical prefixes [api-cache]. Claude Code TTL: 1 h for the main conversation on subscription within plan, else 5 min. Subagents get 5 min [cc-cache]. | strong (documented pricing) | [api-cache], [cc-cache] |
| Cache-breaking actions | Model switch, effort change (most models), fast mode on, MCP connect/remove (when tools not deferred), plugin with MCP, bare-tool deny rule without tool search, compaction, image eviction, upgrade [cc-cache]. Editing CLAUDE.md mid-Session does not break the cache but also doesn't apply until `/clear`/`/compact`/restart [cc-cache]. Switching to a cheaper model mid-Session can cost more than staying [a-cacheblog]. | strong (mechanism) | [cc-cache], [a-cacheblog] |
| Long Sessions cost more per Prompt | "Claude Code sends your full conversation with every request"; a one-line question late in a long Session pays for the whole history at cached rate [cc-costs]. Token usage alone explained 80% of performance variance in Anthropic's BrowseComp analysis (research agents, not coding) [a-multi]. | strong (mechanism) | [cc-costs], [a-multi] |
| Context size vs quality | Longer = worse (strong, see Rule 3). No % threshold supported. | strong / none | [chroma], [du], [nolima], [liu] |
| Compaction cost | Compaction reads the conversation it summarizes. Cheap when warm (reads the prefix from cache, roughly one tenth the price of uncached input [a-cacheblog]). Expensive after cache expiry. `/clear` is free. `/rewind` truncates to an already-cached prefix [cc-cache], [cc-costs]. | strong (mechanism) | [cc-cache], [cc-costs], [a-cacheblog] |
| CLAUDE.md size | Loaded every Session; Anthropic says <200 lines [cc-mem], [cc-costs]. Context files +20% cost, no general success gain [agentsmd]; AGENTS.md −16.58% output tokens [agentsmd-eff]. Move conditional instructions to skills or path-scoped rules [cc-costs], [cc-mem]. | moderate | [cc-mem], [agentsmd], [agentsmd-eff] |
| Subagents | Keep verbose output out of main context, but they spend their own tokens and their results return to main context [cc-sub]. Multi-agent ~15× chat tokens, agents ~4× [a-multi]. Agent teams ~7× standard Sessions in plan mode [cc-costs]. Net token effect for coding: **unverified**. | weak (net) | [cc-sub], [a-multi], [cc-costs] |
| MCP / tools | MCP tool definitions deferred by default. CLI tools (`gh`, etc.) are "more context-efficient than MCP servers" [cc-costs]. | weak (guidance) | [cc-costs] |
| Specific Prompts | "Vague requests like 'improve this codebase' trigger broad scanning" [cc-costs]. No published token measurement. | weak | [cc-costs] |
| Thinking / effort | Thinking billed as output; lower effort for simple tasks [cc-costs]. | weak (guidance) | [cc-costs] |
| Enterprise baseline | Average ~$13 per developer per active day, $150–250/month, 90% below $30/active day [cc-costs]. Useful Team-dashboard benchmark. | (fact, vendor-reported) | [cc-costs] |

Implication for the Efficiency Score: "cache hit ratio" = `cache_read_tokens / (input_tokens + cache_read_tokens + cache_creation_tokens)`, the same denominator as the status line's `prompt_cache.hit_ratio` [cc-status]. "Context bloat" should use absolute tokens per main request, not % of window. "Wasted turns" can use correction-loop signals (Rule B).

---

## Open questions Metron's own data could answer

1. **Context threshold:** at what absolute main-context token count do correction turns per Prompt, abandon rate, or tool error rate rise in *our* Sessions? Is it per model? (Replaces the 60% guess.)
2. **Compact vs `/clear`:** after `claude_code.compaction` vs `/clear` + fresh Prompt, which has fewer correction turns and more commits in the next N Prompts?
3. **Plan mode payoff:** for drafts classified as large/multi-file, does starting in plan mode (`permission_mode_changed` → `plan`) reduce correction turns or tokens to first commit? For small drafts, how much overhead does it add?
4. **Correction threshold:** is "2 failed corrections" the right trigger for Rule B, or does the success probability drop at a different count?
5. **Verification Tip effect:** do Prompts that include a check (test/command/expected output) have fewer follow-up corrections and higher commit/PR Outcomes?
6. **File paths on current models:** does `at_mention` / explicit paths reduce exploration reads and tokens to first edit for Opus/Sonnet 5.x (Ambig-SWE suggests a small effect on strong models)?
7. **CLAUDE.md size:** does fixed Session-start overhead (first `api_request` input+cache tokens) correlate with rework or Suggestion Overrides?
8. **Cache breaks:** how often do Members switch model/effort mid-Session, and what's the measured `cache_creation_tokens` cost?
9. **Suggestion validity:** for each Rule, compare Outcome when Accepted/Fixed vs Ignored/Overridden. That is the direct test of every Rule above (beware selection bias, cf. [metr26]).
10. **Self-report vs measured:** do Members' perceived gains match measured Efficiency Score changes (cf. [metr25])?

---

## Sources (accessed 2026-10-18)

Anthropic, Claude Code docs:
- [cc-bp]: Best practices for Claude Code — https://code.claude.com/docs/en/best-practices (also the redirect target of anthropic.com/engineering/claude-code-best-practices)
- [cc-costs]: Manage costs effectively — https://code.claude.com/docs/en/costs
- [cc-otel]: Monitoring / OpenTelemetry reference — https://code.claude.com/docs/en/monitoring-usage
- [cc-model]: Model configuration (auto-compact window) — https://code.claude.com/docs/en/model-config
- [cc-ctx]: Explore the context window — https://code.claude.com/docs/en/context-window
- [cc-status]: Customize your status line — https://code.claude.com/docs/en/statusline
- [cc-cache]: How Claude Code uses prompt caching — https://code.claude.com/docs/en/prompt-caching
- [cc-mem]: How Claude remembers your project — https://code.claude.com/docs/en/memory
- [cc-wf]: Common workflows — https://code.claude.com/docs/en/common-workflows
- [cc-sub]: Subagents — https://code.claude.com/docs/en/sub-agents
- [cc-perm]: Permission modes — https://code.claude.com/docs/en/permission-modes

Anthropic, platform docs and engineering:
- [api-cache]: Prompt caching — https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- [api-prompt]: Prompting best practices — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- [a-ctx]: Effective context engineering for AI agents — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- [a-multi]: How we built our multi-agent research system — https://www.anthropic.com/engineering/multi-agent-research-system
- [a-agents]: Building effective agents — https://www.anthropic.com/engineering/building-effective-agents
- [a-harness]: Effective harnesses for long-running agents — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- [a-cacheblog]: Lessons from building Claude Code: prompt caching is everything — https://claude.dev/blog/lessons-from-building-claude-code-prompt-caching-is-everything/

Other vendors:
- [oai-codex]: OpenAI Codex best practices — https://learn.chatgpt.com/guides/best-practices (redirect from https://developers.openai.com/codex/learn/best-practices)
- [gem-mem]: Gemini CLI, Manage context and memory — https://www.geminicli.com/docs/cli/tutorials/memory-management
- [gem-cfg]: Gemini CLI configuration reference (`model.compressionThreshold`) — https://www.geminicli.com/docs/reference/configuration

Studies:
- [liu]: Liu et al., Lost in the Middle (TACL 2023) — https://arxiv.org/abs/2307.03172
- [chroma]: Hong, Troynikov, Huber, Context Rot (Chroma, 2025) — https://www.trychroma.com/research/context-rot
- [nolima]: Modarressi et al., NoLiMa (ICML 2025) — https://arxiv.org/abs/2502.05167
- [du]: Du et al., Context Length Alone Hurts LLM Performance Despite Perfect Retrieval (Findings of EMNLP 2025) — https://arxiv.org/abs/2510.05381
- [laban]: Laban et al., LLMs Get Lost in Multi-Turn Conversation (2025) — https://arxiv.org/abs/2505.06120
- [metr25]: Becker et al., Measuring the Impact of Early-2025 AI on Experienced OS Developer Productivity — https://arxiv.org/abs/2507.09089 (factor table read from https://arxiv.org/html/2507.09089)
- [metr26]: METR, uplift update (Feb 2026) — https://metr.org/blog/2026-02-24-uplift-update/
- [ambig]: Vijayvargiya et al., Ambig-SWE (ICLR 2026) — https://arxiv.org/abs/2502.13069
- [selfplan]: Jiang et al., Self-planning Code Generation (TOSEM) — https://arxiv.org/abs/2303.06689
- [codeplan]: Bairi et al., CodePlan — https://arxiv.org/abs/2309.12499
- [agentless]: Xia et al., Agentless — https://arxiv.org/abs/2407.01489
- [tdd]: Mathews & Nagappan, Test-Driven Development for Code Generation — https://arxiv.org/abs/2402.13521
- [sweagent]: Yang et al., SWE-agent (ACI design matters; no ablation numbers extracted) — https://arxiv.org/abs/2405.15793
- [agentsmd]: Gloaguen et al., Evaluating AGENTS.md — https://arxiv.org/abs/2602.11988
- [agentsmd-eff]: Lulla et al., On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents — https://arxiv.org/abs/2601.20404
- [ifscale]: Jaroslawicz et al., How Many Instructions Can LLMs Follow at Once? — https://arxiv.org/abs/2507.11538

Practitioner (low evidence, hypotheses only):
- [low-morph]: MorphLLM, Claude Code context window guide (illustrative 60% example) — https://www.morphllm.com/claude-code-context-window

Not accessible / not fully read:
- OpenAI, Introducing SWE-bench Verified (underspecification annotation stats) — https://openai.com/index/introducing-swe-bench-verified/ returned HTTP 403. Not cited.
- METR PDF (binary, not parsable); used the arXiv HTML instead.
- Lost in the Middle: only the abstract was read; no numeric figures quoted.
- Monitoring docs and model-config pages were partly truncated by the fetch tool. Event names were confirmed from the retrieved portions; check the `command_name` value format and the `EnterPlanMode`/`ExitPlanMode` `tool_name` values against live telemetry.

[cc-bp]: https://code.claude.com/docs/en/best-practices
[cc-costs]: https://code.claude.com/docs/en/costs
[cc-otel]: https://code.claude.com/docs/en/monitoring-usage
[cc-model]: https://code.claude.com/docs/en/model-config
[cc-ctx]: https://code.claude.com/docs/en/context-window
[cc-status]: https://code.claude.com/docs/en/statusline
[cc-cache]: https://code.claude.com/docs/en/prompt-caching
[cc-mem]: https://code.claude.com/docs/en/memory
[cc-wf]: https://code.claude.com/docs/en/common-workflows
[cc-sub]: https://code.claude.com/docs/en/sub-agents
[cc-perm]: https://code.claude.com/docs/en/permission-modes
[api-cache]: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
[api-prompt]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
[a-ctx]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
[a-multi]: https://www.anthropic.com/engineering/multi-agent-research-system
[a-agents]: https://www.anthropic.com/engineering/building-effective-agents
[a-harness]: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
[a-cacheblog]: https://claude.dev/blog/lessons-from-building-claude-code-prompt-caching-is-everything/
[oai-codex]: https://learn.chatgpt.com/guides/best-practices
[gem-mem]: https://www.geminicli.com/docs/cli/tutorials/memory-management
[gem-cfg]: https://www.geminicli.com/docs/reference/configuration
[liu]: https://arxiv.org/abs/2307.03172
[chroma]: https://www.trychroma.com/research/context-rot
[nolima]: https://arxiv.org/abs/2502.05167
[du]: https://arxiv.org/abs/2510.05381
[laban]: https://arxiv.org/abs/2505.06120
[metr25]: https://arxiv.org/html/2507.09089
[metr26]: https://metr.org/blog/2026-02-24-uplift-update/
[ambig]: https://arxiv.org/html/2502.13069
[selfplan]: https://arxiv.org/abs/2303.06689
[codeplan]: https://arxiv.org/abs/2309.12499
[agentless]: https://arxiv.org/html/2407.01489
[tdd]: https://arxiv.org/html/2402.13521
[sweagent]: https://arxiv.org/abs/2405.15793
[agentsmd]: https://arxiv.org/abs/2602.11988
[agentsmd-eff]: https://arxiv.org/abs/2601.20404
[ifscale]: https://arxiv.org/abs/2507.11538
[low-morph]: https://www.morphllm.com/claude-code-context-window
