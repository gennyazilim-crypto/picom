# Full Scope Definition

Picom is a premium Electron desktop community chat app for Windows, Linux, and macOS.

This document defines the full product and technical scope for the active master task pack.

## Full MVP product scope

Picom is locked to the Full MVP for the current build plan.

Included in the Full MVP:

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
- Mention Feed as the home surface, with only `Feed` and `Takip Ettiğin Kişiler` tabs.
- Full Profile Page with profile card, gallery/stats/bio/details, skills/tags, recent activity, shared media, follow/unfollow local state, open activity in channel, and image preview.
- EmojiPicker MVP, message reactions, and full reply system.
- Voice room MVP with join, leave, mute, deafen, speaking indicator, participants list, and room state.
- Screen share MVP through Electron desktopCapturer and LiveKit screen share track.

Excluded from Full MVP:

- iOS and Android apps.
- Discord branding, logos, copied assets, icons, or exact colors.
- Bot marketplace.
- Webhook production system.
- Plugin runtime.
- Enterprise admin console.
- SSO.
- SCIM.
- Billing.
- Public discovery marketplace.
- Production auto-update.
- E2EE production.
- Advanced analytics.
- Mobile app.

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

Full MVP feature domains may also require safe schema or local-state foundations for:

- mention feed state
- profile activity/shared media
- message replies
- notification preferences
- voice room state

These must stay within the MVP boundaries above and must not expand into post-MVP platform features.

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

- The task pack is large, so scope discipline is required to avoid drifting into post-MVP platform work.
- Supabase RLS must remain the source of truth for private/community data access.
- LiveKit and screen-share work must keep secrets server-side and platform permission differences documented.
- Mock mode and Supabase mode must both remain usable while the Full MVP is assembled.
