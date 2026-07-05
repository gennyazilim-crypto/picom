# Realtime Horizontal Scaling Preparation

Picom's MVP realtime layer uses Supabase Realtime for message changes, typing broadcast, and presence-style state. Horizontal scaling is primarily handled by Supabase's managed realtime infrastructure in the MVP. This document prepares the future path without adding a second realtime system.

## Status

- Runtime service: `src/services/supabase/realtimeScalingService.ts`
- MVP provider: Supabase Realtime
- External pub/sub: placeholder only
- Redis requirement: none for MVP Supabase managed mode
- UI changes: none

## Goals

- Keep realtime channel naming centralized and predictable.
- Document how message, typing, and presence rooms scale.
- Avoid in-process-only assumptions in future backend code.
- Prepare a future external pub/sub mode without changing the MVP UI.
- Keep Supabase RLS as the source of truth for private channel access.

## Public env variable

```env
VITE_REALTIME_SCALING_MODE=supabase_managed
```

Allowed values:

- `supabase_managed`: default MVP mode.
- `disabled`: disables realtime availability decisions while API/mock flows continue.
- `external_pubsub_placeholder`: documentation/testing placeholder for a future broker-backed architecture.

This is a renderer-safe configuration value. It must not contain secrets.

## Current Supabase strategy

The existing channel patterns are:

```text
room:community:{communityId}:channel:{channelId}
presence:community:{communityId}
typing:community:{communityId}:channel:{channelId}
```

Supabase Realtime handles subscription fanout. RLS policies on messages/channels remain the access boundary. Frontend feature flags only hide or disable UI entry points and must never replace backend/Supabase enforcement.

## Future external pub/sub placeholder

If Picom later moves parts of realtime outside Supabase, the architecture should provide:

- centralized event publishing service
- durable event id or sequence metadata
- per-community/per-channel room naming
- Redis or equivalent pub/sub adapter placeholder
- presence store outside a single process
- backpressure for typing and presence events
- duplicate event suppression on the client
- RLS/authorization checks before publishing or joining rooms

No external broker dependency is added in this task.

## Fail-safe behavior

If realtime scaling config is unavailable or invalid:

- default to `supabase_managed`
- keep API/mock actions available
- keep existing message fetch/send behavior stable
- do not expose private data
- do not crash the desktop shell

If `VITE_REALTIME_SCALING_MODE=disabled`, realtime UI should show a disabled/unavailable state while core API actions continue when possible.

## Verification checklist

- Realtime channel names stay centralized.
- Supabase Realtime remains the default MVP mode.
- External pub/sub is clearly placeholder only.
- No Redis URL, service role key, LiveKit secret, or auth token is exposed in renderer config.
- Feature flags are not treated as security enforcement.
- Private channel access remains controlled by Supabase RLS.

## Test steps

Run:

```bash
npm run realtime-scaling:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

Manual checks:

1. Open `src/services/supabase/realtimeScalingService.ts`.
2. Confirm `supabase_managed` is the safe default.
3. Confirm room names match existing realtime channel names.
4. Confirm no UI or runtime subscription behavior was changed in this task.
