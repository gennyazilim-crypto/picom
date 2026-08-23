# Evidence manifest — TASK 13C

No secrets, tokens, passwords, or session cookies are included.

| File | Purpose |
|---|---|
| 00-summary.md | Verdict and exact status lines |
| PACKAGE.txt | Accepted artifact version + SHA, no rebuild |
| backend.json | Packaged auth backend proof |
| identity-discovery.json | Dedicated identity search (NOT_FOUND) |
| rpc-contract.json | Hosted production RPC + TASK 02 history |
| required-migration.txt | Exact migration required; not applied |
| scenario-matrix.md | Scenario × result |
| suite-classification.json | Red-suite PRODUCT_DEFECT / STALE_TEST / TEST_INFRA_BUG |
| invalid-login.json | One controlled invalid login |
| screenshots/01-invalid-login.png | Login error UI (synthetic email) |
| run-invalid-login.mjs | Isolated-profile operator (no credentials) |
| suites/ | Automated suite stdout |
| git-HEAD.txt | HEAD at start |
| git-status-before.txt | Dirty tree before |
| git-status-after.txt | Dirty tree after |
| manifest.md | This file |
