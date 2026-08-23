# Apply mechanism (PHASE B only, after approval + recovery PASS)

Do **not** run `supabase db push`. Local CLI is linked to staging `ufmtvqtsklqsmqxefbbs`.

Scoped production path:

1. Supabase MCP `apply_migration`
2. `project_id` = `cqnsetsmcduraryemhbi`
3. `name` = `reconcile_account_onboarding_rpc_contract`
4. `query` = exact contents of `20260816000000_reconcile_account_onboarding_rpc_contract.sql`

`apply_migration` executes the SQL and records `supabase_migrations.schema_migrations`. Do not insert a history row without executing SQL. Do not execute SQL without recording history.

Post-apply must prove:

- hosted function is 5-arg
- history contains this reconciliation (prefer version `20260816000000` / name `reconcile_account_onboarding_rpc_contract`; if MCP assigns a different version timestamp, record the actual row and confirm it is this SQL only)

No other pending repository migrations.
