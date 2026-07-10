# Bot API v1 Foundation

## Status

Picom has a constrained Bot API v1 foundation. Bot identities, role-based community installations, visible bot badges, credential-hash storage, and rate-limit policy are prepared. No public Bot API endpoint, marketplace, plugin runtime, or arbitrary code execution is enabled.

## Identity and permissions

- A bot has a dedicated profile with `profiles.is_bot = true`.
- `bots` links that profile to human owner metadata.
- `community_bots` installs the bot with a normal community `role_id`.
- Member and message rows render a visible `BOT` badge.
- Bot channel visibility and actions follow the installed role; no implicit administrator access exists.
- Bots cannot grant themselves permissions, change their role, or reuse human passwords/sessions.
- Backend/RLS enforcement is mandatory; UI role display is not security enforcement.

## Credential lifecycle

A future trusted Edge Function generates at least 256 bits of randomness and returns the raw token exactly once. The client may show a one-time copy view, but never persists or logs the raw value.

The mock foundation demonstrates the lifecycle locally:

- Raw token exists only in transient component state.
- It disappears when dismissed, revoked, or reloaded.
- Local storage contains only SHA-256 hash, prefix, creation time, and revocation time.
- A raw token cannot be re-shown or reissued after creation.
- Supabase mode refuses renderer token issuance.

Production verification should use constant-time comparison and a reviewed server-side hashing/pepper strategy. The checked-in migration stores only the hash contract and no secret.

## Backend storage

`bot_credentials` stores bot ID, non-secret prefix, one-way hash, creator ID, created/last-used/revoked timestamps. RLS is enabled, grants are revoked from `anon` and `authenticated`, and no renderer-facing policy exists. Token hashes must not appear in DTOs or diagnostics.

Revocation sets `revoked_at`. Production rotation must create a new one-time token and revoke the old credential atomically, with audit events. Mock mode supports revocation but intentionally not rotation.

## Future authentication

```text
Authorization: Bot <one-time-issued-token>
```

The gateway must redact the header before logging, locate an active prefix, compare hashes safely, load the bot installation/role, and reject revoked credentials. No raw authorization header may reach abuse events, crash reports, audit logs, metrics, or diagnostics.

## Rate limits

Initial placeholder policy:

- 60 authenticated requests per minute per bot credential.
- Lower burst limits for messages, reactions, uploads, and command registration.
- Community/channel slow mode remains applicable.
- Repeated violations emit content-free abuse/audit events.
- Responses use shared `RATE_LIMITED` codes and safe retry metadata.

Final values require load, abuse, and Supabase cost review.

## Proposed v1 capabilities

After backend implementation and permission checks, a bot may read visible metadata/events, send bot-marked messages, manage its own reactions, register bounded slash-command metadata, and update safe bot profile fields. Every action remains role-scoped.

## Forbidden capabilities

- No public marketplace or discovery listing.
- No local plugin execution, dynamic loading, `eval`, shell, filesystem, process, native-module, or Electron IPC access.
- No passwords, user sessions, service-role keys, LiveKit secrets, signing keys, private logs, or other bot credential hashes.
- No private-channel events without role permission.
- No direct service-role database access, self-escalation, impersonation, or unrestricted mass messaging.

## Audit and abuse controls

Audit credential creation/rotation/revocation, installation/removal, role changes, command registration, and privileged actions. Store bounded IDs/result codes only; never raw tokens or message content. Abuse controls cover failed auth, rate limits, spam bursts, upload rejection, unauthorized channel access, and command abuse.

## Implementation phases

1. Keep mock one-time UI for lifecycle testing only.
2. Implement trusted Edge Functions for create/revoke/rotate with permission checks.
3. Add server-side credential verification and rate-limit storage.
4. Add versioned endpoints and role/RLS tests.
5. Add visibility-filtered events with backpressure/retries/dedupe.
6. Add audit, abuse, and production observability.
7. Complete security review before external developer access.

## Current limitations

- No public endpoint authenticates bot tokens.
- A trusted, manager/owner-gated Supabase RPC contract can generate a production token once, but the renderer UI intentionally does not call it until live RLS/RPC verification and trusted bot provisioning are approved.
- Mock SHA-256 storage demonstrates structure only, not a production credential service.
- Backend-only atomic rate-limit storage/function is prepared, but no public gateway consumes it yet.
- No marketplace, plugin runtime, executable bot code, or public publishing exists.
