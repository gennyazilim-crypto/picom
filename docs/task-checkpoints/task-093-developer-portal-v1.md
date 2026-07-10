# Task 093 Checkpoint: Developer Portal v1

## Outcome

Added a feature-flagged desktop Developer Portal for safe bot/webhook metadata and explicit application/API documentation placeholders.

## Changes

- Added My Bots, Webhooks, Applications placeholder, and API Docs placeholder sections.
- Added a Settings > Advanced entry only when the feature flag and active-community management permission allow it.
- Reused existing bot credential status and safe webhook metadata services.
- Added a second guard inside the portal view.

## Safety

- Feature flag remains disabled by default.
- No normal-member entry point, public route, public publishing, raw token, token hash, API key, provider secret, or production API URL is exposed.
- No bot/plugin runtime, arbitrary code execution, shell, filesystem, or native IPC capability was added.
- Existing community/chat, Mention Feed, Profile, Supabase, LiveKit, and Electron behavior remains unchanged.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
