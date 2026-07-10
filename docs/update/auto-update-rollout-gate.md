# Auto-update Rollout Gate

## Status

Picom production auto-update is **disabled**. This gate must be completed for every Windows, Linux, and macOS release before an update manifest may expose a non-zero rollout percentage. Documentation, placeholder manifests, and `updateService` states do not authorize downloads or installation.

## Channel gates

| Channel | Audience | Required evidence | Promotion rule |
| --- | --- | --- | --- |
| `dev` | Local developers | Development build, redacted diagnostics, no production URL | Never published to a production update provider. |
| `beta` canary | Internal devices | Signed artifact, checksum, provenance, install/launch/uninstall smoke, rollback rehearsal | Explicit device allowlist only. |
| `beta` | Invited testers | Canary stable for 24 hours, known issues reviewed, support owner assigned | Start at 5%; increase manually to 25%, 50%, then 100%. |
| `stable` canary | Small stable ring | Beta complete, Go/No-Go approved, client/server compatibility verified | Start at 1%; no automatic promotion. |
| `stable` | General desktop users | Stable canary healthy for 48 hours and all platform artifacts approved | Increase manually to 10%, 25%, 50%, then 100%. |

Each percentage change is a new release decision. Time alone never promotes a release.

## Prerequisite checklist

A release is blocked unless all applicable items are recorded as passed:

- The exact commit and clean build environment are recorded in provenance metadata.
- `npm run typecheck`, `npm run mock:smoke`, and production build checks pass.
- Platform packaging and native smoke tests pass for every artifact offered by the manifest.
- SHA-256 checksums are generated from final immutable artifacts.
- Windows artifacts are Authenticode-signed by an approved certificate and verified after download.
- macOS artifacts are Developer ID signed, hardened-runtime compatible, notarized, stapled, and Gatekeeper-verified.
- Linux AppImage and deb artifacts have documented integrity and distribution verification; package-manager installs remain package-manager controlled.
- Update manifests are generated in protected CI, use HTTPS immutable URLs, and match the artifact channel/platform/version.
- Signing and provider credentials remain in approved secret storage and never enter renderer code, logs, manifests, or the repository.
- Rollback-compatible previous artifacts and manifests remain available.
- Release notes, known issues, support contact, and incident owner are prepared.
- Update diagnostics are redacted and operational before the first canary.

Until these prerequisites pass, `rolloutPercent` must remain `0` and production auto-download/auto-install must remain disabled.

## Health and failure thresholds

The rollout controller must use real, version- and platform-scoped measurements before production activation. The following initial thresholds require final owner approval:

| Signal | Pause threshold | Rollback/escalation threshold |
| --- | --- | --- |
| Crash-free sessions | Below 99% in a ring | Below 98.5% or repeat startup crash |
| Installer/update failures | Above 3% | Above 5% or corrupted artifact |
| Authentication failures attributable to release | Above 2% for 15 minutes | Login/session restore blocker |
| Message send success | Below 99% | Below 97% or duplicate/lost messages |
| API errors attributable to release | Above 2% for 15 minutes | Above 5% for 15 minutes |
| Realtime reconnect failures | Above 3% | Sustained outage or event corruption |
| Security/privacy signal | Any credible signal | Immediate rollback and incident response |

Missing, delayed, or untrustworthy telemetry is itself a pause condition. Thresholds must not collect message content, tokens, passwords, authorization headers, or private user data.

## Pause procedure

1. Set the affected channel/version rollout to zero without deleting historical artifacts.
2. Stop recommendation and download discovery for clients that have not started the update.
3. Preserve evidence, open an incident, and record platform/version/ring impact.
4. Publish a concise status and known workaround for affected users.
5. Use a backend-compatible feature kill switch only when it reduces impact; it is not a security boundary.
6. Resume only after the fault is fixed, a new signed artifact is produced, and the canary starts again from its first ring.

## Rollback rules

- Prefer publishing a fixed forward version because desktop downgrade may be blocked by package formats, user data migrations, or operating-system policy.
- Never silently install an older build without explicit compatibility, signature, and data-migration approval.
- Verify the previous client remains compatible with the deployed backend and realtime event versions.
- Database rollback is separate and may be unsafe; follow the database migration and rollback runbooks.
- Linux package-manager users follow the trusted repository/package rollback procedure rather than an in-app installer.
- If automatic rollback is not proven safe, pause rollout and provide manual recovery instructions.

## Update diagnostics contract

Diagnostics should record only redacted operational metadata:

- app version, channel, platform, architecture, packaging type, and update state;
- manifest version and a non-secret request/result category;
- download progress bucket, checksum result, signature verification result, and installer result;
- timestamps, retry count, request ID, and stable anonymous rollout bucket where approved;
- failure code suitable for support without raw provider responses or local file paths.

Diagnostics must exclude update-provider credentials, signed query parameters, authorization headers, usernames, message content, and secret filesystem locations. Users must be able to export a redacted support bundle.

## Implementation activation gate

Real updater wiring may be enabled only through a separately reviewed implementation change that proves:

1. update checks, downloads, and installs run in the Electron main process;
2. preload exposes a minimal whitelisted status/action API;
3. renderer input cannot select arbitrary URLs, files, commands, or update channels;
4. manifest schema, semantic version, channel, platform, checksum, and platform signature are verified;
5. downgrade and replay protection are defined;
6. rollout bucketing is stable, privacy-safe, and remotely pauseable;
7. failure states leave the existing installed app usable;
8. native canary, pause, and recovery drills pass on each supported platform.

## Decision record

For each rollout, record artifact hashes, channel/ring/percentage, timestamps, approvers, health evidence, incidents, pause/resume decisions, and final disposition. Required sign-off placeholders are Engineering, Security, Release Operations, Product, and Support.

Related documents:

- `docs/release/release-channels.md`
- `docs/safe-rollout.md`
- `docs/update/real-auto-update-implementation-plan.md`
- `docs/update-failure-recovery.md`
- `docs/rollback-runbook.md`
- `docs/go-no-go-checklist.md`

