# Task 31 Checkpoint: Production Storage, Realtime, and Edge Functions Verification

## Scope

- Added separate production verification runbooks for Storage, Realtime, and Edge Functions.
- Replaced private-bucket `getPublicUrl` usage with an authenticated one-hour signed URL for immediate upload preview.
- Stopped persisting expiring signed/thumbnail URLs in attachment metadata.
- Documented current CORS/JWT/token/redaction behavior and manual smoke gates.

## Security decision

- `message-attachments` remains private.
- Object path and metadata are durable; signed URLs are temporary session delivery values.
- Service-role and LiveKit API secrets remain server-only.
- No remote bucket, publication, function, or secret was changed.

## Validation

- `npm run supabase:smoke` - passed structurally; Supabase CLI unavailable warning remains.
- `npm run supabase:rls:smoke` - structural coverage passed; real pgTAP not executed.
- `npm run realtime:ordering:smoke` - passed.
- `npm run realtime:backpressure:smoke` - passed.
- `npm run livekit:smoke` - passed structurally.
- `npm run secrets:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed with the known non-blocking chunk warning.

## Remaining production blocker

- Historical private attachments need an authenticated signed-URL refresh resolver on message load/reload and a connected staging test before production distribution.
- Realtime two-window, private subscription, and deployed Edge Function tests require configured external environments.
