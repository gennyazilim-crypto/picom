# Bot System Foundation

Picom's bot system is post-MVP. This document defines the safe foundation without enabling a bot runtime, marketplace, token issuance UI, or arbitrary code execution.

## Goals

- Prepare a future bot platform for community automation.
- Keep bots clearly separate from desktop plugins.
- Require explicit permissions before bots can read events or perform actions.
- Make bot messages visibly distinguishable from user messages.
- Ensure all bot activity is rate-limited and audit logged when implemented.

## Non-goals for MVP

- No bot marketplace.
- No public bot registration flow.
- No arbitrary code execution in the Electron renderer or main process.
- No shell, file-system, preload, or native desktop access for bots.
- No raw bot token display outside a future one-time creation flow.
- No analytics collection of message content.

## Security boundaries

- Bots must use a server-side API, not renderer-side execution.
- Bot tokens must be generated and hashed by trusted backend code.
- RLS/backend permission checks must enforce community/channel access.
- Bot event delivery must exclude private data the bot is not authorized to see.
- Bot actions must be scoped by explicit permissions such as send messages, manage webhooks, or read events.

## Future data model placeholder

- Bot application: owner user, display name, avatar metadata, createdAt, revokedAt.
- Bot installation: communityId, installedById, permission list, channel scope placeholder.
- Bot token: hashed token only, createdAt, lastUsedAt, revokedAt.
- Bot audit events: action type, target ids, safe metadata, requestId placeholder.

## Future events

- message created placeholder.
- message deleted placeholder.
- member joined placeholder.
- channel created placeholder.
- mention/reaction placeholder.

Event payloads must not include passwords, auth tokens, internal secrets, or private channel content outside bot authorization.

## Future actions

- Send bot-marked message.
- Reply to message placeholder.
- Register slash command placeholder.
- Create moderation report placeholder.
- Read safe community/channel metadata.

## Implementation path

1. Define shared bot DTOs and permission types.
2. Add backend-only bot application and installation tables.
3. Add token creation with one-time display and hashed storage.
4. Add rate limits and audit logs.
5. Add explicit UI entry points behind a development/post-MVP feature flag.
6. Add bot-marked message rendering.
7. Add integration tests for private-channel isolation.

## MVP stance

Bot features remain disabled/documentation-only until the core desktop chat, Supabase auth, messaging, storage, and LiveKit MVP are stable.