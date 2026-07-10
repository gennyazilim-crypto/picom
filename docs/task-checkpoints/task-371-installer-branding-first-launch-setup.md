# Task 371 checkpoint: Installer branding and first launch setup

## Implemented

- Added original Picom installer placeholder asset structure and branding direction.
- Added versioned `firstLaunchSetupCompleted` local setting and migration.
- Added five-step desktop FirstLaunchSetup before login/register.
- Theme selection applies immediately; completion persists.
- Permission/voice/screen-share explanations call no native or media APIs.
- Existing authenticated onboarding remains separate and follows setup.
- Added placeholder installer license with explicit legal-review requirement.

## Validation

- `npm run first-launch:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
