# Task 088 Checkpoint: Logs and Diagnostics Pipeline

## Outcome

Centralized the canonical logging and diagnostics implementations while preserving existing imports and support UI behavior.

## Changes

- Added typed log levels and a 250-entry retention boundary.
- Added JSON and text log export.
- Added versioned JSON and support-readable text diagnostics export.
- Included version, platform, channel, current view, Supabase status, LiveKit status, and recent redacted errors.
- Excluded active community/channel IDs from exported diagnostics.
- Preserved feedback/support export and compatibility re-exports.

## Safety

- Passwords, tokens, authorization headers, service-role keys, private keys, and LiveKit secrets are redacted.
- No external logging provider, endpoint, DSN, or credential was added.
- No private content is intentionally collected by the pipeline.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
