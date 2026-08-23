# TASK 13C — Auth / Legal / Account Onboarding packaged E2E

Timestamp: 2026-08-16T2000Z  
Branch: `feat/community-rebuild` @ `af6babcf060da058fb295b7b37c27f75ca5c6f25`  
Product code changed: no  
Rebuild: no

## Exact statuses

```text
DEDICATED TEST IDENTITY:
NOT_FOUND

TASK 02 HOSTED RECONCILIATION:
NOT_APPLIED

PRODUCTION ONBOARDING RPC:
LEGACY_3_ARG

PACKAGED LOGIN:
BLOCKED_TEST_IDENTITY

LEGAL ACCEPTANCE:
BLOCKED_TEST_IDENTITY

ACCOUNT ONBOARDING PACKAGED E2E:
BLOCKED_BACKEND

MAIN PRODUCT ENTRY:
BLOCKED

FIRST PRODUCT ACTION:
BLOCKED

ACCOUNT SWITCH PACKAGED:
BLOCKED_TEST_IDENTITY

PRIVACY HOSTED ENFORCEMENT:
BLOCKED_TEST_IDENTITY

AUTH PACKAGED E2E:
BLOCKED_BACKEND
```

## Why BLOCKED

Two independent release gates failed before the mutation path:

1. No dedicated safe test identity exists in repo, local env, or available secrets. Creating a production account is forbidden.
2. Hosted production `complete_current_user_onboarding` is still the legacy 3-argument function. TASK 02 reconciliation is not in `schema_migrations`. Applying it is forbidden under this task.

A valid login would still be unable to Finish account onboarding against the hosted 3-arg RPC while the packaged client sends 5 named arguments.

## What was proven without login

- Packaged artifact authenticates only to `cqnsetsmcduraryemhbi` (production).
- Repo still contains TASK 02 migration `20260816000000_reconcile_account_onboarding_rpc_contract.sql` (SHA256 `0a1a3d88bed83e654e36e89da60c2b08a611a4da47cb2dd9eb38fad3ff1af07d`).
- Client + generated types remain 5-arg. `npm run onboarding:rpc-contract:smoke` PASS.
- Hosted production: 1 overload, args `target_profile jsonb`, `target_followed_user_ids uuid[]`, `target_theme text`, SECURITY DEFINER, `search_path=public`, EXECUTE authenticated+service_role.
- One controlled invalid login on the TASK 13B completed isolated profile: clear error, no session, no first-run, no onboarding.

## Unblock for a later authorized task

1. Provision a dedicated production E2E identity (alias `E2E_USER_A`) — do not use personal accounts.
2. Apply `20260816000000_reconcile_account_onboarding_rpc_contract.sql` to production under a separate explicitly authorized migration task.
3. Re-run packaged Auth → Legal → Account Onboarding → Main Product on a fresh isolated profile.

## Verdict

```text
TASK 13C VERDICT: BLOCKED
```
