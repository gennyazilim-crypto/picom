# Task 125 Checkpoint: Rate Limiting and Abuse Hardening

## Result

Added fixed server-side user action limits for core authenticated mutations and LiveKit token requests, retained webhook isolation, and normalized rate-limit errors in renderer services.

## Implemented

- Private no-client-grant user/action counter table
- Server-selected fixed thresholds and atomic consume function
- Message, attachment metadata, reaction, follow/friend, and saved-message triggers
- LiveKit token 10/min user limit with safe 429/`Retry-After`
- Safe auth/message/reaction/upload/attachment/relationship error copy
- Structural pgTAP checks and complete control/gap documentation

## Explicit blocker

Direct Storage byte upload precedes metadata and is not fully protected by the metadata trigger. Production uploads require trusted upload grants/provider quotas, byte/object/concurrency caps, and orphan cleanup verification.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

## Remaining live evidence

Supabase CLI/staging must prove concurrent threshold denial, user isolation, reset/Retry-After, direct REST resistance, Auth CAPTCHA/provider settings, LiveKit no-token denial, webhook isolation, and redaction.

