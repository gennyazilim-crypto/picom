# Task 35 Checkpoint: macOS Signing and Notarization Finalization

## Scope

- Added macOS build/lifecycle guidance for dmg and zip x64 artifacts.
- Added protected Developer ID signing, hardened-runtime, notarization, stapling, Gatekeeper, verification, and incident guidance.
- Added detailed microphone and Screen Recording denial/grant/restart tests.
- Extended the existing macOS smoke checklist.

## Verified configuration

- Bundle ID `com.picom.desktop`, Picom identity, dmg/zip x64 targets, app icon, microphone text, and screen-capture text exist.
- Current `hardenedRuntime: false` and `gatekeeperAssess: false` remain explicit unsigned-local-beta placeholders.
- No Apple certificate, key, Apple ID, app password, API key, or notary credential was added.

## Validation

- `npm run packaging:smoke` - passed configuration checks.
- `npm run electron:security:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed on Windows with the known non-blocking chunk warning.
- Native macOS package/sign/notarize/Gatekeeper/permission smoke - not run; macOS host and protected credentials required.

## External work remaining

- Configure protected macOS signing/notarization CI and reviewed entitlements.
- Build/test on native macOS; Windows cannot claim this pass.
- Decide/implement arm64 or universal support separately if required.
