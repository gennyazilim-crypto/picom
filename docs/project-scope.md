# Picom Project Scope

Picom is a premium desktop community chat app for Windows, Linux, and macOS. The MVP is built around an Electron desktop shell, a React + TypeScript renderer, Supabase backend services, and LiveKit/WebRTC voice and screen sharing.

## Product identity

- App name: Picom
- Product type: desktop community chat app
- Runtime target: Electron
- Supported operating systems: Windows, Linux, macOS
- UI direction: premium 4-column desktop chat layout
- Icon system: Coolicons Free
- Backend direction: Supabase-first
- Voice direction: LiveKit/WebRTC

## Full MVP scope

Picom is now locked to the Full MVP. The Full MVP includes:

- Electron desktop shell with custom titlebar, safe preload IPC, `contextIsolation: true`, and `nodeIntegration: false`.
- Premium desktop UI: ServerRail, CommunitySidebar, ChatMain, MemberSidebar, MessageComposer, SettingsModal, ContextMenu, ImagePreviewModal, Mention Feed, Full Profile Page, light/dark theme, and rounded Picom app frame.
- Supabase backend: Auth, Postgres, RLS, Storage, Realtime, and Edge Functions where needed.
- Auth: login, register, logout, session restore, protected app route, and profile creation after signup.
- Community and channel flows: community list/create/switch, channel list/create/switch, private channel flag, and basic permissions.
- Messaging: fetch/send/edit/delete messages, moderator/admin delete permission, realtime insert/update/delete, typing indicator, unread/mention foundation, optimistic send, and duplicate prevention.
- Attachments: Supabase Storage image upload, PNG/JPG/WEBP/GIF validation, max file size, attachment metadata, AttachmentGrid, and ImagePreviewModal.
- Emoji, reactions, and replies: EmojiPicker MVP, emoji insertion, add/remove reactions, reaction counts, full reply system, composer reply preview, message reply preview, and deleted reply fallback.
- Home Mention Feed: home button opens Mention Feed, not DMs or a general social feed; tabs are only `Feed` and `Takip Ettiğin Kişiler`.
- Full Profile Page: full ProfileView from avatar/name, profile card, gallery/stats/bio/details, skills/tags, recent activity, shared media, local follow/unfollow, open activity in channel, and image preview.
- Voice chat: LiveKit token Edge Function, join/leave voice room, mute, deafen, speaking indicator, participants list, and voice room state.
- Screen share: Electron desktopCapturer source picker, start/stop screen share, LiveKit screen share track, and Windows/Linux/macOS QA notes.
- Settings: Account, Profile, Appearance, Notifications, Voice & Video, Keyboard Shortcuts, Advanced, theme switch, profile edit, notification settings, and basic diagnostics/log export.
- QA/build: mock mode, Supabase mode, RLS tests, realtime two-window test, voice/screen-share tests, and Windows/Linux/macOS package smoke tests.

## Out of scope for Full MVP

Do not add these to the Full MVP:

- mobile app
- mobile-first responsive UI
- Discord branding or assets
- bot marketplace
- webhook production system
- plugin runtime
- enterprise admin console
- SSO
- SCIM
- billing
- public discovery marketplace
- production auto-update rollout
- E2EE production
- advanced analytics
- arbitrary native shell execution

## Design scope

Picom should preserve:

- fixed 4-column desktop layout
- no horizontal overflow
- fixed sidebars
- independently scrolling chat list
- pinned message composer
- rounded premium surfaces
- compact spacing
- strong light/dark mode quality
- Picom palette and design tokens

## Backend scope

Supabase is the primary MVP backend. Client access must respect RLS. Privileged workflows belong in Supabase Edge Functions or a similarly controlled server-side context.

## Voice scope

LiveKit/WebRTC is the planned voice and screen sharing path. Token generation must be server-side. No LiveKit secrets should be committed or bundled into renderer code.

## Execution scope

Work proceeds one task at a time from the active 001-473 task pack. Each task should be scoped, minimally verified, and committed before continuing.
