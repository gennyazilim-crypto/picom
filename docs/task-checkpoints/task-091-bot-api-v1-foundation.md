# Task 091 Checkpoint: Bot API v1 Foundation

## Outcome

Advanced Picom's bot identity foundation with safe one-time mock credential handling and a backend-only Supabase hash model, without enabling a public Bot API or runtime.

## Changes

- Preserved existing `is_bot`, bot profile, community installation, role permission, and BOT badge behavior.
- Added transient one-time mock token issuance for authorized community managers.
- Stored only SHA-256 hash/prefix/revocation metadata locally; raw token remains in component state only.
- Added credential revoke state and a 60 requests/minute policy placeholder.
- Added a locked-down `bot_credentials` migration with no anon/authenticated access.
- Documented future trusted Edge Function, API authentication, audit, abuse, and rate-limit boundaries.

## Safety

- Raw bot tokens are never stored or logged.
- Supabase renderer issuance remains disabled.
- No service-role credential, bot provider secret, public endpoint, marketplace, plugin runtime, dynamic loading, shell, or filesystem capability was added.
- Bot permissions continue to flow through assigned community roles.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`
