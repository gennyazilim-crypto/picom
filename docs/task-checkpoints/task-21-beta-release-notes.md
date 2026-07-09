# Task 21 Checkpoint: Beta Release Notes and Known Issues

## Result

The beta release notes now describe the completed Full MVP surfaces, explicit exclusions, install/sign-in guidance, required tester flows, issue reporting, and redacted diagnostics export. A separate known-issues register records packaging, Supabase staging, LiveKit, screen-share, and platform limitations without making false production claims.

## Files

- `docs/beta-release-notes.md`
- `docs/beta-known-issues.md`
- `docs/known-issues.md`
- `docs/beta-test-flows.md`
- `docs/task-checkpoints/task-21-beta-release-notes.md`

## Validation

Documentation-only change. Runtime code, Electron configuration, UI, and dependencies were not changed.

## Safety

- No credentials or production endpoints were added.
- Unsigned package behavior is disclosed.
- Native-platform and staging checks are explicitly marked as required manual validation.
