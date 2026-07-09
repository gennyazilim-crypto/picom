# Picom Stable Release Notes (Draft - Not Released)

Picom is a premium desktop community chat app for Windows, Linux, and macOS. This document is a user-readable stable-release draft. The current stable decision is **No-Go**, so there is no stable version or public download yet.

## What Picom includes

- A focused desktop community/chat experience with Picom’s custom window and light/dark themes.
- Communities, text/voice channels, member lists, role-aware community controls, and visitor read-only behavior.
- Message send/edit/delete, replies, emoji reactions, image attachments, and image preview.
- Mention Feed, followed-user stories, social context, and full profile views.
- Supabase-backed Auth/Postgres/RLS/Storage/Realtime paths plus deterministic mock mode.
- LiveKit voice rooms and screen-sharing paths with native Electron source selection.
- Settings, diagnostics/log export, feedback, accessibility, and desktop safety controls.

## Supported release formats (planned)

- Windows x64 installer.
- Linux x64 AppImage and deb.
- macOS x64 dmg and zip.

Native arm64/universal macOS, Linux arm64, rpm, mobile, and browser-first versions are not currently included.

## Privacy and security

- Picom does not claim end-to-end encryption.
- Private content depends on deployed Supabase RLS/Storage policies and must pass release verification.
- Diagnostics are local/explicit and redact credential-like values; users should review exports before sharing.
- LiveKit room tokens are generated server-side and are not stored in desktop settings.
- Picom never asks users to disable operating-system security globally.

## Not included

- Mobile app/UI.
- Bot/plugin marketplace or production webhook platform.
- Enterprise SSO/SCIM/billing console.
- Public discovery marketplace.
- Production auto-update.
- Production E2EE or advanced analytics.

## Known release blockers

- Production-like Supabase/RLS/Storage/Realtime/Edge verification.
- Historical private attachment signed-URL refresh after reload.
- Deployed LiveKit two-client/native voice and screen-share tests.
- Native Linux/macOS packages and platform smoke.
- Stable Windows/macOS signing/notarization.
- Real backup restore drill and final legal/privacy sign-off.

Stable downloads will not be published until these are closed and a new Go decision is recorded.

## When a stable build is released

Download only from the approved Picom release location, compare the published SHA-256, verify platform signature/notarization where applicable, and follow `docs/download-and-install.md`. Report issues through the approved Picom support channel with version, platform, steps, expected/actual result, and optional redacted diagnostics. Never send passwords, tokens, or private keys.
