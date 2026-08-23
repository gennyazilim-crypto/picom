# TASK 13C.2 — Packaged Auth → Legal → Account Onboarding → Main Product

Timestamp: 2026-08-16T2030Z  
Branch: `feat/community-rebuild` @ `af6babcf060da058fb295b7b37c27f75ca5c6f25`  
Product source changed: no  
Rebuild: no (accepted SHA retained)

## Exact statuses

```text
DEDICATED TEST IDENTITY A:
NOT_FOUND

DEDICATED TEST IDENTITY B:
NOT_FOUND

PRODUCTION E2E IDENTITY PROVISIONING:
AWAITING_OPERATOR_APPROVAL

PACKAGED AUTH USER A:
BLOCKED_TEST_IDENTITY

LEGAL ACCEPTANCE:
BLOCKED_TEST_IDENTITY

ACCOUNT ONBOARDING PACKAGED E2E:
BLOCKED_TEST_IDENTITY

PRODUCTION 5-ARG FUNCTIONAL E2E:
BLOCKED_TEST_IDENTITY

MAIN PRODUCT ENTRY:
BLOCKED

FIRST PRODUCT ACTION:
BLOCKED

PACKAGED SESSION RESTORE:
BLOCKED

PACKAGED RELOGIN:
BLOCKED

ACCOUNT SWITCH PACKAGED:
BLOCKED_TEST_IDENTITY

PRIVACY HOSTED ENFORCEMENT:
BLOCKED_TEST_IDENTITY

AUTH PACKAGED E2E:
BLOCKED_TEST_IDENTITY

MIGRATION HISTORY VERSION DRIFT:
OPEN_NONBLOCKING_FOR_AUTH_E2E
```

Secondary identity-provisioning note (not an alternate official status): operator-controlled `PICOM_PROD_E2E_EMAIL_A` / `PICOM_PROD_E2E_PASSWORD_A` are also unset. Approval phrase `APPROVE_PRODUCTION_E2E_IDENTITY_PROVISIONING` is absent. No production user was created.

## Why BLOCKED

Packaged authentication cannot start without a dedicated production E2E identity. Creating one is a production data mutation and is forbidden until both operator approval and secure credentials exist.

Hosted onboarding RPC is no longer the blocker. Immediate pre-auth reverify:

```text
TASK 02 HOSTED RECONCILIATION: APPLIED
PRODUCTION ONBOARDING RPC: CANONICAL_5_ARG
```

## What was proven without login

- Accepted Windows artifact SHA256 matches `e38a875bc06504b4112c7e2f114e19a64e46e580f24b725a523108b13a99c5a3`.
- Packaged `app.asar` still contains production ref `cqnsetsmcduraryemhbi` (6) and no staging ref `ufmtvqtsklqsmqxefbbs` (0).
- Hosted function oid 29163 is the single 5-arg overload; EXECUTE authenticated=true, anon=false, service_role=false.
- Hosted MCP migration row remains `20260816202306` / `reconcile_account_onboarding_rpc_contract` vs repo file `20260816000000_reconcile_account_onboarding_rpc_contract.sql`. Not repaired.
- `npm run typecheck` PASS. `npm run build` PASS (TASK 13C hashed-index failure is gone; repo `index.html` still matches HEAD).
- Stale auth smokes repaired semantically (soft verification, Account Center/i18n, current hydrate select). Product soft-verification semantics were not changed.

## Unblock

1. Operator sends `APPROVE_PRODUCTION_E2E_IDENTITY_PROVISIONING`.
2. Operator supplies secure `PICOM_PROD_E2E_EMAIL_A` / `PICOM_PROD_E2E_PASSWORD_A` (optional B).
3. Re-run this task on a fresh isolated `PICOM_USER_DATA_DIR` using the same accepted SHA unless a product fix forces rebuild.

## Verdict

```text
TASK 13C.2 VERDICT: BLOCKED
```
