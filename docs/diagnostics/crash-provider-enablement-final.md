# Crash reporting provider enablement final gate

## Decision

External crash reporting remains **not approved and disabled**. No provider SDK, DSN, ingestion endpoint, credential or network adapter is added. The provider-neutral `CrashReporterProvider` boundary remains the only future integration point and local redacted reports remain opt-in.

## Required production configuration

- explicit user diagnostic-report opt-in; disabling clears the local queue and stops provider delivery;
- provider legal/privacy/DPA/subprocessor, residency, retention, deletion and access review;
- separate development/beta/production projects and bounded sampling/rate quotas;
- request bodies, authorization/cookies, console breadcrumbs, session replay, screenshots, attachments and message content disabled;
- coarse anonymous/authenticated context only, no raw user/community/channel/message/device identifiers;
- Picom redaction before adapter delivery plus provider-side server scrubbing;
- provider outage cannot block startup, auth, chat, uploads, voice or diagnostics export;
- remote kill switch and named incident/on-call owner before beta enablement.

## Source map privacy

Production source maps may be generated only in protected release CI for the exact source commit. They must not be included in ASAR, installers, public release artifacts, CDN/static renderer output, diagnostics exports or support attachments.

If an approved provider needs maps, upload them server-to-server with an ephemeral CI credential, bind them to the public-safe release version/commit, verify no source map contains environment values or generated private data, then remove temporary files in an `always()` cleanup step. Provider access/retention is restricted and maps are deleted when the related diagnostic retention expires. A source-map upload failure must not publish a partially approved crash integration silently.

## Enablement proof

Before registration through `configureProvider()`:

1. capture synthetic exceptions with diagnostics off and prove no local/provider record;
2. opt in, capture credential-shaped synthetic fields and prove Picom/provider redaction;
3. prove no message/attachment/request body, auth header, token, raw ID, file path or session replay;
4. simulate provider timeout/429/5xx and prove startup/core app stability plus bounded retries;
5. opt out and prove queue deletion/provider shutdown/no further delivery;
6. verify source maps are absent from final Windows/Linux/macOS artifacts;
7. review provider dashboard access, deletion request, sampling, alert and incident evidence.

## Blockers

- No provider or processor terms have been selected/approved.
- No approved public ingestion identifier or protected CI source-map credential exists.
- Retention, residency, sampling, alerts and production owner are unassigned.
- Provider-side scrubbing and opt-out deletion have not been exercised.

Until these blockers close, Settings continues to state that reports are local/redacted and no provider is configured.
