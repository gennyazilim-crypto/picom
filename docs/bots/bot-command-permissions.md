# Bot Command Permissions and Governance

## Status and boundary

This is a design contract for a future, reviewed Bot API. Public bot endpoints and third-party command registration are not enabled. Picom's current built-in renderer slash commands are first-party UI actions and do not authenticate as bots or execute downloaded code.

Bot commands must invoke a versioned, allowlisted backend handler. A command manifest is metadata, never executable JavaScript, SQL, shell, Electron IPC, filesystem access, or plugin code.

## Registration lifecycle

1. A verified bot owner submits a bounded command manifest through a trusted backend endpoint.
2. Schema validation normalizes the lowercase command name, description, options, requested scopes, handler identifier, version, and installation targets.
3. Picom checks command-name reservation, duplicate/version rules, bot credential state, application review state, and requested scopes.
4. A community owner or authorized administrator explicitly approves installation and command scopes for that community.
5. The backend stores the approved manifest and immutable approval metadata. Registration is disabled until approval succeeds.
6. Updates that add permissions, widen scope, or change the handler require re-approval. Safe description-only changes may retain approval after policy review.
7. Disable, uninstall, credential revoke, application suspend, or owner/admin revocation immediately prevents invocation.

Commands are not globally discoverable or publicly published in this foundation. Reserved Picom commands cannot be shadowed.

## Command scopes

Every command is constrained by all applicable scopes:

- **Application scope:** capabilities granted during Picom application review.
- **Installation scope:** communities where an owner/admin installed the bot.
- **Command scope:** explicit command capabilities such as `commands:invoke`, `messages:send`, or `reactions:write`.
- **Channel scope:** approved visible channels; private channels require explicit installed-role access and backend visibility checks.
- **Interaction scope:** invoking user, community, channel, and one short-lived invocation ID.

The effective permission is the intersection of these scopes. A broad application grant cannot override a narrower installation, channel, user, community, or RLS decision.

## User permission checks

Before invocation, the backend must verify that the human user:

- has a valid, non-revoked session;
- is a current community member unless the command is explicitly public and read-only;
- can view the target channel;
- satisfies the command's declared Picom permission, for example `manageChannels`;
- is not blocked by timeout, ban, slow mode, command-specific cooldown, or community policy.

The renderer may hide unavailable commands for usability, but backend authorization is mandatory. User input is parsed as typed options with strict length, enum, ID, and URL validation; it is never interpolated into code or SQL.

## Bot permission checks

The bot must have an active credential, active application, active community installation, approved command version, approved scopes, and an installed role that permits the requested action. The bot cannot:

- self-install, self-approve, change its role, or grant scopes;
- act as the invoking user or another profile;
- access channels the installed role cannot view;
- receive raw user session tokens, authorization headers, service-role keys, or unrelated message content;
- call undeclared handlers or arbitrary network destinations.

Responses are bot-attributed. Ephemeral responses remain visible only to the invoker when supported; channel responses still require `messages:send` and normal moderation controls.

## Admin approval and revocation

Community owners approve all initial bot installations and high-risk scopes. An admin may approve only if granted an explicit future `manageBots` permission; moderators and ordinary members cannot approve commands. Ownership transfer does not silently widen existing grants.

Approval UI must show the bot owner, command list, requested actions, channel/private-data implications, rate-limit class, data retention summary, and revoke control. Scope expansion always requires fresh approval. Emergency application suspension and community uninstall are fail-closed kill switches.

## Audit logging

Append-only audit metadata should cover application review, registration/update, approval/rejection, installation/uninstall, scope changes, credential rotation/revocation, invocation result code, privileged actions, rate-limit denials, and operator suspension.

Store bounded IDs, command/version, community/channel IDs where authorized, actor/bot IDs, result code, request ID, and timestamp. Never store raw bot tokens, user session tokens, authorization headers, secrets, or command message content. Sensitive arguments are redacted or represented only by safe type/count metadata.

## Rate limits and backpressure

Use atomic backend limits at credential, bot, command, user, channel, and community levels. Separate registration/update limits from invocation, message, reaction, and event-delivery limits. Expensive commands receive lower concurrency and execution budgets. Return shared `RATE_LIMITED` plus bounded retry metadata; clients must not retry unsafe operations without an idempotency key.

Invocation IDs provide deduplication. Queue depth, timeout, response size, event subscriptions, and fan-out are bounded. A failed bot handler cannot block chat delivery or the Electron renderer.

## Abuse prevention

- Validate schema before authorization and again before handler execution.
- Reject mentions, uploads, links, or mass actions unless separately approved.
- Apply community moderation filters and anti-spam policy to bot output.
- Use content-free abuse signals for repeated auth failures, permission probing, bursts, duplicate invocations, and blocked output.
- Disable the command, installation, credential, or application independently.
- Return generic auth failures to prevent credential and private-channel enumeration.
- Require human review before punitive automation; never execute uploaded or command-provided files.

## Invocation outline

```text
authenticate user and bot context
-> validate command manifest/version/options
-> verify application + installation + approval
-> intersect user, bot, command, channel, and RLS permissions
-> consume atomic limits and idempotency key
-> invoke allowlisted bounded backend handler
-> apply output validation/moderation
-> commit action and audit metadata atomically where possible
-> return safe versioned response
```

## Release gates

- Backend gateway and token lifecycle implemented; no renderer-owned bot secret.
- RLS and API tests cover private-channel denial, revoked sessions/credentials, removed membership, role downgrade, scope expansion, cross-community IDs, and moderator self-escalation.
- Concurrency/rate-limit, idempotency, timeout, malformed options, audit redaction, and emergency disable tests pass in staging.
- Security review approves each available handler and public developer documentation.

Until these gates pass, third-party bot command registration and invocation remain disabled.
