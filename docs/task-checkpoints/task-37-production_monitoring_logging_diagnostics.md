# Task 37 Checkpoint: Production Monitoring, Logging, and Diagnostics

## Scope

- Added production monitoring ownership/signals/privacy/alert guidance.
- Added diagnostics export data/exclusion/support handling guidance.
- Added client/provider log redaction rules and incident response.
- Extended the existing snapshot/UI with environment, safe window context, and last API error summary.

## Diagnostics coverage

- Version, channel, environment, platform, Electron/runtime/window, data source, Supabase host/environment, LiveKit status, Realtime status, auth/view context, last API error, and optional recent redacted logs.
- No message/attachment/screen/audio content or credential is intentionally included.

## Validation

- `npm run logs:smoke` - passed.
- `npm run diagnostics:smoke` - passed.
- `npm run settings:diagnostics:smoke` - passed.
- `npm run secrets:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed with the known non-blocking chunk warning.

## Remaining production work

- Select/configure approved monitoring/crash providers, consent, retention, access, alert owners, and thresholds.
- Baseline SLO alerts and execute the release monitoring watch.
