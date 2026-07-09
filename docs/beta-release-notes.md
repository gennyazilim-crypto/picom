# Picom Beta Release Notes

## Release identity

| Field | Value |
| --- | --- |
| Version | `0.1.1-beta.1` |
| Channel | Beta |
| Product | Picom desktop community chat |
| Build | Unsigned private beta patch candidate |

## Supported platforms

- Windows desktop
- Linux desktop
- macOS desktop

Picom is desktop-only. A mobile app and mobile layout are not part of this beta.

## Included Full MVP features

### Desktop experience

- Electron desktop shell with a custom titlebar and safe preload bridge
- Premium Server Rail, Community Sidebar, Chat Main, Member Sidebar, and pinned composer
- Light and dark themes using Picom design tokens
- Coolicons through the reusable `AppIcon` system
- Settings, context menus, image preview, diagnostics, logs, and feedback surfaces

### Account and identity

- Email login, registration, logout, and session restore
- Google and Apple OAuth PKCE flows when their Supabase providers are configured
- First-run onboarding and profile completion
- Full Profile Page with local follow and activity navigation behavior

### Communities and chat

- Community and channel navigation
- Community/channel creation paths included in the MVP service architecture
- Message send, edit, and delete behavior
- Emoji, reactions, replies, image attachments, attachment grid, and image preview
- Role-aware community menu for owner, admin, moderator, member, and visitor states
- Public visitor read-only and public-community join/leave flows
- Private-channel visibility and send restrictions remain backend/RLS enforced in Supabase mode

### Home and social discovery inside Picom

- Mention Feed with `Feed` and `Takip Ettiğin Kişiler` tabs
- Followed People Stories with local seen/unseen state
- Feed Companion Rail with local voice controls, friend presence, and upcoming events
- Mention social proof footer with views, emoji summary, commenters, and comments

### Backend and realtime

- Mock mode for deterministic local desktop testing
- Supabase Auth, Postgres, RLS, Storage, and Realtime integration paths
- Staging configuration and migration runbooks
- Optimistic/realtime message reconciliation and duplicate-prevention foundations

### Voice and screen share

- LiveKit voice-room UI and service integration path
- Join, leave, mute, deafen, participant, and speaking states
- Electron desktop-capture source picker and screen-share controls
- LiveKit token Edge Function contract and staging setup instructions

## Not included

- Mobile application or mobile UI
- Bot marketplace
- Production webhook system
- Plugin runtime
- Enterprise console
- SSO or SCIM
- Billing
- Production auto-update
- Production end-to-end encryption
- Public discovery marketplace

## Before installing

1. Confirm the artifact comes from the approved beta build location.
2. Verify its checksum when checksums are supplied.
3. Expect an unsigned-app warning for local beta artifacts.
4. Do not disable operating-system security globally to install Picom.
5. Use only staging Supabase and LiveKit credentials for connected beta testing.

## Register and sign in

1. Launch Picom.
2. Select Register and create a beta account, or use the provided staging tester account.
3. Complete first-run onboarding.
4. For Google or Apple, confirm the corresponding Supabase provider and `picom://auth/callback` redirect are configured first.
5. Confirm a restored session reaches the desktop shell after restarting the app.

## Required tester flows

1. Launch, register/sign in, restart, and confirm session restore.
2. Complete onboarding and edit profile details.
3. Switch light/dark themes and maximize/restore the custom Electron window.
4. Switch communities/channels and exercise owner, admin, moderator, member, and visitor menus.
5. Join a public community and verify visitor read-only restrictions before joining.
6. Send, edit, delete, reply to, and react to a message.
7. Upload a valid image and open it in Image Preview.
8. Test Mention Feed tabs, stories, social footer, companion rail, and Full Profile Page.
9. In Supabase staging, run a two-window realtime test and verify private-channel isolation.
10. In LiveKit staging, join with two clients and test mute, deafen, speaking, leave, and screen share.
11. Export redacted diagnostics and submit feedback from the in-app support surfaces.
12. Run the platform-specific install/uninstall smoke checklist.

## Reporting an issue

Include:

- Picom version and beta channel
- Windows, Linux, or macOS version
- Mock, Supabase staging, or LiveKit staging mode
- Reproduction steps
- Expected and actual result
- Screenshot or short recording when useful
- Redacted diagnostics export

Never include passwords, authorization headers, session tokens, Supabase service-role keys, LiveKit secrets, signing credentials, or private message content not required to reproduce the issue.

## Exporting diagnostics

1. Open Settings.
2. Open Advanced or Diagnostics.
3. Review the redacted diagnostic summary.
4. Use Export Diagnostics or Export Logs.
5. Inspect the file before attaching it to a report.

## Related documents

- [Known issues](beta-known-issues.md)
- [Beta package candidate](beta-package-candidate.md)
- [Supabase staging setup](supabase-staging-setup.md)
- [LiveKit staging setup](livekit-staging-setup.md)
- [Windows smoke test](windows-smoke-test.md)
- [Linux smoke test](linux-smoke-test.md)
- [macOS smoke test](macos-smoke-test.md)
