# Edge Functions staging validation

This gate validates deployed `livekit-token`, `accept-invite`, and `moderation-helper` through the hosted
staging Function gateway. It uses the anon/publishable key plus one ordinary synthetic Auth session and
never accepts or logs service-role/LiveKit secrets.

## Required process values

- `PICOM_EDGE_STAGING_URL`, `PICOM_EDGE_STAGING_ANON_KEY`
- `PICOM_EDGE_STAGING_CONFIRM=STAGING_ONLY`
- `PICOM_EDGE_STAGING_USER_EMAIL`, `PICOM_EDGE_STAGING_USER_PASSWORD`
- `PICOM_EDGE_STAGING_ORIGIN` (synthetic HTTP(S) origin for CORS assertions)
- `PICOM_EDGE_COMMUNITY_ID`, `PICOM_EDGE_VOICE_CHANNEL_ID`
- `PICOM_EDGE_INVITE_CODE` (valid-format synthetic code; placeholder function performs no acceptance)

The user must be allowed to view the staging voice channel. Set values through an approved secret runner
or current shell only; never commit them or paste them into evidence.

```powershell
npm run edge:staging:preflight
npm run edge:staging:test
```

For each protected function the runner checks OPTIONS/CORS, missing and invalid JWT denial, and authenticated
wrong-method 405. Invite/moderation must return their typed 501 no-action placeholders. LiveKit must return
a channel-bound, user-bound token expiring in about one hour; token and URL are validated in memory and never
printed. Wildcard CORS is currently accepted only because credentialed cookies are disabled and JWT/resource
authorization is mandatory; `Access-Control-Allow-Credentials` must remain absent.

## Current result - 2026-07-10

Status: **BLOCKED / NOT RUN**. No staging Function URL/key, synthetic user credentials, origin, or fixture
IDs are available in this environment, and Supabase CLI is unavailable. Static JWT/CORS/secret contract
tests are not hosted evidence. Deploy to isolated staging, inject values securely, rerun, and retain only
redacted status/timing/function-version evidence privately.
