# Picom Release Checklist

Use this checklist before promoting a Picom desktop build to beta or a wider MVP smoke release.

Picom is an Electron desktop app for Windows, Linux, and macOS. This checklist does not cover mobile releases.

## Release scope

- [ ] Release version is selected.
- [ ] Release channel is selected: `dev`, `beta`, or `stable`.
- [ ] Scope matches the active Electron + Supabase + LiveKit MVP task track.
- [ ] No mobile UI, mobile navigation, or web-first responsive shell was added.
- [ ] No Discord branding, logos, copied assets, copied icons, or exact Discord colors are present.
- [ ] Picom logo, Picom palette, and Coolicons/AppIcon usage are preserved.

## Required automated gates

- [ ] `npm run qa:smoke` passes.
- [ ] `npm run qa:supabase` passes or missing local Supabase CLI is documented as a non-blocking local setup limitation.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Build chunk-size warnings are reviewed and documented if still present.

## Desktop UI quality

- [ ] App opens in Electron dev mode.
- [ ] Custom titlebar is visible.
- [ ] Native File/Edit/View menu is not visible.
- [ ] Minimize, maximize/restore, and close buttons work.
- [ ] Window drag area works.
- [ ] Search and theme controls are clickable and no-drag.
- [ ] Normal window mode uses the rounded premium frame.
- [ ] Maximized mode removes floating padding, radius, and large shadow.
- [ ] Four-column desktop layout is stable.
- [ ] ServerRail remains fixed at 72px.
- [ ] CommunitySidebar remains fixed at 260px.
- [ ] MemberSidebar remains fixed at 280px.
- [ ] ChatMain fills the remaining width.
- [ ] MessageList scrolls independently.
- [ ] Composer stays pinned.
- [ ] Minimum-width desktop warning appears below 1100px.
- [ ] No horizontal overflow appears.
- [ ] Light mode is complete.
- [ ] Dark mode is complete.

## Core app flows

- [ ] Mock mode starts without backend.
- [ ] Login/register screen does not crash.
- [ ] Session restore with no session is safe.
- [ ] Community switching works.
- [ ] Channel switching works.
- [ ] Local message sending works.
- [ ] Member search works.
- [ ] Settings modal opens and closes.
- [ ] Context menu opens and stays inside the window.
- [ ] Profile popover opens.
- [ ] Image preview opens.
- [ ] Home/Mention Feed behavior is checked if enabled in the current release.
- [ ] Full Profile Page behavior is checked if enabled in the current release.

## Supabase readiness

- [ ] `.env.example` keeps `VITE_DATA_SOURCE=mock` as the safe local default.
- [ ] `.env.beta.example` contains only renderer-safe placeholder values.
- [ ] Supabase service-role keys are not present in renderer code or env examples.
- [ ] RLS checklist is reviewed: `docs/rls-security-checklist.md`.
- [ ] Supabase QA gate is reviewed: `docs/supabase-qa-gate.md`.
- [ ] Auth smoke flow is checked in Supabase mode when test credentials are available.
- [ ] Community/channel/message API-mode paths are checked when Supabase is available.

## LiveKit and screen share readiness

- [ ] `npm run livekit:smoke` passes.
- [ ] LiveKit public URL remains renderer-safe.
- [ ] LiveKit API key/secret stay server-side only.
- [ ] Voice join/leave is manually checked when LiveKit credentials are available.
- [ ] Mute/deafen controls are manually checked when LiveKit credentials are available.
- [ ] Screen share picker is manually checked in Electron.
- [ ] macOS screen recording permission notes are reviewed for macOS builds.

## Packaging

- [ ] `npm run packaging:smoke` passes.
- [ ] `npm run package:verify` passes.
- [ ] Windows package command is reviewed: `npm run package:win`.
- [ ] Linux AppImage command is reviewed: `npm run package:linux:appimage`.
- [ ] Linux deb command is reviewed: `npm run package:linux:deb`.
- [ ] macOS dmg command is reviewed: `npm run package:mac:dmg`.
- [ ] Output directory is `release/`.
- [ ] Local builds remain unsigned unless production signing is explicitly configured later.
- [ ] No signing certificates, private keys, signing passwords, or notarization credentials are committed.

## Platform smoke tests

- [ ] Windows smoke checklist reviewed: `docs/windows-smoke-test.md`.
- [ ] Linux smoke checklist reviewed: `docs/linux-smoke-test.md`.
- [ ] macOS smoke checklist reviewed: `docs/macos-smoke-test.md`.
- [ ] Installer/app artifact launches on target OS.
- [ ] App icon appears correctly.
- [ ] App can be uninstalled or removed cleanly.

## Security and privacy

- [ ] `npm run secrets:smoke` passes.
- [ ] `npm run env:smoke` passes.
- [ ] Logs do not expose passwords, tokens, cookies, authorization headers, Supabase service-role keys, LiveKit API secrets, or signing keys.
- [ ] Diagnostics export is redacted.
- [ ] Feedback diagnostics are redacted.
- [ ] External native APIs are accessed through preload/service abstractions only.
- [ ] Electron security smoke gate passes.

## Documentation

- [ ] `README.md` reflects current commands.
- [ ] `docs/design-reference-qa.md` is reviewed.
- [ ] `docs/qa-smoke-gate.md` is reviewed.
- [ ] `docs/electron-packaging.md` is reviewed.
- [ ] `THIRD_PARTY_NOTICES.md` includes Coolicons attribution.
- [ ] Known issues are listed below.

## Known issues template

- [ ] Known issue:
- [ ] Impact:
- [ ] Workaround:
- [ ] Owner:
- [ ] Release blocker: yes/no

## Go / no-go decision

- [ ] Go
- [ ] Go with documented non-blockers
- [ ] No-go
- [ ] Delay pending blocker fix

Required sign-offs:

- [ ] Product
- [ ] Engineering
- [ ] Design
- [ ] Security
- [ ] Operations
