# metron-proto (PROTOTYPE, throwaway)

Spike answering: can a Claude Code mod show live prompt Suggestions (Tips while typing, Checks on Enter)?
Manual test plan: [docs/prototypes/metron-proto-test-plan.md](../../docs/prototypes/metron-proto-test-plan.md)

**This is a snapshot.** The live copy that hot-reloads is in Claude Code's dev-mods folder:
`/Users/zebra/.claude/dev-mods/8b6d1033-c8d7-4593-b62b-02221d8b37f7/metron-proto`

Sync live → repo:
```
rsync -a --exclude '.claude-plugin/types' --exclude tsconfig.json /Users/zebra/.claude/dev-mods/8b6d1033-c8d7-4593-b62b-02221d8b37f7/metron-proto/ prototypes/metron-proto/
```

Run it in any session: `claude --plugin-dir prototypes/metron-proto`
Tests: `claude plugin test prototypes/metron-proto`
