# Bot API Architecture

Status: post-MVP architecture document

Picom may support bots in the future, but no public Bot API is enabled in the MVP. This document defines a safe future architecture for bot identities, permissions, rate limits, events, actions, audit logging, and abuse prevention.

## Goals

- Allow approved automated integrations to interact with communities through backend-controlled identities.
- Keep bot access permission-scoped and auditable.
- Keep Supabase Auth/RLS and backend policies as the source of truth.
- Keep desktop UI free from raw bot token handling except a future one-time display flow.

## Non-goals

- No public Bot API in MVP.
- No bot marketplace.
- No arbitrary plugin code execution.
- No raw token display outside a future one-time creation screen.
- No bot access to passwords, session tokens, authorization headers, or service-role secrets.
- No analytics tracking of message content or sensitive user data.

## Bot authentication model

Future bots should use backend-managed bot tokens:

- generate secure random token once
- store only `token_hash`
- show raw token exactly once at creation
- allow token rotation
- allow revocation
- associate token with bot application, creator, and community scopes

Bot tokens must never be stored in renderer logs, diagnostics exports, or local settings.

## Bot permissions

Potential scopes:

- `messages:send`
- `messages:read` only where explicitly approved
- `channels:read`
- `reactions:write`
- `commands:register`
- `webhooks:manage` separate from bot token scope

Private channel access must require explicit permission and RLS/backend checks.

## Rate limits

Bot traffic should have dedicated rate limits:

- message send rate
- slash command registration/update rate
- reaction write rate
- event subscription rate
- failed auth/token attempts

Repeated blocked attempts should create safe abuse events without storing secrets or message content.

## Events bots can receive placeholder

Future event delivery may include:

- `message.created` with scoped DTOs
- `message.updated` with scoped DTOs
- `message.deleted` metadata only
- `reaction.added`
- `member.joined`
- `channel.created`
- `slash_command.invoked`

Events must be filtered by bot scopes and community/channel access.

## Actions bots can perform placeholder

- send a message as a bot identity
- add/remove reaction if permitted
- reply to slash command invocation
- update own bot profile metadata
- register commands through reviewable metadata

Bots must not impersonate normal users.

## Message send API placeholder

Potential future endpoint:

`POST /bot/messages`

Payload should include:

- `channelId`
- `content` bounded and validated
- `clientMessageId` or idempotency key
- optional attachment references already validated by upload pipeline

Response should use the standard API error shape and pagination/DTO conventions.

## Slash command registration

Command registration should be manifest-driven:

- command name
- description
- usage
- required scopes
- target communities/channels

No command should execute arbitrary desktop or server code. Commands call approved backend handlers only.

## Webhook comparison

- Webhooks: inbound channel posting with hashed endpoint token and rate limits.
- Bots: authenticated integration identity with scopes, audit logs, and event subscriptions.
- Plugins: local UI extension concept; separate from bot identity.

## Audit logging

Audit entries should record safe metadata:

- bot id
- community id
- channel id optional
- actor/creator id optional
- action
- timestamp
- request id

Do not store raw tokens, passwords, authorization headers, or unnecessary message content in audit logs.

## Abuse prevention

- token hash verification
- strict rate limits
- idempotency keys
- suspicious activity events
- revoke/disable bot action
- safe error responses that do not reveal token validity details

## Developer portal placeholder

A future Developer Portal can manage:

- bot applications
- token rotation/revocation
- scopes
- command manifests
- audit view
- documentation links

It must not expose raw tokens after creation.

## Versioning

Bot API should use explicit API versioning:

- endpoint version prefix or header
- event version field
- deprecation window
- compatibility with desktop client release channels

## Implementation decision

This is documentation-only. No bot routes, bot tokens, bot marketplace, event delivery, or runtime bot SDK is added in this task.
