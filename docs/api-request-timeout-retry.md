# API Request Timeout and Retry Policy

Picom uses Supabase for most MVP backend access, but shared API-style calls still need predictable timeout and retry behavior as Edge Functions, health/config endpoints, and future backend routes grow.

## Policy summary

- Every generic API request should have a timeout.
- External abort signals must be respected.
- Safe `GET`/`HEAD` requests may retry automatically.
- Unsafe `POST`/`PATCH`/`DELETE` requests must not retry automatically unless an idempotency key is present.
- Login/register/auth mutations should not be retried aggressively.
- Uploads should not be retried automatically without user action unless a future resumable upload path is implemented.
- Timeout/network errors should map to user-friendly copy, not raw stack traces.

## Implementation

`src/services/apiClient.ts` provides:

- `apiClient.request<T>()`
- request timeout support
- external `AbortSignal` support
- safe retry policy for `GET`/`HEAD`
- idempotency-key based retry for unsafe mutations
- consistent timeout/network/http error codes
- `formatApiClientError()` for user-facing messages

## Retry rules

| Request type | Automatic retries | Notes |
| --- | --- | --- |
| `GET` / `HEAD` | Yes, default 2 retries | For status 408, 425, 429, and 5xx or network timeout. |
| `POST` with `Idempotency-Key` | Yes, controlled | Used only when backend can safely return previous result. |
| `POST` login/register/auth | No | Avoid repeated auth attempts and noisy account/security signals. |
| Uploads | No by default | User should choose retry unless resumable upload exists. |
| `PATCH` / `DELETE` without idempotency key | No | Avoid duplicate destructive or state-changing effects. |

## Backend documentation placeholder

Future backend routes should document:

- request timeout assumptions
- body size limits
- idempotency support
- retry-safe status codes
- consistent error response shape with code/message/details/requestId

## User-facing behavior

- Timeout: “The request timed out. Try again in a moment.”
- Network failure: “Network connection failed. Check your connection and retry.”
- Rate limited: “Too many requests. Please wait and try again.”
- Server unavailable: “Picom server is temporarily unavailable.”

## Related documents

- `docs/api-compatibility.md`
- `docs/api-compatibility.md` error shape placeholder
- `docs/incident-response.md`
- `docs/slo.md`
