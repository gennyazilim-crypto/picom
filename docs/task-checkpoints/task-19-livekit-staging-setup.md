# Task 19 - LiveKit Staging Setup

## Status

Prepared the LiveKit staging and manual voice/screen-share QA runbook. No remote LiveKit or Supabase project was modified.

## Delivered

- Server-only secret boundary and Edge Function deployment commands.
- Token authorization, room naming, identity, grant, and expiry checks.
- Two-user voice and full screen-share manual test sequence.
- Windows, Linux, and macOS permission/QA notes.
- Token function README and troubleshooting guide.
- Renderer-safe `VITE_LIVEKIT_ENABLED` flag plus a separate two-client/platform smoke checklist.

## Manual work remaining

- Create the staging LiveKit project/server.
- Set staging secrets in Supabase.
- Deploy `livekit-token`.
- Run authenticated and unauthorized token tests.
- Complete two-user voice and screen-share tests on packaged desktop targets.

## Validation

- `npm run livekit:smoke`
- `npm run typecheck`
- `npm run build`
