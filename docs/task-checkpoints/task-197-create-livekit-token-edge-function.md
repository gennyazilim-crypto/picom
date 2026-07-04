# Task 197 - Create LiveKit token Edge Function

## Scope

- Added `livekit-token` Supabase Edge Function.
- Added shared LiveKit JWT creation helper using Web Crypto.
- Configured the function with JWT verification enabled.
- Documented environment variables, security model, platform notes, and local test steps.

## Runtime impact

- Existing Electron renderer UI is unchanged.
- No LiveKit secrets or production credentials were committed.

## Verification

- Run `npm run supabase:smoke`.
- When Supabase CLI and LiveKit credentials are available, serve `livekit-token` and call it with a valid Supabase user access token.
