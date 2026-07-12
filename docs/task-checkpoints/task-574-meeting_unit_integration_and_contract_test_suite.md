# Task 574 checkpoint: Meeting unit, integration, and contract test suite

## Result

Added one deterministic aggregate runner for the existing meeting contract suite. It covers 44 focused contracts in seven groups, isolates mock evidence from hosted/native evidence, strips sensitive environment variables, uses cross-platform Node process spawning, continues to produce a complete failure inventory, and exits nonzero if any required contract fails.

## Changed files

- `scripts/meeting-contract-suite.mjs`
- `scripts/meeting-workspace-shell-smoke.mjs`
- `scripts/meeting-voice-lounge-layout-smoke.mjs`
- `scripts/meeting-speaker-focus-filmstrip-smoke.mjs`
- `scripts/meeting-right-dock-full-mvp-smoke.mjs`
- `docs/meeting-contract-test-suite.md`
- `docs/task-checkpoints/task-574-meeting_unit_integration_and_contract_test_suite.md`

## Required local validation

```powershell
npm ci
node scripts/meeting-contract-suite.mjs
npm run typecheck
npm run mock:smoke
npm run build
npm run performance:budget:ci
npm run qa:smoke
```

## Evidence classification

- Deterministic provider mocks, source contracts, executable pure logic, IPC fuzzing, and local SQL/pgTAP contracts: local gate.
- Hosted Supabase RLS, hosted LiveKit webhook/token/Realtime, real multi-client media, and native package behavior: not executed here and not called passed.
- Supabase CLI/hosted execution is expected in Task 577.

No product feature, dependency, schema, UI, Electron bridge, or unrelated user-owned file is changed. The concurrently modified `package.json` is intentionally untouched; the aggregate runner remains directly invocable without duplicating existing focused package scripts.
