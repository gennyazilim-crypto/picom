# Production Remote Config

## Contract

Picom remote config is public, non-sensitive availability and operational metadata for Windows, Linux, and macOS clients. It carries release channel, semantic client versions, typed feature flags and kill switches, maintenance/degraded status, upload limits, and support/status/documentation links.

It never authenticates a user, grants a role, authorizes a channel, overrides RLS, creates a LiveKit grant, exposes an admin route, or replaces backend feature enforcement.

## Renderer safety

`remoteConfigService` applies these controls:

- Endpoint must use HTTPS, except `http://localhost` or `http://127.0.0.1` for local development.
- Fetch timeout defaults to 3500 ms and uses `AbortController`.
- Response is bounded to 64 KiB before JSON parsing and must be JSON when a content type is supplied.
- Only known feature-flag and kill-switch boolean keys survive sanitization.
- Version fields must be semantic versions and are bounded to 64 characters.
- Maintenance copy is trimmed and bounded to 240 characters.
- Upload bytes are clamped to 1-50 MiB; MIME entries use a strict bounded shape and at most 16 values.
- Public links accept only HTTP(S), are bounded, and otherwise fall back safely.
- Unknown fields are ignored.

The Supabase anon key may be sent to the public Edge Function. It is not a secret. User session tokens and service-role credentials are not needed or permitted for this config response.

## Cache and fallback

Successful remote config is stored in a schema-versioned cache envelope with a cache timestamp. Cache is valid for at most 24 hours. A compatible legacy cache is accepted only when its `fetchedAt` remains within that window.

Failure order:

1. Use a fresh, sanitized cached config.
2. Otherwise use local safe defaults.
3. Apply the resulting typed feature flags and kill switches.
4. Log only a redacted warning; do not block the app shell.

Corrupt, oversized, stale, malformed, non-JSON, or unsafe-protocol config never reaches feature consumers. Safe defaults preserve auth recovery and core desktop startup.

## Edge Function

`client-config` returns only public values. Public env strings are bounded; versions and URLs are validated; upload size is clamped. New production flag keys include screen share and admin operations, both defaulting off. No secret environment variable is serialized.

Deployment must set CORS to approved Picom origins, serve over TLS, prevent intermediary injection through normal platform controls, and avoid placing credentials or private operator notes in public env values.

## Operational use

- `releaseChannel`: descriptive channel metadata, not an updater trust decision.
- `minimumSupportedVersion`: may drive a client compatibility block after semantic validation.
- `recommendedClientVersion`: non-blocking update guidance.
- `featureFlags`: gradual availability only.
- `killSwitches`: emergency availability reduction; corresponding backend controls remain required.
- `maintenance`: operational/degraded/maintenance user copy.
- `uploadLimits`: client preflight UX; Storage/backend limits are authoritative.
- `urls`: open only through `externalLinkService`.

## Verification and rollout

- `npm run remote-config:smoke`
- `npm run feature-flags:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

Staging must test timeout, offline startup, empty/corrupt/stale cache, unknown flags, invalid semver, unsafe links, oversized response, maintenance/degraded modes, upload clamping, remote disable, and independent backend permission denial.

## Remaining risks

Remote config authenticity relies on the deployed TLS/Supabase path; no separate response-signature scheme is implemented. Production CORS, caching headers, infrastructure monitoring, and live Edge Function tests remain deployment gates. Config must stay public and must never be treated as a security boundary.
