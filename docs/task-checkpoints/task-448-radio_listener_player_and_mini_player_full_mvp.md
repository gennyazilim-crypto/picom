# Task 448 - Radio Listener Player and Mini Player Full MVP

## Scope completed

- Replaced component-owned playback and fake time simulation with one global HTML audio transport.
- Added explicit play/pause, mute, volume, loading, reconnecting, error, ended, and cleanup states.
- Added safe local volume persistence under the Picom audio preference key.
- Added an App-level mini-player dock that remains mounted across Feed, Profile, Radio community, and other authenticated desktop views.
- Added a playback coordinator that leaves the prior Radio listener session before selecting another audio source.
- Added listener heartbeat persistence and terminal-session cleanup.
- Added a listener-safe HTTPS stream endpoint contract without provider credentials or tokenized query strings.
- Preserved no-autoplay behavior; selection prepares the player and playback starts only after a user action.

## Safety boundaries

- UI components do not call Supabase directly.
- Only one transport exists, and switching or closing tears down the previous media source.
- Mock mode uses a generated local silent WAV loop rather than a network or copyrighted asset.
- Supabase mode reports a safe error when no authorized stream endpoint is available.
- Ended and cancelled sessions close active listener rows and stop the renderer transport.

## Validation contract

- npm run radio:listener-player:smoke
- npm run audio:player:smoke
- npm run radio:service-realtime:smoke
- npm run radio:data-model:smoke
- npm run typecheck
- npm run mock:smoke
- npm run supabase:smoke
- npm run supabase:rls:smoke
- npm run build
- npm run qa:smoke
- npm run visual:regression:contract
- npm run e2e:coverage:contract
- npm run performance:budget:ci

Real hosted media delivery and pgTAP execution remain environment-dependent and must not be reported as passed without the protected staging endpoint and Supabase CLI.
