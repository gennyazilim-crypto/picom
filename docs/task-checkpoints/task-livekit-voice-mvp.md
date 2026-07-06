# Task Checkpoint: LiveKit Voice MVP

## Status

Completed.

## What changed

- Connected voice channels to `VoiceRoomView` from the main community view.
- Added App-level voice snapshot subscription and join/leave/mute/deafen handlers.
- Added deterministic LiveKit room naming: `community:{communityId}:voice:{channelId}`.
- Added `src/services/livekit/voiceRoomService.ts` as a stable voice service namespace.
- Documented the LiveKit voice MVP flow and manual QA steps.

## Safety notes

- LiveKit secrets stay server-side in the Supabase Edge Function.
- Supabase service-role keys are not used by renderer code.
- Screen share was not expanded in this task.
- Mock mode remains stable; missing Supabase/LiveKit config shows a clean error instead of crashing.

## Commands to run

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run livekit:smoke`
