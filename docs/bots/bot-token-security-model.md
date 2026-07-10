# Bot token security model

## Threat model

Bot credentials are bearer secrets. Anyone who obtains a raw token may act with the bot's installed role until revocation. Primary risks are one-time UI leakage, logs/diagnostics/clipboard, database compromise, unauthorized issue/rotation, replay, brute force, rate-limit bypass, permission drift, private-channel overreach, and credential reuse after removal.

Picom does not expose a public Bot API yet. These controls are a prerequisite, not a claim that external bot execution is production-ready.

## Generation and one-time display

- Trusted Supabase function generates 32 cryptographically random bytes plus a non-secret prefix.
- Token uses a recognizable `picom_bot_` prefix so central redaction can identify accidental string leakage.
- Raw token is returned exactly once by issue/rotation RPC and never stored in Postgres/local logs/diagnostics/audit/analytics.
- Mock mode keeps raw token only in transient React state; dismiss/reload removes it. Local storage keeps hash/prefix/lifecycle metadata only.
- A second issue while active fails. Raw token cannot be recovered or re-shown; user must rotate.
- Clipboard use is explicit and should be followed by secure storage/clipboard clearing according to local policy.

## Hash at rest

- Production stores SHA-256 of a high-entropy token, prefix, algorithm identifier, bot/creator and timestamps.
- SHA-256 is acceptable for a uniformly random 256-bit token because offline guessing is infeasible; it is not suitable for human passwords.
- Future gateway may use HMAC-SHA-256 with a secret-manager pepper and versioned algorithm/pepper ID for defense in depth. The pepper must never enter database rows, migrations, renderer, logs, CI artifacts, or client config.
- Token hash and credential rows remain inaccessible to `anon`/`authenticated`; trusted server code performs verification.
- Comparison must be constant-time in the gateway. Prefix narrows candidates but is not authentication.

## Revoke and regenerate

- Revoke marks active credential `revoked_at`; it never deletes history or reveals the hash.
- Regenerate is an atomic database transaction: revoke current, issue replacement, return new raw token once.
- If replacement issue fails, the transaction rolls back revocation so the system does not enter an ambiguous partial state.
- Rotation produces bounded append-only revoke/issue audit events with bot ID/action only.
- Mock regeneration follows revoke-then-issue and overwrites only local mock hash metadata.
- Community uninstall should revoke credentials if the bot has no remaining authorized installations; final multi-community ownership policy remains required.

## Authorization

- Community manager permission is required for installation management.
- Credential issue/revoke/rotation additionally requires bot owner or app admin and a valid installation/role in that community.
- Bot requests must resolve credential -> bot -> installation -> role -> channel/action permission on every request.
- Role changes, channel privacy, community removal, credential revocation, feature kill switches, and bans take effect server-side without trusting cached renderer state.

## Logging and diagnostics

Central logging now redacts raw `picom_bot_...` strings even when they appear in an unlabelled message/error, in addition to sensitive key/Bearer/JWT redaction. Forbidden everywhere:

- raw token or token hash;
- Authorization header/cookie/session;
- service-role/pepper/provider secret;
- command/message/private channel content;
- signed URL or file path.

Audit stores credential lifecycle action and bounded IDs/status only. Abuse events use reason codes/counts, not secrets or payload content.

## Rate limiting and replay

- Backend-only atomic counters partition by credential and action.
- Authenticated renderer clients cannot read/mutate counters or invoke the limiter.
- Gateway must consume limit before action transaction, enforce lower limits for message/reaction/command/event operations, and honor platform/community slow mode.
- Unsafe retry requires idempotency key; duplicate message sends continue to use client message identity.
- Repeated auth/rate failures produce content-free abuse signals and may trigger credential suspension/kill switch.
- Final gateway should limit concurrent requests, body size, event queue depth and token verification attempts.

## Incident response

On suspected exposure:

1. disable bot actions via backend kill switch;
2. revoke/rotate affected credentials;
3. preserve redacted audit/security evidence;
4. inspect access/rate anomalies without copying raw headers/content;
5. notify owners through approved channel;
6. assess private-channel/data exposure and invoke incident response;
7. fix leak path, add regression test, then re-enable gradually.

## Verification

- `npm run bots:security:test`
- `npm run bots:production:test`
- `npm run logs:smoke`
- Supabase RPC/RLS/concurrency tests in isolated staging when CLI is available.
