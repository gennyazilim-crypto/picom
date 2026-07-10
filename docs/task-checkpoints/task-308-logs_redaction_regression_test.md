# Task 308 - Logs redaction regression test

## Result

- Extracted the shared log/diagnostics redaction implementation into a testable module used by `loggingService`.
- Added executable regression coverage for nested metadata, arrays, Error message/stack, circular objects, query/JSON-style secrets, Bearer/Basic authorization, cookies/sessions, JWTs, bot tokens, Supabase service-role values, LiveKit secrets, signing keys, and private keys.
- Confirms sentinel secret values cannot survive in the simulated support export while safe metadata remains.
- Existing support diagnostics continues to pass logs/errors through the same redaction implementation.

## Synthetic sample policy

Tests use obvious `TEST_*_VALUE_308` sentinels only. They do not contain or require real credentials.

## Validation

- `npm run logs:redaction:regression:test`
- `npm run logs:smoke`
- `npm run diagnostics:smoke`
- `npm run support:diagnostics:final:test`
- `npm run secrets:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual sample

In development, log a synthetic object containing `password`, `authorization`, `supabaseServiceRoleKey`, and `livekitSecret` test sentinels. Open Settings > Diagnostics/Logs, copy and export, and confirm only `[redacted]` markers remain. Never perform this check with real secrets.
