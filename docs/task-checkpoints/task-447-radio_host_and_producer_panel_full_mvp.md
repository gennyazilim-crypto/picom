# Task 447 - Radio Host and Producer Panel Full MVP

## Scope completed

- Added a desktop Host & Producer Desk for permitted Radio community owners, admins, and Radio Hosts.
- Added create/edit schedule metadata, private cover upload, program selection, host/co-host/producer assignment, start, end, and cancel controls.
- Added explicit, accessible confirmation dialogs for broadcast end and schedule cancel in both Radio management surfaces.
- Added active-listener loading, mute/unmute, and removal through the repository and service boundary.
- Added permission-checked Supabase RPCs for host assignment, lifecycle transitions, and listener moderation.
- Added audit evidence for session changes, host assignments, and listener moderation.
- Preserved mock mode and the existing Realtime catalog subscription.

## Security boundaries

- UI components do not call Supabase directly.
- Owner/Admin/Radio Host visibility is a UX gate; the RPCs independently enforce can_manage_radio_session.
- Covers remain in the private audio-covers bucket and are rendered through short-lived signed URLs.
- End and cancel require the exact session title at the database boundary.
- No provider credentials or broadcast secrets enter renderer state.

## Validation contract

- npm run radio:host-producer:smoke
- npm run radio:service-realtime:smoke
- npm run radio:data-model:smoke
- npm run audio:service:smoke
- npm run audio:radio:smoke
- npm run typecheck
- npm run mock:smoke
- npm run supabase:smoke
- npm run supabase:rls:smoke
- npm run build
- npm run qa:smoke
- npm run performance:budget:ci

Real hosted RLS execution remains environment-dependent and must not be reported as passed when the Supabase CLI or a protected staging project is unavailable.
