# Task 32 Checkpoint: LiveKit Production Setup

## Scope

- Added production LiveKit provider/region/secret/deployment guidance.
- Documented the actual one-hour token TTL, Supabase identity mapping, room naming, and publish/subscribe/data grants.
- Added the required two-user voice, speaking, mute/deafen, screen-share, permission, reconnect, and cleanup smoke matrix.
- Corrected the older Electron guide to the implemented room naming contract.
- Confirmed production env inventory already contains blank LiveKit server-secret placeholders and public renderer flags.

## Security boundaries

- API key/secret remain Supabase Edge Function/server-only.
- Renderer never generates or persists tokens.
- Room and identity are derived server-side after Supabase JWT/RLS checks.
- No provider/project was created, configured, or deployed in this task.

## Validation

- `npm run livekit:smoke` - passed structurally.
- `npm run electron:security:smoke` - passed.
- `npm run renderer:native:smoke` - passed.
- `npm run secrets:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed with the known non-blocking chunk warning.

## External work remaining

- Approve LiveKit Cloud or self-hosted provider, region, limits, monitoring, and owner.
- Set production secrets and deploy `livekit-token` under release approval.
- Execute the native Windows/Linux/macOS two-client smoke matrix.
