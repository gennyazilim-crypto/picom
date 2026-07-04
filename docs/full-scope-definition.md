# Full Scope Definition

Picom is a premium Electron desktop community chat app for Windows, Linux, and macOS.

This document defines the full product and technical scope for the active master task pack.

## MVP product scope

Included in the MVP:

- Premium 4-column desktop community chat UI.
- Light and dark theme quality matching the provided desktop reference direction.
- Coolicons Free icon system with attribution.
- Mock mode for fast desktop UI development.
- Supabase-backed auth, community, channel, message, attachment, member, role, notification, and realtime foundations.
- Supabase Storage for attachments.
- Supabase Realtime for message/presence-style MVP updates.
- LiveKit/WebRTC for MVP voice room and screen sharing foundations.
- Electron native shell with secure IPC boundaries.
- Windows, Linux, and macOS packaging readiness.

Excluded from MVP until later tasks explicitly add them:

- iOS and Android apps.
- Discord branding, logos, copied assets, icons, or exact colors.
- Enterprise SSO/compliance production rollout.
- Public plugin marketplace.
- Full bot platform production launch.
- Production analytics provider integration.
- E2EE implementation.

## Electron scope

Electron is the desktop runtime.

Required security posture:

- `contextIsolation: true`.
- `nodeIntegration: false` in renderer.
- React components must not import Node, Electron main-process APIs, or shell/file APIs directly.
- Native capabilities must go through preload and typed renderer services.
- IPC channels must be whitelisted and payloads validated.

Expected desktop shell behavior:

- Default window size: `1440x900`.
- Minimum usable size: `1100x700`.
- Custom title bar placeholder.
- No mobile layout.
- Safe fallbacks when native APIs are unavailable in dev/browser mode.

## Supabase scope

Supabase is the backend foundation for MVP data and auth.

Supabase primitives:

- Auth: account registration, login, session persistence, current user.
- Postgres: durable app data.
- RLS: primary authorization boundary.
- Storage: attachments and later avatars/community icons.
- Realtime: message and presence-style subscriptions.
- Edge Functions: privileged actions and server-only token flows.

Client-side access must never bypass RLS. Any operation requiring elevated privileges must use a justified Edge Function or server boundary.

## Initial database domains

Planned tables or equivalent schema groups:

- `profiles`
- `communities`
- `community_members`
- `roles`
- `member_roles`
- `channel_categories`
- `channels`
- `messages`
- `attachments`
- `message_reactions`
- `read_states`
- `notifications`
- `voice_rooms`
- `voice_participants`

## RLS implications

RLS must enforce:

- Users can read only communities where they are members, unless a future public discovery feature explicitly changes this.
- Users can read channels only when they can view that channel.
- Private channels must not leak through messages, search, realtime, or attachments.
- Message insert requires channel membership and send permission.
- Attachment metadata and storage access must follow channel visibility.
- Role/member management requires owner/admin permissions.

## Supabase environment variables

Frontend renderer placeholders:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DATA_SOURCE=mock | supabase
VITE_LIVEKIT_URL=
```

Edge Function/server-only placeholders:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Never commit real secrets.

## LiveKit/WebRTC scope

LiveKit is responsible for voice room and screen sharing media transport.

Required model:

- Client requests a room/token through a trusted boundary.
- LiveKit token is generated server-side or through a Supabase Edge Function.
- Renderer never stores LiveKit API secrets.
- Voice/screen sharing UI must work as a placeholder until actual token flow is configured.

Platform permission notes:

- Windows: microphone and screen capture prompts depend on Electron/Chromium permission flow.
- Linux: screen sharing behavior can differ by X11/Wayland session.
- macOS: microphone and screen recording permissions require OS-level permission prompts and app bundle metadata.

## Environments

Local:

- Mock mode may run without Supabase or LiveKit.
- Supabase local development may be introduced in later tasks.

Staging:

- Uses non-production Supabase project and LiveKit project.
- Seeded test data only.

Beta:

- Uses beta release channel and controlled tester data.

Production:

- Uses production Supabase and LiveKit projects.
- Requires backups, monitoring, release gates, and secrets management.

## Verification strategy

For each task:

- Run the smallest relevant check.
- Prefer typecheck/build when code changes affect TypeScript or bundling.
- Prefer file existence/content checks for documentation-only tasks.
- Do not continue feature work while build/typecheck is broken.

## Rollback strategy

- Use Git commits as task-level rollback points.
- Do not use destructive Git commands without explicit user approval.
- Database migrations require backup and rollback notes before production use.
- Feature flags or mock mode can reduce risk for incomplete backend/media features.

## Known risks

- Current app is still Vite-first and needs Electron foundation tasks before it is a complete desktop runtime.
- Supabase schema/RLS is not implemented yet.
- LiveKit token generation is not implemented yet.
- Current UI is mock-first and must be progressively connected to Supabase after schema and RLS are defined.