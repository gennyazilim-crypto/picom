# Task 390 - Community Audio View

## Status

Complete.

## Delivered

- Added an Audio entry to the community sidebar without changing channel navigation.
- Added a desktop Community Audio view with Live Radio, Podcasts, and Scheduled tabs.
- Added reusable community radio, podcast, list, and card components.
- Added explicit local playback through the existing mini-player foundation.
- Added local saved podcast and scheduled-session reminder state.
- Added role-aware Start Radio and New Podcast entry points for community audio managers.
- Kept the task mock-only; no Supabase or LiveKit connection was introduced.

## Safety

- Existing text and voice channel selection returns to the community channel view.
- Audio playback never starts automatically.
- Community chat, Mention Feed, titlebar, and Electron controls are unchanged.

## Validation

- `npm run audio:community:smoke`
- `npm run audio:profile:smoke`
- `npm run audio:feed:smoke`
- `npm run audio:player:smoke`
- `npm run audio:domain:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
