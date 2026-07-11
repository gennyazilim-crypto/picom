# Task 473 Checkpoint: Profile Relationship Actions

## Delivered

- Follow/Unfollow with optimistic rollback and authoritative count refresh.
- Add Friend, Cancel, Accept, and Remove state machine tied to the existing friend service.
- Real Message, Block/Unblock, Report, Edit, Verification request/status, and Copy ID context actions.
- Current-user, blocked-user, self-action, privacy, rate-limit, and duplicate-submit guards.
- Friends, Feed following, DM visibility, and profile-domain reload synchronization.
- Verification request-only profile entry point; no public/self approval path.

## Validation

- `node scripts/profile-relationship-actions-smoke.mjs`
- `npm run follow:persistence:smoke`
- `npm run friends:services:smoke`
- `npm run blocking:privacy:smoke`
- `npm run reports:production:test`
- `npm run verification:badges:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Hosted relationship/RLS rate-limit probes remain BLOCKED without isolated staging credentials; no hosted result is claimed.
