# Task 395 - Radio and Podcast MVP Final QA

## Status

Complete for the mock/local MVP foundation.

## Verified

- Audio domain and safe mock catalog.
- Audio Player and Mini Player explicit-action behavior.
- Mention Feed, Profile, and Community Audio entry points.
- Radio Panel and Podcast Episode Detail interactions.
- Mock/Supabase service separation.
- Audio schema, RLS helpers, indexes, and private storage policies.
- No autoplay, unsafe HTML, external mock audio, Discord branding, or mobile UI was introduced.
- Existing mock community data and production frontend build remain healthy.

## Commands

- `npm run audio:mvp:qa`
- `npm run audio:service:smoke`
- `npm run audio:schema:smoke`
- `npm run audio:podcast:smoke`
- `npm run audio:radio:smoke`
- `npm run audio:community:smoke`
- `npm run audio:profile:smoke`
- `npm run audio:feed:smoke`
- `npm run audio:player:smoke`
- `npm run audio:domain:smoke`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining Production Work

See `docs/audio-mvp-qa.md`. Supabase migration application, RLS fixture testing, private signed media delivery, LiveKit radio transport, realtime listener counts, and upload/transcoding remain intentionally unimplemented.
