# Task 491 Checkpoint: Settings Full MVP End-to-End QA

## Outcome

- Audited all Full MVP Settings sections and their service boundaries.
- Removed stale visible future/coming-soon copy from active settings surfaces.
- Kept production auto-update and automatic inactivity lock explicitly unavailable rather than exposing fake controls.
- Corrected the persistence contract from obsolete settings schema 8 to schema 9.
- Replaced the stale corrupted-settings placeholder reason with the canonical `corrupted_local_settings` Safe Mode reason across service, banner, and smoke contracts.
- Added a Settings Full MVP end-to-end static contract covering sections, real service wiring, persistence recovery, privacy boundaries, and required QA gates.

## Safety

- No Supabase table access was added to UI components.
- No authentication token, private content, or environment secret is included in Settings diagnostics.
- Cache/reset actions remain bounded and preserve auth sessions, drafts, queues, and server data.
- Production auto-update remains disabled and development simulations remain development-only.

## Evidence

See `docs/settings-full-mvp-qa.md` for the command matrix, manual restart/corruption procedure, platform evidence boundary, and Full MVP exclusions.

## Remaining manual evidence

- Packaged Windows/Linux/macOS restart persistence.
- Native startup and tray behavior on supported platforms.
- Real microphone/speaker device switching.
- Native notification permission and delivery.
