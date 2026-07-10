# Premium Verified Account Visual System

## Scope

This checkpoint records Picom's reusable verified identity treatment. It is a visual integration only and does not change verification approval authority.

## Implemented

- Added size-aware `VerifiedBadge` variants for verified users, official communities, Picom staff, and verified bot placeholders.
- Added `VerifiedAvatarFrame`, `VerifiedAvatarRing`, `VerifiedProfileAvatar`, and the current-user profile photo action.
- Kept avatar URL, generated initials, and gradient fallback behavior centralized in `MemberAvatar`.
- Added a CSS-only blue/cyan/purple profile aura with reduced-motion support.
- Integrated compact or medium verified avatars in member rows, chat messages, mention cards, followed/popular people, and direct messages.
- Integrated the large aura only in the full Profile view.
- Kept verified rendering tied to trusted verification helper output rather than usernames, bios, or uploaded artwork.

## Security boundary

Frontend rendering is not verification authority. Production status must come from approved rows in the RLS-protected `profile_verifications` and `community_verifications` tables. Pending, rejected, revoked, or absent records must not render a verified badge.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Manual QA

1. Open a verified profile and confirm the large CSS aura, one badge, and no card overflow.
2. Open an unverified profile and confirm there is no aura or badge.
3. Confirm member rows and message authors use compact verified framing.
4. Confirm Mention Feed authors and people lists use compact/medium framing.
5. Confirm the profile photo action appears only on the current user's profile.
6. Switch between light and dark themes and enable reduced motion.
