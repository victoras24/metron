# metron-proto: manual test plan (PROTOTYPE, throwaway)

**Questions:**
1. Can a Claude Code mod watch the draft prompt and show Suggestions live, without lag?
2. Does the split feel right: **tips** while typing (after a pause) + **checks** on Enter (held once)?

**Setup:** mod loaded (hot reload on). Do NOT press Enter unless a step says so; Enter may send the prompt to Claude.
Clear the box between cases with `Ctrl+U` (or select-all + delete).

Where to look:
- **Strip** = band above the prompt: 💡 tips, ⛔ held checks, debug line `[metron-proto] …`
- **Ghost** = dim text after your cursor, starting with `⟵`

How it behaves:
- Tips appear ~0.6 s after you **stop typing**, only for drafts of 5+ words (slash commands exempt).
- Ghost text appears on the **next keystroke after the pause** (e.g. type a space), cursor at end only.
- Checks (plan first, bug without evidence, 3rd correction) never show while typing; they fire on Enter.
- Rules and thresholds come from [prompting-best-practices.md](../research/prompting-best-practices.md). Numbers marked "unverified" in `PLAYBOOK` are guesses to calibrate.

## A. Tips while typing

| # | Do | Expect | Pass? | Notes |
|---|----|--------|-------|-------|
| 1 | Look at strip with empty box | Only debug line | | |
| 2 | Type ``the login page crashes when I run `npm start` ``, stop | After ~0.6 s: 💡 **Ask for a failing test** + `Use /mattpocock-skills:diagnosing-bugs` | | |
| 3 | From 2, type a space | Ghost `⟵ Ask for a failing test…` appears | | |
| 4 | Type `grill me then fix typo in readme.md`, stop | 💡 **Clear, small change: skip planning/interview** | | |
| 5 | Type `make the dashboard page load faster for all the users please`, stop | 💡 **Say what "done" looks like** and 💡 **Point to the file or symbol** | | |
| 6 | Type `make src/dashboard/page.tsx load faster, it should render under 1s`, stop | No 💡 (has path + "should") | | |
| 7 | Type `how does the billing module handle refunds for users`, stop | No 💡 (question, not a change) | | |
| 8 | Type `investigate why the app feels slow lately`, stop | 💡 **Scope it… or have a subagent investigate** | | |
| 9 | Type `implement a new billing feature`, stop | No 💡 (plan first is a check → waits for Enter) | | |
| 10 | Type `fix the crash`, stop | No 💡 (under 5 words) | | |
| 11 | Type `/compact`, stop (fresh session) | No 💡 | | |

## B. Pause behaviour

| # | Do | Expect | Pass? | Notes |
|---|----|--------|-------|-------|
| 12 | Type case 2 text **continuously** without stopping | No 💡 while typing; appears only once you stop | | |
| 13 | From 12, keep typing more words | 💡 stays stable, no flicker per key | | |
| 14 | From 2, delete `crashes` with Backspace, stop | 💡 changes/disappears after the pause | | |
| 15 | From 3, move cursor left with ← | Ghost disappears; strip stays | | |
| 16 | Paste a long paragraph | Debug `bursts` +1, `keys` unchanged | | |
| 17 | Type fast for ~10 s, then stop | No typing lag; debug `max` eval < 50 ms | | max = ___ ms |

## C. Checks on Enter

| # | Do | Expect | Pass? | Notes |
|---|----|--------|-------|-------|
| 18 | Type `implement a new billing feature`, press **Enter** | NOT sent. Notice "Metron check: Multi-file or unclear approach: plan first…", ⛔ **Held** + `Use /grilling`; debug `held` +1 | | |
| 19 | Type `build a tiny feature: reply with the word ok only`, press **Enter** | Held (⛔) | | |
| 20 | From 19, press **Enter** again (same text) | Sent (replies "ok"); debug `overridden` +1; ⛔ gone | | |
| 21 | Type `build a tiny feature: reply ok`, Enter (held), edit to `plan first, then build a tiny feature: reply ok`, Enter | Sends; debug `fixed` +1 | | |
| 22 | Type `the login page crashes`, Enter | Held: ⛔ **Bug with no error text or repro** | | |
| 23 | Type `login crashes with "TypeError: user is undefined", reply ok only`, Enter | Sent (has error text) | | |
| 24 | Type `say hi in one word`, Enter | Sent immediately; strip clears while Claude works | | |

## D. Session rules

| # | Do | Expect | Pass? | Notes |
|---|----|--------|-------|-------|
| 25 | Send `that still does not work, reply ok`; then type `no, it still does not work at all`, stop | 💡 **2nd correction… /clear**; debug `corrections 1` | | |
| 26 | Send 25's text, then type `still not working`, Enter | Held: ⛔ **Correction loop** | | |
| 27 | After any reply, type `/model`, stop | 💡 **Switching model/effort/fast mid-Session rebuilds the prompt cache** | | |
| 28 | Session with > 50k context, idle > 5 min, type `/compact`, stop | 💡 **Cache likely expired** | | |
| 29 | Session with > 150k context (debug `ctx`), type any 5+ word draft, stop | 💡 **Context over 150k tokens** + `Use /compact` (tip only, never held) | | |
| 30 | Click `Hide debug` (empty box) | Strip disappears | | |

## Verdict

- Strip updates without lag: yes / no
- 0.6 s pause feels: too slow / right / too fast
- Ghost on next keystroke is: useful / confusing
- Held-once-on-Enter feels: helpful / annoying
- Max rule eval: ___ ms (budget 50 ms)
- Surprises / ideas:
