# Picom Known Issues

This document tracks known issues for the Picom beta readiness phase.

## Status labels

- `blocker`: must be fixed before beta distribution
- `critical`: strongly recommended before wider beta
- `major`: acceptable for limited beta only with workaround
- `minor`: acceptable for beta notes
- `placeholder`: intentionally incomplete MVP/beta area

## Current known issues

### KI-001: Stale Picom development processes can lock Windows package output

- Status: `minor`
- Area: Electron packaging
- Platforms: Windows
- Symptom: `electron-builder --dir` can fail when renaming `release/win-unpacked.tmp` to `release/win-unpacked`.
- Impact: Packaging pauses until project-specific Vite/Electron processes release the output directory. The current Windows NSIS candidate was produced successfully after targeted cleanup.
- Workaround:
  - Close running Picom/Electron processes.
  - Delete `release/win-unpacked.tmp`.
  - Retry `npm run package:windows`; elevation is not normally required.
- Reference: `docs/electron-packaging.md`
- Next step: Complete clean-account installer launch/uninstall smoke testing.

### KI-002: Production build emits large chunk warning

- Status: `minor`
- Area: Frontend build
- Platforms: Windows, Linux, macOS
- Symptom: Vite reports a chunk larger than 500 kB after minification.
- Impact: Build still passes, but startup performance should be monitored before beta expansion.
- Workaround: None required for limited beta.
- Next step: Consider code splitting for voice/media or optional views after core beta smoke tests.

### KI-003: Supabase CLI may be missing locally

- Status: `minor`
- Area: Supabase tooling
- Platforms: Windows, Linux, macOS
- Symptom: Supabase schema/type commands can warn or fail when the Supabase CLI is not installed.
- Impact: Does not block mock mode or renderer build, but can block local schema workflows.
- Workaround: Install Supabase CLI for backend schema/type generation workflows.
- Next step: Document exact Supabase CLI setup once beta backend project details are finalized.

### KI-004: macOS signing and notarization are placeholders

- Status: `placeholder`
- Area: macOS packaging
- Platforms: macOS
- Symptom: macOS beta artifacts are unsigned local placeholders.
- Impact: Testers may see OS trust prompts or need manual launch approval.
- Workaround: Use local beta smoke-test instructions and avoid presenting unsigned builds as production-ready.
- Next step: Add production signing/notarization only after final release identity and certificates exist.

### KI-005: Windows code signing is not configured

- Status: `placeholder`
- Area: Windows packaging
- Platforms: Windows
- Symptom: Windows installers are unsigned for local beta.
- Impact: SmartScreen or antivirus warnings may appear.
- Workaround: Document unsigned beta behavior in tester instructions.
- Next step: Add signing through secure CI secrets later; do not commit certificates or passwords.

### KI-006: Some Supabase/LiveKit beta flows depend on external beta services

- Status: `major`
- Area: Supabase and LiveKit
- Platforms: Windows, Linux, macOS
- Symptom: Supabase mode and LiveKit flows need valid beta URLs and safe public keys in `.env.local`.
- Impact: Testers without beta service access should use mock mode.
- Workaround: Use `.env.beta.example` and `docs/beta-environment.md`.
- Next step: Finalize beta Supabase project, RLS policies, LiveKit token flow, and smoke-test accounts.

### KI-007: Full platform package smoke tests are not complete

- Status: `major`
- Area: Release QA
- Platforms: Windows, Linux, macOS
- Symptom: Platform package configs are prepared, but full installer/package QA still needs manual runs.
- Impact: Do not promote beyond beta readiness until platform smoke tests pass.
- Workaround: Use:
  - `docs/windows-smoke-test.md`
  - `docs/linux-smoke-test.md`
  - `docs/macos-smoke-test.md`
- Next step: Run smoke tests on each target OS.

## Not known issues

These are intentional beta/MVP boundaries, not bugs:

- No mobile app or mobile layout.
- No Discord branding, copied assets, copied icons, or exact Discord colors.
- No production auto-update.
- No bot marketplace, plugin runtime, enterprise admin console, billing, or public discovery marketplace.

## Review cadence

- Update this document after every beta smoke-test session.
- Move fixed issues to release notes only after a passing verification run.
- Do not hide blockers in release notes; blockers must remain visible here until fixed.
