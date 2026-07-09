# Picom Production Edge Functions Verification

## Deployment inventory

Review and explicitly deploy only functions required by the approved release. Full MVP production-critical function:

- `livekit-token` - authenticated token issuance for permitted voice channels.

Other repository functions may be placeholders or optional boundaries and must not be described as production-complete without their own acceptance evidence.

## JWT configuration

`supabase/config.toml` requires JWT verification for `livekit-token`, `accept-invite`, `moderation-helper`, `notification-fanout`, and `validate-file`. `health` is the only listed unauthenticated function and must return non-sensitive status only.

For each protected function:

1. Missing bearer token: expect 401/auth-required error.
2. Malformed/expired token: expect 401 without echoing token details.
3. Valid user without resource permission: expect 403.
4. Valid authorized user and valid body: expect the documented result.
5. Unsupported method: expect 405 with explicit allowed methods.

## LiveKit token function

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` come only from Function secret storage.
- Function resolves the authenticated Supabase user and queries the requested channel through that user-scoped client.
- Requested IDs must be UUIDs and the channel must be a visible voice channel in the specified community.
- Room name is derived deterministically; caller cannot select an arbitrary room.
- Token identity is the authenticated user ID and TTL is one hour.
- Token response/error must never include API secret or service-role key.

## CORS

Current shared CORS is explicit and uses `Access-Control-Allow-Origin: *` with allowed headers `authorization, x-client-info, apikey, content-type` and methods `GET, POST, OPTIONS`.

Picom Electron may originate from `file://`/opaque origins, so an HTTP web-origin allowlist alone is not a security boundary. Protected functions must rely on JWT plus resource authorization. Before stable release:

- Confirm wildcard CORS is acceptable for bearer-token endpoints without credentialed cookies.
- Ensure `Access-Control-Allow-Credentials` is not enabled with wildcard origin.
- Restrict methods/headers per function where practical.
- Verify preflight and actual responses contain the same reviewed headers.

## Error and log redaction

- Return typed public error code/message only.
- Do not return stack traces, SQL, provider responses, tokens, secret names/values, or private row data.
- Do not log Authorization headers, request JWTs, LiveKit tokens, API secrets, service-role keys, or message bodies.
- Correlate with generated request IDs safe for support.

## Deployment and verification commands

After target and secrets are independently confirmed:

```powershell
supabase link --project-ref $env:SUPABASE_PROJECT_REF
supabase functions deploy livekit-token
npm run livekit:smoke
```

Record deployed function version/hash before and after. Never paste real refs/tokens/secrets into repository docs.

## Rollback

- Keep the last known-good function bundle/version reference.
- On auth/resource leakage, disable the voice entry point and revoke/rotate affected secrets before redeploying.
- On functional failure without leakage, redeploy last known-good function and keep desktop UI in a clear unavailable state.
- Re-run JWT, permission, CORS, redaction, and two-client voice smoke before resuming rollout.

## Release gate

Missing JWT enforcement, unauthorized room token issuance, renderer secret exposure, permissive resource access, or unredacted sensitive errors/logs blocks release.
