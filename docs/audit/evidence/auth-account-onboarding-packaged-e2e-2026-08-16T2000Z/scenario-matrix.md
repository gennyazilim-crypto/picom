# TASK 13C scenario matrix

Artifact: `0.1.1-beta.11` SHA256 `e38a875bc06504b4112c7e2f114e19a64e46e580f24b725a523108b13a99c5a3`

| Scenario | Result | Evidence | Notes |
|---|---|---|---|
| Dedicated test identity discovery | NOT_FOUND | identity-discovery.json | No local E2E/TEST_EMAIL/AUTH_TEST. CI secret names exist for staging Edge only. Did not create a production account. |
| Packaged auth backend | RUNTIME_TEST_PASS | backend.json | ASCII scan of packaged `app.asar` only found `cqnsetsmcduraryemhbi.supabase.co`. |
| TASK 02 repo migration present | RUNTIME_TEST_PASS | rpc-contract.json | `20260816000000_reconcile_account_onboarding_rpc_contract.sql` SHA256 `0a1a3d88bed83e654e36e89da60c2b08a611a4da47cb2dd9eb38fad3ff1af07d`. |
| Client 5-arg contract | RUNTIME_TEST_PASS | rpc-contract.json, onboarding_rpc-contract_smoke.txt | `onboardingService.ts` sends 5 named args. `npm run onboarding:rpc-contract:smoke` exit 0. |
| Hosted TASK 02 migration | NOT_APPLIED | rpc-contract.json | `schema_migrations` has no `20260816%` / reconcile-onboarding rows. |
| Production onboarding RPC | LEGACY_3_ARG | rpc-contract.json | 1 overload, 3 args, DEFINER, `search_path=public`, service_role still granted. Missing `onboarding_start_choice` / `onboarding_initial_feed`. |
| Packaged valid login | BLOCKED_TEST_IDENTITY | identity-discovery.json | No dedicated identity. Did not use personal credentials. |
| Invalid login (one attempt) | PACKAGED_PASS | invalid-login.json, screenshots/01-invalid-login.png | Synthetic `invalid-e2e@example.invalid`. Clear error. No session. No first-run. No onboarding. |
| Email verification gate | BLOCKED_TEST_IDENTITY | — | Product policy is soft verification (does not block login). Could not observe a real account. |
| Legal acceptance | BLOCKED_TEST_IDENTITY | — | Precedence architecture exists in source; packaged path not reached. |
| Account onboarding entry/resume/steps | BLOCKED_BACKEND | required-migration.txt | Even with an identity, Finish would call 5-arg client against 3-arg hosted RPC. Mutation path stopped. |
| Finish RPC 5-arg | BLOCKED_BACKEND | rpc-contract.json | Hosted `arg_count=3`. |
| Fail-closed Finish | BLOCKED_BACKEND | — | Not exercised against production. Repo fail-closed invariant remains in client. |
| Server completion read-back | BLOCKED_TEST_IDENTITY | — | No authenticated own-profile read. |
| Main product entry | BLOCKED | — | Auth + backend blockers. |
| First product action | BLOCKED | — | TASK 12 mode POST_AUTH_ONLY; no eligible account. |
| Restart / session restore | BLOCKED_TEST_IDENTITY | — | No authenticated session created. |
| Logout / relogin | BLOCKED_TEST_IDENTITY | — | |
| Account switch | BLOCKED_TEST_IDENTITY | — | No second fixture. Did not manufacture one. |
| Authenticated privacy / hosted enforcement | BLOCKED_TEST_IDENTITY | — | TASK 10 hosted enforcement remains unavailable without identities. |
| Google / Steam / Epic | NOT_APPLICABLE | — | No dedicated provider credentials. Out of scope. |
| Auth callback / deep-link | RUNTIME_TEST_PASS | auth_v2_contract.txt, electron_security_smoke.txt | Source/security suites green. Packaged OAuth callback not invoked. |
| Offline session start | NOT_APPLICABLE | — | Optional; skipped. |
| Rebuild / new SHA | NOT_APPLICABLE | PACKAGE.txt | No product fix. Same SHA retained. |
| Apply TASK 02 migration | NOT_APPLICABLE | required-migration.txt | Explicitly not authorized under 13C. |
