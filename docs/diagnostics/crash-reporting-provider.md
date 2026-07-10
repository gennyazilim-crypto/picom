# Crash Reporting Provider Integration

## Status

Picom has a provider-ready crash-reporting abstraction with no external provider configured. Reporting is optional, local-only by default, and disabled until the user enables diagnostic reports.

## Architecture

- `src/services/diagnostics/crashReporterService.ts` owns the canonical abstraction.
- `src/services/crashReporterService.ts` remains a compatibility re-export for existing callers.
- `DesktopStartupErrorBoundary` already captures unexpected renderer errors through the service.
- React components do not call a provider SDK directly.
- A future provider adapter implements `CrashReporterProvider` and is registered through `configureProvider()` during controlled startup.
- When no provider is registered, enabled reports remain in the bounded local queue only.

The adapter contract intentionally exposes only a provider name, optional initialization/shutdown hooks, and a capture method receiving an already-redacted record. It does not expose DSNs, auth headers, Electron objects, or arbitrary transport controls to UI code.

## Default behavior

- Diagnostic reporting is off by default, including development.
- No network request is made by the built-in service.
- Enabling reports keeps at most 50 redacted local records.
- Disabling reports clears the local crash queue.
- Provider failures are non-fatal and produce only redacted warning logs.
- User context is coarse: `authenticated` or `anonymous`. Raw user IDs are not attached to reports by this abstraction.

## Required redaction

Every exception, message, context object, provider failure, and locally persisted payload passes through `loggingService.redactDiagnosticsValue()` before provider delivery.

The shared redactor protects sensitive keys and common credential shapes, including:

- Passwords and passcodes.
- Access, refresh, session, and general tokens.
- Cookies, JWTs, and bearer authorization headers.
- API keys, signing keys, and private keys.
- Supabase service-role values and service-role JWTs.
- LiveKit API keys/secrets and fields containing LiveKit credentials.

A future provider's own breadcrumbs, request capture, session replay, user identification, and automatic PII collection must remain disabled unless separately reviewed. Provider-side scrubbing supplements Picom's local redaction; it does not replace it.

## Future provider adapter

An approved adapter should:

1. Be loaded only in a protected production/beta build configuration.
2. Obtain its public ingestion identifier from environment/CI configuration, never source control.
3. Keep secret management in protected CI or the provider backend. Desktop clients cannot safely hold private secrets.
4. Disable automatic request bodies, authorization headers, cookies, message content, attachment content, and session replay.
5. Normalize provider-specific APIs behind `CrashReporterProvider`.
6. Accept only `CrashReportRecord` produced by Picom's redaction boundary.
7. Fail without blocking startup, auth, chat, voice, or diagnostics export.
8. Document data residency, retention, deletion, access, and sampling settings before production enablement.

Illustrative registration shape, not a configured provider:

```ts
crashReporterService.configureProvider({
  name: "approved-provider",
  initialize: () => adapter.initializeWithRuntimeConfiguration(),
  capture: (record) => adapter.sendRedactedRecord(record),
});
```

No adapter, SDK, DSN, endpoint, or credential is included by this task.

## Electron boundaries

Renderer error boundaries may report renderer failures through the service. Main-process and preload crashes require a separate Electron-main adapter that follows the same redaction and optional-provider policy. Renderer code must not gain Node.js access or raw native crash dump paths.

If native crash dumps are considered later:

- Collection must be opt-in and policy-reviewed.
- Dump files must be treated as potentially sensitive.
- Upload must use a controlled main-process path.
- Retention and deletion must be explicit.
- Reports must never expose filesystem paths or private content to normal UI.

## Enablement gates

- Provider legal/privacy review completed.
- Data fields and automatic integrations audited.
- Development, beta, and production environments separated.
- DSN/public ingestion identifier provisioned through CI configuration.
- Redaction tests cover passwords, tokens, authorization headers, Supabase service role, and LiveKit API secret.
- Rate limits, sampling, retention, and alert ownership defined.
- Offline/provider-failure behavior tested.
- User-facing privacy copy approved.
- Security review confirms no provider secret is shipped or committed.

Until all gates pass, Picom remains provider-ready but provider-disabled.

The final enablement decision, source-map privacy controls and executable proof requirements are tracked in `docs/diagnostics/crash-provider-enablement-final.md`.
