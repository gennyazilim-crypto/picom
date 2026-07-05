# Picom Beta Release Notes

## Beta version

- Version: `0.1.0-beta` placeholder
- Release channel: `beta`
- Build type: unsigned local/test desktop build

## Supported platforms

- Windows desktop
- Linux desktop
- macOS desktop

Picom is an Electron desktop app. Mobile apps and mobile layouts are not part of this beta.

## Included in this beta

- Premium desktop chat shell with custom Electron titlebar
- Four-column community layout:
  - Server rail
  - Community sidebar
  - Chat main
  - Member sidebar
- Light and dark theme support
- Coolicons/AppIcon icon system
- Mock mode for local UI testing
- Supabase mode foundation for backend testing
- Login/register/session foundation
- Community and channel navigation foundation
- Local message sending foundation
- Message list, composer, attachment grid, image preview modal
- Settings modal foundation
- Member search and profile popover foundation
- Electron packaging configuration for Windows, Linux, and macOS
- Packaging verification command: `npm run package:verify`

## Beta backend scope

Supabase is the MVP backend direction:

- Supabase Auth
- Supabase Postgres
- Supabase RLS
- Supabase Storage
- Supabase Realtime
- Edge Functions where needed

Beta testers should use `.env.beta.example` as the safe environment template and must never put service-role keys or private secrets in renderer-visible env variables.

## Beta voice/screen-share scope

LiveKit/WebRTC is the MVP media direction:

- Voice room foundation
- Screen-share foundation
- Platform QA notes for Windows, Linux, and macOS

Voice and screen-share should be treated as beta test areas until the full two-client and permission smoke tests are complete.

## Not included in this beta

- Mobile app
- Web-first responsive layout
- Discord branding, logos, copied assets, or exact colors
- Bot marketplace
- Webhook production system
- Plugin runtime
- Enterprise admin console
- SSO or SCIM
- Billing
- Public discovery marketplace
- Production auto-update
- Production E2EE
- Advanced analytics

## Known beta limitations

- Local Windows unpacked packaging can hit an `EPERM` rename error on some workstations when `release/win-unpacked.tmp` is locked by the OS, antivirus, or Controlled Folder Access.
- Vite currently reports a large chunk warning after production builds.
- Supabase CLI may be required for local Supabase schema/type workflows.
- macOS signing and notarization are placeholders only.
- Windows package signing is not configured for local beta builds.
- Some beta flows may still require mock mode if Supabase/LiveKit beta services are not configured.

## Required beta test flows

1. Start the app in mock mode.
2. Switch light and dark themes.
3. Navigate communities and channels.
4. Send a local message.
5. Open settings, context menu, profile popover, and image preview.
6. Run `npm run package:verify`.
7. Run `npm run typecheck`.
8. Run `npm run build`.
9. Configure `.env.local` from `.env.beta.example`.
10. Start Supabase mode and verify login/register/session behavior.
11. Run two-window realtime smoke testing when Supabase Realtime is configured.
12. Run voice/screen-share smoke testing when LiveKit beta credentials are configured.
13. Run platform package smoke tests using:
    - `docs/windows-smoke-test.md`
    - `docs/linux-smoke-test.md`
    - `docs/macos-smoke-test.md`

## How to report bugs

For each beta bug report, include:

- Platform: Windows, Linux, or macOS
- App version and release channel
- Environment mode: mock or Supabase
- Steps to reproduce
- Expected result
- Actual result
- Screenshots or short screen recording if useful
- Redacted logs only; never include passwords, auth tokens, Supabase service-role keys, LiveKit secrets, or signing keys

## Installation notes

- Local beta builds are unsigned.
- Windows may show an unsigned app warning.
- macOS may require manual permission approval for unsigned local builds.
- Linux package behavior depends on the AppImage/deb target and distro.

## Uninstall notes placeholder

Final uninstall instructions will be completed after platform package smoke tests. For beta, uninstall behavior should be verified as part of the Windows, Linux, and macOS smoke-test checklists.
