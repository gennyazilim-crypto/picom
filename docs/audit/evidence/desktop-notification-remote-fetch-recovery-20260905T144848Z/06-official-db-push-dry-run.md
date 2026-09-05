# Official db push dry run

Command intent: production-linked official Supabase dry run only; no `--include-all`, no repair, no history mutation, and no apply.

Target ref: `cqnsetsmcduraryemhbi`.

Result: `BLOCKED_REMOTE_HISTORY_CLI_STRICT`.

The CLI reached production in dry-run mode, then stopped with:

```text
Remote migration versions not found in local migrations directory.
... repair --status reverted 20260808220000
... supabase db pull
```

Neither suggested operation is permitted: repair mutates hosted history, while `db pull` would materialize a synthetic source for a record whose historical SQL is unavailable. No production SQL ran.
