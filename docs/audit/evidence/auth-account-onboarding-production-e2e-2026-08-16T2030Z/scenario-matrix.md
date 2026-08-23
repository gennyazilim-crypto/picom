# TASK 13C.2 scenario matrix

| Scenario | Result | Evidence | Notes |
|---|---|---|---|
| Artifact SHA reverify | PASS | PACKAGE.txt | Matches accepted `e38a875bc06504b4112c7e2f114e19a64e46e580f24b725a523108b13a99c5a3` |
| Packaged backend production | PASS | backend.json | `cqnsetsmcduraryemhbi` x6; staging x0 |
| Hosted RPC canonical 5-arg | PASS | rpc-reverify.json | oid 29163; required args/returns present |
| Migration history version drift | OPEN_NONBLOCKING_FOR_AUTH_E2E | rpc-reverify.json | repo `20260816000000` vs hosted `20260816202306`; not repaired |
| Identity A discovery | NOT_FOUND | identity-discovery.json | No `PICOM_PROD_E2E_*` keys |
| Identity B discovery | NOT_FOUND | identity-discovery.json | Optional secondary |
| Identity provisioning | AWAITING_OPERATOR_APPROVAL | identity-discovery.json | Approval phrase absent; credentials also unset |
| Invalid login (prior 13C isolated profile) | PACKAGED_PASS | ../auth-account-onboarding-packaged-e2e-2026-08-16T2000Z/invalid-login.json | One controlled invalid login already proven; not repeated |
| Packaged auth user A | BLOCKED_TEST_IDENTITY | 00-summary.md | No dedicated identity |
| Soft email verification runtime | BLOCKED_TEST_IDENTITY | 00-summary.md | Source policy remains soft/non-blocking; account state not observed |
| Legal acceptance | BLOCKED_TEST_IDENTITY | 00-summary.md | Fresh account path not entered |
| Legal failure safety | BLOCKED_TEST_IDENTITY | 00-summary.md | UI attack not performed |
| Account onboarding entry | BLOCKED_TEST_IDENTITY | 00-summary.md | |
| Account onboarding resume | BLOCKED_TEST_IDENTITY | 00-summary.md | |
| Profile / Theme / Community / Follow | BLOCKED_TEST_IDENTITY | 00-summary.md | Skip policy unused |
| Finish 5-arg RPC packaged | BLOCKED_TEST_IDENTITY | rpc-reverify.json | Introspection only; no authenticated call |
| Server completion read-back | BLOCKED_TEST_IDENTITY | 00-summary.md | |
| Main product entry | BLOCKED | 00-summary.md | |
| First product action | BLOCKED | 00-summary.md | POST_AUTH_ONLY |
| Session restore | BLOCKED | 00-summary.md | |
| Logout / relogin | BLOCKED | 00-summary.md | |
| Account switch packaged | BLOCKED_TEST_IDENTITY | 00-summary.md | B unavailable |
| Privacy hosted enforcement | BLOCKED_TEST_IDENTITY | 00-summary.md | Cross-user proof requires B |
| Auth callback / deep-link | NOT_APPLICABLE + RUNTIME_TEST_PASS | protocol_handler_smoke.txt, global_navigation_deep_links_smoke.txt, auth_v2_contract.txt | Email/password does not need external OAuth callback; existing suites green |
| External Google/Steam/Epic | NOT_IN_SCOPE | — | Not expanded |
| typecheck | PASS | suites/typecheck.txt | exit 0 |
| build | PASS | suites/build.txt | exit 0; hashed-index issue cleared |
| onboarding:rpc-contract:smoke | PASS | suites/onboarding_rpc-contract_smoke.txt | |
| auth:onboarding:production:smoke | PASS | suites/auth_onboarding_production_smoke.txt | Semantic repair; product semantics unchanged |
| first-launch ready/privacy/smoke | PASS | suites/ | |
| i18n catalog | PASS | suites/i18n_catalog-integrity_smoke.txt | |
| legal acceptance smoke | PASS | suites/legal_acceptance_test.txt | |
| auth v2 / login-method / sessions / email / password-reset | PASS | suites/ | Sessions + email smokes updated for Account Center/i18n |
| electron security / preload / ipc-fuzz | PASS | suites/ | |
| protocol-handler / feed deep-links / global navigation | PASS | suites/ | |
| auth:onboarding:finish:unit | MISSING_SCRIPT | suites/auth_onboarding_finish_unit.txt | package.json points at absent file; not invented this task |
| Screenshots 01–11 | BLOCKED_TEST_IDENTITY | screenshots/README.md | No password/email captured |
| Dirty tree | PRESERVED | git-status-after.txt | 472 short-status lines; no reset/stash/commit/push |
