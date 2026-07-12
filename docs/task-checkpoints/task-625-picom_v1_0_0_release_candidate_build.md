# Task 625 Checkpoint - Picom v1.0.0 Release Candidate Build

Date: 2026-07-12
Result: **BLOCKED / NO ARTIFACT / NO-GO**

## Passed

- Clean locked dependency install; zero reported vulnerabilities.
- Secret, license, dependency and API-version contracts.
- Typecheck, explicit mock contract and production build.
- Full deterministic QA and static Supabase gates.
- Visual/E2E coverage, checksum and provenance contracts.
- Renderer hard performance budgets.
- Electron packaging configuration contract.
- V1 scope, production data-source, hidden Voice/Screen and Edge allowlist contracts.
- Hosted-validation workflow migrated from Node 20 action runtimes to official Node 24 action versions; CI workflow contract passes.

## Blocked prerequisites

- Tasks 619/620: hosted Supabase actor, Storage, Realtime and Edge evidence incomplete.
- Task 622: no trusted certificate, signing tool/workflow run, signed artifact or clean Windows matrix.
- Task 623: legal approval, root license and production owners/custodians missing.
- Task 624: Storage object-byte recovery and live Auth token rejection unproven.
- Package identity remains `0.1.1-beta.1`, not frozen `1.0.0`.
- Support/status/download URLs and production environment are not frozen.

## Release safety decision

No Windows installer was generated, renamed, signed, hashed or published. Fixture checksum/provenance checks are not artifact evidence. Task 626 cannot approve stable release from this checkpoint.

## Remaining local risks

- initial CSS is only 0.1 KiB below its hard cap;
- total assets are only 25.5 KiB below the hard cap;
- visual and E2E scripts validate coverage contracts, not real pixel/UI-runner execution;
- Supabase QA is static/local and does not replace hosted staging evidence.

The local code gate is healthy, but the immutable V1 RC does not exist.
