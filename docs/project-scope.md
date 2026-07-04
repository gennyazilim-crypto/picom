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

## MVP scope

The MVP includes:

- desktop app shell
- custom desktop title bar/frame direction
- server rail
- community sidebar
- chat main area
- chat header
- message list
- message composer
- member sidebar
- settings modal foundation
- profile popover foundation
- desktop context menu foundation
- light and dark theme
- mock data during early UI work
- Supabase Auth
- Supabase Postgres with RLS
- Supabase Storage for attachments
- Supabase Realtime where appropriate
- LiveKit/WebRTC voice rooms and screen sharing
- Windows/Linux/macOS desktop packaging direction

## Out of scope for early MVP phases

Do not add these until the task pack explicitly reaches them:

- mobile app
- mobile-first responsive UI
- Discord branding or assets
- plugin system
- bot platform
- public discovery marketplace
- enterprise controls
- production auto-update rollout
- analytics provider integration
- E2EE implementation
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