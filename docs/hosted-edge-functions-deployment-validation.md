# Hosted Edge Functions Deployment Validation

Status date: 2026-07-11  
Result: **BLOCKED - no protected staging deployment context**

## Release-scope inventory

| Function | Classification | Task 420 result |
| --- | --- | --- |
| `livekit-token` | Full MVP release-scoped | BLOCKED; source contract passes, not deployed or called in this session |
| `validate-file` | Internal upload-validation boundary | Not promoted; current release dependency and hosted behavior not proven |
| `accept-invite` | Explicit 501 placeholder | Excluded from production deployment |
| `moderation-helper` | Explicit 501 placeholder | Excluded from production deployment |
| `notification-fanout` | Internal/beta placeholder | Excluded |
| `webhook-message` | Post-MVP | Excluded |
| `account-deletion` | Protected lifecycle candidate | Requires separate privacy/operations approval |
| `account-deletion-finalize` | Protected lifecycle candidate | Requires separate privacy/operations approval |
| `user-data-export` | Protected lifecycle candidate | Requires separate privacy/operations approval |
| `client-config` | Internal configuration boundary | Not release-certified here |
| `health` | Internal operational endpoint | Not release-certified here |

Only `livekit-token` is required by the locked Full MVP scope. Placeholder functions were not deployed merely to make a checklist appear green.

## Static security evidence

- Protected functions require JWT verification in Supabase configuration.
- `livekit-token` accepts POST/OPTIONS only and validates JSON, UUIDs, intent, and voice-channel visibility.
- Auth identity is used as LiveKit participant identity.
- Room names are derived from community/channel IDs; callers cannot select arbitrary rooms.
- Tokens are short-lived and provider secrets stay in Function environment storage.
- Missing/invalid JWT, method, CORS, placeholder, and secret-boundary contracts pass locally.
- No service-role key, LiveKit secret, response token, or Authorization header is logged by the validation path.

## Local results

| Command | Result |
| --- | --- |
| `npm run edge:staging:preflight` | PASS; no network request |
| `npm run edge:staging:contract:test` | PASS |
| `npm run secrets:smoke` | PASS |
| `npm run supabase:smoke` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |

## Missing hosted evidence

The operator session has no Supabase CLI/project link, no protected Edge staging variables, and no LiveKit provider secret configuration. Therefore none of these claims are made:

- deployment of a function version,
- valid JWT business response,
- invalid/expired JWT response from hosted staging,
- wrong-resource 403 response,
- malformed-body 400 response,
- wrong-method 405 response,
- hosted CORS response,
- hosted rate-limit behavior,
- real LiveKit token issuance.

Required variables must be supplied through a protected execution environment and never committed. The staging matrix must run with synthetic accounts and redacted output before this blocker can close.

## Release impact

Hosted Edge Functions remain **BLOCKED**. RB-03 and the LiveKit-dependent RB-04 remain open.

