# Unified error code taxonomy

Picom uses a centralized error code taxonomy so renderer UI, Supabase service wrappers, diagnostics, and future backend/Edge Function responses can handle failures consistently.

## Standard API error shape

Future API/Edge Function errors should use:

```ts
export type ApiErrorResponse = Readonly<{
  code: AppErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}>;
```

Rules:

- `message` is user-safe and non-technical.
- `details` must be redacted before leaving a trusted server boundary.
- `requestId` may be shown in diagnostics/support flows.
- Stack traces are never shown to normal users.

## Current renderer service

The source of truth is `src/services/errorCodes.ts`.

It provides:

- `appErrorCodes`
- `AppErrorCode`
- `normalizeAppErrorCode(error)`
- `formatUserFacingError(error)`
- `createSafeAppError(error)`

`loggingService.formatUserError` delegates to the unified formatter while developer diagnostics remain redacted through `loggingService`.

## Unified error UX boundary

User-facing error presentation should flow through `loggingService.captureUserError()` or `loggingService.formatUserError()` instead of rendering raw exception messages directly.

The boundary is:

- normal users see concise recovery-focused copy
- developers/support can inspect redacted diagnostics
- logs store error code, safe user message, source, and redacted context
- passwords, tokens, cookies, auth headers, service keys, signing keys, and private secrets are never shown in user UI or exported diagnostics

Recommended surfaces:

- `inline` for form validation and recoverable field errors
- `toast` for recoverable app actions
- `blocking` for startup/session/service failures
- `diagnostics` for support-only developer detail

The startup error boundary follows this rule: the main card shows friendly recovery copy, while the expandable developer diagnostics block uses `loggingService.redactDiagnosticsValue()` before rendering technical context.

## Error codes

Authentication:

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_SESSION_EXPIRED`
- `AUTH_FORBIDDEN`
- `AUTH_NOT_CONFIGURED`

Validation and access:

- `VALIDATION_ERROR`
- `RATE_LIMITED`
- `PERMISSION_DENIED`

Community/chat entities:

- `COMMUNITY_NOT_FOUND`
- `CHANNEL_NOT_FOUND`
- `MESSAGE_NOT_FOUND`

Invites:

- `INVITE_INVALID`
- `INVITE_EXPIRED`

Network/backend/realtime:

- `NETWORK_ERROR`
- `SUPABASE_UNAVAILABLE`
- `REALTIME_UNAVAILABLE`
- `SERVER_ERROR`

Uploads:

- `UPLOAD_TOO_LARGE`
- `UPLOAD_INVALID_TYPE`

Voice/desktop runtime:

- `VOICE_NOT_CONFIGURED`
- `VOICE_TOKEN_FAILED`
- `WINDOW_NATIVE_UNAVAILABLE`

Fallback:

- `UNKNOWN_ERROR`

## User-facing UX rules

- Use friendly, actionable messages.
- Do not show raw Supabase/Postgres/LiveKit stack traces.
- Do not expose passwords, tokens, cookies, authorization headers, signing keys, service-role keys, or private secrets.
- Show developer details only in diagnostics/log export flows after redaction.
- Prefer inline errors for recoverable form/input issues and toast/blocking screens for global failures.

## Backend and Supabase guidance

Future Supabase Edge Functions and server routes should:

- return the standard shape
- map database/RLS denial to `PERMISSION_DENIED`
- map missing resources to the appropriate `*_NOT_FOUND` code
- map expired invites to `INVITE_EXPIRED`
- map invalid invites to `INVITE_INVALID`
- map transient infrastructure failures to `SERVER_ERROR` or `SUPABASE_UNAVAILABLE`
- include `requestId` when available
- log redacted developer context separately

## Verification

Run:

```bash
npm run errors:smoke
npm run typecheck
```

The smoke test confirms required codes exist, `loggingService` uses the unified formatter, and startup crash UX keeps user-facing copy separate from redacted developer diagnostics.
