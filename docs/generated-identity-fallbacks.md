# Generated avatar and community icon fallback utilities

Task 067 centralizes generated identity fallback helpers.

## Runtime source

- `src/utils/generatedIdentity.ts`

## Utility responsibilities

- Stable string hashing
- Picom palette-based identity colors
- Initial generation
- Generated gradient fallback
- Community icon label fallback

## Current usage

- `MemberAvatar` uses the utility only when it needs initials/gradient fallback.
- `ServerRail` and `CommunitySidebar` use the community icon fallback label.
- Avatarpack fallback remains the preferred default for members without profile images.

## Guardrails

- No external avatar URL is generated.
- No Discord assets or icon style is introduced.
- Utilities are deterministic and backend-free.