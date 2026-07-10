# Task 391 - Radio Panel MVP

## Status

Complete.

## Delivered

- Added a dedicated desktop Radio Panel with live, scheduled, and ended states.
- Added host, listeners, schedule, community link, and radio control components.
- Added local listen/stop, mute, volume, save, and leave behavior.
- Added role-gated host controls for permitted community roles.
- Connected radio cards in Community Audio and Mention Feed to the panel.
- Connected active listening to the existing explicit-action Audio Mini Player.

## Boundaries

- No LiveKit broadcast or Supabase connection was added.
- Existing voice rooms, screen share, community chat, and Electron shell are unchanged.
- Share and host management actions remain clearly described local placeholders.

## Validation

- `npm run audio:radio:smoke`
- `npm run audio:community:smoke`
- `npm run audio:feed:smoke`
- `npm run audio:player:smoke`
- `npm run audio:domain:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
