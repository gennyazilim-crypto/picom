# Task 484 - Settings Architecture and Persistence Completion

Date: 2026-07-11

## Outcome

Picom now has one canonical settings owner, `settingsService`, with a versioned local schema, guarded storage access, legacy migration, corruption recovery, subscriptions, initial-section routing, and an account-sync boundary for user notification preferences.

## Persistence contract

- Local device: theme, first-launch completion, accessibility, launch, cache, diagnostics, and device preferences.
- User account synced: notification preferences through the owner-only `user_settings` table.
- Community specific: existing community notification and permission services remain the owners.
- Server controlled: authorization, verification, moderation, feature flags, and other trust decisions are never overridden by local settings.
- Migration v4 to v5 preserves a completed first-launch state; v7 is the current local schema.
- Storage failures fall back to an in-memory copy for the current session.
- Invalid JSON is replaced with cloned defaults; diagnostics retain metadata only, never the corrupt settings contents.
- React components no longer write the Settings initial-section key directly.

## Supabase boundary

- Migration: `20260711148400_user_settings_persistence.sql`.
- RLS permits authenticated users to select, insert, and update only their own settings row.
- Only notification settings are synced; device, community, and server-controlled settings are excluded.
- UI components use `settingsService`; they do not call Supabase directly.

## Validation

- `npm run settings:architecture:smoke`: PASS
- `npm run first-launch:smoke`: PASS
- `npm run settings:completeness:test`: PASS
- `npm run settings:diagnostics:smoke`: PASS
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS
- `npm run supabase:smoke`: PASS
- `npm run supabase:rls:smoke`: PASS (structural)
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run performance:budget:ci`: PASS hard caps

Performance warnings remain below hard caps: initial JS 1580.6 KiB, initial CSS 229.8 KiB, and total assets 3086.1 KiB. The existing `voiceService` static/dynamic import warning is unrelated to this task.

## Blocked external evidence

The Supabase CLI and a configured hosted staging project are unavailable in this environment. Real pgTAP execution and hosted account-settings round-trip evidence remain BLOCKED; no hosted success is claimed. Run the repository RLS suite and verify cross-device notification hydration against staging before stable release.
