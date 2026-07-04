# Message Service

Task 151 introduces the MVP message service boundary for mock mode and Supabase mode.

## Service API

`messageService.sendMessage(input)` accepts:

- `communityId`
- `channelId`
- `body`
- `authorId` optional
- `clientMessageId` optional

It returns a safe `MessageSummary` DTO and never exposes tokens, sessions, or Supabase internals.

## Mock mode

When `VITE_DATA_SOURCE=mock`, the service returns a local message summary with a generated mock id. This keeps the MVP desktop UI usable without a backend.

## Supabase mode

When `VITE_DATA_SOURCE=supabase`, the service inserts into `public.messages` through the configured Supabase client. If no explicit `authorId` is provided, it resolves the current authenticated user with Supabase Auth.

## Validation

The service validates:

- community id
- channel id
- non-empty message body
- message body length up to 4000 characters

## Current scope

This task creates the service foundation only. The visible composer flow can be routed through this service in the next send-message flow task without changing the desktop layout.