# Picom Release Channels and Update Manifest

## Status

Picom defines release-channel metadata for diagnostics, packaging, and future signed updates. Production auto-download and auto-install remain disabled.

## Channels

| Channel | Intended audience | Stability expectation | Update behavior |
| --- | --- | --- | --- |
| `dev` | Developers and internal local builds | Experimental | No production update source; manual development workflow only. |
| `beta` | Explicit beta participants | Release candidate quality with documented known issues | Future signed beta manifest; staged and pauseable. |
| `stable` | General desktop users | Approved production release | Future signed stable manifest after platform and Go/No-Go gates. |

The typed source of truth is `src/config/releaseChannel.ts`. Runtime configuration resolves `VITE_RELEASE_CHANNEL` through that module. Unknown or missing values fail safely to `dev`, except an explicitly identified beta environment may default to `beta`.

The selected channel is non-sensitive and is already included in Picom's redacted diagnostics through `appConfig.releaseChannel`. Channel metadata controls availability only; it must never bypass authentication, authorization, artifact signature verification, or rollout safety gates.

## Build configuration

CI should set these non-secret variables for an approved artifact:

```text
VITE_APP_VERSION=0.1.1-beta.1
VITE_RELEASE_CHANNEL=beta
VITE_APP_ENV=beta
```

Local development may omit them and receives the safe `dev` channel. Release-channel values must be one of `dev`, `beta`, or `stable`.

## Manifest placeholder

The checked-in example at `docs/update/update-manifest-placeholder.json` documents the minimum Picom update metadata contract. It is deliberately non-functional: all URLs use reserved invalid/example hosts, the checksum is not real, and rollout is zero.

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | string | Semantic Picom desktop version represented by the artifact. |
| `channel` | `dev` \| `beta` \| `stable` | Channel allowed to discover the artifact. |
| `platform` | string | Operating system and architecture, for example `windows-x64`, `linux-x64`, or `macos-arm64`. |
| `artifactUrl` | HTTPS URL | Future immutable signed artifact location. Placeholders must never point to production. |
| `sha256` | string | SHA-256 artifact checksum for release/user verification. This does not replace platform signing. |
| `releaseNotesUrl` | HTTPS URL | Sanitized release notes for the exact version/channel. |
| `minSupportedVersion` | string | Oldest client version eligible to consume the update path. |
| `rolloutPercent` | integer 0-100 | Future staged rollout eligibility. Zero means unavailable. |

The selected production updater may require additional generated metadata, such as SHA-512 fields used by `electron-updater`. Generated provider metadata supplements this Picom contract rather than weakening its controls.

## Validation and publication rules

- Reject unknown channels, invalid semantic versions, unsupported platforms, non-HTTPS artifact URLs, malformed hashes, and rollout percentages outside 0-100.
- Generate manifests from completed artifacts in protected CI; do not hand-edit production metadata.
- Publish immutable artifacts before atomically updating the corresponding channel manifest.
- Keep beta and stable manifests separated.
- Never include signing credentials, provider tokens, private bucket details, authorization headers, or temporary signed query parameters.
- A remote manifest may report availability but cannot enable auto-download while Picom's production updater remains disabled.
- Rollout pause must be possible without deleting historical signed artifacts.

## Platform examples

A release should generate a separate entry or provider manifest for each shipped combination, such as:

- `windows-x64`
- `linux-x64-appimage`
- `linux-x64-deb`
- `macos-x64`
- `macos-arm64`

Linux packages managed by a system package manager may use the manifest for update awareness only. Actual installation must respect the package's trusted update mechanism.

## Future implementation boundary

The renderer continues to read normalized state from `updateService`. A future Electron main-process updater will validate channel and artifact metadata, while preload exposes only whitelisted status/actions. This document and its placeholder do not enable network checks, downloads, installs, or downgrades.

