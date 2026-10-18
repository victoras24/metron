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
- Tips appear ~0.6 s after you **stop typing**, only for drafts of 5+ words.
- Ghost text appears on the **next keystroke after the pause** (e.g. type a space), cursor at end only.
- Checks (Large feature, Context > 60%) never show while typing; they fire on Enter.

## A. Tips while typing

| # | Do | Expect | Pass? | Notes |
|---|----|--------|-------|-------|
| 1 | Look at strip with empty box | Only debug line | | |
| 2 | Type `the login page crashes with an exception`, stop | After ~0.6 s: 💡 **Bug report** + `Use /mattpocock-skills:diagnosing-bugs` | | |
| 3 | From 2, type a space | Ghost `⟵ Bug report…` appears | | |
| 4 | Type `grill me then fix typo in readme.md`, stop | 💡 **Small task: skip the grilling session** | | |
| 5 | Type `make the dashboard page load faster for all the users please`, stop | 💡 **Add file paths and what "done" looks like** | | |
| 6 | Type `make src/dashboard/page.tsx load faster, it should render under 1s`, stop | No 💡 (has path + "should") | | |
| 7 | Type `implement a new billing feature`, stop | No 💡 (Large feature is a check → waits for Enter) | | |
| 8 | Type `fix the crash`, stop | No 💡 (under 5 words) | | |
| 9 | Type `/compact`, stop | No 💡 (slash commands ignored) | | |

## B. Pause behaviour

| # | Do | Expect | Pass? | Notes |
|---|----|--------|-------|-------|
| 10 | Type case 2 text **continuously** without stopping | No 💡 while typing; appears only once you stop | | |
| 11 | From 10, keep typing more words | 💡 stays stable, no flicker per key | | |
| 12 | From 2, delete `exception` and `crashes` with Backspace, stop | 💡 disappears after the pause | | |
| 13 | From 3, move cursor left with ← | Ghost disappears; strip stays | | |
| 14 | Paste a long paragraph | Debug `bursts` +1, `keys` unchanged | | |
| 15 | Type fast for ~10 s, then stop | No typing lag; debug `max` eval < 50 ms | | max = ___ ms |

## C. Checks on Enter

| # | Do | Expect | Pass? | Notes |
|---|----|--------|-------|-------|
| 16 | Type `implement a new billing feature`, press **Enter** | NOT sent. Text stays in box, notice "Metron check: Large feature…", strip shows ⛔ **Held** + `Use /grilling`; debug `held` +1 | | |
| 17 | From 16, click `Use /grilling`, then change text to `/grilling plan a new billing feature`… **don't send**; instead clear box | `/grilling ` inserted; debug `used` +1 | | |
| 18 | Type `build a tiny feature: reply with the word ok only`, press **Enter** | Held (⛔) | | |
| 19 | From 18, press **Enter** again (same text) | Sent to Claude (replies "ok"); debug `overridden` +1; ⛔ gone | | |
| 20 | Type `build a tiny feature: reply ok`, Enter (held), then edit to `plan first, then build a tiny feature: reply ok`, Enter | Second Enter sends (mentions plan); debug `fixed` +1 | | |
| 21 | Type `say hi in one word`, Enter | Sent immediately (no check); strip clears while Claude works | | |

## D. Optional

| # | Do | Expect | Pass? | Notes |
|---|----|--------|-------|-------|
| 22 | In a session with context > 60% (check `/context`), type anything, Enter | Held: ⛔ **Context is over 60% full** + `Use /compact` | | |
| 23 | Click `Hide debug` (empty box) | Strip disappears | | |

## Verdict

- Strip updates without lag: yes / no
- 0.6 s pause feels: too slow / right / too fast
- Ghost on next keystroke is: useful / confusing
- Held-once-on-Enter feels: helpful / annoying
- Max rule eval: ___ ms (budget 50 ms)
- Surprises / ideas:
