# Architecture Overview

Picom is a premium desktop community chat app built as an Electron desktop application with a React + TypeScript renderer, Supabase backend services, and LiveKit/WebRTC voice capabilities.

## High-level layers

```text
Electron Main Process
  - window lifecycle
  - native menus/tray/window controls later
  - safe IPC registration
  - platform-specific desktop integration

Electron Preload Bridge
  - minimal typed bridge
  - whitelisted IPC channels
  - no broad Node.js exposure

React Renderer
  - desktop app shell
  - 4-column chat UI
  - state and service calls
  - no direct native API calls

Renderer Services
  - windowService
  - platformService
  - settingsService
  - clipboard/file/notification wrappers
  - Supabase data services later
  - LiveKit voice service later

Supabase Backend
  - Auth
  - Postgres
  - Row Level Security
  - Storage
  - Realtime
  - Edge Functions for privileged operations

LiveKit / WebRTC
  - voice rooms
  - screen sharing
  - server-side token generation
```

## Desktop shell

Electron owns native window behavior. React owns the visible app UI. React components should talk to typed service abstractions, not directly to Electron APIs.

## Renderer UI

The renderer keeps a fixed desktop chat structure:

- ServerRail
- CommunitySidebar
- ChatMain
- MemberSidebar
- Settings and overlay foundations

No mobile layout or bottom navigation belongs in the MVP desktop shell.

## Backend architecture

Supabase is the primary MVP backend. Client access must be protected by RLS. Privileged workflows use Supabase Edge Functions only when justified.

## Realtime architecture

Supabase Realtime is the first backend realtime option for chat data. The renderer should keep realtime subscription logic inside services/hooks instead of scattering it across UI components.

## Voice architecture

LiveKit is the planned voice and screen-share foundation. Tokens must be generated server-side and scoped to the authenticated user and voice room.

## Security principles

- `contextIsolation` stays enabled.
- `nodeIntegration` stays disabled in renderer windows.
- No service-role keys in renderer code.
- No LiveKit secrets in renderer code.
- No Discord assets, branding, logo, or exact colors.
- Native APIs are behind typed service wrappers.

## Current implementation status

The current repository contains a Vite + React renderer baseline and documentation. Electron, Supabase, and LiveKit implementation steps begin in later tasks.