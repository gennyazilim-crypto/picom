# Local DB rehearsal

```text
LOCAL DB REHEARSAL:
BLOCKED_ENVIRONMENT
```

- Docker client present (29.4.2); engine/daemon not available (`docker version` produced no Server section, exit -1)
- `supabase` CLI: NOT_FOUND
- pgTAP `supabase/tests/rls/account_onboarding_rpc_contract.sql` not executed

This does not by itself block production apply if other safety gates pass. Recovery gate is the blocking gate.
